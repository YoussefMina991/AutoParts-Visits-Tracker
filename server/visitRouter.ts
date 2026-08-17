import { z } from "zod";
import { eq, and, gte, lte, desc, count, lt } from "drizzle-orm";
import { router, protectedProcedure, adminProcedure } from "./_core/trpc";
import { getDb } from "./db";
import { visits, managers, branches, users, locationLogs } from "../drizzle/schema";
import { storagePut } from "./storage";
import { getDistanceMeters } from "../shared/utils";
import { getBranchDistance } from "../shared/gizaBranchDistances";
import { notifyOwner } from "./_core/notification";

// ── دالة مساعدة: احسب المسافة من الفرع السابق (أي زيارة مكتملة في نفس اليوم) ─
async function calcDistanceFromPrevBranch(
  db: Awaited<ReturnType<typeof getDb>>,
  managerId: number,
  currentBranchName: string,
  referenceTime: Date,
): Promise<{ km: number; prevBranchName: string; timeDiffMin: number } | null> {
  if (!db) return null;

  const dayStart = new Date(referenceTime);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  // جيب آخر زيارة مكتملة في نفس اليوم (أي مدة — مش شرط 15 دقيقة)
  const prevVisits = await db.select({
    branchName: branches.name,
    checkInAt:  visits.checkInAt,
    checkOutAt: visits.checkOutAt,
  }).from(visits)
    .innerJoin(branches, eq(visits.branchId, branches.id))
    .where(and(
      eq(visits.managerId, managerId),
      eq(visits.status, "checked_out"),
      gte(visits.checkInAt, dayStart),
      lt(visits.checkInAt, referenceTime), // قبل الزيارة الحالية فقط
    ))
    .orderBy(desc(visits.checkInAt))
    .limit(1);

  if (!prevVisits[0]?.checkOutAt) return null;

  const prev = prevVisits[0];
  const km = getBranchDistance(prev.branchName, currentBranchName);
  if (km === null) return null;

  const timeDiffMin = (referenceTime.getTime() - prev.checkOutAt.getTime()) / 60_000;

  return { km, prevBranchName: prev.branchName, timeDiffMin };
}

// ── دالة مساعدة: هل الانتقال مستحيل؟ (Teleportation check) ─────────────────
function isTeleportation(km: number, timeDiffMin: number): boolean {
  if (timeDiffMin <= 0) return true; // مستحيل فيزيائياً
  const speedKmh = km / (timeDiffMin / 60);
  // أكثر من 80 كم/ساعة في وسط القاهرة والجيزة → مستحيل
  return speedKmh > 80;
}

export const visitRouter = router({
  // POST — manager checks in to a branch
  checkIn: protectedProcedure
    .input(z.object({
      branchId: z.number(),
      latitude: z.string(),
      longitude: z.string(),
      accuracy: z.string().optional(),
      photoBase64: z.string().optional(),
      notes: z.string().optional(),
      isMocked: z.boolean().optional(),
      // ── نظام كشف التلاعب المتقدم ──────────────────────────────────────
      suspicionScore: z.number().min(0).max(500).optional(),
      mockReasons: z.array(z.string()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const managerResult = await db.select().from(managers).where(eq(managers.userId, ctx.user!.id)).limit(1);
      if (!managerResult[0]) throw new Error("Manager profile not found");
      const manager = managerResult[0];

      const existingVisits = await db.select({ id: visits.id }).from(visits)
        .where(and(eq(visits.managerId, manager.id), eq(visits.status, "checked_in"))).limit(1);
      if (existingVisits.length > 0) throw new Error("Already checked into a branch. Please check out first.");

      const branchResult = await db.select().from(branches).where(eq(branches.id, input.branchId)).limit(1);
      if (!branchResult[0]) throw new Error("Branch not found");
      const branch = branchResult[0];

      const dist = getDistanceMeters(
        parseFloat(input.latitude), parseFloat(input.longitude),
        parseFloat(branch.latitude), parseFloat(branch.longitude)
      );
      if (dist > (branch.geofenceRadiusMeters || 200) + 50) throw new Error("You are too far from the branch to check in.");

      let photoUrl: string | undefined;
      if (input.photoBase64) {
        const buffer = Buffer.from(input.photoBase64.replace(/^data:image\/\w+;base64,/, ""), "base64");
        const stored = await storagePut(`visits/${manager.id}_${Date.now()}.jpg`, buffer, "image/jpeg");
        photoUrl = stored.url;
      }

      // ── دمج نقاط الشك من الـ client مع فحوصات السيرفر ──────────────────────
      const clientScore   = input.suspicionScore ?? 0;
      const clientReasons = input.mockReasons    ?? [];

      // ── 🚨 فحص Teleportation وقت الـ CheckIn (الأهم) ────────────────────────
      // السيرفر بيفحص: هل المدير وصل من فرع تاني في وقت مستحيل؟
      let serverTeleportScore = 0;
      const serverTeleportReasons: string[] = [];

      const prevResult = await calcDistanceFromPrevBranch(db, manager.id, branch.name, new Date());
      if (prevResult !== null) {
        const { km, prevBranchName, timeDiffMin } = prevResult;
        if (isTeleportation(km, timeDiffMin)) {
          serverTeleportScore = 100;
          const speedKmh = Math.round(km / (timeDiffMin / 60));
          serverTeleportReasons.push(
            `TELEPORTATION:${prevBranchName}→${branch.name}:${km.toFixed(1)}km:${Math.round(timeDiffMin)}min:${speedKmh}kmh`
          );
        }
      }

      const totalScore    = clientScore + serverTeleportScore;
      const allReasons    = [...clientReasons, ...serverTeleportReasons];
      const finalIsMocked = input.isMocked || clientScore >= 50 || serverTeleportScore >= 100;
      const finalScore    = totalScore;
      const finalReasons  = allReasons.length > 0 ? JSON.stringify(allReasons) : null;

      // ✅ المسافة هتتحسب وقت الـ Check-Out مش هنا — بنحفظ distanceToPrevBranchKm = null دلوقتي
      await db.insert(visits).values({
        managerId: manager.id, branchId: input.branchId,
        latitudeIn: input.latitude, longitudeIn: input.longitude,
        accuracyIn: input.accuracy, photoUrl, notes: input.notes,
        status: "checked_in",
        isMocked: finalIsMocked ? "yes" : "no",
        suspicionScore: finalScore,
        mockReasons: finalReasons,
        distanceToPrevBranchKm: undefined,  // هيتحدث وقت الـ checkout
      });

      // 🚨 لو الزيارة وهمية — ابعت إشعار فوري للأدمن
      if (finalIsMocked) {
        const managerName = (await db.select({ name: users.name })
          .from(users).where(eq(users.id, ctx.user!.id)).limit(1))[0]?.name ?? "مدير غير معروف";
        notifyOwner({
          title: "🚨 زيارة وهمية مكتشفة",
          content: `المدير: ${managerName}\nالفرع: ${branch.name}\nالوقت: ${new Date().toLocaleString("ar-EG")}\nدرجة الشك: ${finalScore}\nالأسباب: ${clientReasons.join(", ") || "كشف تلقائي"}`,
        }).catch(() => {}); // لا نوقف الـ check-in لو فشل الإشعار
      }

      return { success: true };
    }),

  // POST — Android native background service checkout (accepts branchId, looks up the active visitId itself)
  // Used by NativeGeofenceEngine.java which only knows the branchId, not the visitId
  nativeCheckOut: protectedProcedure
    .input(z.object({ branchId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const managerResult = await db.select().from(managers).where(eq(managers.userId, ctx.user!.id)).limit(1);
      if (!managerResult[0]) throw new Error("Manager profile not found");
      const manager = managerResult[0];

      // Find the active check-in for this specific branch
      const activeVisit = await db.select({
        id: visits.id,
        checkInAt: visits.checkInAt,
        branchName: branches.name,
      }).from(visits)
        .innerJoin(branches, eq(visits.branchId, branches.id))
        .where(and(
          eq(visits.managerId, manager.id),
          eq(visits.branchId, input.branchId),
          eq(visits.status, "checked_in"),
        ))
        .limit(1);

      if (!activeVisit[0]) {
        // No active visit for this branch — nothing to check out from
        return { success: true, skipped: true };
      }

      const now = new Date();
      const visit = activeVisit[0];
      const durationMin = (now.getTime() - visit.checkInAt.getTime()) / 60_000;

      // المسافة بتتحسب دايماً — بغض النظر عن المدة
      let distanceToPrevBranchKm: number | undefined;
      let isTeleporting = false;

      const prevResult = await calcDistanceFromPrevBranch(db, manager.id, visit.branchName, visit.checkInAt);
      if (prevResult !== null) {
        distanceToPrevBranchKm = prevResult.km;
        // إعادة فحص Teleportation هنا كـ double-check (الأساسي بيحصل وقت checkIn)
        if (isTeleportation(prevResult.km, prevResult.timeDiffMin)) {
          isTeleporting = true;
        }
      }

      // نفس المنطق: لا نكتب "no" أبداً — فقط "yes" إذا اكتشفنا teleporting
      const nativeCheckOutMockedUpdate = isTeleporting
        ? { isMocked: "yes" as const }
        : {};

      await db.update(visits).set({
        checkOutAt: now,
        status: "checked_out",
        ...nativeCheckOutMockedUpdate,
        ...(distanceToPrevBranchKm !== undefined ? { distanceToPrevBranchKm } : {}),
      }).where(and(
        eq(visits.id, visit.id),
        eq(visits.managerId, manager.id),
      ));

      return {
        success: true,
        skipped: false,
        durationMin: Math.round(durationMin),
        distanceRecorded: distanceToPrevBranchKm ?? null,
      };
    }),

  // POST — manager checks out
  checkOut: protectedProcedure
    .input(z.object({ visitId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const managerResult = await db.select().from(managers).where(eq(managers.userId, ctx.user!.id)).limit(1);
      if (!managerResult[0]) throw new Error("Manager profile not found");
      const manager = managerResult[0];

      // ── اجيب بيانات الزيارة الحالية ────────────────────────────────────────
      const visitResult = await db.select({
        id:        visits.id,
        checkInAt: visits.checkInAt,
        branchName: branches.name,
      }).from(visits)
        .innerJoin(branches, eq(visits.branchId, branches.id))
        .where(and(
          eq(visits.id, input.visitId),
          eq(visits.managerId, manager.id),
          eq(visits.status, "checked_in"),
        ))
        .limit(1);

      if (!visitResult[0]) throw new Error("Visit not found or already checked out.");

      const now = new Date();
      const visit = visitResult[0];
      const durationMin = (now.getTime() - visit.checkInAt.getTime()) / 60_000;

      // المسافة والـ Teleportation بيتحسبوا دايماً بغض النظر عن المدة
      let distanceToPrevBranchKm: number | undefined;
      let isTeleporting = false;

      const prevResult = await calcDistanceFromPrevBranch(db, manager.id, visit.branchName, visit.checkInAt);
      if (prevResult !== null) {
        distanceToPrevBranchKm = prevResult.km;
        if (isTeleportation(prevResult.km, prevResult.timeDiffMin)) {
          isTeleporting = true;
        }
      }

      // isMocked: لو اكتشفنا teleporting → "yes" / لو لأ → نحافظ على قرار check-in
      const checkOutMockedUpdate = isTeleporting
        ? { isMocked: "yes" as const }
        : {};

      await db.update(visits).set({
        checkOutAt: now,
        status: "checked_out",
        ...checkOutMockedUpdate,
        ...(distanceToPrevBranchKm !== undefined ? { distanceToPrevBranchKm } : {}),
      }).where(and(
        eq(visits.id, input.visitId),
        eq(visits.managerId, manager.id),
      ));

      // 🚨 لو السيرفر اكتشف teleporting — ابعت إشعار للأدمن
      if (isTeleporting) {
        const managerName = (await db.select({ name: users.name })
          .from(users).where(eq(users.id, ctx.user!.id)).limit(1))[0]?.name ?? "مدير غير معروف";
        notifyOwner({
          title: "🚨 انتقال وهمي مكتشف (Teleportation)",
          content: `المدير: ${managerName}\nالفرع: ${visit.branchName}\nالمسافة: ${distanceToPrevBranchKm?.toFixed(1)} كم في ${Math.round(prevResult!.timeDiffMin)} دقيقة\nالوقت: ${now.toLocaleString("ar-EG")}`,
        }).catch(() => {});
      }

      return {
        success: true,
        durationMin: Math.round(durationMin),
        distanceRecorded: distanceToPrevBranchKm ?? null,
      };
    }),

  // GET — current manager's visit history
  myHistory: protectedProcedure
    .input(z.object({ limit: z.number().default(50), offset: z.number().default(0) }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const managerResult = await db.select().from(managers).where(eq(managers.userId, ctx.user!.id)).limit(1);
      if (!managerResult[0]) return { items: [], total: 0 };
      const managerId = managerResult[0].id;
      const whereClause = eq(visits.managerId, managerId);
      const [{ total }] = await db.select({ total: count() }).from(visits).where(whereClause);
      const items = await db.select({
        id: visits.id, checkInAt: visits.checkInAt, checkOutAt: visits.checkOutAt,
        status: visits.status, photoUrl: visits.photoUrl, notes: visits.notes,
        latitudeIn: visits.latitudeIn, longitudeIn: visits.longitudeIn,
        distanceToPrevBranchKm: visits.distanceToPrevBranchKm,
        isMocked: visits.isMocked,
        branchName: branches.name, branchId: branches.id, branchCode: branches.code, branchAddress: branches.address,
      }).from(visits).innerJoin(branches, eq(visits.branchId, branches.id))
        .where(whereClause).orderBy(desc(visits.checkInAt)).limit(input.limit).offset(input.offset);
      return { items, total };
    }),

  // GET — admin: all visits with filters
  adminList: adminProcedure
    .input(z.object({
      managerId: z.number().optional(),
      branchId: z.number().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      limit: z.number().default(100),
      offset: z.number().default(0),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const conditions = [];
      if (input.managerId) conditions.push(eq(visits.managerId, input.managerId));
      if (input.branchId) conditions.push(eq(visits.branchId, input.branchId));
      if (input.startDate) conditions.push(gte(visits.checkInAt, new Date(input.startDate)));
      if (input.endDate) {
        const end = new Date(input.endDate);
        end.setHours(23, 59, 59, 999);
        conditions.push(lte(visits.checkInAt, end));
      }
      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
      const [{ total }] = await db.select({ total: count() }).from(visits)
        .innerJoin(managers, eq(visits.managerId, managers.id))
        .innerJoin(users, eq(managers.userId, users.id)).where(whereClause);
      const items = await db.select({
        id: visits.id, checkInAt: visits.checkInAt, checkOutAt: visits.checkOutAt,
        status: visits.status, photoUrl: visits.photoUrl, notes: visits.notes,
        distanceToPrevBranchKm: visits.distanceToPrevBranchKm,
        isMocked: visits.isMocked,
        branchName: branches.name, branchId: branches.id, branchCode: branches.code,
        managerName: users.name, managerEmail: users.email,
        managerPhotoUrl: managers.photoUrl,
      }).from(visits).innerJoin(branches, eq(visits.branchId, branches.id))
        .innerJoin(managers, eq(visits.managerId, managers.id))
        .innerJoin(users, eq(managers.userId, users.id))
        .where(whereClause).orderBy(desc(visits.checkInAt)).limit(input.limit).offset(input.offset);
      return { items, total };
    }),

  // GET — admin dashboard stats
  stats: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const [{ totalBranches }] = await db
      .select({ totalBranches: count() })
      .from(branches)
      .where(eq(branches.isActive, "yes"));

    const [{ totalManagers }] = await db
      .select({ totalManagers: count() })
      .from(managers)
      .where(eq(managers.isActive, "yes"));

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [{ todayVisits }] = await db
      .select({ todayVisits: count() })
      .from(visits)
      .where(gte(visits.checkInAt, today));

    const [{ mockedVisitsToday }] = await db
      .select({ mockedVisitsToday: count() })
      .from(visits)
      .where(and(gte(visits.checkInAt, today), eq(visits.isMocked, "yes")));

    return { totalBranches, totalManagers, todayVisits, mockedVisitsToday };
  }),

  // GET — recent visits for dashboard
  recentVisits: adminProcedure
    .input(z.object({ limit: z.number().default(5) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const items = await db.select({
        id: visits.id,
        checkInAt: visits.checkInAt,
        checkOutAt: visits.checkOutAt,
        status: visits.status,
        isMocked: visits.isMocked,
        branchName: branches.name,
        managerName: users.name,
        managerId: managers.id,
      }).from(visits)
        .innerJoin(branches, eq(visits.branchId, branches.id))
        .innerJoin(managers, eq(visits.managerId, managers.id))
        .innerJoin(users, eq(managers.userId, users.id))
        .orderBy(desc(visits.checkInAt))
        .limit(input.limit);
      return items;
    }),

  // GET — الزيارات المفتوحة حالياً لكل مدير (للداشبورد)
  activeVisits: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    const items = await db.select({
      managerId: managers.id,
      branchName: branches.name,
      checkInAt: visits.checkInAt,
    }).from(visits)
      .innerJoin(branches, eq(visits.branchId, branches.id))
      .innerJoin(managers, eq(visits.managerId, managers.id))
      .where(eq(visits.status, "checked_in"));
    return items;
  }),

  // POST — sync offline visits (check-in / check-out)
  syncOfflineVisits: protectedProcedure
    .input(z.object({
      visits: z.array(z.discriminatedUnion("type", [
        z.object({
          type: z.literal("check_in"),
          branchId: z.number(),
          branchName: z.string(),
          latitude: z.string(),
          longitude: z.string(),
          accuracy: z.string().optional(),
          checkInAt: z.string(),
          localId: z.string(),
          isMocked: z.boolean().optional(),
          suspicionScore: z.number().min(0).max(500).optional(),
          mockReasons: z.array(z.string()).optional(),
        }),
        z.object({
          type: z.literal("check_out"),
          localCheckInId: z.string(),
          serverVisitId: z.number().optional(),
          branchName: z.string(),
          checkOutAt: z.string(),
          checkInAt: z.string(),    // ✅ مضاف: محتاجه نحسب المدة
        }),
      ])),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const managerResult = await db.select().from(managers)
        .where(eq(managers.userId, ctx.user!.id)).limit(1);
      if (!managerResult[0]) throw new Error("Manager profile not found");
      const manager = managerResult[0];

      let synced = 0;
      let rejected = 0;
      const failedLocalIds: string[] = [];
      const localToServerId = new Map<string, number>();

      // ── 1. check-ins ──────────────────────────────────────────────────────
      const checkIns = input.visits.filter((v) => v.type === "check_in");
      for (const ci of checkIns) {
        try {
          const existing = await db.select({ id: visits.id }).from(visits)
            .where(and(eq(visits.managerId, manager.id), eq(visits.status, "checked_in")))
            .limit(1);
          if (existing.length > 0) { failedLocalIds.push(ci.localId); rejected++; continue; }

          const branchResult = await db.select().from(branches)
            .where(eq(branches.id, ci.branchId)).limit(1);
          if (!branchResult[0]) { failedLocalIds.push(ci.localId); rejected++; continue; }
          const branch = branchResult[0];

          const dist = getDistanceMeters(
            parseFloat(ci.latitude), parseFloat(ci.longitude),
            parseFloat(branch.latitude), parseFloat(branch.longitude)
          );
          if (dist > (branch.geofenceRadiusMeters || 200) + 50) {
            console.warn(`[syncOfflineVisits] Rejected: manager ${manager.id} was ${Math.round(dist)}m from branch ${branch.name}`);
            failedLocalIds.push(ci.localId);
            rejected++;
            continue;
          }

          // ✅ check-in offline: فحص Teleportation + mock detection
          const ciScore   = ci.suspicionScore ?? 0;
          const ciReasons = [...(ci.mockReasons ?? [])];

          // فحص Teleportation للزيارات الأوفلاين
          let ciServerTeleportScore = 0;
          const checkInTime = new Date(ci.checkInAt);
          const prevResult = await calcDistanceFromPrevBranch(db, manager.id, ci.branchName, checkInTime);
          if (prevResult !== null && isTeleportation(prevResult.km, prevResult.timeDiffMin)) {
            ciServerTeleportScore = 100;
            const speedKmh = Math.round(prevResult.km / (prevResult.timeDiffMin / 60));
            ciReasons.push(`TELEPORTATION:${prevResult.prevBranchName}→${ci.branchName}:${prevResult.km.toFixed(1)}km:${Math.round(prevResult.timeDiffMin)}min:${speedKmh}kmh`);
          }

          const ciFinalMocked = ci.isMocked || ciScore >= 50 || ciServerTeleportScore >= 100;
          const ciTotalScore = ciScore + ciServerTeleportScore;

          const [inserted] = await db.insert(visits).values({
            managerId: manager.id,
            branchId: ci.branchId,
            latitudeIn: ci.latitude,
            longitudeIn: ci.longitude,
            accuracyIn: ci.accuracy,
            checkInAt: new Date(ci.checkInAt),
            status: "checked_in",
            isMocked: ciFinalMocked ? "yes" : "no",
            suspicionScore: ciTotalScore,
            mockReasons: ciReasons.length > 0 ? JSON.stringify(ciReasons) : null,
            distanceToPrevBranchKm: undefined,
          }).$returningId();

          // 🚨 لو الزيارة المتزامنة وهمية — ابعت إشعار للأدمن
          if (ciFinalMocked) {
            const branchRes = await db.select({ name: branches.name })
              .from(branches).where(eq(branches.id, ci.branchId)).limit(1);
            const managerUserRes = await db.select({ name: users.name })
              .from(users).where(eq(users.id, ctx.user!.id)).limit(1);
            notifyOwner({
              title: "🚨 زيارة وهمية مكتشفة (أوفلاين)",
              content: `المدير: ${managerUserRes[0]?.name ?? "غير معروف"}\nالفرع: ${branchRes[0]?.name ?? ci.branchName}\nوقت الدخول: ${new Date(ci.checkInAt).toLocaleString("ar-EG")}\nدرجة الشك: ${ciScore}\nالأسباب: ${ciReasons.join(", ") || "كشف تلقائي"}`,
            }).catch(() => {});
          }

          localToServerId.set(ci.localId, inserted.id);
          synced++;
        } catch (err) {
          console.error("[syncOfflineVisits] checkIn error:", err);
          failedLocalIds.push(ci.localId);
        }
      }

      // ── 2. check-outs ─────────────────────────────────────────────────────
      const checkOuts = input.visits.filter((v) => v.type === "check_out");
      for (const co of checkOuts) {
        try {
          const visitId = localToServerId.get(co.localCheckInId)
            ?? (co.serverVisitId ?? null);

          if (!visitId) { failedLocalIds.push(co.localCheckInId); continue; }

          const checkInTime  = new Date(co.checkInAt);
          const checkOutTime = new Date(co.checkOutAt);
          const durationMin  = (checkOutTime.getTime() - checkInTime.getTime()) / 60_000;

          let distanceToPrevBranchKm: number | undefined;
          let isTeleporting = false;

          const visitRow = await db.select({ branchName: branches.name })
            .from(visits)
            .innerJoin(branches, eq(visits.branchId, branches.id))
            .where(eq(visits.id, visitId))
            .limit(1);

          if (visitRow[0]) {
            const prevResult = await calcDistanceFromPrevBranch(
              db, manager.id, visitRow[0].branchName, checkInTime
            );
            if (prevResult !== null) {
              distanceToPrevBranchKm = prevResult.km;
              if (isTeleportation(prevResult.km, prevResult.timeDiffMin)) {
                isTeleporting = true;
              }
            }
          }

          // لا نكتب "no" — نحافظ على قرار check-in إذا لم يُكتشف teleporting
          const syncCheckOutMockedUpdate = isTeleporting
            ? { isMocked: "yes" as const }
            : {};

          await db.update(visits)
            .set({
              checkOutAt: checkOutTime,
              status: "checked_out",
              ...syncCheckOutMockedUpdate,
              ...(distanceToPrevBranchKm !== undefined ? { distanceToPrevBranchKm } : {}),
            })
            .where(and(
              eq(visits.id, visitId),
              eq(visits.managerId, manager.id),
            ));
          synced++;
        } catch (err) {
          console.error("[syncOfflineVisits] checkOut error:", err);
        }
      }

      return { synced, rejected, failedLocalIds };
    }),

  // POST — sync offline tracking data
  syncOfflineData: protectedProcedure
    .input(z.object({
      locations: z.array(z.object({
        latitude: z.string(), longitude: z.string(),
        accuracy: z.string().optional(), timestamp: z.string(),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const managerResult = await db.select().from(managers).where(eq(managers.userId, ctx.user!.id)).limit(1);
      if (!managerResult[0]) throw new Error("Manager profile not found");
      const manager = managerResult[0];
      if (input.locations.length > 0) {
        await db.insert(locationLogs).values(input.locations.map(loc => ({
          managerId: manager.id, latitude: loc.latitude, longitude: loc.longitude,
          accuracy: loc.accuracy, timestamp: new Date(loc.timestamp), syncedAt: new Date(),
        })));
      }
      return { success: true, syncedLocations: input.locations.length };
    }),
});

import { z } from "zod";
import { eq, and, gte, lte, desc, count, lt } from "drizzle-orm";
import { router, protectedProcedure, adminProcedure } from "./_core/trpc";
import { getDb } from "./db";
import { visits, managers, branches, users, locationLogs } from "../drizzle/schema";
import { storagePut } from "./storage";
import { getDistanceMeters } from "../shared/utils";
import { getBranchDistance } from "../shared/gizaBranchDistances";

// ── الحد الأدنى للإقامة في الفرع عشان تتحسب المسافة (بالدقايق) ──────────────
const MIN_VISIT_DURATION_MINUTES = 0;

// ── دالة مساعدة: احسب المسافة من الفرع السابق لو الزيارة السابقة كانت معتبرة ─
/**
 * بترجع المسافة بالكيلومتر من آخر فرع "معتبر" في نفس اليوم.
 * الزيارة "المعتبرة": status = checked_out + مدتها >= 15 دقيقة.
 * لو مفيش زيارة معتبرة أو المسافة مش في الجدول → ترجع null.
 */
async function calcDistanceFromPrevBranch(
  db: Awaited<ReturnType<typeof getDb>>,
  managerId: number,
  currentBranchName: string,
  referenceTime: Date,    // وقت الدخول للفرع الحالي (أو وقت الـ sync)
): Promise<number | null> {
  if (!db) return null;

  const dayStart = new Date(referenceTime);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  // ── اجيب آخر زيارة "معتبرة" (15 دقيقة+) في نفس اليوم ──────────────────
  // الزيارة المعتبرة: status = checked_out + مدتها >= 15 دقيقة.
  const allPrevVisits = await db.select({
    branchName: branches.name,
    checkInAt:  visits.checkInAt,
    checkOutAt: visits.checkOutAt,
  }).from(visits)
    .innerJoin(branches, eq(visits.branchId, branches.id))
    .where(and(
      eq(visits.managerId, managerId),
      eq(visits.status, "checked_out"),
      gte(visits.checkInAt, dayStart),
      lt(visits.checkInAt, dayEnd),
    ))
    .orderBy(desc(visits.checkInAt));

  // ابحث عن أول زيارة سابقة مدتها كانت 15 دقيقة أو أكثر
  const prevQualified = allPrevVisits.find(v => {
    if (!v.checkOutAt) return false;
    const duration = (v.checkOutAt.getTime() - v.checkInAt.getTime()) / 60_000;
    return duration >= MIN_VISIT_DURATION_MINUTES;
  });

  if (!prevQualified) return null;

  const prev = prevQualified;

  // ── ابحث عن المسافة في الجدول ─────────────────────────────────────────────
  return getBranchDistance(prev.branchName, currentBranchName);
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

      // ── دمج نقاط الشك من الـ client مع أي فحوصات إضافية على السيرفر ──────
      const clientScore   = input.suspicionScore ?? 0;
      const clientReasons = input.mockReasons    ?? [];

      // السيرفر بيقرر isMocked لو score >= 50 (بغض النظر عما قاله الـ client)
      const finalIsMocked = input.isMocked || clientScore >= 50;
      const finalScore    = clientScore;
      const finalReasons  = clientReasons.length > 0 ? JSON.stringify(clientReasons) : null;

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
      const isQualified = durationMin >= MIN_VISIT_DURATION_MINUTES;

      let distanceToPrevBranchKm: number | undefined;
      let isTeleporting = false;

      if (isQualified) {
        const km = await calcDistanceFromPrevBranch(db, manager.id, visit.branchName, visit.checkInAt);
        if (km !== null) {
          distanceToPrevBranchKm = km;
          
          // ── التحقق من "الانتقال الآني" (Teleportation Check) ──────────────────
          // لو المسافة كبيرة والوقت قليل جداً بين الفرعين → يبقى موقع وهمي
          // هنجيب آخر زيارة خلصت قبل الزيارة دي
          const prevVisit = await db.select({ checkOutAt: visits.checkOutAt })
            .from(visits)
            .where(and(
              eq(visits.managerId, manager.id),
              eq(visits.status, "checked_out"),
              lt(visits.checkInAt, visit.checkInAt)
            ))
            .orderBy(desc(visits.checkInAt))
            .limit(1);

          if (prevVisit[0]?.checkOutAt) {
            const timeDiffHours = (visit.checkInAt.getTime() - prevVisit[0].checkOutAt.getTime()) / 3600000;
            if (timeDiffHours > 0) {
              const speed = km / timeDiffHours;
              if (speed > 150) { // أكثر من 150 كم/ساعة بين فرعين في وسط الزحمة؟ مستحيل.
                isTeleporting = true;
              }
            }
          }
        }
      }

      await db.update(visits).set({
        checkOutAt: now,
        status: "checked_out",
        isMocked: isTeleporting ? "yes" : undefined, // لو اكتشفنا سرعة خيالية نعلّمها وهمي
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
        shortVisitWarning: !isQualified
          ? `الزيارة كانت ${Math.round(durationMin)} دقيقة فقط — المسافة لم تُسجَّل`
          : undefined,
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

      // ── تحقق من مدة الإقامة ─────────────────────────────────────────────────
      const durationMin = (now.getTime() - visit.checkInAt.getTime()) / 60_000;
      const isQualified = durationMin >= MIN_VISIT_DURATION_MINUTES;

      // ── لو الزيارة معتبرة (15 دقيقة+) احسب المسافة من الفرع السابق ──────────
      let distanceToPrevBranchKm: number | undefined;
      let isTeleporting = false;

      if (isQualified) {
        const km = await calcDistanceFromPrevBranch(db, manager.id, visit.branchName, visit.checkInAt);
        if (km !== null) {
          distanceToPrevBranchKm = km;

          // ── التحقق من "الانتقال الآني" (Teleportation Check) ──────────────────
          const prevVisit = await db.select({ checkOutAt: visits.checkOutAt })
            .from(visits)
            .where(and(
              eq(visits.managerId, manager.id),
              eq(visits.status, "checked_out"),
              lt(visits.checkInAt, visit.checkInAt)
            ))
            .orderBy(desc(visits.checkInAt))
            .limit(1);

          if (prevVisit[0]?.checkOutAt) {
            const timeDiffMs = visit.checkInAt.getTime() - prevVisit[0].checkOutAt.getTime();
            const timeDiffHours = timeDiffMs / 3600000;
            
            if (timeDiffHours > 0) {
              const speed = km / timeDiffHours;
              if (speed > 150) isTeleporting = true;
            } else if (km > 0.1 && timeDiffMs <= 0) {
              // لو المسافة حقيقية والزمن صفر (نفس الدقيقة) -> تلاعب
              isTeleporting = true;
            }
          }
        }
      }

      // ── اعمل الـ checkout وحدّث المسافة في نفس الوقت ────────────────────────
      await db.update(visits).set({
        checkOutAt: now,
        status: "checked_out",
        isMocked: isTeleporting ? "yes" : undefined,
        ...(distanceToPrevBranchKm !== undefined ? { distanceToPrevBranchKm } : {}),
      }).where(and(
        eq(visits.id, input.visitId),
        eq(visits.managerId, manager.id),
      ));

      return {
        success: true,
        durationMin: Math.round(durationMin),
        distanceRecorded: distanceToPrevBranchKm ?? null,
        // لو الزيارة كانت قصيرة — نبلّغ الـ client عشان يعرض رسالة
        shortVisitWarning: !isQualified
          ? `الزيارة كانت ${Math.round(durationMin)} دقيقة فقط — المسافة لم تُسجَّل (الحد الأدنى ${MIN_VISIT_DURATION_MINUTES} دقيقة)`
          : undefined,
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

          // ✅ check-in offline: مسافة = null دلوقتي — هتتحسب عند الـ checkout
          const ciScore   = ci.suspicionScore ?? 0;
          const ciReasons = ci.mockReasons    ?? [];
          const ciFinalMocked = ci.isMocked || ciScore >= 50;

          const [inserted] = await db.insert(visits).values({
            managerId: manager.id,
            branchId: ci.branchId,
            latitudeIn: ci.latitude,
            longitudeIn: ci.longitude,
            accuracyIn: ci.accuracy,
            checkInAt: new Date(ci.checkInAt),
            status: "checked_in",
            isMocked: ciFinalMocked ? "yes" : "no",
            suspicionScore: ciScore,
            mockReasons: ciReasons.length > 0 ? JSON.stringify(ciReasons) : null,
            distanceToPrevBranchKm: undefined,
          }).$returningId();

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

          // ── احسب المدة واتحقق من الـ 15 دقيقة ───────────────────────────
          const checkInTime  = new Date(co.checkInAt);
          const checkOutTime = new Date(co.checkOutAt);
          const durationMin  = (checkOutTime.getTime() - checkInTime.getTime()) / 60_000;
          const isQualified  = durationMin >= MIN_VISIT_DURATION_MINUTES;

          let distanceToPrevBranchKm: number | undefined;
          let isTeleporting = false;

          if (isQualified) {
            const visitRow = await db.select({ branchName: branches.name })
              .from(visits)
              .innerJoin(branches, eq(visits.branchId, branches.id))
              .where(eq(visits.id, visitId))
              .limit(1);

            if (visitRow[0]) {
              const km = await calcDistanceFromPrevBranch(
                db, manager.id, visitRow[0].branchName, checkInTime
              );
              if (km !== null) {
                distanceToPrevBranchKm = km;
                
                const prevVisit = await db.select({ checkOutAt: visits.checkOutAt })
                  .from(visits)
                  .where(and(
                    eq(visits.managerId, manager.id),
                    eq(visits.status, "checked_out"),
                    lt(visits.checkInAt, checkInTime)
                  ))
                  .orderBy(desc(visits.checkInAt))
                  .limit(1);

                if (prevVisit[0]?.checkOutAt) {
                  const timeDiffMs = checkInTime.getTime() - prevVisit[0].checkOutAt.getTime();
                  const timeDiffHours = timeDiffMs / 3600000;
                  
                  // ── حماية من الانتقال اللحظي (نفس الدقيقة أو أقل) ─────────────
                  // لو المسافة موجودة والسرعة خيالية (> 150 كم/س)
                  if (timeDiffHours > 0 && (km / timeDiffHours) > 150) {
                    isTeleporting = true;
                  } 
                  // لو المسافة موجودة والزمن صفر أو سالب (انتقال آني)
                  else if (km > 0.1 && timeDiffMs <= 0) {
                    isTeleporting = true;
                  }
                }
              }
            }
          }

          await db.update(visits)
            .set({
              checkOutAt: checkOutTime,
              status: "checked_out",
              isMocked: isTeleporting ? "yes" : undefined,
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

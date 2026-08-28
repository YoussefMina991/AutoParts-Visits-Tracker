import { z } from "zod";
import { eq, and, gte, lte, desc, count, lt } from "drizzle-orm";
import { router, protectedProcedure, adminProcedure } from "./_core/trpc";
import { getDb } from "./db";
import { visits, managers, branches, users, locationLogs } from "../drizzle/schema";
import { storagePut } from "./storage";
import { getDistanceMeters } from "../shared/utils";
import { getBranchDistance } from "../shared/gizaBranchDistances";
import { notifyOwner } from "./_core/notification";

// ── In-Memory Lock لمنع الدخول المتزامن (Race Condition) ─────────────────────
const activeCheckInLocks = new Set<number>();

// ── Schemas مشتركة ────────────────────────────────────────────────────────────
const coordSchema = z.string().regex(/^-?\d{1,3}(\.\d+)?$/, "invalid coordinate");

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;
type ManagerRow = typeof managers.$inferSelect;
type BranchRow = typeof branches.$inferSelect;

interface VisitForCheckout {
  id: number;
  checkInAt: Date;
  notes?: string | null;
  branchName: string | null; // جاي إنه null للمأموريات الخارجية (leftJoin)
  branchLatitude?: string | null;
  branchLongitude?: string | null;
}

// ── دالة مساعدة: احسب المسافة من الفرع السابق (أي زيارة مكتملة في نفس اليوم) ─
// ✅ استراتيجية مزدوجة:
//    ① مصفوفة المسافات المعتمدة من الشيت (أدق — مسافات طرق فعلية)
//    ② Fallback Haversine بين إحداثيات الفرعين (خط مستقيم — تقريب كافٍ
//       لكشف الغش) مع تاج DIST_HAVERSINE_ESTIMATE عشان الأدمن يعرف المصدر
async function calcDistanceFromPrevBranch(
  db: Db,
  managerId: number,
  currentBranchName: string,
  currentLat: number | undefined,
  currentLng: number | undefined,
  referenceTime: Date,
): Promise<{ km: number; prevBranchName: string; timeDiffMin: number; estimated: boolean } | null> {
  const dayStart = new Date(referenceTime);
  dayStart.setHours(0, 0, 0, 0);

  // جيب آخر زيارة مكتملة في نفس اليوم (أي مدة — مش شرط 15 دقيقة)
  const prevVisits = await db.select({
    branchName: branches.name,
    latitude: branches.latitude,
    longitude: branches.longitude,
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

  // ① الأولوية للمصفوفة المعتمدة
  let km = getBranchDistance(prev.branchName, currentBranchName);
  let estimated = false;

  // ② Fallback: خط مستقيم بين الإحداثيات
  if (km === null && currentLat !== undefined && currentLng !== undefined
      && prev.latitude && prev.longitude) {
    const meters = getDistanceMeters(
      parseFloat(prev.latitude), parseFloat(prev.longitude),
      currentLat, currentLng
    );
    km = Math.round(meters / 100) / 10; // تقريب لأقرب 100 متر
    estimated = true;
  }

  if (km === null) {
    console.warn(`[Distances] No distance source for: "${prev.branchName}" → "${currentBranchName}"`);
    return null;
  }

  const timeDiffMin = (referenceTime.getTime() - (prev.checkOutAt as Date).getTime()) / 60_000;

  return { km, prevBranchName: prev.branchName, timeDiffMin, estimated };
}

// ── دالة مساعدة: هل الانتقال مستحيل؟ (Teleportation check) ─────────────────
function isTeleportation(km: number, timeDiffMin: number): boolean {
  if (timeDiffMin <= 0) return true; // مستحيل فيزيائياً
  const speedKmh = km / (timeDiffMin / 60);
  // أكثر من 80 كم/ساعة في وسط القاهرة والجيزة → مستحيل
  return speedKmh > 80;
}

// ── 🎯 الدالة الموحدة لإغلاق زيارة (كانت منسوخة 3 مرات — دلوقتي مرة واحدة) ──
// بتستخدمها: checkOut + nativeCheckOut + syncOfflineVisits
async function finalizeCheckOut(
  db: Db,
  managerId: number,
  visit: VisitForCheckout,
  checkOutTime: Date,
): Promise<{ durationMin: number; distanceKm: number | null; isTeleporting: boolean; distanceEstimated: boolean }> {
  const durationMin = (checkOutTime.getTime() - visit.checkInAt.getTime()) / 60_000;

  // المسافة والـ Teleportation بيتحسبوا دايماً بغض النظر عن المدة
  let distanceKm: number | undefined;
  let isTeleporting = false;
  let distanceEstimated = false;

  // ✅ لا نحسب مسافة للمأموريات الخارجية (branchName = null يعني مفيش فرع)
  if (visit.branchName) {
    const prevResult = await calcDistanceFromPrevBranch(
      db,
      managerId,
      visit.branchName,
      visit.branchLatitude ? parseFloat(visit.branchLatitude) : undefined,
      visit.branchLongitude ? parseFloat(visit.branchLongitude) : undefined,
      visit.checkInAt
    );
    if (prevResult !== null) {
      distanceKm = prevResult.km;
      distanceEstimated = prevResult.estimated;
      // إعادة فحص Teleportation كـ double-check (الأساسي بيحصل وقت checkIn)
      if (isTeleportation(prevResult.km, prevResult.timeDiffMin)) {
        isTeleporting = true;
      }
    }
  }

  // نجيب الـ suspicionScore الحالي من الداتابيز عشان نجمع عليه
  const currentVisitData = await db.select({
    suspicionScore: visits.suspicionScore,
    mockReasons: visits.mockReasons,
  }).from(visits).where(eq(visits.id, visit.id)).limit(1);

  const existingScore   = currentVisitData[0]?.suspicionScore ?? 0;
  const existingReasons: string[] = (() => {
    try { return JSON.parse(currentVisitData[0]?.mockReasons ?? "[]"); } catch { return []; }
  })();

  // ✅ بناء الأسباب الجديدة: تاج مصدر المسافة + الزيارة القصيرة
  const newReasons = [...existingReasons];
  if (distanceEstimated) newReasons.push("DIST_HAVERSINE_ESTIMATE");
  let shortVisitScore = 0;
  if (durationMin < 3) {
    shortVisitScore = 80;
    newReasons.push(`SHORT_VISIT:${Math.round(durationMin * 60)}sec`);
  } else if (durationMin < 7) {
    shortVisitScore = 40;
    newReasons.push(`SHORT_VISIT:${Math.round(durationMin)}min`);
  }

  const finalScore = existingScore + shortVisitScore; // teleport score اتحسب وقت checkIn
  // ✅ مقارنة بالمحتوى مش بالطول — عشان أي تغيير في الأسباب يتسجل
  const reasonsChanged = JSON.stringify(newReasons) !== JSON.stringify(existingReasons);
  const isShortMocked = shortVisitScore >= 80; // أقل من 3 دقايق → وهمي مباشرة

  // لا نكتب "no" أبداً — فقط "yes" إذا اكتشفنا teleporting أو زيارة قصيرة جداً
  const mockedUpdate = (isTeleporting || isShortMocked)
    ? { isMocked: "yes" as const }
    : {};

  await db.update(visits).set({
    checkOutAt: checkOutTime,
    status: "checked_out",
    ...mockedUpdate,
    ...(distanceKm !== undefined ? { distanceToPrevBranchKm: distanceKm.toString() } : {}),
    ...(reasonsChanged ? {
      suspicionScore: finalScore,
      mockReasons: JSON.stringify(newReasons),
    } : {}),
  }).where(and(
    eq(visits.id, visit.id),
    eq(visits.managerId, managerId),
    eq(visits.status, "checked_in"), // ✅ حارس: ميتكتبش على زيارة متقفلة خلاص (idempotency)
  ));

  return {
    durationMin,
    distanceKm: distanceKm ?? null,
    isTeleporting,
    distanceEstimated,
  };
}

async function getManagerName(db: Db, userId: number): Promise<string> {
  const rows = await db.select({ name: users.name }).from(users).where(eq(users.id, userId)).limit(1);
  return rows[0]?.name ?? "مدير غير معروف";
}

export const visitRouter = router({
  // POST — manager checks in to a branch or external mission
  checkIn: protectedProcedure
    .input(z.object({
      branchId: z.number().int().positive().optional(),
      visitType: z.enum(["branch", "external_mission"]).default("branch"),
      noteType: z.enum(["general", "short_visit", "non_primary", "external_mission"]).default("general"),
      latitude: coordSchema,
      longitude: coordSchema,
      accuracy: z.string().max(32).optional(),
      photoBase64: z.string().max(6_000_000).optional(),
      notes: z.string().max(1000).optional(),
      isMocked: z.boolean().optional(),
      suspicionScore: z.number().int().min(0).max(10_000).optional(),
      mockReasons: z.array(z.string().max(200)).max(20).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const managerResult = await db.select().from(managers).where(eq(managers.userId, ctx.user!.id)).limit(1);
      if (!managerResult[0]) throw new Error("Manager profile not found");
      const manager = managerResult[0];

      if (activeCheckInLocks.has(manager.id)) {
        throw new Error("Already processing a check-in request, please wait.");
      }
      activeCheckInLocks.add(manager.id);

      try {
        const existingVisits = await db.select({ id: visits.id }).from(visits)
          .where(and(eq(visits.managerId, manager.id), eq(visits.status, "checked_in"))).limit(1);
        if (existingVisits.length > 0) throw new Error("Already checked into a branch. Please check out first.");

      let branch: BranchRow | undefined;
      
      if (input.visitType === "branch" || input.branchId) {
        if (!input.branchId) throw new Error("Branch ID is required for a branch visit.");
        const branchResult = await db.select().from(branches).where(eq(branches.id, input.branchId)).limit(1);
        if (!branchResult[0]) throw new Error("Branch not found");
        const currentBranch = branchResult[0];
        branch = currentBranch;

        const dist = getDistanceMeters(
          parseFloat(input.latitude), parseFloat(input.longitude),
          parseFloat(currentBranch.latitude), parseFloat(currentBranch.longitude)
        );
        if (dist > (currentBranch.geofenceRadiusMeters || 200) + 50) throw new Error("You are too far from the branch to check in.");
      }

      let photoUrl: string | undefined;
      if (input.photoBase64) {
        const buffer = Buffer.from(input.photoBase64.replace(/^data:image\/\w+;base64,/, ""), "base64");
        const stored = await storagePut(`visits/${manager.id}_${Date.now()}.jpg`, buffer, "image/jpeg");
        photoUrl = stored.url;
      }

      // ── 🚨 فحص Teleportation وقت الـ CheckIn (الأهم) ────────────────────────
      let isTeleporting = false;
      const teleportReasons: string[] = [];

      if (branch) {
        const prevResult = await calcDistanceFromPrevBranch(
          db, manager.id, branch.name,
          parseFloat(branch.latitude), parseFloat(branch.longitude),
          new Date()
        );
        if (prevResult !== null) {
          const { km, prevBranchName, timeDiffMin } = prevResult;
          if (isTeleportation(km, timeDiffMin)) {
            isTeleporting = true;
            const speedKmh = Math.round(km / (timeDiffMin / 60));
            teleportReasons.push(
              `TELEPORTATION:${prevBranchName}→${branch.name}:${km.toFixed(1)}km:${Math.round(timeDiffMin)}min:${speedKmh}kmh`
            );
          }
        }
      }

      const finalIsMocked = input.isMocked || isTeleporting;

      const combinedReasons = [...(input.mockReasons || []), ...teleportReasons];
      const finalReasons  = combinedReasons.length > 0 ? JSON.stringify(combinedReasons) : null;
      const finalScore = (input.suspicionScore || 0) + (isTeleporting ? 100 : 0);

      await db.insert(visits).values({
        managerId: manager.id, branchId: input.branchId,
        visitType: input.visitType, noteType: input.noteType,

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
        const managerName = await getManagerName(db, ctx.user!.id);
        const locationName = branch ? branch.name : "مأمورية خارجية";
        notifyOwner({
          title: "🚨 زيارة وهمية مكتشفة",
          content: `المدير: ${managerName}\nالمكان: ${locationName}\nالوقت: ${new Date().toLocaleString("ar-EG")}\n${isTeleporting ? "تم اكتشاف انتقال غير منطقي (Teleportation)" : "تحديد موقع وهمي"}`,
        }).catch(() => {}); // لا نوقف الـ check-in لو فشل الإشعار
      }

      return { success: true };
      } finally {
        activeCheckInLocks.delete(manager.id);
      }
    }),

  // POST — Android native background service checkout (accepts branchId, looks up the active visitId itself)
  // Used by NativeGeofenceEngine.java which only knows the branchId, not the visitId
  nativeCheckOut: protectedProcedure
    .input(z.object({ branchId: z.number().int().positive() }))
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
        branchLatitude: branches.latitude,
        branchLongitude: branches.longitude,
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

      const result = await finalizeCheckOut(db, manager.id, activeVisit[0], new Date());

      return {
        success: true,
        skipped: false,
        durationMin: Math.round(result.durationMin),
        distanceRecorded: result.distanceKm,
      };
    }),

  // POST — manager checks out
  checkOut: protectedProcedure
    .input(z.object({ 
      visitId: z.number().int().positive(),
      notes: z.string().max(1000).optional(),
      noteType: z.enum(["general", "short_visit", "non_primary", "external_mission"]).optional()
    }))
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
        notes:     visits.notes,
        branchName: branches.name,
        branchLatitude: branches.latitude,
        branchLongitude: branches.longitude,
      }).from(visits)
        .leftJoin(branches, eq(visits.branchId, branches.id))
        .where(and(
          eq(visits.id, input.visitId),
          eq(visits.managerId, manager.id),
          eq(visits.status, "checked_in"),
        ))
        .limit(1);

      if (!visitResult[0]) throw new Error("Visit not found or already checked out.");

      const now = new Date();
      const visit = visitResult[0];
      const result = await finalizeCheckOut(db, manager.id, visit, now);

      if (input.notes || input.noteType) {
        const finalNotes = input.notes ? (visit.notes ? `${visit.notes}\n---\nخروج: ${input.notes}` : input.notes) : visit.notes;
        await db.update(visits).set({
          ...(input.noteType ? { noteType: input.noteType } : {}),
          ...(input.notes ? { notes: finalNotes } : {}),
        }).where(eq(visits.id, visit.id));
      }

      // 🚨 إشعار للأدمن — teleporting أو زيارة قصيرة جداً
      if (result.isTeleporting) {
        const managerName = await getManagerName(db, ctx.user!.id);
        notifyOwner({
          title: "🚨 انتقال وهمي مكتشف (Teleportation)",
          content: `المدير: ${managerName}\nالفرع: ${visit.branchName}\nالمسافة: ${result.distanceKm?.toFixed(1) ?? "?"} كم\nالوقت: ${now.toLocaleString("ar-EG")}`,
        }).catch(() => {});
      }

      const isShortMocked = result.durationMin < 3;
      if (isShortMocked) {
        const managerName = await getManagerName(db, ctx.user!.id);
        notifyOwner({
          title: "🚨 زيارة قصيرة مشبوهة",
          content: `المدير: ${managerName}\nالفرع: ${visit.branchName}\nمدة الزيارة: ${Math.round(result.durationMin * 60)} ثانية فقط\nالوقت: ${now.toLocaleString("ar-EG")}`,
        }).catch(() => {});
      }

      return {
        success: true,
        durationMin: Math.round(result.durationMin),
        distanceRecorded: result.distanceKm,
      };
    }),

  // GET — current manager's visit history
  myHistory: protectedProcedure
    .input(z.object({
      limit: z.number().int().min(1).max(500).default(50),
      offset: z.number().int().min(0).default(0),
    }))
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
        visitType: visits.visitType, noteType: visits.noteType,
        branchName: branches.name, branchId: branches.id, branchCode: branches.code, branchAddress: branches.address,
      }).from(visits).leftJoin(branches, eq(visits.branchId, branches.id))
        .where(whereClause).orderBy(desc(visits.checkInAt)).limit(input.limit).offset(input.offset);
      return { items, total };
    }),

  // GET — admin: all visits with filters
  adminList: adminProcedure
    .input(z.object({
      managerId: z.number().int().positive().optional(),
      branchId: z.number().int().positive().optional(),
      startDate: z.string().max(32).optional(),
      endDate: z.string().max(32).optional(),
      limit: z.number().int().min(1).max(1000).default(100),
      offset: z.number().int().min(0).default(0),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const conditions: any[] = [];
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
        visitType: visits.visitType, noteType: visits.noteType,
        branchName: branches.name, branchId: branches.id, branchCode: branches.code,
        managerName: users.name, managerEmail: users.email,
        managerPhotoUrl: managers.photoUrl,
      }).from(visits).leftJoin(branches, eq(visits.branchId, branches.id))
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
    .input(z.object({ limit: z.number().int().min(1).max(50).default(5) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const items = await db.select({
        id: visits.id,
        checkInAt: visits.checkInAt,
        checkOutAt: visits.checkOutAt,
        status: visits.status,
        isMocked: visits.isMocked,
        visitType: visits.visitType,
        branchName: branches.name,
        managerName: users.name,
        managerId: managers.id,
      }).from(visits)
        .leftJoin(branches, eq(visits.branchId, branches.id))
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
      visitType: visits.visitType,
      checkInAt: visits.checkInAt,
    }).from(visits)
      .leftJoin(branches, eq(visits.branchId, branches.id))
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
          branchId: z.number().int().positive(),
          branchName: z.string().max(255),
          latitude: coordSchema,
          longitude: coordSchema,
          accuracy: z.string().max(32).optional(),
          checkInAt: z.string().datetime({ offset: true }),
          localId: z.string().max(128),
          isMocked: z.boolean().optional(),
        }),
        z.object({
          type: z.literal("check_out"),
          localCheckInId: z.string().max(128),
          serverVisitId: z.number().int().positive().optional(),
          branchName: z.string().max(255),
          checkOutAt: z.string().datetime({ offset: true }),
          checkInAt: z.string().datetime({ offset: true }),
        }),
      ])).max(50),
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
          const ciReasons: string[] = [];

          let isTeleporting = false;
          const checkInTime = new Date(ci.checkInAt);
          const prevResult = await calcDistanceFromPrevBranch(
            db, manager.id, ci.branchName,
            parseFloat(branch.latitude), parseFloat(branch.longitude),
            checkInTime
          );
          if (prevResult !== null && isTeleportation(prevResult.km, prevResult.timeDiffMin)) {
            isTeleporting = true;
            const speedKmh = Math.round(prevResult.km / (prevResult.timeDiffMin / 60));
            ciReasons.push(`TELEPORTATION:${prevResult.prevBranchName}→${ci.branchName}:${prevResult.km.toFixed(1)}km:${Math.round(prevResult.timeDiffMin)}min:${speedKmh}kmh`);
          }

          const ciFinalMocked = ci.isMocked || isTeleporting;

          const [inserted] = await db.insert(visits).values({
            managerId: manager.id,
            branchId: ci.branchId,
            latitudeIn: ci.latitude,
            longitudeIn: ci.longitude,
            accuracyIn: ci.accuracy,
            checkInAt: checkInTime,
            status: "checked_in",
            isMocked: ciFinalMocked ? "yes" : "no",
            suspicionScore: ciFinalMocked ? 100 : 0,
            mockReasons: ciReasons.length > 0 ? JSON.stringify(ciReasons) : null,
            distanceToPrevBranchKm: undefined,
          }).$returningId();

          // 🚨 لو الزيارة المتزامنة وهمية — ابعت إشعار للأدمن
          if (ciFinalMocked) {
            notifyOwner({
              title: "🚨 زيارة وهمية مكتشفة (أوفلاين)",
              content: `المدير: ${await getManagerName(db, ctx.user!.id)}\nالفرع: ${branch.name}\nوقت الدخول: ${checkInTime.toLocaleString("ar-EG")}\n${isTeleporting ? "تم اكتشاف انتقال غير منطقي (Teleportation)" : "تحديد موقع وهمي"}`,
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

          const visitRow = await db.select({
            id: visits.id,
            checkInAt: visits.checkInAt,
            branchName: branches.name,
            branchLatitude: branches.latitude,
            branchLongitude: branches.longitude,
          })
            .from(visits)
            .leftJoin(branches, eq(visits.branchId, branches.id))
            .where(and(eq(visits.id, visitId), eq(visits.managerId, manager.id)))
            .limit(1);

          if (!visitRow[0]) continue;

          await finalizeCheckOut(db, manager.id, visitRow[0], new Date(co.checkOutAt));
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
        latitude: coordSchema,
        longitude: coordSchema,
        accuracy: z.string().max(32).optional(),
        timestamp: z.string().datetime({ offset: true }),
      })).max(2000),
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

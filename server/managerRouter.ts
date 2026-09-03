import { z } from "zod";
import { eq, and, desc, gte, lt, inArray, or, sql, ne } from "drizzle-orm";
import { router, protectedProcedure, adminProcedure } from "./_core/trpc";
import { getDb } from "./db";
import { managers, managerBranches, branches, users, locationLogs, visits } from "../drizzle/schema";
import fs from "fs";
import path from "path";

export const managerRouter = router({
  // GET — all managers with their user info (admin)
  list: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    const result = await db
      .select({
        id: managers.id,
        userId: managers.userId,
        employeeCode: managers.employeeCode,
        phone: managers.phone,
        photoUrl: managers.photoUrl,
        isActive: managers.isActive,
        createdAt: managers.createdAt,
        userName: users.name,
        userEmail: users.email,
      })
      .from(managers)
      .leftJoin(users, eq(managers.userId, users.id))
      .where(ne(users.role, "superadmin"))
      .orderBy(users.name);
    return result;
  }),

  // GET — current logged-in manager's profile (for manager role)
  getCurrentManager: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    const result = await db
      .select()
      .from(managers)
      .where(eq(managers.userId, ctx.user!.id))
      .limit(1);
    return result[0] ?? null;
  }),

  // GET — branches assigned to the current manager
  getMyBranches: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    const managerResult = await db
      .select()
      .from(managers)
      .where(eq(managers.userId, ctx.user!.id))
      .limit(1);

    if (!managerResult[0]) return [];

    const result = await db
      .select({
        id: branches.id,
        name: branches.name,
        code: branches.code,
        address: branches.address,
        latitude: branches.latitude,
        longitude: branches.longitude,
        geofenceRadiusMeters: branches.geofenceRadiusMeters,
        isPrimary: managerBranches.isPrimary,
      })
      .from(managerBranches)
      .innerJoin(branches, eq(managerBranches.branchId, branches.id))
      .where(
        and(
          eq(managerBranches.managerId, managerResult[0].id),
          eq(branches.isActive, "yes")
        )
      );
    return result;
  }),

  // POST — admin creates a manager profile for an existing user
  create: adminProcedure
    .input(
      z.object({
        userId: z.number(),
        employeeCode: z.string().optional(),
        phone: z.string().optional(),
        photoUrl: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db.insert(managers).values(input);
      return { success: true };
    }),

  // POST — رفع صورة المدير (base64) وحفظها لوكال
  uploadPhoto: adminProcedure
    .input(z.object({
      managerId: z.number(),
      base64: z.string().max(6_000_000),  // ✅ سقف واضح (~4.5MB صورة فعلية)
      extension: z.enum(["jpg", "jpeg", "png", "webp"]).default("jpg"), // ✅ allowlist بدل أي امتداد
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // استخرج الـ base64 data بدون الـ prefix
      const base64Data = input.base64.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");
      if (buffer.length === 0) throw new Error("صورة غير صالحة");

      // حفظ الملف في /uploads/managers/
      const uploadsDir = path.join(process.cwd(), "uploads", "managers");
      if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

      const filename = `manager_${input.managerId}_${Date.now()}.${input.extension}`;
      const filepath = path.join(uploadsDir, filename);
      fs.writeFileSync(filepath, buffer);

      const photoUrl = `/uploads/managers/${filename}`;

      // حفظ الـ URL في الداتابيز
      await db.update(managers).set({ photoUrl }).where(eq(managers.id, input.managerId));

      return { photoUrl };
    }),

  // GET — admin: get branches currently assigned to a specific manager
  getManagerBranches: adminProcedure
    .input(z.object({ managerId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      // ✅ innerJoin مع branches عشان ميرجعش فروع اتمسحت ولا غير موجودة
      const result = await db
        .select({ branchId: managerBranches.branchId, isPrimary: managerBranches.isPrimary })
        .from(managerBranches)
        .innerJoin(branches, eq(managerBranches.branchId, branches.id))
        .where(eq(managerBranches.managerId, input.managerId));
      return result; // [{ branchId, isPrimary }]
    }),

  // POST — admin assigns branches to a manager
  assignBranches: adminProcedure
    .input(
      z.object({
        managerId: z.number(),
        branches: z.array(z.object({
          branchId: z.number(),
          isPrimary: z.enum(["yes", "no"]).default("no"),
        })),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // ✅ تحقق إن كل branchId موجود فعلاً في جدول branches قبل الإدخال
      if (input.branches.length > 0) {
        const branchIds = input.branches.map((b) => b.branchId);
        const validBranches = await db
          .select({ id: branches.id })
          .from(branches)
          .where(inArray(branches.id, branchIds));
        const validIdSet = new Set(validBranches.map((b) => b.id));
        const invalidIds = branchIds.filter((id) => !validIdSet.has(id));
        if (invalidIds.length > 0) {
          throw new Error(`الفروع التالية غير موجودة أو تم حذفها: ${invalidIds.join(", ")}`);
        }
      }

      // Remove old assignments and add new ones
      await db
        .delete(managerBranches)
        .where(eq(managerBranches.managerId, input.managerId));

      if (input.branches.length > 0) {
        await db.insert(managerBranches).values(
          input.branches.map(({ branchId, isPrimary }) => ({
            managerId: input.managerId,
            branchId,
            isPrimary,
          }))
        );
      }
      return { success: true };
    }),

  // DELETE — admin deletes a manager completely
  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      // Fetch manager to get userId before deleting
      const managerResult = await db.select().from(managers).where(eq(managers.id, input.id)).limit(1);
      const manager = managerResult[0];
      
      if (!manager) {
        throw new Error("Manager not found");
      }

      // Delete associated records first (branches, location logs, and visits/attendance)
      await db.delete(managerBranches).where(eq(managerBranches.managerId, input.id));
      await db.delete(locationLogs).where(eq(locationLogs.managerId, input.id));
      await db.delete(visits).where(eq(visits.managerId, input.id));
      
      // Delete the manager profile
      await db.delete(managers).where(eq(managers.id, input.id));
      
      // Delete the underlying user account to completely erase them from the system
      await db.delete(users).where(eq(users.id, manager.userId));
      
      return { success: true };
    }),

  // GET - admin live locations of all active managers
  // ✅ محسّن: استعلامين ثابتين بدل استعلام لكل مدير (كان N+1)
  getLiveLocations: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const activeManagers = await db
      .select({
        id: managers.id,
        userName: users.name,
        phone: managers.phone,
        photoUrl: managers.photoUrl,
      })
      .from(managers)
      .innerJoin(users, eq(managers.userId, users.id))
      .where(eq(managers.isActive, "yes"));

    if (activeManagers.length === 0) return [];

    const managerIds = activeManagers.map((m) => m.id);

    // ① آخر timestamp لكل مدير
    const latestPerManager = await db
      .select({
        managerId: locationLogs.managerId,
        maxTimestamp: sql<string>`MAX(${locationLogs.timestamp})`,
      })
      .from(locationLogs)
      .where(inArray(locationLogs.managerId, managerIds))
      .groupBy(locationLogs.managerId);

    if (latestPerManager.length === 0) {
      return activeManagers.map((m) => ({ ...m, location: null }));
    }

    // ② جيب نقاط الـ GPS نفسها بشرط (managerId + timestamp) المطابقين
    const pointConditions = latestPerManager.map((r) =>
      and(eq(locationLogs.managerId, r.managerId), eq(locationLogs.timestamp, new Date(r.maxTimestamp)))
    );
    const points = await db
      .select({
        managerId: locationLogs.managerId,
        latitude: locationLogs.latitude,
        longitude: locationLogs.longitude,
        timestamp: locationLogs.timestamp,
      })
      .from(locationLogs)
      .where(pointConditions.length === 1 ? pointConditions[0] : or(...pointConditions));

    const locationByManager = new Map(points.map((p) => [p.managerId, p]));

    // ???? checkinMode ?????? (managers.id -> users.checkinMode)
    const modeRows = await db
      .select({ managerId: managers.id, checkinMode: users.checkinMode })
      .from(managers)
      .innerJoin(users, eq(managers.userId, users.id))
      .where(inArray(managers.id, managerIds));
    const modeByManagerId = new Map(modeRows.map((r) => [r.managerId, r.checkinMode]));

    // ??????? ????: ?????? ?????? manual ?? ??????? locationLogs ???? ??? ????
    // ?? ???? ?????? ???? ??? ???? ??? ???? ??? ??? ??? ?????? ???? ???? ??
    const lastVisits = await db
      .select({
        managerId: visits.managerId,
        latitude: visits.latitudeIn,
        longitude: visits.longitudeIn,
        timestamp: visits.checkInAt,
      })
      .from(visits)
      .where(inArray(visits.managerId, managerIds))
      .orderBy(desc(visits.checkInAt))
      .limit(500);
    const lastVisitByManager = new Map();
    for (const v of lastVisits) {
      if (!lastVisitByManager.has(v.managerId)) {
        lastVisitByManager.set(v.managerId, { ...v, isManualFallback: true });
      }
    }

    return activeManagers.map((m) => {
      const live = locationByManager.get(m.id) ?? null;
      if (live) {
        return { ...m, checkinMode: modeByManagerId.get(m.id) ?? "automatic", location: live };
      }
      // ??? locationLogs (?????? manual): ??? ?? ???? ??? ????
      const fallback = lastVisitByManager.get(m.id) ?? null;
      return { ...m, checkinMode: modeByManagerId.get(m.id) ?? "automatic", location: fallback };
    });
  }),

  // GET - admin route history for a specific manager on a specific date
  getRouteHistory: adminProcedure
    .input(z.object({ managerId: z.number(), date: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // date string is assumed to be YYYY-MM-DD local time
      // we need to get logs between start of that day and start of next day
      const targetDate = new Date(input.date);
      if (isNaN(targetDate.getTime())) {
        throw new Error("Invalid date format");
      }
      
      const startOfDay = new Date(targetDate);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(startOfDay);
      endOfDay.setDate(endOfDay.getDate() + 1);

      const logs = await db
        .select({
          id: locationLogs.id,
          latitude: locationLogs.latitude,
          longitude: locationLogs.longitude,
          accuracy: locationLogs.accuracy,
          timestamp: locationLogs.timestamp,
        })
        .from(locationLogs)
        .where(
          and(
            eq(locationLogs.managerId, input.managerId),
            gte(locationLogs.timestamp, startOfDay),
            lt(locationLogs.timestamp, endOfDay)
          )
        )
        .orderBy(locationLogs.timestamp);
      
      return logs;
    }),
});

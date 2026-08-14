import { z } from "zod";
import { eq, and, desc, gte, lt } from "drizzle-orm";
import { router, protectedProcedure, adminProcedure } from "./_core/trpc";
import { getDb } from "./db";
import { managers, managerBranches, branches, users, locationLogs, visits } from "../drizzle/schema";

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
        isActive: managers.isActive,
        createdAt: managers.createdAt,
        userName: users.name,
        userEmail: users.email,
      })
      .from(managers)
      .leftJoin(users, eq(managers.userId, users.id))
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
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db.insert(managers).values(input);
      return { success: true };
    }),

  // GET — admin: get branches currently assigned to a specific manager
  getManagerBranches: adminProcedure
    .input(z.object({ managerId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const result = await db
        .select({ id: branches.id })
        .from(managerBranches)
        .innerJoin(branches, eq(managerBranches.branchId, branches.id))
        .where(eq(managerBranches.managerId, input.managerId));
      return result.map(r => r.id);
    }),

  // POST — admin assigns branches to a manager
  assignBranches: adminProcedure
    .input(
      z.object({
        managerId: z.number(),
        branchIds: z.array(z.number()),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Remove old assignments and add new ones
      await db
        .delete(managerBranches)
        .where(eq(managerBranches.managerId, input.managerId));

      if (input.branchIds.length > 0) {
        await db.insert(managerBranches).values(
          input.branchIds.map((branchId) => ({
            managerId: input.managerId,
            branchId,
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
  getLiveLocations: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const activeManagers = await db
      .select({
        id: managers.id,
        userName: users.name,
        phone: managers.phone,
      })
      .from(managers)
      .innerJoin(users, eq(managers.userId, users.id))
      .where(eq(managers.isActive, "yes"));

    const managerLocations = await Promise.all(
      activeManagers.map(async (m) => {
        const logs = await db
          .select({
            latitude: locationLogs.latitude,
            longitude: locationLogs.longitude,
            timestamp: locationLogs.timestamp,
          })
          .from(locationLogs)
          .where(eq(locationLogs.managerId, m.id))
          .orderBy(desc(locationLogs.timestamp))
          .limit(1)
          .execute();
          
        return {
          ...m,
          location: logs[0] ?? null,
        };
      })
    );

    return managerLocations; // return ALL managers, location may be null if never tracked
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

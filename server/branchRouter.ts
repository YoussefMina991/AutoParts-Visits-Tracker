import { z } from "zod";
import { eq } from "drizzle-orm";
import { router, protectedProcedure, adminProcedure } from "./_core/trpc";
import { getDb } from "./db";
import { branches, InsertBranch } from "../drizzle/schema";

export const branchRouter = router({
  // GET /trpc/branch.list — all branches (admin only)
  list: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    return db.select().from(branches).orderBy(branches.name);
  }),

  // GET /trpc/branch.get — single branch by id
  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const result = await db
        .select()
        .from(branches)
        .where(eq(branches.id, input.id))
        .limit(1);
      return result[0] ?? null;
    }),

  // POST /trpc/branch.create — admin creates a branch
  create: adminProcedure
    .input(
      z.object({
        name: z.string().min(1),
        code: z.string().min(1),
        address: z.string().optional(),
        latitude: z.string(),
        longitude: z.string(),
        geofenceRadiusMeters: z.number().default(200),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db.insert(branches).values(input as InsertBranch);
      return { success: true };
    }),

  // PUT /trpc/branch.update — admin updates a branch
  update: adminProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(1).optional(),
        code: z.string().min(1).optional(),
        address: z.string().optional(),
        latitude: z.string().optional(),
        longitude: z.string().optional(),
        geofenceRadiusMeters: z.number().optional(),
        isActive: z.enum(["yes", "no"]).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const { id, ...data } = input;
      await db.update(branches).set(data).where(eq(branches.id, id));
      return { success: true };
    }),

  // DELETE /trpc/branch.delete — admin soft-deletes (sets isActive=no)
  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db
        .update(branches)
        .set({ isActive: "no" })
        .where(eq(branches.id, input.id));
      return { success: true };
    }),
});

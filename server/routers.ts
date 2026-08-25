import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, adminProcedure } from "./_core/trpc";
import { branchRouter } from "./branchRouter";
import { managerRouter } from "./managerRouter";
import { visitRouter } from "./visitRouter";
import * as db from "./db";
import { hashPassword } from "./auth";
import { TRPCError } from "@trpc/server";

// ── 🔒 إخفاء البيانات الحساسة قبل إرسال المستخدم للعميل ──────────────────────
// (كان الـ passwordHash بيتبعت للموبايل مع كل طلب — ثغرة أمنية)
function sanitizeUser<T extends { passwordHash?: string; boundDeviceId?: string | null }>(
  user: T | null
) {
  if (!user) return null;
  const { passwordHash: _ph, boundDeviceId: _bd, ...safe } = user;
  return safe;
}

export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query(opts => sanitizeUser(opts.ctx.user)),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  users: router({
    // قائمة كل المستخدمين
    list: adminProcedure.query(async () => {
      const users = await db.listUsers();
      // نبعت للأدمن حالة الربط فقط بدون البصمة نفسها
      return users.map((u) => ({
        ...u,
        isDeviceBound: Boolean(u.boundDeviceId),
        boundDeviceId: undefined,
      }));
    }),

    // إنشاء مستخدم جديد
    create: adminProcedure
      .input(z.object({
        username: z.string().min(3).max(64),
        password: z.string().min(6),
        name: z.string().optional(),
        email: z.string().email().optional(),
        role: z.enum(["user", "admin"]).default("user"),
      }))
      .mutation(async ({ input }) => {
        const existing = await db.getUserByUsername(input.username);
        if (existing) throw new TRPCError({ code: "CONFLICT", message: "اسم المستخدم موجود بالفعل" });
        const passwordHash = await hashPassword(input.password);
        await db.createUser({
          username: input.username,
          passwordHash,
          name: input.name ?? null,
          email: input.email ?? null,
          role: input.role,
          lastSignedIn: new Date(),
        });
        return { success: true };
      }),

    // تعديل مستخدم موجود
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        username: z.string().min(3).max(64).optional(),
        password: z.string().min(6).optional(),
        name: z.string().optional(),
        email: z.string().email().optional().or(z.literal("")),
        role: z.enum(["user", "admin"]).optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, password, ...rest } = input;

        // تأكد إن المستخدم موجود
        const existing = await db.getUserById(id);
        if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "المستخدم غير موجود" });

        // لو غيّر الـ username تأكد مش موجود عند حد تاني
        if (rest.username && rest.username !== existing.username) {
          const taken = await db.getUserByUsername(rest.username);
          if (taken) throw new TRPCError({ code: "CONFLICT", message: "اسم المستخدم موجود بالفعل" });
        }

        const updateData: Record<string, any> = { ...rest };
        if (rest.email === "") updateData.email = null;
        if (password) updateData.passwordHash = await hashPassword(password);

        await db.updateUser(id, updateData);
        return { success: true };
      }),

    // حذف مستخدم
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        // منع الأدمن من حذف نفسه
        if (ctx.user?.id === input.id)
          throw new TRPCError({ code: "FORBIDDEN", message: "لا يمكنك حذف حسابك الخاص" });

        const existing = await db.getUserById(input.id);
        if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "المستخدم غير موجود" });

        await db.deleteUser(input.id);
        return { success: true };
      }),

    // 🔓 فك ربط جهاز مستخدم — يسمح له بتسجيل الدخول من موبايل جديد
    // (الجهاز الجديد هيتربط تلقائياً بأول تسجيل دخول بعدها)
    unbindDevice: adminProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input, ctx }) => {
        const existing = await db.getUserById(input.id);
        if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "المستخدم غير موجود" });
        if (!existing.boundDeviceId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "الحساب مش مربوط بجهاز أصلاً" });
        }
        await db.updateUser(input.id, { boundDeviceId: null, deviceBoundAt: null });
        console.log(`[Auth] Admin ${ctx.user?.username} unbound device for user ${existing.username}`);
        return { success: true };
      }),
  }),

  branch: branchRouter,
  manager: managerRouter,
  visit: visitRouter,
});

export type AppRouter = typeof appRouter;

// ملاحظة: أضف الدوال دي في server/db.ts

/*
export async function updateUser(id: number, data: Partial<InsertUser>): Promise<void> {
  return withRetry(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    await db.update(users).set({ ...data, updatedAt: new Date() }).where(eq(users.id, id));
  });
}

export async function deleteUser(id: number): Promise<void> {
  return withRetry(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    await db.delete(users).where(eq(users.id, id));
  });
}
*/

import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";
import { verifyPassword, hashPassword } from "../auth";

export function registerOAuthRoutes(app: Express) {
  // POST /api/auth/login — username + password login
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    const { username, password, platform, deviceId } = req.body ?? {};

    if (!username || !password || typeof username !== "string" || typeof password !== "string") {
      res.status(400).json({ error: "username and password are required" });
      return;
    }

    // حد أقصى لطول المدخلات — حماية من إرسال بيانات ضخمة
    if (username.length > 64 || password.length > 256) {
      res.status(400).json({ error: "Invalid credentials format" });
      return;
    }

    try {
      const user = await db.getUserByUsername(username);

      if (!user) {
        // ✅ حماية من User Enumeration: نفعل نفس عملية الـ hashing عشان
        // وقت الاستجابة يبقى متطابق سواء المستخدم موجود أو لأ
        await hashPassword(password);
        res.status(401).json({ error: "Invalid credentials" });
        return;
      }

      // Platform role separation:
      // - الأدمن من الويب فقط / المدير (user) من الموبايل فقط
      const isAdmin = user.role === "admin";
      if (isAdmin && platform === "mobile") {
        res.status(403).json({ error: "غير مصرح للمدير العام الدخول من تطبيق الموبايل" });
        return;
      }

      if (!isAdmin && platform !== "mobile") {
        res.status(403).json({ error: "حساب المدير مخصص فقط لتطبيق الموبايل" });
        return;
      }

      // ── ✅ أولاً: تحقق من كلمة السر (قبل أي فحص يكشف معلومات الحساب) ──────
      const valid = await verifyPassword(password, user.passwordHash);
      if (!valid) {
        res.status(401).json({ error: "Invalid credentials" });
        return;
      }

      // ── 🔒 ثانياً: ربط الجهاز (Device Binding) ──────────────────────────────
      // حسابات المديرين مربوطة بأول موبايل يسجلوا منه — يمنع مشاركة الحسابات
      if (!isAdmin) {
        if (
          !deviceId ||
          typeof deviceId !== "string" ||
          deviceId.length < 8 ||
          deviceId.length > 128
        ) {
          res.status(403).json({ error: "تسجيل الدخول مسموح فقط من التطبيق الرسمي على الموبايل" });
          return;
        }

        if (!user.boundDeviceId) {
          // أول تسجيل دخول → اربط هذا الجهاز بالحساب تلقائياً
          await db.updateUser(user.id, { boundDeviceId: deviceId, deviceBoundAt: new Date() });
        } else if (user.boundDeviceId !== deviceId) {
          // جهاز مختلف عن المسجل → ارفض
          console.warn(
            `[Auth] Device mismatch for user ${user.username}: bound=${user.boundDeviceId.slice(0, 8)}… got=${deviceId.slice(0, 8)}…`
          );
          res.status(403).json({
            error: "هذا الحساب مربوط بجهاز موبايل آخر. لو غيرت جهازك، كلم الإدارة لفك الربط.",
          });
          return;
        }
      }

      const token = await sdk.signSession({
        userId: user.id,
        username: user.username,
        role: user.role,
      });

      // Update lastSignedIn
      await db.updateLastSignedIn(user.id);

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.json({ success: true, user: { id: user.id, name: user.name, role: user.role, username: user.username, email: user.email } });
    } catch (error) {
      console.error("[Auth] Login failed", error);
      res.status(500).json({ error: "Login failed" });
    }
  });
}

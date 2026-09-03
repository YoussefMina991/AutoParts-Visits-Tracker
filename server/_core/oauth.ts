import { COOKIE_NAME, SESSION_DURATION_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";
import { verifyPassword, hashPassword } from "../auth";

export function registerOAuthRoutes(app: Express) {
  // POST /api/auth/login - username + password login
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    const { username, password, platform, deviceId, webFingerprint } = req.body ?? {};

    if (!username || !password || typeof username !== "string" || typeof password !== "string") {
      res.status(400).json({ error: "username and password are required" });
      return;
    }

    // حد اقصى لطول المدخلات - حماية من ارسال بيانات ضخمة
    if (username.length > 64 || password.length > 256) {
      res.status(400).json({ error: "Invalid credentials format" });
      return;
    }

    try {
      const user = await db.getUserByUsername(username);

      if (!user) {
        // حماية من User Enumeration: نفعل نفس عملية الـ hashing عشان
        // وقت الاستجابة يبقى متطابق سواء المستخدم موجود او لا
        await hashPassword(password);
        res.status(401).json({ error: "Invalid credentials" });
        return;
      }

      // اولا: تحقق من كلمة السر (قبل اي فحص يكشف وجود الحساب او دوره)
      const valid = await verifyPassword(password, user.passwordHash);
      if (!valid) {
        res.status(401).json({ error: "Invalid credentials" });
        return;
      }

      // ثانيا: فصل المنصات
      const isAdmin = user.role === "admin";

      // الادمن: ويب فقط
      if (isAdmin && platform === "mobile") {
        res.status(403).json({ error: "غير مصرح للمدير العام الدخول من تطبيق الموبايل" });
        return;
      }

      // المدير: موبايل نيتف او ويب (مش حاجة تانية)
      if (!isAdmin && platform !== "mobile" && platform !== "web") {
        res.status(403).json({ error: "حساب المدير مخصص فقط لتطبيق الموبايل او المتصفح الرسمي" });
        return;
      }

      // ثالثا: Device/Browser Binding
      if (!isAdmin) {
        if (platform === "mobile") {
          // Native Android: Device ID Binding
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
            // اول تسجيل دخول - اربط هذا الجهاز بالحساب تلقائيا
            await db.updateUser(user.id, { boundDeviceId: deviceId, deviceBoundAt: new Date() });
          } else if (user.boundDeviceId !== deviceId) {
            // جهاز مختلف عن المسجل - ارفض
            console.warn(
              `[Auth] Device mismatch for user ${user.username}: bound=${user.boundDeviceId.slice(0, 8)}... got=${deviceId.slice(0, 8)}...`
            );
            res.status(403).json({
              error: "هذا الحساب مربوط بجهاز موبايل آخر. لو غيرت جهازك، كلم الادارة لفك الربط.",
            });
            return;
          }

        } else if (platform === "web") {
          // Web Browser (iPhone Safari/Chrome): Fingerprint Binding
          // بصمة المتصفح بدل Device ID - نفس الفكرة بالضبط
          if (
            !webFingerprint ||
            typeof webFingerprint !== "string" ||
            webFingerprint.length < 16 ||
            webFingerprint.length > 256
          ) {
            res.status(403).json({ error: "لم يتم التعرف على متصفحك - تاكد من استخدام المتصفح الرسمي" });
            return;
          }

          if (!user.boundWebFingerprint) {
            // اول تسجيل دخول من متصفح - اربط هذا المتصفح/الجهاز تلقائيا
            console.log(`[Auth] Web fingerprint bound for user ${user.username}: ${webFingerprint.slice(0, 12)}...`);
            await db.updateUser(user.id, {
              boundWebFingerprint: webFingerprint,
              webFingerprintAt: new Date(),
            });
          } else if (user.boundWebFingerprint !== webFingerprint) {
            // متصفح/جهاز مختلف - ارفض (منع مشاركة الحساب)
            console.warn(
              `[Auth] Web fingerprint mismatch for user ${user.username}: bound=${user.boundWebFingerprint.slice(0, 12)}... got=${webFingerprint.slice(0, 12)}...`
            );
            res.status(403).json({
              error: "هذا الحساب مربوط بمتصفح/جهاز آخر. لو بدّلت موبايلك، كلم الادارة لفك الربط.",
            });
            return;
          }
        }
      }

      // نجح التحقق - انشاء الجلسة
      const token = await sdk.signSession({
        userId: user.id,
        username: user.username,
        role: user.role,
      });

      // Update lastSignedIn
      await db.updateLastSignedIn(user.id);

      const cookieOptions = getSessionCookieOptions(req);

      // جلسات الويب اقصر (8 ساعات) من النيتف للامان
      const sessionDuration = platform === "web" ? 8 * 60 * 60 * 1000 : SESSION_DURATION_MS;

      res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: sessionDuration });
      res.json({ success: true, user: { id: user.id, name: user.name, role: user.role, username: user.username, email: user.email } });
    } catch (error) {
      console.error("[Auth] Login failed", error);
      res.status(500).json({ error: "Login failed" });
    }
  });
}

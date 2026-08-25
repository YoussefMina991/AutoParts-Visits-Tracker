import { COOKIE_NAME, SESSION_DURATION_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";
import { verifyPassword, hashPassword } from "../auth";

export function registerOAuthRoutes(app: Express) {
  // POST /api/auth/login â€” username + password login
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    const { username, password, platform, deviceId } = req.body ?? {};

    if (!username || !password || typeof username !== "string" || typeof password !== "string") {
      res.status(400).json({ error: "username and password are required" });
      return;
    }

    // ط­ط¯ ط£ظ‚طµظ‰ ظ„ط·ظˆظ„ ط§ظ„ظ…ط¯ط®ظ„ط§طھ â€” ط­ظ…ط§ظٹط© ظ…ظ† ط¥ط±ط³ط§ظ„ ط¨ظٹط§ظ†ط§طھ ط¶ط®ظ…ط©
    if (username.length > 64 || password.length > 256) {
      res.status(400).json({ error: "Invalid credentials format" });
      return;
    }

    try {
      const user = await db.getUserByUsername(username);

      if (!user) {
        // âœ… ط­ظ…ط§ظٹط© ظ…ظ† User Enumeration: ظ†ظپط¹ظ„ ظ†ظپط³ ط¹ظ…ظ„ظٹط© ط§ظ„ظ€ hashing ط¹ط´ط§ظ†
        // ظˆظ‚طھ ط§ظ„ط§ط³طھط¬ط§ط¨ط© ظٹط¨ظ‚ظ‰ ظ…طھط·ط§ط¨ظ‚ ط³ظˆط§ط، ط§ظ„ظ…ط³طھط®ط¯ظ… ظ…ظˆط¬ظˆط¯ ط£ظˆ ظ„ط£
        await hashPassword(password);
        res.status(401).json({ error: "Invalid credentials" });
        return;
      }

      // â”€â”€ âœ… ط£ظˆظ„ط§ظ‹: طھط­ظ‚ظ‚ ظ…ظ† ظƒظ„ظ…ط© ط§ظ„ط³ط± (ظ‚ط¨ظ„ ط£ظٹ ظپط­طµ ظٹظƒط´ظپ ظˆط¬ظˆط¯ ط§ظ„ط­ط³ط§ط¨ ط£ظˆ ط¯ظˆط±ظ‡) â”€â”€
      const valid = await verifyPassword(password, user.passwordHash);
      if (!valid) {
        res.status(401).json({ error: "Invalid credentials" });
        return;
      }

      // â”€â”€ ط«ط§ظ†ظٹط§ظ‹: ظپطµظ„ ط§ظ„ظ…ظ†طµط§طھ (ط§ظ„ط£ط¯ظ…ظ† ظˆظٹط¨ ظپظ‚ط· / ط§ظ„ظ…ط¯ظٹط± ظ…ظˆط¨ط§ظٹظ„ ظپظ‚ط·) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      // âœ… ط¨ط¹ط¯ ط§ظ„طھط­ظ‚ظ‚ ظ…ظ† ظƒظ„ظ…ط© ط§ظ„ط³ط± â€” ط¹ط´ط§ظ† ظ…ظٹط¨ظ‚ط§ط´ Oracle ظٹظƒط´ظپ ط£ط¯ظˆط§ط± ط§ظ„ط­ط³ط§ط¨ط§طھ
      const isAdmin = user.role === "admin";
      if (isAdmin && platform === "mobile") {
        res.status(403).json({ error: "ط؛ظٹط± ظ…طµط±ط­ ظ„ظ„ظ…ط¯ظٹط± ط§ظ„ط¹ط§ظ… ط§ظ„ط¯ط®ظˆظ„ ظ…ظ† طھط·ط¨ظٹظ‚ ط§ظ„ظ…ظˆط¨ط§ظٹظ„" });
        return;
      }

      if (!isAdmin && platform !== "mobile") {
        res.status(403).json({ error: "ط­ط³ط§ط¨ ط§ظ„ظ…ط¯ظٹط± ظ…ط®طµطµ ظپظ‚ط· ظ„طھط·ط¨ظٹظ‚ ط§ظ„ظ…ظˆط¨ط§ظٹظ„" });
        return;
      }

      // â”€â”€ ًں”’ ط«ط§ظ†ظٹط§ظ‹: ط±ط¨ط· ط§ظ„ط¬ظ‡ط§ط² (Device Binding) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      // ط­ط³ط§ط¨ط§طھ ط§ظ„ظ…ط¯ظٹط±ظٹظ† ظ…ط±ط¨ظˆط·ط© ط¨ط£ظˆظ„ ظ…ظˆط¨ط§ظٹظ„ ظٹط³ط¬ظ„ظˆط§ ظ…ظ†ظ‡ â€” ظٹظ…ظ†ط¹ ظ…ط´ط§ط±ظƒط© ط§ظ„ط­ط³ط§ط¨ط§طھ
      if (!isAdmin) {
        if (
          !deviceId ||
          typeof deviceId !== "string" ||
          deviceId.length < 8 ||
          deviceId.length > 128
        ) {
          res.status(403).json({ error: "طھط³ط¬ظٹظ„ ط§ظ„ط¯ط®ظˆظ„ ظ…ط³ظ…ظˆط­ ظپظ‚ط· ظ…ظ† ط§ظ„طھط·ط¨ظٹظ‚ ط§ظ„ط±ط³ظ…ظٹ ط¹ظ„ظ‰ ط§ظ„ظ…ظˆط¨ط§ظٹظ„" });
          return;
        }

        if (!user.boundDeviceId) {
          // ط£ظˆظ„ طھط³ط¬ظٹظ„ ط¯ط®ظˆظ„ â†’ ط§ط±ط¨ط· ظ‡ط°ط§ ط§ظ„ط¬ظ‡ط§ط² ط¨ط§ظ„ط­ط³ط§ط¨ طھظ„ظ‚ط§ط¦ظٹط§ظ‹
          await db.updateUser(user.id, { boundDeviceId: deviceId, deviceBoundAt: new Date() });
        } else if (user.boundDeviceId !== deviceId) {
          // ط¬ظ‡ط§ط² ظ…ط®طھظ„ظپ ط¹ظ† ط§ظ„ظ…ط³ط¬ظ„ â†’ ط§ط±ظپط¶
          console.warn(
            `[Auth] Device mismatch for user ${user.username}: bound=${user.boundDeviceId.slice(0, 8)}â€¦ got=${deviceId.slice(0, 8)}â€¦`
          );
          res.status(403).json({
            error: "ظ‡ط°ط§ ط§ظ„ط­ط³ط§ط¨ ظ…ط±ط¨ظˆط· ط¨ط¬ظ‡ط§ط² ظ…ظˆط¨ط§ظٹظ„ ط¢ط®ط±. ظ„ظˆ ط؛ظٹط±طھ ط¬ظ‡ط§ط²ظƒطŒ ظƒظ„ظ… ط§ظ„ط¥ط¯ط§ط±ط© ظ„ظپظƒ ط§ظ„ط±ط¨ط·.",
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
      res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: SESSION_DURATION_MS });
      res.json({ success: true, user: { id: user.id, name: user.name, role: user.role, username: user.username, email: user.email } });
    } catch (error) {
      console.error("[Auth] Login failed", error);
      res.status(500).json({ error: "Login failed" });
    }
  });
}

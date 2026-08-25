import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import path from "path";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import cors from "cors";

// ── Rate Limiter (in-memory — مناسب لسيرفر واحد) ─────────────────────────────
interface AttemptRecord {
  count: number;
  resetAt: number;
}

function createRateLimiter({ windowMs, max }: { windowMs: number; max: number }) {
  const attempts = new Map<string, AttemptRecord>();

  // تنظيف دوري عشان الـ memory متتملىش
  setInterval(() => {
    const now = Date.now();
    attempts.forEach((record, key) => {
      if (record.resetAt < now) attempts.delete(key);
    });
  }, windowMs).unref();

  return function rateLimit(req: express.Request, res: express.Response, next: express.NextFunction) {
    const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";
    const now = Date.now();

    let record = attempts.get(ip);
    if (!record || record.resetAt < now) {
      record = { count: 0, resetAt: now + windowMs };
      attempts.set(ip, record);
    }

    record.count++;
    if (record.count > max) {
      const retryAfterSec = Math.ceil((record.resetAt - now) / 1000);
      res.set("Retry-After", String(retryAfterSec));
      res.status(429).json({ error: `محاولات كتير جداً. حاول تاني بعد ${retryAfterSec} ثانية` });
      return;
    }
    next();
  };
}

// ── CORS Allowlist ────────────────────────────────────────────────────────────
// الأصول المسموح ليها تعمل طلبات بالـ credentials.
// على الموبايل (CapacitorHttp / native HTTP) مفيش Origin header أصلاً فمش بيتأثر.
const DEFAULT_ALLOWED_ORIGINS = [
  /^http:\/\/localhost(:\d+)?$/,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/,
];

function isOriginAllowed(origin: string): boolean {
  if (DEFAULT_ALLOWED_ORIGINS.some((re) => re.test(origin))) return true;
  const extra = process.env.ALLOWED_ORIGINS; // مثال: "https://tracker.mycompany.com,https://10.0.0.5:5173"
  if (!extra) return false;
  return extra
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean)
    .some((allowed) => origin === allowed);
}

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => server.close(() => resolve(true)));
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) return port;
  }
  throw new Error(`No available port starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  // نثق في الـ proxy (Railway / Nginx) عشان req.ip يطلع صح للـ rate limiter
  app.set("trust proxy", 1);

  // ── Security Headers ────────────────────────────────────────────────────────
  app.use((_req, res, next) => {
    res.set("X-Content-Type-Options", "nosniff");
    res.set("X-Frame-Options", "DENY");
    res.set("Referrer-Policy", "same-origin");
    next();
  });

  // ── CORS: allowlist بدل انعكاس أي Origin ───────────────────────────────────
  app.use(cors({
    origin(origin, callback) {
      // طلبات من نفس الأصل أو native apps ملهاش Origin → اسمح
      if (!origin || isOriginAllowed(origin)) return callback(null, true);
      return callback(null, false);
    },
    credentials: true,
  }));

  // ── Body limit: 8mb كفاية للصور المضغوطة (كانت 50mb — ثغرة DoS) ───────────
  app.use(express.json({ limit: "8mb" }));
  app.use(express.urlencoded({ limit: "8mb", extended: true }));

  // ── Rate limiting على اللوجين (حماية من brute force) ──────────────────────
  const loginLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 20 });
  app.use("/api/auth/login", loginLimiter);

  // Serve locally uploaded files (photos from check-in)
  const uploadsDir = path.join(process.cwd(), "uploads");
  app.use("/uploads", express.static(uploadsDir));

  // Auth routes (login)
  registerOAuthRoutes(app);

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({ router: appRouter, createContext })
  );

  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT ?? "3000");
  const port = await findAvailablePort(preferredPort);
  if (port !== preferredPort) console.log(`Port ${preferredPort} busy, using ${port}`);

  server.listen(port, () => {
    console.log(`✅ Server running: http://localhost:${port}/`);
    console.log(`   Run "pnpm seed" to create the first admin user`);
  });
}

startServer().catch(console.error);

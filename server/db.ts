import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { InsertUser, users } from "../drizzle/schema";

// ── Connection Pool (يحل مشكلة الـ timeout من Railway) ──────────────────────
let _pool: mysql.Pool | null = null;
let _db: any = null;

function createPool() {
  if (!process.env.DATABASE_URL) return null;
  try {
    const pool = mysql.createPool({
      uri: process.env.DATABASE_URL,
      waitForConnections: true,
      connectionLimit: 10,        // أقصى عدد connections متوازية
      queueLimit: 0,
      connectTimeout: 10_000,     // 10 ثانية للاتصال
      // keepAlive ping كل دقيقتين عشان Railway ميقطعش الكونكشن
      enableKeepAlive: true,
      keepAliveInitialDelay: 120_000,
    });
    return pool;
  } catch (error) {
    console.warn("[Database] Failed to create pool:", error);
    return null;
  }
}

export async function getDb(): Promise<any> {
  if (!_db) {
    if (!_pool) _pool = createPool();
    if (_pool) {
      try {
        _db = drizzle(_pool) as any;
        console.log("[Database] ✅ Pool connected");
      } catch (error) {
        console.warn("[Database] Failed to init drizzle:", error);
        _db = null;
      }
    }
  }
  return _db;
}

// ── Helper: retry تلقائي لو الكونكشن انقطع ───────────────────────────────────
async function withRetry<T>(fn: () => Promise<T>, retries = 2): Promise<T> {
  try {
    return await fn();
  } catch (err: any) {
    const isConnError =
      err?.cause?.code === "ER_NET_READ_INTERRUPTED" ||
      err?.cause?.code === "ECONNRESET" ||
      err?.cause?.code === "PROTOCOL_CONNECTION_LOST";

    if (retries > 0 && isConnError) {
      console.warn(`[Database] Connection lost, retrying... (${retries} left)`);
      // reset الـ pool عشان يعمل connection جديد
      _pool = null;
      _db = null;
      await new Promise(r => setTimeout(r, 500));
      return withRetry(fn, retries - 1);
    }
    throw err;
  }
}

// ── Queries ───────────────────────────────────────────────────────────────────
export async function getUserById(id: number) {
  return withRetry(async () => {
    const db = await getDb();
    if (!db) return undefined;
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0] ?? undefined;
  });
}

export async function getUserByUsername(username: string) {
  return withRetry(async () => {
    const db = await getDb();
    if (!db) return undefined;
    const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
    return result[0] ?? undefined;
  });
}

export async function createUser(user: InsertUser): Promise<void> {
  return withRetry(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    await db.insert(users).values(user);
  });
}

export async function updateLastSignedIn(id: number): Promise<void> {
  return withRetry(async () => {
    const db = await getDb();
    if (!db) return;
    await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, id));
  });
}

// ── Admin: list all users ─────────────────────────────────────────────────────
export async function listUsers() {
  return withRetry(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select({
      id: users.id,
      username: users.username,
      name: users.name,
      email: users.email,
      role: users.role,
      createdAt: users.createdAt,
      lastSignedIn: users.lastSignedIn,
      boundDeviceId: users.boundDeviceId,
      deviceBoundAt: users.deviceBoundAt,
    }).from(users).orderBy(users.name);
  });
}

// ══════════════════════════════════════════════════════════
// أضف الكود ده في آخر ملف server/db.ts
// ══════════════════════════════════════════════════════════

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

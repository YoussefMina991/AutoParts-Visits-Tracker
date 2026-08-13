/**
 * Full Seed Script — 43 فرع + 2 مدير
 * Run: npx tsx server/seedFull.ts
 */
import "dotenv/config";
import { hashPassword } from "./auth";
import * as db from "./db";
import { getDb } from "./db";
import { branches, managers, managerBranches, users } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { branchesData, manager1Branches, manager2Branches } from "./seedData";

async function seedFull() {
  const database = await getDb();
  if (!database) throw new Error("DB not available");

  console.log("🌱 Starting full seed...\n");

  // ── 1. Admin user ──────────────────────────────────────────
  console.log("👤 Creating admin...");
  const adminUsername = process.env.SEED_USERNAME ?? "admin";
  const adminPassword = process.env.SEED_PASSWORD ?? "admin123";
  let adminUser = await db.getUserByUsername(adminUsername);
  if (!adminUser) {
    await db.createUser({
      username: adminUsername,
      passwordHash: await hashPassword(adminPassword),
      name: "مدير النظام",
      email: null,
      role: "admin",
      lastSignedIn: new Date(),
    });
    adminUser = await db.getUserByUsername(adminUsername);
    console.log(`  ✅ Admin created: ${adminUsername} / ${adminPassword}`);
  } else {
    console.log(`  ⏭️  Admin already exists`);
  }

  // ── 2. Manager users ───────────────────────────────────────
  console.log("\n👔 Creating manager accounts...");

  const managersConfig = [
    { username: "mina.mohsen", password: "mina1234", name: "مينا محسن وليم", employeeCode: "MGR-001", phone: "01200000001", assignedCodes: manager1Branches },
    { username: "youssef.mina", password: "youssef1234", name: "يوسف مينا محسن", employeeCode: "MGR-002", phone: "01200000002", assignedCodes: manager2Branches },
  ];

  const managerIds: number[] = [];

  for (const mgr of managersConfig) {
    let userRecord = await db.getUserByUsername(mgr.username);
    if (!userRecord) {
      await db.createUser({
        username: mgr.username,
        passwordHash: await hashPassword(mgr.password),
        name: mgr.name,
        email: null,
        role: "user",
        lastSignedIn: new Date(),
      });
      userRecord = await db.getUserByUsername(mgr.username);
      console.log(`  ✅ User: ${mgr.username} / ${mgr.password}`);
    } else {
      console.log(`  ⏭️  User exists: ${mgr.username}`);
    }

    // Create manager profile
    const existing = await database.select().from(managers).where(eq(managers.userId, userRecord!.id)).limit(1);
    let managerId: number;
    if (!existing[0]) {
      const result = await database.insert(managers).values({
        userId: userRecord!.id,
        employeeCode: mgr.employeeCode,
        phone: mgr.phone,
        isActive: "yes",
      });
      managerId = (result as any).insertId ?? (existing[0] as any)?.id;
      // Re-fetch to get the ID
      const created = await database.select().from(managers).where(eq(managers.userId, userRecord!.id)).limit(1);
      managerId = created[0]!.id;
      console.log(`     Manager profile created (ID: ${managerId})`);
    } else {
      managerId = existing[0].id;
      console.log(`     Manager profile exists (ID: ${managerId})`);
    }
    managerIds.push(managerId);
    (mgr as any)._managerId = managerId;
    (mgr as any)._userId = userRecord!.id;
  }

  // ── 3. Branches ────────────────────────────────────────────
  console.log("\n🏪 Inserting 43 branches...");
  const branchIdMap: Record<string, number> = {};

  for (const b of branchesData) {
    const existing = await database.select().from(branches).where(eq(branches.code, b.code)).limit(1);
    if (!existing[0]) {
      await database.insert(branches).values({
        name: b.name,
        code: b.code,
        address: `${b.address} | ${b.phone}`,
        latitude: b.lat,
        longitude: b.lon,
        geofenceRadiusMeters: 200,
        isActive: "yes",
      });
      const created = await database.select().from(branches).where(eq(branches.code, b.code)).limit(1);
      branchIdMap[b.code] = created[0]!.id;
      process.stdout.write(".");
    } else {
      branchIdMap[b.code] = existing[0].id;
      process.stdout.write("·");
    }
  }
  console.log(`\n  ✅ ${branchesData.length} branches ready`);

  // ── 4. Manager ↔ Branch assignments ───────────────────────
  console.log("\n🔗 Assigning branches to managers...");

  const assignments = [
    { managerId: managerIds[0]!, codes: manager1Branches },
    { managerId: managerIds[1]!, codes: manager2Branches },
  ];

  for (const { managerId, codes } of assignments) {
    for (const code of codes) {
      const branchId = branchIdMap[code];
      if (!branchId) continue;
      const existing = await database.select().from(managerBranches)
        .where(eq(managerBranches.managerId, managerId))
        .limit(100);
      const alreadyAssigned = existing.some(e => e.branchId === branchId);
      if (!alreadyAssigned) {
        await database.insert(managerBranches).values({ managerId, branchId });
        process.stdout.write(".");
      } else {
        process.stdout.write("·");
      }
    }
  }

  console.log("\n\n🎉 Seed complete!\n");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  Admin:    admin / admin123");
  console.log("  Manager1: mina.mohsen / mina1234  (27 فرع - القاهرة والجيزة)");
  console.log("  Manager2: youssef.mina / youssef1234  (9 فروع - الجيزة)");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  process.exit(0);
}

seedFull().catch(err => {
  console.error("Seed failed:", err);
  process.exit(1);
});

/**
 * Run once to create the first admin user:
 *   npx tsx server/seed.ts
 */
import "dotenv/config";
import { hashPassword } from "./auth";
import * as db from "./db";

async function seed() {
  const username = process.env.SEED_USERNAME ?? "admin";
  const password = process.env.SEED_PASSWORD ?? "admin123";
  const name = process.env.SEED_NAME ?? "مدير النظام";

  console.log(`[Seed] Creating admin user: ${username}`);

  const existing = await db.getUserByUsername(username);
  if (existing) {
    console.log("[Seed] User already exists, skipping.");
    process.exit(0);
  }

  const passwordHash = await hashPassword(password);
  await db.createUser({
    username,
    passwordHash,
    name,
    email: null,
    role: "admin",
    lastSignedIn: new Date(),
  });

  console.log(`[Seed] ✅ Admin created!`);
  console.log(`  username: ${username}`);
  console.log(`  password: ${password}`);
  console.log(`  IMPORTANT: Change the password after first login!`);
  process.exit(0);
}

seed().catch(err => {
  console.error("[Seed] Failed:", err);
  process.exit(1);
});

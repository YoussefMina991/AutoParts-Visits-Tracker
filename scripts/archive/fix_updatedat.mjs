/**
 * Fix updatedAt columns
 * شغّله: node fix_updatedat.mjs
 */
import "dotenv/config";
import mysql from "mysql2/promise";

const conn = await mysql.createConnection(process.env.DATABASE_URL);
console.log("✅ Connected\n");

const fixes = [
  // إصلاح updatedAt في branches — نغيّره لـ MODIFY عشان نضيف ON UPDATE
  {
    name: "branches.updatedAt → MODIFY with ON UPDATE",
    sql: `ALTER TABLE branches MODIFY COLUMN updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`,
  },
  // نفس الإصلاح لـ managers و users لو محتاجين
  {
    name: "managers.updatedAt → MODIFY with ON UPDATE",
    sql: `ALTER TABLE managers MODIFY COLUMN updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`,
  },
  {
    name: "users.updatedAt → MODIFY with ON UPDATE",
    sql: `ALTER TABLE users MODIFY COLUMN updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`,
  },
];

for (const fix of fixes) {
  try {
    await conn.execute(fix.sql);
    console.log(`✅ Fixed: ${fix.name}`);
  } catch (err) {
    if (err.code === "ER_BAD_FIELD_ERROR") {
      console.log(`ℹ️  Skipped (column not found): ${fix.name}`);
    } else {
      console.error(`❌ Failed: ${fix.name} — ${err.message}`);
    }
  }
}

await conn.end();
console.log("\n✅ Done! جرب تعمل فرع جديد دلوقتي.");

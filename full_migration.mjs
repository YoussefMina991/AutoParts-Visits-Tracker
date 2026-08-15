/**
 * Full Migration Script
 * يصلح كل مشاكل قاعدة البيانات دفعة واحدة
 * شغّله مرة واحدة بس: node full_migration.mjs
 */

import "dotenv/config";
import mysql from "mysql2/promise";

const conn = await mysql.createConnection(process.env.DATABASE_URL);
console.log("✅ Connected to database\n");

const migrations = [
  // ── visits: suspicionScore ──────────────────────────────────────────────
  {
    name: "visits.suspicionScore",
    sql: `ALTER TABLE visits ADD COLUMN suspicionScore INT NOT NULL DEFAULT 0 COMMENT 'نقاط الشك: 0=نظيف, 25-49=مريب, 50-74=مشبوه, 75+=وهمي'`,
  },
  // ── visits: mockReasons ─────────────────────────────────────────────────
  // TEXT في MySQL مينفعش يبقى له DEFAULT — بنخليه NULL
  {
    name: "visits.mockReasons",
    sql: `ALTER TABLE visits ADD COLUMN mockReasons TEXT NULL COMMENT 'JSON array بأسباب الشك من كل الطبقات'`,
  },
  // ── branches: updatedAt ─────────────────────────────────────────────────
  // الـ schema بيقول updatedAt موجود بس الـ DB القديمة ممكن تكون من غيره
  {
    name: "branches.updatedAt",
    sql: `ALTER TABLE branches ADD COLUMN updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`,
  },
];

let applied = 0;
let skipped = 0;

for (const migration of migrations) {
  try {
    await conn.execute(migration.sql);
    console.log(`✅ Applied: ${migration.name}`);
    applied++;
  } catch (err) {
    if (
      err.code === "ER_DUP_FIELDNAME" ||        // العمود موجود أصلاً
      err.code === "ER_BLOB_CANT_HAVE_DEFAULT"   // مش هيحصل بعد الإصلاح بس احتياطاً
    ) {
      console.log(`ℹ️  Skipped (already exists): ${migration.name}`);
      skipped++;
    } else {
      console.error(`❌ Failed: ${migration.name}`);
      console.error(`   Error: ${err.message}`);
    }
  }
}

await conn.end();
console.log(`\n══════════════════════════════`);
console.log(`✅ Applied: ${applied} | ℹ️  Skipped: ${skipped}`);
console.log(`\nالتطبيق هيشتغل صح دلوقتي!`);

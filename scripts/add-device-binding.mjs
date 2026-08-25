/**
 * add-device-binding.mjs
 * ══════════════════════════════════════════════════════════
 * بيضيف أعمدة ربط الجهاز لجدول users بشكل آمن (idempotent):
 * بيفحص الأعمدة الأول — لو موجودة مش هيلمسها.
 *
 * الاستخدام: node scripts/add-device-binding.mjs
 */

import "dotenv/config";
import mysql from "mysql2/promise";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL مفقود — حطه في .env");
  process.exit(1);
}

const COLUMNS = [
  { table: "users", name: "boundDeviceId", definition: "VARCHAR(128) NULL" },
  { table: "users", name: "deviceBoundAt", definition: "TIMESTAMP NULL" },
];

async function main() {
  const conn = await mysql.createConnection({ uri: DATABASE_URL, connectTimeout: 15_000 });
  console.log("✅ اتصلنا بالداتابيز\n");

  let created = 0;
  let skipped = 0;

  for (const col of COLUMNS) {
    const [existing] = await conn.query(
      `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
       WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
      [col.table, col.name]
    );

    if (existing[0].c > 0) {
      console.log(`  ⏭️  العمود ${col.table}.${col.name} موجود بالفعل`);
      skipped++;
      continue;
    }

    console.log(`  ⏳ جاري إضافة ${col.table}.${col.name}...`);
    await conn.query(`ALTER TABLE \`${col.table}\` ADD COLUMN \`${col.name}\` ${col.definition}`);
    console.log(`  ✅ اتعمل ${col.table}.${col.name}`);
    created++;
  }

  await conn.end();
  console.log(`\n🎉 خلصنا: ${created} اتضافوا، ${skipped} كانوا موجودين`);
}

main().catch((err) => {
  console.error("❌ فشل:", err.message);
  process.exit(1);
});

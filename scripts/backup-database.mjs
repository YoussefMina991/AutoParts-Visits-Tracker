/**
 * backup-database.mjs
 * ══════════════════════════════════════════════════════════
 * بيعمل Backup كامل لكل الجداول في ملفات JSON محلية
 * (مش محتاج mysqldump ولا أي أدوات خارجية — Node بس)
 *
 * الاستخدام:
 *   node scripts/backup-database.mjs
 *
 * النتيجة: backups/db-backup-<التاريخ>/<table>.json لكل جدول
 */

import "dotenv/config";
import mysql from "mysql2/promise";
import fs from "fs";
import path from "path";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL مفقود — حطه في .env");
  process.exit(1);
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const outDir = path.join(process.cwd(), "backups", `db-backup-${stamp}`);

async function main() {
  fs.mkdirSync(outDir, { recursive: true });

  const conn = await mysql.createConnection(DATABASE_URL);
  console.log("✅ اتصلنا بالداتابيز");

  const [tables] = await conn.query("SHOW TABLES");
  const tableNames = tables.map((r) => Object.values(r)[0]);
  console.log(`📋 عدد الجداول: ${tableNames.length}\n`);

  let totalRows = 0;
  const summary = [];

  for (const table of tableNames) {
    try {
      const [rows] = await conn.query(`SELECT * FROM \`${table}\``);
      const file = path.join(outDir, `${table}.json`);
      fs.writeFileSync(file, JSON.stringify(rows, null, 2));
      totalRows += rows.length;
      summary.push({ table, rows: rows.length });
      console.log(`  ✅ ${table}: ${rows.length} صف → ${path.basename(file)}`);
    } catch (err) {
      console.error(`  ❌ ${table}: ${err.message}`);
      process.exitCode = 1;
    }
  }

  await conn.end();

  // ملف ملخص
  fs.writeFileSync(
    path.join(outDir, "_summary.json"),
    JSON.stringify({ date: new Date().toISOString(), totalRows, tables: summary }, null, 2)
  );

  console.log(`\n🎉 الـ Backup اتحفظ في: ${outDir}`);
  console.log(`   إجمالي الصفوف: ${totalRows}`);
}

main().catch((err) => {
  console.error("❌ فشل:", err.message);
  process.exit(1);
});

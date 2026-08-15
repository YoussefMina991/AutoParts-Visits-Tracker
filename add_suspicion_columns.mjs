/**
 * Migration: يضيف عمودين جدد لجدول visits
 * suspicionScore — نقاط الشك (0 = نظيف، 75+ = وهمي على الأرجح)
 * mockReasons    — JSON array بأسباب الشك
 *
 * شغّله مرة واحدة بس:
 *   node add_suspicion_columns.mjs
 */

import "dotenv/config";
import mysql from "mysql2/promise";

const conn = await mysql.createConnection(process.env.DATABASE_URL);

console.log("🔄 Adding suspicion columns to visits table...");

try {
  await conn.execute(`
    ALTER TABLE visits
      ADD COLUMN suspicionScore INT NOT NULL DEFAULT 0
        COMMENT 'نقاط الشك: 0=نظيف, 25-49=مريب, 50-74=مشبوه, 75+=وهمي',
      ADD COLUMN mockReasons TEXT NOT NULL DEFAULT '[]'
        COMMENT 'JSON array بأسباب الشك من كل الطبقات'
  `);
  console.log("✅ Columns added successfully!");
} catch (err) {
  if (err.code === "ER_DUP_FIELDNAME") {
    console.log("ℹ️  Columns already exist — skipping.");
  } else {
    throw err;
  }
}

await conn.end();
console.log("Done.");

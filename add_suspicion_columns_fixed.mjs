/**
 * Migration: يضيف عمودين جدد لجدول visits
 * شغّله مرة واحدة بس: node add_suspicion_columns_fixed.mjs
 */

import "dotenv/config";
import mysql from "mysql2/promise";

const conn = await mysql.createConnection(process.env.DATABASE_URL);
console.log("🔄 Adding suspicion columns to visits table...");

try {
  // suspicionScore: INT عادي — مفيش مشكلة في الـ DEFAULT
  await conn.execute(`
    ALTER TABLE visits
      ADD COLUMN suspicionScore INT NOT NULL DEFAULT 0
        COMMENT 'نقاط الشك: 0=نظيف, 25-49=مريب, 50-74=مشبوه, 75+=وهمي'
  `);
  console.log("✅ suspicionScore added!");
} catch (err) {
  if (err.code === "ER_DUP_FIELDNAME") {
    console.log("ℹ️  suspicionScore already exists — skipping.");
  } else throw err;
}

try {
  // mockReasons: TEXT مش بيقبل DEFAULT في MySQL — بنخليه nullable
  // الكود بيحط '[]' لو مفيش reasons، فمش محتاجين default على الـ DB
  await conn.execute(`
    ALTER TABLE visits
      ADD COLUMN mockReasons TEXT NULL
        COMMENT 'JSON array بأسباب الشك من كل الطبقات'
  `);
  console.log("✅ mockReasons added!");
} catch (err) {
  if (err.code === "ER_DUP_FIELDNAME") {
    console.log("ℹ️  mockReasons already exists — skipping.");
  } else throw err;
}

await conn.end();
console.log("✅ Done! التطبيق هيشتغل دلوقتي.");

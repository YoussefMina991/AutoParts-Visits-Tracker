/**
 * add_photo_url.mjs
 * ══════════════════════════════════════════════════════════
 * يضيف column photoUrl في جدول managers
 * الاستخدام: node add_photo_url.mjs
 */

import mysql from "mysql2/promise";
import "dotenv/config";

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) {
  console.error("❌ DATABASE_URL مش موجود في الـ .env");
  process.exit(1);
}

function parseUrl(url) {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: Number(u.port),
    user: u.username,
    password: u.password,
    database: u.pathname.slice(1),
    ssl: { rejectUnauthorized: false },
  };
}

async function run() {
  const conn = await mysql.createConnection(parseUrl(DB_URL));
  console.log("✅ متصل بالداتابيز");

  try {
    // تحقق إذا الـ column موجود أصلاً
    const [rows] = await conn.execute(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'managers'
        AND COLUMN_NAME = 'photoUrl'
    `);

    if (rows.length > 0) {
      console.log("⚠️  الـ column photoUrl موجود بالفعل — مفيش حاجة هتتعمل");
    } else {
      await conn.execute(`
        ALTER TABLE managers
        ADD COLUMN photoUrl VARCHAR(512) NULL AFTER phone
      `);
      console.log("✅ تم إضافة column photoUrl في جدول managers بنجاح!");
    }
  } finally {
    await conn.end();
    console.log("🔌 تم إغلاق الاتصال");
  }
}

run().catch((err) => {
  console.error("❌ خطأ:", err.message);
  process.exit(1);
});

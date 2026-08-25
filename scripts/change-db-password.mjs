/**
 * change-db-password.mjs
 * ══════════════════════════════════════════════════════════
 * يغيّر باسورد مستخدم الداتابيز بأمان ويطبع لك الـ DATABASE_URL الجديد.
 *
 * الاستخدام:
 *   node scripts/change-db-password.mjs --generate     ← يولّد باسورد قوي عشوائي
 *   node scripts/change-db-password.mjs "باسورد-قوي-هنا"  ← باسورد من اختيارك (16 حرف على الأقل)
 *
 * ⚠️ بعد تشغيله:
 *   1. انسخ الـ DATABASE_URL الجديد اللي هيطبعه
 *   2. حدّث متغير DATABASE_URL في Railway (App Service → Variables)
 *   3. حدّث .env المحلي بنفس القيمة
 */

import "dotenv/config";
import mysql from "mysql2/promise";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL مفقود في .env");
  process.exit(1);
}

// ── جهّز الباسورد الجديد ──────────────────────────────────────────────────────
let newPassword;
if (process.argv[2] === "--generate") {
  // باسورد عشوائي 34 حرف (حروف كبيرة وصغيرة وأرقام ورموز آمنة للـ URL)
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789_-";
  const bytes = await import("crypto").then((c) => c.randomBytes(34));
  newPassword = Array.from(bytes, (b) => chars[b % chars.length]).join("");
} else {
  newPassword = process.argv[2];
}

if (!newPassword || newPassword.length < 16) {
  console.error('❌ الاستخدام: node scripts/change-db-password.mjs --generate');
  console.error('   أو:        node scripts/change-db-password.mjs "باسورد-قوي-16-حرف-على-الأقل"');
  process.exit(1);
}

try {
  const url = new URL(DATABASE_URL);
  const username = decodeURIComponent(url.username);

  // اتصال بالكريدينشالز الحالية
  const conn = await mysql.createConnection({
    uri: DATABASE_URL,
    connectTimeout: 15_000,
  });
  console.log(`✅ اتصلنا بالداتابيز (${url.host}:${url.port || 3306})`);

  // غيّر الباسورد
  const quotedUser = `'${username.replace(/'/g, "''")}'`;
  await conn.query(`ALTER USER ${quotedUser}@'%' IDENTIFIED BY ?`, [newPassword]);
  await conn.query("FLUSH PRIVILEGES");
  await conn.end();
  console.log(`✅ الباسورد اتغيّر للمستخدم: ${username}\n`);

  // اطبع الـ DATABASE_URL الجديد
  // ملاحظة: url.host بيضم البورت أصلاً فمش بنضيفه تاني
  const newUrl = `${url.protocol}//${encodeURIComponent(username)}:${encodeURIComponent(newPassword)}@${url.host}${url.pathname}`;
  console.log("════════════════════════════════════════════════");
  console.log("📋 الـ DATABASE_URL الجديد (انسخه):");
  console.log(newUrl);
  console.log("════════════════════════════════════════════════");
  console.log("\n⚠️  خطوات بعد كده:");
  console.log("   1. Railway → App Service → Variables → DATABASE_URL → حط القيمة الجديدة");
  console.log("      (هيعمل redeploy تلقائي)");
  console.log("   2. حدّث .env المحلي بنفس القيمة");
  console.log('   3. جرّب الاتصال: node scripts/backup-database.mjs');
} catch (err) {
  console.error("❌ فشل التغيير:", err.message);
  process.exit(1);
}

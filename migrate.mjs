/**
 * migrate.mjs
 * ══════════════════════════════════════════════════════════
 * سكريبت بينقل الداتا من الـ MySQL القديم للجديد
 * الاستخدام: node migrate.mjs
 */

import mysql from "mysql2/promise";

const OLD_DB = "mysql://root:kWzxixsbgQXrFKyEdMUoSlzoxrstKhhg@hayabusa.proxy.rlwy.net:44464/railway";
const NEW_DB = "mysql://root:VjEncCKEEnQjoPOwfPLpWIOvLHzbMvJm@sakura.proxy.rlwy.net:26201/railway";

function parseUrl(url) {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: Number(u.port),
    user: u.username,
    password: u.password,
    database: u.pathname.slice(1),
  };
}

async function migrate() {
  console.log("🔌 جاري الاتصال بالـ databases...");

  const oldConn = await mysql.createConnection(parseUrl(OLD_DB));
  const newConn = await mysql.createConnection(parseUrl(NEW_DB));

  console.log("✅ اتصلنا بالاتنين\n");

  // جيب كل الجداول من القديم
  const [tables] = await oldConn.query("SHOW TABLES");
  const tableNames = tables.map((r) => Object.values(r)[0]);
  console.log(`📋 الجداول الموجودة: ${tableNames.join(", ")}\n`);

  for (const table of tableNames) {
    try {
      // جيب البيانات
      const [rows] = await oldConn.query(`SELECT * FROM \`${table}\``);
      console.log(`📦 ${table}: ${rows.length} صف`);

      if (rows.length === 0) continue;

      // امسح القديم في الجديد وحط الجديد
      await newConn.query(`DELETE FROM \`${table}\``);

      // حط البيانات في batches
      const batchSize = 100;
      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        const columns = Object.keys(batch[0]).map((c) => `\`${c}\``).join(", ");
        const placeholders = batch.map((r) => `(${Object.values(r).map(() => "?").join(", ")})`).join(", ");
        const values = batch.flatMap((r) => Object.values(r));
        await newConn.query(
          `INSERT INTO \`${table}\` (${columns}) VALUES ${placeholders}`,
          values
        );
      }
      console.log(`  ✅ تم نقل ${rows.length} صف`);
    } catch (err) {
      console.log(`  ⚠️  ${table}: ${err.message}`);
    }
  }

  await oldConn.end();
  await newConn.end();
  console.log("\n🎉 تم نقل الداتا بنجاح!");
}

migrate().catch((err) => {
  console.error("❌ خطأ:", err.message);
  process.exit(1);
});

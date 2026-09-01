/**
 * restore-database.mjs
 * ══════════════════════════════════════════════════════════
 * بيرجّع Backup كامل من ملفات JSON (اللي backup-database.mjs بيعملها)
 * لقاعدة بيانات فاضية — بنفس الـ IDs الأصلية وبترتيب آمن
 *
 * الاستخدام:
 *   node scripts/restore-database.mjs [backup-dir]
 *   من غير arg: بياخد أحدث backups/db-backup-* تلقائيًا
 *
 * أمان:
 *   - الحرس: لو أي جدول هدف فيه صفوف → وقف فورًا (القاعدة مش فاضية)
 *   - كل حاجة جوه transaction واحدة + FOREIGN_KEY_CHECKS=0 مؤقتًا
 *   - مفيش أي flag للتفريغ — فضّي القاعدة بإيدك الأول
 *
 * النتيجة: COUNT(*) لكل جدول لازم يطابق _summary.json — لو لأ exit 1
 */

import "dotenv/config";
import mysql from "mysql2/promise";
import fs from "fs";
import path from "path";

// ترتيب الإدخال — الجداول اللي مش في القائمة دي بتتجاهل مع رسالة
const RESTORE_ORDER = [
  "users",
  "branches",
  "managers",
  "managerBranches",
  "visits",
  "locationLogs",
];

const CHUNK_SIZE = 500; // تقسيم الإدخال (مهم لـ locationLogs اللي فيها آلاف الصفوف)

// التواريخ في الـ backup بتيجي ISO UTC زي "2026-08-24T09:10:59.000Z"
const ISO_UTC_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL مفقود — حطه في .env");
  process.exit(1);
}

/** وصف القاعدة من غير أي password ولا query string */
function describeDb(url) {
  try {
    const u = new URL(url);
    const db = (u.pathname || "").replace(/^\//, "");
    return `${u.hostname}${u.port ? ":" + u.port : ""}/${db} (user: ${u.username || "?"})`;
  } catch {
    return "(الـ URL مش قياسي — مش هطبع تفاصيله)";
  }
}

/** أحدث backups/db-backup-* بالاسم (الأسماء timestamps فالترتيب الأبجدي = الزمني) */
function pickLatestBackupDir(root) {
  if (!fs.existsSync(root)) return null;
  const dirs = fs
    .readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name.startsWith("db-backup-"))
    .map((d) => d.name)
    .sort();
  return dirs.length ? path.join(root, dirs[dirs.length - 1]) : null;
}

/** ISO UTC → MySQL UTC "YYYY-MM-DD HH:MM:SS" (دقة سجلات GPS حرجة — من غير تحويل timezone) */
function isoToMysqlUtc(v) {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v; // قيمة غريبة؟ سيبها زي ما هي
  return d.toISOString().slice(0, 19).replace("T", " ");
}

/** null تفضل null و '' تفضل '' — والتواريخ بس اللي بتتحول */
function toSqlValue(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === "string" && ISO_UTC_RE.test(v)) return isoToMysqlUtc(v);
  return v;
}

/**
 * تجميع الصفوف حسب مفاتيحها — قائمة أعمدة كل INSERT تُبنى من مفاتيح
 * الصفوف نفسها (مش من أول صف للجدول كله)
 */
function groupRowsByColumns(rows) {
  const groups = new Map();
  for (const row of rows) {
    const cols = Object.keys(row);
    const sig = cols.slice().sort().join("\u0000");
    let g = groups.get(sig);
    if (!g) {
      g = { cols, rows: [] };
      groups.set(sig, g);
    }
    g.rows.push(row);
  }
  return [...groups.values()];
}

/** إدخال جدول كامل على شكل chunks — بيرجع عدد الصفوف المدرجة */
async function insertTable(conn, table, rows) {
  const groups = groupRowsByColumns(rows);
  let inserted = 0;

  for (const g of groups) {
    const colsSql = g.cols.map((c) => `\`${c}\``).join(", ");
    const rowPh = `(${g.cols.map(() => "?").join(", ")})`;
    const totalChunks = Math.ceil(g.rows.length / CHUNK_SIZE);

    for (let i = 0, chunkNo = 1; i < g.rows.length; i += CHUNK_SIZE, chunkNo++) {
      const chunk = g.rows.slice(i, i + CHUNK_SIZE);
      const placeholders = chunk.map(() => rowPh).join(", ");
      const params = chunk.flatMap((r) => g.cols.map((c) => toSqlValue(r[c])));

      await conn.query(
        `INSERT INTO \`${table}\` (${colsSql}) VALUES ${placeholders}`,
        params
      );

      inserted += chunk.length;
      if (totalChunks > 1) {
        console.log(
          `    ⏳ ${table}: chunk ${chunkNo}/${totalChunks} (${inserted}/${rows.length} صف)`
        );
      }
    }
  }

  return inserted;
}

async function main() {
  // ── تحديد مجلد الـ backup ──────────────────────────────
  const arg = process.argv[2];
  const backupDir = arg
    ? path.resolve(process.cwd(), arg)
    : pickLatestBackupDir(path.join(process.cwd(), "backups"));

  if (!backupDir || !fs.existsSync(backupDir)) {
    console.error(`❌ مفيش مجلد backup: ${arg || "backups/db-backup-*"}`);
    process.exit(1);
  }
  console.log(`📦 الـ Backup المختار: ${backupDir}`);

  // ── قراءة ملفات الجداول ────────────────────────────────
  const found = new Map();
  for (const f of fs.readdirSync(backupDir)) {
    if (!f.endsWith(".json") || f === "_summary.json") continue;
    const table = f.replace(/\.json$/, "");
    if (!RESTORE_ORDER.includes(table)) {
      console.log(`  ⚠️ جدول غير معروف — تجاهل: ${f}`);
      continue;
    }
    found.set(table, JSON.parse(fs.readFileSync(path.join(backupDir, f), "utf8")));
  }
  if (found.size === 0) {
    console.error("❌ مفيش جداول معروفة في الـ backup");
    process.exit(1);
  }

  const summaryPath = path.join(backupDir, "_summary.json");
  const summary = fs.existsSync(summaryPath)
    ? JSON.parse(fs.readFileSync(summaryPath, "utf8"))
    : null;
  if (!summary) console.log("⚠️ مفيش _summary.json — مقارنة النهاية هتتخطى");

  // ── الاتصال ────────────────────────────────────────────
  const conn = await mysql.createConnection(DATABASE_URL, { timezone: "Z" });
  console.log(`✅ اتصلنا بالداتابيز: ${describeDb(DATABASE_URL)}`);

  // ── الحرس: القاعدة لازم تكون فاضية ─────────────────────
  console.log("🔍 بفحص إن كل جدول هدف فاضي...");
  let dirty = false;
  for (const table of RESTORE_ORDER) {
    const [[{ c }]] = await conn.query(`SELECT COUNT(*) AS c FROM \`${table}\``);
    if (c > 0) {
      console.error(`  🛑 ${table}: فيه ${c} صف`);
      dirty = true;
    } else {
      console.log(`  ✅ ${table}: فاضي`);
    }
  }
  if (dirty) {
    await conn.end();
    console.error(
      "\n🛑 القاعدة مش فاضية — الوقفت قبل ما أكتب أي حاجة. فضّي القاعدة الأول (مفيش flag للتفريغ هنا عن قصد)."
    );
    process.exit(1);
  }

  // ── الإدخال داخل معاملة واحدة ──────────────────────────
  await conn.query("SET FOREIGN_KEY_CHECKS=0");
  await conn.beginTransaction();

  const insertedCounts = new Map();
  try {
    for (const table of RESTORE_ORDER) {
      const rows = found.get(table);
      if (!rows) {
        console.log(`  ⏭️ ${table}: مش موجود في الـ backup — تخطي`);
        continue;
      }
      if (rows.length === 0) {
        insertedCounts.set(table, 0);
        console.log(`  ⏭️ ${table}: مفيش صفوف في الـ backup`);
        continue;
      }
      console.log(`  📥 ${table}: بدأ الإدخال (${rows.length} صف)...`);
      const n = await insertTable(conn, table, rows);
      insertedCounts.set(table, n);
      console.log(`  ✅ ${table}: ${n} صف اتكتبوا`);
    }
    await conn.commit();
    console.log("💾 الـ Transaction اتعمل commit ✅");
  } catch (err) {
    await conn.rollback();
    console.error("↩️ عملت rollback — مفيش ولا صف اتكتب");
    throw err;
  } finally {
    try {
      await conn.query("SET FOREIGN_KEY_CHECKS=1");
    } catch {}
  }

  // ── ضبط AUTO_INCREMENT = أعلى id + 1 (بعد الـ commit — DDL بيعمل implicit commit) ──
  console.log("🔢 ضبط AUTO_INCREMENT...");
  for (const table of RESTORE_ORDER) {
    if (!insertedCounts.get(table)) continue;
    const [[{ m }]] = await conn.query(`SELECT MAX(id) AS m FROM \`${table}\``);
    if (m == null) continue;
    const next = Number(m) + 1;
    if (!Number.isSafeInteger(next)) continue;
    await conn.query(`ALTER TABLE \`${table}\` AUTO_INCREMENT = ${next}`);
    console.log(`  ✅ ${table}: AUTO_INCREMENT = ${next}`);
  }

  // ── المقارنة النهائية مع _summary.json ─────────────────
  if (summary) {
    console.log("\n📊 مقارنة COUNT(*) مع _summary.json:");
    const expectedByTable = new Map(
      (summary.tables || []).map((t) => [t.table, t.rows])
    );

    let mismatch = false;
    for (const table of RESTORE_ORDER) {
      const [[{ c }]] = await conn.query(`SELECT COUNT(*) AS c FROM \`${table}\``);
      const expected = expectedByTable.get(table);
      if (expected == null) {
        console.log(`  ⚠️ ${table}: مش موجود في الملخص — القاعدة فيها ${c} صف`);
        continue;
      }
      const ok = c === expected;
      if (!ok) mismatch = true;
      console.log(
        `  ${ok ? "✅" : "❌"} ${table}: متوقع ${expected} / فعلي ${c}${ok ? "" : " — اختلاف!"}`
      );
    }

    if (mismatch) {
      await conn.end();
      console.error("\n❌ في اختلاف بين القاعدة والملخص — الـ Restore مش مكتمل");
      process.exit(1);
    }
  }

  await conn.end();
  console.log("\n🎉 الـ Restore خلص بنجاح");
}

main().catch((err) => {
  console.error("❌ فشل:", err.message);
  process.exit(1);
});

/**
 * verify-distances.mjs — فحص شامل لنظام المسافات
 * ══════════════════════════════════════════════════════════
 * ① بيختبر كل أزواج الفروع النشطة ضد مصفوفة المسافات
 * ② بيدقق الزيارات الفعلية: كام زيارة اتسجلت ليها مسافة فعلًا؟
 *
 * الاستخدام: npx tsx scripts/verify-distances.mjs
 */

import "dotenv/config";
import mysql from "mysql2/promise";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL مفقود");
  process.exit(1);
}

// استيراد دالة المسافة من المشروع مباشرة (عبر نسخة مترجمة وقت التشغيل)
const { getBranchDistance } = await import("../shared/gizaBranchDistances.ts");

async function main() {
  const conn = await mysql.createConnection({ uri: DATABASE_URL, connectTimeout: 15_000 });

  // ── ① تغطية أزواج الفروع ──────────────────────────────────────────────────
  const [branchRows] = await conn.query(
    "SELECT id, name FROM branches WHERE isActive = 'yes' ORDER BY id"
  );
  const branches = branchRows;

  let ok = 0;
  let miss = 0;
  const missSamples = [];
  for (const a of branches) {
    for (const b of branches) {
      if (a.id === b.id) continue;
      const d = getBranchDistance(a.name, b.name);
      if (d !== null && d !== undefined) ok++;
      else {
        miss++;
        if (missSamples.length < 12) missSamples.push(`${a.name}  ←→  ${b.name}`);
      }
    }
  }
  const totalPairs = branches.length * (branches.length - 1);
  console.log("═".repeat(55));
  console.log(`📍 عدد الفروع النشطة: ${branches.length}`);
  console.log(`🔗 تغطية مصفوفة المسافات (الشيت المعتمد): ${ok}/${totalPairs} زوج (${Math.round((ok / totalPairs) * 100)}%)`);
  if (missSamples.length > 0) {
    console.log(`\n❌ أمثلة أزواج مفيش لها مسافة في المصفوفة:`);
    missSamples.forEach((m) => console.log(`   • ${m}`));
  }

  // ── ①ب التغطية الفعلية بعد الـ Haversine Fallback ─────────────────────────
  // نفس منطق visitRouter: مصفوفة ← وإلا خط مستقيم بين الإحداثيات
  const [coordRows] = await conn.query(
    "SELECT id, name, latitude, longitude FROM branches WHERE isActive = 'yes'"
  );
  const coordMap = new Map(coordRows.map((r) => [r.id, r]));
  let effectiveOk = 0;
  const noCoords = [];
  for (const a of branches) {
    for (const b of branches) {
      if (a.id === b.id) continue;
      const d = getBranchDistance(a.name, b.name);
      if (d !== null && d !== undefined) { effectiveOk++; continue; }
      const ca = coordMap.get(a.id);
      const cb = coordMap.get(b.id);
      if (ca?.latitude && ca?.longitude && cb?.latitude && cb?.longitude) effectiveOk++;
      else noCoords.push(a.name);
    }
  }
  console.log(`\n🛡️ التغطية الفعلية (مصفوفة + Haversine): ${effectiveOk}/${totalPairs} (${Math.round((effectiveOk / totalPairs) * 100)}%)`);
  if (noCoords.length > 0) {
    console.log(`⚠️ فروع من غير إحداثيات صالحة: ${[...new Set(noCoords)].join(", ")}`);
  }

  // ── ② تدقيق الزيارات الفعلية ──────────────────────────────────────────────
  const [visitRows] = await conn.query(
    `SELECT
       COUNT(*) AS totalCompleted,
       SUM(CASE WHEN distanceToPrevBranchKm IS NOT NULL THEN 1 ELSE 0 END) AS withDistance,
       SUM(CASE WHEN distanceToPrevBranchKm IS NULL THEN 1 ELSE 0 END) AS withoutDistance
     FROM visits WHERE status = 'checked_out'`
  );
  const s = visitRows[0];
  console.log("\n" + "═".repeat(55));
  console.log(`🧾 الزيارات المنتهية: ${s.totalCompleted}`);
  console.log(`   ✔️  ليها مسافة مسجلة: ${s.withDistance}`);
  console.log(`   ✘ من غير مسافة:      ${s.withoutDistance}`);

  // تفاصيل آخر 10 زيارات منتهية
  const [recent] = await conn.query(
    `SELECT v.id, v.checkInAt, v.distanceToPrevBranchKm AS dist, b.name AS branchName
     FROM visits v JOIN branches b ON b.id = v.branchId
     WHERE v.status = 'checked_out'
     ORDER BY v.checkInAt DESC LIMIT 10`
  );
  if (recent.length > 0) {
    console.log(`\n📋 آخر ${recent.length} زيارة منتهية:`);
    recent.forEach((r) => {
      const d = r.dist === null ? "❌ بدون مسافة" : `✔️ ${r.dist} كم`;
      console.log(`   ${new Date(r.checkInAt).toISOString().slice(0, 16)} | ${r.branchName} | ${d}`);
    });
  }

  await conn.end();
  console.log("\n" + "═".repeat(55));
}

main().catch((err) => {
  console.error("❌ فشل:", err.message);
  process.exit(1);
});

import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";

const DATABASE_URL = process.env.DATABASE_URL ||
  "mysql://root:VjEncCKEEnQjoPOwfPLpWIOvLHzbMvJm@sakura.proxy.rlwy.net:26201/railway";

// ─── الفروع — بدون phone/region/mapUrl لأنهم مش في الـ schema ────────────────
// latitude/longitude مطلوبين — حطينا إحداثيات تقريبية لكل فرع
const BRANCHES = [
  // Giza
  { code:"RAO",  name:"الجيزة : المهندسين - ميجا ستور",       address:"89 شارع ترعة الزمر",              latitude:"30.0626", longitude:"31.2119" },
  { code:"RSW",  name:"الجيزة : اكتوبر - بنزينة وطنية",       address:"طريق الواحات - امام دريم لاند",   latitude:"29.9602", longitude:"30.9442" },
  { code:"RAG",  name:"الجيزة : المهندسين - السودان",          address:"304 شارع السودان",                latitude:"30.0611", longitude:"31.2081" },
  { code:"RAT",  name:"الجيزة : اكتوبر - طيبة جراند مول",     address:"طيبة جراند مول",                 latitude:"29.9741", longitude:"30.9235" },
  { code:"RAC",  name:"الجيزة : الشيخ زايد",                  address:"محطة شيل اوت الخمائل",           latitude:"30.0175", longitude:"30.9782" },
  { code:"RAF",  name:"الجيزة : فيصل - اللبيني",              address:"2 ش مصرف اللبيني",               latitude:"29.9997", longitude:"31.1786" },
  { code:"RAY",  name:"الجيزة : فيصل - ابو المحاسن",          address:"216 ش ابو المحاسن",              latitude:"30.0024", longitude:"31.1712" },
  { code:"RAB",  name:"الجيزة : إمبابة",                      address:"144 شارع طلعت حرب",              latitude:"30.0734", longitude:"31.2172" },
  { code:"RAA",  name:"الجيزة : العجوزة",                     address:"11 ش المراغي",                   latitude:"30.0632", longitude:"31.2178" },
  { code:"RAU",  name:"الجيزة : الهرم",                       address:"8 شارع خاتم المرسلين",           latitude:"29.9862", longitude:"31.1571" },
  // Cairo
  { code:"RAD",  name:"القاهرة : وسط البلد - معروف",          address:"5 شارع معروف",                   latitude:"30.0444", longitude:"31.2357" },
  { code:"RAE",  name:"القاهرة : وسط البلد - التوفيقية",      address:"16 شارع ذكي التوفيقية",          latitude:"30.0502", longitude:"31.2453" },
  { code:"RAJ",  name:"القاهرة : شبرا - أغاخان",              address:"أبراج أغاخان",                   latitude:"30.0869", longitude:"31.2461" },
  { code:"RAL",  name:"القاهرة : حدائق القبة",                address:"460 شارع ابراهيم سويدان",        latitude:"30.0942", longitude:"31.2891" },
  { code:"RAA2", name:"القاهرة : عين شمس",                    address:"13 ش عين شمس",                   latitude:"30.1219", longitude:"31.3194" },
  { code:"RAP",  name:"القاهرة : المطرية",                    address:"شارع الكابلات الرئيسي",           latitude:"30.1214", longitude:"31.3085" },
  { code:"RAQ",  name:"القاهرة : العباسية",                   address:"7 ش عبد الحمولى",                latitude:"30.0686", longitude:"31.2794" },
  { code:"RAH",  name:"القاهرة : حلوان",                      address:"1 ش ذو الفقار",                  latitude:"29.8440", longitude:"31.3342" },
  { code:"RAW",  name:"القاهرة : مدينة نصر - محمد مهدي",     address:"16 شارع محمد مهدي",              latitude:"30.0594", longitude:"31.3293" },
  { code:"RAV",  name:"القاهرة : مصر الجديدة",                address:"49 ش دمشق",                      latitude:"30.0872", longitude:"31.3299" },
  { code:"RAR",  name:"القاهرة : الرحاب",                     address:"محل 208 السوق القديم",           latitude:"30.0573", longitude:"31.4901" },
  { code:"RAZ",  name:"القاهرة : الزيتون",                    address:"مبنى 2 اسكان ضباط الشرطة",      latitude:"30.0978", longitude:"31.3018" },
  { code:"RAK",  name:"القاهرة : الحرفيين",                   address:"4 ش يوسف صبري ابو طالب",        latitude:"30.0543", longitude:"31.2584" },
  { code:"RSG",  name:"القاهرة : جسر السويس",                 address:"شيل أوت - حديقة بدر",           latitude:"30.1025", longitude:"31.3614" },
  { code:"RAK2", name:"القاهرة : المعادي - ابراج الامل",      address:"طريق الاوتوستراد - ابراج الامل", latitude:"29.9602", longitude:"31.2731" },
  { code:"RAK3", name:"القاهرة : المعادي - شيل اوت",          address:"محطة شيل اوت الاوتوستراد",      latitude:"29.9581", longitude:"31.2705" },
  { code:"RAI",  name:"القاهرة : مدينة نصر - الحي السادس",   address:"الحي السادس - شارع الخليفة الظافر", latitude:"30.0652", longitude:"31.3401" },
  // Alexandria
  { code:"ALE1", name:"الاسكندرية : رشدي",                    address:"406 مصطفي كامل",                 latitude:"31.2372", longitude:"29.9553" },
  { code:"ALE2", name:"الاسكندرية : المندرة",                 address:"شارع النبوي المهندس",            latitude:"31.2812", longitude:"29.9423" },
  { code:"ALE3", name:"الاسكندرية : العجمي",                  address:"1 شارع الشيخ احمد ياسين",       latitude:"30.9768", longitude:"29.5521" },
  { code:"ALE4", name:"الاسكندرية : العامرية",                address:"شيل اوت - أمام المرور",          latitude:"30.8421", longitude:"29.7752" },
  { code:"ALE5", name:"الاسكندرية : السيوف",                  address:"2 برج الماسة",                   latitude:"31.2142", longitude:"29.9867" },
  // Delta
  { code:"RBZ",  name:"الشرقية : الزقازيق",                   address:"طريق الزراعة التجنيد",           latitude:"30.5877", longitude:"31.5022" },
  { code:"RAM",  name:"الدقهليه : المنصوره 1",                address:"20 برج الحكمه",                  latitude:"31.0364", longitude:"31.3807" },
  { code:"RAN",  name:"الدقهلية : المنصورة 2",                address:"شارع عبد السلام عارف",           latitude:"31.0421", longitude:"31.3751" },
  { code:"RBM",  name:"الغربية : المحلة",                     address:"22 شارع عبد الباسط البشبيشي",   latitude:"30.9722", longitude:"31.1665" },
  { code:"RAN2", name:"الغربية : طنطا",                       address:"78 شارع حسن رضوان",              latitude:"30.7865", longitude:"31.0004" },
  { code:"RBB",  name:"البحيرة : دمنهور",                     address:"عمارة 1 شارع الجيش",            latitude:"31.0342", longitude:"30.4681" },
  { code:"RBF",  name:"كفر الشيخ",                            address:"11 شارع عبد الحكم",              latitude:"31.1107", longitude:"30.9388" },
  { code:"RBS",  name:"الاسماعيلية : حي السلام",              address:"برج طيبة",                       latitude:"30.5965", longitude:"32.2715" },
  { code:"RBT",  name:"دمياط",                                address:"دمياط القديمة - شارع الجلاء",   latitude:"31.4165", longitude:"31.8133" },
  { code:"RBO",  name:"الفيوم : السد العالي",                 address:"المنطقة الصناعية كيمان",         latitude:"29.3084", longitude:"30.8428" },
  { code:"RBG",  name:"المنوفية : شبين الكوم",                address:"113 امتداد شارع طلعت حرب",      latitude:"30.5586", longitude:"30.9692" },
];

const DEFAULT_PASSWORD = "Autoparts@2024";

const MANAGERS = [
  { username:"nader.moris",           name:"نادر موريس",          email:"nader.moris@autoparts.com",          branchCodes:["ALE1","ALE2","ALE3","ALE4","ALE5"] },
  { username:"shenoda.magdy",         name:"شنوده مجدي",          email:"shenoda.magdy@autoparts.com",        branchCodes:["RBZ","RAM","RAN","RBM","RAN2","RBB","RBF","RBS","RBT"] },
  { username:"mina.mohsen",           name:"مينا محسن",           email:"mina.mohsen@autoparts.com",          branchCodes:["RAO","RSW","RAG","RAT","RAC","RAF","RAY","RAB","RAA","RAU","RAD","RAE","RAJ","RAL","RAA2","RAP","RAQ","RAH","RAW","RAV","RAR","RAZ","RAK","RSG","RAK2","RAK3","RAI"] },
  { username:"ahmed.khaled",          name:"احمد خالد",           email:"ahmed.khaled@autoparts.com",         branchCodes:["RAO","RSW","RAG","RAT","RAC","RAF","RAY","RAB","RAA","RAU"] },
  { username:"mohamed.abdelstar",     name:"محمد عبدالستار",      email:"mohamed.abdelstar@autoparts.com",    branchCodes:["RAO","RSW","RAG","RAT","RAC","RAF","RAY","RAB","RAA","RAU"] },
  { username:"abdelrahman.aghakhan",  name:"عبدالرحمن اغاخان",    email:"abdelrahman.aghakhan@autoparts.com", branchCodes:["RAD","RAE","RAJ","RAL","RAA2","RAP","RAQ","RAH","RAW","RAV","RAR","RAZ","RAK","RSG","RAK2","RAK3","RAI"] },
];

function parseUrl(url) {
  const u = new URL(url);
  return { host:u.hostname, port:Number(u.port), user:u.username, password:u.password, database:u.pathname.slice(1) };
}

async function seed() {
  console.log("🔌 جاري الاتصال...");
  const conn = await mysql.createConnection(parseUrl(DATABASE_URL));
  console.log("✅ اتصلنا\n");

  // ── Admin ─────────────────────────────────────────────────────────────────
  console.log("👤 إنشاء Admin...");
  const adminHash = await bcrypt.hash("Admin@Autoparts2024", 10);
  await conn.query(`
    INSERT INTO users (username, passwordHash, name, email, role, createdAt, updatedAt, lastSignedIn)
    VALUES (?, ?, ?, ?, 'admin', NOW(), NOW(), NOW())
    ON DUPLICATE KEY UPDATE name=VALUES(name), updatedAt=NOW()
  `, ["admin", adminHash, "مدير النظام", "admin@autoparts.com"]);
  console.log("  ✅ admin / Admin@Autoparts2024\n");

  // ── Branches ──────────────────────────────────────────────────────────────
  console.log(`🏪 إضافة ${BRANCHES.length} فرع...`);
  const branchIdMap = {};
  for (const b of BRANCHES) {
    await conn.query(`
      INSERT INTO branches (name, code, address, latitude, longitude, geofenceRadiusMeters, isActive, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, 200, 'yes', NOW(), NOW())
      ON DUPLICATE KEY UPDATE name=VALUES(name), address=VALUES(address), updatedAt=NOW()
    `, [b.name, b.code, b.address, b.latitude, b.longitude]);

    const [rows] = await conn.query("SELECT id FROM branches WHERE code=?", [b.code]);
    branchIdMap[b.code] = rows[0]?.id;
    console.log(`  ✅ ${b.code} — ${b.name}`);
  }

  // ── Managers ──────────────────────────────────────────────────────────────
  console.log(`\n👥 إضافة ${MANAGERS.length} مدير...`);
  const managerHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  for (const m of MANAGERS) {
    // أضف user بـ role=user
    await conn.query(`
      INSERT INTO users (username, passwordHash, name, email, role, createdAt, updatedAt, lastSignedIn)
      VALUES (?, ?, ?, ?, 'user', NOW(), NOW(), NOW())
      ON DUPLICATE KEY UPDATE name=VALUES(name), updatedAt=NOW()
    `, [m.username, managerHash, m.name, m.email]);

    const [userRows] = await conn.query("SELECT id FROM users WHERE username=?", [m.username]);
    const userId = userRows[0]?.id;

    // أضف في جدول managers
    await conn.query(`
      INSERT INTO managers (userId, isActive, createdAt, updatedAt)
      VALUES (?, 'yes', NOW(), NOW())
      ON DUPLICATE KEY UPDATE updatedAt=NOW()
    `, [userId]);

    const [mgrRows] = await conn.query("SELECT id FROM managers WHERE userId=?", [userId]);
    const managerId = mgrRows[0]?.id;

    // امسح القديم وأضف الجديد
    await conn.query("DELETE FROM managerBranches WHERE managerId=?", [managerId]);

    let assigned = 0;
    for (const code of m.branchCodes) {
      const branchId = branchIdMap[code];
      if (branchId) {
        await conn.query(`
          INSERT INTO managerBranches (managerId, branchId, createdAt)
          VALUES (?, ?, NOW())
        `, [managerId, branchId]);
        assigned++;
      }
    }
    console.log(`  ✅ ${m.name} (${m.username}) — ${assigned} فرع`);
  }

  await conn.end();

  console.log(`
╔══════════════════════════════════════════════════╗
║          ✅ تم إعداد الداتا بنجاح!              ║
╠══════════════════════════════════════════════════╣
║  الأدمن:                                         ║
║    username: admin                               ║
║    password: Admin@Autoparts2024                 ║
╠══════════════════════════════════════════════════╣
║  المديرين — كلمة المرور الافتراضية:              ║
║    Autoparts@2024                                ║
╚══════════════════════════════════════════════════╝
  `);
}

seed().catch((err) => {
  console.error("❌ خطأ:", err.message);
  process.exit(1);
});

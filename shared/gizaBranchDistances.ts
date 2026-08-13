/**
 * مسافات الفروع المعتمدة — مستخرجة من شيت Kilomter Attendance
 *
 * المفتاح: "كود الفرع From -> كود الفرع To"
 * القيمة: المسافة بالكيلومتر
 *
 * المسافات دي يدوية ومعتمدة من الشيت الرسمي.
 * القاهرة: هتتضاف لاحقاً.
 */

// ── خريطة: اسم الفرع في الـ DB  → كود قصير نستخدمه في جدول المسافات ──────────
// الأسماء دي هي بالظبط اللي في جدول branches في قاعدة البيانات
const BRANCH_NAME_TO_CODE: Record<string, string> = {
  // الجيزة
  "الجيزة : الشيخ زايد":             "RAC",   // Chill Out
  "الجيزة : الهرم":                   "RAU",   // Omrania / العمرانية
  "الجيزة : فيصل - مصرف اللبيني":    "RAY",   // Lebeeny فرع 1
  "الجيزة : فيصل - ابو المحاسن":     "RAF",   // Faisal فرع 2
  "الجيزة : العجوزة":                 "RAG",   // Agouza
  "الجيزة : المهندسين":               "RAO",   // Soudan / المهندسين سودان
  "الجيزة : اكتوبر - بنزينة وطنية":  "RSW",   // Wahat / أكتوبر
  "الجيزة : اكتوبر - طيبة جراند مول":"RAT",   // Tiba Mall
  "الجيزة : إمبابة":                  "RAB",   // Imbaba
  "الجيزة : المهندسين - اوتوبارتس ميجا ستور": "RAL", // Mega Store

  // القاهرة
  "القاهرة : وسط البلد - معروف":             "CAI-DT-MAAROUF",
  "القاهرة : وسط البلد - التوفيقية":         "CAI-DT-TAWFIQIA",
  "القاهرة : شبرا":                           "CAI-SHUBRA",
  "القاهرة : حدائق القبة":                   "CAI-HADAIQ",
  "القاهرة : عين شمس":                       "CAI-AINSHAMS",
  "القاهرة : المطرية":                        "CAI-MATARIA",
  "القاهرة : العباسية":                       "CAI-ABBASIYA",
  "القاهرة : حلوان":                          "CAI-HELWAN",
  "القاهرة : مدينة نصر - محمد مهدي":         "CAI-NASR-1",
  "القاهرة : مدينة نصر - الخليفة الظافر":    "CAI-NASR-2",
  "القاهرة : مصر الجديدة":                   "CAI-HELIOPOLIS",
  "القاهرة : الرحاب":                         "CAI-REHAB",
  "القاهرة : الزيتون":                        "CAI-ZEITOUN",
  "القاهرة : الحرفيين":                       "CAI-HARFEYEEN",
  "القاهرة : جسر السويس":                     "CAI-GESR",
  "القاهرة : المعادي - الاوتوستراد":          "CAI-MAADI-1",
  "القاهرة : المعادي - شيل اوت":             "CAI-MAADI-2",
};

// ── جدول المسافات بالكود (كم) ─────────────────────────────────────────────────
// الجيزة — مكتمل
const DISTANCES_BY_CODE: Record<string, number> = {
  // من الشيخ زايد (RAC)
  "RAC->RAU": 32,  "RAC->RAY": 18,  "RAC->RAF": 23,
  "RAC->RAG": 24,  "RAC->RAO": 26,  "RAC->RSW": 22,
  "RAC->RAT": 24,  "RAC->RAB": 32,  "RAC->RSL": 35,

  // من العمرانية / الهرم (RAU)
  "RAU->RAC": 32,  "RAU->RSL": 18,  "RAU->RAY": 9,
  "RAU->RAF": 7,   "RAU->RAG": 7.5, "RAU->RAO": 14,
  "RAU->RSW": 28,  "RAU->RAT": 45,  "RAU->RAB": 16,

  // من فيصل مصرف اللبيني (RAY)
  "RAY->RAU": 9,   "RAY->RSL": 18,  "RAY->RAF": 4,
  "RAY->RAG": 19,  "RAY->RAO": 16,  "RAY->RSW": 18,
  "RAY->RAT": 41,  "RAY->RAB": 19,  "RAY->RAC": 18,

  // من فيصل أبو المحاسن (RAF)
  "RAF->RAU": 7,   "RAF->RAY": 4,   "RAF->RAG": 13,
  "RAF->RAO": 14,  "RAF->RSW": 21,  "RAF->RAT": 42,
  "RAF->RAB": 19,  "RAF->RAC": 23,  "RAF->RSL": 23,

  // من العجوزة (RAG)
  "RAG->RAU": 7.5, "RAG->RAY": 19,  "RAG->RAF": 13,
  "RAG->RAO": 6,   "RAG->RSW": 30,  "RAG->RAT": 46,
  "RAG->RAB": 8,   "RAG->RAC": 24,  "RAG->RSL": 7,

  // من المهندسين / سودان (RAO)
  "RAO->RAU": 14,  "RAO->RAY": 16,  "RAO->RAF": 14,
  "RAO->RAG": 6,   "RAO->RSW": 32,  "RAO->RAT": 42,
  "RAO->RAB": 6,   "RAO->RAC": 26,  "RAO->RSL": 5,

  // من أكتوبر وطنية / الواحات (RSW)
  "RSW->RAU": 28,  "RSW->RAY": 18,  "RSW->RAF": 21,
  "RSW->RAG": 29,  "RSW->RAO": 32,  "RSW->RAT": 24,
  "RSW->RAB": 36,  "RSW->RAC": 22,  "RSW->RSL": 35,

  // من طيبة جراند مول (RAT)
  "RAT->RAU": 45,  "RAT->RAY": 41,  "RAT->RAF": 42,
  "RAT->RAG": 46,  "RAT->RAO": 42,  "RAT->RSW": 24,
  "RAT->RAB": 42,  "RAT->RAC": 24,  "RAT->RSL": 46,

  // من إمبابة (RAB)
  "RAB->RAU": 16,  "RAB->RAY": 19,  "RAB->RAF": 19,
  "RAB->RAG": 8,   "RAB->RAO": 6,   "RAB->RSW": 36,
  "RAB->RAT": 42,  "RAB->RAC": 32,  "RAB->RSL": 9,

  // من المهندسين - أوتوبارتس ميجا ستور (RAL) — نفس منطقة المهندسين/سودان
  // المسافات مقاسة من نفس النقطة تقريباً لأن RAO و RAL في نفس الشارع
  "RAL->RAU": 14,  "RAL->RAY": 16,  "RAL->RAF": 14,
  "RAL->RAG": 6,   "RAL->RSW": 32,  "RAL->RAT": 42,
  "RAL->RAB": 6,   "RAL->RAC": 26,  "RAL->RSL": 5,
  "RAL->RAO": 1,   "RAL->RAW": 41,  "RAL->RAS": 9,
  "RAL->RAH": 48,  "RAL->RAK": 17,  "RAL->RBK": 16,

  // إليه (من الفروع التانية)
  "RAU->RAL": 14,  "RAY->RAL": 16,  "RAF->RAL": 14,
  "RAG->RAL": 6,   "RSW->RAL": 32,  "RAT->RAL": 42,
  "RAB->RAL": 6,   "RAC->RAL": 26,  "RSL->RAL": 5,
  "RAO->RAL": 1,   "RAW->RAL": 41,  "RAS->RAL": 9,
  "RAH->RAL": 48,  "RAK->RAL": 17,  "RBK->RAL": 16,

  // من أرض اللواء / RSL (Ard El Lewa — كود قديم في الشيت)
  "RSL->RAU": 18,  "RSL->RAY": 18,  "RSL->RAF": 23,
  "RSL->RAG": 7,   "RSL->RAO": 5,   "RSL->RSW": 35,
  "RSL->RAT": 46,  "RSL->RAB": 9,   "RSL->RAC": 35,

  // من مدينة نصر - الحي العاشر (RAW)
  "RAW->RAU": 28,  "RAW->RAY": 33,  "RAW->RAF": 39,
  "RAW->RAG": 26,  "RAW->RSW": 46,  "RAW->RAT": 64,
  "RAW->RAB": 27,  "RAW->RAC": 46,  "RAW->RSL": 37,
  "RAW->RAO": 41,  "RAW->RAI": 8,   "RAW->RAS": 16,
  "RAW->RAH": 41,  "RAW->RAD": 19,  "RAW->RAK": 17,
  "RAW->RBK": 19,

  // من مدينة نصر - الحي السادس (RAI)
  "RAI->RAW": 8,   "RAI->RSL": 26,  "RAI->RAT": 69,

  // من المعادي شيل أوت (RBK)
  "RBK->RAU": 12,  "RBK->RAY": 17,  "RBK->RAF": 19,
  "RBK->RAG": 16,  "RBK->RSW": 32,  "RBK->RAB": 23,
  "RBK->RAW": 19,

  // من جسر السويس / أحمد سعيد (RAS)
  "RAS->RAU": 14,  "RAS->RAF": 19,  "RAS->RAB": 9,
  "RAS->RAT": 54,  "RAS->RAW": 16,

  // من حلوان (RAH)
  "RAH->RAU": 48,  "RAH->RAY": 43,  "RAH->RAF": 41,
  "RAH->RAG": 32,  "RAH->RAO": 48,  "RAH->RSW": 45,
  "RAH->RAB": 46,  "RAH->RSL": 51,  "RAH->RAT": 53,
  "RAH->RAW": 41,

  // من معروف / وسط البلد (RAD — Marouf)
  "RAD->RAW": 19,

  // من مدينة نصر المعادي صقر قريش (RAK)
  // القاهرة
  "CAI-DT-MAAROUF->CAI-DT-TAWFIQIA": 0.6,  "CAI-DT-TAWFIQIA->CAI-DT-MAAROUF": 0.6,
  "CAI-DT-MAAROUF->CAI-SHUBRA": 8.7,  "CAI-SHUBRA->CAI-DT-MAAROUF": 8.7,
  "CAI-DT-MAAROUF->CAI-HADAIQ": 11.2,  "CAI-HADAIQ->CAI-DT-MAAROUF": 11.2,
  "CAI-DT-MAAROUF->CAI-AINSHAMS": 18.0,  "CAI-AINSHAMS->CAI-DT-MAAROUF": 18.0,
  "CAI-DT-MAAROUF->CAI-MATARIA": 15.1,  "CAI-MATARIA->CAI-DT-MAAROUF": 15.1,
  "CAI-DT-MAAROUF->CAI-ABBASIYA": 8.4,  "CAI-ABBASIYA->CAI-DT-MAAROUF": 8.4,
  "CAI-DT-MAAROUF->CAI-HELWAN": 28.5,  "CAI-HELWAN->CAI-DT-MAAROUF": 28.5,
  "CAI-DT-MAAROUF->CAI-NASR-1": 15.8,  "CAI-NASR-1->CAI-DT-MAAROUF": 15.8,
  "CAI-DT-MAAROUF->CAI-NASR-2": 13.1,  "CAI-NASR-2->CAI-DT-MAAROUF": 13.1,
  "CAI-DT-MAAROUF->CAI-HELIOPOLIS": 13.6,  "CAI-HELIOPOLIS->CAI-DT-MAAROUF": 13.6,
  "CAI-DT-MAAROUF->CAI-REHAB": 32.5,  "CAI-REHAB->CAI-DT-MAAROUF": 32.5,
  "CAI-DT-MAAROUF->CAI-ZEITOUN": 11.1,  "CAI-ZEITOUN->CAI-DT-MAAROUF": 11.1,
  "CAI-DT-MAAROUF->CAI-HARFEYEEN": 18.5,  "CAI-HARFEYEEN->CAI-DT-MAAROUF": 18.5,
  "CAI-DT-MAAROUF->CAI-GESR": 18.8,  "CAI-GESR->CAI-DT-MAAROUF": 18.8,
  "CAI-DT-MAAROUF->CAI-MAADI-1": 11.7,  "CAI-MAADI-1->CAI-DT-MAAROUF": 11.7,
  "CAI-DT-MAAROUF->CAI-MAADI-2": 12.0,  "CAI-MAADI-2->CAI-DT-MAAROUF": 12.0,
  "CAI-DT-TAWFIQIA->CAI-SHUBRA": 8.1,  "CAI-SHUBRA->CAI-DT-TAWFIQIA": 8.1,
  "CAI-DT-TAWFIQIA->CAI-HADAIQ": 10.7,  "CAI-HADAIQ->CAI-DT-TAWFIQIA": 10.7,
  "CAI-DT-TAWFIQIA->CAI-AINSHAMS": 17.5,  "CAI-AINSHAMS->CAI-DT-TAWFIQIA": 17.5,
  "CAI-DT-TAWFIQIA->CAI-MATARIA": 14.6,  "CAI-MATARIA->CAI-DT-TAWFIQIA": 14.6,
  "CAI-DT-TAWFIQIA->CAI-ABBASIYA": 7.9,  "CAI-ABBASIYA->CAI-DT-TAWFIQIA": 7.9,
  "CAI-DT-TAWFIQIA->CAI-HELWAN": 28.8,  "CAI-HELWAN->CAI-DT-TAWFIQIA": 28.8,
  "CAI-DT-TAWFIQIA->CAI-NASR-1": 15.3,  "CAI-NASR-1->CAI-DT-TAWFIQIA": 15.3,
  "CAI-DT-TAWFIQIA->CAI-NASR-2": 12.6,  "CAI-NASR-2->CAI-DT-TAWFIQIA": 12.6,
  "CAI-DT-TAWFIQIA->CAI-HELIOPOLIS": 13.1,  "CAI-HELIOPOLIS->CAI-DT-TAWFIQIA": 13.1,
  "CAI-DT-TAWFIQIA->CAI-REHAB": 32.0,  "CAI-REHAB->CAI-DT-TAWFIQIA": 32.0,
  "CAI-DT-TAWFIQIA->CAI-ZEITOUN": 10.6,  "CAI-ZEITOUN->CAI-DT-TAWFIQIA": 10.6,
  "CAI-DT-TAWFIQIA->CAI-HARFEYEEN": 18.0,  "CAI-HARFEYEEN->CAI-DT-TAWFIQIA": 18.0,
  "CAI-DT-TAWFIQIA->CAI-GESR": 18.3,  "CAI-GESR->CAI-DT-TAWFIQIA": 18.3,
  "CAI-DT-TAWFIQIA->CAI-MAADI-1": 12.1,  "CAI-MAADI-1->CAI-DT-TAWFIQIA": 12.1,
  "CAI-DT-TAWFIQIA->CAI-MAADI-2": 12.5,  "CAI-MAADI-2->CAI-DT-TAWFIQIA": 12.5,
  "CAI-SHUBRA->CAI-HADAIQ": 6.3,  "CAI-HADAIQ->CAI-SHUBRA": 6.3,
  "CAI-SHUBRA->CAI-AINSHAMS": 12.6,  "CAI-AINSHAMS->CAI-SHUBRA": 12.6,
  "CAI-SHUBRA->CAI-MATARIA": 9.7,  "CAI-MATARIA->CAI-SHUBRA": 9.7,
  "CAI-SHUBRA->CAI-ABBASIYA": 6.1,  "CAI-ABBASIYA->CAI-SHUBRA": 6.1,
  "CAI-SHUBRA->CAI-HELWAN": 35.5,  "CAI-HELWAN->CAI-SHUBRA": 35.5,
  "CAI-SHUBRA->CAI-NASR-1": 14.1,  "CAI-NASR-1->CAI-SHUBRA": 14.1,
  "CAI-SHUBRA->CAI-NASR-2": 12.6,  "CAI-NASR-2->CAI-SHUBRA": 12.6,
  "CAI-SHUBRA->CAI-HELIOPOLIS": 10.6,  "CAI-HELIOPOLIS->CAI-SHUBRA": 10.6,
  "CAI-SHUBRA->CAI-REHAB": 31.8,  "CAI-REHAB->CAI-SHUBRA": 31.8,
  "CAI-SHUBRA->CAI-ZEITOUN": 7.7,  "CAI-ZEITOUN->CAI-SHUBRA": 7.7,
  "CAI-SHUBRA->CAI-HARFEYEEN": 19.3,  "CAI-HARFEYEEN->CAI-SHUBRA": 19.3,
  "CAI-SHUBRA->CAI-GESR": 14.6,  "CAI-GESR->CAI-SHUBRA": 14.6,
  "CAI-SHUBRA->CAI-MAADI-1": 19.5,  "CAI-MAADI-1->CAI-SHUBRA": 19.5,
  "CAI-SHUBRA->CAI-MAADI-2": 20.2,  "CAI-MAADI-2->CAI-SHUBRA": 20.2,
  "CAI-HADAIQ->CAI-AINSHAMS": 7.3,  "CAI-AINSHAMS->CAI-HADAIQ": 7.3,
  "CAI-HADAIQ->CAI-MATARIA": 4.6,  "CAI-MATARIA->CAI-HADAIQ": 4.6,
  "CAI-HADAIQ->CAI-ABBASIYA": 3.6,  "CAI-ABBASIYA->CAI-HADAIQ": 3.6,
  "CAI-HADAIQ->CAI-HELWAN": 33.7,  "CAI-HELWAN->CAI-HADAIQ": 33.7,
  "CAI-HADAIQ->CAI-NASR-1": 9.0,  "CAI-NASR-1->CAI-HADAIQ": 9.0,
  "CAI-HADAIQ->CAI-NASR-2": 9.3,  "CAI-NASR-2->CAI-HADAIQ": 9.3,
  "CAI-HADAIQ->CAI-HELIOPOLIS": 6.3,  "CAI-HELIOPOLIS->CAI-HADAIQ": 6.3,
  "CAI-HADAIQ->CAI-REHAB": 27.2,  "CAI-REHAB->CAI-HADAIQ": 27.2,
  "CAI-HADAIQ->CAI-ZEITOUN": 3.4,  "CAI-ZEITOUN->CAI-HADAIQ": 3.4,
  "CAI-HADAIQ->CAI-HARFEYEEN": 15.6,  "CAI-HARFEYEEN->CAI-HADAIQ": 15.6,
  "CAI-HADAIQ->CAI-GESR": 9.9,  "CAI-GESR->CAI-HADAIQ": 9.9,
  "CAI-HADAIQ->CAI-MAADI-1": 16.9,  "CAI-MAADI-1->CAI-HADAIQ": 16.9,
  "CAI-HADAIQ->CAI-MAADI-2": 17.8,  "CAI-MAADI-2->CAI-HADAIQ": 17.8,
  "CAI-AINSHAMS->CAI-MATARIA": 2.5,  "CAI-MATARIA->CAI-AINSHAMS": 2.5,
  "CAI-AINSHAMS->CAI-ABBASIYA": 8.7,  "CAI-ABBASIYA->CAI-AINSHAMS": 8.7,
  "CAI-AINSHAMS->CAI-HELWAN": 36.1,  "CAI-HELWAN->CAI-AINSHAMS": 36.1,
  "CAI-AINSHAMS->CAI-NASR-1": 8.3,  "CAI-NASR-1->CAI-AINSHAMS": 8.3,
  "CAI-AINSHAMS->CAI-NASR-2": 10.3,  "CAI-NASR-2->CAI-AINSHAMS": 10.3,
  "CAI-AINSHAMS->CAI-HELIOPOLIS": 5.2,  "CAI-HELIOPOLIS->CAI-AINSHAMS": 5.2,
  "CAI-AINSHAMS->CAI-REHAB": 22.2,  "CAI-REHAB->CAI-AINSHAMS": 22.2,
  "CAI-AINSHAMS->CAI-ZEITOUN": 5.8,  "CAI-ZEITOUN->CAI-AINSHAMS": 5.8,
  "CAI-AINSHAMS->CAI-HARFEYEEN": 14.8,  "CAI-HARFEYEEN->CAI-AINSHAMS": 14.8,
  "CAI-AINSHAMS->CAI-GESR": 5.2,  "CAI-GESR->CAI-AINSHAMS": 5.2,
  "CAI-AINSHAMS->CAI-MAADI-1": 23.4,  "CAI-MAADI-1->CAI-AINSHAMS": 23.4,
  "CAI-AINSHAMS->CAI-MAADI-2": 24.5,  "CAI-MAADI-2->CAI-AINSHAMS": 24.5,
  "CAI-MATARIA->CAI-ABBASIYA": 7.4,  "CAI-ABBASIYA->CAI-MATARIA": 7.4,
  "CAI-MATARIA->CAI-HELWAN": 39.6,  "CAI-HELWAN->CAI-MATARIA": 39.6,
  "CAI-MATARIA->CAI-NASR-1": 8.7,  "CAI-NASR-1->CAI-MATARIA": 8.7,
  "CAI-MATARIA->CAI-NASR-2": 10.3,  "CAI-NASR-2->CAI-MATARIA": 10.3,
  "CAI-MATARIA->CAI-HELIOPOLIS": 5.5,  "CAI-HELIOPOLIS->CAI-MATARIA": 5.5,
  "CAI-MATARIA->CAI-REHAB": 24.1,  "CAI-REHAB->CAI-MATARIA": 24.1,
  "CAI-MATARIA->CAI-ZEITOUN": 4.4,  "CAI-ZEITOUN->CAI-MATARIA": 4.4,
  "CAI-MATARIA->CAI-HARFEYEEN": 15.4,  "CAI-HARFEYEEN->CAI-MATARIA": 15.4,
  "CAI-MATARIA->CAI-GESR": 6.6,  "CAI-GESR->CAI-MATARIA": 6.6,
  "CAI-MATARIA->CAI-MAADI-1": 22.4,  "CAI-MAADI-1->CAI-MATARIA": 22.4,
  "CAI-MATARIA->CAI-MAADI-2": 23.4,  "CAI-MAADI-2->CAI-MATARIA": 23.4,
  "CAI-ABBASIYA->CAI-HELWAN": 33.5,  "CAI-HELWAN->CAI-ABBASIYA": 33.5,
  "CAI-ABBASIYA->CAI-NASR-1": 7.2,  "CAI-NASR-1->CAI-ABBASIYA": 7.2,
  "CAI-ABBASIYA->CAI-NASR-2": 6.6,  "CAI-NASR-2->CAI-ABBASIYA": 6.6,
  "CAI-ABBASIYA->CAI-HELIOPOLIS": 5.5,  "CAI-HELIOPOLIS->CAI-ABBASIYA": 5.5,
  "CAI-ABBASIYA->CAI-REHAB": 25.9,  "CAI-REHAB->CAI-ABBASIYA": 25.9,
  "CAI-ABBASIYA->CAI-ZEITOUN": 3.4,  "CAI-ZEITOUN->CAI-ABBASIYA": 3.4,
  "CAI-ABBASIYA->CAI-HARFEYEEN": 13.6,  "CAI-HARFEYEEN->CAI-ABBASIYA": 13.6,
  "CAI-ABBASIYA->CAI-GESR": 9.8,  "CAI-GESR->CAI-ABBASIYA": 9.8,
  "CAI-ABBASIYA->CAI-MAADI-1": 15.6,  "CAI-MAADI-1->CAI-ABBASIYA": 15.6,
  "CAI-ABBASIYA->CAI-MAADI-2": 16.5,  "CAI-MAADI-2->CAI-ABBASIYA": 16.5,
  "CAI-HELWAN->CAI-NASR-1": 31.5,  "CAI-NASR-1->CAI-HELWAN": 31.5,
  "CAI-HELWAN->CAI-NASR-2": 29.4,  "CAI-NASR-2->CAI-HELWAN": 29.4,
  "CAI-HELWAN->CAI-HELIOPOLIS": 34.3,  "CAI-HELIOPOLIS->CAI-HELWAN": 34.3,
  "CAI-HELWAN->CAI-REHAB": 36.1,  "CAI-REHAB->CAI-HELWAN": 36.1,
  "CAI-HELWAN->CAI-ZEITOUN": 35.3,  "CAI-ZEITOUN->CAI-HELWAN": 35.3,
  "CAI-HELWAN->CAI-HARFEYEEN": 27.2,  "CAI-HARFEYEEN->CAI-HELWAN": 27.2,
  "CAI-HELWAN->CAI-GESR": 36.3,  "CAI-GESR->CAI-HELWAN": 36.3,
  "CAI-HELWAN->CAI-MAADI-1": 18.4,  "CAI-MAADI-1->CAI-HELWAN": 18.4,
  "CAI-HELWAN->CAI-MAADI-2": 18.0,  "CAI-MAADI-2->CAI-HELWAN": 18.0,
  "CAI-NASR-1->CAI-NASR-2": 2.6,  "CAI-NASR-2->CAI-NASR-1": 2.6,
  "CAI-NASR-1->CAI-HELIOPOLIS": 3.2,  "CAI-HELIOPOLIS->CAI-NASR-1": 3.2,
  "CAI-NASR-1->CAI-REHAB": 18.8,  "CAI-REHAB->CAI-NASR-1": 18.8,
  "CAI-NASR-1->CAI-ZEITOUN": 5.7,  "CAI-ZEITOUN->CAI-NASR-1": 5.7,
  "CAI-NASR-1->CAI-HARFEYEEN": 7.0,  "CAI-HARFEYEEN->CAI-NASR-1": 7.0,
  "CAI-NASR-1->CAI-GESR": 5.1,  "CAI-GESR->CAI-NASR-1": 5.1,
  "CAI-NASR-1->CAI-MAADI-1": 15.8,  "CAI-MAADI-1->CAI-NASR-1": 15.8,
  "CAI-NASR-1->CAI-MAADI-2": 17.0,  "CAI-MAADI-2->CAI-NASR-1": 17.0,
  "CAI-NASR-2->CAI-HELIOPOLIS": 4.9,  "CAI-HELIOPOLIS->CAI-NASR-2": 4.9,
  "CAI-NASR-2->CAI-REHAB": 20.3,  "CAI-REHAB->CAI-NASR-2": 20.3,
  "CAI-NASR-2->CAI-ZEITOUN": 6.5,  "CAI-ZEITOUN->CAI-NASR-2": 6.5,
  "CAI-NASR-2->CAI-HARFEYEEN": 7.1,  "CAI-HARFEYEEN->CAI-NASR-2": 7.1,
  "CAI-NASR-2->CAI-GESR": 7.8,  "CAI-GESR->CAI-NASR-2": 7.8,
  "CAI-NASR-2->CAI-MAADI-1": 13.1,  "CAI-MAADI-1->CAI-NASR-2": 13.1,
  "CAI-NASR-2->CAI-MAADI-2": 14.4,  "CAI-MAADI-2->CAI-NASR-2": 14.4,
  "CAI-HELIOPOLIS->CAI-REHAB": 20.8,  "CAI-REHAB->CAI-HELIOPOLIS": 20.8,
  "CAI-HELIOPOLIS->CAI-ZEITOUN": 2.9,  "CAI-ZEITOUN->CAI-HELIOPOLIS": 2.9,
  "CAI-HELIOPOLIS->CAI-HARFEYEEN": 10.1,  "CAI-HARFEYEEN->CAI-HELIOPOLIS": 10.1,
  "CAI-HELIOPOLIS->CAI-GESR": 4.3,  "CAI-GESR->CAI-HELIOPOLIS": 4.3,
  "CAI-HELIOPOLIS->CAI-MAADI-1": 17.7,  "CAI-MAADI-1->CAI-HELIOPOLIS": 17.7,
  "CAI-HELIOPOLIS->CAI-MAADI-2": 18.9,  "CAI-MAADI-2->CAI-HELIOPOLIS": 18.9,
  "CAI-REHAB->CAI-ZEITOUN": 23.6,  "CAI-ZEITOUN->CAI-REHAB": 23.6,
  "CAI-REHAB->CAI-HARFEYEEN": 14.3,  "CAI-HARFEYEEN->CAI-REHAB": 14.3,
  "CAI-REHAB->CAI-GESR": 17.5,  "CAI-GESR->CAI-REHAB": 17.5,
  "CAI-REHAB->CAI-MAADI-1": 28.8,  "CAI-MAADI-1->CAI-REHAB": 28.8,
  "CAI-REHAB->CAI-MAADI-2": 30.2,  "CAI-MAADI-2->CAI-REHAB": 30.2,
  "CAI-ZEITOUN->CAI-HARFEYEEN": 12.7,  "CAI-HARFEYEEN->CAI-ZEITOUN": 12.7,
  "CAI-ZEITOUN->CAI-GESR": 6.7,  "CAI-GESR->CAI-ZEITOUN": 6.7,
  "CAI-ZEITOUN->CAI-MAADI-1": 18.0,  "CAI-MAADI-1->CAI-ZEITOUN": 18.0,
  "CAI-ZEITOUN->CAI-MAADI-2": 19.0,  "CAI-MAADI-2->CAI-ZEITOUN": 19.0,
  "CAI-HARFEYEEN->CAI-GESR": 9.9,  "CAI-GESR->CAI-HARFEYEEN": 9.9,
  "CAI-HARFEYEEN->CAI-MAADI-1": 15.1,  "CAI-MAADI-1->CAI-HARFEYEEN": 15.1,
  "CAI-HARFEYEEN->CAI-MAADI-2": 16.5,  "CAI-MAADI-2->CAI-HARFEYEEN": 16.5,
  "CAI-GESR->CAI-MAADI-1": 20.9,  "CAI-MAADI-1->CAI-GESR": 20.9,
  "CAI-GESR->CAI-MAADI-2": 22.2,  "CAI-MAADI-2->CAI-GESR": 22.2,
  "CAI-MAADI-1->CAI-MAADI-2": 1.4,  "CAI-MAADI-2->CAI-MAADI-1": 1.4,
};

// ── الدالة الرئيسية ────────────────────────────────────────────────────────────
/**
 * بيجيب المسافة (كم) بين فرعين باستخدام الاسم الكامل في قاعدة البيانات.
 * بيعمل بحث مباشر عن طريق الكود، وبعدين fuzzy match على الاسم لو الكود مش موجود.
 * بيرجع null لو المسافة مش محددة.
 */
export function getBranchDistance(fromBranchName: string, toBranchName: string): number | null {
  const fromCode = BRANCH_NAME_TO_CODE[fromBranchName.trim()];
  const toCode   = BRANCH_NAME_TO_CODE[toBranchName.trim()];

  // ١. بحث مباشر بالكود
  if (fromCode && toCode) {
    const key = `${fromCode}->${toCode}`;
    if (DISTANCES_BY_CODE[key] !== undefined) return DISTANCES_BY_CODE[key];
  }

  // ٢. Fuzzy fallback — لو الاسم مش مطابق تماماً (اختلاف في مسافة/حرف)
  const fromNorm = fromBranchName.trim().toLowerCase();
  const toNorm   = toBranchName.trim().toLowerCase();

  let bestFromCode: string | null = null;
  let bestToCode:   string | null = null;

  for (const [name, code] of Object.entries(BRANCH_NAME_TO_CODE)) {
    const norm = name.toLowerCase();
    if (!bestFromCode && (norm.includes(fromNorm) || fromNorm.includes(norm))) bestFromCode = code;
    if (!bestToCode   && (norm.includes(toNorm)   || toNorm.includes(norm)))   bestToCode   = code;
    if (bestFromCode && bestToCode) break;
  }

  if (bestFromCode && bestToCode) {
    const key = `${bestFromCode}->${bestToCode}`;
    if (DISTANCES_BY_CODE[key] !== undefined) return DISTANCES_BY_CODE[key];
  }

  return null;
}

// ── تصدير الاسم القديم للتوافق مع الكود اللي شغال ───────────────────────────
/** @deprecated استخدم getBranchDistance */
export function getGizaDistance(fromBranchName: string, toBranchName: string): number | null {
  return getBranchDistance(fromBranchName, toBranchName);
}

// ── دوال مساعدة للأدمن ────────────────────────────────────────────────────────
/** بيرجع list بأسماء كل الفروع اللي عندها مسافات معروفة */
export function getBranchesWithKnownDistances(): string[] {
  return Object.keys(BRANCH_NAME_TO_CODE);
}

/** بيرجع true لو الفرعين عندهم مسافة معروفة بينهم */
export function hasKnownDistance(fromBranchName: string, toBranchName: string): boolean {
  return getBranchDistance(fromBranchName, toBranchName) !== null;
}

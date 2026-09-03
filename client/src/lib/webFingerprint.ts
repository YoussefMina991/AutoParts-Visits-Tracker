/**
 * webFingerprint.ts — Browser Fingerprint Generator
 *
 * بيولد "بصمة" فريدة للمتصفح/الجهاز من مزيج من المعطيات:
 * - Canvas fingerprint (طريقة الرسم — فريدة لكل جهاز+متصفح)
 * - Screen resolution + color depth
 * - Timezone + language
 * - User Agent
 *
 * النتيجة: hash مستقر نسبياً على نفس المتصفح/الجهاز.
 * لو المدير فتح المتصفح على موبايل شخص تاني → fingerprint مختلف → السيرفر يرفض.
 *
 * ملاحظة: الـ fingerprint بيتغير لو:
 *   - المدير مسح كل بيانات المتصفح (تسجيل خروج + ربط جديد)
 *   - غيّر الموبايل نفسه (الأدمن يفك الربط)
 *   - فتح Incognito (canvas behavior يتغير في بعض المتصفحات)
 */

const STORAGE_KEY = "branch_tracker_web_fp";

/**
 * يولد canvas fingerprint بسيط — أسرع وأخف من مكتبات كاملة.
 * بيرسم نص ومستطيل وبيستخرج الـ pixel data كـ string.
 */
function getCanvasFingerprint(): string {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 200;
    canvas.height = 40;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "no-canvas";

    // رسم نص بخصائص محددة — الطريقة تختلف بين الأجهزة
    ctx.textBaseline = "top";
    ctx.font = "14px 'Arial'";
    ctx.fillStyle = "#f60";
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = "#069";
    ctx.fillText("Branch Tracker FP", 2, 15);
    ctx.fillStyle = "rgba(102, 204, 0, 0.7)";
    ctx.fillText("Branch Tracker FP", 4, 17);

    return canvas.toDataURL().slice(-50); // آخر 50 حرف كافية للتمييز
  } catch {
    return "canvas-blocked";
  }
}

/**
 * يولد SHA-256 hash من string.
 * بنستخدم Web Crypto API المدمجة — مش محتاجين مكتبات.
 */
async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * يولد الـ fingerprint الكامل ويرجعه كـ hex string.
 * stable على نفس الجهاز ومتصفح — مختلف على أي جهاز تاني.
 */
export async function generateWebFingerprint(): Promise<string> {
  const components = [
    navigator.userAgent,
    navigator.language,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    `${screen.width}x${screen.height}x${screen.colorDepth}`,
    getCanvasFingerprint(),
    // Platform hint — بيميّز آيفون عن أندرويد
    (navigator as any).userAgentData?.platform ?? navigator.platform ?? "unknown",
  ];

  const raw = components.join("|");
  const hash = await sha256(raw);
  return hash; // 64 hex char
}

/**
 * يجيب الـ fingerprint المحفوظ محلياً.
 * لو مش موجود → يولد واحد جديد ويحفظه.
 */
export async function getOrCreateFingerprint(): Promise<string> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && stored.length >= 16) {
      return stored;
    }
  } catch {
    // localStorage ممكن يكون disabled في بعض الأوضاع
  }

  const fp = await generateWebFingerprint();
  try {
    localStorage.setItem(STORAGE_KEY, fp);
  } catch {
    // silent — هيتولد من جديد المرة الجاية
  }
  return fp;
}

/**
 * يحذف الـ fingerprint المحفوظ.
 * يُستخدم عند تسجيل الخروج.
 */
export function clearStoredFingerprint(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // silent
  }
}

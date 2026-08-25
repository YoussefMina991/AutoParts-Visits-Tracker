/**
 * ضغط الصور في المتصفح قبل إرسالها كـ base64
 * ─────────────────────────────────────────────────────────
 * بدل ما نبعت صورة 5 ميجا خام (بتتاكل من الـ network والسيرفر)،
 * بنرسمها على canvas بمقاس أصغر ونصدّرها JPEG بجودة معقولة.
 * النتيجة النموذجية: صورة 3-5MB → 100-300KB.
 */

export interface CompressedImage {
  base64: string; // data URL جاهزة للإرسال
  extension: string;
}

const MAX_DIMENSION = 1024;
const JPEG_QUALITY = 0.75;

export async function compressImageFile(file: File): Promise<CompressedImage> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (ev) => resolve(ev.target?.result as string);
    reader.onerror = () => reject(new Error("فشل قراءة الملف"));
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("ملف الصورة غير صالح"));
    image.src = dataUrl;
  });

  // لو الصورة أصغر من الحد الأصلاً → ابعتها زي ما هي
  if (img.width <= MAX_DIMENSION && img.height <= MAX_DIMENSION && file.size < 400_000) {
    return { base64: dataUrl, extension: file.name.split(".").pop()?.toLowerCase() || "jpg" };
  }

  const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
  const width = Math.round(img.width * scale);
  const height = Math.round(img.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  ctx.drawImage(img, 0, 0, width, height);

  const compressedBase64 = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
  return { base64: compressedBase64, extension: "jpg" };
}

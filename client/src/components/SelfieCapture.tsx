import { useRef, useState, useCallback } from "react";
import { Loader2 } from "lucide-react";

interface SelfieCaptureProps {
  onCapture: (base64: string) => void;
  onCancel: () => void;
}

/**
 * SelfieCapture — كومبوننت التقاط صورة الوجه عند تسجيل الدخول للفرع
 *
 * يفتح الكاميرا الامامية مباشرة، يعطي المدير عد تنازلي 3 ثواني،
 * ثم يلتقط الصورة تلقائياً او بضغطة زر.
 *
 * الصورة بترجع كـ base64 JPEG لتتبعت مع طلب check-in.
 *
 * مهم للامان: لو المدير بعت credentials لحد تاني،
 * الصورة ستكشف ان الشخص اللي سجل مش هو.
 */
export default function SelfieCapture({ onCapture, onCancel }: SelfieCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);

  // تشغيل الكاميرا عند mount الكومبوننت
  const startCamera = useCallback(async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user", // الكاميرا الامامية
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => setIsReady(true);
      }
    } catch (err) {
      console.error("[SelfieCapture] Camera error:", err);
      setError("تعذر فتح الكاميرا — تاكد من السماح للمتصفح بالوصول للكاميرا");
    }
  }, []);

  // المرجع للدالة عشان نشغلها مرة واحدة بس عند mount
  const startedRef = useRef(false);
  if (!startedRef.current) {
    startedRef.current = true;
    startCamera();
  }

  // وقف الكاميرا عند اغلاق الكومبوننت
  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  // التقاط الصورة مع عد تنازلي
  const captureWithCountdown = useCallback(async () => {
    if (!isReady || isCapturing) return;
    setIsCapturing(true);

    // عد تنازلي 3 ثواني
    for (let i = 3; i >= 1; i--) {
      setCountdown(i);
      await new Promise((r) => setTimeout(r, 1000));
    }
    setCountdown(null);

    // التقاط الصورة من الـ video
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        // mirror الصورة (selfie mode)
        ctx.save();
        ctx.scale(-1, 1);
        ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
        ctx.restore();
        const base64 = canvas.toDataURL("image/jpeg", 0.8);
        stopCamera();
        onCapture(base64);
        return;
      }
    }

    setIsCapturing(false);
    setError("تعذر التقاط الصورة — حاول مرة تانية");
  }, [isReady, isCapturing, stopCamera, onCapture]);

  const handleCancel = useCallback(() => {
    stopCamera();
    onCancel();
  }, [stopCamera, onCancel]);

  return (
    <>
      <style>{`
        .selfie-overlay {
          position: fixed;
          inset: 0;
          z-index: 9999;
          background: rgba(0, 0, 0, 0.95);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 24px;
          font-family: 'Cairo', 'Inter', sans-serif;
          direction: rtl;
        }

        .selfie-title {
          color: #fff;
          font-size: 18px;
          font-weight: 700;
          margin-bottom: 8px;
          text-align: center;
        }

        .selfie-subtitle {
          color: rgba(255,255,255,0.55);
          font-size: 13px;
          text-align: center;
          margin-bottom: 24px;
          line-height: 1.6;
        }

        .selfie-video-wrapper {
          position: relative;
          width: 280px;
          height: 280px;
          border-radius: 50%;
          overflow: hidden;
          border: 3px solid #0fa5f8;
          box-shadow: 0 0 0 4px rgba(15,165,248,0.2);
          margin-bottom: 24px;
          background: #111;
        }

        .selfie-video {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transform: scaleX(-1); /* mirror effect */
        }

        .selfie-countdown {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(0,0,0,0.5);
          font-size: 72px;
          font-weight: 900;
          color: #0fa5f8;
          animation: pulse-count 1s ease-in-out;
        }

        @keyframes pulse-count {
          0% { transform: scale(1.5); opacity: 0; }
          50% { transform: scale(1); opacity: 1; }
          100% { transform: scale(0.9); opacity: 0.8; }
        }

        .selfie-actions {
          display: flex;
          flex-direction: column;
          gap: 12px;
          width: 100%;
          max-width: 280px;
        }

        .selfie-btn-capture {
          width: 100%;
          height: 52px;
          background: #0fa5f8;
          color: #fff;
          border: none;
          border-radius: 14px;
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: transform 0.15s;
        }
        .selfie-btn-capture:active { transform: scale(0.97); }
        .selfie-btn-capture:disabled { opacity: 0.5; cursor: not-allowed; }

        .selfie-btn-cancel {
          width: 100%;
          height: 44px;
          background: transparent;
          color: rgba(255,255,255,0.5);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 12px;
          font-size: 14px;
          cursor: pointer;
          transition: color 0.2s;
        }
        .selfie-btn-cancel:hover { color: rgba(255,255,255,0.8); }

        .selfie-error {
          color: #ef4444;
          font-size: 13px;
          text-align: center;
          margin-bottom: 16px;
          background: rgba(239,68,68,0.1);
          border: 1px solid rgba(239,68,68,0.2);
          border-radius: 10px;
          padding: 10px 16px;
        }

        .selfie-shield {
          font-size: 11px;
          color: rgba(255,255,255,0.3);
          text-align: center;
          margin-top: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
        }
      `}</style>

      <div className="selfie-overlay">
        <div className="selfie-title">📸 صورة التحقق</div>
        <p className="selfie-subtitle">
          التقط صورة واضحة لوجهك لتاكيد حضورك في الفرع
          <br />
          الصورة بتتحفظ مع سجل الزيارة
        </p>

        {error ? (
          <div className="selfie-error">{error}</div>
        ) : (
          <div className="selfie-video-wrapper">
            <video
              ref={videoRef}
              className="selfie-video"
              autoPlay
              playsInline
              muted
            />
            {countdown !== null && (
              <div className="selfie-countdown" key={countdown}>
                {countdown}
              </div>
            )}
            {!isReady && !error && (
              <div style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "rgba(0,0,0,0.7)",
              }}>
                <Loader2 className="animate-spin" style={{ color: "#0fa5f8", width: 32, height: 32 }} />
              </div>
            )}
          </div>
        )}

        {/* canvas مخفي للتقاط الصورة */}
        <canvas ref={canvasRef} style={{ display: "none" }} />

        <div className="selfie-actions">
          {error ? (
            <button className="selfie-btn-capture" onClick={startCamera}>
              اعادة المحاولة
            </button>
          ) : (
            <button
              className="selfie-btn-capture"
              onClick={captureWithCountdown}
              disabled={!isReady || isCapturing}
            >
              {isCapturing ? (
                <Loader2 className="animate-spin" style={{ width: 20, height: 20 }} />
              ) : (
                <>
                  <span className="material-symbols-outlined" style={{ fontSize: 20 }}>camera</span>
                  التقاط الصورة
                </>
              )}
            </button>
          )}

          <button className="selfie-btn-cancel" onClick={handleCancel}>
            الغاء تسجيل الدخول
          </button>
        </div>

        <div className="selfie-shield">
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>shield</span>
          الصورة محمية ومش بتتشارك مع اي جهة خارجية
        </div>
      </div>
    </>
  );
}

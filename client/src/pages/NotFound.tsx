import { useLocation } from "wouter";

export default function NotFound() {
  const [, setLocation] = useLocation();

  const handleGoHome = () => {
    setLocation("/");
  };

  return (
    <div className="page-enter min-h-screen w-full flex items-center justify-center p-4 relative overflow-hidden"
      style={{ background: "radial-gradient(ellipse at 50% 50%, #003a4d 0%, #020617 100%)", direction: "rtl" }}>
      
      {/* Animated grid */}
      <div className="absolute inset-0 opacity-[0.03]"
        style={{ backgroundImage: "linear-gradient(rgba(0,212,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,255,0.5) 1px, transparent 1px)", backgroundSize: "60px 60px" }} />

      {/* Atmospheric blobs */}
      <div className="bg-blob bg-blob-animate bg-[#00d4ff] top-[-20%] right-[-10%] opacity-[0.15]" />
      <div className="bg-blob bg-blob-animate bg-[#a78bfa] bottom-[-20%] left-[-10%] opacity-[0.1]" style={{ animationDelay: "-8s" }} />

      <div className="relative w-full max-w-lg bento-card p-10 flex flex-col items-center text-center slide-up"
           style={{ background: "rgba(11,19,38,0.85)", backdropFilter: "blur(32px)" }}>
        
        <div className="relative mb-8 group">
          <div className="absolute inset-0 bg-[#fc8181] rounded-full blur-xl opacity-20 group-hover:opacity-40 transition-opacity" />
          <div className="w-24 h-24 rounded-3xl bg-[#fc8181]/10 border border-[#fc8181]/30 flex items-center justify-center relative shadow-[0_0_32px_rgba(252,129,129,0.2)]">
            <span className="material-symbols-outlined text-[#fc8181] text-[48px]">warning</span>
          </div>
          <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-[#0b1326] flex items-center justify-center border border-white/[0.06]">
            <span className="w-3 h-3 rounded-full bg-[#fc8181] pulse-ring" />
          </div>
        </div>

        <h1 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#fc8181] to-[#f59e0b] mb-4 font-mono"
            style={{ textShadow: "0 4px 24px rgba(252,129,129,0.3)" }}>
          404
        </h1>

        <h2 className="text-2xl font-bold text-[#e2e8f0] mb-3" style={{ fontFamily: "'Fira Sans', sans-serif" }}>
          الصفحة غير موجودة
        </h2>

        <p className="text-[#64748b] mb-8 leading-relaxed text-sm">
          عذراً، الصفحة التي تحاول الوصول إليها غير موجودة.
          <br />
          ربما تم نقلها أو حذفها، أو أنك أدخلت عنواناً خاطئاً.
        </p>

        <button
          onClick={handleGoHome}
          className="btn-primary w-full sm:w-auto px-8 h-12 flex items-center justify-center gap-3 text-base font-semibold rounded-xl cursor-pointer hover:scale-105 transition-transform"
        >
          <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>home</span>
          العودة للرئيسية
        </button>
      </div>
    </div>
  );
}

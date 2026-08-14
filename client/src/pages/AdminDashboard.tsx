import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { Loader2 } from "lucide-react";

// صور المديرين — مؤقتة لحد ما تتضاف للداتابيز
const MANAGER_PHOTOS: Record<string, string> = {
  "مينا محسن":       "https://res.cloudinary.com/xo69zo4p/image/upload/v1785100980/WhatsApp_Image_2026-07-27_at_12.14.15_AM_pmp0xk.jpg",
  "احمد خالد":       "https://res.cloudinary.com/xo69zo4p/image/upload/v1785100980/WhatsApp_Image_2026-07-27_at_12.14.15_AM_pmp0xk.jpg",
  "محمد عبدالستار":  "https://res.cloudinary.com/xo69zo4p/image/upload/v1785100980/WhatsApp_Image_2026-07-27_at_12.14.15_AM_pmp0xk.jpg",
  "يوسف مينا":       "https://res.cloudinary.com/xo69zo4p/image/upload/v1785100980/WhatsApp_Image_2026-07-27_at_12.14.15_AM_pmp0xk.jpg",
};

// كارت المدير
function ManagerCard({ name, photoUrl, branchName, status }: {
  name: string;
  photoUrl?: string | null;
  branchName: string | null;
  status: "checked_in" | "checked_out" | null;
}) {
  const photo = photoUrl || MANAGER_PHOTOS[name];
  const isActive = status === "checked_in";
  const initials = name.split(" ").map(w => w[0]).join("").slice(0, 2);

  return (
    <div className="bg-white rounded-2xl p-5 border border-[#EDE9FE] hover:shadow-lg hover:shadow-[#A78BFA]/15 hover:-translate-y-0.5 transition-all duration-200 flex flex-col items-center gap-4 relative">

      {/* Badge الحالة */}
      <div className={`absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ${
        isActive ? "bg-[#ECFDF5] text-[#059669]" : "bg-[#F3F4F6] text-[#9CA3AF]"
      }`}>
        <span className={`w-1.5 h-1.5 rounded-full ${isActive ? "bg-[#059669] animate-pulse" : "bg-[#D1D5DB]"}`} />
        {isActive ? "داخل" : "خارج"}
      </div>

      {/* الصورة */}
      <div className="relative mt-2">
        {photo ? (
          <img
            src={photo}
            alt={name}
            className="w-20 h-20 rounded-2xl object-cover border-2 border-[#EDE9FE]"
          />
        ) : (
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#7C3AED] to-[#A78BFA] flex items-center justify-center border-2 border-[#EDE9FE]">
            <span className="text-white font-bold text-2xl" style={{ fontFamily: "'Cairo', sans-serif" }}>{initials}</span>
          </div>
        )}
        {/* نقطة الحالة على الصورة */}
        <span className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${isActive ? "bg-[#059669]" : "bg-[#D1D5DB]"}`} />
      </div>

      {/* الاسم */}
      <div className="text-center">
        <p className="font-bold text-[#111827] text-sm leading-tight" style={{ fontFamily: "'Cairo', sans-serif" }}>{name}</p>
      </div>

      {/* الفرع */}
      <div className={`w-full rounded-xl px-3 py-2.5 text-center ${
        isActive ? "bg-[#EDE9FE]" : "bg-[#F9FAFB]"
      }`}>
        {isActive && branchName ? (
          <>
            <p className="text-[10px] text-[#9CA3AF] mb-0.5">الفرع الحالي</p>
            <p className="font-bold text-[#7C3AED] text-sm" style={{ fontFamily: "'Cairo', sans-serif" }}>{branchName}</p>
          </>
        ) : (
          <p className="text-[#9CA3AF] text-xs">غير متواجد في فرع</p>
        )}
      </div>
    </div>
  );
}

// ─── VisitRow ─────────────────────────────────────────────────────────────────
function VisitRow({ name, time, status, manager, isMocked }: {
  name: string; time: string; status: "checked_in" | "checked_out"; manager: string; isMocked?: "yes" | "no";
}) {
  const isActive = status === "checked_in";
  return (
    <div className="flex items-center gap-3 py-3 border-b border-[#F3F4F6] last:border-0 hover:bg-[#FAFAFA] rounded-xl px-2 transition-colors cursor-pointer">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${isActive ? "bg-[#EDE9FE]" : "bg-[#ECFDF5]"}`}>
        <span className={`material-symbols-outlined text-[18px] ${isActive ? "text-[#7C3AED]" : "text-[#059669]"}`}
          style={{ fontVariationSettings: "'FILL' 1" }}>
          {isActive ? "radio_button_checked" : "task_alt"}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-[#111827] text-sm truncate">{name}</p>
          {isMocked === "yes" && (
            <span className="flex items-center gap-1 bg-red-100 text-red-700 text-[10px] font-bold px-1.5 py-0.5 rounded border border-red-200">
              <span className="material-symbols-outlined text-[12px]">warning</span>
              وهمي
            </span>
          )}
        </div>
        <p className="text-[#9CA3AF] text-xs mt-0.5">{manager}</p>
      </div>
      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        <span className="text-xs text-[#9CA3AF] font-mono">{time}</span>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isActive ? "bg-[#EDE9FE] text-[#7C3AED]" : "bg-[#ECFDF5] text-[#059669]"}`}>
          {isActive ? "نشط" : "منتهى"}
        </span>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const [, navigate] = useLocation();
  const { data: stats, isLoading } = trpc.visit.stats.useQuery();
  const { data: recentVisits = [], isLoading: recentLoading } = trpc.visit.recentVisits.useQuery({ limit: 5 });
  const { data: liveLocations = [], isLoading: managersLoading } = trpc.manager.getLiveLocations.useQuery();
  const { data: activeVisits = [] } = trpc.visit.activeVisits.useQuery();

  const totalBranches      = (stats as any)?.totalBranches ?? 0;
  const totalManagers      = (stats as any)?.totalManagers ?? 0;
  const todayVisits        = (stats as any)?.todayVisits   ?? 0;
  const mockedVisitsToday  = (stats as any)?.mockedVisitsToday ?? 0;
  const completionRate     = Math.min(Math.round((todayVisits / Math.max(totalBranches, 1)) * 100), 100);
  const now = new Date();

  // جيب الفرع الحالي لكل مدير من activeVisits (الزيارات المفتوحة فعلاً)
  const managerCurrentBranch: Record<number, { branch: string; status: "checked_in" }> = {};
  (activeVisits as any[]).forEach((v: any) => {
    managerCurrentBranch[v.managerId] = { branch: v.branchName, status: "checked_in" };
  });

  return (
    <div className="min-h-screen pb-24 md:pb-8" style={{ background: "#F8F7FF" }}>

      {/* ── Top Bar (Mobile) ──────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-white border-b border-[#EDE9FE] md:hidden">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#6D28D9] to-[#A78BFA] flex items-center justify-center">
              <span className="material-symbols-outlined text-white text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                monitoring
              </span>
            </div>
            <div>
              <h1 className="font-bold text-[15px] text-[#7C3AED] tracking-tight leading-none" style={{ fontFamily: "'Cairo', sans-serif" }}>
                Branch Tracker
              </h1>
              <p className="text-[10px] text-[#9CA3AF] leading-none mt-0.5">
                {format(now, "EEE d MMM", { locale: ar })}
              </p>
            </div>
          </div>
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#A78BFA] flex items-center justify-center text-white font-bold text-sm">
            A
          </div>
        </div>
      </header>

      <main className="px-4 md:px-8 pt-6 max-w-7xl mx-auto space-y-6">

        {/* ── Greeting ──────────────────────────────────────────────────────── */}
        <div className="hidden md:block">
          <h2 className="text-2xl font-bold text-[#111827]" style={{ fontFamily: "'Cairo', sans-serif" }}>
            مرحباً، الأدمن! 👋
          </h2>
          <p className="text-[#6B7280] text-sm mt-1">{format(now, "EEEE، d MMMM yyyy", { locale: ar })}</p>
        </div>

        {/* ── KPI Cards ─────────────────────────────────────────────────────── */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3">

          {/* الفروع */}
          <div
            className="bg-gradient-to-br from-[#7C3AED] to-[#A78BFA] rounded-2xl p-5 text-white cursor-pointer hover:shadow-lg hover:shadow-[#A78BFA]/30 transition-all duration-200 col-span-2 md:col-span-1"
            onClick={() => navigate("/branches")}
          >
            <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-white text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>location_city</span>
            </div>
            <p className="text-white/70 text-xs font-semibold uppercase tracking-widest mb-1">الفروع</p>
            <p className="font-bold text-4xl leading-none font-mono">{isLoading ? "—" : totalBranches}</p>
            <p className="text-white/60 text-xs mt-2">إجمالي الفروع المسجلة</p>
          </div>

          {/* المديرين */}
          <div
            className="bg-white rounded-2xl p-5 border border-[#EDE9FE] cursor-pointer hover:border-[#A78BFA] hover:shadow-md transition-all duration-200"
            onClick={() => navigate("/managers")}
          >
            <div className="w-9 h-9 bg-[#EDE9FE] rounded-xl flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-[#7C3AED] text-[20px]">manage_accounts</span>
            </div>
            <p className="text-[#9CA3AF] text-xs font-semibold uppercase tracking-widest mb-1">المديرين</p>
            <p className="font-bold text-3xl text-[#111827] leading-none font-mono">{isLoading ? "—" : totalManagers}</p>
            <p className="text-[#9CA3AF] text-xs mt-2">نشط الآن</p>
          </div>

          {/* زيارات اليوم */}
          <div
            className="bg-white rounded-2xl p-5 border border-[#D1FAE5] cursor-pointer hover:border-[#6EE7B7] hover:shadow-md transition-all duration-200"
            onClick={() => navigate("/reports")}
          >
            <div className="w-9 h-9 bg-[#ECFDF5] rounded-xl flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-[#059669] text-[20px]">task_alt</span>
            </div>
            <p className="text-[#9CA3AF] text-xs font-semibold uppercase tracking-widest mb-1">زيارات اليوم</p>
            <p className="font-bold text-3xl text-[#111827] leading-none font-mono">{isLoading ? "—" : todayVisits}</p>
            <div className="mt-3 h-1.5 bg-[#D1FAE5] rounded-full overflow-hidden">
              <div className="h-full bg-[#059669] rounded-full transition-all duration-700" style={{ width: `${completionRate}%` }} />
            </div>
          </div>

          {/* معدل الإنجاز */}
          <div className="bg-white rounded-2xl p-5 border border-[#EDE9FE] flex flex-col items-center justify-center">
            <p className="text-[#9CA3AF] text-xs font-semibold uppercase tracking-widest mb-3 self-start">معدل الإنجاز</p>
            <div className="relative w-20 h-20">
              <svg viewBox="0 0 88 88" className="w-20 h-20" aria-hidden="true">
                <circle cx="44" cy="44" r="36" fill="none" stroke="#EDE9FE" strokeWidth="8" />
                <circle
                  cx="44" cy="44" r="36" fill="none"
                  stroke="#7C3AED" strokeWidth="8"
                  strokeDasharray={`${(completionRate / 100) * (2 * Math.PI * 36)} ${2 * Math.PI * 36}`}
                  strokeLinecap="round"
                  transform="rotate(-90 44 44)"
                  style={{ transition: "stroke-dasharray 0.8s cubic-bezier(0.34,1.56,0.64,1)" }}
                />
                <text x="44" y="49" textAnchor="middle" fill="#7C3AED" fontSize="15" fontFamily="'Fira Code', monospace" fontWeight="700">
                  {completionRate}
                </text>
              </svg>
            </div>
            <p className="text-[#9CA3AF] text-xs mt-2">% من الهدف اليومي</p>
          </div>

          {/* تنبيه المواقع الوهمية (يظهر فقط لو فيه داتا) */}
          <div
            className={`rounded-2xl p-5 border transition-all duration-200 cursor-pointer ${
              mockedVisitsToday > 0 
                ? "bg-red-50 border-red-200 hover:border-red-400 shadow-sm" 
                : "bg-white border-[#EDE9FE] opacity-60"
            } col-span-2 md:col-span-1`}
            onClick={() => navigate("/reports")}
          >
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-4 ${
              mockedVisitsToday > 0 ? "bg-red-100" : "bg-gray-100"
            }`}>
              <span className={`material-symbols-outlined text-[20px] ${
                mockedVisitsToday > 0 ? "text-red-600" : "text-gray-400"
              }`} style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>
            </div>
            <p className="text-[#9CA3AF] text-xs font-semibold uppercase tracking-widest mb-1">مواقع وهمية</p>
            <p className={`font-bold text-3xl leading-none font-mono ${
              mockedVisitsToday > 0 ? "text-red-600" : "text-[#111827]"
            }`}>{isLoading ? "—" : mockedVisitsToday}</p>
            <p className="text-[#9CA3AF] text-xs mt-2">{mockedVisitsToday > 0 ? "زيارات مشبوهة اليوم!" : "لا توجد بلاغات"}</p>
          </div>
        </section>

        {/* ── كروت المديرين ─────────────────────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-bold text-[#111827] text-base" style={{ fontFamily: "'Cairo', sans-serif" }}>المديرين الميدانيين</h2>
              <p className="text-[#9CA3AF] text-xs mt-0.5">الحالة اللحظية لكل مدير</p>
            </div>
            <button onClick={() => navigate("/live-map")} className="flex items-center gap-1.5 text-[#7C3AED] text-xs font-bold hover:underline cursor-pointer">
              <span className="material-symbols-outlined text-[16px]">map</span>
              الخريطة المباشرة
            </button>
          </div>

          {managersLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-[#7C3AED]" />
            </div>
          ) : (liveLocations as any[]).length === 0 ? (
            <div className="text-center py-10 text-[#9CA3AF] text-sm bg-white rounded-2xl border border-[#EDE9FE]">
              لا يوجد مديرون مسجلون بعد
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {(liveLocations as any[]).map((m: any) => {
                const current = managerCurrentBranch[m.id];
                return (
                  <ManagerCard
                    key={m.id}
                    name={m.userName}
                    photoUrl={m.photoUrl}
                    branchName={current?.branch ?? null}
                    status={current?.status ?? null}
                  />
                );
              })}
            </div>
          )}
        </section>

        {/* ── النشاط الأخير + Quick Actions ─────────────────────────────────── */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">

          {/* النشاط الأخير */}
          <div className="bg-white rounded-2xl p-5 border border-[#EDE9FE] md:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-[#111827] text-base" style={{ fontFamily: "'Cairo', sans-serif" }}>النشاط الأخير</h2>
              <button onClick={() => navigate("/reports")} className="text-[#7C3AED] text-xs font-bold hover:underline cursor-pointer">
                عرض الكل
              </button>
            </div>
            {recentLoading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="w-5 h-5 animate-spin text-[#7C3AED]" />
              </div>
            ) : (recentVisits as any[]).length === 0 ? (
              <div className="text-center py-8 text-[#9CA3AF] text-sm">لا توجد زيارات بعد</div>
            ) : (
              (recentVisits as any[]).map((v: any) => (
                <VisitRow
                  key={v.id}
                  name={v.branchName}
                  time={format(new Date(v.checkInAt), "hh:mm a", { locale: ar })}
                  status={v.status}
                  manager={v.managerName ?? "—"}
                  isMocked={v.isMocked}
                />
              ))
            )}
          </div>

          {/* Quick Actions */}
          <div className="flex flex-col gap-3">
            {[
              { icon: "map",        label: "الخريطة المباشرة", sub: "تتبع فوري للمديرين",     path: "/live-map",  color: "#7C3AED", bg: "#EDE9FE" },
              { icon: "assignment", label: "التقارير",          sub: "تحليلات شاملة وتصدير",   path: "/reports",   color: "#059669", bg: "#ECFDF5" },
              { icon: "group",      label: "المستخدمون",        sub: "إدارة الصلاحيات",        path: "/users",     color: "#D97706", bg: "#FEF3C7" },
            ].map(({ icon, label, sub, path, color, bg }) => (
              <button key={path}
                onClick={() => navigate(path)}
                className="bg-white rounded-2xl p-4 flex items-center gap-3 text-right border border-[#F3F4F6] hover:border-[#EDE9FE] hover:shadow-md transition-all duration-200 cursor-pointer w-full group">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: bg }}>
                  <span className="material-symbols-outlined text-[20px] group-hover:scale-110 transition-transform" style={{ color, fontVariationSettings: "'FILL' 1" }}>
                    {icon}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-sm text-[#111827]" style={{ fontFamily: "'Cairo', sans-serif" }}>{label}</p>
                  <p className="text-xs text-[#9CA3AF] mt-0.5">{sub}</p>
                </div>
                <span className="material-symbols-outlined text-[18px] text-[#D1D5DB] group-hover:text-[#7C3AED] transition-colors flex-shrink-0">chevron_left</span>
              </button>
            ))}
          </div>
        </section>

      </main>

      {/* ── FAB ──────────────────────────────────────────────────────────────── */}
      <button
        onClick={() => navigate("/branches")}
        className="fixed bottom-20 right-4 md:bottom-6 md:right-6 w-14 h-14 rounded-2xl flex items-center justify-center z-40 bg-gradient-to-br from-[#6D28D9] to-[#A78BFA] shadow-lg shadow-[#A78BFA]/40 hover:scale-110 active:scale-90 transition-transform duration-200 cursor-pointer"
        aria-label="إضافة فرع">
        <span className="material-symbols-outlined text-white text-[28px]" style={{ fontVariationSettings: "'FILL' 1" }}>add</span>
      </button>
    </div>
  );
}

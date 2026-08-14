import { trpc } from "@/lib/trpc";
import { MapView, MapMarker, MapPolyline } from "@/components/Map";
import { useState, useEffect } from "react";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";
import type { MapCenter } from "@/components/Map";

export default function AdminLiveTracking() {
  const [trackingMode, setTrackingMode] = useState<"live" | "history">("live");
  const [historyDate, setHistoryDate] = useState<string>(
    new Date().toLocaleDateString("en-CA") // format YYYY-MM-DD local time
  );

  const { data: managers = [], isLoading } = trpc.manager.getLiveLocations.useQuery(
    undefined,
    { refetchInterval: trackingMode === "live" ? 10000 : false }
  );

  const [selectedManager, setSelectedManager] = useState<number | null>(null);
  const [flyTo, setFlyTo] = useState<MapCenter | null>(null);

  const { data: routeHistory = [], isLoading: historyLoading } = trpc.manager.getRouteHistory.useQuery(
    { managerId: selectedManager!, date: historyDate },
    { enabled: trackingMode === "history" && selectedManager !== null }
  );

  // Automatically fly to the first point of the route when history is loaded
  useEffect(() => {
    if (trackingMode === "history" && routeHistory.length > 0) {
      setFlyTo({
        lat: parseFloat(routeHistory[0].latitude),
        lng: parseFloat(routeHistory[0].longitude)
      });
    }
  }, [routeHistory, trackingMode]);

  const withLocation = managers.filter((m) => m.location !== null);
  const withoutLocation = managers.filter((m) => m.location === null);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[#00d4ff]/10 border border-[#00d4ff]/20 flex items-center justify-center">
            <div className="animate-spin w-6 h-6 border-2 border-[#00d4ff]/30 border-t-[#00d4ff] rounded-full" />
          </div>
          <p className="text-[#4a5568] text-sm font-mono">جاري تحميل المواقع...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-enter min-h-screen pb-24 md:pb-8">

      {/* Mobile Top Bar */}
      <header className="sticky top-0 z-50 border-b border-white/[0.06] backdrop-blur-2xl md:hidden flex flex-col" style={{ background: "rgba(2,6,23,0.9)" }}>
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#00d4ff]/10 border border-[#00d4ff]/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-[#00d4ff] text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>share_location</span>
            </div>
            <div>
              <h1 className="font-bold text-[15px] text-[#e2e8f0] leading-none" style={{ fontFamily: "'Fira Sans', sans-serif" }}>الخريطة</h1>
              <p className="text-[10px] text-[#4a5568] font-mono leading-none mt-0.5">
                {trackingMode === "live" ? "تحديث مباشر" : "سجل التحركات"}
              </p>
            </div>
          </div>
          <div className="flex items-center bg-[#0f172a] rounded-lg p-1 border border-white/[0.05]">
            <button onClick={() => setTrackingMode("live")} className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${trackingMode === "live" ? "bg-[#00d4ff]/20 text-[#00d4ff]" : "text-[#64748b]"}`}>مباشر</button>
            <button onClick={() => setTrackingMode("history")} className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${trackingMode === "history" ? "bg-[#00d4ff]/20 text-[#00d4ff]" : "text-[#64748b]"}`}>سجل</button>
          </div>
        </div>
        {trackingMode === "history" && (
          <div className="px-4 pb-3 flex items-center gap-2">
            <span className="text-xs text-[#94a3b8]">التاريخ:</span>
            <input type="date" value={historyDate} onChange={e => setHistoryDate(e.target.value)} className="bg-[#0f172a] border border-white/[0.1] text-xs text-[#e2e8f0] rounded-lg px-2 py-1 flex-1 outline-none focus:border-[#00d4ff]/50" />
          </div>
        )}
      </header>

      <main className="px-4 md:px-8 pt-5 md:pt-8 max-w-7xl mx-auto space-y-5">

        {/* Desktop Header */}
        <div className="hidden md:flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div>
              <h1 className="text-2xl font-bold text-[#e2e8f0]" style={{ fontFamily: "'Fira Sans', sans-serif" }}>خريطة التتبع</h1>
              <p className="text-[#64748b] text-sm mt-1">تتبع مباشر أو سجل مسارات المديرين</p>
            </div>
            
            <div className="flex items-center bg-[#0f172a] rounded-xl p-1 border border-white/[0.05]">
              <button onClick={() => setTrackingMode("live")} className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${trackingMode === "live" ? "bg-[#00d4ff]/20 text-[#00d4ff]" : "text-[#64748b] hover:text-[#e2e8f0]"}`}>تتبع مباشر</button>
              <button onClick={() => setTrackingMode("history")} className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${trackingMode === "history" ? "bg-[#00d4ff]/20 text-[#00d4ff]" : "text-[#64748b] hover:text-[#e2e8f0]"}`}>سجل التحركات</button>
            </div>
          </div>

          <div className="flex gap-3">
            {trackingMode === "history" ? (
              <div className="flex items-center gap-3">
                <span className="text-sm text-[#94a3b8] font-semibold">تاريخ السجل:</span>
                <input 
                  type="date" 
                  value={historyDate} 
                  onChange={e => setHistoryDate(e.target.value)} 
                  className="bg-[#0f172a] border border-white/[0.1] text-sm text-[#e2e8f0] rounded-xl px-4 py-2 outline-none focus:border-[#00d4ff]/50 cursor-pointer" 
                />
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm"
                  style={{ background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.2)", color: "#34d399" }}>
                  <span className="w-2 h-2 rounded-full bg-[#34d399] pulse-ring text-[#34d399]" />
                  {withLocation.length} موقع محدد
                </div>
                <div className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm"
                  style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)", color: "#f59e0b" }}>
                  <span className="w-2 h-2 rounded-full bg-[#f59e0b]" />
                  {withoutLocation.length} بدون تتبع
                </div>
              </>
            )}
          </div>
        </div>

        {/* Info Banner */}
        <div className="bento-card p-4 flex gap-3 items-start border-r-4 border-[#00d4ff]">
          <span className="material-symbols-outlined text-[#00d4ff] text-[22px] mt-0.5 flex-shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>
            info
          </span>
          <div>
            <p className="text-sm font-semibold text-[#e2e8f0] mb-1" style={{ fontFamily: "'Fira Sans', sans-serif" }}>
              كيف يعمل نظام التتبع؟
            </p>
            <p className="text-xs leading-6 text-[#64748b]">
              التطبيق يحفظ موقع المدير تلقائياً حتى بدون نت — لما يرجع النت يبعت كل المواقع المحفوظة.
              <span className="text-[#00d4ff] font-semibold"> الموقع الظاهر هنا هو آخر موقع معروف</span>، مش بالضرورة موقعه الآن.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
          {/* Map */}
          <div className="lg:col-span-3 rounded-2xl overflow-hidden border border-white/[0.08] shadow-lg relative">
            <MapView
              initialZoom={6}
              initialCenter={{ lat: 30.0444, lng: 31.2357 }}
              flyTo={flyTo}
              flyToZoom={16}
              className="h-[560px]"
            >
              {trackingMode === "live" ? (
                // --- LIVE MODE MARKERS ---
                withLocation.map((m) => (
                  <MapMarker
                    key={m.id}
                    lat={parseFloat(m.location!.latitude)}
                    lng={parseFloat(m.location!.longitude)}
                    label={m.userName || "مدير"}
                    color={selectedManager === m.id ? "#00d4ff" : "#4edea3"}
                    popupContent={`${m.userName} — ${formatDistanceToNow(new Date(m.location!.timestamp), { addSuffix: true, locale: ar })}`}
                    onClick={() => {
                      setSelectedManager(m.id);
                      setFlyTo({ lat: parseFloat(m.location!.latitude), lng: parseFloat(m.location!.longitude) });
                    }}
                  />
                ))
              ) : (
                // --- HISTORY MODE POLYLINE ---
                trackingMode === "history" && selectedManager && routeHistory.length > 0 && (
                  <MapPolyline 
                    positions={routeHistory.map(p => [parseFloat(p.latitude), parseFloat(p.longitude)] as [number, number])} 
                    color="#00d4ff"
                    weight={4}
                  />
                )
              )}
            </MapView>

            {/* Top Right Badges */}
            {trackingMode === "live" ? (
              <div className="absolute top-4 right-4 z-[500] backdrop-blur-md px-3 py-2 rounded-xl border border-white/[0.1] shadow-lg flex items-center gap-2"
                   style={{ background: "rgba(2,6,23,0.85)" }}>
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#34d399] opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#34d399]" />
                </span>
                <span className="text-xs font-semibold text-[#e2e8f0] font-mono">
                  LIVE · كل 10 ثواني
                </span>
              </div>
            ) : (
              <div className="absolute top-4 right-4 z-[500] backdrop-blur-md px-3 py-2 rounded-xl border border-white/[0.1] shadow-lg flex items-center gap-2"
                   style={{ background: "rgba(2,6,23,0.85)" }}>
                <span className="material-symbols-outlined text-[#00d4ff] text-[18px]">history</span>
                <span className="text-xs font-semibold text-[#e2e8f0] font-mono">
                  سجل يوم {historyDate}
                </span>
              </div>
            )}

            {/* Empty States */}
            {trackingMode === "live" && withLocation.length === 0 && (
              <div className="absolute inset-0 z-[400] flex flex-col items-center justify-center"
                style={{ background: "rgba(2,6,23,0.75)", backdropFilter: "blur(6px)" }}>
                <span className="material-symbols-outlined text-[48px] text-[#4a5568] mb-3"
                  style={{ fontVariationSettings: "'FILL' 1" }}>
                  location_off
                </span>
                <p className="text-[#64748b] text-sm font-semibold mb-1" style={{ fontFamily: "'Fira Sans', sans-serif" }}>
                  لا يوجد مواقع مُرسلة بعد
                </p>
                <p className="text-[#4a5568] text-xs">
                  ينتظر مديرين يفتحوا التطبيق ويفعّلوا التتبع
                </p>
              </div>
            )}

            {trackingMode === "history" && !selectedManager && (
              <div className="absolute inset-0 z-[400] flex flex-col items-center justify-center"
                style={{ background: "rgba(2,6,23,0.75)", backdropFilter: "blur(6px)" }}>
                <span className="material-symbols-outlined text-[48px] text-[#00d4ff]/50 mb-3"
                  style={{ fontVariationSettings: "'FILL' 1" }}>
                  touch_app
                </span>
                <p className="text-[#64748b] text-sm font-semibold mb-1" style={{ fontFamily: "'Fira Sans', sans-serif" }}>
                  اختر مديراً لعرض مساره
                </p>
                <p className="text-[#4a5568] text-xs">
                  اضغط على اسم المدير من القائمة الجانبية
                </p>
              </div>
            )}
            
            {trackingMode === "history" && selectedManager && historyLoading && (
              <div className="absolute inset-0 z-[400] flex flex-col items-center justify-center"
                style={{ background: "rgba(2,6,23,0.75)", backdropFilter: "blur(6px)" }}>
                <div className="animate-spin w-8 h-8 border-2 border-[#00d4ff]/30 border-t-[#00d4ff] rounded-full mb-3" />
                <p className="text-[#e2e8f0] text-sm font-semibold" style={{ fontFamily: "'Fira Sans', sans-serif" }}>
                  جاري تحميل المسار...
                </p>
              </div>
            )}
            
            {trackingMode === "history" && selectedManager && !historyLoading && routeHistory.length === 0 && (
              <div className="absolute inset-0 z-[400] flex flex-col items-center justify-center"
                style={{ background: "rgba(2,6,23,0.75)", backdropFilter: "blur(6px)" }}>
                <span className="material-symbols-outlined text-[48px] text-[#4a5568] mb-3">
                  wrong_location
                </span>
                <p className="text-[#64748b] text-sm font-semibold mb-1" style={{ fontFamily: "'Fira Sans', sans-serif" }}>
                  لم يتم تسجيل أي تحركات
                </p>
                <p className="text-[#4a5568] text-xs">
                  هذا المدير لم يسجل أي موقع في هذا اليوم
                </p>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="bento-card p-4 flex flex-col" style={{ maxHeight: "560px" }}>
            <h2 className="font-semibold text-[#e2e8f0] mb-4 text-sm flex items-center justify-between"
              style={{ fontFamily: "'Fira Sans', sans-serif" }}>
              جميع المديرين
              <span className="badge badge-success px-2 py-0.5 text-[10px] font-mono">{managers.length}</span>
            </h2>

            <div className="flex-1 overflow-y-auto space-y-2 no-scrollbar">
              {managers.length === 0 && (
                <div className="text-center py-10">
                  <span className="material-symbols-outlined text-[#4a5568] text-[32px] block mb-2">group_off</span>
                  <p className="text-[#64748b] text-sm">لا يوجد مديرين في النظام</p>
                </div>
              )}

              {managers.map((m) => {
                const isSelected = selectedManager === m.id;
                const hasLocation = m.location !== null;

                return (
                  <div
                    key={m.id}
                    onClick={() => {
                      if (!hasLocation) return;
                      setSelectedManager(m.id);
                      setFlyTo({
                        lat: parseFloat(m.location!.latitude),
                        lng: parseFloat(m.location!.longitude),
                      });
                    }}
                    className="p-3 rounded-xl border transition-all"
                    style={{
                      cursor: hasLocation ? "pointer" : "default",
                      opacity: hasLocation ? 1 : 0.55,
                      background: isSelected ? "rgba(0,212,255,0.08)" : "rgba(255,255,255,0.01)",
                      borderColor: isSelected ? "rgba(0,212,255,0.4)" : "rgba(255,255,255,0.06)",
                    }}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${hasLocation ? "bg-[#34d399]" : "bg-[#f59e0b]"}`}
                           style={{ boxShadow: hasLocation ? "0 0 6px #34d399" : "none" }} />
                      <span className="font-semibold text-[#e2e8f0] text-sm truncate"
                        style={{ fontFamily: "'Fira Sans', sans-serif" }}>
                        {m.userName || "مدير"}
                      </span>
                    </div>

                    {hasLocation ? (
                      <div className="text-[11px] text-[#4a5568] flex items-center gap-1.5 font-mono">
                        <span className="material-symbols-outlined text-[#00d4ff] text-[13px]"
                          style={{ fontVariationSettings: "'FILL' 1" }}>
                          schedule
                        </span>
                        {formatDistanceToNow(new Date(m.location!.timestamp), {
                          addSuffix: true,
                          locale: ar,
                        })}
                      </div>
                    ) : (
                      <div className="text-[11px] flex items-center gap-1.5 text-[#f59e0b]">
                        <span className="material-symbols-outlined text-[13px]">location_off</span>
                        لم يفتح التطبيق بعد
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

import { trpc } from "@/lib/trpc";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";

export default function VisitHistory() {
  const { user } = useAuth();
  const { data: visitsData, isLoading } = trpc.visit.myHistory.useQuery({ limit: 50, offset: 0 });
  const visits = (visitsData?.items ?? []) as any[];

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0e1417]">
        <Loader2 className="w-8 h-8 animate-spin text-primary-container" />
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-32 bg-[#0e1417] font-body-md text-on-surface">
      {/* Top App Bar */}
      <header className="bg-transparent text-primary-container font-headline-md text-headline-md-mobile w-full sticky top-0 z-50 backdrop-blur-xl bg-surface/30 shadow-sm flex justify-between items-center px-container-padding py-4">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined">history</span>
          <h1 className="font-headline-md text-headline-md-mobile">سجل الزيارات</h1>
        </div>
        <div className="w-10 h-10 rounded-full border border-outline/20 overflow-hidden flex items-center justify-center bg-gradient-to-br from-[#00677e] to-[#00d4ff] text-on-primary font-bold">
          {user?.name?.charAt(0).toUpperCase() ?? "M"}
        </div>
      </header>

      <main className="px-container-padding pt-6 space-y-8">
        {/* Stats Summary */}
        {!isLoading && visits.length > 0 && (
          <section className="grid grid-cols-2 gap-4">
            <div className="glass-card p-4 rounded-2xl border border-white/5">
              <div className="flex items-center gap-2 text-on-surface-variant mb-2">
                <span className="material-symbols-outlined text-[18px] text-[#00d4ff]">directions_car</span>
                <span className="text-[10px] font-bold uppercase tracking-wider">إجمالي المسافة</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-on-surface">
                  {visits.reduce((acc, v) => acc + (parseFloat(v.distanceToPrevBranchKm) || 0), 0).toFixed(1)}
                </span>
                <span className="text-xs text-on-surface-variant">كم</span>
              </div>
            </div>
            <div className="glass-card p-4 rounded-2xl border border-white/5">
              <div className="flex items-center gap-2 text-on-surface-variant mb-2">
                <span className="material-symbols-outlined text-[18px] text-secondary">location_on</span>
                <span className="text-[10px] font-bold uppercase tracking-wider">عدد الزيارات</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-on-surface">{visits.length}</span>
                <span className="text-xs text-on-surface-variant">زيارة</span>
              </div>
            </div>
          </section>
        )}

        {/* Filter Chips */}
        <section className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
          <button className="px-6 py-2 rounded-full font-label-caps text-label-caps bg-primary-container text-on-primary-container whitespace-nowrap active:scale-95 transition-transform uppercase">
            كل الوقت
          </button>
          <button className="px-6 py-2 rounded-full font-label-caps text-label-caps bg-surface-container border border-white/10 text-on-surface-variant hover:bg-surface-variant transition-colors whitespace-nowrap uppercase">
            هذا الأسبوع
          </button>
          <button className="px-6 py-2 rounded-full font-label-caps text-label-caps bg-surface-container border border-white/10 text-on-surface-variant hover:bg-surface-variant transition-colors whitespace-nowrap flex items-center gap-2 uppercase">
            <span className="material-symbols-outlined text-[14px]">calendar_today</span>
            تاريخ محدد
          </button>
        </section>

        {/* Timeline List */}
        <section className="relative space-y-6">
          {/* Global Vertical Line Connector — on the left for RTL */}
          <div className="absolute left-5 md:left-auto md:right-6 top-4 bottom-4 w-[2px] timeline-line opacity-30 z-0"></div>

          {visits.length === 0 ? (
            <div className="text-center text-on-surface-variant mt-10 py-16 flex flex-col items-center gap-3">
              <span className="material-symbols-outlined text-[48px] text-[#4a5568]" style={{ fontVariationSettings: "'FILL' 1" }}>history</span>
              <p className="text-on-surface-variant text-sm">لا توجد زيارات مسجلة بعد</p>
            </div>
          ) : (
            visits.map((visit, idx) => {
              const checkInTime = new Date(visit.checkInAt);
              const checkOutTime = visit.checkOutAt ? new Date(visit.checkOutAt) : null;
              
              const durationMs = checkOutTime 
                ? checkOutTime.getTime() - checkInTime.getTime() 
                : (visit.status === "checked_in" ? Date.now() - checkInTime.getTime() : 0);
              
              const h = Math.floor(durationMs / 3600000);
              const m = Math.floor((durationMs % 3600000) / 60000);
              
              const isCheckedIn = visit.status === "checked_in";

              return (
                <div key={visit.id} className="relative z-10 flex items-start gap-4">
                  <div className="flex-grow glass-card rounded-[16px] p-5 active:scale-[0.98] transition-all">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-headline-sm text-on-surface font-bold">{visit.branchName}</h3>
                          {visit.isMocked === "yes" && (
                            <span className="flex items-center gap-1 bg-red-500/20 text-red-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-red-500/30">
                              <span className="material-symbols-outlined text-[11px]">warning</span>
                              موقع وهمي
                            </span>
                          )}
                        </div>
                        <p className="font-body-md text-on-surface-variant truncate max-w-[200px]">{visit.notes || "لا توجد ملاحظات"}</p>
                      </div>
                      <div className={`px-3 py-1 rounded-full text-[10px] font-label-caps flex items-center gap-1 ${
                        isCheckedIn 
                          ? "bg-secondary-container/20 text-secondary border border-secondary/30 glow-badge"
                          : "bg-surface-container text-on-surface-variant border border-outline/30"
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${isCheckedIn ? "bg-secondary active-pulse" : "bg-outline"}`}></span>
                        {isCheckedIn ? "نشط" : "مكتمل"}
                      </div>
                    </div>
                    
                    <div className="flex items-end justify-between mt-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-on-surface-variant">
                          <span className="material-symbols-outlined text-sm">schedule</span>
                          <span className="font-body-md">
                            {format(checkInTime, "MMM dd, hh:mm a")} 
                            {checkOutTime ? ` - ${format(checkOutTime, "hh:mm a")}` : " - Present"}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 flex-wrap">
                          <div className="flex items-center gap-1.5 text-primary-container">
                            <span className="material-symbols-outlined text-[16px]">timelapse</span>
                            <span className="font-label-caps text-label-caps">
                              المدة: {h}ساعة {m}دقيقة
                            </span>
                          </div>
                          {visit.distanceToPrevBranchKm != null && (
                            <div className="flex items-center gap-1.5 text-[#00d4ff]">
                              <span className="material-symbols-outlined text-[16px]">directions_car</span>
                              <span className="font-label-caps text-label-caps">
                                المسافة: {visit.distanceToPrevBranchKm} كم
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                      <button className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-on-surface-variant transition-colors">
                        <span className="material-symbols-outlined">chevron_left</span>
                      </button>
                    </div>
                  </div>
                  
                  {/* Connector Node — left side for RTL */}
                  <div className="mt-8 flex-shrink-0 relative flex items-center justify-center">
                    <div className={`w-4 h-4 rounded-full border-4 border-surface ${
                      isCheckedIn ? "bg-secondary shadow-[0_0_10px_#4edea3]" : "bg-primary-container shadow-[0_0_10px_#00d4ff]"
                    }`}></div>
                  </div>
                </div>
              );
            })
          )}
        </section>
      </main>
    </div>
  );
}

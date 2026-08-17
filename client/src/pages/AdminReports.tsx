import { useState, useMemo } from "react";
import { Loader2, ChevronDown, ChevronUp, Download, Clock, Camera, CheckCircle2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { format, startOfMonth, endOfMonth, isToday } from "date-fns";
import { ar } from "date-fns/locale";
import * as XLSX from "xlsx";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Visit {
  id: number;
  checkInAt: Date | string;
  checkOutAt: Date | string | null;
  status: string;
  isMocked: "yes" | "no";
  photoUrl: string | null;
  notes: string | null;
  branchName: string;
  branchCode: string;
  managerName: string;
  managerEmail: string | null;
  distanceToPrevBranchKm: number | null;
}

interface DayGroup {
  date: string;
  dateLabel: string;
  managerName: string;
  managerEmail: string | null;
  visits: Visit[];
  firstVisit: Visit;
  lastVisit: Visit;
  isActive: boolean;
  totalDurationMin: number;
  totalDistanceKm: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function durationMin(checkIn: Date | string, checkOut: Date | string | null): number {
  if (!checkOut) return 0;
  return Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 60000);
}
function fmtDuration(min: number): string {
  if (min === 0) return "—";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}س ${m}د` : `${m}د`;
}
function fmtTime(dt: Date | string): string {
  return format(new Date(dt), "hh:mm a", { locale: ar });
}
function fmtDate(dt: Date | string): string {
  return format(new Date(dt), "yyyy-MM-dd");
}
function fmtDateLabel(dateStr: string): string {
  return format(new Date(dateStr), "EEEE، d MMMM yyyy", { locale: ar });
}

function groupVisits(visits: Visit[]): DayGroup[] {
  const map = new Map<string, Visit[]>();
  for (const v of visits) {
    const key = `${v.managerEmail ?? v.managerName}__${fmtDate(v.checkInAt)}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(v);
  }
  const groups: DayGroup[] = [];
  map.forEach((dayVisits) => {
    const sorted = [...dayVisits].sort((a, b) => new Date(a.checkInAt).getTime() - new Date(b.checkInAt).getTime());
    const firstVisit = sorted[0];
    const lastVisit = sorted[sorted.length - 1];
    const totalDurationMin = sorted.reduce((acc, v) => acc + durationMin(v.checkInAt, v.checkOutAt), 0);
    const totalDistanceKm = sorted.reduce((acc, v) => acc + (v.distanceToPrevBranchKm ?? 0), 0);
    const isActive = sorted.some((v) => v.status === "checked_in");
    const dateStr = fmtDate(firstVisit.checkInAt);
    groups.push({
      date: dateStr,
      dateLabel: fmtDateLabel(dateStr),
      managerName: firstVisit.managerName,
      managerEmail: firstVisit.managerEmail,
      visits: sorted,
      firstVisit,
      lastVisit,
      isActive,
      totalDurationMin,
      totalDistanceKm,
    });
  });
  return groups.sort((a, b) => b.date.localeCompare(a.date));
}

// ─── Excel Export ─────────────────────────────────────────────────────────────
function exportToExcel(visits: Visit[], managerNameFilter: string, startDate: string, endDate: string) {
  const wb = XLSX.utils.book_new();
  const exportDate = format(new Date(), "yyyy-MM-dd HH:mm a", { locale: ar });

  const detailRows: any[][] = [
    ["نظام تتبع زيارات الفروع — سجل الزيارات الشامل"], [],
    ["معلومات التقرير:"],
    ["تاريخ الاستخراج", exportDate],
    ["الفترة", `من ${startDate || "البداية"} إلى ${endDate || "النهاية"}`],
    ["Manager", managerNameFilter || "كل Managerين"],
    ["Total Visits", visits.length], [],
    ["التاريخ", "اليوم", "اسم Manager", "الفرع", "كود الفرع", "وقت الدخول", "وقت الخروج", "المدة", "الحالة", "المسافة (كم)", "موقع وهمي؟", "ملاحظات"],
  ];

  const sorted = [...visits].sort((a, b) => new Date(a.checkInAt).getTime() - new Date(b.checkInAt).getTime());
  let currentDate = "";
  sorted.forEach((v) => {
    const vDate = fmtDate(v.checkInAt);
    const dur = durationMin(v.checkInAt, v.checkOutAt);
    if (currentDate !== "" && currentDate !== vDate) detailRows.push([]);
    currentDate = vDate;
    detailRows.push([
      vDate,
      format(new Date(v.checkInAt), "EEEE", { locale: ar }),
      v.managerName, v.branchName, v.branchCode,
      format(new Date(v.checkInAt), "hh:mm a"),
      v.checkOutAt ? format(new Date(v.checkOutAt), "hh:mm a") : "لم يغادر",
      v.checkOutAt ? fmtDuration(dur) : "—",
      v.status === "checked_in" ? "متواجد حالياً" : "انتهت الزيارة",
      v.distanceToPrevBranchKm != null ? `${v.distanceToPrevBranchKm} كم` : "—",
      v.isMocked === "yes" ? "⚠️ نعم" : "لا",
      v.notes ?? "—",
    ]);
  });

  const ws1 = XLSX.utils.aoa_to_sheet(detailRows);
  ws1["!cols"] = [{ wch: 14 }, { wch: 12 }, { wch: 25 }, { wch: 30 }, { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 15 }, { wch: 35 }];
  XLSX.utils.book_append_sheet(wb, ws1, "سجل الزيارات");

  const groups = groupVisits(visits);
  const summaryRows: any[][] = [
    ["نظام تتبع زيارات الفروع — ملخص Work Days"], [],
    ["التاريخ", "اليوم", "اسم Manager", "Total Visits", "أول فرع", "وقت البداية", "آخر فرع", "وقت النهاية", "إجمالي وقت التواجد", "Total Distance"],
  ];
  groups.forEach((g) => {
    summaryRows.push([
      g.date, g.dateLabel.split("،")[0], g.managerName, g.visits.length,
      g.firstVisit.branchName, fmtTime(g.firstVisit.checkInAt),
      g.lastVisit.branchName,
      g.lastVisit.checkOutAt ? fmtTime(g.lastVisit.checkOutAt) : "لم ينهِ",
      fmtDuration(g.totalDurationMin),
      g.totalDistanceKm > 0 ? `${g.totalDistanceKm} كم` : "—",
    ]);
  });
  const ws2 = XLSX.utils.aoa_to_sheet(summaryRows);
  ws2["!cols"] = [{ wch: 14 }, { wch: 10 }, { wch: 25 }, { wch: 15 }, { wch: 25 }, { wch: 12 }, { wch: 25 }, { wch: 12 }, { wch: 18 }, { wch: 15 }];
  XLSX.utils.book_append_sheet(wb, ws2, "ملخص الأيام");

  XLSX.writeFile(wb, `تقرير_زيارات_${startDate}_الى_${endDate}.xlsx`);
}

// ─── Day Card ─────────────────────────────────────────────────────────────────
function DayCard({ group }: { group: DayGroup }) {
  const [expanded, setExpanded] = useState(false);
  const todayFlag = isToday(new Date(group.date));
  const dayNum = format(new Date(group.date), "d");
  const dayName = format(new Date(group.date), "EEE", { locale: ar });

  return (
    <div className={`bg-white rounded-2xl overflow-hidden border transition-all duration-200 ${
      group.isActive ? "border-[#1F2937] shadow-sm" : "border-[#E5E7EB] hover:border-[#D1D5DB]"
    }`}>
      {/* Header */}
      <button onClick={() => setExpanded(p => !p)}
        className="w-full p-4 flex items-start gap-4 hover:bg-[#FAFAFA] transition-colors text-right">

        {/* Date Badge */}
        <div className={`flex-shrink-0 w-12 h-12 rounded-xl flex flex-col items-center justify-center border ${
          todayFlag ? "bg-[#18181B] border-[#18181B]" : "bg-[#FAFAFA] border-[#F4F4F5]"
        }`}>
          <span className={`text-[9px] font-semibold uppercase ${todayFlag ? "text-white/70" : "text-[#9CA3AF]"}`}>{dayName}</span>
          <span className={`text-[20px] font-bold leading-none font-mono ${todayFlag ? "text-white" : "text-[#111827]"}`}>{dayNum}</span>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 text-right">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-bold text-[15px] text-[#111827]" style={{ fontFamily: "'Cairo', sans-serif" }}>{group.managerName}</span>
            {group.isActive && (
              <span className="flex items-center gap-1 text-xs font-bold text-[#18181B] bg-[#F4F4F5] px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-[#18181B] animate-pulse inline-block" />
                نشط الآن
              </span>
            )}
            {todayFlag && !group.isActive && (
              <span className="text-[10px] font-bold text-[#059669] bg-[#ECFDF5] px-2 py-0.5 rounded-full">اليوم</span>
            )}
          </div>
          <div className="flex items-center gap-3 flex-wrap text-sm">
            <div className="flex items-center gap-1.5 text-[#6B7280]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#18181B]" />
              <span className="font-mono text-xs">{fmtTime(group.firstVisit.checkInAt)}</span>
              <span className="text-xs truncate max-w-[120px]">{group.firstVisit.branchName}</span>
            </div>
            {group.visits.length > 1 && (
              <>
                <span className="text-[#D1D5DB] text-xs">··· {group.visits.length} زيارات ···</span>
                <div className="flex items-center gap-1.5 text-[#6B7280]">
                  <span className={`w-1.5 h-1.5 rounded-full ${group.isActive ? "bg-[#18181B] animate-pulse" : "bg-[#DC2626]"}`} />
                  <span className="font-mono text-xs">{group.lastVisit.checkOutAt ? fmtTime(group.lastVisit.checkOutAt) : "لم ينهِ"}</span>
                  <span className="text-xs truncate max-w-[120px]">{group.lastVisit.branchName}</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Stats + Toggle */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="text-center hidden sm:block">
            <div className="font-bold text-xl text-[#18181B] font-mono">{group.visits.length}</div>
            <div className="text-[10px] text-[#9CA3AF] font-semibold">زيارة</div>
          </div>
          <div className="text-center hidden sm:block">
            <div className="font-bold text-sm text-[#111827] font-mono">{fmtDuration(group.totalDurationMin)}</div>
            <div className="text-[10px] text-[#9CA3AF] font-semibold">إجمالي</div>
          </div>
          {group.totalDistanceKm > 0 && (
            <div className="text-center hidden sm:block">
              <div className="font-bold text-sm text-[#0369A1] font-mono">{group.totalDistanceKm} كم</div>
              <div className="text-[10px] text-[#9CA3AF] font-semibold">مسافة</div>
            </div>
          )}
          <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
            expanded ? "bg-[#F4F4F5] text-[#18181B]" : "bg-[#F3F4F6] text-[#9CA3AF]"
          }`}>
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </div>
      </button>

      {/* Expanded Timeline */}
      {expanded && (
        <div className="px-5 pb-5 border-t border-[#F3F4F6]">
          <div className="pt-4 relative">
            {/* Timeline line */}
            <div className="absolute right-[27px] top-8 bottom-4 w-px bg-gradient-to-b from-[#71717A] via-[#F4F4F5] to-transparent" />

            <div className="space-y-4">
              {group.visits.map((v, idx) => {
                const dur = durationMin(v.checkInAt, v.checkOutAt);
                const isFirst = idx === 0;
                const isCheckedIn = v.status === "checked_in";
                return (
                  <div key={v.id} className="flex gap-4 relative">
                    {/* Node */}
                    <div className="flex-shrink-0 w-8 flex flex-col items-center">
                      <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center z-10 ${
                        isCheckedIn ? "border-[#18181B] bg-[#F4F4F5]" :
                        isFirst ? "border-[#059669] bg-[#ECFDF5]" : "border-[#E5E7EB] bg-white"
                      }`}>
                        <span className={`text-[11px] font-bold font-mono ${
                          isCheckedIn ? "text-[#18181B]" : isFirst ? "text-[#059669]" : "text-[#6B7280]"
                        }`}>{idx + 1}</span>
                      </div>
                    </div>

                    {/* Content */}
                    <div className={`flex-1 p-3 rounded-xl border transition-colors ${
                      isCheckedIn ? "border-[#71717A] bg-[#F4F4F5]" : "border-[#F3F4F6] bg-[#FAFAFA]"
                    }`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="font-bold text-sm text-[#111827]" style={{ fontFamily: "'Cairo', sans-serif" }}>{v.branchName}</span>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#F4F4F5] text-[#18181B] font-mono">{v.branchCode}</span>
                            {v.isMocked === "yes" && (
                              <span className="flex items-center gap-1 bg-red-100 text-red-700 text-[10px] font-bold px-1.5 py-0.5 rounded border border-red-200">
                                <span className="material-symbols-outlined text-[12px]">warning</span>
                                موقع وهمي
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 flex-wrap">
                            <div className="flex items-center gap-1">
                              <Clock className="w-3 h-3 text-[#18181B]" />
                              <span className="font-mono text-xs font-bold text-[#18181B]">{fmtTime(v.checkInAt)}</span>
                              <span className="text-[#9CA3AF] text-[10px]">دخل</span>
                            </div>
                            {v.checkOutAt && (
                              <div className="flex items-center gap-1">
                                <Clock className="w-3 h-3 text-[#DC2626]" />
                                <span className="font-mono text-xs font-bold text-[#DC2626]">{fmtTime(v.checkOutAt)}</span>
                                <span className="text-[#9CA3AF] text-[10px]">خرج</span>
                              </div>
                            )}
                            {dur > 0 && (
                              <span className="font-mono text-[11px] font-bold text-[#059669] bg-[#ECFDF5] px-1.5 py-0.5 rounded-full border border-[#D1FAE5]">
                                {fmtDuration(dur)}
                              </span>
                            )}
                            {v.distanceToPrevBranchKm != null && (
                              <span className="font-mono text-[11px] font-bold text-[#0369A1] bg-[#E0F2FE] px-1.5 py-0.5 rounded-full border border-[#BAE6FD] flex items-center gap-1">
                                <span className="material-symbols-outlined text-[11px]">directions_car</span>
                                {v.distanceToPrevBranchKm} كم
                              </span>
                            )}
                          </div>
                          {v.notes && <p className="mt-1 text-xs text-[#6B7280] italic">"{v.notes}"</p>}
                        </div>
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          {v.photoUrl && <Camera className="w-4 h-4 text-[#18181B]" />}
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            isCheckedIn ? "text-[#18181B] bg-[#F4F4F5] border-[#71717A]" : "text-[#DC2626] bg-[#FEE2E2] border-[#FECACA]"
                          }`}>
                            {isCheckedIn ? "داخل" : "غادر"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {!group.isActive && (
                <div className="flex gap-4 relative">
                  <div className="flex-shrink-0 w-8 flex items-center justify-center">
                    <div className="w-6 h-6 rounded-full border-2 border-dashed border-[#D1D5DB] flex items-center justify-center z-10 bg-white">
                      <CheckCircle2 className="w-3 h-3 text-[#9CA3AF]" />
                    </div>
                  </div>
                  <div className="flex-1 py-1 flex items-center gap-2">
                    <span className="text-xs text-[#9CA3AF]">انتهى اليوم</span>
                    <span className="text-xs font-bold text-[#059669] font-mono">· {fmtDuration(group.totalDurationMin)} إجمالي</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AdminReports() {
  const now = new Date();
  const [filters, setFilters] = useState({
    startDate: format(startOfMonth(now), "yyyy-MM-dd"),
    endDate: format(endOfMonth(now), "yyyy-MM-dd"),
    managerId: "",
  });
  const [exporting, setExporting] = useState(false);

  const { data: managers = [] } = trpc.manager.list.useQuery();
  const queryInput = {
    managerId: filters.managerId ? Number(filters.managerId) : undefined,
    startDate: filters.startDate || undefined,
    endDate: filters.endDate || undefined,
    limit: 1000,
    offset: 0,
  };
  const { data, isLoading } = trpc.visit.adminList.useQuery(queryInput);
  const visits: Visit[] = (data?.items ?? []) as Visit[];
  const dayGroups = useMemo(() => groupVisits(visits), [visits]);

  const checkedOut = visits.filter((v) => v.checkOutAt);
  const totalMinutes = checkedOut.reduce((acc, v) => acc + durationMin(v.checkInAt, v.checkOutAt), 0);
  const activeCount = visits.filter((v) => v.status === "checked_in").length;
  const monthLabel = filters.startDate
    ? format(new Date(filters.startDate), "MMMM yyyy", { locale: ar })
    : format(now, "MMMM yyyy", { locale: ar });

  const handleExport = () => {
    if (visits.length === 0) return;
    setExporting(true);
    try {
      const managerNameFilter = filters.managerId
        ? (managers as any[]).find(m => m.id.toString() === filters.managerId)?.userName || ""
        : "";
      exportToExcel(visits, managerNameFilter, filters.startDate, filters.endDate);
    } finally {
      setTimeout(() => setExporting(false), 500);
    }
  };

  const totalDistanceKm = dayGroups.reduce((acc, g) => acc + g.totalDistanceKm, 0);

  const statsData = [
    { icon: "calendar_month", label: "Work Days", value: isLoading ? "..." : dayGroups.length, color: "#18181B", bg: "#F4F4F5" },
    { icon: "location_on", label: "Total Visits", value: isLoading ? "..." : visits.length, color: "#059669", bg: "#ECFDF5" },
    { icon: "schedule", label: "Total Duration", value: isLoading ? "..." : fmtDuration(totalMinutes), color: "#D97706", bg: "#FEF3C7" },
    { icon: "directions_car", label: "Total Distance", value: isLoading ? "..." : totalDistanceKm > 0 ? `${totalDistanceKm} كم` : "—", color: "#0369A1", bg: "#E0F2FE" },
  ];

  return (
    <div className="min-h-full pb-24 md:pb-8">

      {/* Mobile Header */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-[#F3F4F6] md:hidden">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#6D28D9] to-[#71717A] flex items-center justify-center">
              <span className="material-symbols-outlined text-white text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>bar_chart</span>
            </div>
            <div>
              <h1 className="font-bold text-[15px] text-[#18181B] leading-none" style={{ fontFamily: "'Cairo', sans-serif" }}>Visit Reports</h1>
              <p className="text-[10px] text-[#9CA3AF] leading-none mt-0.5">{monthLabel}</p>
            </div>
          </div>
          <button onClick={handleExport} disabled={exporting || visits.length === 0 || isLoading}
            className="w-9 h-9 flex items-center justify-center text-[#18181B] hover:bg-[#F4F4F5] rounded-xl transition-colors disabled:opacity-40">
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          </button>
        </div>
      </header>

      <main className="px-4 md:px-8 pt-6 max-w-5xl mx-auto space-y-5">

        {/* Desktop Header */}
        <div className="hidden md:flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#111827]" style={{ fontFamily: "'Cairo', sans-serif" }}>Visit Reports</h1>
            <p className="text-[#6B7280] text-sm mt-1">{monthLabel}</p>
          </div>
          <button onClick={handleExport} disabled={exporting || visits.length === 0 || isLoading}
            className="h-11 px-6 flex items-center gap-2 rounded-2xl text-sm font-bold text-white bg-gradient-to-br from-[#6D28D9] to-[#71717A] hover:shadow-lg hover:shadow-[#71717A]/30 hover:scale-105 transition-all duration-200 cursor-pointer disabled:opacity-40">
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {exporting ? "Exporting......" : "Export Excel"}
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl p-5 border border-[#F4F4F5]">
          <div className="flex items-center gap-2 mb-4">
            <span className="material-symbols-outlined text-[#18181B] text-[18px]">tune</span>
            <span className="font-bold text-sm text-[#111827]" style={{ fontFamily: "'Cairo', sans-serif" }}>Report Filters</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              {
                label: "Manager",
                content: (
                  <div className="relative rounded-xl border border-[#E5E7EB] focus-within:border-[#18181B] focus-within:ring-2 focus-within:ring-[#18181B]/20 transition-all bg-white">
                    <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] text-[18px]">person</span>
                    <select className="w-full h-11 pr-10 pl-4 text-sm text-[#111827] bg-transparent outline-none rounded-xl cursor-pointer"
                      value={filters.managerId}
                      onChange={(e) => setFilters(f => ({ ...f, managerId: e.target.value }))}
                      style={{ fontFamily: "'Cairo', sans-serif" }}>
                      <option value="">كل Managerين</option>
                      {(managers as any[]).map((m: any) => (
                        <option key={m.id} value={m.id}>{m.userName}</option>
                      ))}
                    </select>
                  </div>
                )
              },
              {
                label: "From Date",
                content: (
                  <div className="relative rounded-xl border border-[#E5E7EB] focus-within:border-[#18181B] focus-within:ring-2 focus-within:ring-[#18181B]/20 transition-all bg-white">
                    <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] text-[18px]">calendar_today</span>
                    <input type="date" className="w-full h-11 pr-10 pl-4 text-sm text-[#111827] bg-transparent outline-none rounded-xl"
                      value={filters.startDate}
                      onChange={(e) => setFilters(f => ({ ...f, startDate: e.target.value }))} />
                  </div>
                )
              },
              {
                label: "To Date",
                content: (
                  <div className="relative rounded-xl border border-[#E5E7EB] focus-within:border-[#18181B] focus-within:ring-2 focus-within:ring-[#18181B]/20 transition-all bg-white">
                    <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] text-[18px]">event</span>
                    <input type="date" className="w-full h-11 pr-10 pl-4 text-sm text-[#111827] bg-transparent outline-none rounded-xl"
                      value={filters.endDate}
                      onChange={(e) => setFilters(f => ({ ...f, endDate: e.target.value }))} />
                  </div>
                )
              }
            ].map(({ label, content }) => (
              <div key={label}>
                <label className="block text-[#6B7280] text-xs font-semibold mb-1.5">{label}</label>
                {content}
              </div>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {statsData.map((s) => (
            <div key={s.label} className="bg-white rounded-2xl p-4 border border-[#F4F4F5]">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ background: s.bg }}>
                <span className="material-symbols-outlined text-[20px]" style={{ color: s.color, fontVariationSettings: "'FILL' 1" }}>{s.icon}</span>
              </div>
              <p className="font-bold text-2xl font-mono leading-none" style={{ color: s.color }}>{s.value}</p>
              <p className="text-[#9CA3AF] text-xs font-semibold mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Day Groups */}
        {isLoading ? (
          <div className="flex justify-center items-center py-24">
            <div className="text-center">
              <Loader2 className="w-10 h-10 animate-spin text-[#18181B] mx-auto mb-3" />
              <p className="text-[#6B7280] text-sm">Loading reports......</p>
            </div>
          </div>
        ) : dayGroups.length === 0 ? (
          <div className="bg-white rounded-2xl p-16 text-center border border-[#F4F4F5]">
            <div className="w-16 h-16 rounded-2xl bg-[#F4F4F5] flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-[#18181B] text-[32px]">bar_chart</span>
            </div>
            <p className="font-bold text-[#111827] text-base mb-2" style={{ fontFamily: "'Cairo', sans-serif" }}>No Visits Found</p>
            <p className="text-[#9CA3AF] text-sm">Try adjusting the date range or selecting a different manager.</p>
          </div>
        ) : (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[#9CA3AF] text-xs font-semibold">
                {dayGroups.length} work days — click to expand
              </span>
            </div>
            {dayGroups.map((g) => (
              <DayCard key={`${g.managerEmail}-${g.date}`} group={g} />
            ))}
          </section>
        )}
      </main>
    </div>
  );
}

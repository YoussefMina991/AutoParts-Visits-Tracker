import { useState, useEffect, useMemo } from "react";
import { Loader2, ChevronDown, ChevronUp, Download, Clock, Camera, CheckCircle2 } from "lucide-react";
import { useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { format, startOfMonth, endOfMonth, isToday } from "date-fns";
import { ar } from "date-fns/locale";
import * as XLSX from "xlsx";
import { useLang, type TFunc } from "@/lib/i18n";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Visit {
  id: number;
  checkInAt: Date | string;
  checkOutAt: Date | string | null;
  status: string;
  isMocked: "yes" | "no";
  photoUrl: string | null;
  notes: string | null;
  visitType: "branch" | "external_mission";
  noteType: "general" | "short_visit" | "non_primary" | "external_mission";
  branchName: string;
  branchCode: string;
  managerName: string;
  managerEmail: string | null;
  distanceToPrevBranchKm: number | null;
  mockReasons: string | null;
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

type Locale = typeof ar | undefined;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function durationMin(checkIn: Date | string, checkOut: Date | string | null): number {
  if (!checkOut) return 0;
  return Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 60000);
}
function fmtDuration(min: number, hUnit: string, mUnit: string): string {
  if (min === 0) return "—";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}${hUnit} ${m}${mUnit}` : `${m}${mUnit}`;
}
function fmtTime(dt: Date | string, locale: Locale): string {
  return format(new Date(dt), "hh:mm a", { locale });
}
function fmtDate(dt: Date | string): string {
  return format(new Date(dt), "yyyy-MM-dd");
}
function fmtDateLabel(dateStr: string, locale: Locale): string {
  return format(new Date(dateStr), "EEEE، d MMMM yyyy", { locale });
}

function parseMockReasons(reasonsStr: string | null): string[] {
  if (!reasonsStr) return [];
  try {
    return JSON.parse(reasonsStr);
  } catch {
    return [];
  }
}

function translateReason(r: string, t: TFunc): string {
  if (r.startsWith("TELEPORTATION")) return t("reason.teleportation");
  if (r.startsWith("SHORT_VISIT")) return t("reason.shortVisit");
  if (r === "ANDROID_IS_MOCK_API") return t("reason.fakeGps");
  if (r === "DEVELOPER_OPTIONS_ENABLED") return t("reason.devOptions");
  if (r === "MOCK_APP_INSTALLED") return t("reason.mockApp");
  if (r === "ACCURACY_ZERO" || r.startsWith("ACCURACY_TINY_INTEGER")) return t("reason.accuracy");
  if (r.startsWith("SUSPICIOUS_PROVIDER")) return t("reason.provider");
  if (r === "DIST_HAVERSINE_ESTIMATE") return t("reason.distEstimate");
  if (r === "SENSOR_STATIONARY_WHILE_GPS_MOVING") return t("reason.sensor");
  if (r === "SUSPICIOUS_LOCATION_EXTRAS") return t("reason.extras");
  return r; // Fallback
}

function groupVisits(visits: Visit[], locale: Locale): DayGroup[] {
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
      dateLabel: fmtDateLabel(dateStr, locale),
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
function exportToExcel(
  visits: Visit[],
  managerNameFilter: string,
  startDate: string,
  endDate: string,
  t: TFunc,
  locale: Locale,
  hUnit: string,
  mUnit: string
) {
  const wb = XLSX.utils.book_new();
  const exportDate = format(new Date(), "yyyy-MM-dd HH:mm a", { locale });

  const detailRows: any[][] = [
    [t("export.systemTitle")], [],
    [t("export.reportInfo")],
    [t("export.extractDate"), exportDate],
    [t("export.period"), `${t("export.from")} ${startDate || "—"} ${t("export.to")} ${endDate || "—"}`],
    [t("export.thManager"), managerNameFilter || t("export.allManagers")],
    [t("export.totalVisits"), visits.length], [],
    [t("export.thDate"), t("export.thDay"), t("export.thManager"), t("export.thBranch"), t("export.thBranchCode"), t("export.thCheckin"), t("export.thCheckout"), t("export.thDuration"), t("export.thStatus"), t("export.thDistance"), t("export.thMocked"), t("export.thNotes")],
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
      format(new Date(v.checkInAt), "EEEE", { locale }),
      v.managerName, v.branchName, v.branchCode,
      format(new Date(v.checkInAt), "hh:mm a"),
      v.checkOutAt ? format(new Date(v.checkOutAt), "hh:mm a") : t("export.notLeft"),
      v.checkOutAt ? fmtDuration(dur, hUnit, mUnit) : "—",
      v.status === "checked_in" ? t("export.statusPresent") : t("export.statusEnded"),
      v.distanceToPrevBranchKm != null ? `${v.distanceToPrevBranchKm} ${t("reports.km")}` : "—",
      v.isMocked === "yes" ? t("export.yes") : t("export.no"),
      v.notes ?? "—",
    ]);
  });

  const ws1 = XLSX.utils.aoa_to_sheet(detailRows);
  ws1["!cols"] = [{ wch: 14 }, { wch: 12 }, { wch: 25 }, { wch: 30 }, { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 15 }, { wch: 35 }];
  XLSX.utils.book_append_sheet(wb, ws1, t("export.sheetLog"));

  const groups = groupVisits(visits, locale);
  const summaryRows: any[][] = [
    [t("export.summaryTitle")], [],
    [t("export.thDate"), t("export.thDay"), t("export.thManager"), t("export.totalVisits"), t("export.thFirstBranch"), t("export.thStartTime"), t("export.thLastBranch"), t("export.thEndTime"), t("export.thTotalPresence"), t("reports.totalDistance")],
  ];
  groups.forEach((g) => {
    summaryRows.push([
      g.date, g.dateLabel.split("،")[0], g.managerName, g.visits.length,
      g.firstVisit.branchName, fmtTime(g.firstVisit.checkInAt, locale),
      g.lastVisit.branchName,
      g.lastVisit.checkOutAt ? fmtTime(g.lastVisit.checkOutAt, locale) : t("export.notFinished"),
      fmtDuration(g.totalDurationMin, hUnit, mUnit),
      g.totalDistanceKm > 0 ? `${g.totalDistanceKm} ${t("reports.km")}` : "—",
    ]);
  });
  const ws2 = XLSX.utils.aoa_to_sheet(summaryRows);
  ws2["!cols"] = [{ wch: 14 }, { wch: 10 }, { wch: 25 }, { wch: 15 }, { wch: 25 }, { wch: 12 }, { wch: 25 }, { wch: 12 }, { wch: 18 }, { wch: 15 }];
  XLSX.utils.book_append_sheet(wb, ws2, t("export.sheetDays"));

  XLSX.writeFile(wb, `${t("export.filePrefix")}_${startDate}_${t("export.fileTo")}_${endDate}.xlsx`);
}

// ─── Day Card ─────────────────────────────────────────────────────────────────
function DayCard({ group }: { group: DayGroup }) {
  const { t, lang } = useLang();
  const locale: Locale = lang === "ar" ? ar : undefined;
  const hUnit = t("time.hourShort");
  const mUnit = t("time.minShort");
  const [expanded, setExpanded] = useState(false);
  const todayFlag = isToday(new Date(group.date));
  const dayNum = format(new Date(group.date), "d");
  const dayName = format(new Date(group.date), "EEE", { locale });

  return (
    <div className={`bg-[var(--adm-surface)] rounded-2xl overflow-hidden border transition-all duration-200 ${
      group.isActive ? "border-[var(--adm-text-1)] shadow-sm" : "border-[var(--adm-border)] hover:border-[var(--adm-text-3)]"
    }`}>
      {/* Header */}
      <button onClick={() => setExpanded(p => !p)}
        className="w-full p-4 flex items-start gap-4 hover:bg-[var(--adm-chip)] transition-colors text-start">

        {/* Date Badge */}
        <div className={`flex-shrink-0 w-12 h-12 rounded-xl flex flex-col items-center justify-center border ${
          todayFlag ? "bg-[var(--adm-accent)] border-[var(--adm-accent)]" : "bg-[var(--adm-chip)] border-[var(--adm-bg)]"
        }`}>
          <span className={`text-[9px] font-semibold uppercase ${todayFlag ? "text-[var(--adm-accent-fg)]/70" : "text-[var(--adm-text-2)]"}`}>{dayName}</span>
          <span className={`text-[20px] font-bold leading-none font-mono ${todayFlag ? "text-[var(--adm-accent-fg)]" : "text-[var(--adm-text-1)]"}`}>{dayNum}</span>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 text-start">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-bold text-[15px] text-[var(--adm-text-1)]" style={{ fontFamily: "'Cairo', sans-serif" }}>{group.managerName}</span>
            {group.isActive && (
              <span className="flex items-center gap-1 text-xs font-bold text-[var(--adm-text-1)] bg-[var(--adm-bg)] px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--adm-accent)] animate-pulse inline-block" />
                {t("reports.activeNow")}
              </span>
            )}
            {todayFlag && !group.isActive && (
              <span className="text-[10px] font-bold text-[var(--adm-green)] bg-[var(--adm-green-soft)] px-2 py-0.5 rounded-full">{t("reports.today")}</span>
            )}
          </div>
          <div className="flex items-center gap-3 flex-wrap text-sm">
            <div className="flex items-center gap-1.5 text-[var(--adm-text-2)]">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--adm-accent)]" />
              <span className="font-mono text-xs">{fmtTime(group.firstVisit.checkInAt, locale)}</span>
              <span className="text-xs truncate max-w-[120px]">{group.firstVisit.branchName}</span>
            </div>
            {group.visits.length > 1 && (
              <>
                <span className="text-[var(--adm-text-3)] text-xs">··· {group.visits.length} {t("reports.visits")} ···</span>
                <div className="flex items-center gap-1.5 text-[var(--adm-text-2)]">
                  <span className={`w-1.5 h-1.5 rounded-full ${group.isActive ? "bg-[var(--adm-accent)] animate-pulse" : "bg-[var(--adm-red)]"}`} />
                  <span className="font-mono text-xs">{group.lastVisit.checkOutAt ? fmtTime(group.lastVisit.checkOutAt, locale) : t("reports.notFinished")}</span>
                  <span className="text-xs truncate max-w-[120px]">{group.lastVisit.branchName}</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Stats + Toggle */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="text-center hidden sm:block">
            <div className="font-bold text-xl text-[var(--adm-text-1)] font-mono">{group.visits.length}</div>
            <div className="text-[10px] text-[var(--adm-text-2)] font-semibold">{t("reports.visit")}</div>
          </div>
          <div className="text-center hidden sm:block">
            <div className="font-bold text-sm text-[var(--adm-text-1)] font-mono">{fmtDuration(group.totalDurationMin, hUnit, mUnit)}</div>
            <div className="text-[10px] text-[var(--adm-text-2)] font-semibold">{t("reports.total")}</div>
          </div>
          {group.totalDistanceKm > 0 && (
            <div className="text-center hidden sm:block">
              <div className="font-bold text-sm text-[var(--adm-blue)] font-mono">{group.totalDistanceKm} {t("reports.km")}</div>
              <div className="text-[10px] text-[var(--adm-text-2)] font-semibold">{t("reports.distance")}</div>
            </div>
          )}
          <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
            expanded ? "bg-[var(--adm-bg)] text-[var(--adm-text-1)]" : "bg-[var(--adm-bg)] text-[var(--adm-text-2)]"
          }`}>
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </div>
      </button>

      {/* Expanded Timeline */}
      {expanded && (
        <div className="px-5 pb-5 border-t border-[var(--adm-bg)]">
          <div className="pt-4 relative">
            {/* Timeline line */}
            <div className="absolute end-[27px] top-8 bottom-4 w-px bg-gradient-to-b from-[var(--adm-text-2)] via-[var(--adm-bg)] to-transparent" />

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
                        isCheckedIn ? "border-[var(--adm-text-2)] bg-[var(--adm-bg)]" :
                        isFirst ? "border-[var(--adm-green)] bg-[var(--adm-green-soft)]" : "border-[var(--adm-border)] bg-[var(--adm-surface)]"
                      }`}>
                        <span className={`text-[11px] font-bold font-mono ${
                          isCheckedIn ? "text-[var(--adm-text-1)]" : isFirst ? "text-[var(--adm-green)]" : "text-[var(--adm-text-2)]"
                        }`}>{idx + 1}</span>
                      </div>
                    </div>

                    {/* Content */}
                    <div className={`flex-1 p-3 rounded-xl border transition-colors ${
                      isCheckedIn ? "border-[var(--adm-text-2)] bg-[var(--adm-bg)]" : "border-[var(--adm-border)] bg-[var(--adm-chip)]"
                    }`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="font-bold text-sm text-[var(--adm-text-1)]" style={{ fontFamily: "'Cairo', sans-serif" }}>{v.branchName ?? t("reports.externalMission")}</span>
                            {v.branchCode && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[var(--adm-bg)] text-[var(--adm-text-1)] font-mono">{v.branchCode}</span>
                            )}
                            {v.visitType === "external_mission" && (
                              <span className="bg-purple-100 text-purple-700 text-[10px] font-bold px-1.5 py-0.5 rounded border border-purple-200">{t("reports.externalMission")}</span>
                            )}
                            {v.noteType === "short_visit" && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border" style={{ background: "var(--adm-red-soft)", color: "var(--adm-red)", borderColor: "var(--adm-red-soft-border)" }}>{t("reports.shortVisit")}</span>
                            )}
                            {v.isMocked === "yes" && (
                              <span className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded border" style={{ background: "var(--adm-red-soft)", color: "var(--adm-red)", borderColor: "var(--adm-red-soft-border)" }}>
                                <span className="material-symbols-outlined text-[12px]">warning</span>
                                {t("reports.spoofedVisit")}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 flex-wrap">
                            <div className="flex items-center gap-1">
                              <Clock className="w-3 h-3 text-[var(--adm-text-1)]" />
                              <span className="font-mono text-xs font-bold text-[var(--adm-text-1)]">{fmtTime(v.checkInAt, locale)}</span>
                              <span className="text-[var(--adm-text-2)] text-[10px]">{t("reports.checkin")}</span>
                            </div>
                            {v.checkOutAt && (
                              <div className="flex items-center gap-1">
                                <Clock className="w-3 h-3 text-[var(--adm-red)]" />
                                <span className="font-mono text-xs font-bold text-[var(--adm-red)]">{fmtTime(v.checkOutAt, locale)}</span>
                                <span className="text-[var(--adm-text-2)] text-[10px]">{t("reports.checkout")}</span>
                              </div>
                            )}
                            {dur > 0 && (
                              <span className="font-mono text-[11px] font-bold px-1.5 py-0.5 rounded-full border" style={{ color: "var(--adm-green)", background: "var(--adm-green-soft)", borderColor: "var(--adm-green-soft-border)" }}>
                                {fmtDuration(dur, hUnit, mUnit)}
                              </span>
                            )}
                            {v.distanceToPrevBranchKm != null && (
                              <span className="font-mono text-[11px] font-bold px-1.5 py-0.5 rounded-full border flex items-center gap-1" style={{ color: "var(--adm-blue)", background: "var(--adm-blue-soft)", borderColor: "var(--adm-blue-soft-border)" }}>
                                <span className="material-symbols-outlined text-[11px]">directions_car</span>
                                {v.distanceToPrevBranchKm} {t("reports.km")}
                              </span>
                            )}
                          </div>

                          {v.isMocked === "yes" && v.mockReasons && (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {parseMockReasons(v.mockReasons).map((r, i) => (
                                <span key={i} className="text-[10px] font-semibold px-2 py-0.5 rounded border flex items-center gap-1" style={{ color: "var(--adm-red)", background: "var(--adm-red-soft)", borderColor: "var(--adm-red-soft-border)" }}>
                                  <span className="w-1 h-1 rounded-full" style={{ background: "var(--adm-red)" }}></span>
                                  {translateReason(r, t)}
                                </span>
                              ))}
                            </div>
                          )}

                          {v.notes && (
                            <p className="mt-1 text-xs text-[var(--adm-text-2)] bg-[var(--adm-surface)] p-2 rounded-md border border-[var(--adm-border)] shadow-sm whitespace-pre-wrap border-s-2 border-s-[#0fa5f8]">
                              {v.notes}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          {v.photoUrl && <Camera className="w-4 h-4 text-[var(--adm-text-1)]" />}
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            isCheckedIn
                              ? "text-[var(--adm-text-1)] bg-[var(--adm-bg)] border-[var(--adm-text-2)]"
                              : "border-[var(--adm-red-soft-border)]"
                          }`}
                            style={!isCheckedIn ? { color: "var(--adm-red)", background: "var(--adm-red-soft)" } : undefined}
                          >
                            {isCheckedIn ? t("reports.statusIn") : t("reports.statusOut")}
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
                    <div className="w-6 h-6 rounded-full border-2 border-dashed border-[var(--adm-text-3)] flex items-center justify-center z-10 bg-[var(--adm-surface)]">
                      <CheckCircle2 className="w-3 h-3 text-[var(--adm-text-2)]" />
                    </div>
                  </div>
                  <div className="flex-1 py-1 flex items-center gap-2">
                    <span className="text-xs text-[var(--adm-text-2)]">{t("reports.dayEnded")}</span>
                    <span className="text-xs font-bold text-[var(--adm-green)] font-mono">· {fmtDuration(group.totalDurationMin, hUnit, mUnit)} {t("reports.total")}</span>
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
  const { t, lang } = useLang();
  const locale: Locale = lang === "ar" ? ar : undefined;
  const hUnit = t("time.hourShort");
  const mUnit = t("time.minShort");

  const now = new Date();
  const [filters, setFilters] = useState({
    startDate: format(startOfMonth(now), "yyyy-MM-dd"),
    endDate: format(endOfMonth(now), "yyyy-MM-dd"),
    managerId: "",
  });
  const [exporting, setExporting] = useState(false);

  // ── Deep-link: /reports?managerId=<n> pre-filters the manager dropdown (Part B)
  const searchString = useSearch();
  useEffect(() => {
    const params = new URLSearchParams(searchString);
    const mid = params.get("managerId");
    if (mid && /^\d+$/.test(mid)) {
      setFilters((f) => (f.managerId === mid ? f : { ...f, managerId: mid }));
    }
  }, [searchString]);

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
  const dayGroups = useMemo(() => groupVisits(visits, locale), [visits, locale]);

  const checkedOut = visits.filter((v) => v.checkOutAt);
  const totalMinutes = checkedOut.reduce((acc, v) => acc + durationMin(v.checkInAt, v.checkOutAt), 0);
  const activeCount = visits.filter((v) => v.status === "checked_in").length;
  const monthLabel = filters.startDate
    ? format(new Date(filters.startDate), "MMMM yyyy", { locale })
    : format(now, "MMMM yyyy", { locale });

  const handleExport = () => {
    if (visits.length === 0) return;
    setExporting(true);
    try {
      const managerNameFilter = filters.managerId
        ? (managers as any[]).find(m => m.id.toString() === filters.managerId)?.userName || ""
        : "";
      exportToExcel(visits, managerNameFilter, filters.startDate, filters.endDate, t, locale, hUnit, mUnit);
    } finally {
      setTimeout(() => setExporting(false), 500);
    }
  };

  const totalDistanceKm = dayGroups.reduce((acc, g) => acc + g.totalDistanceKm, 0);

  const statsData = [
    { icon: "calendar_month", label: t("reports.workDays"), value: isLoading ? "..." : dayGroups.length, color: "var(--adm-text-1)", bg: "var(--adm-bg)" },
    { icon: "location_on", label: t("reports.totalVisits"), value: isLoading ? "..." : visits.length, color: "var(--adm-green)", bg: "var(--adm-green-soft)" },
    { icon: "schedule", label: t("reports.totalDuration"), value: isLoading ? "..." : fmtDuration(totalMinutes, hUnit, mUnit), color: "var(--adm-amber)", bg: "var(--adm-amber-soft)" },
    { icon: "directions_car", label: t("reports.totalDistance"), value: isLoading ? "..." : totalDistanceKm > 0 ? `${totalDistanceKm} ${t("reports.km")}` : "—", color: "var(--adm-blue)", bg: "var(--adm-blue-soft)" },
  ];

  return (
    <div className="min-h-full pb-24 md:pb-8">

      {/* Mobile Header */}
      <header className="sticky top-0 z-30 bg-[var(--adm-surface)]/90 backdrop-blur border-b border-[var(--adm-border)] md:hidden">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#6D28D9] to-[#71717A] flex items-center justify-center">
              <span className="material-symbols-outlined text-white text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>bar_chart</span>
            </div>
            <div>
              <h1 className="font-bold text-[15px] text-[var(--adm-text-1)] leading-none" style={{ fontFamily: "'Cairo', sans-serif" }}>{t("reports.title")}</h1>
              <p className="text-[10px] text-[var(--adm-text-2)] leading-none mt-0.5">{monthLabel}</p>
            </div>
          </div>
          <button onClick={handleExport} disabled={exporting || visits.length === 0 || isLoading}
            className="w-9 h-9 flex items-center justify-center text-[var(--adm-text-1)] hover:bg-[var(--adm-bg)] rounded-xl transition-colors disabled:opacity-40">
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          </button>
        </div>
      </header>

      <main className="px-4 md:px-8 pt-6 max-w-5xl mx-auto space-y-5">

        {/* Desktop Header */}
        <div className="hidden md:flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[var(--adm-text-1)]" style={{ fontFamily: "'Cairo', sans-serif" }}>{t("reports.title")}</h1>
            <p className="text-[var(--adm-text-2)] text-sm mt-1">{monthLabel}</p>
          </div>
          <button onClick={handleExport} disabled={exporting || visits.length === 0 || isLoading}
            className="h-11 px-6 flex items-center gap-2 rounded-2xl text-sm font-bold text-white bg-gradient-to-br from-[#6D28D9] to-[#71717A] hover:shadow-lg hover:shadow-[#71717A]/30 hover:scale-105 transition-all duration-200 cursor-pointer disabled:opacity-40">
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {exporting ? t("reports.exporting") : t("reports.exportExcel")}
          </button>
        </div>

        {/* Filters */}
        <div className="bg-[var(--adm-surface)] rounded-2xl p-5 border border-[var(--adm-border)]">
          <div className="flex items-center gap-2 mb-4">
            <span className="material-symbols-outlined text-[var(--adm-text-1)] text-[18px]">tune</span>
            <span className="font-bold text-sm text-[var(--adm-text-1)]" style={{ fontFamily: "'Cairo', sans-serif" }}>{t("reports.filters")}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              {
                label: t("reports.manager"),
                content: (
                  <div className="relative rounded-xl border border-[var(--adm-border)] focus-within:border-[var(--adm-text-1)] focus-within:ring-2 focus-within:ring-[var(--adm-text-1)]/20 transition-all bg-[var(--adm-surface)]">
                    <span className="material-symbols-outlined absolute start-3 top-1/2 -translate-y-1/2 text-[var(--adm-text-2)] text-[18px]">person</span>
                    <select className="w-full h-11 ps-10 pe-4 text-sm text-[var(--adm-text-1)] bg-transparent outline-none rounded-xl cursor-pointer"
                      value={filters.managerId}
                      onChange={(e) => setFilters(f => ({ ...f, managerId: e.target.value }))}
                      style={{ fontFamily: "'Cairo', sans-serif" }}>
                      <option value="">{t("reports.allManagers")}</option>
                      {(managers as any[]).map((m: any) => (
                        <option key={m.id} value={m.id}>{m.userName}</option>
                      ))}
                    </select>
                  </div>
                )
              },
              {
                label: t("reports.fromDate"),
                content: (
                  <div className="relative rounded-xl border border-[var(--adm-border)] focus-within:border-[var(--adm-text-1)] focus-within:ring-2 focus-within:ring-[var(--adm-text-1)]/20 transition-all bg-[var(--adm-surface)]">
                    <span className="material-symbols-outlined absolute start-3 top-1/2 -translate-y-1/2 text-[var(--adm-text-2)] text-[18px]">calendar_today</span>
                    <input type="date" className="w-full h-11 ps-10 pe-4 text-sm text-[var(--adm-text-1)] bg-transparent outline-none rounded-xl"
                      value={filters.startDate}
                      onChange={(e) => setFilters(f => ({ ...f, startDate: e.target.value }))} />
                  </div>
                )
              },
              {
                label: t("reports.toDate"),
                content: (
                  <div className="relative rounded-xl border border-[var(--adm-border)] focus-within:border-[var(--adm-text-1)] focus-within:ring-2 focus-within:ring-[var(--adm-text-1)]/20 transition-all bg-[var(--adm-surface)]">
                    <span className="material-symbols-outlined absolute start-3 top-1/2 -translate-y-1/2 text-[var(--adm-text-2)] text-[18px]">event</span>
                    <input type="date" className="w-full h-11 ps-10 pe-4 text-sm text-[var(--adm-text-1)] bg-transparent outline-none rounded-xl"
                      value={filters.endDate}
                      onChange={(e) => setFilters(f => ({ ...f, endDate: e.target.value }))} />
                  </div>
                )
              }
            ].map(({ label, content }) => (
              <div key={label}>
                <label className="block text-[var(--adm-text-2)] text-xs font-semibold mb-1.5">{label}</label>
                {content}
              </div>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {statsData.map((s) => (
            <div key={s.label} className="bg-[var(--adm-surface)] rounded-2xl p-4 border border-[var(--adm-border)]">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ background: s.bg }}>
                <span className="material-symbols-outlined text-[20px]" style={{ color: s.color, fontVariationSettings: "'FILL' 1" }}>{s.icon}</span>
              </div>
              <p className="font-bold text-2xl font-mono leading-none" style={{ color: s.color }}>{s.value}</p>
              <p className="text-[var(--adm-text-2)] text-xs font-semibold mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Day Groups */}
        {isLoading ? (
          <div className="flex justify-center items-center py-24">
            <div className="text-center">
              <Loader2 className="w-10 h-10 animate-spin text-[var(--adm-text-1)] mx-auto mb-3" />
              <p className="text-[var(--adm-text-2)] text-sm">{t("reports.loading")}</p>
            </div>
          </div>
        ) : dayGroups.length === 0 ? (
          <div className="bg-[var(--adm-surface)] rounded-2xl p-16 text-center border border-[var(--adm-border)]">
            <div className="w-16 h-16 rounded-2xl bg-[var(--adm-bg)] flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-[var(--adm-text-1)] text-[32px]">bar_chart</span>
            </div>
            <p className="font-bold text-[var(--adm-text-1)] text-base mb-2" style={{ fontFamily: "'Cairo', sans-serif" }}>{t("reports.noVisits")}</p>
            <p className="text-[var(--adm-text-2)] text-sm">{t("reports.noVisitsHint")}</p>
          </div>
        ) : (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[var(--adm-text-2)] text-xs font-semibold">
                {t("reports.workDaysHint", { n: dayGroups.length })}
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

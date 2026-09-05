import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { getDistanceMeters } from "../../../shared/utils";
import { useGeofenceContext } from "@/App";
import { Link } from "wouter";
import { Loader2 } from "lucide-react";
import { MapView, MapMarker, GeofenceCircle, type MapCenter } from "@/components/Map";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Capacitor } from "@capacitor/core";

export default function BranchCheckIn() {
  const [view, setView] = useState<"list" | "map">("map");
  const [fly, setFly] = useState<MapCenter | null>(null);
  const didAutoFlyRef = useRef(false);

  const [notesModalState, setNotesModalState] = useState<{
    isOpen: boolean;
    type: "check_in_branch" | "check_in_external" | "check_out_short" | "check_out_general";
    branchId?: number;
  }>({ isOpen: false, type: "check_in_branch" });
  const [visitNotes, setVisitNotes] = useState("");

  const isWebPlatform = !Capacitor.isNativePlatform();

  // ── Block Android browser users — they must use the native app ──────────────
  const isAndroidBrowser = isWebPlatform &&
    /android/i.test(navigator.userAgent);

  const { latestLocation } = useGeofenceContext();
  const gpsLocation = latestLocation ? { lat: latestLocation.lat, lon: latestLocation.lon } : null;
  const globalMockedStatus = latestLocation?.isMocked ?? false;

  const { data: assignedBranches = [] } = trpc.manager.getMyBranches.useQuery();
  const { data: visitsData, refetch: refetchVisits } = trpc.visit.myHistory.useQuery({ limit: 5, offset: 0 });
  const activeVisit = visitsData?.items?.find((v: any) => v.status === "checked_in") ?? null;
  const checkInMutation = trpc.visit.checkIn.useMutation();
  const checkOutMutation = trpc.visit.checkOut.useMutation();

  // أول ما يوصل أول إشارة GPS → طيّر الخريطة على مكانك تلقائياً
  useEffect(() => {
    if (gpsLocation && !didAutoFlyRef.current) {
      didAutoFlyRef.current = true;
      setFly({ lat: gpsLocation.lat, lng: gpsLocation.lon });
    }
  }, [gpsLocation]);

  const branchesWithDistance = (assignedBranches as any[]).map((b) => {
    const dist = gpsLocation
      ? getDistanceMeters(gpsLocation.lat, gpsLocation.lon, parseFloat(b.latitude), parseFloat(b.longitude))
      : Infinity;
    return {
      ...b,
      distanceM: dist,
      inRange: gpsLocation ? dist <= (b.geofenceRadiusMeters || 200) : false,
      status: activeVisit?.branchId === b.id ? "visited" : "pending",
    };
  });

  const sortedBranches = [...branchesWithDistance].sort(
    (a, b) => (a.distanceM === Infinity ? 1 : a.distanceM) - (b.distanceM === Infinity ? 1 : b.distanceM)
  );
  const closestBranch = sortedBranches[0];

  const openCheckInModal = (branchId: number) => {
    if (!gpsLocation) return toast.error("لسه بنحدد موقعك — استنى ثواني");
    if (globalMockedStatus) {
      return toast.error("🚨 الموقع وهمي! اقفل اي برنامج Fake GPS وحاول تاني");
    }
    setNotesModalState({ isOpen: true, type: "check_in_branch", branchId });
    setVisitNotes("");
  };

  const openExternalMissionModal = () => {
    if (!gpsLocation) return toast.error("لسه بنحدد موقعك — استنى ثواني");
    if (globalMockedStatus) {
      return toast.error("🚨 الموقع وهمي! اقفل اي برنامج Fake GPS وحاول تاني");
    }
    setNotesModalState({ isOpen: true, type: "check_in_external" });
    setVisitNotes("");
  };


  const handleManualCheckOutClick = () => {
    if (!activeVisit) return;
    const durationMin = (new Date().getTime() - new Date(activeVisit.checkInAt).getTime()) / 60000;
    
    // إذا كانت الزيارة أقل من 20 دقيقة (وتشمل 7 لـ 20 دقيقة كما طلب المستخدم)
    if (durationMin < 20) {
      setNotesModalState({ isOpen: true, type: "check_out_short" });
      setVisitNotes("");
    } else {
      setNotesModalState({ isOpen: true, type: "check_out_general" });
      setVisitNotes("");
    }
  };

  const submitModal = async () => {
    const { type, branchId } = notesModalState;
    if (type === "check_in_external" && !visitNotes.trim()) {
      return toast.error("برجاء إدخال تفاصيل المأمورية الخارجية");
    }
    if (type === "check_out_short" && !visitNotes.trim() && !isWebPlatform) {
      return toast.error("برجاء إدخال سبب قصر مدة الزيارة");
    }

    // الصورة المحفوظة من شاشة الـ Selfie تم إيقافها
    
    try {
      if (type === "check_in_branch") {
        if (!branchId) return;
        const branchName = sortedBranches.find((b) => b.id === branchId)?.name ?? "";
        await checkInMutation.mutateAsync({
          branchId,
          latitude: gpsLocation!.lat.toString(),
          longitude: gpsLocation!.lon.toString(),
          isMocked: globalMockedStatus,
          visitType: "branch",
          noteType: "general",
          manual: true,
          notes: visitNotes.trim() || undefined,
        });
        toast.success(`✅ تم تسجيل دخولك في ${branchName}`);
        refetchVisits();
      } else if (type === "check_in_external") {
        await checkInMutation.mutateAsync({
          latitude: gpsLocation!.lat.toString(),
          longitude: gpsLocation!.lon.toString(),
          isMocked: globalMockedStatus,
          visitType: "external_mission",
          noteType: "external_mission",
          notes: visitNotes.trim(),
        });
        toast.success(`✅ تم بدء مأمورية خارجية بنجاح`);
        refetchVisits();
      } else if (type === "check_out_short" || type === "check_out_general") {
        // null guard: لو إحنا بينما المودال مفتوحة وبيتم refetch وتغيرت حالة الزيارة
        if (!activeVisit) {
          toast.error("انتهت الجلسة من تلقاء نفسها");
          setNotesModalState({ ...notesModalState, isOpen: false });
          return;
        }
        await checkOutMutation.mutateAsync({ 
          visitId: activeVisit.id,
          notes: visitNotes.trim() || undefined,
          noteType: type === "check_out_short" ? "short_visit" : undefined,
        });
        toast.success("🔴 تم تسجيل خروجك — سلامات!");
        refetchVisits();
      }
      setNotesModalState({ isOpen: false, type: "check_in_branch" });
    } catch (err: any) {
      toast.error(`❌ حدث خطأ: ${err.message || String(err)}`);
    }
  };

  const formatDistance = (m: number): string => {
    if (!isFinite(m)) return "--";
    return m < 1000 ? `${Math.round(m)} م` : `${(m / 1000).toFixed(1)} كم`;
  };

  const gpsDenied = !gpsLocation;

  // ── Block Android browser: show friendly redirect screen ──────────────────
  if (isAndroidBrowser) {
    return (
      <div style={{
        minHeight: "100svh",
        background: "#111417",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px 24px",
        textAlign: "center",
        gap: 20,
        color: "#fff",
        fontFamily: "'Cairo', sans-serif",
      }}>
        <div style={{
          width: 80, height: 80, borderRadius: "50%",
          background: "linear-gradient(135deg, #1a2236, #0fa5f833)",
          border: "2px solid #0fa5f8",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 40, marginBottom: 8,
        }}>
          📱
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>
          استخدم التطبيق على أندرويد
        </h2>
        <p style={{ fontSize: 14, color: "rgba(255,255,255,0.6)", lineHeight: 1.8, maxWidth: 300 }}>
          هذا الرابط مخصص لمستخدمي iPhone فقط.
          على أندرويد، يجب استخدام <strong style={{ color: "#0fa5f8" }}>التطبيق المُثبَّت</strong> على هاتفك للتسجيل.
        </p>
        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", marginTop: 8 }}>
          إذا واجهت مشكلة، تواصل مع مديرك المباشر.
        </p>
      </div>
    );
  }

  return (
    <>
      <style>{`
        .blue-dot-map-page {
          min-height: 100svh;
          background-color: #0b1326;
          color: #ffffff;
          font-family: 'Cairo', 'Inter', sans-serif;
          position: relative;
          overflow: hidden;
          isolation: isolate;
          z-index: 0;
        }

        .top-bar {
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 60px;
          padding: 0 20px;
          padding-top: env(safe-area-inset-top, 0px);
          display: flex;
          justify-content: space-between;
          align-items: center;
          z-index: 1000;
          background: linear-gradient(to bottom, rgba(11,19,38,0.9), transparent);
        }
        .top-bar-title { font-size: 16px; font-weight: 700; }

        .icon-btn {
          width: 40px; height: 40px;
          display: flex; align-items: center; justify-content: center;
          border-radius: 50%;
          background: rgba(30,34,40,0.85);
          border: 1px solid rgba(255,255,255,0.08);
          color: #fff;
          cursor: pointer;
        }

        .floating-sidebar {
          position: absolute;
          left: 16px;
          top: 40%;
          transform: translateY(-50%);
          display: flex;
          flex-direction: column;
          gap: 12px;
          z-index: 1000;
        }
        .sidebar-btn {
          width: 44px; height: 44px;
          border-radius: 12px;
          background: rgba(30, 34, 40, 0.9);
          border: 1px solid rgba(255,255,255,0.08);
          display: flex; align-items: center; justify-content: center;
          color: #fff;
          backdrop-filter: blur(8px);
          cursor: pointer;
          transition: background 0.2s;
        }
        .sidebar-btn:hover { background: rgba(30, 34, 40, 1); }
        .sidebar-btn.active { background: #0fa5f8; }

        .gps-chip {
          position: absolute;
          top: 70px;
          right: 16px;
          z-index: 1000;
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          border-radius: 10px;
          background: rgba(30,34,40,0.9);
          border: 1px solid rgba(255,255,255,0.08);
          font-size: 11px;
          font-weight: 600;
        }
        
        .external-mission-btn {
          position: absolute;
          top: 70px;
          left: 16px;
          z-index: 1000;
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          border-radius: 10px;
          background: rgba(139, 92, 246, 0.9);
          border: 1px solid rgba(255,255,255,0.2);
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          color: white;
          box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);
          transition: all 0.2s;
        }
        .external-mission-btn:hover { background: rgba(139, 92, 246, 1); transform: translateY(-1px); }
        .external-mission-btn:active { transform: translateY(1px); }

        .bottom-card-container {
          position: absolute;
          bottom: 90px;
          left: 0; right: 0;
          padding: 0 20px;
          z-index: 1000;
        }

        .check-in-card {
          background: rgba(30, 34, 40, 0.97);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 24px;
          padding: 22px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.5);
        }
        .card-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 18px; }
        .branch-info h2 { font-size: 17px; font-weight: 700; margin: 0 0 4px 0; }
        .branch-info p { font-size: 12px; color: rgba(255,255,255,0.5); margin: 0; }

        .action-button {
          width: 100%;
          height: 52px;
          border-radius: 14px;
          font-size: 15px;
          font-weight: 700;
          display: flex; align-items: center; justify-content: center; gap: 8px;
          border: none;
          cursor: pointer;
          transition: transform 0.2s;
        }
        .action-button:active { transform: scale(0.98); }
        .btn-cyan { background: #0fa5f8; color: #fff; }
        .btn-red { background: rgba(239,68,68,0.12); color: #ef4444; border: 1px solid rgba(239,68,68,0.35); }

        .confirm-row { display: flex; gap: 10px; }
        .confirm-row .action-button { height: 46px; font-size: 13px; }
        .btn-confirm-no { flex: 1; background: rgba(255,255,255,0.08); color: #fff; }
        .btn-confirm-yes { flex: 2; background: #ef4444; color: #fff; }

        /* ── قائمة الفروع ── */
        .branches-scroll {
          position: absolute;
          top: 60px; bottom: 200px; left: 0; right: 0;
          overflow-y: auto;
          padding: 12px 16px;
          z-index: 500;
        }
        .branch-row {
          display: flex;
          align-items: center;
          gap: 12px;
          background: rgba(30,34,40,0.95);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 16px;
          padding: 14px;
          margin-bottom: 10px;
        }
        .branch-row-info { flex: 1; min-width: 0; }
        .branch-row-info h4 { font-size: 14px; font-weight: 700; margin: 0 0 3px 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .branch-row-info p { font-size: 11px; color: rgba(255,255,255,0.45); margin: 0; }
        .dist-chip {
          font-size: 11px; font-weight: 700;
          padding: 4px 10px;
          border-radius: 8px;
          white-space: nowrap;
        }
        .mini-checkin-btn {
          border: none;
          background: #0fa5f8;
          color: #fff;
          font-size: 12px;
          font-weight: 700;
          padding: 8px 14px;
          border-radius: 10px;
          cursor: pointer;
          white-space: nowrap;
        }
        .mini-checkin-btn:disabled { opacity: 0.4; cursor: not-allowed; }

        .map-overlay-gps {
          position: absolute;
          inset: 0;
          z-index: 800;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          background: rgba(11,19,38,0.75);
          backdrop-filter: blur(4px);
          text-align: center;
          padding: 24px;
        }
      `}</style>

      <div className="blue-dot-map-page">
        {/* ── الخريطة الحقيقية ── */}
        {view === "map" && (
          <div className="absolute inset-0">
            <MapView
              initialCenter={{ lat: 30.0444, lng: 31.2357 }}
              initialZoom={gpsLocation ? 16 : 11}
              flyTo={fly}
              flyToZoom={16}
              className="h-full w-full"
            >
              {branchesWithDistance.map((b: any) =>
                b.latitude && b.longitude ? (
                  <GeofenceCircle
                    key={`c-${b.id}`}
                    lat={parseFloat(b.latitude)}
                    lng={parseFloat(b.longitude)}
                    radiusMeters={b.geofenceRadiusMeters || 200}
                    color="#0fa5f8"
                    inRange={b.inRange}
                  />
                ) : null
              )}
              {branchesWithDistance.map((b: any) =>
                b.latitude && b.longitude ? (
                  <MapMarker
                    key={`m-${b.id}`}
                    lat={parseFloat(b.latitude)}
                    lng={parseFloat(b.longitude)}
                    label={`${b.inRange ? "✅" : ""} ${b.name}`}
                    color={activeVisit?.branchId === b.id ? "#34d399" : "#0fa5f8"}
                  />
                ) : null
              )}
              {gpsLocation && (
                <MapMarker lat={gpsLocation.lat} lng={gpsLocation.lon} label="أنت" color="#f59e0b" />
              )}
            </MapView>
          </div>
        )}

        {/* ── قائمة الفروع ── */}
        {view === "list" && (
          <div className="branches-scroll">
            {sortedBranches.map((b: any) => (
              <div key={b.id} className="branch-row">
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: 26, color: b.inRange ? "#34d399" : "rgba(255,255,255,0.35)" }}
                >
                  {b.status === "visited" ? "check_circle" : b.inRange ? "location_on" : "location_off"}
                </span>
                <div className="branch-row-info">
                  <h4>{b.name}</h4>
                  <p>{b.address || formatDistance(b.distanceM)}</p>
                </div>
                <span
                  className="dist-chip"
                  style={{
                    background: b.inRange ? "rgba(52,211,153,0.12)" : "rgba(255,255,255,0.06)",
                    color: b.inRange ? "#34d399" : "rgba(255,255,255,0.55)",
                  }}
                >
                  {formatDistance(b.distanceM)}
                </span>
                {!activeVisit && b.inRange && (
                  <button
                    className="mini-checkin-btn"
                    onClick={() => openCheckInModal(b.id)}
                    disabled={checkInMutation.isPending}
                  >
                    دخول
                  </button>
                )}
              </div>
            ))}
            {sortedBranches.length === 0 && (
              <p style={{ textAlign: "center", marginTop: 60, fontSize: 13, color: "rgba(255,255,255,0.4)" }}>
                مفيش فروع مسندة لك حالياً
              </p>
            )}
          </div>
        )}

        {/* ── شريط علوي ── */}
        <div className="top-bar">
          <Link href="/">
            <a className="icon-btn">
              <span className="material-symbols-outlined">arrow_forward</span>
            </a>
          </Link>
          <div className="top-bar-title">الفروع القريبة</div>
          <button
            className={`sidebar-btn ${view === "list" ? "active" : ""}`}
            style={{ width: 40, height: 40 }}
            onClick={() => setView(view === "list" ? "map" : "list")}
            title="تبديل بين الخريطة والقائمة"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
              {view === "list" ? "map" : "list"}
            </span>
          </button>
        </div>

        {/* حالة الـ GPS الحقيقية */}
        {view === "map" && gpsLocation && (
          <div className="gps-chip">
            <span style={{ color: "#34d399" }}>●</span>
            دقة الموقع
            <span style={{ color: "#fff", fontFamily: "monospace" }}>
              ±{latestLocation?.accuracy ? Math.round(latestLocation.accuracy) : "?"} م
            </span>
          </div>
        )}

        {/* زر المأمورية الخارجية - يظهر دائمًا */}
        {!activeVisit && gpsLocation && (
          <button 
            className="external-mission-btn" 
            onClick={openExternalMissionModal}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>explore</span>
            مأمورية خارجية
          </button>
        )}

        {/* زرار موقعي */}
        {view === "map" && (
          <div className="floating-sidebar">
            <button
              className="sidebar-btn"
              onClick={() => {
                if (gpsLocation) {
                  setFly({ lat: gpsLocation.lat, lng: gpsLocation.lon });
                  toast.info("تم تثبيت الخريطة على موقعك");
                } else {
                  toast.error("لسه بنحدد موقعك — استنى ثواني");
                }
              }}
              title="موقعي"
            >
              <span className="material-symbols-outlined">my_location</span>
            </button>
          </div>
        )}

        {/* أوفرلاي انتظار/مشكلة الـ GPS — يختفي لو في زيارة نشطة */}
        {view === "map" && !gpsLocation && !activeVisit && (
          <div className="map-overlay-gps">
            <Loader2 className="w-8 h-8 animate-spin text-[#0fa5f8]" />
            <p style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>جاري تحديد موقعك...</p>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", margin: 0, lineHeight: 1.8 }}>
              لو استغرق وقت طويل، اتأكد إن صلاحية الموقع مفتوحة للتطبيق<br />
              (الإعدادات ← التطبيقات ← Branch Tracker ← الأذونات ← الموقع)
            </p>
          </div>
        )}

        {/* ── الكارت السفلي ── */}
        <div className="bottom-card-container">
          <div className="check-in-card">
            <div className="card-header">
              <div className="branch-info">
                <h2>
                  {activeVisit
                    ? (activeVisit.branchName || "مأمورية خارجية")
                    : (closestBranch?.name || "مفيش فروع قريبة")}
                </h2>
                <p>
                  {gpsLocation
                    ? activeVisit
                      ? `انت مسجل حالياً في ${activeVisit.branchName || "مأمورية خارجية"}`
                      : closestBranch?.inRange
                        ? "✅ انت داخل نطاق الفرع — تقدر تسجل دخول"
                        : `أقرب فرع على بعد ${formatDistance(closestBranch?.distanceM ?? Infinity)}`
                    : "في وضعية تحديد الموقع..."}
                </p>
              </div>
            </div>

            {activeVisit ? (
              <button
                className="action-button btn-red"
                onClick={handleManualCheckOutClick}
                disabled={checkOutMutation.isPending}
              >
                {checkOutMutation.isPending ? <Loader2 className="animate-spin" /> : "تسجيل الخروج"}
              </button>
            ) : (
              <button
                className="action-button btn-cyan"
                onClick={() => closestBranch && openCheckInModal(closestBranch.id)}
                disabled={!closestBranch || !closestBranch.inRange || checkInMutation.isPending}
                title={!closestBranch?.inRange ? "لازم تكون داخل نطاق الفرع الأول" : ""}
              >
                {checkInMutation.isPending ? (
                  <Loader2 className="animate-spin" />
                ) : closestBranch?.inRange ? (
                  "تسجيل الدخول هنا"
                ) : (
                  "اقترب من الفرع لتسجيل الدخول"
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* مودال النوتس */}
      <Dialog open={notesModalState.isOpen} onOpenChange={(open) => {
        if (!open) setNotesModalState({ ...notesModalState, isOpen: false });
      }}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>
              {notesModalState.type === "check_in_external" && "تفاصيل المأمورية الخارجية"}
              {notesModalState.type === "check_in_branch" && "تسجيل زيارة فرع"}
              {notesModalState.type === "check_out_short" && "توضيح سبب الزيارة القصيرة"}
              {notesModalState.type === "check_out_general" && "تسجيل الخروج"}
            </DialogTitle>
            <DialogDescription>
              {notesModalState.type === "check_in_external" && "أدخل الوجهة أو سبب المأمورية الخارجية لتوثيقها."}
              {notesModalState.type === "check_in_branch" && "يمكنك كتابة ملاحظات إضافية لهذه الزيارة (اختياري)."}
              {notesModalState.type === "check_out_short" && "مدة الزيارة كانت قصيرة جداً. يجب توضيح السبب لمديرك."}
              {notesModalState.type === "check_out_general" && "هل تريد إضافة ملاحظات عن هذه الزيارة قبل الخروج؟ (اختياري)"}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <Textarea
              placeholder={notesModalState.type === "check_in_branch" || notesModalState.type === "check_out_general" ? "ملاحظات اختيارية..." : "اكتب التفاصيل هنا..."}
              value={visitNotes}
              onChange={(e) => setVisitNotes(e.target.value)}
              className="min-h-[120px] resize-none focus-visible:ring-[#0fa5f8]"
            />
          </div>
          <DialogFooter>
            <button
              onClick={submitModal}
              disabled={checkInMutation.isPending || checkOutMutation.isPending}
              className="w-full bg-[#0fa5f8] hover:bg-[#0fa5f8]/90 text-white font-bold py-3 px-4 rounded-xl flex justify-center items-center gap-2"
            >
              {(checkInMutation.isPending || checkOutMutation.isPending) && <Loader2 className="animate-spin w-5 h-5" />}
              {notesModalState.type === "check_in_branch" ? "تسجيل الدخول الآن" : 
               (notesModalState.type === "check_out_short" || notesModalState.type === "check_out_general") ? "تأكيد وتسجيل الخروج" : "بدء المأمورية"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </>
  );
}

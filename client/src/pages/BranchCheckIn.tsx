import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { getDistanceMeters } from "../../../shared/utils";
import { useGeofenceContext } from "@/App";
import { Link } from "wouter";
import { Loader2 } from "lucide-react";

export default function BranchCheckIn() {
  const [view, setView] = useState<"list" | "map">("map");

  const { latestLocation } = useGeofenceContext();
  const gpsLocation = latestLocation ? { lat: latestLocation.lat, lon: latestLocation.lon } : null;
  const globalMockedStatus  = latestLocation?.isMocked ?? false;

  const { data: assignedBranches = [] } = trpc.manager.getMyBranches.useQuery();
  const { data: visitsData, refetch: refetchVisits } = trpc.visit.myHistory.useQuery({ limit: 5, offset: 0 });
  const activeVisit = visitsData?.items?.find((v: any) => v.status === "checked_in") ?? null;
  const checkInMutation = trpc.visit.checkIn.useMutation();
  const checkOutMutation = trpc.visit.checkOut.useMutation();

  const branchesWithDistance = (assignedBranches as any[]).map((b) => {
    const dist = gpsLocation
      ? getDistanceMeters(gpsLocation.lat, gpsLocation.lon, parseFloat(b.latitude), parseFloat(b.longitude))
      : Infinity;
    return { ...b, distanceM: dist, status: activeVisit?.branchId === b.id ? "visited" : "pending" };
  });

  const sortedBranches = [...branchesWithDistance].sort((a, b) => a.distanceM - b.distanceM);
  const closestBranch = sortedBranches[0];

  const handleManualCheckIn = async (branchId: number) => {
    if (!gpsLocation) return toast.error("جاري تحديد الموقع...");
    try {
      await checkInMutation.mutateAsync({
        branchId,
        latitude: gpsLocation.lat.toString(),
        longitude: gpsLocation.lon.toString(),
        isMocked: globalMockedStatus,
      });
      toast.success(`✅ Check-in successful at ${sortedBranches.find(b=>b.id===branchId)?.name}`);
      refetchVisits();
    } catch (err: any) {
      toast.error(`❌ Check-in failed: ${err.message || String(err)}`);
    }
  };

  const handleManualCheckOut = async () => {
    if (!activeVisit) return;
    try {
      await checkOutMutation.mutateAsync({ visitId: activeVisit.id });
      toast.success("🔴 Check-out successful!");
      refetchVisits();
    } catch (err: any) {
      toast.error(`❌ Check-out failed: ${err.message || String(err)}`);
    }
  };

  return (
    <>
      <style>{`
        .blue-dot-map-page {
          min-height: 100svh;
          background-color: #0b1326; /* Deep dark blue map background */
          color: #ffffff;
          font-family: 'Inter', 'Fira Sans', sans-serif;
          position: relative;
          overflow: hidden;
        }

        /* Fake Map Grid Background */
        .map-grid-bg {
          position: absolute;
          inset: 0;
          background-image: 
            linear-gradient(rgba(15,165,248,0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(15,165,248,0.05) 1px, transparent 1px);
          background-size: 40px 40px;
          z-index: 0;
        }

        .map-glow {
          position: absolute;
          top: 30%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 500px;
          height: 500px;
          background: radial-gradient(circle, rgba(15,165,248,0.15) 0%, rgba(15,165,248,0) 60%);
          border-radius: 50%;
          pointer-events: none;
          z-index: 0;
        }

        /* Top Bar */
        .top-bar {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 60px;
          padding: 0 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          z-index: 10;
          background: linear-gradient(to bottom, rgba(11,19,38,0.8), transparent);
        }
        .top-bar-title {
          font-size: 16px;
          font-weight: 600;
        }

        .icon-btn {
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          background: rgba(30,34,40,0.6);
          border: 1px solid rgba(255,255,255,0.05);
          color: #fff;
          cursor: pointer;
        }

        /* Floating Action Sidebar (Right) */
        .floating-sidebar {
          position: absolute;
          right: 20px;
          top: 50%;
          transform: translateY(-50%);
          display: flex;
          flex-direction: column;
          gap: 16px;
          z-index: 10;
        }
        .sidebar-btn {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          background: rgba(30, 34, 40, 0.85);
          border: 1px solid rgba(255,255,255,0.05);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          backdrop-filter: blur(8px);
          cursor: pointer;
          transition: background 0.2s;
        }
        .sidebar-btn:hover {
          background: rgba(30, 34, 40, 1);
        }

        /* Pins */
        .map-pin {
          position: absolute;
          transform: translate(-50%, -50%);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          z-index: 5;
        }
        .pin-marker {
          width: 32px;
          height: 32px;
          background: #0fa5f8;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          box-shadow: 0 4px 12px rgba(15,165,248,0.4);
          border: 2px solid #fff;
        }
        .pin-marker.user-pin {
          background: #34d399; /* Green for user/car */
          box-shadow: 0 4px 12px rgba(52,211,153,0.4);
        }
        
        /* Bottom Info Card */
        .bottom-card-container {
          position: absolute;
          bottom: 90px; /* Above bottom nav */
          left: 0;
          right: 0;
          padding: 0 20px;
          z-index: 10;
        }

        .check-in-card {
          background: rgba(30, 34, 40, 0.95);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255,255,255,0.05);
          border-radius: 24px;
          padding: 24px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.5);
        }

        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 20px;
        }
        
        .branch-info h2 {
          font-size: 18px;
          font-weight: 600;
          margin: 0 0 4px 0;
        }
        .branch-info p {
          font-size: 12px;
          color: rgba(255,255,255,0.5);
          margin: 0;
        }

        .action-button {
          width: 100%;
          height: 52px;
          border-radius: 12px;
          font-size: 15px;
          font-weight: 600;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          border: none;
          cursor: pointer;
          transition: transform 0.2s;
        }
        .action-button:active {
          transform: scale(0.98);
        }
        .btn-cyan {
          background: #0fa5f8;
          color: #fff;
        }
        .btn-red {
          background: rgba(239, 68, 68, 0.15);
          color: #ef4444;
          border: 1px solid rgba(239, 68, 68, 0.3);
        }
      `}</style>

      <div className="blue-dot-map-page">
        <div className="map-grid-bg" />
        <div className="map-glow" />

        {/* Top Bar */}
        <div className="top-bar">
          <Link href="/">
            <a className="icon-btn">
              <span className="material-symbols-outlined">arrow_back</span>
            </a>
          </Link>
          <div className="top-bar-title">Locations</div>
          <button className="icon-btn">
            <span className="material-symbols-outlined">search</span>
          </button>
        </div>

        {/* Floating Right Sidebar */}
        <div className="floating-sidebar">
          <button className="sidebar-btn" onClick={() => setView(view === "list" ? "map" : "list")}>
            <span className="material-symbols-outlined">{view === "list" ? "map" : "list"}</span>
          </button>
          <button className="sidebar-btn">
            <span className="material-symbols-outlined">tune</span>
          </button>
          <button className="sidebar-btn">
            <span className="material-symbols-outlined">my_location</span>
          </button>
        </div>

        {/* Map Pins Simulation */}
        {view === "map" && (
          <>
            {/* User Pin */}
            <div className="map-pin" style={{ left: "50%", top: "75%" }}>
              <div className="pin-marker user-pin">
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>person</span>
              </div>
            </div>

            {/* Branches Pins */}
            {sortedBranches.slice(0, 3).map((b, i) => {
              const positions = [
                { left: "30%", top: "40%" },
                { left: "70%", top: "25%" },
                { left: "80%", top: "55%" },
              ];
              return (
                <div key={b.id} className="map-pin" style={positions[i]}>
                  <div className="pin-marker">
                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>storefront</span>
                  </div>
                </div>
              );
            })}
          </>
        )}

        {/* Bottom Action Card (Closest Branch) */}
        <div className="bottom-card-container">
          <div className="check-in-card">
            <div className="card-header">
              <div className="branch-info">
                <h2>{closestBranch?.name || "No branches found"}</h2>
                <p>
                  {gpsLocation 
                    ? (closestBranch?.distanceM < 1000 ? `${Math.round(closestBranch.distanceM)} m away` : `${(closestBranch.distanceM / 1000).toFixed(1)} km away`)
                    : "Fetching GPS..."}
                </p>
              </div>
              <div className="icon-btn" style={{ background: 'transparent' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 24, color: '#0fa5f8' }}>route</span>
              </div>
            </div>

            {activeVisit ? (
              <button 
                className="action-button btn-red"
                onClick={handleManualCheckOut}
                disabled={checkOutMutation.isPending}
              >
                {checkOutMutation.isPending ? <Loader2 className="animate-spin" /> : "Check Out"}
              </button>
            ) : (
              <button 
                className="action-button btn-cyan"
                onClick={() => closestBranch && handleManualCheckIn(closestBranch.id)}
                disabled={!closestBranch || checkInMutation.isPending}
              >
                {checkInMutation.isPending ? <Loader2 className="animate-spin" /> : "Check In"}
              </button>
            )}
          </div>
        </div>

      </div>
    </>
  );
}

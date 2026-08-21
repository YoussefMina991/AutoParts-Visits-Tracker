import { useEffect, useState } from "react";
import localforage from "localforage";

// ─── Offline stores ─────────────────────────────────
const locationStore = localforage.createInstance({
  name: "branch-tracker",
  storeName: "offline_locations",
});

const visitStore = localforage.createInstance({
  name: "branch-tracker",
  storeName: "offline_visits",
});

interface PendingVisit {
  type: "check_in" | "check_out";
  branchName: string;
  checkInAt?: string;
  checkOutAt?: string;
  localId?: string;
  localCheckInId?: string;
}

interface PendingLocation {
  latitude: string;
  longitude: string;
  timestamp: string;
}

interface VaultItem {
  id: string;
  type: "check-in" | "check-out" | "gps";
  branchName: string;
  recordedAt: string;
  payloadCount?: number;
}

export function OfflineVault() {
  const [items, setItems] = useState<VaultItem[]>([]);
  const [gpsPoints, setGpsPoints] = useState(0);

  useEffect(() => {
    async function load() {
      const visits = (await visitStore.getItem<PendingVisit[]>("queue")) || [];
      const locs = (await locationStore.getItem<PendingLocation[]>("queue")) || [];

      const vaultItems: VaultItem[] = visits.map((v, i) => ({
        id: `v${i}`,
        type: v.type === "check_in" ? "check-in" : "check-out",
        branchName: v.branchName,
        recordedAt: v.type === "check_in" ? v.checkInAt ?? "" : v.checkOutAt ?? "",
      }));

      if (locs.length > 0) {
        vaultItems.push({
          id: "gps",
          type: "gps",
          branchName: "GPS Trail Tracking",
          recordedAt: locs.length > 0 ? locs[0].timestamp.slice(11, 16) : "",
          payloadCount: locs.length,
        });
      }

      setItems(vaultItems);
      setGpsPoints(locs.length);
    }
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      <style>{`
        .vault-container {
          padding: 0 24px;
          position: relative;
          z-index: 1;
        }

        .vault-card {
          background: rgba(30, 34, 40, 0.6);
          border: 1px solid rgba(255,255,255,0.05);
          border-radius: 20px;
          padding: 24px;
          margin-bottom: 24px;
        }

        .vault-header {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 20px;
        }

        .vault-icon-wrapper {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          background: rgba(15,165,248,0.1);
          color: #0fa5f8;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .vault-header h2 {
          font-size: 16px;
          font-weight: 600;
          margin: 0 0 4px 0;
          color: #ffffff;
        }

        .vault-header p {
          font-size: 12px;
          color: rgba(255,255,255,0.5);
          margin: 0;
        }

        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          border-radius: 8px;
          font-size: 11px;
          font-weight: 500;
          margin-left: auto;
        }
        .status-badge.synced {
          background: rgba(52,211,153,0.1);
          color: #34d399;
        }
        .status-badge.queued {
          background: rgba(245, 158, 11, 0.1);
          color: #f59e0b;
        }
        .status-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
        }
        .status-dot.synced { background: #34d399; }
        .status-dot.queued { background: #f59e0b; }

        .items-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-top: 20px;
        }

        .vault-item {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.02);
          border-radius: 12px;
          padding: 12px 16px;
          display: flex;
          align-items: center;
          gap: 12px;
        }
        
        .item-icon {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: rgba(15,165,248,0.1);
          color: #0fa5f8;
          font-size: 10px;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .item-content {
          flex: 1;
        }
        .item-content h4 {
          font-size: 13px;
          font-weight: 500;
          color: #fff;
          margin: 0 0 2px 0;
        }
        .item-content p {
          font-size: 11px;
          color: rgba(255,255,255,0.5);
          margin: 0;
        }

        .item-meta {
          font-size: 11px;
          color: rgba(15,165,248,0.8);
          font-weight: 500;
        }

        .auto-sync-banner {
          margin-top: 24px;
          background: rgba(15,165,248,0.05);
          border: 1px solid rgba(15,165,248,0.1);
          border-radius: 12px;
          padding: 16px;
          display: flex;
          align-items: center;
          gap: 12px;
        }
        
        .sync-progress-bar {
          flex: 1;
          height: 4px;
          background: rgba(255,255,255,0.1);
          border-radius: 2px;
          position: relative;
          overflow: hidden;
        }
        .sync-progress-fill {
          position: absolute;
          top: 0;
          left: 0;
          height: 100%;
          width: 30%;
          background: #0fa5f8;
          border-radius: 2px;
          animation: slideRight 2s infinite ease-in-out;
        }
        
        @keyframes slideRight {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(400%); }
        }

        .sync-status-text {
          font-size: 11px;
          color: #0fa5f8;
          font-weight: 500;
        }
      `}</style>

      <div className="vault-container">
        <div className="vault-card">
          <div className="vault-header">
            <div className="vault-icon-wrapper">
              <span className="material-symbols-outlined">cloud_off</span>
            </div>
            <div>
              <h2>Offline Storage</h2>
              <p>Safe & secure data vault</p>
            </div>
            {items.length === 0 ? (
              <div className="status-badge synced">
                <span className="status-dot synced" /> All Synced
              </div>
            ) : (
              <div className="status-badge queued">
                <span className="status-dot queued" /> {items.length} Queued
              </div>
            )}
          </div>

          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5, margin: 0 }}>
            {items.length === 0 
              ? "Your device is fully synced with the cloud. No pending offline data." 
              : `${items.filter((i) => i.type !== "gps").length} events and ${gpsPoints.toLocaleString()} GPS points are stored safely on your device.`}
          </p>

          {items.length > 0 && (
            <div className="items-list">
              {items.map((item) => (
                <div key={item.id} className="vault-item">
                  <div className="item-icon">
                    {item.type === "gps" ? "GPS" : item.type === "check-in" ? "IN" : "OUT"}
                  </div>
                  <div className="item-content">
                    <h4>{item.type === "check-in" ? "Check-in" : item.type === "check-out" ? "Check-out" : "GPS Trail"}</h4>
                    <p>{item.branchName}</p>
                  </div>
                  {item.payloadCount && (
                    <div className="item-meta">{item.payloadCount} pts</div>
                  )}
                </div>
              ))}
            </div>
          )}

          {items.length > 0 && (
            <div className="auto-sync-banner">
              <div className="sync-progress-bar">
                <div className="sync-progress-fill" />
              </div>
              <span className="sync-status-text">Auto-sync armed</span>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

import { trpc } from "@/lib/trpc";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";

export default function VisitHistory() {
  const { user } = useAuth();
  const { data: visitsData, isLoading } = trpc.visit.myHistory.useQuery({ limit: 50, offset: 0 });
  // صورة المدير بتتخزن في جدول managers مش users
  const { data: managerProfile } = trpc.manager.getCurrentManager.useQuery();
  const photoUrl = managerProfile?.photoUrl ?? null;
  const visits = (visitsData?.items ?? []) as any[];

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ background: '#111417' }}>
        <Loader2 className="w-8 h-8 animate-spin text-[#0fa5f8]" />
      </div>
    );
  }

  const totalDistance = visits.reduce((acc, v) => acc + (parseFloat(v.distanceToPrevBranchKm) || 0), 0).toFixed(1);

  return (
    <>
      <style>{`
        .blue-dot-history {
          min-height: 100svh;
          background-color: #111417;
          color: #ffffff;
          font-family: 'Inter', 'Fira Sans', sans-serif;
          padding: 20px;
          padding-bottom: 100px;
        }

        .header-section {
          margin-bottom: 24px;
          margin-top: 20px;
        }
        .header-section h1 {
          font-size: 24px;
          font-weight: 700;
          margin: 0 0 4px 0;
        }
        .header-section p {
          font-size: 12px;
          color: rgba(255,255,255,0.5);
          margin: 0;
        }

        /* Wallet/Summary Card */
        .wallet-card {
          background: linear-gradient(135deg, rgba(15,165,248,0.2) 0%, rgba(30, 34, 40, 0.8) 100%);
          border: 1px solid rgba(15,165,248,0.2);
          border-radius: 20px;
          padding: 24px;
          margin-bottom: 24px;
          position: relative;
          overflow: hidden;
        }
        .wallet-card::after {
          content: '';
          position: absolute;
          top: -50px;
          right: -50px;
          width: 150px;
          height: 150px;
          background: radial-gradient(circle, rgba(15,165,248,0.2) 0%, rgba(15,165,248,0) 70%);
          border-radius: 50%;
        }
        .card-brand {
          font-size: 24px;
          font-weight: 800;
          color: #0fa5f8;
          margin-bottom: 16px;
        }
        .card-user-info h3 {
          font-size: 14px;
          font-weight: 600;
          margin: 0 0 2px 0;
        }
        .card-user-info p {
          font-size: 11px;
          color: rgba(255,255,255,0.5);
          margin: 0 0 16px 0;
        }
        .card-stats {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
        }
        .card-stats h4 {
          font-size: 11px;
          color: rgba(255,255,255,0.6);
          margin: 0 0 4px 0;
          font-weight: 500;
        }
        .card-stats .value {
          font-size: 24px;
          font-weight: 700;
        }
        .card-stats .date {
          font-size: 11px;
          color: rgba(255,255,255,0.4);
        }

        /* Actions Row */
        .actions-row {
          display: flex;
          gap: 16px;
          margin-bottom: 30px;
        }
        .action-box {
          flex: 1;
          background: rgba(30, 34, 40, 0.6);
          border: 1px solid rgba(255,255,255,0.05);
          border-radius: 16px;
          padding: 12px;
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .action-box .icon {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: rgba(15,165,248,0.1);
          color: #0fa5f8;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .action-box .text {
          font-size: 13px;
          font-weight: 500;
        }

        /* Tabs */
        .tabs {
          display: flex;
          background: rgba(30, 34, 40, 0.6);
          border-radius: 12px;
          padding: 4px;
          margin-bottom: 24px;
        }
        .tab {
          flex: 1;
          text-align: center;
          padding: 10px 0;
          font-size: 13px;
          font-weight: 500;
          border-radius: 8px;
          cursor: pointer;
          color: rgba(255,255,255,0.5);
          transition: all 0.2s;
        }
        .tab.active {
          background: #0fa5f8;
          color: #fff;
        }

        /* List */
        .list-header {
          display: flex;
          justify-content: space-between;
          font-size: 11px;
          color: rgba(255,255,255,0.4);
          margin-bottom: 12px;
          padding: 0 4px;
        }
        
        .history-item {
          display: flex;
          align-items: center;
          gap: 16px;
          background: rgba(30, 34, 40, 0.4);
          border: 1px solid rgba(255,255,255,0.02);
          border-radius: 16px;
          padding: 16px;
          margin-bottom: 12px;
        }
        .item-icon {
          width: 40px;
          height: 40px;
          border-radius: 12px;
          background: rgba(255,255,255,0.05);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .item-details {
          flex: 1;
        }
        .item-details h4 {
          font-size: 14px;
          font-weight: 600;
          margin: 0 0 4px 0;
        }
        .item-details p {
          font-size: 11px;
          color: rgba(255,255,255,0.5);
          margin: 0;
        }
        .item-status {
          text-align: right;
        }
        .item-status .time {
          font-size: 12px;
          font-weight: 600;
          margin-bottom: 4px;
          display: block;
        }
        .item-status .tag {
          font-size: 10px;
          padding: 2px 8px;
          border-radius: 4px;
          background: rgba(52,211,153,0.1);
          color: #34d399;
        }
      `}</style>

      <div className="blue-dot-history">
        <div className="header-section">
          <h1>History</h1>
          <p>View your field visit service history</p>
        </div>

        {/* Summary Card mimicking the Blue Dot Wallet Card */}
        <div className="wallet-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <div className="card-brand" style={{ marginBottom: 0 }}>AP</div>
            {photoUrl ? (
              <img
                src={photoUrl.startsWith('http') ? photoUrl : `${import.meta.env.VITE_API_URL || ''}${photoUrl}`}
                alt="Profile"
                style={{ width: '48px', height: '48px', borderRadius: '12px', border: '1px solid rgba(15,165,248,0.5)', objectFit: 'cover', background: 'rgba(15,165,248,0.1)' }}
              />
            ) : (
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(15,165,248,0.1)', border: '1px solid rgba(15,165,248,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0fa5f8', fontWeight: 'bold', fontSize: '20px' }}>
                {user?.username?.charAt(0).toUpperCase() || "M"}
              </div>
            )}
          </div>
          <div className="card-user-info">
            <h3>{user?.name || user?.username || "Manager"}</h3>
            <p>{user?.email || "manager@autoparts.com"}</p>
          </div>
          <div className="card-stats">
            <div>
              <h4>Total Visits</h4>
              <div className="value">{visits.length} <span style={{fontSize: 14, fontWeight: 500}}>Visits</span></div>
            </div>
            <div className="date">
              {format(new Date(), "MM/dd/yyyy")}
            </div>
          </div>
        </div>

        <div className="actions-row">
          <div className="action-box">
            <div className="icon"><span className="material-symbols-outlined">directions_car</span></div>
            <div className="text">{totalDistance} km</div>
          </div>
          <div className="action-box">
            <div className="icon"><span className="material-symbols-outlined">analytics</span></div>
            <div className="text">Manage</div>
          </div>
        </div>

        <div className="tabs">
          <div className="tab active">Completed</div>
          <div className="tab">Pending</div>
        </div>

        <div className="list-header">
          <span>March 2026 ▾</span>
          <span>Duration ▾</span>
        </div>

        <div className="history-list">
          {visits.length === 0 ? (
            <div style={{ textAlign: 'center', marginTop: 40, color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>
              No history available
            </div>
          ) : (
            visits.map((visit) => {
              const checkInTime = new Date(visit.checkInAt);
              return (
                <div key={visit.id} className="history-item">
                  <div className="item-icon">
                    <span className="material-symbols-outlined" style={{ color: 'rgba(255,255,255,0.7)' }}>store</span>
                  </div>
                  <div className="item-details">
                    <h4>{visit.branchName}</h4>
                    <p>{format(checkInTime, "MMM dd, yyyy")}</p>
                  </div>
                  <div className="item-status">
                    <span className="time">{format(checkInTime, "hh:mm a")}</span>
                    <span className="tag" style={{
                      background: visit.status === 'checked_in' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(52,211,153,0.1)',
                      color: visit.status === 'checked_in' ? '#f59e0b' : '#34d399'
                    }}>
                      {visit.status === 'checked_in' ? 'Active' : 'Done'}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}

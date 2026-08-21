import { useAuth } from "@/_core/hooks/useAuth";
import { Link } from "wouter";

export default function ManagerDashboard() {
  const { user } = useAuth();

  return (
    <>
      <style>{`
        .blue-dot-dashboard {
          min-height: 100svh;
          background-color: #111417; /* Deep black/gray */
          color: #ffffff;
          font-family: 'Inter', 'Fira Sans', sans-serif;
          position: relative;
          overflow-y: auto;
          overflow-x: hidden;
          padding-bottom: 100px;
        }

        /* Top Cyan Glow */
        .dashboard-glow {
          position: absolute;
          top: -100px;
          right: -50px;
          width: 300px;
          height: 300px;
          background: radial-gradient(circle, rgba(15,165,248,0.25) 0%, rgba(15,165,248,0) 70%);
          border-radius: 50%;
          pointer-events: none;
          z-index: 0;
        }

        .header-section {
          padding: 40px 24px 20px;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          position: relative;
          z-index: 1;
        }

        .greeting h2 {
          font-size: 16px;
          font-weight: 400;
          color: rgba(255,255,255,0.8);
          margin: 0 0 4px 0;
        }
        .greeting h1 {
          font-size: 28px;
          font-weight: 700;
          margin: 0;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .notification-btn {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          background: rgba(30, 34, 40, 0.6);
          border: 1px solid rgba(255,255,255,0.05);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #0fa5f8;
          cursor: pointer;
        }

        .hero-banner {
          position: relative;
          margin: 0 24px 30px;
          height: 160px;
          background: linear-gradient(135deg, rgba(30, 34, 40, 0.8) 0%, rgba(30, 34, 40, 0.2) 100%);
          border-radius: 20px;
          border: 1px solid rgba(255,255,255,0.05);
          display: flex;
          align-items: center;
          padding: 20px;
          z-index: 1;
          overflow: hidden;
        }
        
        /* Simulating the car image from the design with an icon for now, 
           since we don't have a 3D auto parts asset */
        .hero-icon {
          font-size: 80px;
          color: rgba(15,165,248,0.15);
          position: absolute;
          right: -10px;
          bottom: -10px;
        }

        .hero-content {
          position: relative;
          z-index: 2;
        }
        .hero-content h3 {
          font-size: 20px;
          font-weight: 600;
          margin: 0 0 8px 0;
        }
        .hero-content p {
          font-size: 12px;
          color: rgba(255,255,255,0.6);
          margin: 0;
          max-width: 60%;
          line-height: 1.4;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          padding: 0 24px;
          margin-bottom: 30px;
          z-index: 1;
          position: relative;
        }

        .stat-card {
          background: rgba(30, 34, 40, 0.6);
          border: 1px solid rgba(255,255,255,0.05);
          border-radius: 20px;
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .stat-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 12px;
          color: rgba(255,255,255,0.6);
        }
        .stat-value {
          font-size: 24px;
          font-weight: 700;
          display: flex;
          align-items: flex-end;
          gap: 4px;
        }
        .stat-unit {
          font-size: 12px;
          font-weight: 400;
          color: rgba(255,255,255,0.5);
          margin-bottom: 4px;
        }

        .stat-bar {
          width: 100%;
          height: 6px;
          background: rgba(255,255,255,0.1);
          border-radius: 3px;
          overflow: hidden;
          margin-top: auto;
        }
        .stat-progress {
          height: 100%;
          background: #34d399; /* Green like battery */
          border-radius: 3px;
        }

        .actions-list {
          padding: 0 24px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          z-index: 1;
          position: relative;
        }

        .action-item {
          background: rgba(30, 34, 40, 0.6);
          border: 1px solid rgba(255,255,255,0.05);
          border-radius: 16px;
          padding: 16px;
          display: flex;
          align-items: center;
          gap: 16px;
          text-decoration: none;
          color: #fff;
          transition: background 0.2s;
        }
        .action-item:hover {
          background: rgba(30, 34, 40, 0.8);
        }
        .action-icon {
          width: 40px;
          height: 40px;
          border-radius: 12px;
          background: rgba(15,165,248,0.1);
          color: #0fa5f8;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .action-text {
          font-size: 15px;
          font-weight: 500;
          flex: 1;
        }
        
        .fade-up {
          animation: fadeUp 0.4s ease-out forwards;
          opacity: 0;
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(15px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div className="blue-dot-dashboard">
        <div className="dashboard-glow" />

        <header className="header-section fade-up" style={{ animationDelay: '0s', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {user?.photoUrl ? (
              <img 
                src={user.photoUrl.startsWith('http') ? user.photoUrl : `${import.meta.env.VITE_API_URL || ''}${user.photoUrl}`} 
                alt="Profile" 
                style={{ width: '56px', height: '56px', borderRadius: '50%', border: '2px solid rgba(15,165,248,0.5)', objectFit: 'cover' }} 
              />
            ) : (
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(15,165,248,0.1)', border: '2px solid rgba(15,165,248,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0fa5f8', fontSize: '24px', fontWeight: 'bold' }}>
                {user?.username?.charAt(0).toUpperCase() || "U"}
              </div>
            )}
            <div className="greeting">
              <h2>Good Morning</h2>
              <h1>{user?.username?.toUpperCase() || "USER"}</h1>
            </div>
          </div>
          <button className="notification-btn">
            <span className="material-symbols-outlined">notifications</span>
          </button>
        </header>

        <div className="hero-banner fade-up" style={{ animationDelay: '0.1s' }}>
          <span className="material-symbols-outlined hero-icon">local_shipping</span>
          <div className="hero-content">
            <h3>Ready for work?</h3>
            <p>Track your daily visits and manage your routes efficiently.</p>
          </div>
        </div>

        <div className="stats-grid fade-up" style={{ animationDelay: '0.2s' }}>
          <div className="stat-card">
            <div className="stat-header">
              <span>Progress</span>
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>chevron_right</span>
            </div>
            <div className="stat-value">
              12 <span className="stat-unit">Visits</span>
            </div>
            <div className="stat-bar">
              <div className="stat-progress" style={{ width: '60%' }} />
            </div>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>Daily Target: 20</span>
          </div>

          <div className="stat-card">
            <div className="stat-header">
              <span>Distance</span>
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>chevron_right</span>
            </div>
            <div className="stat-value">
              14.5 <span className="stat-unit">km</span>
            </div>
            <div className="stat-bar">
              <div className="stat-progress" style={{ width: '40%', background: '#0fa5f8' }} />
            </div>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>Total Distance</span>
          </div>
        </div>

        <div className="actions-list fade-up" style={{ animationDelay: '0.3s' }}>
          <Link href="/check-in" className="action-item">
            <div className="action-icon">
              <span className="material-symbols-outlined">location_on</span>
            </div>
            <span className="action-text">Check-in & Locations</span>
            <span className="material-symbols-outlined" style={{ color: 'rgba(255,255,255,0.3)' }}>chevron_right</span>
          </Link>

          <Link href="/history" className="action-item">
            <div className="action-icon">
              <span className="material-symbols-outlined">history</span>
            </div>
            <span className="action-text">Visit History</span>
            <span className="material-symbols-outlined" style={{ color: 'rgba(255,255,255,0.3)' }}>chevron_right</span>
          </Link>

          <Link href="/sync" className="action-item">
            <div className="action-icon" style={{ background: 'rgba(255,255,255,0.05)', color: '#fff' }}>
              <span className="material-symbols-outlined">sync</span>
            </div>
            <span className="action-text">Sync Data</span>
            <span className="material-symbols-outlined" style={{ color: 'rgba(255,255,255,0.3)' }}>chevron_right</span>
          </Link>
        </div>
      </div>
    </>
  );
}

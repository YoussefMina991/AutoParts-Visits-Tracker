import { AmbientStatusBar } from "@/components/AmbientStatusBar";
import { OfflineVault } from "@/components/OfflineVault";

export default function SyncPage() {
  return (
    <>
      <style>{`
        .blue-dot-sync-page {
          min-height: 100svh;
          background-color: #111417; /* Deep black/gray */
          color: #ffffff;
          font-family: 'Inter', 'Fira Sans', sans-serif;
          position: relative;
          overflow-y: auto;
          overflow-x: hidden;
          padding-bottom: 100px;
        }

        .sync-glow {
          position: absolute;
          top: -100px;
          left: -50px;
          width: 300px;
          height: 300px;
          background: radial-gradient(circle, rgba(15,165,248,0.2) 0%, rgba(15,165,248,0) 70%);
          border-radius: 50%;
          pointer-events: none;
          z-index: 0;
        }

        .sync-header {
          padding: 40px 24px 20px;
          position: relative;
          z-index: 1;
        }

        .sync-header h1 {
          font-size: 28px;
          font-weight: 700;
          margin: 0 0 4px 0;
          letter-spacing: -0.02em;
        }

        .sync-header p {
          font-size: 12px;
          color: rgba(255,255,255,0.5);
          margin: 0;
        }
      `}</style>
      <div className="blue-dot-sync-page">
        <div className="sync-glow" />
        <AmbientStatusBar />
        
        <header className="sync-header">
          <h1>Sync Center</h1>
          <p>Manage your offline visits and GPS data</p>
        </header>

        <main className="mx-auto w-full max-w-md">
          <OfflineVault />
        </main>
      </div>
    </>
  );
}

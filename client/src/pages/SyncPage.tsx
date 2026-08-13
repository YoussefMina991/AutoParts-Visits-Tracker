import { AmbientStatusBar } from "@/components/AmbientStatusBar";
import { OfflineVault } from "@/components/OfflineVault";

export default function SyncPage() {
  return (
    <div className="relative min-h-screen bg-[#0b1326] text-[oklch(0.96_0.008_250)]">
      <div
        className="pointer-events-none fixed inset-0 -z-10"
        aria-hidden="true"
        style={{
          backgroundImage: [
            "radial-gradient(60rem 40rem at 15% -10%, oklch(0.82 0.15 200 / 0.1), transparent 60%)",
            "radial-gradient(50rem 40rem at 100% 0%, oklch(0.7 0.16 300 / 0.09), transparent 55%)",
          ].join(", "),
          backgroundAttachment: "fixed",
        }}
      />
      <AmbientStatusBar />
      <main className="mx-auto w-full max-w-md pb-28 pt-4">
        <div className="px-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[oklch(0.7_0.16_300/0.8)]">
            Offline Storage
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-[oklch(0.96_0.008_250)]" style={{ fontFamily: "var(--font-display)" }}>
            Data Vault
          </h1>
        </div>
        <OfflineVault />
      </main>
    </div>
  );
}

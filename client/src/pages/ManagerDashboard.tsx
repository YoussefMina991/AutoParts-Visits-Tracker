import { AmbientStatusBar } from "@/components/AmbientStatusBar";
import { LivingCore } from "@/components/LivingCore";
import { JourneyTimeline } from "@/components/JourneyTimeline";

export default function ManagerDashboard() {
  return (
    <div className="relative min-h-screen bg-[#0b1326] text-[oklch(0.96_0.008_250)]">
      {/* Atmospheric background aurora blobs */}
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

      {/* HUD Status Bar */}
      <AmbientStatusBar />

      {/* Main scroll area */}
      <main className="mx-auto w-full max-w-md pb-28 overflow-y-auto">
        {/* Living Radar Core */}
        <LivingCore />

        {/* Journey Timeline */}
        <JourneyTimeline />
      </main>
    </div>
  );
}

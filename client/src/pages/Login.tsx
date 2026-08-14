import { useState, useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { Capacitor } from "@capacitor/core";

/* ─────────────────────────────────────────────────────────────
   Floating orbs — ambient background atmosphere (صورة 1 vibe)
───────────────────────────────────────────────────────────── */
function Orb({ style }: { style: React.CSSProperties }) {
  return <div className="login-orb" style={style} />;
}

/* ─────────────────────────────────────────────────────────────
   Animated ring — logo area (صورة 2 circular progress vibe)
───────────────────────────────────────────────────────────── */
function LogoRing() {
  return (
    <div className="login-logo-wrap">
      {/* outer slow-spin ring */}
      <svg className="login-ring-outer" viewBox="0 0 120 120">
        <circle
          cx="60" cy="60" r="54"
          fill="none"
          stroke="url(#ringGrad)"
          strokeWidth="1.5"
          strokeDasharray="6 10"
          strokeLinecap="round"
        />
        <defs>
          <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.9" />
            <stop offset="50%" stopColor="#a855f7" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#7c3aed" stopOpacity="0.1" />
          </linearGradient>
        </defs>
      </svg>

      {/* inner pulse ring */}
      <svg className="login-ring-inner" viewBox="0 0 80 80">
        <circle
          cx="40" cy="40" r="34"
          fill="none"
          stroke="#a855f7"
          strokeWidth="1"
          strokeDasharray="3 14"
          strokeLinecap="round"
          opacity="0.4"
        />
      </svg>

      {/* icon core */}
      <div className="login-logo-core">
        <span
          className="material-symbols-outlined"
          style={{ fontSize: 28, color: "#fff", fontVariationSettings: "'FILL' 1" }}
        >
          account_tree
        </span>
      </div>

      {/* live dot */}
      <span className="login-live-dot" />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   LOGIN PAGE
═══════════════════════════════════════════════════════════════ */
export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState<"user" | "pass" | null>(null);
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (user) setLocation("/");
  }, [user, setLocation]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setLoading(true);
    try {
      const BASE_URL = import.meta.env.VITE_API_URL || "http://192.168.1.8:3000";
      const LOGIN_URL = Capacitor.isNativePlatform()
        ? `${BASE_URL}/api/auth/login`
        : "/api/auth/login";
      const res = await fetch(LOGIN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "بيانات الدخول غير صحيحة");
        return;
      }
      window.location.href = "/";
    } catch {
      toast.error("حدث خطأ في الاتصال بالخادم");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* ── Scoped styles ── */}
      <style>{`
        /* ── Page shell ── */
        .login-page {
          min-height: 100svh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px 16px;
          position: relative;
          overflow: hidden;
          background: #09060f;
          direction: rtl;
        }

        /* ── Ambient orbs (صورة 1 — dark purple atmosphere) ── */
        .login-orb {
          position: absolute;
          border-radius: 50%;
          pointer-events: none;
          filter: blur(80px);
          opacity: 0.18;
          animation: orb-float 18s ease-in-out infinite alternate;
        }
        @keyframes orb-float {
          0%   { transform: translate(0,0) scale(1); }
          50%  { transform: translate(30px,-40px) scale(1.1); }
          100% { transform: translate(-20px,30px) scale(0.95); }
        }

        /* ── Grid overlay (صورة 1 texture) ── */
        .login-grid {
          position: absolute;
          inset: 0;
          pointer-events: none;
          background-image:
            linear-gradient(rgba(124,58,237,0.07) 1px, transparent 1px),
            linear-gradient(90deg, rgba(124,58,237,0.07) 1px, transparent 1px);
          background-size: 48px 48px;
          mask-image: radial-gradient(ellipse at center, black 30%, transparent 80%);
        }

        /* ── Card wrapper ── */
        .login-card-wrap {
          position: relative;
          width: 100%;
          max-width: 380px;
          animation: card-rise 0.6s cubic-bezier(0.34,1.56,0.64,1) both;
        }
        @keyframes card-rise {
          from { opacity: 0; transform: translateY(32px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }

        /* glow halo behind card */
        .login-card-halo {
          position: absolute;
          inset: -24px;
          background: radial-gradient(ellipse at 50% 40%, rgba(124,58,237,0.25) 0%, transparent 70%);
          pointer-events: none;
          border-radius: 40px;
        }

        /* ── Main card (صورة 3 — clean white card vibe, adapted to dark) ── */
        .login-card {
          position: relative;
          background: rgba(18, 10, 30, 0.82);
          backdrop-filter: blur(28px) saturate(160%);
          -webkit-backdrop-filter: blur(28px) saturate(160%);
          border: 1px solid rgba(124,58,237,0.22);
          border-radius: 28px;
          padding: 36px 28px 28px;
          display: flex;
          flex-direction: column;
          align-items: center;
          box-shadow:
            0 0 0 1px rgba(255,255,255,0.04) inset,
            0 32px 64px rgba(0,0,0,0.6),
            0 0 80px rgba(124,58,237,0.08);
        }

        /* ── Logo ring (صورة 2 — circular element vibe) ── */
        .login-logo-wrap {
          position: relative;
          width: 88px;
          height: 88px;
          margin-bottom: 24px;
          flex-shrink: 0;
        }
        .login-ring-outer {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          animation: ring-spin 12s linear infinite;
        }
        @keyframes ring-spin {
          to { transform: rotate(360deg); }
        }
        .login-ring-inner {
          position: absolute;
          inset: 8px;
          width: calc(100% - 16px);
          height: calc(100% - 16px);
          animation: ring-spin 8s linear infinite reverse;
        }
        .login-logo-core {
          position: absolute;
          inset: 16px;
          border-radius: 50%;
          background: linear-gradient(135deg, #4c1d95, #7c3aed);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow:
            0 0 24px rgba(124,58,237,0.6),
            0 0 48px rgba(124,58,237,0.2),
            inset 0 1px 0 rgba(255,255,255,0.15);
        }
        .login-live-dot {
          position: absolute;
          top: 10px;
          left: 10px;
          width: 12px;
          height: 12px;
          background: #34d399;
          border-radius: 50%;
          border: 2px solid #09060f;
          box-shadow: 0 0 8px rgba(52,211,153,0.8);
          animation: dot-pulse 2s ease-in-out infinite;
        }
        @keyframes dot-pulse {
          0%,100% { box-shadow: 0 0 8px rgba(52,211,153,0.8); }
          50%      { box-shadow: 0 0 16px rgba(52,211,153,1), 0 0 32px rgba(52,211,153,0.4); }
        }

        /* ── Brand text ── */
        .login-brand {
          text-align: center;
          margin-bottom: 28px;
        }
        .login-brand-title {
          font-family: 'Fira Sans', 'Cairo', sans-serif;
          font-size: 22px;
          font-weight: 700;
          color: #e2d9f3;
          letter-spacing: -0.01em;
          margin: 0 0 4px;
        }
        .login-brand-sub {
          font-family: 'Cairo', sans-serif;
          font-size: 13px;
          color: rgba(167,139,250,0.6);
          margin: 0;
          letter-spacing: 0.01em;
        }

        /* ── Divider ── */
        .login-divider {
          width: 100%;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(124,58,237,0.3), transparent);
          margin: 0 0 24px;
        }

        /* ── Form ── */
        .login-form {
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        /* ── Field group ── */
        .login-field-label {
          font-family: 'Fira Code', monospace;
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: rgba(167,139,250,0.5);
          margin-bottom: 6px;
          display: block;
        }

        /* ── Input wrapper (صورة 2 — clean input style) ── */
        .login-input-wrap {
          position: relative;
          border-radius: 14px;
          transition: box-shadow 200ms ease;
        }
        .login-input-wrap.focused {
          box-shadow: 0 0 0 2px rgba(124,58,237,0.5), 0 0 20px rgba(124,58,237,0.15);
        }
        .login-input-icon {
          position: absolute;
          right: 14px;
          top: 50%;
          transform: translateY(-50%);
          font-size: 20px;
          transition: color 200ms ease;
          pointer-events: none;
        }
        .login-input-icon.active { color: #a855f7; }
        .login-input-icon.idle   { color: rgba(167,139,250,0.35); }

        .login-input {
          width: 100%;
          height: 50px;
          padding: 0 44px 0 14px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(124,58,237,0.2);
          border-radius: 14px;
          color: #e2d9f3;
          font-family: 'Fira Sans', 'Cairo', sans-serif;
          font-size: 14px;
          outline: none;
          transition: border-color 200ms ease, background 200ms ease;
          text-align: right;
        }
        .login-input::placeholder { color: rgba(167,139,250,0.25); }
        .login-input:focus {
          border-color: rgba(124,58,237,0.6);
          background: rgba(124,58,237,0.06);
        }
        .login-input.pass-field { padding-left: 44px; padding-right: 44px; }

        .login-toggle-pass {
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          cursor: pointer;
          color: rgba(167,139,250,0.35);
          padding: 0;
          display: flex;
          align-items: center;
          transition: color 200ms ease;
        }
        .login-toggle-pass:hover { color: #a855f7; }

        /* ── Forgot link ── */
        .login-field-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 6px;
        }
        .login-forgot {
          font-family: 'Cairo', sans-serif;
          font-size: 11px;
          color: rgba(167,139,250,0.5);
          text-decoration: none;
          transition: color 200ms ease;
        }
        .login-forgot:hover { color: #a855f7; }

        /* ── Submit button (صورة 3 — solid purple CTA) ── */
        .login-btn {
          width: 100%;
          height: 52px;
          margin-top: 4px;
          background: linear-gradient(135deg, #5b21b6 0%, #7c3aed 50%, #9333ea 100%);
          border: none;
          border-radius: 14px;
          color: #fff;
          font-family: 'Fira Sans', 'Cairo', sans-serif;
          font-size: 15px;
          font-weight: 600;
          letter-spacing: 0.02em;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          position: relative;
          overflow: hidden;
          transition: transform 150ms cubic-bezier(0.34,1.56,0.64,1),
                      box-shadow 200ms ease,
                      opacity 200ms ease;
          box-shadow: 0 4px 20px rgba(124,58,237,0.45), 0 0 40px rgba(124,58,237,0.15);
        }
        .login-btn::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(rgba(255,255,255,0.12), rgba(255,255,255,0));
          opacity: 0;
          transition: opacity 200ms ease;
        }
        .login-btn:hover:not(:disabled) {
          transform: translateY(-2px) scale(1.01);
          box-shadow: 0 8px 32px rgba(124,58,237,0.55), 0 0 60px rgba(124,58,237,0.2);
        }
        .login-btn:hover:not(:disabled)::before { opacity: 1; }
        .login-btn:active:not(:disabled) { transform: scale(0.98); }
        .login-btn:disabled { opacity: 0.4; cursor: not-allowed; }

        /* ── Security row ── */
        .login-security {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          margin-top: 4px;
        }
        .login-security-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #34d399;
          box-shadow: 0 0 6px rgba(52,211,153,0.8);
          animation: dot-pulse 2s ease-in-out infinite;
        }
        .login-security-label {
          font-family: 'Fira Code', monospace;
          font-size: 10px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: rgba(52,211,153,0.7);
        }

        /* ── Footer ── */
        .login-footer {
          margin-top: 20px;
          padding-top: 20px;
          border-top: 1px solid rgba(124,58,237,0.12);
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 20px;
        }
        .login-badge {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          opacity: 0.25;
          transition: opacity 200ms ease;
          cursor: default;
        }
        .login-badge:hover { opacity: 0.55; }
        .login-badge span.material-symbols-outlined {
          font-size: 20px;
          color: #a855f7;
        }
        .login-badge-label {
          font-family: 'Fira Code', monospace;
          font-size: 8px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: rgba(167,139,250,0.7);
        }

        /* ── Version tag ── */
        .login-version {
          margin-top: 16px;
          font-family: 'Fira Code', monospace;
          font-size: 10px;
          color: rgba(124,58,237,0.3);
          letter-spacing: 0.08em;
          text-align: center;
        }
      `}</style>

      <div className="login-page">
        {/* Ambient orbs */}
        <Orb style={{ width: 500, height: 500, background: "#4c1d95", top: "-20%", right: "-15%", animationDuration: "20s" }} />
        <Orb style={{ width: 400, height: 400, background: "#7c3aed", bottom: "-15%", left: "-10%", animationDuration: "15s", animationDelay: "-8s" }} />
        <Orb style={{ width: 280, height: 280, background: "#2e1065", top: "40%", left: "20%", animationDuration: "25s", animationDelay: "-5s" }} />

        {/* Grid */}
        <div className="login-grid" />

        {/* Card */}
        <div className="login-card-wrap">
          <div className="login-card-halo" />
          <div className="login-card">

            {/* Logo */}
            <LogoRing />

            {/* Brand */}
            <div className="login-brand">
              <h1 className="login-brand-title">Branch Tracker</h1>
              <p className="login-brand-sub">نظام تتبع الزيارات الميدانية</p>
            </div>

            <div className="login-divider" />

            {/* Form */}
            <form className="login-form" onSubmit={handleLogin} noValidate>

              {/* Username */}
              <div>
                <label className="login-field-label">المعرف</label>
                <div className={`login-input-wrap ${focused === "user" ? "focused" : ""}`}>
                  <span className={`material-symbols-outlined login-input-icon ${focused === "user" ? "active" : "idle"}`}>
                    person
                  </span>
                  <input
                    className="login-input"
                    type="text"
                    placeholder="اسم المستخدم"
                    autoComplete="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    onFocus={() => setFocused("user")}
                    onBlur={() => setFocused(null)}
                    disabled={loading}
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <div className="login-field-row">
                  <label className="login-field-label" style={{ marginBottom: 0 }}>كلمة المرور</label>
                  <a href="#" className="login-forgot" tabIndex={-1}>نسيت؟</a>
                </div>
                <div className={`login-input-wrap ${focused === "pass" ? "focused" : ""}`}>
                  <span className={`material-symbols-outlined login-input-icon ${focused === "pass" ? "active" : "idle"}`}>
                    lock
                  </span>
                  <input
                    className="login-input pass-field"
                    type={showPass ? "text" : "password"}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onFocus={() => setFocused("pass")}
                    onBlur={() => setFocused(null)}
                    disabled={loading}
                  />
                  <button
                    type="button"
                    className="login-toggle-pass"
                    onClick={() => setShowPass(!showPass)}
                    tabIndex={-1}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
                      {showPass ? "visibility_off" : "visibility"}
                    </span>
                  </button>
                </div>
              </div>

              {/* Security indicator */}
              <div className="login-security">
                <span className="login-security-dot" />
                <span className="login-security-label">الاتصال آمن</span>
              </div>

              {/* Submit */}
              <button
                type="submit"
                className="login-btn"
                disabled={loading || !username.trim() || !password}
              >
                {loading ? (
                  <Loader2 style={{ width: 20, height: 20, animation: "spin 1s linear infinite" }} />
                ) : (
                  <>
                    <span>تسجيل الدخول</span>
                    <span className="material-symbols-outlined" style={{ fontSize: 20, fontVariationSettings: "'FILL' 1" }}>
                      arrow_back
                    </span>
                  </>
                )}
              </button>
            </form>

            {/* Footer badges */}
            <div className="login-footer">
              {[
                { icon: "verified_user", label: "SSO" },
                { icon: "fingerprint", label: "Biometric" },
                { icon: "encrypted", label: "E2E" },
              ].map(({ icon, label }) => (
                <div key={label} className="login-badge">
                  <span className="material-symbols-outlined">{icon}</span>
                  <span className="login-badge-label">{label}</span>
                </div>
              ))}
            </div>

            <p className="login-version">v1.0.0 · Branch Tracker</p>
          </div>
        </div>
      </div>
    </>
  );
}

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { Capacitor } from "@capacitor/core";
import { Device } from "@capacitor/device";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
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
      // 🔒 بصمة الجهاز — بتتربط بالحساب أول تسجيل دخول وتمنع استخدام
      // الحساب من أي موبايل تاني
      let deviceId: string | undefined;
      if (Capacitor.isNativePlatform()) {
        const info = await Device.getId();
        deviceId = info.identifier;
      }

      const BASE_URL = import.meta.env.VITE_API_URL || "http://192.168.1.8:3000";
      const LOGIN_URL = Capacitor.isNativePlatform()
        ? `${BASE_URL}/api/auth/login`
        : "/api/auth/login";
      const res = await fetch(LOGIN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          username: username.trim(),
          password,
          platform: Capacitor.isNativePlatform() ? "mobile" : "web",
          ...(deviceId ? { deviceId } : {}),
        }),
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
      <style>{`
        .blue-dot-page {
          min-height: 100svh;
          background-color: #111417; /* Deep dark gray/black from the image */
          display: flex;
          flex-direction: column;
          align-items: center;
          position: relative;
          overflow: hidden;
          font-family: 'Inter', 'Fira Sans', sans-serif;
          color: #ffffff;
        }

        /* Top Cyan Glow */
        .top-glow {
          position: absolute;
          top: -150px;
          left: 50%;
          transform: translateX(-50%);
          width: 300px;
          height: 300px;
          background: radial-gradient(circle, rgba(15,165,248,0.4) 0%, rgba(15,165,248,0) 70%);
          border-radius: 50%;
          pointer-events: none;
          z-index: 0;
        }

        /* Main Content Container */
        .content-container {
          z-index: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          width: 100%;
          max-width: 400px;
          padding: 40px 24px;
          flex: 1;
        }

        /* Hero Text */
        .welcome-text {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: rgba(255,255,255,0.6);
          margin-bottom: 4px;
          margin-top: 60px;
        }
        .brand-title {
          font-size: 28px;
          font-weight: 600;
          margin: 0 0 40px 0;
          letter-spacing: -0.02em;
        }

        /* Feature Cards or Form area */
        .features-area {
          display: flex;
          flex-direction: column;
          gap: 16px;
          width: 100%;
          flex: 1;
        }

        .feature-card {
          background: rgba(30, 34, 40, 0.6);
          border: 1px solid rgba(255,255,255,0.05);
          border-radius: 16px;
          padding: 16px;
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .feature-icon-wrapper {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: rgba(255,255,255,0.05);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .feature-icon-wrapper .material-symbols-outlined {
          font-size: 20px;
          color: #ffffff;
        }

        .feature-content h3 {
          font-size: 14px;
          font-weight: 600;
          margin: 0 0 4px 0;
        }

        .feature-content p {
          font-size: 12px;
          color: rgba(255,255,255,0.5);
          margin: 0;
          line-height: 1.4;
        }

        /* Inputs Area */
        .login-input {
          width: 100%;
          height: 56px;
          background: rgba(30, 34, 40, 0.6);
          border: 1px solid rgba(255,255,255,0.05);
          border-radius: 12px;
          padding: 0 16px;
          color: #fff;
          font-size: 15px;
          outline: none;
          transition: border-color 0.2s, background 0.2s;
        }
        .login-input:focus {
          border-color: #0fa5f8;
          background: rgba(15,165,248,0.05);
        }
        .login-input::placeholder {
          color: rgba(255,255,255,0.4);
        }

        /* Buttons Area */
        .actions-area {
          width: 100%;
          margin-top: 40px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .btn-blue {
          width: 100%;
          height: 52px;
          background: #0fa5f8;
          color: #ffffff;
          border: none;
          border-radius: 12px;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.2s;
        }
        .btn-blue:hover {
          background: #0d8ed6;
        }

        .btn-outline {
          width: 100%;
          height: 52px;
          background: transparent;
          color: #ffffff;
          border: none;
          border-radius: 12px;
          font-size: 15px;
          font-weight: 500;
          cursor: pointer;
          transition: opacity 0.2s;
        }
        .btn-outline:hover {
          opacity: 0.8;
        }

        /* Languages */
        .languages {
          margin-top: 30px;
          font-size: 11px;
          color: rgba(255,255,255,0.4);
          display: flex;
          gap: 12px;
          margin-bottom: 20px;
        }
        .languages span {
          cursor: pointer;
        }
        .languages span:hover {
          color: rgba(255,255,255,0.8);
        }
        
        .fade-in {
          animation: fadeIn 0.3s ease-in-out;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div className="blue-dot-page">
        <div className="top-glow" />

        <div className="content-container">
          <span className="welcome-text">WELCOME TO</span>
          <h1 className="brand-title">AutoParts</h1>

          <div className="features-area">
            {!showForm ? (
              <div className="fade-in">
                <div className="feature-card mb-4" style={{ marginBottom: 16 }}>
                  <div className="feature-icon-wrapper">
                    <span className="material-symbols-outlined">security</span>
                  </div>
                  <div className="feature-content">
                    <h3>Secure & Fast</h3>
                    <p>Fast, secure, and innovative visit tracking for a better tomorrow.</p>
                  </div>
                </div>

                <div className="feature-card">
                  <div className="feature-icon-wrapper">
                    <span className="material-symbols-outlined">manage_accounts</span>
                  </div>
                  <div className="feature-content">
                    <h3>Multi-role</h3>
                    <p>Team management made easy with secure, multi-role support.</p>
                  </div>
                </div>
              </div>
            ) : (
              <form onSubmit={handleLogin} className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <input
                  type="text"
                  className="login-input"
                  placeholder="Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={loading}
                />
                <input
                  type="password"
                  className="login-input"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                />
              </form>
            )}
          </div>

          <div className="actions-area">
            {!showForm ? (
              <button className="btn-blue" onClick={() => setShowForm(true)}>
                Log in
              </button>
            ) : (
              <button className="btn-blue" onClick={handleLogin} disabled={loading}>
                {loading ? <Loader2 className="animate-spin" /> : "Sign in"}
              </button>
            )}
            
            {!showForm && (
              <button className="btn-outline">
                Create Account
              </button>
            )}
          </div>

          <div className="languages">
            <span>English</span> | 
            <span>Arabic</span> | 
            <span>Chinese</span> | 
            <span>Spanish</span>
          </div>
        </div>
      </div>
    </>
  );
}

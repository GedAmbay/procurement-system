"use client";

import { useState, useTransition } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Shield, Eye, EyeOff, Loader2, AlertCircle } from "lucide-react";
import { LGU_INFO } from "@/lib/utils";

export default function LoginPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    startTransition(async () => {
      const result = await signIn("credentials", { email, password, redirect: false });
      if (result?.error) {
        setError("Invalid email or password. Please try again.");
      } else {
        router.push("/dashboard");
        router.refresh();
      }
    });
  };

  const demoAccounts = [
    { label: "Admin", email: "admin@pandan.gov.ph", password: "Admin@1234", color: "#515050ff" },
    { label: "BAC", email: "bac@pandan.gov.ph", password: "Bac@1234", color: "#515050ff" },
    { label: "End User", email: "enduser@pandan.gov.ph", password: "User@1234", color: "#515050ff" },
    { label: "Budget", email: "budget@pandan.gov.ph", password: "Budget@1234", color: "#515050ff" },
    { label: "Mayor", email: "mayor@pandan.gov.ph", password: "Mayor@1234", color: "#515050ff" },
  ];

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      fontFamily: "'Inter', -apple-system, sans-serif",
      overflow: "hidden",
      background: "#ECF0F3",
    }}>
      {/* Left Panel: Big Logo + LGU Branding */}
      <div className="login-branding-panel" style={{
        flex: "0 0 50%",
        background: "linear-gradient(160deg, #071325 0%, #0f2347 50%, #06101e 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "3rem 3.5rem",
        position: "relative",
        overflow: "hidden",
        textAlign: "center",
      }}>
        {/* Background glow effects */}
        <div style={{
          position: "absolute", top: "50%", left: "50%",
          transform: "translate(-50%, -50%)",
          width: "450px", height: "450px", borderRadius: "50%",
          background: "radial-gradient(circle, rgba(37,99,235,0.22) 0%, rgba(15,35,71,0) 70%)",
          pointerEvents: "none",
        }} />
        <div style={{
          position: "absolute", inset: 0, opacity: 0.03,
          backgroundImage: "linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
          pointerEvents: "none",
        }} />

        <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
          {/* Big Logo */}
          <div style={{
            width: "300px", height: "300px", borderRadius: "50%",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 0 0 10px rgba(230, 239, 253, 0.18), 0 20px 50px rgba(49, 50, 51, 0.5)",
            marginBottom: "2.5rem",
            overflow: "hidden",
          }}>
            <img
              src="/pandan_logo.png"
              alt="Municipality of Pandan Logo"
              style={{ width: "100%", height: "100%", objectFit: "contain" }}
            />
          </div>

          {/* Text Below Logo */}
          <div style={{
            color: "#93c5fd",
            fontSize: "1rem",
            fontWeight: 600,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            marginBottom: "0.5rem",
          }}>
            {LGU_INFO.republic}
          </div>

          <div style={{
            color: "#60a5fa",
            fontSize: "1.25rem",
            fontWeight: 600,
            marginBottom: "0.75rem",
            letterSpacing: "0.02em",
          }}>
            {LGU_INFO.province}
          </div>

          <div style={{
            color: "#ffffff",
            fontSize: "2.25rem",
            fontWeight: 800,
            lineHeight: 1.2,
            letterSpacing: "0.02em",
            textShadow: "0 2px 10px rgba(0,0,0,0.3)",
          }}>
            {LGU_INFO.name}
          </div>
        </div>
      </div>

      {/* Right Panel: Login Form */}
      <div style={{
        flex: "1",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "3rem 2.5rem",
        position: "relative",
      }}>
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0,
          height: "4px",
          background: "linear-gradient(90deg, #2563eb, #6366f1, #3b82f6)",
        }} />

        <div style={{ width: "100%", maxWidth: "400px" }}>
          {/* Mobile Header */}
          <div className="login-mobile-header" style={{
            display: "none",
            alignItems: "center",
            gap: "0.75rem",
            marginBottom: "2rem",
          }}>
            <div style={{
              width: "44px", height: "44px", borderRadius: "50%",
              background: "white",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 4px 12px rgba(29,78,216,0.3)",
              overflow: "hidden",
            }}>
              <img
                src="/pandan_logo.png"
                alt="Logo"
                style={{ width: "100%", height: "100%", objectFit: "contain", padding: "2px" }}
              />
            </div>
            <div>
              <div style={{ color: "#64748b", fontSize: "0.65rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                {LGU_INFO.republic}
              </div>
              <div style={{ color: "#0f172a", fontSize: "0.95rem", fontWeight: 800 }}>
                {LGU_INFO.name}
              </div>
            </div>
          </div>

          <div style={{ marginBottom: "2rem" }}>
            <h2 style={{ color: "#0f172a", fontSize: "2.75rem", fontWeight: 800, marginBottom: "0.375rem" }}>
              Welcome back
            </h2>
            <p style={{ color: "#64748b", fontSize: "0.9375rem" }}>
              Sign in with your official LGU credentials to continue.
            </p>
          </div>

          {error && (
            <div style={{
              display: "flex", alignItems: "center", gap: "0.625rem",
              background: "#fef2f2", border: "1px solid #fecaca",
              borderRadius: "0.625rem", padding: "0.75rem 1rem",
              marginBottom: "1.25rem", color: "#dc2626", fontSize: "0.875rem",
            }}>
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.125rem" }}>
            <div>
              <label style={{
                display: "block", color: "#374151",
                fontSize: "0.8125rem", fontWeight: 600, marginBottom: "0.4rem",
              }}>
                Email Address
              </label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@pandan.gov.ph"
                required
                style={{
                  width: "100%", padding: "0.7rem 0.875rem",
                  border: "none", borderRadius: "0.625rem",
                  fontSize: "0.9rem", color: "#0f172a", background: "#ECF0F3",
                  outline: "none", boxSizing: "border-box",
                  boxShadow: "inset 18px 18px 30px #D1D9E6, inset -18px -18px 30px #ffffff",
                  transition: "all 0.2s ease-in-out",
                }}
                onFocus={(e) => { e.target.style.boxShadow = "inset 20px 20px 32px #cbd5e1, inset -20px -20px 32px #ffffff"; }}
                onBlur={(e) => { e.target.style.boxShadow = "inset 18px 18px 30px #D1D9E6, inset -18px -18px 30px #ffffff"; }}
              />
            </div>

            <div>
              <label style={{
                display: "block", color: "#374151",
                fontSize: "0.8125rem", fontWeight: 600, marginBottom: "0.4rem",
              }}>
                Password
              </label>
              <div style={{ position: "relative" }}>
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  style={{
                    width: "100%", padding: "0.7rem 2.75rem 0.7rem 0.875rem",
                    border: "none", borderRadius: "0.625rem",
                    fontSize: "0.9rem", color: "#0f172a", background: "#ECF0F3",
                    outline: "none", boxSizing: "border-box",
                    boxShadow: "inset 18px 18px 30px #D1D9E6, inset -18px -18px 30px #ffffff",
                    transition: "all 0.2s ease-in-out",
                  }}
                  onFocus={(e) => { e.target.style.boxShadow = "inset 20px 20px 32px #cbd5e1, inset -20px -20px 32px #ffffff"; }}
                  onBlur={(e) => { e.target.style.boxShadow = "inset 18px 18px 30px #D1D9E6, inset -18px -18px 30px #ffffff"; }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: "absolute", right: "0.75rem", top: "50%",
                    transform: "translateY(-50%)", background: "none",
                    border: "none", cursor: "pointer", color: "#94a3b8",
                    display: "flex", alignItems: "center", padding: 0,
                  }}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            <button
              id="login-submit"
              type="submit"
              disabled={isPending}
              style={{
                width: "100%", padding: "0.8rem",
                background: "#ECF0F3",
                color: "#2563eb", border: "none", borderRadius: "0.625rem",
                fontSize: "0.9375rem", fontWeight: 700,
                cursor: isPending ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem",
                boxShadow: isPending ? "inset 18px 18px 30px #D1D9E6, inset -18px -18px 30px #ffffff" : "18px 18px 30px #D1D9E6, -18px -18px 30px #ffffff",
                transition: "all 0.2s ease-in-out", marginTop: "0.25rem",
              }}
              onMouseEnter={(e) => { if (!isPending) e.currentTarget.style.boxShadow = "12px 12px 24px #D1D9E6, -12px -12px 24px #ffffff"; }}
              onMouseLeave={(e) => { if (!isPending) e.currentTarget.style.boxShadow = "18px 18px 30px #D1D9E6, -18px -18px 30px #ffffff"; }}
              onMouseDown={(e) => { if (!isPending) e.currentTarget.style.boxShadow = "inset 18px 18px 30px #D1D9E6, inset -18px -18px 30px #ffffff"; }}
              onMouseUp={(e) => { if (!isPending) e.currentTarget.style.boxShadow = "12px 12px 24px #D1D9E6, -12px -12px 24px #ffffff"; }}
            >
              {isPending ? <><Loader2 size={18} className="animate-spin" /> Signing in...</> : "Sign In"}
            </button>
          </form>

          <div style={{ marginTop: "1.75rem", paddingTop: "1.5rem", borderTop: "1px solid #e2e8f0" }}>
            <p style={{
              color: "#94a3b8", fontSize: "0.7375rem", fontWeight: 600,
              textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.75rem",
            }}>
              Demo Accounts — click to fill
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
              {demoAccounts.map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  onClick={() => { setEmail(acc.email); setPassword(acc.password); }}
                  style={{
                    padding: "0.3rem 0.75rem", borderRadius: "9999px",
                    border: "none",
                    background: "#ECF0F3", color: acc.color,
                    fontSize: "0.775rem", fontWeight: 600, cursor: "pointer",
                    boxShadow: "10px 10px 20px #D1D9E6, -10px -10px 20px #ffffff",
                    transition: "all 0.2s ease-in-out",
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.boxShadow = "6px 6px 12px #D1D9E6, -6px -6px 12px #ffffff"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.boxShadow = "10px 10px 20px #D1D9E6, -10px -10px 20px #ffffff"; }}
                  onMouseDown={(e) => { (e.currentTarget as HTMLButtonElement).style.boxShadow = "inset 6px 6px 12px #D1D9E6, inset -6px -6px 12px #ffffff"; }}
                  onMouseUp={(e) => { (e.currentTarget as HTMLButtonElement).style.boxShadow = "6px 6px 12px #D1D9E6, -6px -6px 12px #ffffff"; }}
                >
                  {acc.label}
                </button>
              ))}
            </div>
          </div>

          <p style={{ color: "#cbd5e1", fontSize: "0.75rem", textAlign: "center", marginTop: "2rem" }}>
            For account issues, contact the System Administrator
          </p>
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .login-branding-panel { display: none !important; }
          .login-mobile-header { display: flex !important; }
        }
      `}</style>
    </div>
  );
}

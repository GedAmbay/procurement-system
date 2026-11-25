"use client";

import { useState, useTransition, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Loader2, AlertCircle } from "lucide-react";
import { LGU_INFO } from "@/lib/utils";
import SplashScreen from "@/components/ui/splash-screen";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [usernameFocused, setUsernameFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [showSplash, setShowSplash] = useState(false);

  const isUsernameFloating = usernameFocused || username.length > 0;
  const isPasswordFloating = passwordFocused || password.length > 0;

  const idleMessage =
    !error && searchParams.get("reason") === "idle"
      ? "Your session expired after 30 minutes of inactivity. Please sign in again."
      : "";
  const displayError = error || idleMessage;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setShowSplash(true);
    startTransition(async () => {
      const result = await signIn("credentials", {
        username: username.trim(),
        password,
        redirect: false,
      });
      if (result?.error) {
        if (result.code === "account_locked") {
          setError("Account locked for 15 minutes due to 5 failed login attempts. Contact the System Administrator to unlock.");
        } else if (result.code === "account_inactive") {
          setError("Your account has been deactivated. Contact the System Administrator.");
        } else {
          setError("Invalid Employee ID / Username or password. Please try again.");
        }
        setShowSplash(false);
      } else {
        router.push("/dashboard");
        router.refresh();
      }
    });
  };

  return (
    <>
      {showSplash && <SplashScreen />}
      <div style={{
        minHeight: "var(--full-vh)",
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

          <div style={{ width: "100%", maxWidth: "400px", zoom: "1.25" }}>
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

            {displayError && (
              <div style={{
                display: "flex", alignItems: "center", gap: "0.625rem",
                background: "#fef2f2", border: "1px solid #fecaca",
                borderRadius: "0.625rem", padding: "0.75rem 1rem",
                marginBottom: "1.25rem", color: "#dc2626", fontSize: "0.875rem",
              }}>
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                {displayError}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div style={{ position: "relative" }}>
                <input
                  id="login-username"
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onFocus={() => setUsernameFocused(true)}
                  onBlur={() => setUsernameFocused(false)}
                  placeholder=" "
                  required
                  style={{
                    width: "100%",
                    height: "54px",
                    padding: "1.25rem 0.875rem 0.4rem",
                    border: usernameFocused ? "2px solid #0f172a" : "2px solid transparent",
                    borderRadius: "0.625rem",
                    fontSize: "0.9rem",
                    fontWeight: 500,
                    color: "#0f172a",
                    background: usernameFocused ? "#ffffff" : "#ECF0F3",
                    outline: "none",
                    boxSizing: "border-box",
                    boxShadow: usernameFocused
                      ? "none"
                      : "inset 18px 18px 30px #D1D9E6, inset -18px -18px 30px #ffffff",
                    transition: "all 0.16s ease-in-out",
                  }}
                />
                <label
                  htmlFor="login-username"
                  style={{
                    position: "absolute",
                    left: "0.875rem",
                    top: isUsernameFloating ? "0.45rem" : "50%",
                    transform: isUsernameFloating ? "translateY(0)" : "translateY(-50%)",
                    fontSize: isUsernameFloating ? "0.625rem" : "0.75rem",
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: usernameFocused ? "#0f172a" : "#64748b",
                    pointerEvents: "none",
                    transition: "all 0.16s cubic-bezier(0.4, 0, 0.2, 1)",
                  }}
                >
                  Username
                </label>
              </div>

              <div style={{ position: "relative" }}>
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
                  placeholder=" "
                  required
                  style={{
                    width: "100%",
                    height: "54px",
                    padding: "1.25rem 2.75rem 0.4rem 0.875rem",
                    border: passwordFocused ? "2px solid #0f172a" : "2px solid transparent",
                    borderRadius: "0.625rem",
                    fontSize: "0.9rem",
                    fontWeight: 500,
                    color: "#0f172a",
                    background: passwordFocused ? "#ffffff" : "#ECF0F3",
                    outline: "none",
                    boxSizing: "border-box",
                    boxShadow: passwordFocused
                      ? "none"
                      : "inset 18px 18px 30px #D1D9E6, inset -18px -18px 30px #ffffff",
                    transition: "all 0.16s ease-in-out",
                  }}
                />
                <label
                  htmlFor="login-password"
                  style={{
                    position: "absolute",
                    left: "0.875rem",
                    top: isPasswordFloating ? "0.45rem" : "50%",
                    transform: isPasswordFloating ? "translateY(0)" : "translateY(-50%)",
                    fontSize: isPasswordFloating ? "0.625rem" : "0.75rem",
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: passwordFocused ? "#0f172a" : "#64748b",
                    pointerEvents: "none",
                    transition: "all 0.16s cubic-bezier(0.4, 0, 0.2, 1)",
                  }}
                >
                  Password
                </label>
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

              <button
                id="login-submit"
                type="submit"
                disabled={isPending}
                style={{
                  width: "100%", padding: "0.8rem",
                  background: "#ECF0F3",
                  color: "#60a5fa", border: "none", borderRadius: "0.625rem",
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

            <div style={{ marginTop: "1.75rem", paddingTop: "1.25rem", borderTop: "1px solid #e2e8f0" }}>
              <p style={{ color: "#94a3b8", fontSize: "0.75rem", textAlign: "center", lineHeight: 1.5 }}>
                Accounts are issued exclusively by the System Administrator.
                <br />
                For password resets or access issues, contact your Admin.
              </p>
            </div>
          </div>
        </div>

        <style>{`
          @media (max-width: 768px) {
            .login-branding-panel { display: none !important; }
            .login-mobile-header { display: flex !important; }
          }
        `}</style>
      </div>
    </>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

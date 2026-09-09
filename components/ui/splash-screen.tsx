"use client";

export default function SplashScreen() {
  return (
    <div style={{
      position: "fixed",
      inset: 0,
      background: "linear-gradient(135deg, #0f1729 0%, #1e2d4a 100%)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 99999,
      animation: "fadeIn 0.3s ease-out",
    }}>
      {/* Decorative Orbs */}
      <div style={{
        position: "absolute", top: "20%", right: "20%",
        width: "300px", height: "300px", borderRadius: "50%",
        background: "radial-gradient(circle, rgba(37,99,235,0.15) 0%, transparent 70%)",
        pointerEvents: "none",
        animation: "pulse 3s infinite",
      }} />
      <div style={{
        position: "absolute", bottom: "20%", left: "20%",
        width: "250px", height: "250px", borderRadius: "50%",
        background: "radial-gradient(circle, rgba(29,78,216,0.15) 0%, transparent 70%)",
        pointerEvents: "none",
        animation: "pulse 3s infinite 1s",
      }} />

      {/* Logo Container */}
      <div style={{
        width: "200px",
        height: "200px",
        borderRadius: "50%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 0 0 6px rgba(230, 239, 253, 0.18), 0 20px 50px rgba(49, 50, 51, 0.5)",
        animation: "bounceIn 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
        marginBottom: "1.5rem",
        position: "relative",
      }}>
        <img
          src="/pandan_logo.png"
          alt="LGU Logo"
          style={{ width: "100%", height: "100%", objectFit: "contain" }}
        />

        {/* Radar sweep effect / Spinner */}
        <div style={{
          position: "absolute",
          inset: "-6px",
          borderRadius: "50%",
          border: "5px solid rgba(182, 250, 23, 0.5)",
          borderTopColor: "transparent",
          borderRightColor: "transparent",
          animation: "spin 1s linear infinite",
        }} />
      </div>

      <div style={{
        color: "white",
        fontSize: "1.5rem",
        fontWeight: "700",
        letterSpacing: "0.05em",
        animation: "fadeInUp 0.8s ease-out 0.2s both",
      }}>
        ProcureEase
      </div>
      <div style={{
        color: "#93c5fd",
        fontSize: "0.875rem",
        textTransform: "uppercase",
        letterSpacing: "0.2em",
        marginTop: "0.5rem",
        animation: "fadeInUp 0.8s ease-out 0.4s both",
      }}>
        Loading...
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes bounceIn {
          0% { opacity: 0; transform: scale(0.3); }
          50% { opacity: 1; transform: scale(1.05); }
          70% { transform: scale(0.9); }
          100% { transform: scale(1); }
        }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes pulse { 0% { transform: scale(1); opacity: 0.5; } 50% { transform: scale(1.1); opacity: 1; } 100% { transform: scale(1); opacity: 0.5; } }
      `}</style>
    </div>
  );
}

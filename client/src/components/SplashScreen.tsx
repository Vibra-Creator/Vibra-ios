import { useState, useEffect, useCallback } from "react";
import vibraLogo from "@assets/Gemini_Generated_Image_adkxs1adkxs1adkx_1770480122018.png";

interface SplashScreenProps {
  onComplete: () => void;
}

export function SplashScreen({ onComplete }: SplashScreenProps) {
  const [phase, setPhase] = useState(0);
  const [fadeOut, setFadeOut] = useState(false);

  const dismiss = useCallback(() => {
    if (fadeOut) return;
    setFadeOut(true);
    setTimeout(onComplete, 600);
  }, [onComplete, fadeOut]);

  useEffect(() => {
    const t0 = setTimeout(() => setPhase(1), 50);
    const t1 = setTimeout(() => setPhase(2), 600);
    const t2 = setTimeout(() => setPhase(3), 1200);
    const t3 = setTimeout(() => dismiss(), 3000);

    return () => {
      clearTimeout(t0);
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [dismiss]);

  return (
    <div
      data-testid="splash-screen"
      onClick={dismiss}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        backgroundColor: "#0a0118",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        opacity: fadeOut ? 0 : 1,
        transition: "opacity 0.6s ease-out",
        overflow: "hidden",
        cursor: "pointer",
      }}
    >
      <div style={{
        position: "absolute",
        inset: 0,
        background: "radial-gradient(ellipse at 50% 40%, rgba(139, 92, 246, 0.25) 0%, rgba(168, 85, 247, 0.08) 40%, transparent 70%)",
        opacity: phase >= 1 ? 1 : 0,
        transition: "opacity 0.8s ease-in",
        zIndex: 1,
      }} />

      <img
        src={vibraLogo}
        alt="Vibra"
        style={{
          width: "180px",
          height: "180px",
          objectFit: "contain",
          borderRadius: "50%",
          opacity: phase >= 1 ? 1 : 0,
          transform: phase >= 1 ? "scale(1)" : "scale(0.5)",
          transition: "all 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)",
          filter: phase >= 2
            ? "drop-shadow(0 0 25px rgba(139, 92, 246, 0.6)) drop-shadow(0 0 50px rgba(168, 85, 247, 0.3))"
            : "drop-shadow(0 0 10px rgba(139, 92, 246, 0.2))",
          position: "relative",
          zIndex: 3,
        }}
      />

      <p style={{
        fontFamily: "'Space Grotesk', sans-serif",
        fontSize: "1.1rem",
        fontWeight: 600,
        letterSpacing: "0.3em",
        textTransform: "uppercase",
        background: phase >= 3
          ? "linear-gradient(90deg, #c084fc, #f472b6, #67e8f9, #c084fc)"
          : "transparent",
        backgroundSize: "200% 100%",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: phase >= 3 ? "transparent" : "rgba(192, 132, 252, 0)",
        animation: phase >= 3 ? "splash-text-shimmer 3s linear infinite" : "none",
        opacity: phase >= 2 ? 1 : 0,
        transform: phase >= 2 ? "translateY(0)" : "translateY(10px)",
        transition: "all 0.6s ease-out",
        position: "relative",
        zIndex: 3,
        marginTop: "16px",
      }}>
        Incontri Cosmici
      </p>

      <style>{`
        @keyframes splash-text-shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}

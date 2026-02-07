import { useState, useEffect } from "react";
import vibraLogo from "@assets/Gemini_Generated_Image_adkxs1adkxs1adkx_1770463123334.png";

interface SplashScreenProps {
  onComplete: () => void;
}

export function SplashScreen({ onComplete }: SplashScreenProps) {
  const [phase, setPhase] = useState(0);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 300);
    const t2 = setTimeout(() => setPhase(2), 1200);
    const t3 = setTimeout(() => setPhase(3), 2200);
    const t4 = setTimeout(() => {
      setFadeOut(true);
      setTimeout(onComplete, 800);
    }, 4000);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [onComplete]);

  const dismiss = () => {
    setFadeOut(true);
    setTimeout(onComplete, 800);
  };

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
        gap: "16px",
        opacity: fadeOut ? 0 : 1,
        transition: "opacity 0.8s ease-out",
        overflow: "hidden",
      }}
    >
      <div style={{
        position: "absolute",
        inset: 0,
        background: "radial-gradient(ellipse at 50% 50%, rgba(139, 92, 246, 0.15) 0%, transparent 70%)",
        opacity: phase >= 1 ? 1 : 0,
        transition: "opacity 1s ease-in",
      }} />

      {[...Array(20)].map((_, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            width: `${Math.random() * 3 + 1}px`,
            height: `${Math.random() * 3 + 1}px`,
            borderRadius: "50%",
            backgroundColor: i % 3 === 0 ? "#c084fc" : i % 3 === 1 ? "#f472b6" : "#818cf8",
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            opacity: phase >= 1 ? (Math.random() * 0.7 + 0.3) : 0,
            transition: `opacity ${Math.random() * 2 + 1}s ease-in`,
            animation: phase >= 1 ? `splash-twinkle ${Math.random() * 3 + 2}s ease-in-out infinite` : "none",
            animationDelay: `${Math.random() * 2}s`,
          }}
        />
      ))}

      <img
        src={vibraLogo}
        alt="Vibra"
        style={{
          width: "200px",
          height: "200px",
          objectFit: "contain",
          opacity: phase >= 1 ? 1 : 0,
          transform: phase >= 1 ? "scale(1)" : "scale(0.3)",
          transition: "all 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)",
          filter: phase >= 2
            ? "drop-shadow(0 0 40px rgba(139, 92, 246, 0.6)) drop-shadow(0 0 80px rgba(168, 85, 247, 0.3))"
            : "drop-shadow(0 0 20px rgba(139, 92, 246, 0.3))",
          position: "relative",
          zIndex: 2,
        }}
      />

      <p style={{
        fontFamily: "'Space Grotesk', sans-serif",
        fontSize: "0.9rem",
        color: "rgba(192, 132, 252, 0.6)",
        letterSpacing: "0.2em",
        textTransform: "uppercase",
        opacity: phase >= 3 ? 1 : 0,
        transform: phase >= 3 ? "translateY(0)" : "translateY(10px)",
        transition: "all 0.6s ease-out",
        position: "relative",
        zIndex: 2,
      }}>
        Incontri Cosmici
      </p>

      <style>{`
        @keyframes splash-twinkle {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.5); }
        }
      `}</style>
    </div>
  );
}

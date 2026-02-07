import { useState, useEffect } from "react";

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
        backgroundColor: "#000",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "24px",
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

      <div style={{
        width: "120px",
        height: "120px",
        borderRadius: "50%",
        background: "linear-gradient(135deg, #6366f1, #a855f7, #c084fc)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity: phase >= 1 ? 1 : 0,
        transform: phase >= 1 ? "scale(1)" : "scale(0.3)",
        transition: "all 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)",
        boxShadow: phase >= 2
          ? "0 0 40px rgba(139, 92, 246, 0.6), 0 0 80px rgba(168, 85, 247, 0.3)"
          : "0 0 20px rgba(139, 92, 246, 0.3)",
        position: "relative",
        zIndex: 2,
      }}>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="rgba(255,255,255,0.9)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            width: "54px",
            height: "54px",
            opacity: phase >= 1 ? 1 : 0,
            transition: "opacity 0.6s ease-in 0.3s",
          }}
        >
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
      </div>

      <div style={{
        opacity: phase >= 2 ? 1 : 0,
        transform: phase >= 2 ? "translateY(0)" : "translateY(20px)",
        transition: "all 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)",
        position: "relative",
        zIndex: 2,
      }}>
        <h1 style={{
          fontFamily: "'Space Grotesk', sans-serif",
          fontSize: "3.5rem",
          fontWeight: 700,
          background: "linear-gradient(135deg, #c084fc, #f472b6, #e879f9)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
          letterSpacing: "0.08em",
          filter: "drop-shadow(0 0 20px rgba(192, 132, 252, 0.5))",
        }}>
          Vibra
        </h1>
      </div>

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

import { useState, useEffect, useRef, useCallback } from "react";
import vibraLogo from "@assets/Gemini_Generated_Image_adkxs1adkxs1adkx_1770463123334.png";

interface SplashScreenProps {
  onComplete: () => void;
}

const STAR_COUNT = 40;
const stars = Array.from({ length: STAR_COUNT }, (_, i) => ({
  id: i,
  size: Math.random() * 3 + 1,
  x: Math.random() * 100,
  y: Math.random() * 100,
  color: i % 4 === 0 ? "#c084fc" : i % 4 === 1 ? "#f472b6" : i % 4 === 2 ? "#818cf8" : "#67e8f9",
  delay: Math.random() * 3,
  duration: Math.random() * 2 + 2,
  maxOpacity: Math.random() * 0.6 + 0.4,
}));

export function SplashScreen({ onComplete }: SplashScreenProps) {
  const [stage, setStage] = useState<"video" | "transition" | "logo">("video");
  const [logoPhase, setLogoPhase] = useState(0);
  const [fadeOut, setFadeOut] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const dismiss = useCallback(() => {
    if (fadeOut) return;
    setFadeOut(true);
    setTimeout(onComplete, 800);
  }, [onComplete, fadeOut]);

  const handleVideoEnd = useCallback(() => {
    setStage("transition");
    setTimeout(() => {
      setStage("logo");
    }, 600);
  }, []);

  useEffect(() => {
    const vid = videoRef.current;
    if (vid) {
      vid.play().catch(() => {
        handleVideoEnd();
      });
    }

    const safety = setTimeout(() => {
      if (stage === "video") {
        handleVideoEnd();
      }
    }, 15000);

    return () => clearTimeout(safety);
  }, []);

  useEffect(() => {
    if (stage !== "logo") return;

    const t1 = setTimeout(() => setLogoPhase(1), 100);
    const t2 = setTimeout(() => setLogoPhase(2), 800);
    const t3 = setTimeout(() => setLogoPhase(3), 1600);
    const t4 = setTimeout(() => dismiss(), 4000);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [stage, dismiss]);

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
        transition: "opacity 0.8s ease-out",
        overflow: "hidden",
        cursor: "pointer",
      }}
    >
      {stage === "video" && (
        <video
          ref={videoRef}
          src="/images/splash-intro.mp4"
          muted
          playsInline
          onEnded={handleVideoEnd}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            zIndex: 1,
          }}
        />
      )}

      {stage === "transition" && (
        <div style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(circle at 50% 50%, rgba(139, 92, 246, 0.3) 0%, #0a0118 60%)",
          zIndex: 1,
          animation: "splash-pulse-in 0.6s ease-out forwards",
        }} />
      )}

      {(stage === "logo" || stage === "transition") && (
        <>
          <div style={{
            position: "absolute",
            inset: 0,
            background: "radial-gradient(ellipse at 50% 40%, rgba(139, 92, 246, 0.2) 0%, rgba(168, 85, 247, 0.05) 40%, transparent 70%)",
            opacity: stage === "logo" && logoPhase >= 1 ? 1 : 0,
            transition: "opacity 1.2s ease-in",
            zIndex: 1,
          }} />

          {stars.map((star) => (
            <div
              key={star.id}
              style={{
                position: "absolute",
                width: `${star.size}px`,
                height: `${star.size}px`,
                borderRadius: "50%",
                backgroundColor: star.color,
                left: `${star.x}%`,
                top: `${star.y}%`,
                opacity: stage === "logo" && logoPhase >= 1 ? star.maxOpacity : 0,
                transition: `opacity ${star.duration * 0.5}s ease-in`,
                animation: stage === "logo" && logoPhase >= 1
                  ? `splash-twinkle ${star.duration}s ease-in-out infinite`
                  : "none",
                animationDelay: `${star.delay}s`,
                boxShadow: star.size > 2.5
                  ? `0 0 ${star.size * 3}px ${star.color}80, 0 0 ${star.size * 6}px ${star.color}40`
                  : `0 0 ${star.size * 2}px ${star.color}60`,
                zIndex: 2,
              }}
            />
          ))}

          <div style={{
            position: "absolute",
            width: "300px",
            height: "300px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(139, 92, 246, 0.15) 0%, rgba(244, 114, 182, 0.08) 40%, transparent 70%)",
            opacity: stage === "logo" && logoPhase >= 2 ? 1 : 0,
            transition: "opacity 1.5s ease-in",
            animation: stage === "logo" && logoPhase >= 2 ? "splash-glow-pulse 4s ease-in-out infinite" : "none",
            zIndex: 2,
          }} />

          <img
            src={vibraLogo}
            alt="Vibra"
            style={{
              width: "200px",
              height: "200px",
              objectFit: "contain",
              opacity: stage === "logo" && logoPhase >= 1 ? 1 : 0,
              transform: stage === "logo" && logoPhase >= 1 ? "scale(1)" : "scale(0.3)",
              transition: "all 1s cubic-bezier(0.34, 1.56, 0.64, 1)",
              filter: stage === "logo" && logoPhase >= 2
                ? "drop-shadow(0 0 30px rgba(139, 92, 246, 0.7)) drop-shadow(0 0 60px rgba(168, 85, 247, 0.4)) drop-shadow(0 0 100px rgba(244, 114, 182, 0.2))"
                : "drop-shadow(0 0 15px rgba(139, 92, 246, 0.3))",
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
            background: stage === "logo" && logoPhase >= 3
              ? "linear-gradient(90deg, #c084fc, #f472b6, #67e8f9, #c084fc)"
              : "transparent",
            backgroundSize: "200% 100%",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: stage === "logo" && logoPhase >= 3 ? "transparent" : "rgba(192, 132, 252, 0)",
            animation: stage === "logo" && logoPhase >= 3 ? "splash-text-shimmer 3s linear infinite" : "none",
            opacity: stage === "logo" && logoPhase >= 3 ? 1 : 0,
            transform: stage === "logo" && logoPhase >= 3 ? "translateY(0)" : "translateY(15px)",
            transition: "all 0.8s ease-out",
            position: "relative",
            zIndex: 3,
            marginTop: "12px",
          }}>
            Incontri Cosmici
          </p>

          {stage === "logo" && logoPhase >= 2 && (
            <>
              {[0, 1, 2, 3, 4].map((i) => {
                const angle = (i / 5) * Math.PI * 2 - Math.PI / 2;
                const radius = 140;
                return (
                  <div
                    key={`orbit-${i}`}
                    style={{
                      position: "absolute",
                      width: "4px",
                      height: "4px",
                      borderRadius: "50%",
                      backgroundColor: "#fff",
                      left: `calc(50% + ${Math.cos(angle) * radius}px)`,
                      top: `calc(50% + ${Math.sin(angle) * radius}px - 20px)`,
                      boxShadow: "0 0 8px #c084fc, 0 0 16px #f472b6, 0 0 24px #818cf8",
                      animation: `splash-orbit 8s linear infinite`,
                      animationDelay: `${i * 1.6}s`,
                      opacity: 0.8,
                      zIndex: 3,
                    }}
                  />
                );
              })}
            </>
          )}
        </>
      )}

      <style>{`
        @keyframes splash-twinkle {
          0%, 100% { opacity: 0.2; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.8); }
        }
        @keyframes splash-glow-pulse {
          0%, 100% { transform: scale(1); opacity: 0.6; }
          50% { transform: scale(1.15); opacity: 1; }
        }
        @keyframes splash-pulse-in {
          0% { opacity: 0; transform: scale(0.5); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes splash-text-shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes splash-orbit {
          0% { transform: rotate(0deg) translateX(140px) rotate(0deg); opacity: 0; }
          10% { opacity: 0.9; }
          90% { opacity: 0.9; }
          100% { transform: rotate(360deg) translateX(140px) rotate(-360deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

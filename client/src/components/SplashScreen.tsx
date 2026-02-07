import { useState, useEffect, useRef } from "react";

interface SplashScreenProps {
  onComplete: () => void;
}

export function SplashScreen({ onComplete }: SplashScreenProps) {
  const [fadeOut, setFadeOut] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = false;
    video.play().catch(() => {
      video.muted = true;
      video.play().catch(() => {});
    });

    const handleEnded = () => {
      setFadeOut(true);
      setTimeout(onComplete, 800);
    };

    video.addEventListener("ended", handleEnded);

    const fallback = setTimeout(() => {
      setFadeOut(true);
      setTimeout(onComplete, 800);
    }, 8000);

    return () => {
      video.removeEventListener("ended", handleEnded);
      clearTimeout(fallback);
    };
  }, [onComplete]);

  return (
    <div
      data-testid="splash-screen"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        backgroundColor: "#000",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        opacity: fadeOut ? 0 : 1,
        transition: "opacity 0.8s ease-out",
      }}
      onClick={() => {
        setFadeOut(true);
        setTimeout(onComplete, 800);
      }}
    >
      <video
        ref={videoRef}
        src="/images/splash-video.mp4"
        playsInline
        preload="auto"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
        }}
      />

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
        }}
      >
        <h1
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: "clamp(3rem, 12vw, 6rem)",
            fontWeight: 700,
            background: "linear-gradient(135deg, #c084fc, #f472b6, #c084fc)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            letterSpacing: "0.05em",
            textShadow: "none",
            filter: "drop-shadow(0 0 30px rgba(192, 132, 252, 0.6)) drop-shadow(0 0 60px rgba(244, 114, 182, 0.3))",
            animation: "vibra-pulse 2s ease-in-out infinite",
          }}
        >
          Vibra
        </h1>
      </div>

      <style>{`
        @keyframes vibra-pulse {
          0%, 100% { filter: drop-shadow(0 0 30px rgba(192, 132, 252, 0.6)) drop-shadow(0 0 60px rgba(244, 114, 182, 0.3)); }
          50% { filter: drop-shadow(0 0 50px rgba(192, 132, 252, 0.8)) drop-shadow(0 0 80px rgba(244, 114, 182, 0.5)); }
        }
      `}</style>
    </div>
  );
}

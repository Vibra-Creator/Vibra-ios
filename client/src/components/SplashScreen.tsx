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
    }, 12000);

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
          objectFit: "contain",
          backgroundColor: "#000",
        }}
      />
    </div>
  );
}

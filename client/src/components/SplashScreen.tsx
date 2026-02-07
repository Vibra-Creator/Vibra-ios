import { useState, useEffect, useRef } from "react";

interface SplashScreenProps {
  onComplete: () => void;
}

export function SplashScreen({ onComplete }: SplashScreenProps) {
  const [fadeOut, setFadeOut] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const dismiss = () => {
    if (fadeOut) return;
    setFadeOut(true);
    setTimeout(onComplete, 800);
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const tryPlay = async () => {
      try {
        video.muted = true;
        await video.play();
        try {
          video.muted = false;
        } catch {}
      } catch {
        dismiss();
      }
    };

    if (video.readyState >= 2) {
      tryPlay();
    } else {
      video.addEventListener("canplay", tryPlay, { once: true });
    }

    video.addEventListener("ended", dismiss);

    const fallback = setTimeout(dismiss, 12000);

    return () => {
      video.removeEventListener("canplay", tryPlay);
      video.removeEventListener("ended", dismiss);
      clearTimeout(fallback);
    };
  }, []);

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
      onClick={dismiss}
    >
      <video
        ref={videoRef}
        src="/images/splash-video.mp4"
        muted
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

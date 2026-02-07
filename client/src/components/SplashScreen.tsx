import { useState, useEffect, useRef } from "react";

interface SplashScreenProps {
  onComplete: () => void;
}

export function SplashScreen({ onComplete }: SplashScreenProps) {
  const [fadeOut, setFadeOut] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const dismissedRef = useRef(false);

  const dismiss = () => {
    if (dismissedRef.current) return;
    dismissedRef.current = true;
    setFadeOut(true);
    setTimeout(onComplete, 800);
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      dismiss();
      return;
    }

    const playVideo = () => {
      video.play().catch(() => {
        console.log("[Splash] Video play failed, dismissing");
        dismiss();
      });
    };

    video.addEventListener("ended", dismiss);
    video.addEventListener("error", () => {
      console.log("[Splash] Video error");
      setVideoError(true);
      dismiss();
    });

    if (video.readyState >= 3) {
      playVideo();
    } else {
      video.addEventListener("canplay", playVideo, { once: true });
    }

    const fallback = setTimeout(dismiss, 12000);

    return () => {
      clearTimeout(fallback);
    };
  }, []);

  if (videoError) return null;

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
        muted
        playsInline
        autoPlay
        preload="auto"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "contain",
          backgroundColor: "#000",
        }}
      >
        <source src="/images/splash-video.mp4" type="video/mp4" />
      </video>
    </div>
  );
}

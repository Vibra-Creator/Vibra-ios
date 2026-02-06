import { useRef, useEffect } from "react";

interface VortexLogoProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizePx = {
  sm: 40,
  md: 80,
  lg: 144,
};

export function VortexLogo({ size = "sm", className = "" }: VortexLogoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const px = sizePx[size];

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const tryPlay = () => {
      video.muted = true;
      video.play().catch(() => {});
    };

    if (video.readyState >= 2) {
      tryPlay();
    } else {
      video.addEventListener("loadeddata", tryPlay, { once: true });
    }

    return () => {
      video.removeEventListener("loadeddata", tryPlay);
    };
  }, []);

  return (
    <div
      className={className}
      style={{
        width: px,
        height: px,
        borderRadius: "50%",
        overflow: "hidden",
        boxShadow: "0 0 25px rgba(139, 92, 246, 0.5)",
        flexShrink: 0,
      }}
    >
      <video
        ref={videoRef}
        src="/images/vibra-vortex.mp4"
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
      />
    </div>
  );
}

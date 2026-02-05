import { useRef, useEffect, useState } from "react";

interface VideoBackgroundProps {
  videoUrl?: string;
  fallbackGradient?: boolean;
}

export function VideoBackground({ videoUrl, fallbackGradient = true }: VideoBackgroundProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoError, setVideoError] = useState(false);

  useEffect(() => {
    if (videoRef.current && videoUrl) {
      videoRef.current.play().catch(() => setVideoError(true));
    }
  }, [videoUrl]);

  if (!videoUrl || videoError) {
    if (fallbackGradient) {
      return (
        <div className="fixed inset-0 -z-10 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-background via-[hsl(280,50%,8%)] to-[hsl(260,60%,5%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_hsl(280,100%,20%,0.15),transparent_50%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_hsl(185,85%,30%,0.1),transparent_50%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_hsl(320,90%,40%,0.08),transparent_40%)]" />
          <Stars />
        </div>
      );
    }
    return null;
  }

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden">
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover"
        src={videoUrl}
        muted
        loop
        playsInline
        autoPlay
      />
      <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" />
    </div>
  );
}

function Stars() {
  const [stars] = useState(() => 
    Array.from({ length: 50 }, () => ({
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 100}%`,
      size: Math.random() * 2 + 1,
      delay: Math.random() * 3,
      duration: Math.random() * 2 + 2,
    }))
  );

  return (
    <>
      {stars.map((star, i) => (
        <div
          key={i}
          className="absolute rounded-full bg-white animate-pulse"
          style={{
            left: star.left,
            top: star.top,
            width: star.size,
            height: star.size,
            animationDelay: `${star.delay}s`,
            animationDuration: `${star.duration}s`,
            opacity: Math.random() * 0.5 + 0.3,
          }}
        />
      ))}
    </>
  );
}

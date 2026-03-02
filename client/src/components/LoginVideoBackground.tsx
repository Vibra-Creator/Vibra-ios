import { useRef, useEffect } from "react";

export function LoginVideoBackground() {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = true;
    video.setAttribute("muted", "");
    video.setAttribute("playsinline", "");
    video.setAttribute("webkit-playsinline", "");
    const tryPlay = () => {
      if (video.paused) video.play().catch(() => {});
    };
    tryPlay();
    const onVisible = () => { if (!document.hidden) tryPlay(); };
    document.addEventListener("visibilitychange", onVisible);
    document.addEventListener("touchstart", tryPlay, { once: true });
    document.addEventListener("click", tryPlay, { once: true });
    document.addEventListener("scroll", tryPlay, { once: true });
    const interval = setInterval(tryPlay, 500);
    const cleanup = setTimeout(() => clearInterval(interval), 5000);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      document.removeEventListener("touchstart", tryPlay);
      document.removeEventListener("click", tryPlay);
      document.removeEventListener("scroll", tryPlay);
      clearInterval(interval);
      clearTimeout(cleanup);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-0" style={{ background: "#0a0118" }}>
      <video
        ref={videoRef}
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        className="w-full h-full object-cover"
        src="/backgrounds/vibra-login-bg.mp4"
        data-testid="video-login-bg"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/30 to-black/50" />
    </div>
  );
}

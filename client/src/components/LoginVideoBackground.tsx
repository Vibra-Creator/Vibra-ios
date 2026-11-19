import { useDeferredVideo } from "@/hooks/use-deferred-video";

export function LoginVideoBackground() {
  const { videoRef, shouldLoadVideo } = useDeferredVideo();

  return (
    <div className="fixed inset-0 z-0" style={{ background: "#0a0118" }}>
      <video
        ref={videoRef}
        autoPlay={shouldLoadVideo}
        loop
        muted
        playsInline
        preload="none"
        poster="/backgrounds/vibra-login-poster.webp"
        className="w-full h-full object-cover"
        src={shouldLoadVideo ? "/backgrounds/vibra-login-bg.mp4" : undefined}
        data-testid="video-login-bg"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/30 to-black/50" />
    </div>
  );
}

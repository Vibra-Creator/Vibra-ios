import { useState, useRef, useEffect } from "react";
import { X, Volume2, VolumeX } from "lucide-react";
import type { ProfileVideo } from "@shared/schema";

interface StoryViewerProps {
  profile: { name: string; imageUrl?: string | null };
  videos: ProfileVideo[];
  onClose: () => void;
}

export function StoryViewer({ profile, videos, onClose }: StoryViewerProps) {
  const [index, setIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [muted, setMuted] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const video = videos[index];

  useEffect(() => {
    setProgress(0);
    const vid = videoRef.current;
    if (!vid) return;
    vid.muted = true;
    vid.currentTime = 0;
    const playPromise = vid.play();
    if (playPromise) playPromise.catch(() => {});
  }, [index]);

  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    const onTimeUpdate = () => {
      if (vid.duration > 0) setProgress((vid.currentTime / vid.duration) * 100);
    };
    const onEnded = () => {
      if (index < videos.length - 1) setIndex(i => i + 1);
      else onClose();
    };
    vid.addEventListener("timeupdate", onTimeUpdate);
    vid.addEventListener("ended", onEnded);
    return () => {
      vid.removeEventListener("timeupdate", onTimeUpdate);
      vid.removeEventListener("ended", onEnded);
    };
  }, [index, videos.length, onClose]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" && index < videos.length - 1) setIndex(i => i + 1);
      if (e.key === "ArrowLeft" && index > 0) setIndex(i => i - 1);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [index, videos.length, onClose]);

  if (!video) return null;

  const toggleMute = () => {
    const newMuted = !muted;
    setMuted(newMuted);
    if (videoRef.current) videoRef.current.muted = newMuted;
  };

  return (
    <div
      className="fixed inset-0 z-[100] bg-black flex items-center justify-center"
      data-testid="story-viewer"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="relative w-full h-full max-w-sm mx-auto flex flex-col">
        <div className="absolute top-0 left-0 right-0 z-20 flex gap-1 p-3 pt-4">
          {videos.map((_, i) => (
            <div key={i} className="flex-1 h-[3px] rounded-full bg-white/30 overflow-hidden">
              <div
                className="h-full bg-white rounded-full"
                style={{
                  width: i < index ? "100%" : i === index ? `${progress}%` : "0%",
                  transition: i === index ? "none" : undefined,
                }}
              />
            </div>
          ))}
        </div>

        <div className="absolute top-7 left-0 right-0 z-20 flex items-center justify-between px-3 pt-2">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-full overflow-hidden border-2 border-cyan-400/70 shrink-0">
              {profile.imageUrl ? (
                <img src={profile.imageUrl} alt={profile.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-cyan-900 flex items-center justify-center text-sm text-cyan-300 font-bold">
                  {profile.name?.[0]?.toUpperCase()}
                </div>
              )}
            </div>
            <span className="text-white font-semibold text-sm drop-shadow-lg">{profile.name}</span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={toggleMute} className="text-white/80 hover:text-white" data-testid="button-story-mute">
              {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </button>
            <button onClick={onClose} className="text-white/80 hover:text-white" data-testid="button-story-close">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div
          className="absolute left-0 top-0 w-1/3 h-full z-10 cursor-pointer"
          onClick={() => index > 0 && setIndex(i => i - 1)}
        />
        <div
          className="absolute right-0 top-0 w-1/3 h-full z-10 cursor-pointer"
          onClick={() => index < videos.length - 1 ? setIndex(i => i + 1) : onClose()}
        />

        <video
          ref={videoRef}
          key={video.id}
          src={video.videoUrl}
          className="w-full h-full object-contain bg-black"
          playsInline
          autoPlay
          muted={muted}
          data-testid="story-video"
        />
      </div>
    </div>
  );
}

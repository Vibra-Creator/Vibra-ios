import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { X, Play, Volume2, VolumeX } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";

interface StoryItem {
  profileId: string;
  profileName: string;
  profileImage: string | null;
  videoUrl: string;
  thumbnailUrl: string | null;
  createdAt: string;
}

interface StoryViewerProps {
  stories: StoryItem[];
  initialIndex: number;
  onClose: () => void;
}

function StoryViewer({ stories, initialIndex, onClose }: StoryViewerProps) {
  const [index, setIndex] = useState(initialIndex);
  const [progress, setProgress] = useState(0);
  const [muted, setMuted] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const story = stories[index];

  useEffect(() => {
    setProgress(0);
    const vid = videoRef.current;
    if (!vid) return;
    vid.currentTime = 0;
    vid.play().catch(() => {});
  }, [index]);

  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;

    const onTimeUpdate = () => {
      if (vid.duration && vid.duration > 0) {
        setProgress((vid.currentTime / vid.duration) * 100);
      }
    };
    const onEnded = () => {
      if (index < stories.length - 1) {
        setIndex(i => i + 1);
      } else {
        onClose();
      }
    };
    vid.addEventListener("timeupdate", onTimeUpdate);
    vid.addEventListener("ended", onEnded);
    return () => {
      vid.removeEventListener("timeupdate", onTimeUpdate);
      vid.removeEventListener("ended", onEnded);
    };
  }, [index, stories.length, onClose]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" && index < stories.length - 1) setIndex(i => i + 1);
      if (e.key === "ArrowLeft" && index > 0) setIndex(i => i - 1);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [index, stories.length, onClose]);

  if (!story) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black flex items-center justify-center" data-testid="story-viewer">
      <div className="relative w-full h-full max-w-sm mx-auto flex flex-col">
        <div className="absolute top-0 left-0 right-0 z-20 flex gap-1 p-3">
          {stories.map((_, i) => (
            <div key={i} className="flex-1 h-0.5 rounded-full bg-white/30 overflow-hidden">
              <div
                className="h-full bg-white transition-none rounded-full"
                style={{ width: i < index ? "100%" : i === index ? `${progress}%` : "0%" }}
              />
            </div>
          ))}
        </div>

        <div className="absolute top-6 left-0 right-0 z-20 flex items-center justify-between px-3 pt-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full overflow-hidden border border-cyan-400/60 shrink-0">
              {story.profileImage ? (
                <img src={story.profileImage} alt={story.profileName} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-cyan-900 flex items-center justify-center text-xs text-cyan-300 font-bold">
                  {story.profileName?.[0]?.toUpperCase()}
                </div>
              )}
            </div>
            <span className="text-white font-semibold text-sm drop-shadow">{story.profileName}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setMuted(m => !m); if (videoRef.current) videoRef.current.muted = !muted; }}
              className="text-white/80 hover:text-white transition-colors"
              data-testid="button-story-mute"
            >
              {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </button>
            <button onClick={onClose} className="text-white/80 hover:text-white transition-colors" data-testid="button-story-close">
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
          onClick={() => index < stories.length - 1 ? setIndex(i => i + 1) : onClose()}
        />

        <video
          ref={videoRef}
          src={story.videoUrl}
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

export function StoriesBar() {
  const { t } = useLanguage();
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);

  const { data: stories = [] } = useQuery<StoryItem[]>({
    queryKey: ["/api/stories"],
    staleTime: 2 * 60 * 1000,
  });

  if (stories.length === 0) return null;

  const openViewer = (index: number) => {
    setViewerIndex(index);
    setViewerOpen(true);
  };

  return (
    <>
      <div className="relative z-10 py-2 px-1" data-testid="stories-bar">
        <div className="flex items-center gap-0.5 px-2 mb-1.5">
          <span className="text-[10px] font-bold tracking-widest text-cyan-400/70 uppercase">◈ {t("stories.title")}</span>
        </div>
        <div className="flex gap-3 overflow-x-auto scrollbar-hide px-2 pb-1">
          {stories.map((story, i) => (
            <button
              key={story.profileId}
              onClick={() => openViewer(i)}
              className="flex flex-col items-center gap-1 shrink-0 group"
              data-testid={`button-story-${story.profileId}`}
            >
              <div className="relative w-14 h-14">
                <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-cyan-400 via-violet-500 to-emerald-400 p-[2px] animate-pulse-slow group-hover:animate-none group-hover:opacity-100">
                  <div className="w-full h-full rounded-full bg-black/60 overflow-hidden">
                    {story.profileImage ? (
                      <img
                        src={story.profileImage}
                        alt={story.profileName}
                        className="w-full h-full object-cover rounded-full"
                      />
                    ) : (
                      <div className="w-full h-full rounded-full bg-gradient-to-br from-cyan-900 to-violet-900 flex items-center justify-center text-lg font-bold text-cyan-300">
                        {story.profileName?.[0]?.toUpperCase()}
                      </div>
                    )}
                  </div>
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-black flex items-center justify-center border border-cyan-400/40">
                  <Play className="w-2 h-2 text-cyan-400 fill-cyan-400" />
                </div>
              </div>
              <span className="text-[10px] text-white/70 group-hover:text-cyan-300 transition-colors max-w-[56px] truncate font-medium">
                {story.profileName}
              </span>
            </button>
          ))}
        </div>
      </div>

      {viewerOpen && (
        <StoryViewer
          stories={stories}
          initialIndex={viewerIndex}
          onClose={() => setViewerOpen(false)}
        />
      )}
    </>
  );
}

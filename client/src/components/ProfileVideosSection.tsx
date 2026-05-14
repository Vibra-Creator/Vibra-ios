import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { MapPin, Play, Plus, X, Star, VideoIcon, AlertCircle } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/i18n/LanguageContext";
import type { ProfileVideo } from "@shared/schema";

interface ProfileVideosSectionProps {
  profileId: string;
  currentMainVideoUrl?: string | null;
  onMainVideoChanged?: (url: string) => void;
}

export function ProfileVideosSection({ profileId, currentMainVideoUrl, onMainVideoChanged }: ProfileVideosSectionProps) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const { data: videos = [] } = useQuery<ProfileVideo[]>({
    queryKey: ["/api/profiles", profileId, "videos"],
  });

  const deleteMutation = useMutation({
    mutationFn: (videoId: string) => apiRequest("DELETE", `/api/profiles/videos/${videoId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profiles", profileId, "videos"] });
      toast({ title: t("profile.videoDeleted"), description: t("profile.videoDeletedDesc") });
    },
    onError: () => {
      toast({ title: t("profile.videoDeleteError"), variant: "destructive" });
    },
  });

  const setMainVideoMutation = useMutation({
    mutationFn: (videoUrl: string) => apiRequest("POST", "/api/profiles/set-main-video", { videoUrl }),
    onSuccess: (_data: any, videoUrl: string) => {
      queryClient.invalidateQueries({ queryKey: ["/api/profiles/me"] });
      queryClient.removeQueries({ queryKey: ["/api/profiles/swipable"] });
      if (onMainVideoChanged) onMainVideoChanged(videoUrl);
      toast({ title: "Video principale impostato!", description: "Questo video ora appare al posto della foto nella card." });
    },
    onError: () => {
      toast({ title: "Errore", description: "Impossibile impostare il video principale.", variant: "destructive" });
    },
  });

  return (
    <div className="space-y-4 rounded-2xl border border-cyan-400/30 bg-cyan-950/20 p-4" data-testid="profile-videos-section">
      <div className="flex items-center gap-2.5">
        <VideoIcon className="w-6 h-6 text-cyan-400" />
        <h3 className="text-lg font-bold text-cyan-300">{t("profile.videos")}</h3>
        <span className="text-sm font-semibold text-cyan-400/70 ml-1">{videos.length}/10 video</span>
      </div>
      <p className="text-white/70 text-sm leading-snug">{t("profile.videosDesc")}</p>

      <div className="grid grid-cols-2 gap-3" data-testid="profile-videos-grid">
        {videos.map((video) => {
          const isMain = currentMainVideoUrl === video.videoUrl;
          return (
            <div key={video.id} className="relative aspect-video rounded-xl overflow-hidden border border-cyan-400/30 bg-black/40" data-testid={`profile-video-item-${video.id}`}>
              <video
                src={video.videoUrl}
                className="w-full h-full object-cover"
                preload="metadata"
                muted
                playsInline
              />
              <div className="absolute inset-0 bg-black/30 flex items-center justify-center pointer-events-none">
                <Play className="w-10 h-10 text-white/90 fill-white/90" />
              </div>

              {video.location && (
                <div className="absolute top-1.5 left-1.5 flex items-center gap-1 bg-black/70 rounded-full px-2 py-0.5 max-w-[65%] pointer-events-none">
                  <MapPin className="w-2.5 h-2.5 text-cyan-400 shrink-0" />
                  <span className="text-[10px] text-white truncate">{video.location}</span>
                </div>
              )}

              {(video as any).gifOverlayUrl && (
                <div className="absolute top-6 right-1 pointer-events-none">
                  <img src={(video as any).gifOverlayUrl} alt="gif" className="w-12 h-12 object-contain rounded-lg" />
                </div>
              )}

              {(video as any).caption && (
                <div className="absolute bottom-7 left-0 right-0 px-1.5 pointer-events-none">
                  <div className="bg-black/60 rounded px-1.5 py-0.5">
                    <p className="text-white text-[10px] font-medium text-center truncate">{(video as any).caption}</p>
                  </div>
                </div>
              )}

              <button
                onClick={() => deleteMutation.mutate(video.id)}
                disabled={deleteMutation.isPending}
                className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/80 border border-white/30 flex items-center justify-center text-white hover:text-red-400 transition-colors z-10"
                data-testid={`button-delete-video-${video.id}`}
              >
                <X className="w-3.5 h-3.5" />
              </button>

              {isMain ? (
                <div className="absolute bottom-1.5 left-1.5 flex items-center gap-0.5 bg-primary/80 rounded-full px-1.5 py-0.5 z-10">
                  <Star className="w-2.5 h-2.5 text-white fill-white" />
                  <span className="text-[9px] font-bold text-white">PRINCIPALE</span>
                </div>
              ) : (
                <button
                  onClick={() => setMainVideoMutation.mutate(video.videoUrl)}
                  disabled={setMainVideoMutation.isPending}
                  className="absolute bottom-1.5 left-1.5 flex items-center gap-0.5 bg-black/70 hover:bg-primary/80 border border-white/30 rounded-full px-1.5 py-0.5 z-10 text-white/70 hover:text-white transition-colors"
                  data-testid={`button-set-main-video-${video.id}`}
                >
                  <Star className="w-2.5 h-2.5" />
                  <span className="text-[9px] font-semibold">Principale</span>
                </button>
              )}
            </div>
          );
        })}

        {videos.length < 10 && (
          <button
            onClick={() => navigate("/video-upload")}
            className="aspect-video rounded-xl border-2 border-dashed border-cyan-400/50 flex flex-col items-center justify-center gap-2 text-cyan-300 hover:border-cyan-400 hover:text-cyan-200 hover:bg-cyan-400/10 transition-colors bg-cyan-950/30 active:scale-95"
            data-testid="button-add-video"
          >
            <Plus className="w-7 h-7" />
            <span className="text-xs font-semibold">{t("profile.addVideo")}</span>
          </button>
        )}
      </div>

      <p className="text-white/50 text-xs flex items-center gap-1.5">
        <AlertCircle className="w-3.5 h-3.5 shrink-0 text-cyan-400/60" />
        {t("profile.videoInactiveNotice")}
      </p>
    </div>
  );
}

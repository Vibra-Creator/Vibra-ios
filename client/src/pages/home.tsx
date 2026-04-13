import { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Sparkles, PenSquare, Image as ImageIcon, Video, Type, X } from "lucide-react";
import { SwipeCard, ActionButtons } from "@/components/SwipeCard";
import { MatchModal } from "@/components/MatchModal";
import { EmptyState, ProfileCardSkeleton } from "@/components/EmptyState";
import { ActivityToastSystem } from "@/components/ActivityFeed";
import { Button } from "@/components/ui/button";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useGuest } from "@/hooks/use-guest";
import { useGuestBlocker } from "@/components/GuestBlocker";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/i18n/LanguageContext";
import { useLocation } from "wouter";
import type { Profile, Match } from "@shared/schema";

interface SwipableResponse {
  profiles: Profile[];
  likedIds: string[];
}

export default function Home() {
  const [showMatch, setShowMatch] = useState(false);
  const [matchedProfile, setMatchedProfile] = useState<Profile | null>(null);
  const [currentMatchId, setCurrentMatchId] = useState<string | null>(null);
  const [swipedProfiles, setSwipedProfiles] = useState<Set<string>>(new Set());
  const [swipeHistory, setSwipeHistory] = useState<string[]>([]);
  const [globalMuted, setGlobalMuted] = useState(false);
  const [showPostComposer, setShowPostComposer] = useState(false);
  const [postText, setPostText] = useState("");
  const [postBg, setPostBg] = useState("#7c3aed");
  const [postTextColor, setPostTextColor] = useState("#ffffff");
  const [postMediaType, setPostMediaType] = useState<"text" | "image" | "video">("text");
  const [postMediaFile, setPostMediaFile] = useState<File | null>(null);
  const [postMediaPreview, setPostMediaPreview] = useState<string | null>(null);
  const { user, logout: logoutFn } = useAuth();
  const { isGuest } = useGuest();
  const { blockIfGuest, GuestBlockerModal } = useGuestBlocker();
  const { toast } = useToast();
  const { t } = useLanguage();
  const [, setLocation] = useLocation();

  useEffect(() => {
    try { if (navigator.vibrate) navigator.vibrate([40, 30, 40]); } catch {}
    const playWelcomeSound = () => {
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();
        osc1.type = "sine";
        osc1.frequency.setValueAtTime(523, ctx.currentTime);
        osc1.frequency.linearRampToValueAtTime(784, ctx.currentTime + 0.15);
        osc2.type = "sine";
        osc2.frequency.setValueAtTime(659, ctx.currentTime + 0.12);
        osc2.frequency.linearRampToValueAtTime(1047, ctx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.08);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4);
        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);
        osc1.start(ctx.currentTime);
        osc1.stop(ctx.currentTime + 0.25);
        osc2.start(ctx.currentTime + 0.12);
        osc2.stop(ctx.currentTime + 0.4);
        setTimeout(() => ctx.close().catch(() => {}), 600);
      } catch {}
    };
    playWelcomeSound();
  }, []);

  const { data: myProfile, isLoading: profileLoading } = useQuery<Profile | null>({
    queryKey: ["/api/profiles/me"],
    enabled: !!user && !isGuest,
  });

  const { data: guestProfiles, isLoading: guestLoading } = useQuery<Profile[]>({
    queryKey: ["/api/profiles"],
    enabled: isGuest,
  });

  const { data: swipableData, isLoading, error, refetch } = useQuery<SwipableResponse>({
    queryKey: ["/api/profiles/swipable", myProfile?.id],
    queryFn: async () => {
      const res = await fetch(`/api/profiles/swipable?profileId=${myProfile?.id}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch profiles");
      return res.json();
    },
    enabled: !!myProfile && !isGuest,
  });

  const profiles = swipableData?.profiles;
  const likedIdsSet = new Set(swipableData?.likedIds || []);

  const profileIds = profiles?.map(p => p.id).join(",") || "";
  const { data: roomOwners } = useQuery<Record<string, boolean>>({
    queryKey: ["/api/private-rooms/owners", profileIds],
    queryFn: async () => {
      const res = await fetch(`/api/private-rooms/owners?profileIds=${profileIds}`, {
        credentials: "include",
      });
      if (!res.ok) return {};
      return res.json();
    },
    enabled: !!profiles && profiles.length > 0,
  });

  const swipeMutation = useMutation({
    mutationFn: async ({ profileId, liked }: { profileId: string; liked: boolean }) => {
      const response = await apiRequest("POST", "/api/swipe", {
        swiperId: myProfile?.id,
        swipedId: profileId,
        liked,
      });
      return response as { swipe: any; match: boolean; matchData?: Match };
    },
    onSuccess: (data, variables) => {
      if (data.match) {
        const matchProfile = profiles?.find(p => p.id === variables.profileId);
        if (matchProfile) {
          setMatchedProfile(matchProfile);
          setCurrentMatchId(data.matchData?.id || null);
          setShowMatch(true);
        }
        queryClient.invalidateQueries({ queryKey: ["/api/matches", myProfile?.id] });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/profiles/swipable"] });
    },
    onError: (error: Error) => {
      console.error("[Swipe error]", error.message);
      queryClient.invalidateQueries({ queryKey: ["/api/profiles/swipable"] });
      if (error.message.includes("Already swiped")) {
        return;
      }
      toast({
        title: t("common.error"),
        description: t("home.swipeError"),
        variant: "destructive",
      });
    },
  });

  const allProfiles = isGuest ? (guestProfiles || []) : (profiles || []);
  const availableProfiles = allProfiles.filter(p => 
    !swipedProfiles.has(p.id)
  );
  const currentProfile = availableProfiles[0];

  const nextProfile = availableProfiles[1];

  useEffect(() => {
    const upcoming = availableProfiles.slice(1, 5);
    upcoming.forEach(p => {
      if (p.imageUrl) {
        const img = new window.Image();
        img.src = p.imageUrl;
      }
      (p.photos || []).forEach((url: string) => {
        const img = new window.Image();
        img.src = url;
      });
    });
  }, [availableProfiles.map(p => p.id).slice(0, 5).join(",")]);

  const handleSwipe = useCallback((direction: "left" | "right") => {
    if (!currentProfile) return;
    if (isGuest) {
      blockIfGuest(direction === "right" ? t("home.like") : t("home.dislike"));
      return;
    }

    if (likedIdsSet.has(currentProfile.id)) {
      setSwipedProfiles(prev => {
        const newSet = new Set(prev);
        newSet.add(currentProfile.id);
        return newSet;
      });
      return;
    }

    setSwipeHistory(prev => [...prev, currentProfile.id]);
    setSwipedProfiles(prev => {
      const newSet = new Set(prev);
      newSet.add(currentProfile.id);
      return newSet;
    });
    swipeMutation.mutate({
      profileId: currentProfile.id,
      liked: direction === "right",
    });
  }, [currentProfile, swipeMutation, isGuest, blockIfGuest, likedIdsSet]);

  const undoMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", "/api/swipes/last"),
    onSuccess: (data: any) => {
      const undoneId = data?.undoneProfileId;
      if (undoneId) {
        setSwipedProfiles(prev => {
          const newSet = new Set(prev);
          newSet.delete(undoneId);
          return newSet;
        });
        setSwipeHistory(prev => prev.filter(id => id !== undoneId));
      }
      queryClient.invalidateQueries({ queryKey: ["/api/profiles/swipable", myProfile?.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/matches", myProfile?.id] });
    },
    onError: () => {
      toast({ title: t("common.error"), description: "Impossibile annullare lo swipe", variant: "destructive" });
    },
  });

  const handleUndo = useCallback(() => {
    if (swipeHistory.length === 0) return;
    undoMutation.mutate();
  }, [swipeHistory, undoMutation]);

  const resetDislikesMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", "/api/swipes/disliked");
    },
    onSuccess: () => {
      setSwipedProfiles(new Set());
      queryClient.invalidateQueries({ queryKey: ["/api/profiles/swipable", myProfile?.id] });
      refetch();
      toast({ title: t("home.profilesRestored"), description: t("home.profilesRestoredDesc") });
    },
    onError: () => {
      toast({ title: t("common.error"), description: t("home.restoreError"), variant: "destructive" });
    },
  });

  const handleSwipeLeft = useCallback(() => handleSwipe("left"), [handleSwipe]);
  const handleSwipeRight = useCallback(() => handleSwipe("right"), [handleSwipe]);


  const bgLayer = (
    <div className="fixed inset-0 z-0">
      <img src="/backgrounds/vibra-dance.png" alt="" className="w-full h-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/20 to-black/40" />
    </div>
  );

  const createPostMutation = useMutation({
    mutationFn: async () => {
      if (postMediaFile) {
        const uploadRes = await fetch("/api/signals/request-upload", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contentType: postMediaFile.type, size: postMediaFile.size }),
        });
        if (!uploadRes.ok) throw new Error("Upload fallito");
        const { uploadURL, objectPath } = await uploadRes.json();
        const putRes = await fetch(uploadURL, {
          method: "PUT",
          body: postMediaFile,
          headers: { "Content-Type": postMediaFile.type },
        });
        if (!putRes.ok) throw new Error("Upload fallito");
        return apiRequest("POST", "/api/signals", {
          content: postText.trim(),
          mediaType: postMediaType,
          mediaUrl: objectPath,
          textColor: postTextColor,
          backgroundColor: postBg,
        });
      }
      return apiRequest("POST", "/api/signals", {
        content: postText.trim(),
        mediaType: postMediaType,
        textColor: postTextColor,
        backgroundColor: postBg,
      });
    },
    onSuccess: () => {
      setPostText("");
      setPostMediaFile(null);
      setPostMediaPreview(null);
      setPostMediaType("text");
      setShowPostComposer(false);
      queryClient.invalidateQueries({ queryKey: ["/api/signals"] });
      toast({ title: "Post pubblicato", description: "Si vedrà subito nel feed." });
    },
  });

  const loadingState = isGuest ? guestLoading : (profileLoading || isLoading);

  const matchModalElement = !isGuest ? (
    <MatchModal
      isOpen={showMatch}
      onClose={() => setShowMatch(false)}
      matchedProfile={matchedProfile}
      currentProfile={myProfile}
      matchId={currentMatchId}
    />
  ) : null;

  if (loadingState) {
    return (
      <div className="flex-1 flex items-center justify-center p-4 relative">
        {bgLayer}
        <div className="relative z-10 w-full max-w-sm">
          <ProfileCardSkeleton />
        </div>
        {matchModalElement}
      </div>
    );
  }

  if (!isGuest && !myProfile) {
    return (
      <div className="flex-1 flex items-center justify-center p-4 relative">
        {bgLayer}
        <div className="relative z-10 text-center max-w-sm mx-auto">
          <div className="backdrop-blur-md bg-white/10 rounded-2xl p-8 border border-white/20">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/20 flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">{t("home.welcome")}</h2>
            <p className="text-white/70 text-sm mb-6">
              {t("home.createProfilePrompt")}
            </p>
            <Button
              className="w-full mb-3"
              onClick={() => window.location.href = "/profile/edit"}
              data-testid="button-create-profile"
            >
              {t("home.createProfile")}
            </Button>
            <Button
              variant="ghost"
              className="w-full text-white/60"
              onClick={() => logoutFn()}
              data-testid="button-logout-home"
            >
              {t("home.backToLogin")}
            </Button>
          </div>
        </div>
        {matchModalElement}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center p-4 relative">
        {bgLayer}
        <div className="relative z-10"><EmptyState type="error" onRetry={() => refetch()} /></div>
        {matchModalElement}
      </div>
    );
  }

  if (!availableProfiles.length) {
    return (
      <div className="flex-1 flex items-center justify-center p-4 relative">
        {bgLayer}
        <div className="relative z-10">
          <EmptyState 
            type="no-profiles" 
            onRetry={() => {
              resetDislikesMutation.mutate();
            }}
            onResetDislikes={() => resetDislikesMutation.mutate()}
            isResetting={resetDislikesMutation.isPending}
          />
        </div>
        {matchModalElement}
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col relative overflow-hidden">
      {bgLayer}
      <button
        type="button"
        onClick={() => setShowPostComposer(true)}
        className="fixed left-4 top-1/2 -translate-y-1/2 z-30 w-12 h-12 rounded-full bg-fuchsia-500/90 backdrop-blur-md flex items-center justify-center shadow-lg border border-white/20"
        data-testid="button-open-post-composer"
      >
        <PenSquare className="w-6 h-6 text-white" />
      </button>
      {showPostComposer && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/60">
          <div className="w-full max-w-sm aspect-[3/4] rounded-3xl p-4 border border-white/15 backdrop-blur-xl flex flex-col" style={{ background: postBg }}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setPostMediaType("text")} className="w-9 h-9 rounded-full bg-black/20 flex items-center justify-center" data-testid="button-post-type-text"><Type className="w-5 h-5 text-white" /></button>
                <button type="button" onClick={() => setPostMediaType("image")} className="w-9 h-9 rounded-full bg-black/20 flex items-center justify-center" data-testid="button-post-type-image"><ImageIcon className="w-5 h-5 text-white" /></button>
                <button type="button" onClick={() => setPostMediaType("video")} className="w-9 h-9 rounded-full bg-black/20 flex items-center justify-center" data-testid="button-post-type-video"><Video className="w-5 h-5 text-white" /></button>
              </div>
              <button type="button" onClick={() => setShowPostComposer(false)} className="w-9 h-9 rounded-full bg-black/20 flex items-center justify-center" data-testid="button-close-post-composer"><X className="w-5 h-5 text-white" /></button>
            </div>
            <div className="flex-1 flex flex-col gap-3 min-h-0">
              <textarea
                value={postText}
                onChange={(e) => setPostText(e.target.value)}
                placeholder={t("home.postPlaceholder")}
                className="w-full flex-1 rounded-2xl p-4 bg-black/20 text-white placeholder:text-white/60 outline-none resize-none"
                data-testid="textarea-post-content"
              />
              {postMediaType !== "text" && (
                <div className="space-y-2">
                  <input
                    type="file"
                    accept={postMediaType === "image" ? "image/*" : "video/*"}
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      setPostMediaFile(file);
                      setPostMediaPreview(file ? URL.createObjectURL(file) : null);
                    }}
                    className="hidden"
                    id="post-media-input"
                    data-testid="input-post-media"
                  />
                  <label htmlFor="post-media-input" className="block w-full rounded-2xl border border-dashed border-white/30 px-4 py-5 text-center text-white/80" data-testid="button-upload-media">
                    Carica da rullino
                  </label>
                  {postMediaPreview && postMediaType === "image" && <img src={postMediaPreview} alt="" className="w-full max-h-40 object-cover rounded-2xl" />}
                  {postMediaPreview && postMediaType === "video" && <video src={postMediaPreview} controls className="w-full max-h-40 rounded-2xl" />}
                </div>
              )}
              <div className="flex items-center gap-2 mt-auto">
                {["#7c3aed", "#db2777", "#0f766e", "#1d4ed8"].map(color => (
                  <button key={color} type="button" onClick={() => setPostBg(color)} className="w-8 h-8 rounded-full border border-white/30" style={{ backgroundColor: color }} data-testid={`button-post-bg-${color}`} />
                ))}
                <div className="ml-auto flex gap-2">
                  <Button variant="ghost" onClick={() => setShowPostComposer(false)} data-testid="button-cancel-post">{t("common.cancel")}</Button>
                  <Button disabled={!postText.trim() || createPostMutation.isPending} onClick={() => createPostMutation.mutate()} data-testid="button-submit-post">{t("home.publishPost")}</Button>
                </div>
              </div>
            </div>
          </div>
          </div>
        </div>
      )}

      <div className="w-full relative z-10 flex-1 min-h-0">
        {availableProfiles.slice(1, 5).filter(p => p.profileVideoUrl).map(p => (
          <video
            key={`preload-${p.id}`}
            src={p.profileVideoUrl ?? undefined}
            preload="auto"
            muted
            playsInline
            autoPlay
            className="absolute w-0 h-0 opacity-0 pointer-events-none"
            aria-hidden="true"
          />
        ))}
        {nextProfile && (
          <SwipeCard
            key={nextProfile.id}
            profile={nextProfile}
            onSwipe={() => {}}
            isTop={false}
            hasPrivateRoom={roomOwners?.[nextProfile.id] || false}
            alreadyLiked={likedIdsSet.has(nextProfile.id)}
            globalMuted={globalMuted}
            onMutedChange={setGlobalMuted}
          />
        )}
        {currentProfile && (
          <SwipeCard
            key={currentProfile.id}
            profile={currentProfile}
            onSwipe={handleSwipe}
            isTop={true}
            hasPrivateRoom={roomOwners?.[currentProfile.id] || false}
            alreadyLiked={likedIdsSet.has(currentProfile.id)}
            globalMuted={globalMuted}
            onMutedChange={setGlobalMuted}
            actionButtons={
              <ActionButtons
                onSwipeLeft={handleSwipeLeft}
                onSwipeRight={handleSwipeRight}
                onUndo={handleUndo}
                undoDisabled={swipeHistory.length === 0 || undoMutation.isPending}
                disabled={!currentProfile || swipeMutation.isPending}
                likeDisabled={currentProfile ? likedIdsSet.has(currentProfile.id) : false}
              />
            }
          />
        )}
        <div className="fixed right-4 top-1/2 -translate-y-1/2 z-30 flex flex-col gap-2">
          <button type="button" onClick={() => setShowPostComposer(true)} className="w-12 h-12 rounded-full bg-fuchsia-500/90 backdrop-blur-md flex items-center justify-center shadow-lg border border-white/20" data-testid="button-open-post-composer">
            <PenSquare className="w-6 h-6 text-white" />
          </button>
        </div>
      </div>

      {matchModalElement}
      {!isGuest && <ActivityToastSystem />}
      <GuestBlockerModal />
    </div>
  );
}

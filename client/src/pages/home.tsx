import { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Sparkles, X, MessageCircle } from "lucide-react";
import { SwipeCard, ActionButtons } from "@/components/SwipeCard";
import { MatchModal } from "@/components/MatchModal";
import { EmptyState, ProfileCardSkeleton } from "@/components/EmptyState";
import { ActivityToastSystem, VibrationActivity } from "@/components/ActivityFeed";
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
  const { user, logout: logoutFn } = useAuth();
  const { isGuest } = useGuest();
  const { blockIfGuest, GuestBlockerModal } = useGuestBlocker();
  const { toast } = useToast();
  const { t } = useLanguage();
  const [, setLocation] = useLocation();
  const [showVibrappBanner, setShowVibrappBanner] = useState(() => {
    return !localStorage.getItem("vibra-vibrapp-seen");
  });

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
    <div className="flex-1 flex flex-col items-center justify-center relative overflow-hidden" style={{ height: 'calc(100dvh - 64px)' }}>
      {bgLayer}

      <div className="w-full max-w-sm md:max-w-md lg:max-w-lg relative z-20 shrink-0 px-4">
        {!isGuest && showVibrappBanner && (
          <div className="mb-2 bg-gradient-to-r from-green-600/80 to-emerald-600/80 backdrop-blur-sm rounded-xl p-3 flex items-center gap-3 border border-green-400/30 shadow-lg" data-testid="vibrapp-banner">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center shrink-0">
              <MessageCircle className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-bold text-sm">{t("vibrapp.welcome")}</p>
              <p className="text-white/80 text-xs">{t("vibrapp.welcomeDesc")}</p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button
                size="sm"
                variant="ghost"
                className="text-white text-xs border border-white/30 px-2 h-7"
                onClick={() => setLocation("/vibrapp")}
                data-testid="button-vibrapp-go"
              >
                Go
              </Button>
              <button
                onClick={() => {
                  setShowVibrappBanner(false);
                  localStorage.setItem("vibra-vibrapp-seen", "1");
                }}
                className="text-white/50 hover:text-white p-1"
                data-testid="button-vibrapp-dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
        {!isGuest && <VibrationActivity />}
      </div>

      <div className="w-full max-w-[380px] md:max-w-md lg:max-w-lg relative z-10 flex-1 min-h-0 px-2 mx-auto">
        {nextProfile && (
          <SwipeCard
            key={nextProfile.id}
            profile={nextProfile}
            onSwipe={() => {}}
            isTop={false}
            hasPrivateRoom={roomOwners?.[nextProfile.id] || false}
            alreadyLiked={likedIdsSet.has(nextProfile.id)}
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
          />
        )}
      </div>

      <div className="relative z-10 shrink-0 pb-safe px-4">
        <ActionButtons
          onSwipeLeft={handleSwipeLeft}
          onSwipeRight={handleSwipeRight}
          disabled={!currentProfile || swipeMutation.isPending}
          likeDisabled={currentProfile ? likedIdsSet.has(currentProfile.id) : false}
        />
      </div>

      {matchModalElement}
      {!isGuest && <ActivityToastSystem />}
      <GuestBlockerModal />
    </div>
  );
}

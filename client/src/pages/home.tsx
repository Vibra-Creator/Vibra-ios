import { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Sparkles, UserPen, X, Trophy } from "lucide-react";
import { SwipeCard, ActionButtons } from "@/components/SwipeCard";
import { MatchModal } from "@/components/MatchModal";
import { EmptyState, ProfileCardSkeleton } from "@/components/EmptyState";
import { OnlineBanner, ActivityToastSystem, VibrationActivity } from "@/components/ActivityFeed";
import { Button } from "@/components/ui/button";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useGuest } from "@/hooks/use-guest";
import { useGuestBlocker } from "@/components/GuestBlocker";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/i18n/LanguageContext";
import { Link } from "wouter";
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

  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [challengeBannerDismissed, setChallengeBannerDismissed] = useState(() => {
    try { return sessionStorage.getItem("challengeBannerDismissed") === "true"; } catch { return false; }
  });
  const isProfileIncomplete = myProfile && !isGuest && (
    myProfile.imageUrl === "/images/avatar-1.png" || 
    !myProfile.bio || 
    !myProfile.location || 
    (myProfile.interests || []).length === 0
  );

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
    <div className="flex-1 flex flex-col items-center relative overflow-hidden" style={{ height: 'calc(100dvh - 64px)' }}>
      {bgLayer}

      <div className="w-full max-w-sm md:max-w-md lg:max-w-lg relative z-10 flex-1 min-h-0 px-4 pt-2 flex flex-col">
        <div className="relative flex-1 min-h-0">
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

          <div className="absolute top-0 left-0 right-0 z-30 pointer-events-none">
            <div className="flex flex-col items-center gap-1 pt-1 pointer-events-auto">
              {!isGuest && <OnlineBanner />}
              {isProfileIncomplete && !bannerDismissed && (
                <div className="w-full px-2">
                  <div className="flex items-center gap-1.5 rounded-lg bg-black/60 backdrop-blur-md px-2.5 py-1 border border-white/10">
                    <UserPen className="w-3 h-3 text-white shrink-0" />
                    <span className="text-white text-[10px] font-medium flex-1">{t("home.profileIncomplete")}</span>
                    <Link href="/profile/edit">
                      <Button size="sm" variant="secondary" className="h-5 text-[9px] px-1.5" data-testid="button-complete-profile">
                        {t("home.completeProfile")}
                      </Button>
                    </Link>
                    <button onClick={() => setBannerDismissed(true)} className="text-white/60 hover:text-white" data-testid="button-dismiss-banner">
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </div>
                </div>
              )}
              {!isGuest && !challengeBannerDismissed && (
                <div className="w-full px-2">
                  <div className="flex items-center gap-1.5 rounded-lg bg-amber-900/70 backdrop-blur-md px-2.5 py-1 border border-amber-400/20" data-testid="banner-challenge-promo">
                    <Trophy className="w-3 h-3 text-amber-300 shrink-0" />
                    <span className="text-amber-100 text-[10px] font-semibold flex-1 leading-tight">{t("home.challengePromo")}</span>
                    <Link href="/challenges">
                      <Button size="sm" className="h-5 text-[9px] px-1.5 bg-amber-500/30 hover:bg-amber-500/50 text-white border border-amber-400/30" data-testid="button-go-challenges">
                        {t("home.goToChallenge")}
                      </Button>
                    </Link>
                    <button 
                      onClick={() => { setChallengeBannerDismissed(true); try { sessionStorage.setItem("challengeBannerDismissed", "true"); } catch {} }}
                      className="text-white/60 hover:text-white" 
                      data-testid="button-dismiss-challenge-banner"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </div>
                </div>
              )}
              {!isGuest && <VibrationActivity />}
            </div>
          </div>
        </div>
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

import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { SwipeCard, ActionButtons } from "@/components/SwipeCard";
import { MatchModal } from "@/components/MatchModal";
import { EmptyState, ProfileCardSkeleton } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useGuest } from "@/hooks/use-guest";
import { useGuestBlocker } from "@/components/GuestBlocker";
import { useToast } from "@/hooks/use-toast";
import type { Profile, Match } from "@shared/schema";

export default function Home() {
  const [showMatch, setShowMatch] = useState(false);
  const [matchedProfile, setMatchedProfile] = useState<Profile | null>(null);
  const [currentMatchId, setCurrentMatchId] = useState<string | null>(null);
  const [swipedProfiles, setSwipedProfiles] = useState<Set<string>>(new Set());
  const { user, logout: logoutFn } = useAuth();
  const { isGuest } = useGuest();
  const { blockIfGuest, GuestBlockerModal } = useGuestBlocker();
  const { toast } = useToast();

  const { data: myProfile, isLoading: profileLoading } = useQuery<Profile | null>({
    queryKey: ["/api/profiles/me"],
    enabled: !!user && !isGuest,
  });

  const { data: guestProfiles, isLoading: guestLoading } = useQuery<Profile[]>({
    queryKey: ["/api/profiles"],
    enabled: isGuest,
  });

  const { data: profiles, isLoading, error, refetch } = useQuery<Profile[]>({
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
        title: "Errore",
        description: "Si è verificato un errore durante lo swipe. Riprova.",
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

  const handleSwipe = useCallback((direction: "left" | "right") => {
    if (!currentProfile) return;
    if (isGuest) {
      blockIfGuest(direction === "right" ? "mettere like" : "scartare un profilo");
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
  }, [currentProfile, swipeMutation, isGuest, blockIfGuest]);

  const resetDislikesMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", "/api/swipes/disliked");
    },
    onSuccess: () => {
      setSwipedProfiles(new Set());
      queryClient.invalidateQueries({ queryKey: ["/api/profiles/swipable", myProfile?.id] });
      refetch();
      toast({ title: "Profili ripristinati!", description: "I profili scartati sono di nuovo disponibili." });
    },
    onError: () => {
      toast({ title: "Errore", description: "Non è stato possibile ripristinare i profili.", variant: "destructive" });
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

  if (loadingState) {
    return (
      <div className="flex-1 flex items-center justify-center p-4 relative">
        {bgLayer}
        <div className="relative z-10 w-full max-w-sm">
          <ProfileCardSkeleton />
        </div>
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
            <h2 className="text-xl font-bold text-white mb-2">Benvenuto su Vibra!</h2>
            <p className="text-white/70 text-sm mb-6">
              Per iniziare a scoprire profili e fare match, devi prima creare il tuo profilo.
            </p>
            <Button
              className="w-full mb-3"
              onClick={() => window.location.href = "/profile/edit"}
              data-testid="button-create-profile"
            >
              Crea il Tuo Profilo
            </Button>
            <Button
              variant="ghost"
              className="w-full text-white/60"
              onClick={() => logoutFn()}
              data-testid="button-logout-home"
            >
              Torna al Login
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center p-4 relative">
        {bgLayer}
        <div className="relative z-10"><EmptyState type="error" onRetry={() => refetch()} /></div>
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
              setSwipedProfiles(new Set());
              refetch();
            }}
            onResetDislikes={() => resetDislikesMutation.mutate()}
            isResetting={resetDislikesMutation.isPending}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 relative">
      {bgLayer}
      <div className="w-full max-w-sm relative z-10 h-[500px] sm:h-[550px]">
        {nextProfile && (
          <SwipeCard
            key={nextProfile.id}
            profile={nextProfile}
            onSwipe={() => {}}
            isTop={false}
            hasPrivateRoom={roomOwners?.[nextProfile.id] || false}
          />
        )}
        {currentProfile && (
          <SwipeCard
            key={currentProfile.id}
            profile={currentProfile}
            onSwipe={handleSwipe}
            isTop={true}
            hasPrivateRoom={roomOwners?.[currentProfile.id] || false}
          />
        )}
      </div>

      <div className="relative z-10">
        <ActionButtons
          onSwipeLeft={handleSwipeLeft}
          onSwipeRight={handleSwipeRight}
          disabled={!currentProfile || swipeMutation.isPending}
        />
      </div>

      {!isGuest && (
        <MatchModal
          isOpen={showMatch}
          onClose={() => setShowMatch(false)}
          matchedProfile={matchedProfile}
          currentProfile={myProfile}
          matchId={currentMatchId}
        />
      )}

      <GuestBlockerModal />
    </div>
  );
}

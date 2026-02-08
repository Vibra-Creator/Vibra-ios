import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { SwipeCard, ActionButtons } from "@/components/SwipeCard";
import { MatchModal } from "@/components/MatchModal";
import { EmptyState, ProfileCardSkeleton } from "@/components/EmptyState";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import type { Profile, Match } from "@shared/schema";

export default function Home() {
  const [showMatch, setShowMatch] = useState(false);
  const [matchedProfile, setMatchedProfile] = useState<Profile | null>(null);
  const [currentMatchId, setCurrentMatchId] = useState<string | null>(null);
  const [swipedProfiles, setSwipedProfiles] = useState<Set<string>>(new Set());
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: myProfile, isLoading: profileLoading } = useQuery<Profile | null>({
    queryKey: ["/api/profiles/me"],
    enabled: !!user,
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
    enabled: !!myProfile,
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

  const availableProfiles = profiles?.filter(p => 
    !swipedProfiles.has(p.id)
  ) || [];
  const currentProfile = availableProfiles[0];
  const nextProfile = availableProfiles[1];

  const handleSwipe = useCallback((direction: "left" | "right") => {
    if (!currentProfile) return;
    
    setSwipedProfiles(prev => {
      const newSet = new Set(prev);
      newSet.add(currentProfile.id);
      return newSet;
    });
    swipeMutation.mutate({
      profileId: currentProfile.id,
      liked: direction === "right",
    });
  }, [currentProfile, swipeMutation]);

  const handleSwipeLeft = useCallback(() => handleSwipe("left"), [handleSwipe]);
  const handleSwipeRight = useCallback(() => handleSwipe("right"), [handleSwipe]);

  const bgLayer = (
    <div className="fixed inset-0 -z-10">
      <img src="/backgrounds/vibra-dance.png" alt="" className="w-full h-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/20 to-black/40" />
    </div>
  );

  if (profileLoading || isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        {bgLayer}
        <div className="w-full max-w-sm">
          <ProfileCardSkeleton />
        </div>
      </div>
    );
  }

  if (!myProfile) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        {bgLayer}
        <EmptyState type="no-profiles" onRetry={() => window.location.href = "/profile/edit"} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        {bgLayer}
        <EmptyState type="error" onRetry={() => refetch()} />
      </div>
    );
  }

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

  if (!availableProfiles.length) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        {bgLayer}
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
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4">
      {bgLayer}
      <div className="w-full max-w-sm relative h-[500px] sm:h-[550px]">
        {nextProfile && (
          <SwipeCard
            key={nextProfile.id}
            profile={nextProfile}
            onSwipe={() => {}}
            isTop={false}
          />
        )}
        {currentProfile && (
          <SwipeCard
            key={currentProfile.id}
            profile={currentProfile}
            onSwipe={handleSwipe}
            isTop={true}
          />
        )}
      </div>

      <ActionButtons
        onSwipeLeft={handleSwipeLeft}
        onSwipeRight={handleSwipeRight}
        disabled={!currentProfile || swipeMutation.isPending}
      />

      <MatchModal
        isOpen={showMatch}
        onClose={() => setShowMatch(false)}
        matchedProfile={matchedProfile}
        currentProfile={myProfile}
        matchId={currentMatchId}
      />
    </div>
  );
}

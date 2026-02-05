import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { SwipeCard, ActionButtons } from "@/components/SwipeCard";
import { MatchModal } from "@/components/MatchModal";
import { EmptyState, ProfileCardSkeleton } from "@/components/EmptyState";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Profile, Match } from "@shared/schema";

const CURRENT_USER_ID = "user-1";

export default function Home() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showMatch, setShowMatch] = useState(false);
  const [matchedProfile, setMatchedProfile] = useState<Profile | null>(null);
  const [swipedProfiles, setSwipedProfiles] = useState<Set<string>>(new Set());

  const { data: profiles, isLoading, error, refetch } = useQuery<Profile[]>({
    queryKey: ["/api/profiles"],
  });

  const swipeMutation = useMutation({
    mutationFn: async ({ profileId, liked }: { profileId: string; liked: boolean }) => {
      const response = await apiRequest("POST", "/api/swipe", {
        swiperId: CURRENT_USER_ID,
        swipedId: profileId,
        liked,
      });
      return response as { match: boolean; matchData?: Match };
    },
    onSuccess: (data, variables) => {
      if (data.match) {
        const matchProfile = profiles?.find(p => p.id === variables.profileId);
        if (matchProfile) {
          setMatchedProfile(matchProfile);
          setShowMatch(true);
        }
        queryClient.invalidateQueries({ queryKey: ["/api/matches", CURRENT_USER_ID] });
      }
    },
  });

  const availableProfiles = profiles?.filter(p => !swipedProfiles.has(p.id)) || [];
  const currentProfile = availableProfiles[0];
  const nextProfile = availableProfiles[1];

  const handleSwipe = useCallback((direction: "left" | "right") => {
    if (!currentProfile) return;
    
    setSwipedProfiles(prev => new Set([...prev, currentProfile.id]));
    swipeMutation.mutate({
      profileId: currentProfile.id,
      liked: direction === "right",
    });
  }, [currentProfile, swipeMutation]);

  const handleSwipeLeft = useCallback(() => handleSwipe("left"), [handleSwipe]);
  const handleSwipeRight = useCallback(() => handleSwipe("right"), [handleSwipe]);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <ProfileCardSkeleton />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <EmptyState type="error" onRetry={() => refetch()} />
      </div>
    );
  }

  if (!availableProfiles.length) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <EmptyState 
          type="no-profiles" 
          onRetry={() => {
            setSwipedProfiles(new Set());
            refetch();
          }} 
        />
      </div>
    );
  }

  const userProfile = profiles?.find(p => p.id === "1");

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4">
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
        currentProfile={userProfile}
      />
    </div>
  );
}

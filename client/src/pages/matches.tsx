import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Heart } from "lucide-react";
import { MatchCard, MatchCardSkeleton } from "@/components/MatchCard";
import { EmptyState } from "@/components/EmptyState";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import type { Profile, Match } from "@shared/schema";

interface MatchWithProfile extends Match {
  profile: Profile;
}

export default function Matches() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();

  const { data: myProfile } = useQuery<Profile | null>({
    queryKey: ["/api/profiles/me"],
    enabled: !!user,
  });

  const { data: matches, isLoading, error, refetch } = useQuery<MatchWithProfile[]>({
    queryKey: ["/api/matches", myProfile?.id],
    enabled: !!myProfile,
  });

  return (
    <div className="flex-1 p-4">
      <div className="fixed inset-0 -z-[5]">
        <img src="/backgrounds/vibra-runners.jpg" alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/20 to-black/40" />
      </div>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent to-primary flex items-center justify-center"
               style={{ boxShadow: "var(--glow-accent)" }}>
            <Heart className="w-5 h-5 text-white fill-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">I Tuoi Match</h1>
            <p className="text-sm text-white/60">
              {matches?.length || 0} connessioni cosmiche
            </p>
          </div>
        </div>
      </motion.div>

      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <MatchCardSkeleton key={i} />
          ))}
        </div>
      ) : error ? (
        <EmptyState type="error" onRetry={() => refetch()} />
      ) : !matches?.length ? (
        <EmptyState 
          type="no-matches" 
          onRetry={() => setLocation("/")} 
        />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {matches.map((match, index) => (
            <MatchCard
              key={match.id}
              profile={match.profile}
              matchId={match.id}
              matchDate={match.createdAt}
              index={index}
            />
          ))}
        </div>
      )}
    </div>
  );
}

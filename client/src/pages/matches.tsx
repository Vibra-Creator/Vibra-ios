import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Heart, ArrowLeft, UserPlus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MatchCard, MatchCardSkeleton } from "@/components/MatchCard";
import { EmptyState } from "@/components/EmptyState";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useGuest } from "@/hooks/use-guest";
import { useGuestBlocker } from "@/components/GuestBlocker";
import { useLanguage } from "@/i18n/LanguageContext";
import { Link } from "wouter";
import type { Profile, Match } from "@shared/schema";

interface MatchWithProfile extends Match {
  profile: Profile;
}

export default function Matches() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { isGuest } = useGuest();
  const { blockIfGuest, GuestBlockerModal } = useGuestBlocker();
  const { t } = useLanguage();

  const { data: myProfile } = useQuery<Profile | null>({
    queryKey: ["/api/profiles/me"],
    enabled: !!user && !isGuest,
  });

  const { data: matches, isLoading, error, refetch } = useQuery<MatchWithProfile[]>({
    queryKey: ["/api/matches", myProfile?.id],
    enabled: !!myProfile && !isGuest,
    refetchInterval: 10000,
  });

  return (
    <div className="relative flex-1 min-h-0 h-full overflow-y-auto">
      <div className="fixed inset-0 z-0">
        <img src="/backgrounds/vibra-runners.jpg" alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/20 to-black/40" />
      </div>
      <div className="relative z-10 p-4 pb-24">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <div className="flex items-center gap-3 mb-2">
          <Button variant="ghost" size="icon" className="text-white bg-black/30 backdrop-blur-sm" onClick={() => setLocation("/")} data-testid="button-back">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent to-primary flex items-center justify-center"
               style={{ boxShadow: "var(--glow-accent)" }}>
            <Heart className="w-5 h-5 text-white fill-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">{t("matches.title")}</h1>
            <p className="text-sm text-white/60">
              {isGuest ? t("matches.registerPrompt") : `${matches?.length || 0} ${t("matches.cosmicConnections")}`}
            </p>
          </div>
        </div>
      </motion.div>

      {isGuest ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl backdrop-blur-md bg-white/10 border border-white/20 p-6 text-center"
          data-testid="card-guest-matches-info"
        >
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-accent/30 to-primary/30 flex items-center justify-center">
            <Sparkles className="w-8 h-8 text-accent" />
          </div>
          <h3 className="text-lg font-bold text-white mb-2">{t("matches.guestTitle")}</h3>
          <p className="text-white/60 text-sm mb-6">
            {t("matches.guestDesc")}
          </p>
          <Link href="/register">
            <Button className="w-full bg-gradient-to-r from-primary to-accent" data-testid="button-guest-register-matches">
              <UserPlus className="w-4 h-4 mr-2" />
              {t("matches.guestCta")}
            </Button>
          </Link>
        </motion.div>
      ) : isLoading ? (
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
      <GuestBlockerModal />
    </div>
  );
}

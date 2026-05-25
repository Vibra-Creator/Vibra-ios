import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Heart, ArrowLeft, UserPlus, Sparkles, MapPin, ThumbsUp, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MatchCard, MatchCardSkeleton } from "@/components/MatchCard";
import { ProfileDetailModal } from "@/components/SwipeCard";
import { EmptyState } from "@/components/EmptyState";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useGuest } from "@/hooks/use-guest";
import { useGuestBlocker } from "@/components/GuestBlocker";
import { useLanguage } from "@/i18n/LanguageContext";
import { Link } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Profile, Match } from "@shared/schema";

interface MatchWithProfile extends Match {
  profile: Profile;
}

function LikerCard({ profile, index, onViewProfile }: { profile: Profile; index: number; onViewProfile: (p: Profile) => void }) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const swipeMutation = useMutation({
    mutationFn: async (liked: boolean) => {
      return await apiRequest("POST", "/api/swipe", { swipedId: profile.id, liked });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/likes/received"] });
      queryClient.invalidateQueries({ predicate: q => {
        const k = q.queryKey[0];
        return typeof k === "string" && k.startsWith("/api/matches");
      }});
      if (data?.match) {
        toast({ title: "È un Match! 🎉", description: `Hai fatto match con ${profile.name}!` });
      }
    },
    onError: () => {
      toast({ title: "Errore", description: "Impossibile effettuare l'azione", variant: "destructive" });
    },
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08 }}
      className="relative rounded-2xl overflow-hidden bg-card border border-card-border shadow-lg"
      data-testid={`liker-card-${profile.id}`}
    >
      <div className="relative aspect-square overflow-hidden cursor-pointer" onClick={() => onViewProfile(profile)}>
        <img
          src={profile.imageUrl}
          alt={profile.name}
          className="w-full h-full object-cover object-top"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
        <div className="absolute top-3 left-3">
            <Badge variant="secondary" className="bg-pink-500/80 text-white backdrop-blur-sm text-xs">
            <Heart className="w-3 h-3 mr-1 fill-white" /> Sente la tua Vibe
          </Badge>
        </div>
        <div className="absolute bottom-3 left-3 right-3">
          <h3 className="text-base font-bold text-white">{profile.name}{profile.age ? `, ${profile.age}` : ""}</h3>
          {profile.location && (
            <div className="flex items-center gap-1 text-white/70">
              <MapPin className="w-3 h-3" />
              <span className="text-xs">{profile.location}</span>
            </div>
          )}
        </div>
      </div>
      <div className="p-2 flex gap-2">
          <Button
          variant="outline"
          size="sm"
          className="flex-1 border-red-400/40 text-red-400 hover:bg-red-500/10"
          disabled={swipeMutation.isPending}
          onClick={() => swipeMutation.mutate(false)}
          data-testid={`button-dislike-liker-${profile.id}`}
        >
          No
        </Button>
          <Button
          size="sm"
          className="flex-1 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white border-0"
          disabled={swipeMutation.isPending}
          onClick={() => swipeMutation.mutate(true)}
          data-testid={`button-like-liker-${profile.id}`}
        >
          <Heart className="w-3 h-3 mr-1 fill-white" /> Vibe
        </Button>
      </div>
    </motion.div>
  );
}

export default function Matches() {
  useEffect(() => {
    document.title = "Vibra - I tuoi match";
    const setMeta = (name: string, content: string, isProperty = false) => {
      const selector = isProperty ? `meta[property="${name}"]` : `meta[name="${name}"]`;
      let el = document.querySelector(selector) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(isProperty ? "property" : "name", name);
        document.head.appendChild(el);
      }
      el.setAttribute("content", content);
    };
    const desc = "Rivedi i tuoi match, chi ti ha messo like e continua le conversazioni su Vibra.";
    setMeta("description", desc);
    setMeta("og:title", "Vibra - I tuoi match", true);
    setMeta("og:description", desc, true);
    setMeta("og:type", "website", true);
    setMeta("twitter:card", "summary_large_image");
    setMeta("twitter:title", "Vibra - I tuoi match");
    setMeta("twitter:description", desc);
  }, []);

  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { isGuest } = useGuest();
  const { blockIfGuest, GuestBlockerModal } = useGuestBlocker();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<"matches" | "likers">("likers");
  const [selectedLiker, setSelectedLiker] = useState<Profile | null>(null);

  const { data: myProfile } = useQuery<Profile | null>({
    queryKey: ["/api/profiles/me"],
    enabled: !!user && !isGuest,
  });

  const { data: matches, isLoading: matchesLoading, error: matchesError, refetch: refetchMatches } = useQuery<MatchWithProfile[]>({
    queryKey: ["/api/matches", myProfile?.id],
    enabled: !!myProfile && !isGuest,
    refetchInterval: 10000,
  });

  const { data: likers, isLoading: likersLoading } = useQuery<Profile[]>({
    queryKey: ["/api/likes/received"],
    enabled: !!myProfile && !isGuest,
    refetchInterval: 30000,
  });

  interface ReceivedSignal { id: string; content: string | null; mediaUrl: string | null; mediaType: string | null; createdAt: string; fromProfile: { id: string; name: string; age: number; imageUrl: string }; }
  const { data: receivedSignals = [] } = useQuery<ReceivedSignal[]>({
    queryKey: ["/api/signals/received"],
    enabled: !!myProfile && !isGuest,
    refetchInterval: 30000,
  });

  const likersCount = (likers?.length ?? 0) + receivedSignals.length;

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
          className="mb-5"
        >
          <div className="flex items-center gap-3 mb-4">
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

          {!isGuest && (
            <div className="flex gap-2 bg-black/30 backdrop-blur-sm rounded-xl p-1">
              <button
                onClick={() => setActiveTab("likers")}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                  activeTab === "likers"
                    ? "bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow"
                    : "text-white/60 hover:text-white"
                }`}
                data-testid="tab-likers"
              >
                <Heart className="w-4 h-4" />
                Vibe & Signal
                {likersCount > 0 && (
                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${activeTab === "likers" ? "bg-white/20" : "bg-pink-500 text-white"}`}>
                    {likersCount}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab("matches")}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                  activeTab === "matches"
                    ? "bg-gradient-to-r from-accent to-primary text-white shadow"
                    : "text-white/60 hover:text-white"
                }`}
                data-testid="tab-matches"
              >
                <Sparkles className="w-4 h-4" />
                Radar Hit
                {(matches?.length ?? 0) > 0 && (
                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${activeTab === "matches" ? "bg-white/20" : "bg-accent text-white"}`}>
                    {matches?.length}
                  </span>
                )}
              </button>
            </div>
          )}
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
        ) : activeTab === "likers" ? (
          likersLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-2xl overflow-hidden bg-card border border-card-border shadow-lg animate-pulse">
                  <div className="aspect-square bg-muted" />
                  <div className="p-3 h-10 bg-muted" />
                </div>
              ))}
            </div>
          ) : !likers?.length && !receivedSignals.length ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl backdrop-blur-md bg-white/10 border border-white/20 p-8 text-center"
              data-testid="card-no-likers"
            >
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-pink-500/30 to-rose-500/30 flex items-center justify-center">
                <Heart className="w-8 h-8 text-pink-400" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Nessuna vibe o segnale ancora</h3>
              <p className="text-white/60 text-sm">
                Quando qualcuno mette vibe o ti invia un Signal, lo vedrai qui. Continua a esplorare!
              </p>
              <Button className="mt-4 bg-gradient-to-r from-pink-500 to-rose-500" onClick={() => setLocation("/")}>
                Esplora profili
              </Button>
            </motion.div>
          ) : (
            <div className="space-y-4" data-testid="grid-likers">
              {receivedSignals.length > 0 && (
                <div>
                  <p className="text-fuchsia-400 text-xs font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Radio className="w-3.5 h-3.5" /> Cosmic Signal ricevuti
                  </p>
                  <div className="space-y-2">
                    {receivedSignals.map(sig => (
                      <motion.div
                        key={sig.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-start gap-3 bg-fuchsia-500/10 border border-fuchsia-500/25 rounded-2xl p-3"
                        data-testid={`signal-card-${sig.id}`}
                      >
                        <button onClick={() => setSelectedLiker(sig.fromProfile as any)} className="shrink-0">
                          <img src={sig.fromProfile.imageUrl} alt={sig.fromProfile.name} className="w-12 h-12 rounded-full object-cover border-2 border-fuchsia-500/50" loading="lazy" />
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <p className="text-white font-semibold text-sm">{sig.fromProfile.name}, {sig.fromProfile.age}</p>
                            <Radio className="w-3 h-3 text-fuchsia-400 shrink-0" />
                          </div>
                          {sig.content && <p className="text-white/75 text-xs leading-relaxed line-clamp-2">"{sig.content}"</p>}
                          {sig.mediaUrl && sig.mediaType === "image" && (
                            <img src={sig.mediaUrl} alt="signal" className="mt-1.5 w-full rounded-lg object-cover max-h-32" loading="lazy" />
                          )}
                          {sig.mediaUrl && sig.mediaType === "audio" && (
                            <audio src={sig.mediaUrl} controls className="mt-1.5 w-full h-8" />
                          )}
                          <p className="text-fuchsia-400/50 text-[10px] mt-1">
                            {(() => { const diff = Date.now() - new Date(sig.createdAt).getTime(); const m = Math.floor(diff/60000); if(m<60) return `${m}m fa`; const h = Math.floor(m/60); if(h<24) return `${h}h fa`; return `${Math.floor(h/24)}g fa`; })()}
                          </p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}
              {likers && likers.length > 0 && (
                <div>
                  {receivedSignals.length > 0 && <p className="text-pink-400 text-xs font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5"><Heart className="w-3.5 h-3.5 fill-pink-400" /> Vibe ricevute</p>}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {likers.map((profile, index) => (
                      <LikerCard key={profile.id} profile={profile} index={index} onViewProfile={setSelectedLiker} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        ) : matchesLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <MatchCardSkeleton key={i} />
            ))}
          </div>
        ) : matchesError ? (
          <EmptyState type="error" onRetry={() => refetchMatches()} />
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
      {selectedLiker && (
        <ProfileDetailModal
          profile={selectedLiker}
          isOpen={!!selectedLiker}
          onClose={() => setSelectedLiker(null)}
        />
      )}
    </div>
  );
}

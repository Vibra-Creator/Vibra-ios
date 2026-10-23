import { useState, useCallback, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Sparkles, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { SwipeCard, ActionButtons } from "@/components/SwipeCard";
import { MatchModal } from "@/components/MatchModal";
import { EmptyState, ProfileCardSkeleton } from "@/components/EmptyState";
import { ActivityToastSystem } from "@/components/ActivityFeed";
import { ProfileVideosSection } from "@/components/ProfileVideosSection";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  useEffect(() => {
    document.title = "Vibra - Swipe e Match Cosmici";
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
    const desc = "Scorri profili alieni, fai match e chatta su Vibra, la dating app cosmica in italiano.";
    setMeta("description", desc);
    setMeta("og:title", "Vibra - Swipe e Match Cosmici", true);
    setMeta("og:description", desc, true);
    setMeta("og:type", "website", true);
    setMeta("twitter:card", "summary_large_image");
    setMeta("twitter:title", "Vibra - Swipe e Match Cosmici");
    setMeta("twitter:description", desc);
  }, []);

  const [showMatch, setShowMatch] = useState(false);
  const [matchedProfile, setMatchedProfile] = useState<Profile | null>(null);
  const [currentMatchId, setCurrentMatchId] = useState<string | null>(null);
  const [swipedProfiles, setSwipedProfiles] = useState<Set<string>>(new Set());
  const [swipeHistory, setSwipeHistory] = useState<string[]>([]);
  const [forcedFirstProfileId, setForcedFirstProfileId] = useState<string | null>(null);
  const [globalMuted, setGlobalMuted] = useState(false);
  const [showVideoDrawer, setShowVideoDrawer] = useState(false);
  const [showDatingLocked, setShowDatingLocked] = useState(false);
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
    staleTime: 0,
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

  const pendingSwipeRef = useRef<{ profileId: string; liked: boolean } | null>(null);
  const swipeMutateRef = useRef<((p: { profileId: string; liked: boolean }) => void) | null>(null);
  // Ref che tiene sempre l'ID dell'ultimo profilo swipato (indipendente dalle API, senza stale closure)
  const lastSwipedIdRef = useRef<string | null>(null);

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
      // NON invalidare swipable qui: la lista è ordinata casualmente sul server,
      // quindi un refetch rimescola l'ordine → sembra che si saltino profili
      // e i video non hanno tempo di partire (la card si smonta e rimonta).
      // Lo stato locale `swipedProfiles` già rimuove la card dall'UI.
    },
    onError: (error: Error) => {
      console.error("[Swipe error]", error.message);
      // Silenzia errori 400 (duplicati, validazione) — non mostrare banner rosso
      if (error.message.startsWith("400") || error.message.includes("Already swiped")) {
        return;
      }
      // NON invalidare swipable: l'ordine sul server è ora deterministico,
      // ma il refetch sposta le card montate e interrompe i video.
      // Lo swipe è già stato registrato localmente tramite `swipedProfiles`.
      toast({
        title: t("common.error"),
        description: t("home.swipeError"),
        variant: "destructive",
      });
    },
    onSettled: () => {
      // Drain the queue: if a swipe arrived while this mutation was in flight, execute it now
      const queued = pendingSwipeRef.current;
      pendingSwipeRef.current = null;
      if (queued) swipeMutateRef.current?.(queued);
    },
  });

  swipeMutateRef.current = swipeMutation.mutate;

  // Sola visione: iscritto all'hub ma non (ancora) a Vibra Dating.
  const isDatingLocked = !isGuest && !!myProfile && !myProfile.datingEnabled;
  const openDatingLocked = useCallback(() => setShowDatingLocked(true), []);
  const goToDatingProfile = useCallback(() => {
    setShowDatingLocked(false);
    setLocation("/profile/edit?dating=1");
  }, [setLocation]);

  const allProfilesRaw = isGuest
    ? (guestProfiles || []).filter(p => p.datingEnabled !== false)
    : (profiles || []);
  // Profili già piaciuti in fondo — li vedi dopo aver esplorato tutti i nuovi
  const allProfiles = allProfilesRaw
    ? [...allProfilesRaw.filter(p => !likedIdsSet.has(p.id)), ...allProfilesRaw.filter(p => likedIdsSet.has(p.id))]
    : [];
  const baseAvailableProfiles = allProfiles.filter(p => !swipedProfiles.has(p.id));
  // Dopo un undo, il profilo annullato viene messo in prima posizione
  const availableProfiles = forcedFirstProfileId
    ? [
        ...baseAvailableProfiles.filter(p => p.id === forcedFirstProfileId),
        ...baseAvailableProfiles.filter(p => p.id !== forcedFirstProfileId),
      ]
    : baseAvailableProfiles;
  const currentProfile = availableProfiles[0];

  const nextProfile = availableProfiles[1];

  // Keep the Image objects in a ref so the browser never GC's them before the
  // HTTP cache is populated — without this the browser may evict them mid-load
  // and the next card still shows a blank/spinner when it mounts.
  const imagePreloadCacheRef = useRef<HTMLImageElement[]>([]);

  useEffect(() => {
    const imgs: HTMLImageElement[] = [];
    // Preload current card + next 11: matches the same depth as video preloading
    availableProfiles.slice(0, 12).forEach(p => {
      const urls = [p.imageUrl, ...(p.photos || [])].filter(Boolean) as string[];
      urls.forEach((url) => {
        // Also preload .webp variant if available (next-gen image format)
        const webpUrl = url.replace(/\.(png|jpg|jpeg)$/i, '.webp');
        const img = new window.Image();
        img.src = url;
        imgs.push(img);
        if (webpUrl !== url) {
          const webpImg = new window.Image();
          webpImg.src = webpUrl;
          imgs.push(webpImg);
        }
      });
    });
    imagePreloadCacheRef.current = imgs;
    return () => { imagePreloadCacheRef.current = []; };
  }, [availableProfiles.map(p => p.id).slice(0, 12).join(",")]);

  // Preload video: fetch() aggressivo per pre-scaldare la HTTP cache del browser.
  // I <link rel="preload"> vengono ignorati su mobile per le range request.
  // fetch() forza il browser a scaricare i primi 3MB di ogni video imminente
  // → quando la SwipeCard monta, il video parte già dal buffer.
  useEffect(() => {
    const controllers: AbortController[] = [];
    const seen = new Set<string>();

    availableProfiles.slice(1, 16).forEach(p => {
      if (!p.profileVideoUrl) return;
      const isOwnServer = p.profileVideoUrl.startsWith("/objects/");
      const isExternal = p.profileVideoUrl.startsWith("https://") || p.profileVideoUrl.startsWith("http://");
      const url = isOwnServer
        ? `/api/video-stream-object?path=${encodeURIComponent(p.profileVideoUrl)}`
        : isExternal
        ? `/api/video-proxy?url=${encodeURIComponent(p.profileVideoUrl)}`
        : p.profileVideoUrl;
      if (seen.has(url)) return;
      seen.add(url);

      const controller = new AbortController();
      controllers.push(controller);
      // Scarica i primi 5MB in background — finisce nella HTTP cache.
      // Il video element farà la stessa range request → risposta già in cache → play immediato.
      fetch(url, {
        headers: { Range: "bytes=0-5242879" },
        credentials: "include",
        signal: controller.signal,
      }).then(r => r.blob()).catch(() => {});
    });

    return () => {
      controllers.forEach(c => c.abort());
    };
  }, [availableProfiles.map(p => p.id).slice(0, 16).join(",")]);

  // Preload immagini: fetch() per popolare HTTP cache — come i video, ma per foto.
  // Le immagini senza fetch() possono impiegare troppo ad apparire dopo lo swipe.
  useEffect(() => {
    const controllers: AbortController[] = [];
    const seen = new Set<string>();

    availableProfiles.slice(0, 6).forEach(p => {
      const urls = [p.imageUrl, ...(p.photos || [])].filter(Boolean) as string[];
      urls.forEach((url) => {
        if (seen.has(url)) return;
        seen.add(url);
        const controller = new AbortController();
        controllers.push(controller);
        fetch(url, { credentials: "include", signal: controller.signal })
          .then(r => r.blob())
          .catch(() => {});
      });
    });

    return () => { controllers.forEach(c => c.abort()); };
  }, [availableProfiles.map(p => p.id + (p.imageUrl || "")).slice(0, 6).join(",")]);

  const handleSwipe = useCallback((direction: "left" | "right") => {
    if (!currentProfile) return;
    if (isGuest) {
      blockIfGuest(direction === "right" ? t("home.like") : t("home.dislike"));
      return;
    }
    if (!myProfile?.id) return;

    if (isDatingLocked) {
      if (direction === "right") {
        openDatingLocked();
        return;
      }
      // Scartare in sola visione passa solo alla card successiva, senza salvare nulla.
      setSwipedProfiles(prev => new Set(prev).add(currentProfile.id));
      return;
    }

    // Ogni nuovo swipe cancella il "forza primo" dell'undo precedente
    setForcedFirstProfileId(null);

    // Rimuovi sempre la card dall'UI subito — evita card bloccata a metà schermo
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
    // Salva sempre l'ultimo swipato nel ref — usato dall'undo per mostrare il profilo corretto
    lastSwipedIdRef.current = currentProfile.id;

    const payload = { profileId: currentProfile.id, liked: direction === "right" };

    if (swipeMutation.isPending) {
      // Salva in coda — eseguito nell'onSettled della mutazione in corso
      pendingSwipeRef.current = payload;
      return;
    }

    swipeMutation.mutate(payload);
  }, [currentProfile, swipeMutation, isGuest, blockIfGuest, likedIdsSet, myProfile?.id, isDatingLocked, openDatingLocked]);

  const undoMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", "/api/swipes/last"),
    onSuccess: () => {
      // Usa il ref locale (aggiornato al momento dello swipe) — non la risposta del server
      // che può restituire un ID sbagliato se c'è una race condition con la swipe API
      const targetId = lastSwipedIdRef.current;
      if (targetId) {
        // 1. Rimuovi dal set degli swipati (sessione corrente)
        setSwipedProfiles(prev => {
          const newSet = new Set(prev);
          newSet.delete(targetId);
          return newSet;
        });
        setSwipeHistory(prev => prev.filter(id => id !== targetId));
        // 2. Forza il profilo in prima posizione
        setForcedFirstProfileId(targetId);
        // 3. Reset ref — prossimo undo richiede un altro swipe
        lastSwipedIdRef.current = null;
      }
      queryClient.invalidateQueries({ queryKey: ["/api/profiles/swipable", myProfile?.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/matches", myProfile?.id] });
      toast({ title: "↩️ Sei tornato indietro!", description: "Rivedrai il profilo precedente" });
    },
    onError: (err: any) => {
      const msg = err?.message || "";
      if (msg.includes("404") || msg.includes("Nessuno")) {
        toast({ title: "Nessuno swipe da annullare", description: "Swipa un profilo prima di tornare indietro", variant: "destructive" });
      } else {
        toast({ title: t("common.error"), description: "Impossibile annullare lo swipe", variant: "destructive" });
      }
    },
  });

  const handleUndo = useCallback(() => {
    undoMutation.mutate();
  }, [undoMutation]);

  const resetDislikesMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", "/api/swipes/disliked");
    },
    onSuccess: () => {
      setSwipedProfiles(new Set());
      // NON invalidare swipable: il refetch smonta le card e i video si resettano.
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
    <div className="flex-1 flex flex-col relative overflow-hidden">
      {bgLayer}

      {/* ── Drawer video: stesso sistema della sezione Video nel Profilo ── */}
      <AnimatePresence>
        {showVideoDrawer && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 flex items-end justify-center"
            onClick={() => setShowVideoDrawer(false)}
            data-testid="video-drawer-overlay"
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="w-full max-w-lg bg-[#0a0a1a] rounded-t-3xl border-t border-white/10 max-h-[85vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}
              data-testid="video-drawer-panel"
            >
              <div className="flex items-center justify-between px-5 pt-4 pb-2 sticky top-0 bg-[#0a0a1a] z-10 border-b border-white/5">
                <h2 className="text-white font-bold text-lg">I tuoi video</h2>
                <button
                  onClick={() => setShowVideoDrawer(false)}
                  className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center"
                  data-testid="button-close-video-drawer"
                >
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>
              <div className="p-4">
                {myProfile ? (
                  <ProfileVideosSection
                    profileId={myProfile.id}
                    currentMainVideoUrl={myProfile.profileVideoUrl}
                    onMainVideoChanged={() => setShowVideoDrawer(false)}
                  />
                ) : (
                  <p className="text-white/50 text-sm text-center py-8">Crea prima il tuo profilo.</p>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Motto cosmico in cima */}
      <div className="relative z-10 flex items-center justify-center px-4 pt-3 pb-2">
        <p
          className="text-center text-xl md:text-2xl font-semibold tracking-wide"
          style={{
            background: "linear-gradient(90deg, #c084fc, #67e8f9, #f472b6, #c084fc)",
            backgroundSize: "200% auto",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            textShadow: "none",
            animation: "motto-shimmer 4s linear infinite",
          }}
        >
          &ldquo;Qui puoi dire ciò che altrove nascondi.&rdquo;
        </p>
        <style>{`
          @keyframes motto-shimmer {
            0% { background-position: 0% center; }
            100% { background-position: 200% center; }
          }
        `}</style>
      </div>

      {isDatingLocked && (
        <div className="relative z-20 mx-3 mb-2 rounded-xl px-3 py-2 flex items-center justify-between gap-2 bg-gradient-to-r from-primary/90 to-pink-500/90 backdrop-blur-sm" data-testid="dating-view-only-banner">
          <span className="text-xs text-white font-medium">{t("dating.viewOnlyBanner")}</span>
          <Button size="sm" variant="outline" className="text-xs text-white border-white/50 shrink-0" onClick={goToDatingProfile} data-testid="button-activate-dating">
            {t("dating.activateBtn")}
          </Button>
        </div>
      )}

      <div className="w-full relative z-10 flex-1 min-h-0">
        {availableProfiles.slice(1, 9).filter(p => p.profileVideoUrl).map(p => {
          const _url = p.profileVideoUrl ?? "";
          const resolvedSrc = _url.startsWith("/objects/")
            ? `/api/video-stream-object?path=${encodeURIComponent(_url)}`
            : (_url.startsWith("https://") || _url.startsWith("http://"))
            ? `/api/video-proxy?url=${encodeURIComponent(_url)}`
            : _url || undefined;
          return (
            <video
              key={`preload-${p.id}`}
              src={resolvedSrc}
              preload="auto"
              autoPlay
              muted
              playsInline
              loop
              aria-hidden="true"
              style={{
                position: "fixed",
                left: "-9999px",
                top: "-9999px",
                width: "1px",
                height: "1px",
                opacity: 0,
                pointerEvents: "none",
              }}
            />
          );
        })}
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
            onOpenPostComposer={isDatingLocked ? undefined : () => setShowVideoDrawer(true)}
            onUndo={isDatingLocked ? undefined : handleUndo}
            undoDisabled={undoMutation.isPending}
            onLockedAction={isDatingLocked ? openDatingLocked : undefined}
          />
        )}
      </div>

      {matchModalElement}
      {!isGuest && <ActivityToastSystem />}
      <GuestBlockerModal />
      <Dialog open={showDatingLocked} onOpenChange={setShowDatingLocked}>
        <DialogContent className="max-w-sm" data-testid="dialog-dating-locked">
          <DialogHeader>
            <DialogTitle>{t("dating.lockedTitle")}</DialogTitle>
            <DialogDescription>{t("dating.lockedDesc")}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 mt-2">
            <Button onClick={goToDatingProfile} data-testid="button-dating-locked-activate">{t("dating.activateBtn")}</Button>
            <Button variant="ghost" onClick={() => setShowDatingLocked(false)} data-testid="button-dating-locked-later">{t("dating.lockedLater")}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, MapPin, Clock, Radio, X, Heart, ChevronRight, Loader2, AlertCircle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { useAuth } from "@/hooks/use-auth";
import { useGuest } from "@/hooks/use-guest";
import { useGuestBlocker } from "@/components/GuestBlocker";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Profile, VibingSession } from "@shared/schema";

type VibeStatus = {
  active: boolean;
  session?: VibingSession;
  remainingMs?: number;
};

type NearbyVber = VibingSession & { profile: Profile };

export default function Vibing() {
  const { user } = useAuth();
  const { isGuest } = useGuest();
  const { blockIfGuest, GuestBlockerModal } = useGuestBlocker();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [radiusKm, setRadiusKm] = useState(5);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [countdown, setCountdown] = useState<string>("30:00");

  const { data: myProfile } = useQuery<Profile | null>({
    queryKey: ["/api/profiles/me"],
    enabled: !!user && !isGuest,
  });

  const { data: vibeStatus, isLoading: statusLoading } = useQuery<VibeStatus>({
    queryKey: ["/api/vibe/status"],
    enabled: !!user && !isGuest,
    refetchInterval: 10000,
  });

  const { data: nearbyVibers = [], isLoading: nearbyLoading } = useQuery<NearbyVber[]>({
    queryKey: ["/api/vibe/nearby"],
    enabled: !!vibeStatus?.active,
    refetchInterval: 8000,
  });

  const isActiveStatus = vibeStatus?.active === true;

  useEffect(() => {
    if (!isActiveStatus || !vibeStatus?.remainingMs) return;

    const targetEnd = Date.now() + vibeStatus.remainingMs;

    const interval = setInterval(() => {
      const remaining = Math.max(0, targetEnd - Date.now());
      if (remaining <= 0) {
        clearInterval(interval);
        setCountdown("00:00");
        queryClient.invalidateQueries({ queryKey: ["/api/vibe/status"] });
        return;
      }
      const min = Math.floor(remaining / 60000);
      const sec = Math.floor((remaining % 60000) / 1000);
      setCountdown(`${min.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`);
    }, 1000);

    return () => clearInterval(interval);
  }, [isActiveStatus, vibeStatus?.remainingMs]);

  const activateMutation = useMutation({
    mutationFn: async (coords: { latitude: number; longitude: number }) => {
      return apiRequest("POST", "/api/vibe/activate", {
        latitude: coords.latitude,
        longitude: coords.longitude,
        radiusKm,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vibe/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vibe/nearby"] });
      toast({ title: "Sei live!", description: "Modalità vibing attivata per 30 minuti" });
    },
    onError: () => {
      toast({ title: "Errore", description: "Non è stato possibile attivare la modalità vibing", variant: "destructive" });
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/vibe/deactivate"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vibe/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vibe/nearby"] });
      toast({ title: "Vibing terminato", description: "Sei tornato alla modalità normale" });
    },
  });

  const handleActivate = useCallback(() => {
    if (blockIfGuest("attivare il vibing")) return;
    setGeoError(null);
    setLocating(true);

    if (!navigator.geolocation) {
      setGeoError("Il tuo browser non supporta la geolocalizzazione");
      setLocating(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        activateMutation.mutate({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      (error) => {
        setLocating(false);
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setGeoError("Permesso di geolocalizzazione negato. Attivalo nelle impostazioni del browser.");
            break;
          case error.POSITION_UNAVAILABLE:
            setGeoError("Posizione non disponibile. Riprova.");
            break;
          default:
            setGeoError("Impossibile ottenere la posizione. Riprova.");
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }, [radiusKm, activateMutation]);

  if (statusLoading && !isGuest) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-12 h-12 rounded-full border-4 border-cyan-400 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!myProfile && !isGuest) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="text-center">
          <Zap className="w-12 h-12 text-white/30 mx-auto mb-3" />
          <p className="text-white/60 text-sm">Crea il tuo profilo per iniziare</p>
          <Button className="mt-4" onClick={() => setLocation("/profile/edit")} data-testid="button-create-profile-vibe">
            Crea Profilo
          </Button>
        </div>
      </div>
    );
  }

  const isActive = isGuest ? false : vibeStatus?.active === true;

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
      <AnimatePresence mode="wait">
        {!isActive ? (
          <motion.div
            key="inactive"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex-1 flex flex-col items-center justify-center p-6 gap-6"
          >
            <div className="w-full flex items-center px-4 pt-2">
              <Button variant="ghost" size="icon" className="text-white" onClick={() => setLocation("/")} data-testid="button-back">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </div>

            <motion.div
              animate={{ scale: [1, 1.08, 1], opacity: [0.8, 1, 0.8] }}
              transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
              className="relative"
            >
              <div className="w-32 h-32 rounded-full bg-gradient-to-br from-green-400 via-cyan-500 to-purple-600 flex items-center justify-center shadow-2xl shadow-cyan-500/30">
                <Zap className="w-16 h-16 text-white" />
              </div>
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-green-400/20 via-cyan-500/20 to-purple-600/20 animate-ping" />
            </motion.div>

            <div className="text-center max-w-xs">
              <h1 className="text-2xl font-bold text-white mb-2" data-testid="text-vibing-title">
                Sto Vibing Ora
              </h1>
              <p className="text-white/60 text-sm leading-relaxed">
                Attiva la modalità live per 30 minuti. Vedrai solo persone attive vicino a te, pronte a incontrarsi ORA.
              </p>
            </div>

            <div className="w-full max-w-xs space-y-4">
              <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-white/70 text-sm">Raggio di ricerca</span>
                  <Badge variant="secondary" className="bg-cyan-500/20 text-cyan-300">
                    {radiusKm} km
                  </Badge>
                </div>
                <Slider
                  value={[radiusKm]}
                  onValueChange={(v) => setRadiusKm(v[0])}
                  min={1}
                  max={10}
                  step={1}
                  className="w-full"
                  data-testid="slider-radius"
                />
                <div className="flex justify-between mt-1">
                  <span className="text-white/30 text-[10px]">1 km</span>
                  <span className="text-white/30 text-[10px]">10 km</span>
                </div>
              </div>

              <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10 space-y-2">
                <div className="flex items-center gap-2 text-white/60 text-xs">
                  <Clock className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Dura 30 minuti, poi si disattiva</span>
                </div>
                <div className="flex items-center gap-2 text-white/60 text-xs">
                  <Radio className="w-3.5 h-3.5 text-green-400" />
                  <span>Vedi solo chi è online ORA</span>
                </div>
                <div className="flex items-center gap-2 text-white/60 text-xs">
                  <MapPin className="w-3.5 h-3.5 text-pink-400" />
                  <span>Solo persone vicine a te</span>
                </div>
              </div>

              {geoError && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                  <p className="text-red-300 text-xs">{geoError}</p>
                </div>
              )}

              <Button
                onClick={handleActivate}
                disabled={locating || activateMutation.isPending}
                className="w-full h-14 text-lg font-bold bg-gradient-to-r from-green-500 via-cyan-500 to-purple-600 border-0 shadow-lg shadow-cyan-500/20"
                data-testid="button-activate-vibe"
              >
                {locating ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Localizzazione...
                  </>
                ) : activateMutation.isPending ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Attivazione...
                  </>
                ) : (
                  <>
                    <Zap className="w-5 h-5 mr-2" />
                    Inizia a Vibare
                  </>
                )}
              </Button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="active"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col"
          >
            <div className="bg-gradient-to-r from-green-500/20 via-cyan-500/20 to-purple-600/20 border-b border-cyan-500/20 px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <Button variant="ghost" size="icon" className="text-white shrink-0" onClick={() => setLocation("/")} data-testid="button-back-active">
                  <ArrowLeft className="w-5 h-5" />
                </Button>
                <div className="flex items-center gap-3">
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                    className="w-3 h-3 rounded-full bg-green-400 shadow-lg shadow-green-400/50"
                  />
                  <div>
                    <p className="text-white font-semibold text-sm" data-testid="text-vibing-active">LIVE</p>
                    <p className="text-white/50 text-[10px]">Raggio: {vibeStatus?.session?.radiusKm || radiusKm} km</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 bg-black/30 rounded-lg px-3 py-1.5">
                    <Clock className="w-3.5 h-3.5 text-cyan-400" />
                    <span className="text-cyan-300 font-mono font-bold text-sm" data-testid="text-countdown">{countdown}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deactivateMutation.mutate()}
                    disabled={deactivateMutation.isPending}
                    className="text-red-400"
                    data-testid="button-deactivate-vibe"
                  >
                    <X className="w-5 h-5" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex-1 p-4 overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-white font-semibold text-sm">
                  Persone vicine a te
                </h2>
                <Badge variant="secondary" className="bg-cyan-500/20 text-cyan-300">
                  {nearbyVibers.length} {nearbyVibers.length === 1 ? "persona" : "persone"}
                </Badge>
              </div>

              {nearbyLoading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="text-center">
                    <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mx-auto mb-3" />
                    <p className="text-white/50 text-sm">Cerco persone nelle vicinanze...</p>
                  </div>
                </div>
              ) : nearbyVibers.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center justify-center py-16"
                >
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 4, ease: "linear" }}
                  >
                    <Radio className="w-12 h-12 text-white/20 mb-4" />
                  </motion.div>
                  <p className="text-white/40 text-sm text-center mb-1">Nessuno sta vibando nelle vicinanze</p>
                  <p className="text-white/25 text-xs text-center">Resta online, qualcuno potrebbe unirsi!</p>
                </motion.div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {nearbyVibers.map((vber, idx) => (
                    <motion.div
                      key={vber.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      className="relative bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 overflow-hidden hover-elevate cursor-pointer"
                      onClick={() => setLocation("/")}
                      data-testid={`vibe-card-${vber.profile.id}`}
                    >
                      <div className="aspect-[3/4] relative overflow-hidden">
                        <img
                          src={vber.profile.imageUrl}
                          alt={vber.profile.name}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                        <div className="absolute top-2 right-2">
                          <motion.div
                            animate={{ scale: [1, 1.3, 1] }}
                            transition={{ repeat: Infinity, duration: 1.5 }}
                            className="w-2.5 h-2.5 rounded-full bg-green-400 shadow-lg shadow-green-400/50"
                          />
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 p-3">
                          <p className="text-white font-bold text-sm">{vber.profile.name}, {vber.profile.age}</p>
                          <div className="flex items-center gap-1 mt-0.5">
                            <MapPin className="w-3 h-3 text-cyan-400" />
                            <span className="text-white/60 text-[10px]">{vber.profile.location}</span>
                          </div>
                        </div>
                      </div>
                      <div className="p-2.5">
                        <p className="text-white/50 text-[10px] line-clamp-2">{vber.profile.bio}</p>
                        <div className="flex items-center gap-1 mt-2">
                          <Badge variant="secondary" className="text-[9px] bg-primary/20 text-primary-foreground/80">
                            {vber.profile.alienType}
                          </Badge>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <GuestBlockerModal />
    </div>
  );
}

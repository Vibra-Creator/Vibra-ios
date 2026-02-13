import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, Navigation, X, AlertTriangle, Share2, Info, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Profile, LocationShare } from "@shared/schema";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export default function LocationMap() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const myMarkerRef = useRef<L.Marker | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [watchId, setWatchId] = useState<number | null>(null);

  const { data: myProfile } = useQuery<Profile | null>({
    queryKey: ["/api/profiles/me"],
    enabled: !!user,
  });

  const { data: locationStatus } = useQuery<{ sharing: boolean; share: LocationShare | null }>({
    queryKey: ["/api/location/status"],
    enabled: !!user && !!myProfile,
    refetchInterval: 10000,
  });

  const { data: matchLocations } = useQuery<(LocationShare & { profile: Profile })[]>({
    queryKey: ["/api/location/matches"],
    enabled: !!user && !!myProfile && locationStatus?.sharing === true,
    refetchInterval: 15000,
  });

  const shareMutation = useMutation({
    mutationFn: (pos: { latitude: number; longitude: number }) =>
      apiRequest("POST", "/api/location/share", pos),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/location/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/location/matches"] });
    },
  });

  const stopMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/location/stop"),
    onSuccess: () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        setWatchId(null);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/location/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/location/matches"] });
      toast({ title: "Condivisione interrotta", description: "La tua posizione non è più visibile ai match." });
    },
  });

  const startSharing = () => {
    if (!myProfile?.locationSharingEnabled) {
      toast({ title: "Funzione non attiva", description: "Attiva 'Mostra Dove Sei' nelle impostazioni del profilo.", variant: "destructive" });
      return;
    }
    if (!navigator.geolocation) {
      toast({ title: "Geolocalizzazione non disponibile", description: "Il tuo browser non supporta la geolocalizzazione.", variant: "destructive" });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        shareMutation.mutate({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        const id = navigator.geolocation.watchPosition(
          (p) => {
            shareMutation.mutate({ latitude: p.coords.latitude, longitude: p.coords.longitude });
          },
          () => {},
          { enableHighAccuracy: true, maximumAge: 30000, timeout: 10000 }
        );
        setWatchId(id);
        toast({ title: "Posizione condivisa", description: "I tuoi match con questa funzione attiva potranno vederti sulla mappa." });
      },
      (err) => {
        toast({ title: "Errore posizione", description: "Consenti l'accesso alla posizione nel browser.", variant: "destructive" });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  useEffect(() => {
    return () => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    };
  }, [watchId]);

  useEffect(() => {
    if (!mapRef.current || leafletMap.current) return;
    const defaultLat = locationStatus?.share?.latitude || 41.9028;
    const defaultLng = locationStatus?.share?.longitude || 12.4964;

    leafletMap.current = L.map(mapRef.current, {
      zoomControl: false,
    }).setView([defaultLat, defaultLng], 13);

    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
      subdomains: "abcd",
      maxZoom: 19,
    }).addTo(leafletMap.current);

    L.control.zoom({ position: "bottomright" }).addTo(leafletMap.current);
  }, [mapRef.current]);

  useEffect(() => {
    if (!leafletMap.current) return;

    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    if (matchLocations && matchLocations.length > 0) {
      matchLocations.forEach(loc => {
        const icon = L.divIcon({
          className: "custom-marker",
          html: `<div style="width:40px;height:40px;border-radius:50%;border:3px solid #00e5ff;overflow:hidden;box-shadow:0 0 12px rgba(0,229,255,0.5);">
            <img src="${loc.profile.imageUrl}" style="width:100%;height:100%;object-fit:cover;" />
          </div>`,
          iconSize: [40, 40],
          iconAnchor: [20, 20],
        });
        const marker = L.marker([loc.latitude, loc.longitude], { icon })
          .addTo(leafletMap.current!)
          .bindPopup(`<div style="text-align:center;font-family:sans-serif;">
            <strong>${loc.profile.name}</strong><br/>
            <small>${loc.profile.location || ""}</small>
          </div>`);
        markersRef.current.push(marker);
      });
    }
  }, [matchLocations]);

  useEffect(() => {
    if (!leafletMap.current || !locationStatus?.share) return;

    if (myMarkerRef.current) myMarkerRef.current.remove();

    const myIcon = L.divIcon({
      className: "custom-marker-me",
      html: `<div style="width:44px;height:44px;border-radius:50%;border:3px solid #e040fb;overflow:hidden;box-shadow:0 0 16px rgba(224,64,251,0.6);position:relative;">
        <img src="${myProfile?.imageUrl || ""}" style="width:100%;height:100%;object-fit:cover;" />
        <div style="position:absolute;bottom:-2px;right:-2px;width:14px;height:14px;background:#4caf50;border:2px solid #1a1a2e;border-radius:50%;"></div>
      </div>`,
      iconSize: [44, 44],
      iconAnchor: [22, 22],
    });

    myMarkerRef.current = L.marker([locationStatus.share.latitude, locationStatus.share.longitude], { icon: myIcon })
      .addTo(leafletMap.current)
      .bindPopup(`<div style="text-align:center;font-family:sans-serif;"><strong>Tu</strong></div>`);

    leafletMap.current.setView([locationStatus.share.latitude, locationStatus.share.longitude], 14);
  }, [locationStatus?.share, myProfile]);

  const isSharing = locationStatus?.sharing === true;
  const locationEnabled = myProfile?.locationSharingEnabled === true;

  return (
    <div className="relative h-full flex flex-col" data-testid="location-map-page">
      <div ref={mapRef} className="flex-1 z-0" style={{ minHeight: "300px" }} />

      <div className="absolute top-4 left-4 right-4 z-10 flex items-center gap-2">
        <Button variant="ghost" size="icon" className="bg-black/60 backdrop-blur-md text-white border border-white/10 rounded-xl" onClick={() => setLocation("/")} data-testid="button-back">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1 bg-black/60 backdrop-blur-md rounded-xl p-3 border border-white/10">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-secondary" />
            <h2 className="text-white font-semibold text-sm" data-testid="text-location-title">Dove Sei</h2>
            <Button
              variant="ghost"
              size="icon"
              className="ml-auto"
              onClick={() => setShowInfo(!showInfo)}
              data-testid="button-location-info"
            >
              <Info className="w-4 h-4 text-white/60" />
            </Button>
          </div>
          {isSharing && (
            <div className="mt-1 flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-xs text-green-400">Posizione attiva</span>
              {matchLocations && matchLocations.length > 0 && (
                <span className="text-xs text-white/40 ml-1">
                  {matchLocations.length} match visibil{matchLocations.length === 1 ? "e" : "i"}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showInfo && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-20 left-4 right-4 z-20"
          >
            <Card className="bg-black/80 backdrop-blur-xl border-white/10 p-4">
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-400" />
                  <h3 className="text-white font-semibold text-sm">Privacy e Sicurezza</h3>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setShowInfo(false)} data-testid="button-close-info">
                  <X className="w-4 h-4 text-white/60" />
                </Button>
              </div>
              <div className="space-y-2 text-white/70 text-xs">
                <p>Questa funzione ti permette di condividere la tua posizione <strong className="text-white">solo con i tuoi Match</strong> che hanno anche loro attivato questa opzione.</p>
                <p>La tua posizione <strong className="text-white">non è visibile</strong> a utenti con cui non hai un match reciproco.</p>
                <p>Puoi <strong className="text-white">disattivare</strong> la condivisione in qualsiasi momento toccando "Interrompi".</p>
                <p>Per motivi di sicurezza, <strong className="text-white">non condividere mai</strong> la tua posizione esatta con sconosciuti al di fuori dell'app.</p>
                <p className="text-yellow-400/80">Usa questa funzione con responsabilità. Incontra sempre le persone in luoghi pubblici.</p>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="absolute bottom-0 left-0 right-0 z-10 p-4 bg-gradient-to-t from-black/80 via-black/50 to-transparent pt-12">
        {!locationEnabled ? (
          <Card className="bg-black/60 backdrop-blur-md border-white/10 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                <MapPin className="w-5 h-5 text-white/40" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium">Funzione non attiva</p>
                <p className="text-white/50 text-xs">Attiva "Mostra Dove Sei" nelle impostazioni del profilo per condividere la tua posizione con i match.</p>
              </div>
            </div>
          </Card>
        ) : !isSharing ? (
          <Button
            onClick={startSharing}
            disabled={shareMutation.isPending}
            className="w-full bg-gradient-to-r from-secondary to-primary py-6 text-base font-semibold"
            data-testid="button-start-sharing"
          >
            <Share2 className="w-5 h-5 mr-2" />
            {shareMutation.isPending ? "Attivazione..." : "Condividi Posizione"}
          </Button>
        ) : (
          <div className="space-y-3">
            {matchLocations && matchLocations.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {matchLocations.map(loc => (
                  <button
                    key={loc.profileId}
                    className="flex items-center gap-2 bg-black/60 backdrop-blur-sm rounded-full px-3 py-2 border border-white/10 shrink-0"
                    onClick={() => {
                      leafletMap.current?.setView([loc.latitude, loc.longitude], 15);
                    }}
                    data-testid={`button-goto-match-${loc.profileId}`}
                  >
                    <Avatar className="w-6 h-6">
                      <AvatarImage src={loc.profile.imageUrl} />
                      <AvatarFallback className="bg-primary/30 text-white text-xs">{loc.profile.name[0]}</AvatarFallback>
                    </Avatar>
                    <span className="text-white text-xs font-medium whitespace-nowrap">{loc.profile.name}</span>
                  </button>
                ))}
              </div>
            )}
            <Button
              onClick={() => stopMutation.mutate()}
              disabled={stopMutation.isPending}
              variant="outline"
              className="w-full border-red-500/50 text-red-400 py-5"
              data-testid="button-stop-sharing"
            >
              <X className="w-4 h-4 mr-2" />
              {stopMutation.isPending ? "Interrompo..." : "Interrompi Condivisione"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

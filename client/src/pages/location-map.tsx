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
import { useLanguage } from "@/i18n/LanguageContext";
import type { Profile, LocationShare } from "@shared/schema";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export default function LocationMap() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { t } = useLanguage();
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const myMarkerRef = useRef<L.Marker | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [watchId, setWatchId] = useState<number | null>(null);
  const [requestingPosition, setRequestingPosition] = useState(false);

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
      toast({ title: t("location.stopped"), description: t("location.stoppedDesc") });
    },
  });

  const startSharing = () => {
    if (!navigator.geolocation) {
      toast({ title: t("location.geoNotAvailable"), description: t("location.geoNotSupported"), variant: "destructive" });
      return;
    }
    if (!myProfile) {
      toast({ title: t("common.error"), description: t("location.profileUnavailable"), variant: "destructive" });
      return;
    }

    setRequestingPosition(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          if (!myProfile.locationSharingEnabled) {
            await apiRequest("PUT", `/api/profiles/${myProfile.id}`, { locationSharingEnabled: true });
            queryClient.setQueryData<Profile | null>(["/api/profiles/me"], (current) =>
              current ? { ...current, locationSharingEnabled: true } : current,
            );
          }

          const coordinates = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
          await shareMutation.mutateAsync(coordinates);

          const id = navigator.geolocation.watchPosition(
            (position) => {
              shareMutation.mutate({ latitude: position.coords.latitude, longitude: position.coords.longitude });
            },
            () => {
              toast({ title: t("location.positionError"), description: t("location.allowAccess"), variant: "destructive" });
            },
            { enableHighAccuracy: true, maximumAge: 30000, timeout: 10000 },
          );
          setWatchId(id);
          toast({ title: t("location.shared"), description: t("location.sharedDesc") });
        } catch (error) {
          toast({
            title: t("location.positionError"),
            description: error instanceof Error ? error.message : t("location.allowAccess"),
            variant: "destructive",
          });
        } finally {
          setRequestingPosition(false);
        }
      },
      () => {
        setRequestingPosition(false);
        toast({ title: t("location.positionError"), description: t("location.allowAccess"), variant: "destructive" });
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

    const map = L.map(mapRef.current, {
      zoomControl: false,
    }).setView([defaultLat, defaultLng], 13);
    leafletMap.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      subdomains: "abc",
      maxZoom: 19,
    }).addTo(leafletMap.current);

    L.control.zoom({ position: "bottomright" }).addTo(leafletMap.current);

    const resizeMap = () => window.requestAnimationFrame(() => map.invalidateSize());
    window.addEventListener("resize", resizeMap);
    window.addEventListener("orientationchange", resizeMap);
    resizeMap();

    return () => {
      window.removeEventListener("resize", resizeMap);
      window.removeEventListener("orientationchange", resizeMap);
      map.remove();
      leafletMap.current = null;
    };
  }, []);

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
          .bindPopup(`<div style="text-align:center;font-family:sans-serif;color:#333;background:#fff;padding:8px;border-radius:6px;">
            <strong style="color:#000;">${loc.profile.name}</strong><br/>
            <small style="color:#666;">${loc.profile.location || ""}</small>
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
      .bindPopup(`<div style="text-align:center;font-family:sans-serif;color:#000;background:#fff;padding:8px;border-radius:6px;"><strong>${t("location.you")}</strong></div>`);

    leafletMap.current.setView([locationStatus.share.latitude, locationStatus.share.longitude], 14);
  }, [locationStatus?.share, myProfile]);

  const isSharing = locationStatus?.sharing === true;
  const locationEnabled = myProfile?.locationSharingEnabled === true;

  return (
    <div className="relative h-full flex flex-col" data-testid="location-map-page">
      <div ref={mapRef} className="flex-1 z-0" style={{ minHeight: "300px" }} />

      <div className="absolute top-4 left-4 right-4 z-10 flex items-center gap-2">
        <Button variant="ghost" size="icon" className="bg-white/80 backdrop-blur-md text-slate-800 border border-slate-200 rounded-xl hover:bg-white" onClick={() => setLocation("/")} data-testid="button-back">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1 bg-white/90 backdrop-blur-md rounded-xl p-3 border border-slate-200 shadow-md">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-secondary" />
            <h2 className="text-slate-800 font-semibold text-sm" data-testid="text-location-title">{t("location.title")}</h2>
            <Button
              variant="ghost"
              size="icon"
              className="ml-auto"
              onClick={() => setShowInfo(!showInfo)}
              data-testid="button-location-info"
            >
              <Info className="w-4 h-4 text-slate-600" />
            </Button>
          </div>
          {isSharing && (
            <div className="mt-1 flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs text-green-600 font-medium">{t("location.active")}</span>
              {matchLocations && matchLocations.length > 0 && (
                <span className="text-xs text-slate-500 ml-1">
                  {matchLocations.length} {matchLocations.length === 1 ? t("location.matchVisibleSingular") : t("location.matchVisible")}
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
            <Card className="bg-white/95 backdrop-blur-xl border-slate-200 p-4 shadow-lg">
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                  <h3 className="text-slate-900 font-semibold text-sm">{t("location.privacySafety")}</h3>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setShowInfo(false)} data-testid="button-close-info">
                  <X className="w-4 h-4 text-slate-600" />
                </Button>
              </div>
              <div className="space-y-2 text-slate-700 text-xs">
                <p>{t("location.privacyText1")}</p>
                <p>{t("location.privacyText2")}</p>
                <p>{t("location.privacyText3")}</p>
                <p>{t("location.privacyText4")}</p>
                <p className="text-amber-600 font-medium">{t("location.privacyText5")}</p>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="absolute bottom-0 left-0 right-0 z-10 p-4 bg-gradient-to-t from-white/90 via-white/60 to-transparent pt-12">
        {!locationEnabled ? (
          <Card className="bg-white/95 backdrop-blur-md border-slate-200 p-4 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                <MapPin className="w-5 h-5 text-slate-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-slate-900 text-sm font-medium">{t("location.notActive")}</p>
                <p className="text-slate-600 text-xs">{t("location.notActiveDesc")}</p>
              </div>
            </div>
            <Button
              onClick={startSharing}
              disabled={requestingPosition || shareMutation.isPending || !myProfile}
              className="w-full mt-3 bg-gradient-to-r from-secondary to-primary"
              data-testid="button-enable-location-sharing"
            >
              <Share2 className="w-4 h-4 mr-2" />
              {requestingPosition || shareMutation.isPending ? t("location.activating") : t("location.enableAndShare")}
            </Button>
          </Card>
        ) : !isSharing ? (
          <Button
            onClick={startSharing}
            disabled={requestingPosition || shareMutation.isPending}
            className="w-full bg-gradient-to-r from-secondary to-primary py-6 text-base font-semibold"
            data-testid="button-start-sharing"
          >
            <Share2 className="w-5 h-5 mr-2" />
            {requestingPosition || shareMutation.isPending ? t("location.activating") : t("location.sharePosition")}
          </Button>
        ) : (
          <div className="space-y-3">
            {matchLocations && matchLocations.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {matchLocations.map(loc => (
                  <button
                    key={loc.profileId}
                    className="flex items-center gap-2 bg-white/80 backdrop-blur-sm rounded-full px-3 py-2 border border-slate-300 shrink-0 hover:bg-white transition-colors"
                    onClick={() => {
                      leafletMap.current?.setView([loc.latitude, loc.longitude], 15);
                    }}
                    data-testid={`button-goto-match-${loc.profileId}`}
                  >
                    <Avatar className="w-6 h-6">
                      <AvatarImage src={loc.profile.imageUrl} />
                      <AvatarFallback className="bg-primary/20 text-slate-800 text-xs font-medium">{loc.profile.name[0]}</AvatarFallback>
                    </Avatar>
                    <span className="text-slate-800 text-xs font-medium whitespace-nowrap">{loc.profile.name}</span>
                  </button>
                ))}
              </div>
            )}
            <Button
              onClick={() => stopMutation.mutate()}
              disabled={stopMutation.isPending}
              variant="outline"
              className="w-full border-red-400 text-red-600 hover:bg-red-50 py-5"
              data-testid="button-stop-sharing"
            >
              <X className="w-4 h-4 mr-2" />
              {stopMutation.isPending ? t("location.stopping") : t("location.stopSharing")}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

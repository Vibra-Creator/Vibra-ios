import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Lock, Plus, Users, Crown, Bell, MessageCircle, Clock, CheckCircle, XCircle, Star, Search, Sparkles, Heart, ArrowLeft, Info, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";
import { useGuest } from "@/hooks/use-guest";
import { useGuestBlocker } from "@/components/GuestBlocker";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { PrivateRoom, Profile } from "@shared/schema";

interface CategorizedRooms {
  myRooms: PrivateRoom[];
  matchRooms: PrivateRoom[];
  popularRooms: PrivateRoom[];
  memberCounts: Record<string, number>;
  ownerProfiles: Record<string, { name: string; imageUrl: string | null }>;
}

function PrivateRoomSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-24 rounded-xl" />
      ))}
    </div>
  );
}

export default function PrivateRooms() {
  const { user } = useAuth();
  const { isGuest } = useGuest();
  const { blockIfGuest, GuestBlockerModal } = useGuestBlocker();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomDescription, setNewRoomDescription] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showBanner, setShowBanner] = useState(() => {
    return sessionStorage.getItem("private-rooms-banner-dismissed") !== "true";
  });

  const dismissBanner = () => {
    setShowBanner(false);
    sessionStorage.setItem("private-rooms-banner-dismissed", "true");
  };

  const { data: myProfile } = useQuery<Profile | null>({
    queryKey: ["/api/profiles/me"],
    enabled: !!user && !isGuest,
    staleTime: 0,
    refetchOnMount: "always",
  });

  const userPoints = myProfile?.points ?? 0;
  const requiredPoints = 45;
  const canCreateRoom = userPoints >= requiredPoints;

  const { data: categorized, isLoading } = useQuery<CategorizedRooms>({
    queryKey: ["/api/private-rooms/categorized"],
    queryFn: async () => {
      const res = await fetch("/api/private-rooms/categorized", { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!user && !isGuest,
  });

  const { data: guestPrivateRooms, isLoading: guestLoading } = useQuery<PrivateRoom[]>({
    queryKey: ["/api/guest/private-rooms"],
    enabled: isGuest,
  });

  const createRoomMutation = useMutation({
    mutationFn: async (data: { name: string; description: string }) => {
      return await apiRequest("POST", "/api/private-rooms", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/private-rooms/categorized"] });
      queryClient.invalidateQueries({ queryKey: ["/api/profiles/me"] });
      toast({ title: "Stanza creata!", description: `La tua stanza "${newRoomName}" è stata creata.` });
      setIsCreateOpen(false);
      setNewRoomName("");
      setNewRoomDescription("");
    },
    onError: (error: any) => {
      let msg = "Impossibile creare la stanza.";
      try {
        const raw = error?.message || "";
        const jsonPart = raw.substring(raw.indexOf("{"));
        const parsed = JSON.parse(jsonPart);
        if (parsed.error) msg = parsed.error;
      } catch {}
      toast({ title: "Errore", description: msg, variant: "destructive" });
    },
  });

  const requestAccessMutation = useMutation({
    mutationFn: async (roomId: string) => {
      return await apiRequest("POST", `/api/private-rooms/${roomId}/request`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/private-rooms/categorized"] });
      toast({ title: "Richiesta inviata!", description: "Attendi l'approvazione del proprietario." });
    },
    onError: (error: any) => {
      const msg = error?.message || "Impossibile inviare la richiesta.";
      toast({ title: "Errore", description: msg, variant: "destructive" });
    },
  });

  const handleCreateRoom = () => {
    if (blockIfGuest("creare o accedere alle stanze private")) return;
    if (!newRoomName.trim()) {
      toast({ title: "Errore", description: "Inserisci un nome per la stanza", variant: "destructive" });
      return;
    }
    createRoomMutation.mutate({ name: newRoomName.trim(), description: newRoomDescription.trim() });
  };

  const allDisplayRooms = [
    ...(categorized?.matchRooms || []),
    ...(categorized?.popularRooms || []),
  ];

  const filteredRooms = searchQuery.trim()
    ? allDisplayRooms.filter(r =>
        r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.description || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (categorized?.ownerProfiles[r.ownerId]?.name || "").toLowerCase().includes(searchQuery.toLowerCase())
      )
    : null;

  return (
    <div className="flex-1 p-4 pb-8 overflow-y-auto relative z-10">
      <div className="fixed inset-0 z-0">
        <img src="/images/private-rooms-bg.gif" alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/30 to-black/50" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6 relative z-10"
      >
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="text-white bg-black/30 backdrop-blur-sm" onClick={() => setLocation("/")} data-testid="button-back">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-secondary to-primary flex items-center justify-center">
              <Lock className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white" data-testid="text-private-rooms-title">Stanze Private</h1>
              <p className="text-sm text-white/60" data-testid="text-private-rooms-subtitle">Il tuo spazio esclusivo</p>
            </div>
          </div>

          <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-300 shrink-0" data-testid="badge-user-points">
            <Star className="w-3 h-3 mr-1" />
            {userPoints} punti
          </Badge>
        </div>

        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <Input
              placeholder="Cerca stanze..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-white/40"
              data-testid="input-search-rooms"
            />
          </div>
          {!isGuest && (
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button className="gap-1.5 shrink-0" data-testid="button-create-room-top">
                  <Plus className="w-4 h-4" />
                  Crea
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Crea una Stanza Privata</DialogTitle>
                </DialogHeader>
                {!canCreateRoom ? (
                  <div className="space-y-4 pt-4 text-center">
                    <div className="w-16 h-16 rounded-full bg-yellow-500/20 flex items-center justify-center mx-auto">
                      <Star className="w-8 h-8 text-yellow-400" />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Servono almeno <strong>{requiredPoints} punti</strong> per creare una stanza privata.
                      <br />Hai <strong>{userPoints} punti</strong>.
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Completa le sfide giornaliere per guadagnare punti!
                    </p>
                    <Button variant="outline" className="w-full" onClick={() => setIsCreateOpen(false)} data-testid="button-close-dialog-top">
                      Ho capito
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4 pt-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">Nome Stanza</label>
                      <Input
                        value={newRoomName}
                        onChange={(e) => setNewRoomName(e.target.value)}
                        placeholder="Es. Il Mio Angolo Cosmico"
                        data-testid="input-room-name-top"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">Descrizione</label>
                      <Textarea
                        value={newRoomDescription}
                        onChange={(e) => setNewRoomDescription(e.target.value)}
                        placeholder="Descrivi la tua stanza..."
                        className="resize-none"
                        data-testid="input-room-description-top"
                      />
                    </div>
                    <Button
                      className="w-full"
                      onClick={handleCreateRoom}
                      disabled={createRoomMutation.isPending}
                      data-testid="button-confirm-create-room-top"
                    >
                      {createRoomMutation.isPending ? "Creazione..." : `Crea Stanza (${requiredPoints} punti)`}
                    </Button>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          )}
        </div>
      </motion.div>

      <div className="relative z-10">
        {!isGuest && !isLoading && showBanner && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-6"
          >
            <div className="rounded-xl backdrop-blur-md bg-gradient-to-r from-primary/20 to-accent/20 border border-primary/30 p-4" data-testid="banner-create-room">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/40 to-accent/40 flex items-center justify-center shrink-0 mt-0.5">
                  <Lock className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-white text-base mb-0.5">Entra chi dico io!</h3>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0 w-6 h-6 text-white/40 -mt-1 -mr-1"
                      onClick={dismissBanner}
                      data-testid="button-close-rooms-banner"
                    >
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  <p className="text-white/60 text-xs leading-relaxed">
                    Crea la tua stanza privata e decidi tu chi far entrare! Costa {requiredPoints} punti, dura 12 ore e poi viene cancellata automaticamente. Usa il pulsante "Crea" in alto per iniziare!
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {(isGuest ? guestLoading : isLoading) ? (
          <PrivateRoomSkeleton />
        ) : isGuest ? (
          <div className="space-y-6">
            <div className="space-y-3">
              {(guestPrivateRooms || []).map((room, index) => (
                <motion.div
                  key={room.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <div
                    className="rounded-xl backdrop-blur-md bg-white/5 border border-white/10 p-4 cursor-pointer"
                    onClick={() => blockIfGuest("creare o accedere alle stanze private")}
                    data-testid={`card-private-room-${room.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="w-10 h-10 border border-primary/30">
                        <AvatarImage src={room.imageUrl || "/images/profile-16.png"} />
                        <AvatarFallback>{room.name[0]}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-white truncate">{room.name}</h3>
                        <p className="text-xs text-white/50">{room.description || "Stanza privata"}</p>
                      </div>
                      <Button
                        size="sm"
                        variant="default"
                        onClick={(e) => {
                          e.stopPropagation();
                          blockIfGuest("creare o accedere alle stanze private");
                        }}
                        data-testid={`button-request-access-guest-${room.id}`}
                      >
                        Richiedi
                      </Button>
                    </div>
                  </div>
                </motion.div>
              ))}
              {(!guestPrivateRooms || guestPrivateRooms.length === 0) && (
                <div className="text-center py-12">
                  <Lock className="w-12 h-12 text-white/30 mx-auto mb-3" />
                  <p className="text-white/50 text-lg">Nessuna stanza privata ancora</p>
                </div>
              )}
            </div>
          </div>
        ) : searchQuery.trim() ? (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-white/80 flex items-center gap-2">
              <Search className="w-4 h-4" />
              Risultati ricerca
            </h2>
            {filteredRooms && filteredRooms.length > 0 ? (
              filteredRooms.map((room, index) => (
                <RoomCard
                  key={room.id}
                  room={room}
                  myProfile={myProfile}
                  index={index}
                  memberCount={categorized?.memberCounts[room.id] || 0}
                  ownerName={categorized?.ownerProfiles[room.ownerId]?.name}
                  ownerImage={categorized?.ownerProfiles[room.ownerId]?.imageUrl}
                  onRequestAccess={() => requestAccessMutation.mutate(room.id)}
                  onNavigate={() => setLocation(`/private-room/${room.id}`)}
                  isRequesting={requestAccessMutation.isPending}
                />
              ))
            ) : (
              <p className="text-white/40 text-center py-8">Nessuna stanza trovata</p>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {(categorized?.myRooms?.length || 0) > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <h2 className="text-lg font-semibold text-white/80 mb-3 flex items-center gap-2">
                  <Crown className="w-4 h-4 text-amber-400" />
                  Le Mie Stanze
                </h2>
                <div className="space-y-3">
                  {categorized!.myRooms.map((room, index) => (
                    <MyRoomCard
                      key={room.id}
                      room={room}
                      myProfile={myProfile}
                      index={index}
                      memberCount={categorized?.memberCounts[room.id] || 0}
                      onNavigate={() => setLocation(`/private-room/${room.id}`)}
                    />
                  ))}
                </div>
              </motion.div>
            )}

            {(categorized?.matchRooms?.length || 0) > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <h2 className="text-lg font-semibold text-white/80 mb-3 flex items-center gap-2">
                  <Heart className="w-4 h-4 text-pink-400" />
                  Stanze dei tuoi Match
                </h2>
                <div className="space-y-3">
                  {categorized!.matchRooms.map((room, index) => (
                    <RoomCard
                      key={room.id}
                      room={room}
                      myProfile={myProfile}
                      index={index}
                      memberCount={categorized?.memberCounts[room.id] || 0}
                      ownerName={categorized?.ownerProfiles[room.ownerId]?.name}
                      ownerImage={categorized?.ownerProfiles[room.ownerId]?.imageUrl}
                      onRequestAccess={() => requestAccessMutation.mutate(room.id)}
                      onNavigate={() => setLocation(`/private-room/${room.id}`)}
                      isRequesting={requestAccessMutation.isPending}
                    />
                  ))}
                </div>
              </motion.div>
            )}

            {(categorized?.popularRooms?.length || 0) > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <h2 className="text-lg font-semibold text-white/80 mb-3 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-yellow-400" />
                  Stanze Popolari
                </h2>
                <div className="space-y-3">
                  {categorized!.popularRooms.map((room, index) => (
                    <RoomCard
                      key={room.id}
                      room={room}
                      myProfile={myProfile}
                      index={index}
                      memberCount={categorized?.memberCounts[room.id] || 0}
                      ownerName={categorized?.ownerProfiles[room.ownerId]?.name}
                      ownerImage={categorized?.ownerProfiles[room.ownerId]?.imageUrl}
                      onRequestAccess={() => requestAccessMutation.mutate(room.id)}
                      onNavigate={() => setLocation(`/private-room/${room.id}`)}
                      isRequesting={requestAccessMutation.isPending}
                    />
                  ))}
                </div>
              </motion.div>
            )}

            {!categorized?.myRooms?.length && !categorized?.matchRooms?.length && !categorized?.popularRooms?.length && (
              <div className="text-center py-12">
                <Lock className="w-12 h-12 text-white/30 mx-auto mb-3" />
                <p className="text-white/50 text-lg">Nessuna stanza privata ancora</p>
                <p className="text-white/30 text-sm mt-1">Usa il bottone sopra per creare la prima!</p>
              </div>
            )}
          </div>
        )}
      </div>
      <GuestBlockerModal />
    </div>
  );
}

function MyRoomCard({
  room,
  myProfile,
  index,
  memberCount,
  onNavigate,
}: {
  room: PrivateRoom;
  myProfile: Profile | null | undefined;
  index: number;
  memberCount: number;
  onNavigate: () => void;
}) {
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    if (!room.expiresAt) return;
    const update = () => {
      const diff = new Date(room.expiresAt!).getTime() - Date.now();
      if (diff <= 0) { setTimeLeft("Scaduta"); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      setTimeLeft(`${h}h ${m}m`);
    };
    update();
    const interval = setInterval(update, 60000);
    return () => clearInterval(interval);
  }, [room.expiresAt]);

  const { data: pendingRequests } = useQuery<any[]>({
    queryKey: ["/api/private-rooms", room.id, "requests"],
    queryFn: async () => {
      const res = await fetch(`/api/private-rooms/${room.id}/requests`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const pendingCount = pendingRequests?.filter((r: any) => r.status === "pending")?.length || 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <div
        className="rounded-xl backdrop-blur-md bg-gradient-to-r from-primary/15 to-accent/15 border border-primary/30 p-4 cursor-pointer"
        onClick={onNavigate}
        data-testid={`card-my-room-${room.id}`}
      >
        <div className="flex items-start gap-3">
          <Avatar className="w-12 h-12 border-2 border-primary/50">
            <AvatarImage src={room.imageUrl || myProfile?.imageUrl || "/images/profile-16.png"} />
            <AvatarFallback>{room.name[0]}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h3 className="font-bold text-white truncate">{room.name}</h3>
              <Badge variant="secondary" className="bg-accent/20 text-accent shrink-0">
                <Crown className="w-3 h-3 mr-1" />
                Proprietario
              </Badge>
            </div>
            <p className="text-sm text-white/70 mb-2 line-clamp-1">{room.description || "La tua stanza privata"}</p>
            <div className="flex items-center gap-4 text-sm text-purple-300/80 flex-wrap">
              <span className="flex items-center gap-1">
                <Users className="w-4 h-4" />
                {memberCount} membri
              </span>
              {pendingCount > 0 && (
                <span className="flex items-center gap-1 text-accent">
                  <Bell className="w-4 h-4" />
                  {pendingCount} richieste
                </span>
              )}
              {timeLeft && (
                <span className="flex items-center gap-1 text-yellow-300/80">
                  <Clock className="w-3.5 h-3.5" />
                  {timeLeft}
                </span>
              )}
            </div>
          </div>
          <Button size="sm" variant="outline" data-testid={`button-enter-my-room-${room.id}`}>
            <MessageCircle className="w-4 h-4 mr-1" />
            Entra
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

function RoomCard({
  room,
  myProfile,
  index,
  memberCount,
  ownerName,
  ownerImage,
  onRequestAccess,
  onNavigate,
  isRequesting,
}: {
  room: PrivateRoom;
  myProfile: Profile | null | undefined;
  index: number;
  memberCount: number;
  ownerName?: string;
  ownerImage?: string | null;
  onRequestAccess: () => void;
  onNavigate: () => void;
  isRequesting: boolean;
}) {
  const isOwner = myProfile?.id === room.ownerId;

  const [timeLeft, setTimeLeft] = useState("");
  useEffect(() => {
    if (!room.expiresAt) return;
    const update = () => {
      const diff = new Date(room.expiresAt!).getTime() - Date.now();
      if (diff <= 0) { setTimeLeft("Scaduta"); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      setTimeLeft(`${h}h ${m}m`);
    };
    update();
    const interval = setInterval(update, 60000);
    return () => clearInterval(interval);
  }, [room.expiresAt]);

  const { data: myRequest } = useQuery<any>({
    queryKey: ["/api/private-rooms", room.id, "my-request"],
    queryFn: async () => {
      const res = await fetch(`/api/private-rooms/${room.id}/my-request`, { credentials: "include" });
      return res.json();
    },
    enabled: !!myProfile && !isOwner,
  });

  const isMember = isOwner || myRequest?.status === "approved";
  const isPending = myRequest?.status === "pending";
  const isRejected = myRequest?.status === "rejected";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <div
        className="rounded-xl backdrop-blur-md bg-white/5 border border-white/10 p-4 cursor-pointer"
        onClick={() => { if (isMember) onNavigate(); }}
        data-testid={`card-private-room-${room.id}`}
      >
        <div className="flex items-start gap-3">
          <Avatar className="w-10 h-10 border border-white/20">
            <AvatarImage src={ownerImage || room.imageUrl || "/images/profile-16.png"} />
            <AvatarFallback>{room.name[0]}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-white truncate">{room.name}</h3>
            <p className="text-xs text-white/50 flex items-center gap-1 flex-wrap">
              <span>{ownerName || "Sconosciuto"}</span>
              <span className="text-white/30">·</span>
              <Users className="w-3 h-3" />
              <span>{memberCount}</span>
              {timeLeft && (
                <span className="flex items-center gap-0.5 text-yellow-300/60">
                  · {timeLeft}
                </span>
              )}
            </p>
          </div>

          <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
            {isMember ? (
              <Button size="sm" variant="outline" onClick={onNavigate} data-testid={`button-enter-room-${room.id}`}>
                <MessageCircle className="w-4 h-4 mr-1" />
                Entra
              </Button>
            ) : isPending ? (
              <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-300">
                <Clock className="w-3 h-3 mr-1" />
                In attesa
              </Badge>
            ) : isRejected ? (
              <Badge variant="secondary" className="bg-red-500/20 text-red-300">
                <XCircle className="w-3 h-3 mr-1" />
                Rifiutato
              </Badge>
            ) : (
              <Button
                size="sm"
                variant="default"
                onClick={onRequestAccess}
                disabled={isRequesting}
                data-testid={`button-request-access-${room.id}`}
              >
                Richiedi
              </Button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

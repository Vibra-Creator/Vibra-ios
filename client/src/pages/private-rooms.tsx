import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Lock, Plus, Users, Crown, Bell, MessageCircle, Clock, CheckCircle, XCircle, Star, Search, Sparkles, Heart } from "lucide-react";
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
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { PrivateRoom, Profile } from "@shared/schema";

interface CategorizedRooms {
  myRoom: PrivateRoom | null;
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
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomDescription, setNewRoomDescription] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: myProfile } = useQuery<Profile | null>({
    queryKey: ["/api/profiles/me"],
    enabled: !!user,
  });

  const { data: pointsData } = useQuery<{ points: number }>({
    queryKey: ["/api/points/me"],
    enabled: !!user,
  });

  const userPoints = pointsData?.points ?? myProfile?.points ?? 0;
  const requiredPoints = 45;
  const canCreateRoom = userPoints >= requiredPoints;

  const { data: categorized, isLoading } = useQuery<CategorizedRooms>({
    queryKey: ["/api/private-rooms/categorized"],
    queryFn: async () => {
      const res = await fetch("/api/private-rooms/categorized", { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!user,
  });

  const createRoomMutation = useMutation({
    mutationFn: async (data: { name: string; description: string }) => {
      return await apiRequest("POST", "/api/private-rooms", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/private-rooms/categorized"] });
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
    <div className="flex-1 p-4 pb-8 overflow-y-auto">
      <div className="fixed inset-0 -z-10">
        <img src="/images/private-rooms-bg.gif" alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/30 to-black/50" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="flex items-center gap-3">
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

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
          <Input
            placeholder="Cerca stanze per nome o proprietario..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-white/40"
            data-testid="input-search-rooms"
          />
        </div>
      </motion.div>

      {isLoading ? (
        <PrivateRoomSkeleton />
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
          <MyRoomSection
            myRoom={categorized?.myRoom || null}
            myProfile={myProfile}
            canCreateRoom={canCreateRoom}
            userPoints={userPoints}
            requiredPoints={requiredPoints}
            isCreateOpen={isCreateOpen}
            setIsCreateOpen={setIsCreateOpen}
            newRoomName={newRoomName}
            setNewRoomName={setNewRoomName}
            newRoomDescription={newRoomDescription}
            setNewRoomDescription={setNewRoomDescription}
            handleCreateRoom={handleCreateRoom}
            isCreating={createRoomMutation.isPending}
            memberCount={categorized?.myRoom ? (categorized.memberCounts[categorized.myRoom.id] || 0) : 0}
            onNavigate={(id) => setLocation(`/private-room/${id}`)}
            toast={toast}
          />

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

          {!categorized?.myRoom && !categorized?.matchRooms?.length && !categorized?.popularRooms?.length && (
            <div className="text-center py-12">
              <Lock className="w-12 h-12 text-white/30 mx-auto mb-3" />
              <p className="text-white/50 text-lg">Nessuna stanza privata ancora</p>
              <p className="text-white/30 text-sm mt-1">Crea la prima stanza privata!</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MyRoomSection({
  myRoom,
  myProfile,
  canCreateRoom,
  userPoints,
  requiredPoints,
  isCreateOpen,
  setIsCreateOpen,
  newRoomName,
  setNewRoomName,
  newRoomDescription,
  setNewRoomDescription,
  handleCreateRoom,
  isCreating,
  memberCount,
  onNavigate,
  toast,
}: {
  myRoom: PrivateRoom | null;
  myProfile: Profile | null | undefined;
  canCreateRoom: boolean;
  userPoints: number;
  requiredPoints: number;
  isCreateOpen: boolean;
  setIsCreateOpen: (v: boolean) => void;
  newRoomName: string;
  setNewRoomName: (v: string) => void;
  newRoomDescription: string;
  setNewRoomDescription: (v: string) => void;
  handleCreateRoom: () => void;
  isCreating: boolean;
  memberCount: number;
  onNavigate: (id: string) => void;
  toast: any;
}) {
  const { data: pendingRequests } = useQuery<any[]>({
    queryKey: ["/api/private-rooms", myRoom?.id, "requests"],
    queryFn: async () => {
      const res = await fetch(`/api/private-rooms/${myRoom!.id}/requests`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!myRoom,
  });

  const pendingCount = pendingRequests?.filter((r: any) => r.status === "pending")?.length || 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <h2 className="text-lg font-semibold text-white/80 mb-3 flex items-center gap-2">
        <Crown className="w-4 h-4 text-amber-400" />
        La Mia Stanza
      </h2>

      {myRoom ? (
        <div
          className="rounded-xl backdrop-blur-md bg-gradient-to-r from-primary/20 to-accent/20 border border-primary/30 p-4 cursor-pointer"
          onClick={() => onNavigate(myRoom.id)}
          data-testid="card-my-private-room"
        >
          <div className="flex items-start gap-4">
            <Avatar className="w-14 h-14 border-2 border-primary/50">
              <AvatarImage src={myRoom.imageUrl || myProfile?.imageUrl || "/images/profile-1.png"} />
              <AvatarFallback>{myRoom.name[0]}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h3 className="font-bold text-lg text-white truncate">{myRoom.name}</h3>
                <Badge variant="secondary" className="bg-accent/20 text-accent shrink-0">
                  <Crown className="w-3 h-3 mr-1" />
                  Proprietario
                </Badge>
              </div>
              <p className="text-sm text-white/70 mb-2 line-clamp-1">{myRoom.description || "La tua stanza privata"}</p>
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
              </div>
            </div>
            <Button size="sm" variant="outline" data-testid="button-enter-my-room">
              <MessageCircle className="w-4 h-4 mr-1" />
              Entra
            </Button>
          </div>
        </div>
      ) : (
        <div className="rounded-xl backdrop-blur-md bg-white/5 border border-white/10 p-6 text-center">
          <Lock className="w-8 h-8 text-white/30 mx-auto mb-2" />
          <p className="text-white/50 text-sm mb-3">Non hai ancora una stanza privata</p>
          <Dialog open={isCreateOpen} onOpenChange={(open) => {
            if (open && !canCreateRoom) {
              toast({
                title: "Punti insufficienti",
                description: `Servono almeno ${requiredPoints} punti per creare una stanza privata. Hai ${userPoints} punti. Completa le sfide giornaliere per guadagnare punti!`,
                variant: "destructive",
              });
              return;
            }
            setIsCreateOpen(open);
          }}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1" disabled={!canCreateRoom} data-testid="button-create-room">
                <Plus className="w-4 h-4" />
                Crea la tua Stanza ({requiredPoints} punti)
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Crea la tua Stanza Privata</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Nome Stanza</label>
                  <Input
                    value={newRoomName}
                    onChange={(e) => setNewRoomName(e.target.value)}
                    placeholder="Es. Il Mio Angolo Cosmico"
                    data-testid="input-room-name"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Descrizione</label>
                  <Textarea
                    value={newRoomDescription}
                    onChange={(e) => setNewRoomDescription(e.target.value)}
                    placeholder="Descrivi la tua stanza..."
                    className="resize-none"
                    data-testid="input-room-description"
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={handleCreateRoom}
                  disabled={isCreating}
                  data-testid="button-confirm-create-room"
                >
                  {isCreating ? "Creazione..." : "Crea Stanza"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      )}
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
        <div className="flex items-center gap-3">
          <Avatar className="w-10 h-10 border border-primary/30">
            <AvatarImage src={ownerImage || room.imageUrl || "/images/profile-1.png"} />
            <AvatarFallback>{room.name[0]}</AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
              <h3 className="font-semibold text-white truncate">{room.name}</h3>
              {isMember && !isOwner && (
                <Badge variant="secondary" className="bg-green-500/20 text-green-400 shrink-0">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Membro
                </Badge>
              )}
            </div>
            <p className="text-xs text-white/50">
              di {ownerName || "Utente"} · {memberCount} membri
            </p>
          </div>

          <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
            {isMember ? (
              <Button size="sm" variant="default" onClick={onNavigate} data-testid={`button-enter-room-${room.id}`}>
                <MessageCircle className="w-4 h-4 mr-1" />
                Entra
              </Button>
            ) : isPending ? (
              <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-400">
                <Clock className="w-3 h-3 mr-1" />
                In attesa
              </Badge>
            ) : isRejected ? (
              <Badge variant="secondary" className="bg-red-500/20 text-red-400">
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

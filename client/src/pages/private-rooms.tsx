import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Lock, Plus, Users, Crown, Bell, MessageCircle, Clock, CheckCircle, XCircle, Star } from "lucide-react";
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

function PrivateRoomSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-32 rounded-xl" />
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

  const { data: privateRooms, isLoading } = useQuery<PrivateRoom[]>({
    queryKey: ["/api/private-rooms"],
    enabled: !!user,
  });

  const createRoomMutation = useMutation({
    mutationFn: async (data: { name: string; description: string }) => {
      return await apiRequest("POST", "/api/private-rooms", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/private-rooms"] });
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
    onSuccess: (_data, roomId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/private-rooms", roomId, "my-request"] });
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
              <p className="text-sm text-white/60" data-testid="text-private-rooms-subtitle">Crea o richiedi accesso a stanze esclusive</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-300 shrink-0" data-testid="badge-user-points">
              <Star className="w-3 h-3 mr-1" />
              {userPoints}/{requiredPoints} punti
            </Badge>
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
                  Crea Stanza
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Crea Stanza Privata</DialogTitle>
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
                    disabled={createRoomMutation.isPending}
                    data-testid="button-confirm-create-room"
                  >
                    {createRoomMutation.isPending ? "Creazione..." : "Crea Stanza"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </motion.div>

      {isLoading ? (
        <PrivateRoomSkeleton />
      ) : !privateRooms?.length ? (
        <div className="text-center py-12">
          <Lock className="w-12 h-12 text-white/30 mx-auto mb-3" />
          <p className="text-white/50 text-lg">Nessuna stanza privata ancora</p>
          <p className="text-white/30 text-sm mt-1">Crea la prima stanza privata!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {privateRooms.map((room, index) => (
            <PrivateRoomCard
              key={room.id}
              room={room}
              myProfile={myProfile}
              index={index}
              onRequestAccess={() => requestAccessMutation.mutate(room.id)}
              onNavigate={() => setLocation(`/private-room/${room.id}`)}
              isRequesting={requestAccessMutation.isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PrivateRoomCard({
  room,
  myProfile,
  index,
  onRequestAccess,
  onNavigate,
  isRequesting,
}: {
  room: PrivateRoom;
  myProfile: Profile | null | undefined;
  index: number;
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

  const { data: members } = useQuery<Profile[]>({
    queryKey: ["/api/private-rooms", room.id, "members"],
    queryFn: async () => {
      const res = await fetch(`/api/private-rooms/${room.id}/members`, { credentials: "include" });
      return res.json();
    },
  });

  const { data: pendingRequests } = useQuery<any[]>({
    queryKey: ["/api/private-rooms", room.id, "requests"],
    queryFn: async () => {
      const res = await fetch(`/api/private-rooms/${room.id}/requests`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isOwner,
  });

  const pendingCount = pendingRequests?.filter((r: any) => r.status === "pending")?.length || 0;
  const isMember = isOwner || myRequest?.status === "approved";
  const isPending = myRequest?.status === "pending";
  const isRejected = myRequest?.status === "rejected";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
    >
      <div
        className="rounded-xl backdrop-blur-md bg-white/5 border border-white/10 overflow-hidden p-4 cursor-pointer"
        onClick={() => { if (isMember) onNavigate(); }}
        data-testid={`card-private-room-${room.id}`}
      >
        <div className="flex items-start gap-4">
          <Avatar className="w-12 h-12 border-2 border-primary/30">
            <AvatarImage src={room.imageUrl || "/images/profile-1.png"} />
            <AvatarFallback>{room.name[0]}</AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h3 className="font-bold text-lg truncate text-white">{room.name}</h3>
              {isOwner && (
                <Badge variant="secondary" className="bg-accent/20 text-accent shrink-0">
                  <Crown className="w-3 h-3 mr-1" />
                  Proprietario
                </Badge>
              )}
              {isMember && !isOwner && (
                <Badge variant="secondary" className="bg-green-500/20 text-green-400 shrink-0">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Membro
                </Badge>
              )}
            </div>
            <p className="text-sm text-white/70 mb-2 line-clamp-2">
              {room.description || "Stanza privata esclusiva"}
            </p>
            <div className="flex items-center gap-4 text-sm text-purple-300/80 flex-wrap">
              <span className="flex items-center gap-1" data-testid={`text-private-room-members-${room.id}`}>
                <Users className="w-4 h-4" />
                {members?.length || 0} membri
              </span>
              {isOwner && pendingCount > 0 && (
                <span className="flex items-center gap-1 text-accent" data-testid={`text-pending-requests-${room.id}`}>
                  <Bell className="w-4 h-4" />
                  {pendingCount} richieste
                </span>
              )}
            </div>
          </div>

          <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
            {isOwner ? (
              <Button size="sm" variant="outline" onClick={onNavigate} data-testid={`button-manage-room-${room.id}`}>
                <MessageCircle className="w-4 h-4 mr-1" />
                Entra
              </Button>
            ) : isMember ? (
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
                Richiedi Accesso
              </Button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

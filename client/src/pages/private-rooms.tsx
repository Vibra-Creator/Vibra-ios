import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Lock, Plus, Users, Check, X, Crown, Bell } from "lucide-react";
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
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomDescription, setNewRoomDescription] = useState("");

  const { data: myProfile } = useQuery<Profile | null>({
    queryKey: ["/api/profiles/me"],
    enabled: !!user,
  });

  const { data: privateRooms, isLoading } = useQuery<PrivateRoom[]>({
    queryKey: ["/api/private-rooms"],
    enabled: !!user,
  });

  const sampleRooms = [
    { 
      id: "1", 
      name: "Il Mio Spazio", 
      description: "Una stanza esclusiva per connessioni speciali",
      ownerId: "sample-1",
      ownerName: "Luna Stellare",
      ownerImage: "/images/profile-1.png",
      pendingRequests: 3,
      members: 5,
    },
    { 
      id: "2", 
      name: "Angolo Cosmico", 
      description: "Solo per anime affini al mio universo",
      ownerId: "sample-2",
      ownerName: "Nova Celeste",
      ownerImage: "/images/profile-2.png",
      pendingRequests: 1,
      members: 8,
    },
    { 
      id: "3", 
      name: "Rifugio Galattico", 
      description: "Un posto tranquillo lontano dal caos",
      ownerId: "sample-3",
      ownerName: "Orione",
      ownerImage: "/images/profile-3.png",
      pendingRequests: 0,
      members: 12,
    },
  ];

  const displayRooms = privateRooms?.length ? privateRooms : sampleRooms;

  const handleCreateRoom = () => {
    if (!newRoomName.trim()) {
      toast({
        title: "Errore",
        description: "Inserisci un nome per la stanza",
        variant: "destructive",
      });
      return;
    }
    toast({
      title: "Stanza creata!",
      description: `La tua stanza "${newRoomName}" è stata creata.`,
    });
    setIsCreateOpen(false);
    setNewRoomName("");
    setNewRoomDescription("");
  };

  const handleRequestAccess = (roomId: string, roomName: string) => {
    toast({
      title: "Richiesta inviata!",
      description: `Hai richiesto l'accesso a "${roomName}". Attendi l'approvazione.`,
    });
  };

  return (
    <div className="flex-1 p-4 pb-8 overflow-y-auto">
      <div className="fixed inset-0 -z-10">
        <img src="/backgrounds/vibra-app.png" alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/20 to-black/40" />
      </div>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-secondary to-primary flex items-center justify-center">
              <Lock className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white" data-testid="text-private-rooms-title">Stanze Private</h1>
              <p className="text-sm text-white/60" data-testid="text-private-rooms-subtitle">Crea o richiedi accesso a stanze esclusive</p>
            </div>
          </div>

          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1" data-testid="button-create-room">
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
                  data-testid="button-confirm-create-room"
                >
                  Crea Stanza
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </motion.div>

      {isLoading ? (
        <PrivateRoomSkeleton />
      ) : (
        <div className="space-y-4">
          {displayRooms.map((room, index) => {
            const roomData = room as any;
            const isOwner = roomData.ownerId === myProfile?.id;

            return (
              <motion.div
                key={room.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <div className="rounded-xl overflow-hidden p-4" data-testid={`card-private-room-${room.id}`}>
                  <div className="flex items-start gap-4">
                    <Avatar className="w-12 h-12 border-2 border-primary/30">
                      <AvatarImage src={roomData.ownerImage || "/images/profile-1.png"} />
                      <AvatarFallback>{room.name[0]}</AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-lg truncate text-white">{room.name}</h3>
                        {isOwner && (
                          <Badge variant="secondary" className="bg-accent/20 text-accent shrink-0">
                            <Crown className="w-3 h-3 mr-1" />
                            Proprietario
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-white/70 mb-2 line-clamp-2">
                        {room.description || "Stanza privata esclusiva"}
                      </p>
                      <div className="flex items-center gap-4 text-sm text-purple-300/80">
                        <span className="flex items-center gap-1" data-testid={`text-private-room-members-${room.id}`}>
                          <Users className="w-4 h-4" />
                          {roomData.members || 0} membri
                        </span>
                        {isOwner && roomData.pendingRequests > 0 && (
                          <span className="flex items-center gap-1 text-accent" data-testid={`text-pending-requests-${room.id}`}>
                            <Bell className="w-4 h-4" />
                            {roomData.pendingRequests} richieste
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0">
                      {isOwner ? (
                        <Button size="sm" variant="outline" data-testid={`button-manage-room-${room.id}`}>
                          Gestisci
                        </Button>
                      ) : (
                        <Button 
                          size="sm" 
                          variant="default"
                          onClick={() => handleRequestAccess(room.id, room.name)}
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
          })}
        </div>
      )}
    </div>
  );
}

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { Users, Sparkles, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import type { Room } from "@shared/schema";

const ROOM_BANNERS: Record<string, string> = {
  "1": "/images/room-banner-1.jpg",
  "2": "/images/room-banner-2.jpg",
  "3": "/images/room-banner-3.jpg",
  "4": "/images/room-banner-4.jpg",
  "5": "/images/room-banner-5.jpg",
  "6": "/images/room-banner-6.jpg",
};

function RoomSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {[1, 2, 3, 4].map((i) => (
        <Skeleton key={i} className="h-48 rounded-xl" />
      ))}
    </div>
  );
}

export default function Rooms() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();

  const { data: rooms, isLoading } = useQuery<Room[]>({
    queryKey: ["/api/rooms"],
    enabled: !!user,
  });

  const defaultRooms = [
    { id: "1", name: "Esplorazione Spaziale", interest: "Esplorazione Spaziale", description: "Per gli amanti dello spazio e delle stelle", memberCount: 42 },
    { id: "2", name: "Musica Cosmica", interest: "Musica Cosmica", description: "Condividi la tua musica preferita", memberCount: 38 },
    { id: "3", name: "Filosofia Galattica", interest: "Filosofia Galattica", description: "Discussioni profonde sull'universo", memberCount: 25 },
    { id: "4", name: "Arte Cristallina", interest: "Arte Cristallina", description: "Creatività e ispirazione artistica", memberCount: 31 },
    { id: "5", name: "Viaggi Dimensionali", interest: "Viaggi Dimensionali", description: "Avventure e viaggi cosmici", memberCount: 56 },
    { id: "6", name: "Meditazione Cosmica", interest: "Meditazione Cosmica", description: "Pace interiore e benessere", memberCount: 19 },
  ];

  const displayRooms = rooms?.length ? rooms : defaultRooms;

  return (
    <div className="flex-1 p-4 pb-8 overflow-y-auto">
      <div className="fixed inset-0 z-0">
        <img src="/backgrounds/vibra-scene.png" alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/20 to-black/40" />
      </div>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <Users className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white" data-testid="text-rooms-title">Stanze</h1>
            <p className="text-sm text-white/60" data-testid="text-rooms-subtitle">Entra in stanze basate sui tuoi interessi</p>
          </div>
        </div>
      </motion.div>

      {isLoading ? (
        <RoomSkeleton />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {displayRooms.map((room, index) => {
            const bannerUrl = ROOM_BANNERS[String(room.id)] || ROOM_BANNERS["1"];
            return (
              <motion.div
                key={room.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <div
                  className="rounded-xl overflow-hidden cursor-pointer group shadow-md hover-elevate backdrop-blur-md bg-white/5 border border-white/10"
                  onClick={() => setLocation(`/room/${room.id}`)}
                  data-testid={`card-room-${room.id}`}
                >
                  <div className="relative h-36">
                    <img
                      src={bannerUrl}
                      alt={room.name}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                    <div className="absolute bottom-3 left-3 right-3">
                      <Badge variant="secondary" className="mb-2 bg-primary/80 text-primary-foreground">
                        <Sparkles className="w-3 h-3 mr-1" />
                        {room.interest}
                      </Badge>
                      <h3 className="text-lg font-bold text-white drop-shadow-md">{room.name}</h3>
                    </div>
                  </div>
                  <div className="p-4">
                    <p className="text-sm text-white/70 mb-3">{room.description}</p>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-sm" data-testid={`text-room-members-${room.id}`}>
                        <Users className="w-4 h-4 text-cyan-400" />
                        <span className="text-cyan-400 font-medium">{(room as any).memberCount || Math.floor(Math.random() * 50 + 10)} membri</span>
                      </div>
                      <Button size="sm" variant="ghost" className="gap-1 text-white/80" data-testid={`button-enter-room-${room.id}`}>
                        Entra <ArrowRight className="w-4 h-4" />
                      </Button>
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

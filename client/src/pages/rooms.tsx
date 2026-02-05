import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { Users, Sparkles, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import type { Room } from "@shared/schema";

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
      <div className="fixed inset-0 -z-10">
        <img src="/backgrounds/vibra-dance.png" alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
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
            <h1 className="text-2xl font-bold" data-testid="text-rooms-title">Stanze</h1>
            <p className="text-sm text-muted-foreground" data-testid="text-rooms-subtitle">Entra in stanze basate sui tuoi interessi</p>
          </div>
        </div>
      </motion.div>

      {isLoading ? (
        <RoomSkeleton />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {displayRooms.map((room, index) => (
            <motion.div
              key={room.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card 
                className="overflow-hidden cursor-pointer hover-elevate group"
                onClick={() => setLocation(`/room/${room.id}`)}
                data-testid={`card-room-${room.id}`}
              >
                <div className="relative h-32">
                  <div 
                    className="absolute inset-0 bg-gradient-to-br from-primary/80 to-accent/80"
                    style={{
                      backgroundImage: `url(/backgrounds/vibra-dance.png)`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
                  <div className="absolute bottom-3 left-3 right-3">
                    <Badge variant="secondary" className="mb-2 bg-primary/80 text-primary-foreground">
                      <Sparkles className="w-3 h-3 mr-1" />
                      {room.interest}
                    </Badge>
                    <h3 className="text-lg font-bold text-white">{room.name}</h3>
                  </div>
                </div>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground mb-3">{room.description}</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm" data-testid={`text-room-members-${room.id}`}>
                      <Users className="w-4 h-4 text-primary" />
                      <span>{(room as any).memberCount || Math.floor(Math.random() * 50 + 10)} membri</span>
                    </div>
                    <Button size="sm" variant="ghost" className="gap-1 group-hover:text-primary" data-testid={`button-enter-room-${room.id}`}>
                      Entra <ArrowRight className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

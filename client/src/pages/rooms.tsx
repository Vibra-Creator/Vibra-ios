import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { Users, Sparkles, ArrowRight, ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { useGuest } from "@/hooks/use-guest";
import { useGuestBlocker } from "@/components/GuestBlocker";
import { useLanguage } from "@/i18n/LanguageContext";
import type { Room } from "@shared/schema";

const ROOM_BANNERS: Record<string, string> = {
  "1": "/images/room-banner-1.jpg",
  "2": "/images/room-banner-2.jpg",
  "3": "/images/room-banner-3.jpg",
  "4": "/images/room-banner-4.jpg",
  "5": "/images/room-banner-5.jpg",
  "6": "/images/room-banner-6.jpg",
  "7": "/images/room-amanti-gatti-banner.png",
  "8": "/images/room-caffe-amicizia-banner.png",
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
  const { isGuest } = useGuest();
  const { blockIfGuest, GuestBlockerModal } = useGuestBlocker();
  const { t } = useLanguage();

  const { data: rooms, isLoading } = useQuery<Room[]>({
    queryKey: ["/api/rooms"],
    enabled: !!user && !isGuest,
  });

  const { data: guestRooms, isLoading: guestLoading } = useQuery<Room[]>({
    queryKey: ["/api/guest/rooms"],
    enabled: isGuest,
  });

  const defaultRooms = [
    { id: "1", name: "Tecnologia Spaziale", interest: "Tecnologia Spaziale", description: "Per gli amanti dello spazio e delle stelle", memberCount: 42 },
    { id: "2", name: "Musica Cosmica", interest: "Musica Cosmica", description: "Condividi la tua musica preferita", memberCount: 38 },
    { id: "3", name: "Filosofia Galattica", interest: "Filosofia Galattica", description: "Discussioni profonde sull'universo", memberCount: 25 },
    { id: "4", name: "Arte Cristallina", interest: "Arte Cristallina", description: "Creatività e ispirazione artistica", memberCount: 31 },
    { id: "5", name: "Viaggi Dimensionali", interest: "Viaggi Dimensionali", description: "Avventure e viaggi cosmici", memberCount: 56 },
    { id: "6", name: "Meditazione Cosmica", interest: "Meditazione Cosmica", description: "Pace interiore e benessere", memberCount: 19 },
    { id: "7", name: "Amanti dei Gatti", interest: "Amanti dei Gatti", description: "Per chi ama i gatti cosmici e le loro avventure", memberCount: 33 },
    { id: "8", name: "Ti va un caffè in amicizia", interest: "Caffè in Amicizia", description: "Un caffè cosmico tra amici, senza impegno", memberCount: 27 },
  ];

  const activeRooms = isGuest ? guestRooms : rooms;
  const displayRooms = activeRooms?.length ? activeRooms : defaultRooms;
  const activeLoading = isGuest ? guestLoading : isLoading;

  return (
    <div className="flex-1 p-4 pb-8 overflow-y-auto relative z-10">
      <div className="fixed inset-0 z-0">
        <img src="/videos/vibra-stanze.gif" alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/30 to-black/50" />
      </div>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <div className="flex items-center gap-3 mb-2">
          <Button variant="ghost" size="icon" className="text-white bg-black/30 backdrop-blur-sm" onClick={() => setLocation("/")} data-testid="button-back">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <Users className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white" data-testid="text-rooms-title">{t("rooms.title")}</h1>
            <p className="text-sm text-white/60" data-testid="text-rooms-subtitle">{t("rooms.subtitle")}</p>
          </div>
        </div>
      </motion.div>

      {activeLoading ? (
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
                  onClick={() => {
                    if (blockIfGuest(t("rooms.joinAction"))) return;
                    setLocation(`/room/${room.id}`);
                  }}
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
                        <span className="text-cyan-400 font-medium">{(room as any).memberCount || Math.floor(Math.random() * 50 + 10)} {t("rooms.members")}</span>
                      </div>
                      <Button size="sm" variant="ghost" className="gap-1 text-white/80" data-testid={`button-enter-room-${room.id}`}>
                        {t("rooms.enter")} <ArrowRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
      <GuestBlockerModal />
    </div>
  );
}

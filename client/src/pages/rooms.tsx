import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { Users, Sparkles, ArrowRight, ArrowLeft, BookOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { useGuest } from "@/hooks/use-guest";
import { useGuestBlocker } from "@/components/GuestBlocker";
import { useLanguage } from "@/i18n/LanguageContext";

interface RoomCardData {
  id: string;
  name: string;
  interest: string;
  description: string | null;
  memberCount?: number;
}

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

  const { data: rooms, isLoading } = useQuery<RoomCardData[]>({
    queryKey: ["/api/rooms"],
    enabled: !!user && !isGuest,
  });

  const { data: guestRooms, isLoading: guestLoading } = useQuery<RoomCardData[]>({
    queryKey: ["/api/guest/rooms"],
    enabled: isGuest,
  });

  const defaultRooms: RoomCardData[] = [
    { id: "1", name: t("rooms.room1Name"), interest: t("rooms.room1Name"), description: t("rooms.room1Desc"), memberCount: 0 },
    { id: "2", name: t("rooms.room2Name"), interest: t("rooms.room2Name"), description: t("rooms.room2Desc"), memberCount: 0 },
    { id: "5", name: t("rooms.room5Name"), interest: t("rooms.room5Name"), description: t("rooms.room5Desc"), memberCount: 0 },
    { id: "6", name: t("rooms.room6Name"), interest: t("rooms.room6Name"), description: t("rooms.room6Desc"), memberCount: 0 },
    { id: "7", name: t("rooms.room7Name"), interest: t("rooms.room7Name"), description: t("rooms.room7Desc"), memberCount: 0 },
    { id: "8", name: t("rooms.room8Name"), interest: t("rooms.room8Name"), description: t("rooms.room8Desc"), memberCount: 0 },
  ];

  const roomItNames = [
    "Tecnologia Spaziale", "Musica Cosmica",
    "Viaggi Dimensionali", "Meditazione Cosmica", "Amanti dei Gatti", "Ti va un caffè in amicizia",
  ];

  const roomKeyMap = [1, 2, 5, 6, 7, 8];

  const translateRooms = (items: RoomCardData[]): RoomCardData[] => {
    const translationMap: Record<string, { name: string; description: string | null }> = {};
    roomItNames.forEach((itName, i) => {
      const key = roomKeyMap[i];
      translationMap[itName] = { name: t(`rooms.room${key}Name`), description: t(`rooms.room${key}Desc`) };
    });
    return items.map(room => {
      const mapped = translationMap[room.name];
      return mapped ? { ...room, name: mapped.name, description: mapped.description } : room;
    });
  };

  const activeRooms = isGuest ? guestRooms : rooms;
  const rawRooms = activeRooms?.length ? activeRooms : defaultRooms;
  const displayRooms = translateRooms(rawRooms);
  const activeLoading = isGuest ? guestLoading : isLoading;

  return (
    <div className="flex-1 p-4 pb-8 overflow-y-auto relative z-10">
      <div className="fixed inset-0 z-0">
        <img src="/videos/vibra-stanze.gif" alt="" className="w-full h-full object-cover" loading="lazy" />
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

      {/* VibraStory banner */}
      {!isGuest && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mb-5 rounded-2xl overflow-hidden cursor-pointer bg-gradient-to-r from-violet-600/25 to-pink-600/20 border border-violet-500/30 backdrop-blur-md hover:from-violet-600/35 hover:to-pink-600/30 transition-all"
          onClick={() => setLocation("/stories")}
          data-testid="banner-vibrastory"
        >
          <div className="flex items-center gap-4 p-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center flex-shrink-0">
              <BookOpen className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-white font-bold">VibraStory</span>
                <span className="text-xs bg-violet-500/30 text-violet-300 px-2 py-0.5 rounded-full">Nuovo</span>
              </div>
              <p className="text-white/60 text-sm truncate">Scrivi la storia collettiva della community</p>
            </div>
            <ArrowRight className="w-5 h-5 text-violet-400 flex-shrink-0" />
          </div>
        </motion.div>
      )}

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
                        {(() => {
            const count = room.memberCount ?? 0;
                          if (count === 0) {
                            return (
                              <Badge variant="secondary" className="bg-amber-500/20 text-amber-300 border-amber-500/30" data-testid={`badge-room-empty-${room.id}`}>
                                <Sparkles className="w-3 h-3 mr-1" />
                                {t("rooms.activeBeFirst")}
                              </Badge>
                            );
                          }
                          return (
                            <motion.div
                              className="flex items-center gap-1.5"
                              animate={count > 3 ? { scale: [1, 1.05, 1] } : undefined}
                              transition={count > 3 ? { duration: 2, repeat: Infinity, ease: "easeInOut" } : undefined}
                            >
                              <span className="relative flex h-2.5 w-2.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
                              </span>
                              <span className="text-green-400 font-medium" data-testid={`text-room-active-count-${room.id}`}>
                                {count} {t("rooms.activeNow")}
                              </span>
                            </motion.div>
                          );
                        })()}
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

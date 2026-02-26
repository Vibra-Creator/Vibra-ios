import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Lock, Plus, Users, Crown, Bell, MessageCircle, Clock, CheckCircle, XCircle, Star, Search, Sparkles, Heart, ArrowLeft } from "lucide-react";
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
import { useLanguage } from "@/i18n/LanguageContext";
import type { PrivateRoom, Profile } from "@shared/schema";

interface CategorizedRooms {
  myRooms: PrivateRoom[];
  matchRooms: PrivateRoom[];
  popularRooms: PrivateRoom[];
  memberCounts: Record<string, number>;
  ownerProfiles: Record<string, { name: string; imageUrl: string | null }>;
  pendingCounts: Record<string, number>;
  recentRequesters: Record<string, Array<{ name: string; imageUrl: string | null; status: string }>>;
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
  const { t } = useLanguage();
  const [, setLocation] = useLocation();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomDescription, setNewRoomDescription] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
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
      toast({ title: t("privateRooms.roomCreated"), description: t("privateRooms.roomCreatedDesc") });
      setIsCreateOpen(false);
      setNewRoomName("");
      setNewRoomDescription("");
    },
    onError: (error: any) => {
      let msg = t("privateRooms.createError");
      try {
        const raw = error?.message || "";
        const jsonPart = raw.substring(raw.indexOf("{"));
        const parsed = JSON.parse(jsonPart);
        if (parsed.error) msg = parsed.error;
      } catch {}
      toast({ title: t("common.error"), description: msg, variant: "destructive" });
    },
  });

  const requestAccessMutation = useMutation({
    mutationFn: async (roomId: string) => {
      return await apiRequest("POST", `/api/private-rooms/${roomId}/request`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/private-rooms/categorized"] });
      toast({ title: t("privateRooms.requestSent"), description: t("privateRooms.requestSentDesc") });
    },
    onError: (error: any) => {
      const msg = error?.message || t("privateRooms.requestError");
      toast({ title: t("common.error"), description: msg, variant: "destructive" });
    },
  });

  const handleCreateRoom = () => {
    if (blockIfGuest(t("privateRooms.guestAction"))) return;
    const roomName = newRoomName.trim() || t("privateRooms.create");
    createRoomMutation.mutate({ name: roomName, description: newRoomDescription.trim() });
  };

  const hasMyRoom = (categorized?.myRooms?.length || 0) > 0;

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
              <h1 className="text-2xl font-bold text-white" data-testid="text-private-rooms-title">{t("privateRooms.title")}</h1>
              <p className="text-sm text-white/60" data-testid="text-private-rooms-subtitle">{t("privateRooms.subtitle")}</p>
            </div>
          </div>

          {null}
        </div>

        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <Input
              placeholder={t("privateRooms.search")}
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
                  {t("privateRooms.createBtn")}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("privateRooms.create")}</DialogTitle>
                </DialogHeader>
                {!canCreateRoom ? (
                  <div className="space-y-4 pt-4 text-center">
                    <div className="w-16 h-16 rounded-full bg-yellow-500/20 flex items-center justify-center mx-auto">
                      <Star className="w-8 h-8 text-yellow-400" />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {t("privateRooms.pointsNeeded")}
                      <br />{t("privateRooms.youHavePoints")} <strong>{userPoints} {t("privateRooms.points")}</strong>.
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t("privateRooms.completeChallenges")}
                    </p>
                    <Button variant="outline" className="w-full" onClick={() => setIsCreateOpen(false)} data-testid="button-close-dialog-top">
                      {t("privateRooms.understood")}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4 pt-4">
                    <div className="rounded-lg bg-primary/10 border border-primary/20 p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <Lock className="w-4 h-4 text-primary" />
                        <span className="text-sm font-semibold text-primary">{t("privateRooms.subjectToApproval")}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {t("privateRooms.approvalDesc")}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">{t("privateRooms.roomName")}</label>
                      <Input
                        value={newRoomName}
                        onChange={(e) => setNewRoomName(e.target.value)}
                        placeholder={t("privateRooms.create")}
                        data-testid="input-room-name-top"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">{t("privateRooms.description")}</label>
                      <Textarea
                        value={newRoomDescription}
                        onChange={(e) => setNewRoomDescription(e.target.value)}
                        placeholder={t("privateRooms.descriptionPlaceholder")}
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
                      {createRoomMutation.isPending ? t("privateRooms.creating") : `${t("privateRooms.createRoomPoints")} (${requiredPoints} ${t("privateRooms.points")})`}
                    </Button>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          )}
        </div>
      </motion.div>

      <div className="relative z-10">
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
                    onClick={() => blockIfGuest(t("privateRooms.guestAction"))}
                    data-testid={`card-private-room-${room.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="w-10 h-10 border border-primary/30">
                        <AvatarImage src={room.imageUrl || "/images/avatar-1.png"} />
                        <AvatarFallback>{room.name[0]}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-white truncate">{room.name}</h3>
                        <p className="text-xs text-white/50">{room.description || t("privateRooms.privateRoom")}</p>
                      </div>
                      <Button
                        size="sm"
                        variant="default"
                        onClick={(e) => {
                          e.stopPropagation();
                          blockIfGuest(t("privateRooms.guestAction"));
                        }}
                        data-testid={`button-request-access-guest-${room.id}`}
                      >
                        {t("privateRooms.request")}
                      </Button>
                    </div>
                  </div>
                </motion.div>
              ))}
              {(!guestPrivateRooms || guestPrivateRooms.length === 0) && (
                <div className="text-center py-12">
                  <Lock className="w-12 h-12 text-white/30 mx-auto mb-3" />
                  <p className="text-white/50 text-lg">{t("privateRooms.noRoomsYet")}</p>
                </div>
              )}
            </div>
          </div>
        ) : searchQuery.trim() ? (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-white/80 flex items-center gap-2">
              <Search className="w-4 h-4" />
              {t("privateRooms.searchResults")}
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
                  recentMembers={categorized?.recentRequesters[room.id] || []}
                  pendingCount={categorized?.pendingCounts[room.id] || 0}
                  onRequestAccess={() => requestAccessMutation.mutate(room.id)}
                  onNavigate={() => setLocation(`/private-room/${room.id}`)}
                  isRequesting={requestAccessMutation.isPending}
                />
              ))
            ) : (
              <p className="text-white/40 text-center py-8">{t("privateRooms.noRoomsFound")}</p>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {!hasMyRoom && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div
                  className="rounded-xl backdrop-blur-md bg-gradient-to-r from-primary/20 via-purple-500/20 to-accent/20 border border-primary/30 p-5"
                  data-testid="card-cta-create-room"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center shrink-0">
                      <MessageCircle className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-lg">{t("privateRooms.create")}</h3>
                      <Badge variant="secondary" className="bg-primary/20 text-primary text-[10px] mt-1">
                        <Lock className="w-3 h-3 mr-0.5" />
                        {t("privateRooms.subjectToApproval")}
                      </Badge>
                    </div>
                  </div>

                  <div className="space-y-2 mb-4">
                    <p className="text-sm text-white/70">
                      {t("privateRooms.ctaDesc")}
                    </p>
                    <div className="space-y-1.5 text-xs text-white/50">
                      <div className="flex items-start gap-2">
                        <span className="text-primary font-bold mt-0.5">1.</span>
                        <span>{t("privateRooms.step1")}</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-primary font-bold mt-0.5">2.</span>
                        <span>{t("privateRooms.step2")}</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-primary font-bold mt-0.5">3.</span>
                        <span>{t("privateRooms.step3")}</span>
                      </div>
                    </div>
                  </div>

                  <Button
                    className="w-full"
                    onClick={() => {
                      if (blockIfGuest(t("privateRooms.guestCreateAction"))) return;
                      setIsCreateOpen(true);
                    }}
                    data-testid="button-cta-create-room"
                  >
                    <Plus className="w-4 h-4 mr-1.5" />
                    {canCreateRoom ? `${t("privateRooms.createYourRoom")} (${requiredPoints} ${t("privateRooms.points")})` : `${t("privateRooms.needPoints")} ${requiredPoints} ${t("privateRooms.points")}`}
                  </Button>
                </div>
              </motion.div>
            )}

            {(categorized?.myRooms?.length || 0) > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <h2 className="text-lg font-semibold text-white/80 mb-3 flex items-center gap-2">
                  <Crown className="w-4 h-4 text-amber-400" />
                  {t("privateRooms.myRooms")}
                </h2>
                <div className="space-y-3">
                  {categorized!.myRooms.map((room, index) => (
                    <MyRoomCard
                      key={room.id}
                      room={room}
                      myProfile={myProfile}
                      index={index}
                      memberCount={categorized?.memberCounts[room.id] || 0}
                      recentMembers={categorized?.recentRequesters[room.id] || []}
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
                  {t("privateRooms.matchRooms")}
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
                      recentMembers={categorized?.recentRequesters[room.id] || []}
                      pendingCount={categorized?.pendingCounts[room.id] || 0}
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
                  {t("privateRooms.popular")}
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
                      recentMembers={categorized?.recentRequesters[room.id] || []}
                      pendingCount={categorized?.pendingCounts[room.id] || 0}
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
                <p className="text-white/50 text-lg">{t("privateRooms.noRoomsYet")}</p>
                <p className="text-white/30 text-sm mt-1">{t("privateRooms.useButtonAbove")}</p>
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
  recentMembers,
  onNavigate,
}: {
  room: PrivateRoom;
  myProfile: Profile | null | undefined;
  index: number;
  memberCount: number;
  recentMembers?: Array<{ name: string; imageUrl: string | null; status: string }>;
  onNavigate: () => void;
}) {
  const { t } = useLanguage();
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    if (!room.expiresAt) return;
    const update = () => {
      const diff = new Date(room.expiresAt!).getTime() - Date.now();
      if (diff <= 0) { setTimeLeft(t("privateRooms.expired")); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      setTimeLeft(`${h}h ${m}m`);
    };
    update();
    const interval = setInterval(update, 60000);
    return () => clearInterval(interval);
  }, [room.expiresAt, t]);

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
            <AvatarImage src={myProfile?.imageUrl || "/images/avatar-1.png"} />
            <AvatarFallback>{room.name[0]}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h3 className="font-bold text-white truncate">{room.name}</h3>
              <Badge variant="secondary" className="bg-accent/20 text-accent shrink-0">
                <Crown className="w-3 h-3 mr-1" />
                {t("privateRooms.owner")}
              </Badge>
            </div>
            <p className="text-sm text-white/70 mb-2 line-clamp-1">{room.description || t("privateRooms.yourRoom")}</p>
            {recentMembers && recentMembers.length > 0 && (
              <div className="flex items-center gap-1.5 mb-2">
                <div className="flex -space-x-1.5">
                  {recentMembers.slice(0, 4).map((m, i) => (
                    <Avatar key={i} className="w-6 h-6 border border-primary/30">
                      <AvatarImage src={m.imageUrl || "/images/avatar-1.png"} />
                      <AvatarFallback className="text-[8px]">{m.name[0]}</AvatarFallback>
                    </Avatar>
                  ))}
                </div>
                <span className="text-[10px] text-white/40">
                  {recentMembers.length > 4 ? `+${recentMembers.length - 4} ${t("privateRooms.othersMore")}` : t("privateRooms.participating")}
                </span>
              </div>
            )}
            <div className="flex items-center gap-4 text-sm text-purple-300/80 flex-wrap">
              <span className="flex items-center gap-1">
                <Users className="w-4 h-4" />
                {memberCount} {t("privateRooms.members")}
              </span>
              {pendingCount > 0 && (
                <span className="flex items-center gap-1 text-accent">
                  <Bell className="w-4 h-4" />
                  {pendingCount} {t("privateRooms.requests")}
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
            {t("privateRooms.enter")}
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
  recentMembers,
  pendingCount,
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
  recentMembers?: Array<{ name: string; imageUrl: string | null; status: string }>;
  pendingCount?: number;
  onRequestAccess: () => void;
  onNavigate: () => void;
  isRequesting: boolean;
}) {
  const { t } = useLanguage();
  const isOwner = myProfile?.id === room.ownerId;

  const [timeLeft, setTimeLeft] = useState("");
  useEffect(() => {
    if (!room.expiresAt) return;
    const update = () => {
      const diff = new Date(room.expiresAt!).getTime() - Date.now();
      if (diff <= 0) { setTimeLeft(t("privateRooms.expired")); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      setTimeLeft(`${h}h ${m}m`);
    };
    update();
    const interval = setInterval(update, 60000);
    return () => clearInterval(interval);
  }, [room.expiresAt, t]);

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
            <AvatarImage src={ownerImage || room.imageUrl || "/images/avatar-1.png"} />
            <AvatarFallback>{room.name[0]}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-white truncate">{room.name}</h3>
              <Badge variant="secondary" className="bg-primary/20 text-primary shrink-0 text-[10px]">
                <Lock className="w-3 h-3 mr-0.5" />
                {t("privateRooms.approval")}
              </Badge>
            </div>
            <p className="text-xs text-white/50 flex items-center gap-1 flex-wrap">
              <span>{ownerName || t("privateRooms.unknown")}</span>
              <span className="text-white/30">·</span>
              <Users className="w-3 h-3" />
              <span>{memberCount}</span>
              {(pendingCount || 0) > 0 && (
                <>
                  <span className="text-white/30">·</span>
                  <Bell className="w-3 h-3 text-pink-400" />
                  <span className="text-pink-400">{pendingCount}</span>
                </>
              )}
              {timeLeft && (
                <span className="flex items-center gap-0.5 text-yellow-300/60">
                  · {timeLeft}
                </span>
              )}
            </p>
            {recentMembers && recentMembers.length > 0 && (
              <div className="flex items-center gap-1.5 mt-1.5">
                <div className="flex -space-x-1.5">
                  {recentMembers.slice(0, 3).map((m, i) => (
                    <Avatar key={i} className="w-5 h-5 border border-white/20">
                      <AvatarImage src={m.imageUrl || "/images/avatar-1.png"} />
                      <AvatarFallback className="text-[8px]">{m.name[0]}</AvatarFallback>
                    </Avatar>
                  ))}
                </div>
                <span className="text-[10px] text-white/40">{recentMembers.length > 3 ? `+${recentMembers.length - 3} ${t("privateRooms.othersMore")}` : ""}</span>
              </div>
            )}
          </div>

          <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
            {isMember ? (
              <Button size="sm" variant="outline" onClick={onNavigate} data-testid={`button-enter-room-${room.id}`}>
                <MessageCircle className="w-4 h-4 mr-1" />
                {t("privateRooms.enter")}
              </Button>
            ) : isPending ? (
              <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-300">
                <Clock className="w-3 h-3 mr-1" />
                {t("privateRooms.pending")}
              </Badge>
            ) : isRejected ? (
              <Badge variant="secondary" className="bg-red-500/20 text-red-300">
                <XCircle className="w-3 h-3 mr-1" />
                {t("privateRooms.rejected")}
              </Badge>
            ) : (
              <Button
                size="sm"
                variant="default"
                onClick={onRequestAccess}
                disabled={isRequesting}
                data-testid={`button-request-access-${room.id}`}
              >
                {t("privateRooms.request")}
              </Button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

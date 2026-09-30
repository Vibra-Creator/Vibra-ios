import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Send, Users, Trash2, Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useLocation, useParams } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Room, RoomMessage } from "@shared/schema";

const ROOM_BACKGROUNDS: Record<string, { type: "image"; src: string } | { type: "video"; src: string }> = {
  "1": { type: "image", src: "/images/room-tecnologia-spaziale.png" },
  "2": { type: "image", src: "/images/room-musica-cosmica.png" },
  "5": { type: "image", src: "/images/room-viaggi-dimensionali.png" },
  "6": { type: "image", src: "/images/room-meditazione-cosmica.png" },
  "7": { type: "image", src: "/images/room-amanti-gatti.png" },
  "8": { type: "image", src: "/images/room-caffe-amicizia.png" },
};

const DEFAULT_BG = { type: "video" as const, src: "/backgrounds/6ae793b4126a4617a0c715db39223f26.mp4_1770326642075.MP4" };

export default function RoomDetail() {
  const params = useParams<{ roomId: string }>();
  const roomId = params.roomId;
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [messageText, setMessageText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [optimisticMessages, setOptimisticMessages] = useState<RoomMessage[]>([]);
  const [selectedMsgId, setSelectedMsgId] = useState<string | null>(null);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);

  const { data: room } = useQuery<Room>({
    queryKey: ["/api/rooms", roomId],
    enabled: !!roomId,
  });

  const { data: serverMessages, isLoading } = useQuery<RoomMessage[]>({
    queryKey: ["/api/rooms", roomId, "messages"],
    enabled: !!roomId,
    refetchInterval: 3000,
  });

  const messages = (() => {
    const server = (serverMessages || []).filter(m => !deletingIds.has(m.id));
    if (optimisticMessages.length === 0) return server;
    const serverIds = new Set(server.map(m => m.id));
    const pending = optimisticMessages.filter(m => !serverIds.has(m.id));
    return [...server, ...pending];
  })();

  const { data: myProfile } = useQuery<any>({
    queryKey: ["/api/profiles/me"],
    enabled: !!user,
  });

  const joinMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/rooms/${roomId}/join`),
  });

  const sendMessage = useMutation({
    mutationFn: async ({ content, tempId }: { content: string; tempId: string }) =>
      apiRequest("POST", `/api/rooms/${roomId}/messages`, { content }),
    onMutate: async ({ content, tempId }) => {
      if (!myProfile) return;
      const optimisticMsg: RoomMessage = {
        id: tempId,
        roomId: roomId!,
        senderId: myProfile.id,
        senderName: myProfile.name,
        senderImage: myProfile.imageUrl || null,
        content,
        createdAt: new Date(),
      };
      setOptimisticMessages(prev => [...prev, optimisticMsg]);
      setMessageText("");
    },
    onError: (_err, { tempId }) => {
      setOptimisticMessages(prev => prev.filter(m => m.id !== tempId));
    },
    onSuccess: (data, { tempId }) => {
      const serverMsg = data as RoomMessage;
      queryClient.setQueryData(
        ["/api/rooms", roomId, "messages"],
        (old: RoomMessage[] | undefined) => {
          if (!old) return [serverMsg];
          const exists = old.some(m => m.id === serverMsg.id);
          if (exists) return old;
          return [...old, serverMsg];
        }
      );
      setOptimisticMessages(prev => prev.filter(m => m.id !== tempId));
      queryClient.invalidateQueries({ queryKey: ["/api/rooms", roomId, "messages"] });
    },
  });

  const deleteMessage = useMutation({
    mutationFn: (msgId: string) => apiRequest("DELETE", `/api/rooms/${roomId}/messages/${msgId}`),
    onMutate: (msgId) => {
      setDeletingIds(prev => new Set(prev).add(msgId));
      setSelectedMsgId(null);
    },
    onSuccess: (_, msgId) => {
      queryClient.setQueryData(
        ["/api/rooms", roomId, "messages"],
        (old: RoomMessage[] | undefined) => old?.filter(m => m.id !== msgId) ?? []
      );
      setDeletingIds(prev => { const s = new Set(prev); s.delete(msgId); return s; });
    },
    onError: (_, msgId) => {
      setDeletingIds(prev => { const s = new Set(prev); s.delete(msgId); return s; });
      toast({ title: "Errore", description: "Impossibile cancellare il messaggio", variant: "destructive" });
    },
  });

  const reportMessage = useMutation({
    mutationFn: (msg: RoomMessage) => apiRequest("POST", "/api/reports", {
      reportedId: msg.senderId,
      reason: "Contenuto inappropriato",
      reportedContentType: "room_message",
      reportedContentId: msg.id,
    }),
    onSuccess: () => {
      toast({ title: "Segnalazione inviata", description: "Il team di moderazione la esaminerà entro 24 ore." });
    },
    onError: () => {
      toast({ title: "Errore", description: "Impossibile inviare la segnalazione", variant: "destructive" });
    },
  });

  useEffect(() => {
    if (roomId && myProfile) {
      joinMutation.mutate();
    }
  }, [roomId, myProfile?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Dismiss menu when clicking outside
  useEffect(() => {
    if (!selectedMsgId) return;
    const handler = () => setSelectedMsgId(null);
    document.addEventListener("click", handler, { capture: true });
    return () => document.removeEventListener("click", handler, { capture: true });
  }, [selectedMsgId]);

  const handleSend = () => {
    if (messageText.trim() && myProfile) {
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      sendMessage.mutate({ content: messageText.trim(), tempId });
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handlePressStart = useCallback((msgId: string, isMe: boolean) => {
    if (!isMe) return;
    longPressTimerRef.current = setTimeout(() => {
      setSelectedMsgId(msgId);
    }, 450);
  }, []);

  const handlePressEnd = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const formatTime = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="flex flex-col h-full relative z-10">
      <div className="fixed inset-0 z-0">
        {(() => {
          const bg = ROOM_BACKGROUNDS[roomId || ""] || DEFAULT_BG;
          return bg.type === "image" ? (
            <img src={bg.src} alt="" className="absolute inset-0 w-full h-full object-cover object-center" />
          ) : (
            <video autoPlay loop muted playsInline className="w-full h-full object-cover">
              <source src={bg.src} type="video/mp4" />
            </video>
          );
        })()}
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/25 to-black/50" />
      </div>

      <header className="flex items-center gap-3 p-4 bg-black/30 backdrop-blur-md border-b border-white/10">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setLocation("/rooms")}
          data-testid="button-back-rooms"
        >
          <ArrowLeft className="w-5 h-5 text-white" />
        </Button>

        <div className="flex items-center gap-3 flex-1">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <Users className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="font-semibold text-white" data-testid="text-room-name">{room?.name || "Stanza"}</h2>
            <p className="text-xs text-white/60">{room?.interest}</p>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 relative z-20">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
        ) : !messages?.length ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-20 h-20 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center mb-4">
              <Send className="w-10 h-10 text-white/40" />
            </div>
            <h3 className="text-lg font-medium text-white mb-2">
              Nessun messaggio ancora
            </h3>
            <p className="text-sm text-white/50 max-w-xs">
              Sii il primo a scrivere in questa stanza!
            </p>
          </div>
        ) : (
          <AnimatePresence>
            {messages.map((msg, index) => {
              const isMe = msg.senderId === myProfile?.id;
              const isSelected = selectedMsgId === msg.id;
              const isDeleting = deletingIds.has(msg.id);
              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: isDeleting ? 0 : 1, scale: isDeleting ? 0.85 : 1 }}
                  exit={{ opacity: 0, scale: 0.85, y: -5 }}
                  transition={{ delay: isDeleting ? 0 : index * 0.02 }}
                  className={`flex gap-3 ${isMe ? "flex-row-reverse" : "flex-row"}`}
                  data-testid={`room-message-${msg.id}`}
                >
                  {!isMe && (
                    <Avatar className="w-10 h-10 flex-shrink-0 ring-2 ring-white/20">
                      <AvatarImage src={msg.senderImage || undefined} />
                      <AvatarFallback className="bg-primary/30 text-white text-sm">{msg.senderName?.[0] || "?"}</AvatarFallback>
                    </Avatar>
                  )}
                  {isMe && (
                    <Avatar className="w-10 h-10 flex-shrink-0 ring-2 ring-primary/30">
                      <AvatarImage src={myProfile?.imageUrl || undefined} />
                      <AvatarFallback className="bg-accent/30 text-white text-sm">{myProfile?.name?.[0] || "?"}</AvatarFallback>
                    </Avatar>
                  )}
                  <div className={`flex flex-col max-w-[70%] ${isMe ? "items-end" : "items-start"} relative`}>
                    <p className={`text-sm mb-1 font-semibold ${isMe ? "text-white/70" : "text-cyan-300"}`}>
                      {isMe ? "Tu" : msg.senderName}
                    </p>

                    {/* Delete popup — shown above the bubble when selected */}
                    <AnimatePresence>
                      {isSelected && isMe && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.85, y: 6 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.85, y: 6 }}
                          className="absolute -top-10 right-0 z-30"
                          onClick={e => e.stopPropagation()}
                          data-testid={`delete-popup-${msg.id}`}
                        >
                          <button
                            onClick={() => deleteMessage.mutate(msg.id)}
                            className="flex items-center gap-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-semibold px-3 py-1.5 rounded-full shadow-lg transition-colors"
                            data-testid={`button-delete-message-${msg.id}`}
                          >
                            <Trash2 className="w-3 h-3" />
                            Elimina
                          </button>
                          {/* Little arrow pointing down */}
                          <div className="w-2 h-2 bg-red-600 rotate-45 absolute -bottom-1 right-4" />
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <div
                      className={`px-4 py-2.5 rounded-2xl select-none transition-opacity ${
                        isMe
                          ? "bg-gradient-to-r from-primary to-accent text-white rounded-br-md"
                          : "bg-white/15 backdrop-blur-sm text-white rounded-bl-md"
                      } ${isSelected ? "opacity-80" : "opacity-100"}`}
                      onMouseDown={() => handlePressStart(msg.id, isMe)}
                      onMouseUp={handlePressEnd}
                      onMouseLeave={handlePressEnd}
                      onTouchStart={() => handlePressStart(msg.id, isMe)}
                      onTouchEnd={handlePressEnd}
                      onTouchCancel={handlePressEnd}
                      onContextMenu={e => { if (isMe) { e.preventDefault(); setSelectedMsgId(msg.id); } }}
                    >
                      <p className="text-[15px] break-words leading-relaxed">{msg.content}</p>
                      <span className={`text-xs block mt-1 ${isMe ? "text-white/60 text-right" : "text-white/40"}`}>
                        {formatTime(msg.createdAt)}
                      </span>
                    </div>
                    {!isMe && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 mt-1 text-white/60 hover:text-white"
                        onClick={() => reportMessage.mutate(msg)}
                        disabled={reportMessage.isPending}
                        aria-label={`Segnala il messaggio di ${msg.senderName || "questo utente"}`}
                        data-testid={`button-report-room-message-${msg.id}`}
                      >
                        <Flag className="w-3 h-3 mr-1" />
                        Segnala
                      </Button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 bg-black/30 backdrop-blur-md border-t border-white/10 relative z-20">
        <div className="flex items-center gap-2">
          <Input
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Scrivi un messaggio..."
            className="flex-1 bg-white/10 backdrop-blur-sm border-white/20 text-white placeholder:text-white/60"
            disabled={sendMessage.isPending}
            data-testid="input-room-message"
          />
          <Button
            onClick={handleSend}
            disabled={!messageText.trim() || sendMessage.isPending}
            className="bg-gradient-to-r from-primary to-accent"
            size="icon"
            data-testid="button-send-room-message"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
        {selectedMsgId && (
          <p className="text-center text-white/40 text-[10px] mt-1">Tieni premuto per cancellare un messaggio</p>
        )}
      </div>
    </div>
  );
}

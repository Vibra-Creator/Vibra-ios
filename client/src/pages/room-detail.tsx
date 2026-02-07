import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Send, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useLocation, useParams } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Room, RoomMessage } from "@shared/schema";

export default function RoomDetail() {
  const params = useParams<{ roomId: string }>();
  const roomId = params.roomId;
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [messageText, setMessageText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: room } = useQuery<Room>({
    queryKey: ["/api/rooms", roomId],
    enabled: !!roomId,
  });

  const { data: messages, isLoading } = useQuery<RoomMessage[]>({
    queryKey: ["/api/rooms", roomId, "messages"],
    enabled: !!roomId,
    refetchInterval: 3000,
  });

  const { data: myProfile } = useQuery<any>({
    queryKey: ["/api/profiles/me"],
    enabled: !!user,
  });

  const joinMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/rooms/${roomId}/join`),
  });

  const sendMessage = useMutation({
    mutationFn: (content: string) =>
      apiRequest("POST", `/api/rooms/${roomId}/messages`, { content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rooms", roomId, "messages"] });
      setMessageText("");
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

  const handleSend = () => {
    if (messageText.trim()) {
      sendMessage.mutate(messageText.trim());
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="fixed inset-0 -z-10">
        <video autoPlay loop muted playsInline className="w-full h-full object-cover">
          <source src="/backgrounds/6ae793b4126a4617a0c715db39223f26.mp4_1770326642075.MP4" type="video/mp4" />
        </video>
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

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
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
              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.02 }}
                  className={`flex gap-2 ${isMe ? "flex-row-reverse" : "flex-row"}`}
                  data-testid={`room-message-${msg.id}`}
                >
                  {!isMe && (
                    <Avatar className="w-8 h-8 flex-shrink-0">
                      <AvatarImage src={msg.senderImage || undefined} />
                      <AvatarFallback className="bg-primary/30 text-white text-xs">{msg.senderName[0]}</AvatarFallback>
                    </Avatar>
                  )}
                  <div className={`max-w-[75%] ${isMe ? "items-end" : "items-start"}`}>
                    {!isMe && (
                      <p className="text-xs text-cyan-300/80 mb-1 font-medium">{msg.senderName}</p>
                    )}
                    <div
                      className={`px-4 py-2 rounded-2xl ${
                        isMe
                          ? "bg-gradient-to-r from-primary to-accent text-white rounded-br-md"
                          : "bg-white/15 backdrop-blur-sm text-white rounded-bl-md"
                      }`}
                    >
                      <p className="text-sm break-words">{msg.content}</p>
                      <span className={`text-xs block mt-1 ${isMe ? "text-white/60 text-right" : "text-white/40"}`}>
                        {formatTime(msg.createdAt)}
                      </span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 bg-black/30 backdrop-blur-md border-t border-white/10">
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
      </div>
    </div>
  );
}

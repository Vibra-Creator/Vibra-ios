import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Send, Users, Crown, Check, X, Clock, Lock, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useLocation, useParams } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { PrivateRoom, Profile, PrivateRoomMessage } from "@shared/schema";

export default function PrivateRoomDetail() {
  const params = useParams<{ roomId: string }>();
  const roomId = params.roomId;
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [messageText, setMessageText] = useState("");
  const [showRequests, setShowRequests] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: myProfile } = useQuery<Profile | null>({
    queryKey: ["/api/profiles/me"],
    enabled: !!user,
  });

  const { data: room } = useQuery<PrivateRoom>({
    queryKey: ["/api/private-rooms", roomId],
    queryFn: async () => {
      const res = await fetch(`/api/private-rooms/${roomId}`, { credentials: "include" });
      return res.json();
    },
    enabled: !!roomId,
  });

  const isOwner = myProfile?.id === room?.ownerId;

  const { data: messages, isLoading: messagesLoading } = useQuery<PrivateRoomMessage[]>({
    queryKey: ["/api/private-rooms", roomId, "messages"],
    queryFn: async () => {
      const res = await fetch(`/api/private-rooms/${roomId}/messages`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!roomId && !!myProfile,
    refetchInterval: 3000,
  });

  const { data: members } = useQuery<Profile[]>({
    queryKey: ["/api/private-rooms", roomId, "members"],
    queryFn: async () => {
      const res = await fetch(`/api/private-rooms/${roomId}/members`, { credentials: "include" });
      return res.json();
    },
    enabled: !!roomId,
  });

  const { data: pendingRequests } = useQuery<any[]>({
    queryKey: ["/api/private-rooms", roomId, "requests"],
    queryFn: async () => {
      const res = await fetch(`/api/private-rooms/${roomId}/requests`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isOwner,
    refetchInterval: 10000,
  });

  const sendMessage = useMutation({
    mutationFn: async (content: string) => {
      return await apiRequest("POST", `/api/private-rooms/${roomId}/messages`, { content });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/private-rooms", roomId, "messages"] });
      setMessageText("");
    },
  });

  const respondMutation = useMutation({
    mutationFn: async ({ requestId, status }: { requestId: string; status: "approved" | "rejected" }) => {
      return await apiRequest("POST", `/api/private-rooms/requests/${requestId}/respond`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/private-rooms", roomId, "requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/private-rooms", roomId, "members"] });
      toast({ title: "Fatto!", description: "Richiesta gestita con successo." });
    },
  });

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

  const pendingOnly = pendingRequests?.filter((r: any) => r.status === "pending") || [];

  return (
    <div className="flex flex-col h-full">
      <div className="fixed inset-0 -z-10">
        <img src="/images/private-rooms-bg.gif" alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/30 to-black/60" />
      </div>

      <header className="flex items-center gap-3 p-4 bg-black/30 backdrop-blur-md border-b border-white/10 z-10">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setLocation("/private-rooms")}
          data-testid="button-back-private-rooms"
        >
          <ArrowLeft className="w-5 h-5 text-white" />
        </Button>

        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-secondary to-primary flex items-center justify-center shrink-0">
            <Lock className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <h2 className="font-semibold text-white truncate" data-testid="text-private-room-name">
              {room?.name || "Stanza Privata"}
            </h2>
            <p className="text-xs text-white/60">{members?.length || 0} membri</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowMembers(true)}
            data-testid="button-show-members"
          >
            <Users className="w-5 h-5 text-white" />
          </Button>
          {isOwner && pendingOnly.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowRequests(true)}
              className="relative"
              data-testid="button-show-requests"
            >
              <UserPlus className="w-5 h-5 text-white" />
              <span className="absolute -top-1 -right-1 bg-accent text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {pendingOnly.length}
              </span>
            </Button>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messagesLoading ? (
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
              Sii il primo a scrivere in questa stanza privata!
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
                  data-testid={`private-room-message-${msg.id}`}
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
            className="flex-1 bg-white/10 backdrop-blur-sm border-white/20 text-white placeholder:text-white/40"
            disabled={sendMessage.isPending}
            data-testid="input-private-room-message"
          />
          <Button
            onClick={handleSend}
            disabled={!messageText.trim() || sendMessage.isPending}
            className="bg-gradient-to-r from-primary to-accent"
            size="icon"
            data-testid="button-send-private-room-message"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <Dialog open={showRequests} onOpenChange={setShowRequests}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Richieste di Accesso</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {pendingOnly.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">Nessuna richiesta in sospeso</p>
            ) : (
              pendingOnly.map((req: any) => (
                <div key={req.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/30">
                  <Avatar className="w-10 h-10">
                    <AvatarImage src={req.requester?.imageUrl} />
                    <AvatarFallback>{req.requester?.name?.[0] || "?"}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{req.requester?.name || "Utente"}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      In attesa
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-green-500"
                      onClick={() => respondMutation.mutate({ requestId: req.id, status: "approved" })}
                      disabled={respondMutation.isPending}
                      data-testid={`button-approve-request-${req.id}`}
                    >
                      <Check className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-red-500"
                      onClick={() => respondMutation.mutate({ requestId: req.id, status: "rejected" })}
                      disabled={respondMutation.isPending}
                      data-testid={`button-reject-request-${req.id}`}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showMembers} onOpenChange={setShowMembers}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Membri della Stanza</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {members?.map((member) => (
              <div key={member.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/30">
                <Avatar className="w-10 h-10">
                  <AvatarImage src={member.imageUrl || undefined} />
                  <AvatarFallback>{member.name[0]}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{member.name}</p>
                </div>
                {member.id === room?.ownerId && (
                  <Badge variant="secondary" className="bg-accent/20 text-accent shrink-0">
                    <Crown className="w-3 h-3 mr-1" />
                    Creatore
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

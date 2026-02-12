import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Send, Check, CheckCheck, Gift, Star, Heart, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useLocation, useParams } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { queryClient, apiRequest } from "@/lib/queryClient";
import GiftPicker from "@/components/GiftPicker";
import GiftAnimation from "@/components/GiftAnimation";
import type { Message, Profile, Match, VirtualGift, SentGift } from "@shared/schema";

interface ChatPageParams {
  matchId: string;
}

const giftIconMap: Record<string, typeof Star> = {
  star: Star,
  flower: Sparkles,
  heart: Heart,
  ring: Sparkles,
  explosion: Star,
  galaxy: Sparkles,
};

export default function Chat() {
  const params = useParams<ChatPageParams>();
  const matchId = params.matchId;
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [messageText, setMessageText] = useState("");
  const [showGiftPicker, setShowGiftPicker] = useState(false);
  const [giftAnimation, setGiftAnimation] = useState<{ gift: VirtualGift; senderName: string; message?: string | null } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [sendingCount, setSendingCount] = useState(0);
  const [optimisticMessages, setOptimisticMessages] = useState<Message[]>([]);

  const { data: myProfile } = useQuery<Profile | null>({
    queryKey: ["/api/profiles/me"],
    enabled: !!user,
  });

  const { data: serverMessages, isLoading: messagesLoading } = useQuery<Message[]>({
    queryKey: ["/api/messages", matchId],
    enabled: !!matchId && !!myProfile,
    refetchInterval: sendingCount > 0 ? false : 3000,
  });

  const messages = sendingCount > 0
    ? [...(serverMessages || []), ...optimisticMessages]
    : (serverMessages || []);

  const { data: matches, isLoading: matchesLoading } = useQuery<(Match & { profile: Profile })[]>({
    queryKey: ["/api/matches", myProfile?.id],
    enabled: !!myProfile,
  });

  const { data: receivedGifts = [] } = useQuery<(SentGift & { gift: VirtualGift; sender: Profile })[]>({
    queryKey: ["/api/gifts/received"],
    enabled: !!myProfile,
    refetchInterval: 5000,
  });

  const currentMatch = matches?.find(m => m.id === matchId);
  const otherProfile = currentMatch?.profile;

  const unseenGifts = receivedGifts.filter(
    g => !g.seen && g.senderId === otherProfile?.id
  );

  useEffect(() => {
    if (unseenGifts.length > 0 && !giftAnimation) {
      const latest = unseenGifts[0];
      setGiftAnimation({
        gift: latest.gift,
        senderName: latest.sender.name,
        message: latest.message,
      });
      apiRequest("PATCH", `/api/gifts/${latest.id}/seen`);
      queryClient.invalidateQueries({ queryKey: ["/api/gifts/received"] });
    }
  }, [unseenGifts, giftAnimation, otherProfile]);

  const sendMessage = useMutation({
    mutationFn: async ({ content, tempId }: { content: string; tempId: string }) => {
      return apiRequest("POST", "/api/messages", {
        matchId,
        content,
      });
    },
    onMutate: async ({ content, tempId }) => {
      if (!myProfile) return;
      setSendingCount(c => c + 1);
      const optimisticMessage: Message = {
        id: tempId,
        matchId: matchId!,
        senderId: myProfile.id,
        content,
        read: false,
        createdAt: new Date(),
      };
      setOptimisticMessages(prev => [...prev, optimisticMessage]);
      setMessageText("");
    },
    onError: (_err, { tempId }) => {
      setOptimisticMessages(prev => prev.filter(m => m.id !== tempId));
    },
    onSettled: (_data, _error, { tempId }) => {
      setTimeout(() => {
        setOptimisticMessages(prev => prev.filter(m => m.id !== tempId));
        queryClient.invalidateQueries({ queryKey: ["/api/messages", matchId] });
        setSendingCount(c => Math.max(0, c - 1));
      }, 1500);
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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

  const formatTime = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
  };

  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (d.toDateString() === today.toDateString()) {
      return "Oggi";
    } else if (d.toDateString() === yesterday.toDateString()) {
      return "Ieri";
    }
    return d.toLocaleDateString("it-IT", { day: "numeric", month: "long" });
  };

  const groupMessagesByDate = (msgs: Message[]) => {
    const groups: { [key: string]: Message[] } = {};
    msgs?.forEach(msg => {
      const date = formatDate(msg.createdAt);
      if (!groups[date]) groups[date] = [];
      groups[date].push(msg);
    });
    return groups;
  };

  if (!otherProfile && !messagesLoading && !matchesLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-white/60">Chat non trovata</p>
      </div>
    );
  }

  if (!otherProfile && (messagesLoading || matchesLoading)) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  const groupedMessages = groupMessagesByDate(messages || []);

  const giftsFromThisUser = receivedGifts.filter(g => g.senderId === otherProfile?.id && g.seen);

  return (
    <div className="flex flex-col h-full">
      <div className="fixed inset-0 z-0">
        <video autoPlay loop muted playsInline className="w-full h-full object-cover">
          <source src="/backgrounds/5e8d7f392f6b41939b06e7f70a2114dd.mp4_1770326642074.MP4" type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/25 to-black/50" />
      </div>

      <header className="flex items-center gap-3 p-4 bg-black/40 backdrop-blur-xl border-b border-white/10">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setLocation("/matches")}
          data-testid="button-back"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        
        {otherProfile && (
          <div className="flex items-center gap-3 flex-1">
            <Avatar className="w-10 h-10 ring-2 ring-primary/20">
              <AvatarImage src={otherProfile.imageUrl} alt={otherProfile.name} />
              <AvatarFallback>{otherProfile.name[0]}</AvatarFallback>
            </Avatar>
            <div>
              <h2 className="font-semibold text-white">{otherProfile.name}</h2>
              <p className="text-xs text-white/60">{otherProfile.alienType}</p>
            </div>
          </div>
        )}
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messagesLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
        ) : Object.keys(groupedMessages).length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mb-4">
              <Send className="w-10 h-10 text-primary/60" />
            </div>
            <h3 className="text-lg font-medium text-white mb-2">
              Inizia la conversazione!
            </h3>
            <p className="text-sm text-white/60 max-w-xs">
              Fai il primo passo e invia un messaggio a {otherProfile?.name}
            </p>
          </div>
        ) : (
          Object.entries(groupedMessages).map(([date, msgs]) => (
            <div key={date}>
              <div className="flex items-center justify-center my-4">
                <span className="px-3 py-1 rounded-full bg-white/15 text-xs text-white/60">
                  {date}
                </span>
              </div>
              
              <AnimatePresence>
                {msgs.map((message, index) => {
                  const isMe = message.senderId === myProfile?.id;
                  
                  return (
                    <motion.div
                      key={message.id}
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ delay: index * 0.02 }}
                      className={`flex mb-2 ${isMe ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[75%] px-4 py-2 rounded-2xl ${
                          isMe
                            ? "bg-gradient-to-r from-primary to-accent text-white rounded-br-md"
                            : "bg-white/15 backdrop-blur-sm text-white rounded-bl-md"
                        }`}
                        data-testid={`message-${message.id}`}
                      >
                        <p className="text-sm break-words">{message.content}</p>
                        <div className={`flex items-center gap-1 mt-1 ${isMe ? "justify-end" : "justify-start"}`}>
                          <span className={`text-xs ${isMe ? "text-white/70" : "text-white/60"}`}>
                            {formatTime(message.createdAt)}
                          </span>
                          {isMe && (
                            message.read ? (
                              <CheckCheck className="w-3 h-3 text-white/70" />
                            ) : (
                              <Check className="w-3 h-3 text-white/70" />
                            )
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          ))
        )}

        {giftsFromThisUser.length > 0 && (
          <div className="flex items-center justify-center my-2">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-sm">
              <Gift className="w-3.5 h-3.5 text-yellow-400" />
              <span className="text-xs text-white/70">
                {giftsFromThisUser.length} {giftsFromThisUser.length === 1 ? "regalo ricevuto" : "regali ricevuti"}
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 bg-black/40 backdrop-blur-xl border-t border-white/10">
        <div className="flex items-center gap-2">
          {otherProfile && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowGiftPicker(true)}
              className="text-yellow-400"
              data-testid="button-open-gifts"
            >
              <Gift className="w-5 h-5" />
            </Button>
          )}
          <Input
            ref={inputRef}
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Scrivi un messaggio..."
            className="flex-1 bg-white/10 backdrop-blur-sm border-white/20 text-white placeholder:text-white/60"
            disabled={sendMessage.isPending}
            data-testid="input-message"
          />
          <Button
            onClick={handleSend}
            disabled={!messageText.trim() || sendMessage.isPending}
            className="bg-gradient-to-r from-primary to-accent hover:opacity-90"
            size="icon"
            data-testid="button-send"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <AnimatePresence>
        {showGiftPicker && otherProfile && (
          <GiftPicker
            receiverId={otherProfile.id}
            receiverName={otherProfile.name}
            onClose={() => setShowGiftPicker(false)}
            onGiftSent={(gift) => {
              setShowGiftPicker(false);
            }}
          />
        )}
      </AnimatePresence>

      {giftAnimation && (
        <GiftAnimation
          gift={giftAnimation.gift}
          senderName={giftAnimation.senderName}
          message={giftAnimation.message}
          onComplete={() => setGiftAnimation(null)}
        />
      )}
    </div>
  );
}

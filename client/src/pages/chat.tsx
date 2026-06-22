import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Send, Check, CheckCheck, Gift, Star, Heart, Sparkles, Ban, MoreVertical, Flag, UserX, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useLocation, useParams } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/i18n/LanguageContext";
import GiftPicker from "@/components/GiftPicker";
import GiftAnimation from "@/components/GiftAnimation";
import type { Message, Profile, Match, VirtualGift, SentGift, ProfileRating } from "@shared/schema";

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
  const { toast } = useToast();
  const { t } = useLanguage();
  const [messageText, setMessageText] = useState("");
  const [showGiftPicker, setShowGiftPicker] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showReportMenu, setShowReportMenu] = useState(false);
  const [giftAnimation, setGiftAnimation] = useState<{ gift: VirtualGift; senderName: string; message?: string | null } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [optimisticMessages, setOptimisticMessages] = useState<Message[]>([]);
  const [botIsTyping, setBotIsTyping] = useState(false);
  const botTypingTimerRef = useRef<NodeJS.Timeout | null>(null);

  const { data: myProfile } = useQuery<Profile | null>({
    queryKey: ["/api/profiles/me"],
    enabled: !!user,
  });

  const { data: serverMessages, isLoading: messagesLoading } = useQuery<Message[]>({
    queryKey: ["/api/messages", matchId],
    enabled: !!matchId && !!myProfile,
    refetchInterval: 3000,
  });

  const messages = (() => {
    const server = serverMessages || [];
    if (optimisticMessages.length === 0) return server;
    const serverIds = new Set(server.map(m => m.id));
    const pending = optimisticMessages.filter(m => !serverIds.has(m.id));
    return [...server, ...pending];
  })();

  const { data: matches, isLoading: matchesLoading } = useQuery<(Match & { profile: Profile })[]>({
    queryKey: ["/api/matches", myProfile?.id],
    enabled: !!myProfile,
  });

  const { data: receivedGifts = [] } = useQuery<(SentGift & { gift: VirtualGift; sender: Profile })[]>({
    queryKey: ["/api/gifts/received"],
    enabled: !!myProfile,
    refetchInterval: 5000,
  });

  const { data: ratingData } = useQuery<{ rating: ProfileRating | null }>({
    queryKey: ["/api/ratings/for-match", matchId],
    enabled: !!matchId && !!myProfile,
  });

  const currentMatch = matches?.find(m => m.id === matchId);
  const otherProfile = currentMatch?.profile;

  const { data: activityData } = useQuery<{ label: string }>({
    queryKey: ["/api/time/label", otherProfile?.id],
    enabled: !!otherProfile?.id && !otherProfile?.isBot,
    staleTime: 10 * 60 * 1000,
  });

  const { data: myActivityData } = useQuery<{ label: string }>({
    queryKey: ["/api/time/label", myProfile?.id],
    enabled: !!myProfile?.id,
    staleTime: 10 * 60 * 1000,
  });

  const isMomentoCosmico = !!activityData?.label && !!myActivityData?.label &&
    activityData.label === myActivityData.label &&
    activityData.label !== "attivo/a";

  const isRatingMatch = !!ratingData?.rating?.matchCreated;
  const otherHasReplied = messages.some(m => m.senderId === otherProfile?.id);
  const myMessageCount = messages.filter(m => m.senderId === myProfile?.id).length;
  const sendingBlocked = isRatingMatch && !otherHasReplied && myMessageCount >= 1;

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

  // Mostra typing indicator quando l'altro utente è un bot e riceve un messaggio
  const showBotTypingIndicator = () => {
    if (!otherProfile?.isBot) return;
    if (botTypingTimerRef.current) clearTimeout(botTypingTimerRef.current);
    // I puntini appaiono dopo 5-12s (simula il tempo di "lettura" del bot)
    const readDelay = 5_000 + Math.random() * 7_000;
    botTypingTimerRef.current = setTimeout(() => {
      setBotIsTyping(true);
    }, readDelay);
  };

  // Nasconde typing indicator quando arriva risposta del bot
  useEffect(() => {
    const hasNewBotMsg = messages.some(m => m.senderId === otherProfile?.id);
    if (hasNewBotMsg && botIsTyping) {
      setBotIsTyping(false);
      if (botTypingTimerRef.current) clearTimeout(botTypingTimerRef.current);
    }
  }, [messages, otherProfile?.id, botIsTyping]);

  const sendMessage = useMutation({
    mutationFn: async ({ content, tempId }: { content: string; tempId: string }) => {
      return apiRequest("POST", "/api/messages", {
        matchId,
        content,
      });
    },
    onMutate: async ({ content, tempId }) => {
      if (!myProfile) return;
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
      showBotTypingIndicator();
    },
    onError: (_err, { tempId }) => {
      setOptimisticMessages(prev => prev.filter(m => m.id !== tempId));
      setBotIsTyping(false);
      if (botTypingTimerRef.current) clearTimeout(botTypingTimerRef.current);
    },
    onSuccess: (data, { tempId }) => {
      const serverMsg = data as Message;
      queryClient.setQueryData(
        ["/api/messages", matchId],
        (old: Message[] | undefined) => {
          if (!old) return [serverMsg];
          const exists = old.some(m => m.id === serverMsg.id);
          if (exists) return old;
          return [...old, serverMsg];
        }
      );
      setOptimisticMessages(prev => prev.filter(m => m.id !== tempId));
      queryClient.invalidateQueries({ queryKey: ["/api/messages", matchId] });
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const blockUser = useMutation({
    mutationFn: async () => {
      if (!otherProfile) return;
      await apiRequest("POST", "/api/block", { blockedId: otherProfile.id });
    },
    onSuccess: () => {
      toast({ title: t("chat.userBlocked"), description: t("chat.userBlockedDesc") });
      queryClient.invalidateQueries({ queryKey: ["/api/profiles"] });
      if (myProfile) {
        queryClient.invalidateQueries({ queryKey: ["/api/matches", myProfile.id] });
      }
      setLocation("/matches");
    },
  });

  const reportUser = useMutation({
    mutationFn: async (reason: string) => {
      if (!otherProfile) return;
      await apiRequest("POST", "/api/reports", { reportedId: otherProfile.id, reason });
    },
    onSuccess: () => {
      toast({ title: t("chat.reportSent"), description: t("chat.reportSentDesc") });
      setShowReportMenu(false);
    },
  });

  const unmatchUser = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/matches/${matchId}`);
    },
    onSuccess: () => {
      toast({ title: t("chat.matchRemoved"), description: `${t("chat.matchRemovedDesc")} ${otherProfile?.name || t("chat.thisUser")}` });
      queryClient.invalidateQueries({ predicate: (query) => {
        const key = query.queryKey[0];
        return typeof key === "string" && key.startsWith("/api/matches");
      }});
      setLocation("/matches");
    },
    onError: () => {
      toast({ title: t("common.error"), description: t("chat.removeMatchError"), variant: "destructive" });
    },
  });

  const reportReasons = [
    t("chat.reportInappropriate"),
    t("chat.reportFake"),
    t("chat.reportHarassing"),
    t("chat.reportSpam"),
    t("chat.reportThreats"),
    t("chat.reportOther"),
  ];

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
      return t("chat.today");
    } else if (d.toDateString() === yesterday.toDateString()) {
      return t("chat.yesterday");
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
        <p className="text-white/60">{t("chat.notFound")}</p>
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
    <div className="flex flex-col h-full relative z-10">
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
              <div className="flex items-center gap-1.5">
                <p className="text-xs text-white/60">{otherProfile.alienType}</p>
                {activityData?.label && !otherProfile.isBot && (
                  <span className="flex items-center gap-0.5 text-xs text-cyan-400/70">
                    <Clock className="w-3 h-3" />
                    {activityData.label}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="relative">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => { setShowMenu(!showMenu); setShowReportMenu(false); }}
            data-testid="button-chat-menu"
          >
            <MoreVertical className="w-5 h-5" />
          </Button>
          {showMenu && !showReportMenu && (
            <div className="absolute right-0 top-full mt-1 w-52 bg-black/90 backdrop-blur-xl border border-white/10 rounded-md shadow-lg overflow-hidden z-50">
              <button
                className="flex items-center gap-2 w-full px-4 py-3 text-sm text-white/80 hover-elevate text-left"
                onClick={() => setShowReportMenu(true)}
                data-testid="button-report-user"
              >
                <Flag className="w-4 h-4" />
                {t("chat.reportUser")}
              </button>
              <button
                className="flex items-center gap-2 w-full px-4 py-3 text-sm text-orange-400 hover-elevate text-left"
                onClick={() => { if (confirm(t("chat.confirmUnmatch"))) { unmatchUser.mutate(); } setShowMenu(false); }}
                data-testid="button-unmatch-user"
              >
                <UserX className="w-4 h-4" />
                {t("chat.removeMatch")}
              </button>
              <button
                className="flex items-center gap-2 w-full px-4 py-3 text-sm text-red-400 hover-elevate text-left"
                onClick={() => { if (confirm(t("chat.confirmBlock"))) { blockUser.mutate(); } setShowMenu(false); }}
                data-testid="button-block-user"
              >
                <Ban className="w-4 h-4" />
                {t("chat.blockUser")}
              </button>
            </div>
          )}
          {showMenu && showReportMenu && (
            <div className="absolute right-0 top-full mt-1 w-56 bg-black/90 backdrop-blur-xl border border-white/10 rounded-md shadow-lg overflow-hidden z-50">
              <div className="px-4 py-2 text-xs text-white/50 font-semibold uppercase tracking-wider border-b border-white/10">
                {t("chat.reportReason")}
              </div>
              {reportReasons.map((reason) => (
                <button
                  key={reason}
                  className="flex items-center gap-2 w-full px-4 py-3 text-sm text-white/80 hover-elevate text-left"
                  onClick={() => { reportUser.mutate(reason); setShowMenu(false); }}
                  data-testid={`button-report-reason-${reason.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  {reason}
                </button>
              ))}
              <button
                className="flex items-center gap-2 w-full px-4 py-2 text-xs text-white/40 hover-elevate text-left border-t border-white/10"
                onClick={() => setShowReportMenu(false)}
              >
                {t("common.back")}
              </button>
            </div>
          )}
        </div>
      </header>

      {isMomentoCosmico && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="relative z-20 mx-4 mt-2 rounded-xl bg-gradient-to-r from-amber-500/20 to-yellow-500/15 border border-amber-500/30 px-3 py-2 flex items-center gap-2">
          <span className="text-base">⭐</span>
          <div>
            <p className="text-amber-300 text-xs font-semibold">Momento Cosmico!</p>
            <p className="text-white/50 text-xs">Entrambi siete {activityData?.label?.replace("attivo/a ", "")} — ottimo momento per chattare.</p>
          </div>
        </motion.div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-4 relative z-20">
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
              {t("chat.startConversation")}
            </h3>
            <p className="text-sm text-white/60 max-w-xs">
              {t("chat.sendFirstMessage")} {otherProfile?.name}
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
                      className={`flex gap-3 mb-3 ${isMe ? "flex-row-reverse" : "flex-row"}`}
                    >
                      {!isMe && otherProfile && (
                        <Avatar className="w-10 h-10 flex-shrink-0 ring-2 ring-white/20">
                          <AvatarImage src={otherProfile.imageUrl || undefined} alt={otherProfile.name} />
                          <AvatarFallback className="bg-primary/30 text-white text-sm">{otherProfile.name?.[0] || "?"}</AvatarFallback>
                        </Avatar>
                      )}
                      {isMe && myProfile && (
                        <Avatar className="w-10 h-10 flex-shrink-0 ring-2 ring-primary/30">
                          <AvatarImage src={myProfile.imageUrl || undefined} alt={myProfile.name} />
                          <AvatarFallback className="bg-accent/30 text-white text-sm">{myProfile.name?.[0] || "?"}</AvatarFallback>
                        </Avatar>
                      )}
                      <div className={`flex flex-col max-w-[70%] ${isMe ? "items-end" : "items-start"}`}>
                        <p className={`text-sm mb-1 font-semibold ${isMe ? "text-white/70" : "text-cyan-300"}`}>
                          {isMe ? t("chat.you") : otherProfile?.name}
                        </p>
                        <div
                          className={`px-4 py-2.5 rounded-2xl ${
                            isMe
                              ? "bg-gradient-to-r from-primary to-accent text-white rounded-br-md"
                              : "bg-white/15 backdrop-blur-sm text-white rounded-bl-md"
                          }`}
                          data-testid={`message-${message.id}`}
                        >
                          <p className="text-[15px] break-words leading-relaxed">{message.content}</p>
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
                {giftsFromThisUser.length} {giftsFromThisUser.length === 1 ? t("chat.giftReceived") : t("chat.giftsReceived")}
              </span>
            </div>
          </div>
        )}

        {/* Bot typing indicator */}
        {botIsTyping && otherProfile && (
          <div className="flex gap-3 mb-3">
            <Avatar className="w-10 h-10 flex-shrink-0 ring-2 ring-white/20">
              <AvatarImage src={otherProfile.imageUrl || undefined} alt={otherProfile.name} />
              <AvatarFallback className="bg-primary/30 text-white text-sm">{otherProfile.name?.[0]}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col items-start">
              <p className="text-sm mb-1 font-semibold text-cyan-300">{otherProfile.name}</p>
              <div className="px-4 py-3 rounded-2xl rounded-bl-md bg-white/15 backdrop-blur-sm flex items-center gap-1" data-testid="bot-typing-indicator">
                <span className="w-2 h-2 rounded-full bg-white/60 animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 rounded-full bg-white/60 animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 rounded-full bg-white/60 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 bg-black/40 backdrop-blur-xl border-t border-white/10 relative z-20">
        {sendingBlocked ? (
          <div className="flex items-center justify-center gap-2 py-2" data-testid="sending-blocked-notice">
            <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
            <p className="text-white/50 text-sm text-center">
              {t("chat.waitingReply")} {otherProfile?.name}...
            </p>
          </div>
        ) : (
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
              placeholder={t("chat.placeholder")}
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
        )}
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

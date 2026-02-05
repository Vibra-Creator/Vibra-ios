import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Send, Check, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useLocation, useParams } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Message, Profile, Match } from "@shared/schema";

interface ChatPageParams {
  matchId: string;
}

export default function Chat() {
  const params = useParams<ChatPageParams>();
  const matchId = params.matchId;
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [messageText, setMessageText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: myProfile } = useQuery<Profile | null>({
    queryKey: ["/api/profiles/me"],
    enabled: !!user,
  });

  const { data: messages, isLoading: messagesLoading, refetch } = useQuery<Message[]>({
    queryKey: ["/api/messages", matchId],
    enabled: !!matchId && !!myProfile,
    refetchInterval: 3000,
  });

  const { data: matches } = useQuery<(Match & { profile: Profile })[]>({
    queryKey: ["/api/matches", myProfile?.id],
    enabled: !!myProfile,
  });

  const currentMatch = matches?.find(m => m.id === matchId);
  const otherProfile = currentMatch?.profile;

  const sendMessage = useMutation({
    mutationFn: async (content: string) => {
      return apiRequest("POST", "/api/messages", {
        matchId,
        senderId: myProfile?.id,
        content,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/messages", matchId] });
      setMessageText("");
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (messageText.trim() && myProfile) {
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

  if (!otherProfile && !messagesLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-muted-foreground">Chat non trovata</p>
      </div>
    );
  }

  const groupedMessages = groupMessagesByDate(messages || []);

  return (
    <div className="flex flex-col h-full bg-background/50">
      <header className="flex items-center gap-3 p-4 border-b border-border bg-card/80 backdrop-blur-sm">
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
              <h2 className="font-semibold text-foreground">{otherProfile.name}</h2>
              <p className="text-xs text-muted-foreground">{otherProfile.alienType}</p>
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
            <h3 className="text-lg font-medium text-foreground mb-2">
              Inizia la conversazione!
            </h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              Fai il primo passo e invia un messaggio a {otherProfile?.name}
            </p>
          </div>
        ) : (
          Object.entries(groupedMessages).map(([date, msgs]) => (
            <div key={date}>
              <div className="flex items-center justify-center my-4">
                <span className="px-3 py-1 rounded-full bg-muted text-xs text-muted-foreground">
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
                            : "bg-card border border-border rounded-bl-md"
                        }`}
                        data-testid={`message-${message.id}`}
                      >
                        <p className="text-sm break-words">{message.content}</p>
                        <div className={`flex items-center gap-1 mt-1 ${isMe ? "justify-end" : "justify-start"}`}>
                          <span className={`text-xs ${isMe ? "text-white/70" : "text-muted-foreground"}`}>
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
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t border-border bg-card/80 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <Input
            ref={inputRef}
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Scrivi un messaggio..."
            className="flex-1 bg-background/50 border-border"
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
    </div>
  );
}

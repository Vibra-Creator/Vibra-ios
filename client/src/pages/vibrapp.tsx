import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { io, Socket } from "socket.io-client";
import { useLanguage } from "@/i18n/LanguageContext";
import { Send, Reply, X, ChevronDown, Smile, Check, CheckCheck, ArrowDown, MessageCircle, Lock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";

interface VibrappMsg {
  id: string;
  senderId: string;
  senderName: string;
  senderImage: string | null;
  content: string;
  replyToId: string | null;
  replyToSenderId: string | null;
  replyToName: string | null;
  replyToContent: string | null;
  reactions: string;
  readBy: string[] | null;
  createdAt: string;
}

const REACTION_EMOJIS = ["❤️", "😂", "😮", "😢", "🔥", "👍"];

export default function Vibrapp() {
  const { t } = useLanguage();
  const [messages, setMessages] = useState<VibrappMsg[]>([]);
  const [inputText, setInputText] = useState("");
  const [replyTo, setReplyTo] = useState<VibrappMsg | null>(null);
  const [onlineCount, setOnlineCount] = useState(0);
  const [typingUsers, setTypingUsers] = useState<{ profileId: string; name: string }[]>([]);
  const [showReactionPicker, setShowReactionPicker] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isAtBottomRef = useRef(true);

  const { data: profile } = useQuery({
    queryKey: ["/api/profiles/me"],
    queryFn: async () => {
      const res = await fetch("/api/profiles/me", { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
  });

  useEffect(() => {
    if (!profile?.id) return;

    fetch("/api/vibrapp/messages?limit=50", { credentials: "include" })
      .then(r => r.json())
      .then((msgs: VibrappMsg[]) => {
        setMessages(msgs);
        setHasMore(msgs.length >= 50);
        setTimeout(() => scrollToBottom(), 100);
      })
      .catch(console.error);

    const socket = io(window.location.origin, { path: "/vibrapp-socket" });
    socketRef.current = socket;

    socket.on("connect", () => {
    });

    socket.on("vibrapp:new-message", (msg: VibrappMsg) => {
      setMessages(prev => {
        if (prev.some(m => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      if (isAtBottomRef.current) {
        setTimeout(() => scrollToBottom(), 50);
      }
      if (msg.senderId !== profile.id) {
        socket.emit("vibrapp:read", { messageId: msg.id });
      }
    });

    socket.on("vibrapp:online-count", (count: number) => {
      setOnlineCount(count);
    });

    socket.on("vibrapp:typing-update", (users: { profileId: string; name: string }[]) => {
      setTypingUsers(users.filter(u => u.profileId !== profile.id));
    });

    socket.on("vibrapp:message-read", (data: { messageId: string; profileId: string }) => {
      setMessages(prev => prev.map(m => {
        if (m.id === data.messageId) {
          const readBy = m.readBy || [];
          if (!readBy.includes(data.profileId)) {
            return { ...m, readBy: [...readBy, data.profileId] };
          }
        }
        return m;
      }));
    });

    socket.on("vibrapp:reaction-update", (data: { messageId: string; reactions: Record<string, string[]> }) => {
      setMessages(prev => prev.map(m => {
        if (m.id === data.messageId) {
          return { ...m, reactions: JSON.stringify(data.reactions) };
        }
        return m;
      }));
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [profile?.id]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const distFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    isAtBottomRef.current = distFromBottom < 100;
    setShowScrollDown(distFromBottom > 300);
  }, []);

  const loadOlderMessages = useCallback(async () => {
    if (messages.length === 0 || !hasMore) return;
    const oldestId = messages[0].id;
    const container = messagesContainerRef.current;
    const prevScrollHeight = container?.scrollHeight || 0;

    try {
      const res = await fetch(`/api/vibrapp/messages?limit=50&before=${oldestId}`, { credentials: "include" });
      const older: VibrappMsg[] = await res.json();
      if (older.length < 50) setHasMore(false);
      if (older.length > 0) {
        setMessages(prev => [...older, ...prev]);
        requestAnimationFrame(() => {
          if (container) {
            container.scrollTop = container.scrollHeight - prevScrollHeight;
          }
        });
      }
    } catch (err) {
      console.error("loadOlder error:", err);
    }
  }, [messages, hasMore]);

  const sendMessage = useCallback(() => {
    if (!inputText.trim() || !profile || !socketRef.current) return;

    socketRef.current.emit("vibrapp:message", {
      content: inputText.trim(),
      replyToId: replyTo?.id,
      replyToName: replyTo?.senderName,
      replyToContent: replyTo?.content?.substring(0, 100),
    });

    setInputText("");
    setReplyTo(null);
    inputRef.current?.focus();
  }, [inputText, profile, replyTo]);

  const handleInputChange = useCallback((val: string) => {
    setInputText(val);
    if (socketRef.current && profile) {
      socketRef.current.emit("vibrapp:typing");
    }
  }, [profile]);

  const handleReact = useCallback((messageId: string, emoji: string) => {
    if (!socketRef.current || !profile) return;
    socketRef.current.emit("vibrapp:react", { messageId, emoji });
    setShowReactionPicker(null);
  }, [profile]);

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const formatDateLabel = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = d.toDateString() === yesterday.toDateString();
    if (isToday) return t("vibrapp.today");
    if (isYesterday) return t("vibrapp.yesterday");
    return d.toLocaleDateString();
  };

  const groupedMessages = messages.reduce<{ date: string; msgs: VibrappMsg[] }[]>((groups, msg) => {
    const date = new Date(msg.createdAt).toDateString();
    const last = groups[groups.length - 1];
    if (last && last.date === date) {
      last.msgs.push(msg);
    } else {
      groups.push({ date, msgs: [msg] });
    }
    return groups;
  }, []);

  const isMine = (msg: VibrappMsg) => msg.senderId === profile?.id;

  if (!profile) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden" data-testid="vibrapp-page">
      <div className="bg-gradient-to-r from-[#075e54] to-[#128c7e] px-4 py-3 flex items-center justify-between shrink-0 shadow-lg" data-testid="vibrapp-header">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
            <MessageCircle className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-white font-bold text-lg" data-testid="text-vibrapp-title">{t("vibrapp.title")}</h1>
            <p className="text-white/70 text-xs" data-testid="text-vibrapp-online">
              {t("vibrapp.onlineCount").replace("{count}", String(onlineCount))}
            </p>
          </div>
        </div>
      </div>

      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto px-3 py-2 space-y-1"
        style={{ background: "linear-gradient(180deg, #0b0d1a 0%, #111827 100%)" }}
        onScroll={handleScroll}
        data-testid="vibrapp-messages-container"
      >
        {hasMore && messages.length > 0 && (
          <div className="text-center py-2">
            <button
              onClick={loadOlderMessages}
              className="text-xs text-primary hover:underline"
              data-testid="button-load-more"
            >
              {t("vibrapp.loadMore")}
            </button>
          </div>
        )}

        {messages.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center py-20 text-white/50">
            <MessageCircle className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-sm" data-testid="text-no-messages">{t("vibrapp.noMessages")}</p>
          </div>
        )}

        {groupedMessages.map((group) => (
          <div key={group.date}>
            <div className="flex justify-center py-2">
              <span className="bg-black/40 text-white/60 text-[10px] px-3 py-1 rounded-full backdrop-blur-sm">
                {formatDateLabel(group.msgs[0].createdAt)}
              </span>
            </div>
            {group.msgs.map((msg, idx) => {
              const mine = isMine(msg);
              const showAvatar = !mine && (idx === 0 || group.msgs[idx - 1].senderId !== msg.senderId);
              const showName = showAvatar;
              const reactions: Record<string, string[]> = JSON.parse(msg.reactions || "{}");
              const hasReactions = Object.keys(reactions).length > 0;
              const isRead = (msg.readBy || []).length > 0;

              return (
                <div
                  key={msg.id}
                  className={`flex ${mine ? "justify-end" : "justify-start"} mb-0.5 group`}
                  data-testid={`message-${msg.id}`}
                >
                  {!mine && (
                    <div className="w-8 shrink-0 mr-1.5 flex items-end">
                      {showAvatar && (
                        <img
                          src={msg.senderImage || "/icons/icon-72x72.png"}
                          alt=""
                          className="w-7 h-7 rounded-full object-cover"
                          data-testid={`avatar-${msg.senderId}`}
                        />
                      )}
                    </div>
                  )}
                  <div className={`max-w-[75%] relative ${mine ? "items-end" : "items-start"}`}>
                    <div
                      className={`rounded-xl px-3 py-1.5 relative ${
                        mine
                          ? "bg-[#005c4b] text-white rounded-tr-sm"
                          : "bg-[#1f2937] text-white rounded-tl-sm"
                      }`}
                    >
                      {showName && (
                        <p className="text-[11px] font-semibold text-emerald-400 mb-0.5" data-testid={`sender-name-${msg.id}`}>
                          {msg.senderName}
                        </p>
                      )}

                      {msg.replyToId && (
                        <div className="bg-black/20 rounded px-2 py-1 mb-1 border-l-2 border-purple-400">
                          <div className="flex items-center gap-1">
                            <Lock className="w-2.5 h-2.5 text-purple-400" />
                            <p className="text-[10px] text-purple-400 font-medium">{msg.replyToName}</p>
                          </div>
                          <p className="text-[10px] text-white/50 truncate">{msg.replyToContent}</p>
                        </div>
                      )}

                      <p className="text-[13px] leading-relaxed break-words whitespace-pre-wrap">{msg.content}</p>

                      <div className={`flex items-center gap-1 mt-0.5 ${mine ? "justify-end" : "justify-end"}`}>
                        {msg.replyToId && (
                          <Lock className="w-2.5 h-2.5 text-purple-400/60" />
                        )}
                        <span className="text-[9px] text-white/40">{formatTime(msg.createdAt)}</span>
                        {mine && (
                          isRead
                            ? <CheckCheck className="w-3 h-3 text-blue-400" />
                            : <Check className="w-3 h-3 text-white/40" />
                        )}
                      </div>
                    </div>

                    {hasReactions && (
                      <div className={`flex flex-wrap gap-0.5 mt-0.5 ${mine ? "justify-end" : "justify-start"}`}>
                        {Object.entries(reactions).map(([emoji, users]) => (
                          <button
                            key={emoji}
                            onClick={() => handleReact(msg.id, emoji)}
                            className={`text-xs px-1.5 py-0.5 rounded-full bg-black/30 border ${
                              users.includes(profile.id) ? "border-primary" : "border-white/10"
                            }`}
                            data-testid={`reaction-${msg.id}-${emoji}`}
                          >
                            {emoji} {users.length}
                          </button>
                        ))}
                      </div>
                    )}

                    <div className={`absolute top-0 ${mine ? "-left-16" : "-right-16"} opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5`}>
                      <button
                        onClick={() => setReplyTo(msg)}
                        className="p-1 rounded-full hover:bg-white/10 text-white/50"
                        title={t("vibrapp.reply")}
                        data-testid={`button-reply-${msg.id}`}
                      >
                        <Reply className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setShowReactionPicker(showReactionPicker === msg.id ? null : msg.id)}
                        className="p-1 rounded-full hover:bg-white/10 text-white/50"
                        data-testid={`button-react-${msg.id}`}
                      >
                        <Smile className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <AnimatePresence>
                      {showReactionPicker === msg.id && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                          className={`absolute z-50 ${mine ? "right-0" : "left-0"} -top-10 bg-gray-800 rounded-full px-2 py-1 flex gap-1 shadow-xl border border-white/10`}
                          data-testid={`reaction-picker-${msg.id}`}
                        >
                          {REACTION_EMOJIS.map(emoji => (
                            <button
                              key={emoji}
                              onClick={() => handleReact(msg.id, emoji)}
                              className="text-lg hover:scale-125 transition-transform"
                              data-testid={`reaction-emoji-${emoji}`}
                            >
                              {emoji}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              );
            })}
          </div>
        ))}

        <div ref={messagesEndRef} />
      </div>

      <AnimatePresence>
        {typingUsers.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="px-4 py-1 bg-black/40"
          >
            <p className="text-[11px] text-emerald-400 italic" data-testid="text-typing-indicator">
              {typingUsers.length === 1
                ? `${typingUsers[0].name} ${t("vibrapp.typing")}`
                : `${typingUsers.map(u => u.name).join(", ")} ${t("vibrapp.typingMultiple")}`
              }
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {showScrollDown && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-24 right-4 z-30 w-10 h-10 rounded-full bg-gray-800 border border-white/20 flex items-center justify-center shadow-lg"
          data-testid="button-scroll-down"
        >
          <ArrowDown className="w-5 h-5 text-white" />
        </button>
      )}

      <div className="shrink-0 bg-[#1a1a2e] border-t border-white/10" data-testid="vibrapp-input-area">
        <AnimatePresence>
          {replyTo && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="px-4 py-2 bg-black/30 flex items-center justify-between border-b border-white/10"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <Lock className="w-3 h-3 text-purple-400" />
                  <p className="text-[10px] text-purple-400 font-medium">{t("vibrapp.privateReply")} → {replyTo.senderName}</p>
                </div>
                <p className="text-[11px] text-white/50 truncate">{replyTo.content}</p>
              </div>
              <button
                onClick={() => setReplyTo(null)}
                className="ml-2 p-1 text-white/40 hover:text-white"
                data-testid="button-cancel-reply"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-center gap-2 px-3 py-2">
          <input
            ref={inputRef}
            type="text"
            value={inputText}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder={t("vibrapp.placeholder")}
            className="flex-1 bg-white/10 text-white placeholder:text-white/40 rounded-full px-4 py-2.5 text-sm border border-white/10 focus:border-emerald-500 focus:outline-none transition-colors"
            data-testid="input-vibrapp-message"
          />
          <Button
            onClick={sendMessage}
            disabled={!inputText.trim()}
            className="w-10 h-10 rounded-full bg-emerald-600 hover:bg-emerald-500 p-0 shrink-0 disabled:opacity-30"
            data-testid="button-send-message"
          >
            <Send className="w-4 h-4 text-white" />
          </Button>
        </div>
      </div>
    </div>
  );
}

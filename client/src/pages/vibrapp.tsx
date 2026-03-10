import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { io, Socket } from "socket.io-client";
import { useLanguage } from "@/i18n/LanguageContext";
import { Send, Reply, X, ChevronDown, Smile, Check, CheckCheck, ArrowDown, MessageCircle, Lock, Trash2, Paperclip, Image as ImageIcon, Video, ZoomIn, ExternalLink } from "lucide-react";
import { playNotificationSound, initNotificationSound } from "@/lib/notification-sound";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useLocation, useSearch } from "wouter";

interface VibrappMsg {
  id: string;
  senderId: string;
  senderName: string;
  senderImage: string | null;
  content: string | null;
  mediaUrl: string | null;
  mediaType: string | null;
  replyToId: string | null;
  replyToSenderId: string | null;
  replyToName: string | null;
  replyToContent: string | null;
  reactions: string;
  readBy: string[] | null;
  createdAt: string;
}

const REACTION_EMOJIS = ["❤️", "😂", "😮", "😢", "🔥", "👍"];
const MAX_VIDEO_DURATION = 10;

interface IntroTarget {
  id: string;
  name: string;
  age: number;
  imageUrl: string;
}

interface ReceivedColdMsg {
  id: string;
  fromProfileId: string;
  content: string;
  replied: boolean;
  privateRoomId: string | null;
  createdAt: string;
  fromProfile: { id: string; name: string; imageUrl: string; age: number };
}

export default function Vibrapp() {
  const { t } = useLanguage();
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const [messages, setMessages] = useState<VibrappMsg[]>([]);
  const [inputText, setInputText] = useState("");
  const [replyTo, setReplyTo] = useState<VibrappMsg | null>(null);
  const [onlineCount, setOnlineCount] = useState(0);
  const [typingUsers, setTypingUsers] = useState<{ profileId: string; name: string }[]>([]);
  const [showReactionPicker, setShowReactionPicker] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreviewUrl, setMediaPreviewUrl] = useState<string | null>(null);
  const [mediaFileType, setMediaFileType] = useState<"image" | "video" | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [introTarget, setIntroTarget] = useState<IntroTarget | null>(null);
  const [showIntroCompose, setShowIntroCompose] = useState(false);
  const [introText, setIntroText] = useState("");
  const [introColdStatus, setIntroColdStatus] = useState<"idle" | "already_exists" | "sent" | "replied">("idle");
  const [introCheckDone, setIntroCheckDone] = useState(false);
  const [introPrivateRoomId, setIntroPrivateRoomId] = useState<string | null>(null);
  const [introSentContent, setIntroSentContent] = useState<string | null>(null);
  const [introSentAt, setIntroSentAt] = useState<string | null>(null);
  const [selectedColdMsg, setSelectedColdMsg] = useState<ReceivedColdMsg | null>(null);
  const [replyText, setReplyText] = useState("");
  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  const { data: receivedColdMsgs, refetch: refetchColdMsgs } = useQuery<ReceivedColdMsg[]>({
    queryKey: ["/api/cold-messages/received"],
    queryFn: async () => {
      const res = await fetch("/api/cold-messages/received", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!profile,
  });

  const sendColdMsgMutation = useMutation({
    mutationFn: async ({ toProfileId, content }: { toProfileId: string; content: string }) =>
      apiRequest("POST", "/api/cold-messages", { toProfileId, content }),
    onSuccess: (data: any, variables) => {
      const status = data.status === "sent" ? "sent" : data.status === "already_replied" ? "replied" : "already_exists";
      setIntroColdStatus(status);
      if (status === "replied" && data.privateRoomId) setIntroPrivateRoomId(data.privateRoomId);
      if (status === "sent") {
        setIntroSentContent(variables.content);
        setIntroSentAt(new Date().toISOString());
      }
      setShowIntroCompose(false);
      setIntroText("");
    },
  });

  const replyColdMsgMutation = useMutation({
    mutationFn: async ({ id, content }: { id: string; content: string }) =>
      apiRequest("POST", `/api/cold-messages/${id}/reply`, { content }),
    onSuccess: (data: any) => {
      setSelectedColdMsg(null);
      setReplyText("");
      refetchColdMsgs();
      queryClient.invalidateQueries({ queryKey: ["/api/cold-messages/pending-count"] });
      if (data?.privateRoomId) setLocation(`/private-room/${data.privateRoomId}`);
    },
  });

  useEffect(() => {
    const params = new URLSearchParams(searchString);
    const dmId = params.get("dm");
    if (dmId) {
      const raw = sessionStorage.getItem("vibrapp_intro_target");
      if (raw) {
        try {
          const target = JSON.parse(raw) as IntroTarget;
          if (target.id === dmId) {
            setIntroTarget(target);
            setIntroColdStatus("idle");
            setIntroCheckDone(false);
            setIntroPrivateRoomId(null);
          }
        } catch {}
      }
    } else {
      setIntroTarget(null);
    }
  }, [searchString]);

  useEffect(() => {
    if (!introTarget || !profile) return;
    fetch(`/api/cold-messages/check/${introTarget.id}`, { credentials: "include" })
      .then(r => r.json())
      .then((data: { exists: boolean; replied: boolean; privateRoomId: string | null; content: string | null; createdAt: string | null }) => {
        if (data.exists) {
          setIntroColdStatus(data.replied ? "replied" : "already_exists");
          if (data.replied && data.privateRoomId) setIntroPrivateRoomId(data.privateRoomId);
          if (data.content) setIntroSentContent(data.content);
          if (data.createdAt) setIntroSentAt(data.createdAt);
        }
        setIntroCheckDone(true);
      })
      .catch(() => setIntroCheckDone(true));
  }, [introTarget?.id, profile?.id]);

  useEffect(() => {
    if (!profile?.id) return;

    // Mark all vibrapp messages as read in DB, then zero the badge immediately
    fetch("/api/vibrapp/mark-all-read", { method: "POST", credentials: "include" })
      .finally(() => {
        queryClient.setQueryData(["/api/vibrapp/unread-count"], { count: 0 });
        queryClient.setQueryData(["/api/cold-messages/pending-count"], { count: 0 });
        try {
          if ("clearAppBadge" in navigator) (navigator as any).clearAppBadge();
        } catch {}
      });

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
        if (msg.replyToId && msg.replyToSenderId === profile.id) {
          playNotificationSound();
        }
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

    socket.on("vibrapp:message-deleted", (data: { messageId: string }) => {
      setMessages(prev => prev.filter(m => m.id !== data.messageId));
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

  const clearMedia = useCallback(() => {
    if (mediaPreviewUrl) URL.revokeObjectURL(mediaPreviewUrl);
    setMediaFile(null);
    setMediaPreviewUrl(null);
    setMediaFileType(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [mediaPreviewUrl]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");
    if (!isImage && !isVideo) {
      alert("Solo immagini o video supportati");
      return;
    }

    const maxSize = isVideo ? 60 * 1024 * 1024 : 20 * 1024 * 1024;
    if (file.size > maxSize) {
      alert(isVideo ? "Video troppo grande (max 60MB)" : "Immagine troppo grande (max 20MB)");
      return;
    }

    if (isVideo) {
      const videoEl = document.createElement("video");
      videoEl.preload = "metadata";
      const url = URL.createObjectURL(file);
      videoEl.src = url;
      videoEl.onloadedmetadata = () => {
        if (videoEl.duration > MAX_VIDEO_DURATION) {
          URL.revokeObjectURL(url);
          alert(`Il video può durare massimo ${MAX_VIDEO_DURATION} secondi`);
          return;
        }
        if (mediaPreviewUrl) URL.revokeObjectURL(mediaPreviewUrl);
        setMediaFile(file);
        setMediaPreviewUrl(url);
        setMediaFileType("video");
      };
    } else {
      if (mediaPreviewUrl) URL.revokeObjectURL(mediaPreviewUrl);
      const url = URL.createObjectURL(file);
      setMediaFile(file);
      setMediaPreviewUrl(url);
      setMediaFileType("image");
    }
  }, [mediaPreviewUrl]);

  const sendMessage = useCallback(async () => {
    if ((!inputText.trim() && !mediaFile) || !profile || !socketRef.current) return;

    if (mediaFile) {
      setIsUploading(true);
      try {
        const uploadRes = await fetch("/api/vibrapp/request-upload", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contentType: mediaFile.type, size: mediaFile.size }),
        });
        if (!uploadRes.ok) {
          const err = await uploadRes.json();
          alert(err.error || "Errore upload");
          setIsUploading(false);
          return;
        }
        const { uploadURL, objectPath, mediaType } = await uploadRes.json();

        const putRes = await fetch(uploadURL, {
          method: "PUT",
          body: mediaFile,
          headers: { "Content-Type": mediaFile.type },
        });
        if (!putRes.ok) {
          alert("Upload fallito. Riprova.");
          setIsUploading(false);
          return;
        }

        socketRef.current.emit("vibrapp:message", {
          content: inputText.trim() || "",
          mediaUrl: objectPath,
          mediaType,
          replyToId: replyTo?.id,
          replyToName: replyTo?.senderName,
          replyToContent: replyTo?.content?.substring(0, 100),
        });

        clearMedia();
      } catch (err) {
        alert("Errore durante l'upload");
        console.error(err);
      } finally {
        setIsUploading(false);
      }
    } else {
      socketRef.current.emit("vibrapp:message", {
        content: inputText.trim(),
        replyToId: replyTo?.id,
        replyToName: replyTo?.senderName,
        replyToContent: replyTo?.content?.substring(0, 100),
      });
    }

    setInputText("");
    setReplyTo(null);
    inputRef.current?.focus();
  }, [inputText, mediaFile, profile, replyTo, clearMedia]);

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

  const handleDelete = useCallback((messageId: string) => {
    if (!socketRef.current || !profile) return;
    if (!window.confirm(t("vibrapp.deleteConfirm"))) return;
    socketRef.current.emit("vibrapp:delete", { messageId });
  }, [profile, t]);

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

  useEffect(() => {
    if (introTarget && profile && introTarget.id !== profile.id && introColdStatus === "replied" && introPrivateRoomId) {
      sessionStorage.removeItem("vibrapp_intro_target");
      setLocation(`/private-room/${introPrivateRoomId}`);
    }
  }, [introColdStatus, introPrivateRoomId, introTarget?.id, profile?.id]);

  if (!profile) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (introTarget && introTarget.id !== profile?.id) {
    if (introColdStatus === "replied" && introPrivateRoomId) {
      return null;
    }

    const clearIntro = () => {
      sessionStorage.removeItem("vibrapp_intro_target");
      setLocation("/vibrapp");
    };

    return (
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#0a0d1e]" data-testid="vibrapp-dm-page">
        <div className="bg-gradient-to-r from-[#075e54] to-[#128c7e] px-4 py-3 flex items-center gap-3 shrink-0 shadow-lg">
          <button onClick={clearIntro} className="text-white/80 hover:text-white mr-1" data-testid="button-back-vibrapp-dm">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <img src={introTarget.imageUrl} alt={introTarget.name} className="w-10 h-10 rounded-full object-cover border-2 border-white/30" />
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold text-base leading-tight truncate">{introTarget.name}, {introTarget.age}</p>
            <p className="text-white/60 text-xs">Chat diretta privata</p>
          </div>
        </div>

        <div className={`flex-1 flex flex-col ${introColdStatus === "sent" || introColdStatus === "already_exists" ? "" : "items-center justify-center px-6 py-8"}`}>
          {!introCheckDone ? (
            <div className="w-10 h-10 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin" />
          ) : introColdStatus === "sent" || introColdStatus === "already_exists" ? (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto px-4 py-6 flex flex-col gap-4">
                {introSentContent && (
                  <div className="flex justify-end">
                    <div className="max-w-[80%]">
                      <div className="bg-[#005c4b] text-white rounded-xl rounded-tr-sm px-4 py-2.5">
                        <p className="text-[13px] leading-relaxed whitespace-pre-wrap break-words">{introSentContent}</p>
                        <p className="text-[10px] text-white/50 text-right mt-1">
                          {introSentAt ? new Date(introSentAt).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }) : ""}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                <div className="flex justify-center">
                  <div className="flex items-center gap-2 bg-black/40 rounded-full px-4 py-2 text-white/50 text-xs">
                    <span>🔐</span>
                    <span>In attesa che {introTarget.name} risponda</span>
                  </div>
                </div>
              </div>
              <div className="shrink-0 px-4 py-3 bg-[#1a1a2e] border-t border-white/10">
                <p className="text-center text-white/30 text-xs mb-2">Hai già inviato la tua presentazione</p>
                <button onClick={clearIntro} className="w-full text-white/40 text-sm underline underline-offset-4 text-center" data-testid="button-cancel-dm-wait">
                  Torna alla chat generale
                </button>
              </div>
            </div>
          ) : (
            <div className="w-full max-w-md flex flex-col gap-4">
              <div className="flex flex-col items-center gap-3 mb-2">
                <img src={introTarget.imageUrl} alt={introTarget.name} className="w-20 h-20 rounded-full object-cover border-4 border-emerald-500" />
                <div className="text-center">
                  <p className="text-white font-bold text-lg">{introTarget.name}, {introTarget.age}</p>
                  <p className="text-white/50 text-xs mt-0.5">Invia una presentazione per iniziare 🛸</p>
                </div>
              </div>
              <textarea
                className="w-full bg-[#1f2937] text-white text-sm rounded-xl p-4 resize-none outline-none border border-white/10 focus:border-emerald-500/50"
                rows={5}
                maxLength={500}
                placeholder={`Ciao ${introTarget.name}! Mi chiamo... Ho visto il tuo profilo e mi piacerebbe conoscerti 🛸`}
                value={introText}
                onChange={e => setIntroText(e.target.value)}
                data-testid="input-dm-intro-text"
              />
              <p className="text-white/30 text-xs text-right">{introText.length}/500</p>
              <Button
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-3 text-base font-semibold rounded-xl"
                disabled={introText.trim().length < 10 || sendColdMsgMutation.isPending}
                onClick={() => sendColdMsgMutation.mutate({ toProfileId: introTarget.id, content: introText })}
                data-testid="button-send-dm-intro"
              >
                {sendColdMsgMutation.isPending ? "Invio..." : "🛸 Invia presentazione"}
              </Button>
              <button onClick={clearIntro} className="text-white/40 text-sm text-center underline underline-offset-4" data-testid="button-cancel-dm-intro">
                Torna alla chat generale
              </button>
            </div>
          )}
        </div>
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

      {/* ── Intro target banner ──────────────────────────────────────────── */}
      {introTarget && introTarget.id !== profile?.id && (
        <div className="bg-[#0d1f1a] border-b border-emerald-900/30 px-4 py-2.5 shrink-0" data-testid="intro-target-banner">
          <div className="flex items-center gap-3">
            <img src={introTarget.imageUrl} alt={introTarget.name} className="w-9 h-9 rounded-full object-cover border-2 border-emerald-500/50" />
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-semibold leading-tight truncate">{introTarget.name}, {introTarget.age}</p>
              <p className="text-white/50 text-[11px]">
                {introColdStatus === "sent" && "✅ Presentazione inviata — aspetta che risponda"}
                {introColdStatus === "already_exists" && "⏳ Presentazione in attesa di risposta"}
                {introColdStatus === "replied" && "🎉 Ha risposto! Vai alla chat privata"}
                {(introColdStatus === "idle" && introCheckDone) && "Invia una presentazione per iniziare"}
                {(introColdStatus === "idle" && !introCheckDone) && "Caricamento..."}
              </p>
            </div>
            {(introColdStatus === "idle" && introCheckDone) && (
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-3 h-8 shrink-0"
                onClick={() => setShowIntroCompose(true)}
                data-testid="button-send-intro"
              >
                🛸 Scrivi
              </Button>
            )}
            <button onClick={() => { setIntroTarget(null); sessionStorage.removeItem("vibrapp_intro_target"); }} className="text-white/30 hover:text-white/60 ml-1" data-testid="button-dismiss-intro">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Received intros strip ─────────────────────────────────────────── */}
      {receivedColdMsgs && receivedColdMsgs.filter(m => !m.replied).length > 0 && (
        <div className="bg-[#0a0d1e] border-b border-purple-900/30 px-4 py-2 shrink-0" data-testid="received-intros-strip">
          <p className="text-purple-400 text-[10px] font-semibold uppercase tracking-wider mb-1.5">🛸 Presentazioni ricevute</p>
          <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
            {receivedColdMsgs.filter(m => !m.replied).map(msg => (
              <button
                key={msg.id}
                onClick={() => { setSelectedColdMsg(msg); setReplyText(""); }}
                className="flex flex-col items-center gap-1 shrink-0"
                data-testid={`intro-bubble-${msg.id}`}
              >
                <div className="relative">
                  <img src={msg.fromProfile.imageUrl} alt={msg.fromProfile.name} className="w-12 h-12 rounded-full object-cover border-2 border-purple-500" />
                  <span className="absolute -bottom-1 -right-1 text-[14px]">🛸</span>
                </div>
                <span className="text-white/70 text-[10px] truncate max-w-[52px]">{msg.fromProfile.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto px-3 py-2 space-y-1"
        style={{ background: "linear-gradient(180deg, #0b0d1a 0%, #111827 100%)" }}
        onScroll={handleScroll}
        data-testid="vibrapp-messages-container"
      >
        {hasMore && messages.length > 0 && (
          <div className="text-center py-2">
            <button onClick={loadOlderMessages} className="text-xs text-primary hover:underline" data-testid="button-load-more">
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

                      {msg.mediaUrl && msg.mediaType === "image" && (
                        <div
                          className="relative mb-1 rounded-lg overflow-hidden cursor-pointer group/img"
                          onClick={() => setLightboxUrl(msg.mediaUrl!)}
                          data-testid={`media-image-${msg.id}`}
                        >
                          <img
                            src={msg.mediaUrl}
                            alt="immagine"
                            className="max-w-full max-h-64 w-full object-cover rounded-lg"
                            loading="lazy"
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/20 transition-colors flex items-center justify-center">
                            <ZoomIn className="w-6 h-6 text-white opacity-0 group-hover/img:opacity-100 transition-opacity" />
                          </div>
                        </div>
                      )}

                      {msg.mediaUrl && msg.mediaType === "video" && (
                        <div className="mb-1 rounded-lg overflow-hidden" data-testid={`media-video-${msg.id}`}>
                          <video
                            src={msg.mediaUrl}
                            controls
                            playsInline
                            className="max-w-full max-h-64 w-full rounded-lg bg-black"
                            style={{ maxWidth: "260px" }}
                          />
                        </div>
                      )}

                      {msg.content && (
                        <p className="text-[13px] leading-relaxed break-words whitespace-pre-wrap">{msg.content}</p>
                      )}

                      <div className={`flex items-center gap-1 mt-0.5 justify-end`}>
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

                    <div className={`absolute top-0 ${mine ? "-left-20" : "-right-20"} opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5`}>
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
                      {mine && (
                        <button
                          onClick={() => handleDelete(msg.id)}
                          className="p-1 rounded-full hover:bg-red-500/20 text-white/50 hover:text-red-400"
                          title={t("vibrapp.delete")}
                          data-testid={`button-delete-${msg.id}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
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
              <button onClick={() => setReplyTo(null)} className="ml-2 p-1 text-white/40 hover:text-white" data-testid="button-cancel-reply">
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {mediaPreviewUrl && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="px-3 py-2 bg-black/30 border-b border-white/10 flex items-center gap-3"
              data-testid="media-preview-bar"
            >
              <div className="relative shrink-0">
                {mediaFileType === "image" ? (
                  <img src={mediaPreviewUrl} alt="preview" className="w-16 h-16 object-cover rounded-lg" data-testid="media-preview-image" />
                ) : (
                  <div className="w-16 h-16 rounded-lg bg-black/50 flex flex-col items-center justify-center border border-white/20" data-testid="media-preview-video">
                    <Video className="w-6 h-6 text-emerald-400" />
                    <span className="text-[9px] text-white/60 mt-0.5">Video</span>
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-white/70 truncate">{mediaFile?.name}</p>
                <p className="text-[10px] text-white/40">
                  {mediaFileType === "image" ? <ImageIcon className="w-3 h-3 inline mr-1" /> : <Video className="w-3 h-3 inline mr-1" />}
                  {((mediaFile?.size || 0) / (1024 * 1024)).toFixed(1)} MB
                </p>
              </div>
              <button onClick={clearMedia} className="p-1.5 rounded-full bg-white/10 hover:bg-red-500/30 text-white/60 hover:text-red-400 transition-colors" data-testid="button-remove-media">
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-center gap-2 px-3 py-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            className="hidden"
            onChange={handleFileSelect}
            data-testid="input-file-media"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white/60 hover:text-emerald-400 hover:bg-white/20 transition-colors shrink-0"
            data-testid="button-attach-media"
            title="Allega immagine o video"
          >
            <Paperclip className="w-4 h-4" />
          </button>
          <input
            ref={inputRef}
            onFocus={() => initNotificationSound()}
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
            disabled={(!inputText.trim() && !mediaFile) || isUploading}
            className="w-10 h-10 rounded-full bg-emerald-600 hover:bg-emerald-500 p-0 shrink-0 disabled:opacity-30"
            data-testid="button-send-message"
          >
            {isUploading ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Send className="w-4 h-4 text-white" />
            )}
          </Button>
        </div>
      </div>

      {/* ── Intro compose modal ──────────────────────────────────────────── */}
      <AnimatePresence>
        {showIntroCompose && introTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[150] bg-black/70 flex items-end justify-center"
            onClick={() => setShowIntroCompose(false)}
            data-testid="intro-compose-overlay"
          >
            <motion.div
              initial={{ y: 60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 60, opacity: 0 }}
              className="bg-[#111827] rounded-t-2xl w-full max-w-lg p-5 pb-8"
              onClick={e => e.stopPropagation()}
              data-testid="intro-compose-panel"
            >
              <div className="flex items-center gap-3 mb-4">
                <img src={introTarget.imageUrl} alt={introTarget.name} className="w-12 h-12 rounded-full object-cover border-2 border-emerald-500" />
                <div>
                  <p className="text-white font-bold">{introTarget.name}, {introTarget.age}</p>
                  <p className="text-white/50 text-xs">Presentazione — max 500 caratteri</p>
                </div>
              </div>
              <textarea
                className="w-full bg-[#1f2937] text-white text-sm rounded-xl p-3 resize-none outline-none border border-white/10 focus:border-emerald-500/50 mb-4"
                rows={4}
                maxLength={500}
                placeholder="Ciao! Mi chiamo... Ho visto il tuo profilo e mi piacerebbe conoscerti 🛸"
                value={introText}
                onChange={e => setIntroText(e.target.value)}
                data-testid="input-intro-text"
              />
              <div className="flex gap-2">
                <Button variant="ghost" className="flex-1 text-white/60" onClick={() => setShowIntroCompose(false)} data-testid="button-cancel-intro">
                  Annulla
                </Button>
                <Button
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white"
                  disabled={introText.trim().length < 10 || sendColdMsgMutation.isPending}
                  onClick={() => sendColdMsgMutation.mutate({ toProfileId: introTarget.id, content: introText })}
                  data-testid="button-confirm-intro"
                >
                  {sendColdMsgMutation.isPending ? "Invio..." : "🛸 Invia presentazione"}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Reply to cold message modal ───────────────────────────────────── */}
      <AnimatePresence>
        {selectedColdMsg && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[150] bg-black/70 flex items-end justify-center"
            onClick={() => setSelectedColdMsg(null)}
            data-testid="coldmsg-reply-overlay"
          >
            <motion.div
              initial={{ y: 60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 60, opacity: 0 }}
              className="bg-[#111827] rounded-t-2xl w-full max-w-lg p-5 pb-8"
              onClick={e => e.stopPropagation()}
              data-testid="coldmsg-reply-panel"
            >
              <div className="flex items-center gap-3 mb-3">
                <img src={selectedColdMsg.fromProfile.imageUrl} alt={selectedColdMsg.fromProfile.name} className="w-12 h-12 rounded-full object-cover border-2 border-purple-500" />
                <div>
                  <p className="text-white font-bold">{selectedColdMsg.fromProfile.name}, {selectedColdMsg.fromProfile.age}</p>
                  <p className="text-white/50 text-xs">Ti ha inviato una presentazione</p>
                </div>
              </div>
              <div className="bg-[#1f2937] rounded-xl p-3 mb-4 border border-purple-500/20">
                <p className="text-white/80 text-sm">{selectedColdMsg.content}</p>
              </div>
              <p className="text-white/50 text-xs mb-2">La tua risposta apre una chat privata 🔐</p>
              <textarea
                className="w-full bg-[#1f2937] text-white text-sm rounded-xl p-3 resize-none outline-none border border-white/10 focus:border-purple-500/50 mb-4"
                rows={3}
                maxLength={500}
                placeholder="Ciao! Anche tu mi hai incuriosito/a..."
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                data-testid="input-cold-reply"
              />
              <div className="flex gap-2">
                <Button variant="ghost" className="flex-1 text-white/60" onClick={() => setSelectedColdMsg(null)} data-testid="button-cancel-cold-reply">
                  Chiudi
                </Button>
                <Button
                  className="flex-1 bg-purple-600 hover:bg-purple-500 text-white"
                  disabled={replyText.trim().length < 5 || replyColdMsgMutation.isPending}
                  onClick={() => replyColdMsgMutation.mutate({ id: selectedColdMsg.id, content: replyText })}
                  data-testid="button-confirm-cold-reply"
                >
                  {replyColdMsgMutation.isPending ? "Apertura..." : "🔐 Apri chat privata"}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {lightboxUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/95 flex items-center justify-center"
            onClick={() => setLightboxUrl(null)}
            data-testid="lightbox-overlay"
          >
            <button
              className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white"
              onClick={() => setLightboxUrl(null)}
              data-testid="button-close-lightbox"
            >
              <X className="w-5 h-5" />
            </button>
            <motion.img
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.85, opacity: 0 }}
              src={lightboxUrl}
              alt=""
              className="max-w-[95vw] max-h-[90vh] object-contain rounded-xl"
              onClick={(e) => e.stopPropagation()}
              data-testid="lightbox-image"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

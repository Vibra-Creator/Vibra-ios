import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useVibrappSocket } from "@/contexts/VibrappSocketContext";
import { useLanguage } from "@/i18n/LanguageContext";
import { Send, Reply, X, ChevronDown, Smile, Check, CheckCheck, ArrowDown, MessageCircle, Lock, Trash2, Paperclip, Image as ImageIcon, Video, ZoomIn, ExternalLink, Mic, Square, MicOff, ShieldBan, Flag } from "lucide-react";
import { playNotificationSound, initNotificationSound } from "@/lib/notification-sound";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useLocation, useSearch } from "wouter";
import { ProfileDetailModal } from "@/components/SwipeCard";

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
const MAX_VIDEO_DURATION = 12;
const isLegacyIntroFullscreenEnabled = (): boolean => false;

interface DmTarget { id: string; name: string; age: number; imageUrl: string }
interface DmMessage { id: string; fromProfileId: string; toProfileId: string; content: string; readAt: string | null; createdAt: string; senderName?: string; senderImage?: string | null }

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
  mediaUrl: string | null;
  mediaType: string | null;
  replied: boolean;
  replyContent?: string | null;
  privateRoomId: string | null;
  createdAt: string;
  fromProfile: { id: string; name: string; imageUrl: string; age: number };
}

interface SentColdMsg {
  id: string;
  toProfileId: string;
  content: string;
  mediaUrl: string | null;
  mediaType: string | null;
  replied: boolean;
  replyContent: string | null;
  privateRoomId: string | null;
  createdAt: string;
  toProfile: { id: string; name: string; imageUrl: string; age: number };
}

export default function Vibrapp() {
  const { t } = useLanguage();
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const [messages, setMessages] = useState<VibrappMsg[]>([]);
  const [inputText, setInputText] = useState("");
  const [replyTo, setReplyTo] = useState<VibrappMsg | null>(null);
  const [notificationMatchId, setNotificationMatchId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Array<{id: string; name: string; age: number; imageUrl: string}>>([]);
  const [typingUsers, setTypingUsers] = useState<{ profileId: string; name: string }[]>([]);
  const [showReactionPicker, setShowReactionPicker] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreviewUrl, setMediaPreviewUrl] = useState<string | null>(null);
  const [mediaFileType, setMediaFileType] = useState<"image" | "video" | "audio" | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [introTarget, setIntroTarget] = useState<IntroTarget | null>(null);
  const [showIntroCompose, setShowIntroCompose] = useState(false);
  const [introText, setIntroText] = useState("");
  const [introColdStatus, setIntroColdStatus] = useState<"idle" | "already_exists" | "sent" | "replied">("idle");
  const [introCheckDone, setIntroCheckDone] = useState(false);
  const [introSentContent, setIntroSentContent] = useState<string | null>(null);
  const [introSentAt, setIntroSentAt] = useState<string | null>(null);
  const [introColdMessageId, setIntroColdMessageId] = useState<string | null>(null);
  const [selectedColdMsg, setSelectedColdMsg] = useState<ReceivedColdMsg | null>(null);
  const [replyText, setReplyText] = useState("");
  const [introIsRecording, setIntroIsRecording] = useState(false);
  const [introRecordingDuration, setIntroRecordingDuration] = useState(0);
  const [introAudioFile, setIntroAudioFile] = useState<File | null>(null);
  const [introAudioUrl, setIntroAudioUrl] = useState<string | null>(null);
  const [introIsUploading, setIntroIsUploading] = useState(false);
  const [viewedSenderProfile, setViewedSenderProfile] = useState<any | null>(null);
  const [returnToColdMsg, setReturnToColdMsg] = useState<ReceivedColdMsg | null>(null);
  const [returnToSentColdMessageId, setReturnToSentColdMessageId] = useState<string | null>(null);
  const [loadingSenderProfile, setLoadingSenderProfile] = useState(false);
  const [senderProfileToast, setSenderProfileToast] = useState<string | null>(null);
  const senderProfileToastTimerRef = useRef<NodeJS.Timeout | null>(null);
  const showSenderProfileToast = useCallback((message: string) => {
    if (senderProfileToastTimerRef.current) clearTimeout(senderProfileToastTimerRef.current);
    setSenderProfileToast(message);
    senderProfileToastTimerRef.current = setTimeout(() => setSenderProfileToast(null), 3500);
  }, []);
  const introMediaRecorderRef = useRef<MediaRecorder | null>(null);
  const introAudioChunksRef = useRef<Blob[]>([]);
  const introRecordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [newMsgBanner, setNewMsgBanner] = useState<{ name: string; text: string } | null>(null);
  const newMsgBannerTimerRef = useRef<NodeJS.Timeout | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isAtBottomRef = useRef(true);
  const replyInputRef = useRef<HTMLTextAreaElement>(null);

  // ─── Vibrapp DM (1:1 direct messages) ───────────────────────────────────
  const [dmTarget, setDmTarget] = useState<DmTarget | null>(null);
  const [dmMessages, setDmMessages] = useState<DmMessage[]>([]);
  const [dmInput, setDmInput] = useState("");
  const [dmLoading, setDmLoading] = useState(false);
  const [dmBotTyping, setDmBotTyping] = useState<{ name: string; image: string | null } | null>(null);
  const dmMessagesEndRef = useRef<HTMLDivElement>(null);
  const dmInputRef = useRef<HTMLInputElement>(null);
  const dmTargetRef = useRef<DmTarget | null>(null);

  // ─── Shared global socket (stays alive across all pages) ─────────────────
  const {
    socketRef,
    socketConnected,
    onlineCount,
    dmUnreadCount,
    setDmUnreadCount,
    dmBanner,
    clearDmBanner,
    showDmBanner,
    registerDmHandler,
  } = useVibrappSocket();

  const { data: profile } = useQuery({
    queryKey: ["/api/profiles/me"],
    queryFn: async () => {
      const res = await fetch("/api/profiles/me", { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
  });

  const { data: myReports } = useQuery<{ id: string; reportedId: string }[]>({
    queryKey: ["/api/reports/mine"],
    queryFn: async () => {
      const res = await fetch("/api/reports/mine", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!profile,
    staleTime: 60_000,
  });

  const reportedProfileIds = new Set((myReports ?? []).map(r => r.reportedId));

  const { data: receivedColdMsgs, refetch: refetchColdMsgs } = useQuery<ReceivedColdMsg[]>({
    queryKey: ["/api/cold-messages/received"],
    queryFn: async () => {
      const res = await fetch("/api/cold-messages/received", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!profile,
  });

  const { data: sentColdMsgs, refetch: refetchSentColdMsgs } = useQuery<SentColdMsg[]>({
    queryKey: ["/api/cold-messages/sent"],
    queryFn: async () => {
      const res = await fetch("/api/cold-messages/sent", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!profile,
    refetchInterval: 30_000,
  });

  const sendColdMsgMutation = useMutation({
    mutationFn: async ({ toProfileId, content, mediaUrl, mediaType }: { toProfileId: string; content: string; mediaUrl?: string; mediaType?: string }) =>
      apiRequest("POST", "/api/cold-messages", { toProfileId, content, mediaUrl, mediaType }),
    onSuccess: (data: any, variables) => {
      const status = data.status === "sent" ? "sent" : data.status === "already_replied" ? "replied" : "already_exists";
      setIntroColdStatus(status);
      if (status === "sent") {
        setIntroSentContent(variables.content);
        setIntroSentAt(new Date().toISOString());
      }
      setShowIntroCompose(false);
      setIntroText("");
      if (introAudioUrl) { URL.revokeObjectURL(introAudioUrl); setIntroAudioFile(null); setIntroAudioUrl(null); }
    },
    onError: (err: any) => {
      alert(err?.message || "Errore nell'invio della presentazione. Riprova.");
    },
  });

  const replyColdMsgMutation = useMutation({
    mutationFn: async ({ id, content }: { id: string; content: string }) =>
      apiRequest("POST", `/api/cold-messages/${id}/reply`, { content }),
    onSuccess: () => {
      const sender = selectedColdMsg?.fromProfile;
      setSelectedColdMsg(null);
      setReplyText("");
      refetchColdMsgs();
      queryClient.invalidateQueries({ queryKey: ["/api/cold-messages/pending-count"] });
      if (sender) {
        openDmPanel({
          id: sender.id,
          name: sender.name,
          age: sender.age,
          imageUrl: sender.imageUrl || "",
        });
      }
    },
    onError: (err: any) => {
      // apiRequest includes the JSON error body in Error.message. The sender
      // can disappear or block us after the reply panel was opened, so show
      // the same unavailable-message toast used by the GET re-validation.
      const errorMessage = typeof err?.message === "string" ? err.message : "";
      if (/"reason"\s*:\s*"(sender_deleted|sender_blocked)"/.test(errorMessage)) {
        setSelectedColdMsg(null);
        setReplyText("");
        showSenderProfileToast("Questo messaggio non è più disponibile");
        refetchColdMsgs();
        queryClient.invalidateQueries({ queryKey: ["/api/cold-messages/pending-count"] });
        return;
      }
      alert("Errore nell'invio della risposta. Riprova.");
    },
  });

  const openColdMessage = useCallback((msg: ReceivedColdMsg) => {
    setSelectedColdMsg(msg);
    setReplyText("");
    setColdMsgDeleteConfirm(false);
    setColdMsgBlockConfirm(false);
    setColdMsgReportConfirm(false);
    setReportReason("");
  }, []);

  const refreshSelectedColdMessage = useCallback(async (msg: ReceivedColdMsg) => {
    const res = await fetch(`/api/cold-messages/${msg.id}`, { credentials: "include" });
    if (!res.ok) {
      // If the server explicitly tells us the sender is gone or has blocked us,
      // suppress the reply panel and show the unavailability toast instead.
      try {
        const errData = await res.json();
        if (errData?.reason === "sender_deleted" || errData?.reason === "sender_blocked" || errData?.reason === "message_deleted") {
          setSelectedColdMsg(null);
          showSenderProfileToast("Questo messaggio non è più disponibile");
          return;
        }
      } catch { /* ignore parse errors */ }
      // For any other error (network issues, unknown errors) fall back to showing
      // the panel so the user doesn't lose context.
      setSelectedColdMsg(msg);
      setReplyText("");
      setColdMsgDeleteConfirm(false);
      setColdMsgBlockConfirm(false);
      setColdMsgReportConfirm(false);
      setReportReason("");
      return;
    }
    const data = await res.json();
    if (!data?.otherProfile) {
      setSelectedColdMsg(null);
      showSenderProfileToast("Questo messaggio non è più disponibile");
      return;
    }
    setSelectedColdMsg({
      ...msg,
      content: data.content ?? msg.content,
      mediaUrl: data.mediaUrl ?? msg.mediaUrl,
      mediaType: data.mediaType ?? msg.mediaType,
      replied: data.replied ?? msg.replied,
      replyContent: data.replyContent ?? msg.replyContent,
      privateRoomId: data.privateRoomId ?? msg.privateRoomId,
    });
    setReplyText("");
    setColdMsgDeleteConfirm(false);
    setColdMsgBlockConfirm(false);
    setColdMsgReportConfirm(false);
    setReportReason("");
  }, [showSenderProfileToast]);

  const [coldMsgDeleteConfirm, setColdMsgDeleteConfirm] = useState(false);
  const [coldMsgBlockConfirm, setColdMsgBlockConfirm] = useState(false);
  const [coldMsgReportConfirm, setColdMsgReportConfirm] = useState(false);
  const [reportReason, setReportReason] = useState("");

  const blockSenderMutation = useMutation({
    mutationFn: async ({ blockedId, coldMsgId }: { blockedId: string; coldMsgId: string }) => {
      await apiRequest("POST", "/api/block", { blockedId });
      await apiRequest("DELETE", `/api/cold-messages/${coldMsgId}`);
    },
    onSuccess: () => {
      setSelectedColdMsg(null);
      setColdMsgBlockConfirm(false);
      refetchColdMsgs();
      queryClient.invalidateQueries({ queryKey: ["/api/cold-messages/pending-count"] });
      queryClient.invalidateQueries({ queryKey: ["/api/profiles/swipable"] });
    },
    onError: () => {
      alert("Errore nel blocco dell'utente. Riprova.");
    },
  });

  const reportSenderMutation = useMutation({
    mutationFn: async ({ reportedId, reason, coldMsgId, alsoBlock }: { reportedId: string; reason: string; coldMsgId: string; alsoBlock: boolean }) => {
      await apiRequest("POST", "/api/reports", {
        reportedId,
        reason,
        coldMessageId: coldMsgId,
        reportedContentType: "cold_message",
        reportedContentId: coldMsgId,
      });
      if (alsoBlock) {
        await apiRequest("POST", "/api/block", { blockedId: reportedId });
        await apiRequest("DELETE", `/api/cold-messages/${coldMsgId}`);
      }
    },
    onSuccess: (_data, variables) => {
      setSelectedColdMsg(null);
      setColdMsgReportConfirm(false);
      setReportReason("");
      // Keep the "already reported" banner accurate immediately after reporting
      queryClient.invalidateQueries({ queryKey: ["/api/reports/mine"] });
      if (variables.alsoBlock) {
        refetchColdMsgs();
        queryClient.invalidateQueries({ queryKey: ["/api/cold-messages/pending-count"] });
        queryClient.invalidateQueries({ queryKey: ["/api/profiles/swipable"] });
      }
    },
    onError: () => {
      alert("Errore nell'invio della segnalazione. Riprova.");
    },
  });

  const deleteColdMsgMutation = useMutation({
    mutationFn: async (id: string) =>
      apiRequest("DELETE", `/api/cold-messages/${id}`),
    onSuccess: () => {
      setSelectedColdMsg(null);
      setColdMsgDeleteConfirm(false);
      refetchColdMsgs();
      queryClient.invalidateQueries({ queryKey: ["/api/cold-messages/pending-count"] });
    },
    onError: () => {
      alert("Errore nella cancellazione. Riprova.");
    },
  });

  useEffect(() => {
    const params = new URLSearchParams(searchString);
    const dmId = params.get("dm");
    const matchId = params.get("matchId");
    const coldMessageId = params.get("coldMessageId");
    
    if (matchId) {
      setNotificationMatchId(matchId);
    }
    
    if (dmId) {
      // Push deeplink: open DM panel with the sender
      // Fetch their profile from the profiles endpoint
      fetch(`/api/profiles/${dmId}`, { credentials: "include" })
        .then(r => r.ok ? r.json() : null)
        .then((p: any) => {
          if (p) {
            setDmTarget({
              id: p.id,
              name: p.name,
              age: p.age,
              imageUrl: p.imageUrl || "",
            });
          }
        })
        .catch(() => {});
    } else {
      setIntroTarget(null);
    }
    
    if (coldMessageId) {
      setIntroCheckDone(false);
      setIntroTarget(null);
      setSelectedColdMsg(null);
      setIntroColdMessageId(coldMessageId);
      // Always validate the exact message ID: a cached profile alone cannot tell
      // whether the message was deleted after a notification or prior visit.
      fetch(`/api/cold-messages/${coldMessageId}`, { credentials: "include" })
        .then(async (res) => {
          if (res.ok) return res.json();
          const error = await res.json().catch(() => null);
          if (error?.reason === "message_deleted") {
            setIntroTarget(null);
            setIntroSentContent(null);
            setIntroSentAt(null);
            setIntroColdMessageId(null);
            setIntroCheckDone(true);
            showSenderProfileToast("Questo messaggio non è più disponibile");
          }
          return null;
        })
        .then((data: any) => {
          if (!data) return;
          if (!data.otherProfile) {
            setIntroTarget(null);
            setIntroSentContent(null);
            setIntroSentAt(null);
            setIntroColdMessageId(null);
            setIntroCheckDone(true);
            showSenderProfileToast("Questo messaggio non è più disponibile");
            return;
          }
          const target: IntroTarget = {
            id: data.otherProfile.id,
            name: data.otherProfile.name,
            age: data.otherProfile.age,
            imageUrl: data.otherProfile.imageUrl || "",
          };

          if (!data.isSentByMe && !data.replied) {
            setIntroColdMessageId(null);
            setIntroSentContent(null);
            setIntroSentAt(null);
            setSelectedColdMsg({
              id: data.id || coldMessageId,
              fromProfileId: data.fromProfileId,
              content: data.content || "",
              mediaUrl: data.mediaUrl || null,
              mediaType: data.mediaType || null,
              replied: Boolean(data.replied),
              replyContent: data.replyContent || null,
              privateRoomId: data.privateRoomId || null,
              createdAt: data.createdAt,
              fromProfile: target,
            });
            setReplyText("");
            setColdMsgDeleteConfirm(false);
            setColdMsgBlockConfirm(false);
            setColdMsgReportConfirm(false);
            setReportReason("");
            setIntroCheckDone(true);
            return;
          }

          setIntroTarget(target);
          if (data.replied) {
            setIntroColdStatus("replied");
          } else {
            setIntroColdStatus(data.isSentByMe ? "already_exists" : "idle");
          }
          if (data.content) setIntroSentContent(data.content);
          if (data.createdAt) setIntroSentAt(data.createdAt);
          setIntroCheckDone(true);
        })
        .catch(() => {});
    } else {
      setIntroColdMessageId(null);
    }
  }, [searchString, showSenderProfileToast]);

  useEffect(() => {
    if (!introTarget || !profile) return;
    fetch(`/api/cold-messages/check/${introTarget.id}`, { credentials: "include" })
      .then(r => r.json())
      .then((data: { exists: boolean; replied: boolean; privateRoomId: string | null; content: string | null; createdAt: string | null }) => {
        if (data.exists) {
          setIntroColdStatus(data.replied ? "replied" : "already_exists");
          if (data.content) setIntroSentContent(data.content);
          if (data.createdAt) setIntroSentAt(data.createdAt);
          setShowIntroCompose(false);
        }
        setIntroCheckDone(true);
      })
      .catch(() => setIntroCheckDone(true));
  }, [introTarget?.id, profile?.id]);

  // Keep dmTargetRef in sync with dmTarget state (for use in socket closure)
  useEffect(() => {
    dmTargetRef.current = dmTarget;
    if (dmTarget && profile?.id) {
      setDmLoading(true);
      setDmMessages([]);
      fetch(`/api/vibrapp-dm/thread/${dmTarget.id}`, { credentials: "include" })
        .then(r => r.json())
        .then((msgs: any[]) => {
          setDmMessages(msgs);
          setTimeout(() => dmMessagesEndRef.current?.scrollIntoView({ behavior: "instant" as ScrollBehavior }), 80);
        })
        .catch(() => {})
        .finally(() => setDmLoading(false));
    }
  }, [dmTarget?.id, profile?.id]);

  // Fetch DM unread count on load
  useEffect(() => {
    if (!profile?.id) return;
    fetch("/api/vibrapp-dm/unread-count", { credentials: "include" })
      .then(r => r.json())
      .then(d => setDmUnreadCount(d.count ?? 0))
      .catch(() => {});
  }, [profile?.id]);

  // Search users by name with debounce
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/profiles?search=${encodeURIComponent(searchQuery)}`, { credentials: "include" });
        if (res.ok) {
          const profiles = await res.json();
          setSearchResults(profiles.filter((p: any) => p.id !== profile?.id).slice(0, 8));
        }
      } catch (err) {
        console.error("[vibrapp] search error:", err);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, profile?.id]);

  // ── Load initial messages when user profile is ready ────────────────────
  useEffect(() => {
    if (!profile?.id) return;
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
  }, [profile?.id]);

  // ── Attach socket listeners on the shared global socket ──────────────────
  // Depends on socketConnected so listeners are (re)attached after reconnects
  useEffect(() => {
    if (!profile?.id || !socketConnected) return;
    const socket = socketRef.current;
    if (!socket) return;

    const handleNewMessage = (msg: VibrappMsg) => {
      setMessages(prev => {
        if (prev.some(m => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      if (isAtBottomRef.current) setTimeout(() => scrollToBottom(), 50);
      if (msg.senderId !== profile.id) {
        socket.emit("vibrapp:read", { messageId: msg.id });
        playNotificationSound();
        if (!isAtBottomRef.current) {
          const preview = msg.content ? msg.content.substring(0, 60) : "🖼️ Media";
          setNewMsgBanner({ name: msg.senderName, text: preview });
          if (newMsgBannerTimerRef.current) clearTimeout(newMsgBannerTimerRef.current);
          newMsgBannerTimerRef.current = setTimeout(() => setNewMsgBanner(null), 5000);
        }
      }
    };

    const handleTypingUpdate = (users: { profileId: string; name: string }[]) => {
      setTypingUsers(users.filter(u => u.profileId !== profile.id));
    };

    const handleMessageRead = (data: { messageId: string; profileId: string }) => {
      setMessages(prev => prev.map(m => {
        if (m.id === data.messageId) {
          const readBy = m.readBy || [];
          if (!readBy.includes(data.profileId)) return { ...m, readBy: [...readBy, data.profileId] };
        }
        return m;
      }));
    };

    const handleReactionUpdate = (data: { messageId: string; reactions: Record<string, string[]> }) => {
      setMessages(prev => prev.map(m =>
        m.id === data.messageId ? { ...m, reactions: JSON.stringify(data.reactions) } : m
      ));
    };

    const handleMessageDeleted = (data: { messageId: string }) => {
      setMessages(prev => prev.filter(m => m.id !== data.messageId));
    };

    // dm-sent: server sends ONLY to the sender — update the open DM panel
    const handleDmSent = (msg: any) => {
      const target = dmTargetRef.current;
      if (!target) return;
      if (msg.fromProfileId === profile.id && msg.toProfileId === target.id) {
        setDmMessages(prev => {
          if (prev.some(m => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        setTimeout(() => dmMessagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
      }
    };

    const handleDmBotTyping = (data: { fromProfileId: string; name: string; image: string | null }) => {
      const target = dmTargetRef.current;
      if (target && data.fromProfileId === target.id) {
        setDmBotTyping({ name: data.name, image: data.image });
        setTimeout(() => dmMessagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
      }
    };

    const handleDmBotTypingStop = (data: { fromProfileId: string }) => {
      const target = dmTargetRef.current;
      if (target && data.fromProfileId === target.id) {
        setDmBotTyping(null);
      }
    };

    socket.on("vibrapp:new-message", handleNewMessage);
    socket.on("vibrapp:typing-update", handleTypingUpdate);
    socket.on("vibrapp:message-read", handleMessageRead);
    socket.on("vibrapp:reaction-update", handleReactionUpdate);
    socket.on("vibrapp:message-deleted", handleMessageDeleted);
    socket.on("vibrapp:dm-sent", handleDmSent);
    socket.on("vibrapp:dm-bot-typing", handleDmBotTyping);
    socket.on("vibrapp:dm-bot-typing-stop", handleDmBotTypingStop);

    // Register DM handler with global context so we intercept dm-message events
    // while the user is on this page (instead of the generic global banner)
    registerDmHandler((msg) => {
      const target = dmTargetRef.current;
      const isOpenThread = target && msg.fromProfileId === target.id && msg.toProfileId === profile.id;
      if (isOpenThread) {
        setDmBotTyping(null);
        setDmMessages(prev => {
          if (prev.some(m => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        setTimeout(() => dmMessagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
        fetch(`/api/vibrapp-dm/read/${msg.fromProfileId}`, { method: "POST", credentials: "include" }).catch(() => {});
      } else {
        // DM from someone else while a different thread is open — show global banner
        showDmBanner(
          msg.senderName || "Qualcuno",
          msg.content ? msg.content.substring(0, 60) : "📩 Messaggio",
          msg.fromProfileId
        );
      }
    });

    return () => {
      socket.off("vibrapp:new-message", handleNewMessage);
      socket.off("vibrapp:typing-update", handleTypingUpdate);
      socket.off("vibrapp:message-read", handleMessageRead);
      socket.off("vibrapp:reaction-update", handleReactionUpdate);
      socket.off("vibrapp:message-deleted", handleMessageDeleted);
      socket.off("vibrapp:dm-sent", handleDmSent);
      socket.off("vibrapp:dm-bot-typing", handleDmBotTyping);
      socket.off("vibrapp:dm-bot-typing-stop", handleDmBotTypingStop);
      registerDmHandler(null);
      if (newMsgBannerTimerRef.current) clearTimeout(newMsgBannerTimerRef.current);
    };
  }, [profile?.id, socketConnected, registerDmHandler, showDmBanner]);

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

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/ogg";
      const recorder = new MediaRecorder(stream, { mimeType });
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.start(100);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordingDuration(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration(d => d + 1);
      }, 1000);
    } catch {
      alert("Impossibile accedere al microfono. Controlla i permessi.");
    }
  }, []);

  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    recorder.onstop = () => {
      const baseMime = (recorder.mimeType || "audio/webm").split(";")[0];
      const blob = new Blob(audioChunksRef.current, { type: baseMime });
      const ext = baseMime.includes("ogg") ? "ogg" : "webm";
      const file = new File([blob], `vocale_${Date.now()}.${ext}`, { type: baseMime });
      const url = URL.createObjectURL(blob);
      if (mediaPreviewUrl) URL.revokeObjectURL(mediaPreviewUrl);
      setMediaFile(file);
      setMediaPreviewUrl(url);
      setMediaFileType("audio");
    };
    recorder.stop();
    recorder.stream.getTracks().forEach(t => t.stop());
    setIsRecording(false);
    setRecordingDuration(0);
    mediaRecorderRef.current = null;
  }, [mediaPreviewUrl]);

  const cancelRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;
    recorder.stop();
    recorder.stream.getTracks().forEach(t => t.stop());
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    mediaRecorderRef.current = null;
    audioChunksRef.current = [];
    setIsRecording(false);
    setRecordingDuration(0);
  }, []);

  const introStartRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/ogg";
      const recorder = new MediaRecorder(stream, { mimeType });
      introAudioChunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) introAudioChunksRef.current.push(e.data); };
      recorder.start(100);
      introMediaRecorderRef.current = recorder;
      setIntroIsRecording(true);
      setIntroRecordingDuration(0);
      introRecordingTimerRef.current = setInterval(() => setIntroRecordingDuration(d => d + 1), 1000);
    } catch {
      alert("Impossibile accedere al microfono. Controlla i permessi.");
    }
  }, []);

  const introStopRecording = useCallback(() => {
    const recorder = introMediaRecorderRef.current;
    if (!recorder) return;
    if (introRecordingTimerRef.current) clearInterval(introRecordingTimerRef.current);
    recorder.onstop = () => {
      const baseMime = (recorder.mimeType || "audio/webm").split(";")[0];
      const blob = new Blob(introAudioChunksRef.current, { type: baseMime });
      const ext = baseMime.includes("ogg") ? "ogg" : "webm";
      const file = new File([blob], `vocale_intro_${Date.now()}.${ext}`, { type: baseMime });
      const url = URL.createObjectURL(blob);
      if (introAudioUrl) URL.revokeObjectURL(introAudioUrl);
      setIntroAudioFile(file);
      setIntroAudioUrl(url);
    };
    recorder.stop();
    recorder.stream.getTracks().forEach(t => t.stop());
    setIntroIsRecording(false);
    setIntroRecordingDuration(0);
    introMediaRecorderRef.current = null;
  }, [introAudioUrl]);

  const introCancelRecording = useCallback(() => {
    const recorder = introMediaRecorderRef.current;
    if (!recorder) return;
    recorder.stop();
    recorder.stream.getTracks().forEach(t => t.stop());
    if (introRecordingTimerRef.current) clearInterval(introRecordingTimerRef.current);
    introMediaRecorderRef.current = null;
    introAudioChunksRef.current = [];
    setIntroIsRecording(false);
    setIntroRecordingDuration(0);
  }, []);

  const introClearAudio = useCallback(() => {
    if (introAudioUrl) URL.revokeObjectURL(introAudioUrl);
    setIntroAudioFile(null);
    setIntroAudioUrl(null);
  }, [introAudioUrl]);

  const introSubmit = useCallback(async () => {
    if (!introTarget) return;
    if (introAudioFile) {
      setIntroIsUploading(true);
      try {
        const uploadRes = await fetch("/api/vibrapp/request-upload", {
          method: "POST", credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contentType: introAudioFile.type, size: introAudioFile.size }),
        });
        if (!uploadRes.ok) { alert("Errore upload audio"); return; }
        const { uploadURL, objectPath, mediaType } = await uploadRes.json();
        const putRes = await fetch(uploadURL, { method: "PUT", body: introAudioFile, headers: { "Content-Type": introAudioFile.type } });
        if (!putRes.ok) { alert("Upload fallito. Riprova."); return; }
        sendColdMsgMutation.mutate({ toProfileId: introTarget.id, content: introText, mediaUrl: objectPath, mediaType });
      } finally {
        setIntroIsUploading(false);
      }
    } else {
      sendColdMsgMutation.mutate({ toProfileId: introTarget.id, content: introText });
    }
  }, [introTarget, introAudioFile, introText, sendColdMsgMutation]);

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
          replyToSenderId: replyTo?.senderId,
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
        replyToSenderId: replyTo?.senderId,
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

  const sendDm = useCallback(() => {
    const text = dmInput.trim();
    if (!text || !dmTarget || !socketRef.current || !profile) return;
    socketRef.current.emit("vibrapp:dm-send", { toProfileId: dmTarget.id, content: text });
    setDmInput("");
    dmInputRef.current?.focus();
  }, [dmInput, dmTarget, profile]);

  const openDmPanel = useCallback((user: { id: string; name: string; age: number; imageUrl: string }) => {
    setDmTarget({ id: user.id, name: user.name, age: user.age, imageUrl: user.imageUrl });
    setSearchQuery("");
    setSearchResults([]);
    setDmUnreadCount(0);
  }, []);

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

  // NO redirect to private room - stay on Vibrapp!

  useEffect(() => {
    if (selectedColdMsg) {
      const timer = setTimeout(() => {
        replyInputRef.current?.focus();
        replyInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [selectedColdMsg]);

  if (!profile) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  // NO redirect - stay on Vibrapp like WhatsApp!
  // Vibrapp is the main chat interface
  // Private rooms are separate (not used in Vibrapp flow)
  
  if (isLegacyIntroFullscreenEnabled() && introTarget && introTarget.id !== profile?.id) {
    const clearIntro = () => {
      sessionStorage.removeItem("vibrapp_intro_target");
      setLocation("/vibrapp");
    };

    return (
      <div className="flex flex-col h-full overflow-hidden bg-[#0a0d1e]" data-testid="vibrapp-dm-page">
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

        <div className={`flex-1 flex flex-col overflow-y-auto ${introColdStatus === "sent" || introColdStatus === "already_exists" ? "" : "items-center justify-center px-6 py-4"}`}>
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
                disabled={!introText.trim() || sendColdMsgMutation.isPending}
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
    <div className="flex flex-col h-full overflow-hidden" data-testid="vibrapp-page">
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

      {/* ── Search users for cold messages ──────────────────────────────── */}
      <div className="bg-[#0a0d1e] border-b border-white/10 px-4 py-2 shrink-0" data-testid="vibrapp-search-section">
        <div className="relative">
          <input
            type="text"
            placeholder={t("vibrapp.searchUsers") || "🔍 Cerca un utente..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#1f2937] text-white text-sm rounded-lg px-3 py-2 outline-none border border-white/10 focus:border-emerald-500/50"
            data-testid="input-search-users"
          />
          
          {searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-[#1f2937] border border-white/10 rounded-lg overflow-hidden z-50 shadow-lg">
              {searchResults.map((user) => (
                <button
                  key={user.id}
                  onClick={() => openDmPanel(user)}
                  className="w-full flex items-center gap-3 px-3 py-2 hover:bg-white/5 text-left border-b border-white/5 last:border-b-0"
                  data-testid={`search-result-${user.id}`}
                >
                  <img src={user.imageUrl} alt={user.name} className="w-8 h-8 rounded-full object-cover" loading="lazy" />
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">{user.name}, {user.age}</p>
                  </div>
                  <span className="text-white/50 text-xs shrink-0">💬</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Intro target banner ──────────────────────────────────────────── */}
      {introTarget && introTarget.id !== profile?.id && (
        <div className="bg-[#0d1f1a] border-b border-emerald-900/30 px-4 py-2.5 shrink-0" data-testid="intro-target-banner">
          <div className="flex items-center gap-3">
            {introColdMessageId ? (
              <button
                type="button"
                className="shrink-0 focus:outline-none"
                disabled={loadingSenderProfile}
                onClick={async () => {
                  if (loadingSenderProfile) return;
                  setLoadingSenderProfile(true);
                  try {
                    const res = await fetch(`/api/profiles/${introTarget.id}`, { credentials: "include" });
                    if (!res.ok) {
                      showSenderProfileToast("Impossibile caricare il profilo. Riprova.");
                      return;
                    }
                    const recipientProfile = await res.json();
                    setReturnToSentColdMessageId(introColdMessageId);
                    setViewedSenderProfile(recipientProfile);
                  } catch {
                    showSenderProfileToast("Impossibile caricare il profilo. Riprova.");
                  } finally {
                    setLoadingSenderProfile(false);
                  }
                }}
                data-testid="button-view-intro-target-profile"
                aria-label={`Vedi il profilo di ${introTarget.name}`}
              >
                <img src={introTarget.imageUrl} alt={introTarget.name} className="w-9 h-9 rounded-full object-cover border-2 border-emerald-500/50" />
              </button>
            ) : (
              <img src={introTarget.imageUrl} alt={introTarget.name} className="w-9 h-9 rounded-full object-cover border-2 border-emerald-500/50" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-semibold leading-tight truncate">{introTarget.name}, {introTarget.age}</p>
              <p className="text-white/50 text-[11px]">
                {introColdStatus === "sent" && "✅ Presentazione inviata — aspetta che risponda"}
                {introColdStatus === "already_exists" && "⏳ Presentazione in attesa di risposta"}
                {introColdStatus === "replied" && "🎉 Ha risposto! Apri la chat Vibrapp"}
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
            {introColdStatus === "replied" && (
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-3 h-8 shrink-0"
                onClick={() => openDmPanel(introTarget)}
                data-testid="button-go-vibrapp-dm"
              >
                💬 Vibrapp
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
                onClick={() => { void refreshSelectedColdMessage(msg); }}
                className="flex flex-col items-center gap-1 shrink-0"
                data-testid={`intro-bubble-${msg.id}`}
              >
                <div className="relative">
                  <img src={msg.fromProfile.imageUrl} alt={msg.fromProfile.name} className="w-12 h-12 rounded-full object-cover border-2 border-purple-500" loading="lazy" />
                  <span className="absolute -bottom-1 -right-1 text-[14px]">🛸</span>
                </div>
                <span className="text-white/70 text-[10px] truncate max-w-[52px]">{msg.fromProfile.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Sent intros strip (with reply status) ─────────────────────────── */}
      {sentColdMsgs && sentColdMsgs.length > 0 && (
        <div className="bg-[#0a0d1e] border-b border-emerald-900/30 px-4 py-2 shrink-0" data-testid="sent-intros-strip">
          <p className="text-emerald-400 text-[10px] font-semibold uppercase tracking-wider mb-1.5">📨 Le tue presentazioni</p>
          <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
            {sentColdMsgs.map(msg => (
              <button
                key={msg.id}
                onClick={() => {
                  if (msg.replied) {
                    openDmPanel({
                      id: msg.toProfile.id,
                      name: msg.toProfile.name,
                      age: msg.toProfile.age,
                      imageUrl: msg.toProfile.imageUrl || "",
                    });
                  }
                }}
                className="flex flex-col items-center gap-1 shrink-0"
                data-testid={`sent-intro-bubble-${msg.id}`}
              >
                <div className="relative">
                  <img src={msg.toProfile.imageUrl} alt={msg.toProfile.name} className="w-12 h-12 rounded-full object-cover border-2 border-emerald-500/60" loading="lazy" />
                  {msg.replied ? (
                    <span className="absolute -bottom-1 -right-1 text-[14px]">💬</span>
                  ) : (
                    <span className="absolute -bottom-1 -right-1 text-[14px]">⏳</span>
                  )}
                </div>
                <span className="text-white/70 text-[10px] truncate max-w-[52px]">{msg.toProfile.name}</span>
                {msg.replied && (
                  <span className="text-emerald-400 text-[9px] font-semibold -mt-0.5">Ha risposto!</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto px-3 py-2 space-y-1 bg-slate-50"
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
          <div className="flex-1 flex flex-col items-center justify-center py-20 text-slate-400">
            <MessageCircle className="w-12 h-12 mb-3 opacity-40 text-slate-300" />
            <p className="text-sm text-slate-500" data-testid="text-no-messages">{t("vibrapp.noMessages")}</p>
          </div>
        )}

        {groupedMessages.map((group) => (
          <div key={group.date}>
            <div className="flex justify-center py-2">
              <span className="bg-slate-200 text-slate-600 text-[10px] px-3 py-1 rounded-full">
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
                        <button
                          onClick={async () => {
                            try {
                              const res = await fetch(`/api/profiles/${msg.senderId}`, { credentials: "include" });
                              if (res.ok) { const p = await res.json(); setViewedSenderProfile(p); }
                            } catch {}
                          }}
                          className="focus:outline-none"
                          data-testid={`avatar-${msg.senderId}`}
                        >
                          <img
                            src={msg.senderImage || "/icons/icon-72x72.png"}
                            alt=""
                            className="w-7 h-7 rounded-full object-cover hover:ring-2 hover:ring-emerald-400 transition-all"
                          />
                        </button>
                      )}
                    </div>
                  )}
                  <div className={`max-w-[75%] relative ${mine ? "items-end" : "items-start"}`}>
                    <div
                      className={`rounded-xl px-3 py-1.5 relative ${
                        mine
                          ? "bg-emerald-500 text-white rounded-tr-sm"
                          : "bg-slate-200 text-slate-900 rounded-tl-sm"
                      }`}
                    >
                      {showName && (
                        <p className={`text-[11px] font-semibold mb-0.5 ${mine ? "text-white/90" : "text-emerald-600"}`} data-testid={`sender-name-${msg.id}`}>
                          {msg.senderName}
                        </p>
                      )}

                      {msg.replyToId && (
                        <div className="bg-black/20 rounded px-2 py-1 mb-1 border-l-2 border-purple-400">
                          <div className="flex items-center gap-1">
                            <Lock className="w-2.5 h-2.5 text-purple-400" />
                            <p className="text-[10px] text-purple-400 font-medium">{msg.replyToName}</p>
                          </div>
                          <p className={`text-[10px] ${mine ? "text-white/60" : "text-slate-600"} truncate`}>{msg.replyToContent}</p>
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

                      {msg.mediaUrl && msg.mediaType === "audio" && (
                        <div className="mb-1 flex items-center gap-2 py-1" data-testid={`media-audio-${msg.id}`}>
                          <div className="w-7 h-7 rounded-full bg-emerald-600/30 flex items-center justify-center shrink-0">
                            <Mic className="w-3.5 h-3.5 text-emerald-400" />
                          </div>
                          <audio
                            src={msg.mediaUrl}
                            controls
                            className="flex-1 h-8"
                            style={{ minWidth: "160px", maxWidth: "220px", accentColor: "#10b981" }}
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

                    {msg.replyToId && (
                      <div className={`flex items-center gap-1 mt-0.5 ${mine ? "justify-end" : "justify-start"}`}>
                        <Lock className="w-2.5 h-2.5 text-purple-400/70" />
                        <span className="text-[9px] text-purple-400/70 font-medium">Privato · visibile solo a voi due</span>
                      </div>
                    )}

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
            className="px-4 py-1 bg-slate-100 border-b border-slate-200"
          >
            <p className="text-[11px] text-emerald-600 italic font-medium" data-testid="text-typing-indicator">
              {typingUsers.length === 1
                ? `${typingUsers[0].name} ${t("vibrapp.typing")}`
                : `${typingUsers.map(u => u.name).join(", ")} ${t("vibrapp.typingMultiple")}`
              }
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {newMsgBanner && (
          <motion.button
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            onClick={() => { scrollToBottom(); setNewMsgBanner(null); }}
            className="absolute bottom-28 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 bg-emerald-700/90 backdrop-blur-sm text-white text-xs rounded-full px-4 py-2 shadow-lg border border-emerald-500/40 max-w-[85%]"
            data-testid="banner-new-message"
          >
            <span className="text-base shrink-0">🛸</span>
            <span className="truncate"><strong>{newMsgBanner.name}</strong>: {newMsgBanner.text}</span>
            <ArrowDown className="w-3.5 h-3.5 shrink-0 opacity-70" />
          </motion.button>
        )}
      </AnimatePresence>

      {showScrollDown && !newMsgBanner && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-24 right-4 z-30 w-10 h-10 rounded-full bg-gray-800 border border-white/20 flex items-center justify-center shadow-lg"
          data-testid="button-scroll-down"
        >
          <ArrowDown className="w-5 h-5 text-white" />
        </button>
      )}

      <div className="shrink-0 bg-[#1a1a2e] border-t border-white/10 pb-safe" data-testid="vibrapp-input-area">
        <AnimatePresence>
          {replyTo && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="px-4 py-2 bg-slate-100 flex items-center justify-between border-b border-slate-200"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <Lock className="w-3 h-3 text-purple-500" />
                  <p className="text-[10px] text-purple-600 font-medium">{t("vibrapp.privateReply")} → {replyTo.senderName}</p>
                </div>
                <p className="text-[11px] text-slate-600 truncate">{replyTo.content}</p>
              </div>
              <button onClick={() => setReplyTo(null)} className="ml-2 p-1 text-slate-400 hover:text-slate-600" data-testid="button-cancel-reply">
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
              className="px-3 py-2 bg-slate-100 border-b border-slate-200 flex items-center gap-3"
              data-testid="media-preview-bar"
            >
              <div className="relative shrink-0">
                {mediaFileType === "image" ? (
                  <img src={mediaPreviewUrl} alt="preview" className="w-16 h-16 object-cover rounded-lg" data-testid="media-preview-image" />
                ) : mediaFileType === "audio" ? (
                  <div className="w-16 h-16 rounded-lg bg-emerald-100 flex flex-col items-center justify-center border border-emerald-300" data-testid="media-preview-audio">
                    <Mic className="w-6 h-6 text-emerald-600" />
                    <span className="text-[9px] text-emerald-700 mt-0.5">Vocale</span>
                  </div>
                ) : (
                  <div className="w-16 h-16 rounded-lg bg-blue-100 flex flex-col items-center justify-center border border-blue-300" data-testid="media-preview-video">
                    <Video className="w-6 h-6 text-blue-600" />
                    <span className="text-[9px] text-blue-700 mt-0.5">Video</span>
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                {mediaFileType === "audio" && mediaPreviewUrl ? (
                  <audio src={mediaPreviewUrl} controls className="w-full h-8 accent-emerald-400" data-testid="audio-preview-player" />
                ) : (
                  <>
                    <p className="text-xs text-slate-700 truncate font-medium">{mediaFile?.name}</p>
                    <p className="text-[10px] text-slate-500">
                      {mediaFileType === "image" ? <ImageIcon className="w-3 h-3 inline mr-1" /> : <Video className="w-3 h-3 inline mr-1" />}
                      {((mediaFile?.size || 0) / (1024 * 1024)).toFixed(1)} MB
                    </p>
                  </>
                )}
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

          {isRecording ? (
            <>
              <button
                onClick={cancelRecording}
                className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white/60 hover:text-red-400 hover:bg-white/20 transition-colors shrink-0"
                data-testid="button-cancel-recording"
                title="Annulla registrazione"
              >
                <MicOff className="w-4 h-4" />
              </button>
              <div className="flex-1 flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-full px-4 py-2.5">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
                <span className="text-sm text-red-400 font-medium">
                  {String(Math.floor(recordingDuration / 60)).padStart(2, "0")}:{String(recordingDuration % 60).padStart(2, "0")}
                </span>
                <span className="text-xs text-white/50 flex-1">Registrazione in corso…</span>
              </div>
              <Button
                onClick={stopRecording}
                className="w-10 h-10 rounded-full bg-emerald-600 hover:bg-emerald-500 p-0 shrink-0"
                data-testid="button-stop-recording"
                title="Ferma e invia"
              >
                <Square className="w-4 h-4 text-white fill-white" />
              </Button>
            </>
          ) : (
            <>
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
                placeholder={socketConnected ? t("vibrapp.placeholder") : "⏳ Connessione in corso..."}
                disabled={!socketConnected}
                className="flex-1 bg-white/10 text-white placeholder:text-white/40 rounded-full px-4 py-2.5 text-sm border border-white/10 focus:border-emerald-500 focus:outline-none transition-colors disabled:opacity-50"
                data-testid="input-vibrapp-message"
              />
              {inputText.trim() || mediaFile ? (
                <Button
                  onClick={sendMessage}
                  disabled={(!inputText.trim() && !mediaFile) || isUploading || !socketConnected}
                  className="w-10 h-10 rounded-full bg-emerald-600 hover:bg-emerald-500 p-0 shrink-0 disabled:opacity-30"
                  data-testid="button-send-message"
                >
                  {isUploading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Send className="w-4 h-4 text-white" />
                  )}
                </Button>
              ) : (
                <button
                  onClick={startRecording}
                  className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white/60 hover:text-emerald-400 hover:bg-white/20 transition-colors shrink-0"
                  data-testid="button-start-recording"
                  title="Registra messaggio vocale"
                >
                  <Mic className="w-5 h-5" />
                </button>
              )}
            </>
          )}
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
                  <p className="text-white/50 text-xs">Presentazione — testo o messaggio vocale</p>
                </div>
              </div>

              {introIsRecording ? (
                <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 mb-4">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shrink-0" />
                  <span className="text-sm text-red-400 font-medium flex-1">
                    {String(Math.floor(introRecordingDuration / 60)).padStart(2, "0")}:{String(introRecordingDuration % 60).padStart(2, "0")} — Registrazione in corso…
                  </span>
                  <button onClick={introCancelRecording} className="text-white/40 hover:text-red-400 transition-colors" data-testid="button-intro-cancel-rec">
                    <MicOff className="w-4 h-4" />
                  </button>
                  <button onClick={introStopRecording} className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center" data-testid="button-intro-stop-rec">
                    <Square className="w-3.5 h-3.5 text-white fill-white" />
                  </button>
                </div>
              ) : introAudioFile && introAudioUrl ? (
                <div className="flex items-center gap-3 bg-emerald-900/30 border border-emerald-500/30 rounded-xl px-3 py-2 mb-4">
                  <div className="w-8 h-8 rounded-full bg-emerald-600/30 flex items-center justify-center shrink-0">
                    <Mic className="w-4 h-4 text-emerald-400" />
                  </div>
                  <audio src={introAudioUrl} controls className="flex-1 h-8" style={{ accentColor: "#10b981" }} data-testid="intro-audio-preview" />
                  <button onClick={introClearAudio} className="text-white/40 hover:text-red-400 transition-colors shrink-0" data-testid="button-intro-clear-audio">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <>
                  <textarea
                    className="w-full bg-[#1f2937] text-white text-sm rounded-xl p-3 resize-none outline-none border border-white/10 focus:border-emerald-500/50 mb-1"
                    rows={4}
                    maxLength={500}
                    placeholder="Ciao! Mi chiamo... Ho visto il tuo profilo e mi piacerebbe conoscerti 🛸"
                    value={introText}
                    onChange={e => setIntroText(e.target.value)}
                    data-testid="input-intro-text"
                  />
                  <div className="flex items-center justify-between mb-3">
                    <span
                      className={`text-xs transition-colors ${!introText.trim() ? "text-orange-400" : "text-white/30"}`}
                      data-testid="text-intro-char-count"
                    >
                      {introText.trim() ? `${introText.trim().length}/500` : "scrivi un messaggio"}
                    </span>
                    <button
                      onClick={introStartRecording}
                      className="flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
                      data-testid="button-intro-start-rec"
                    >
                      <Mic className="w-3.5 h-3.5" />
                      Registra vocale invece
                    </button>
                  </div>
                </>
              )}

              <div className="flex gap-2">
                <Button variant="ghost" className="flex-1 text-white/60" onClick={() => { setShowIntroCompose(false); introCancelRecording(); introClearAudio(); }} data-testid="button-cancel-intro">
                  Annulla
                </Button>
                <Button
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white"
                  disabled={(!introAudioFile && !introText.trim()) || sendColdMsgMutation.isPending || introIsUploading || introIsRecording}
                  onClick={introSubmit}
                  data-testid="button-confirm-intro"
                >
                  {introIsUploading || sendColdMsgMutation.isPending ? "Invio..." : "🛸 Invia presentazione"}
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
                <button
                  type="button"
                  className="shrink-0 focus:outline-none relative"
                  onClick={async () => {
                    if (loadingSenderProfile) return;
                    const current = selectedColdMsg;
                    setLoadingSenderProfile(true);
                    try {
                      const res = await fetch(`/api/profiles/${current.fromProfile.id}`, { credentials: "include" });
                      if (res.ok) {
                        const p = await res.json();
                        setReturnToColdMsg(current);
                        setSelectedColdMsg(null);
                        setViewedSenderProfile(p);
                      } else {
                        if (senderProfileToastTimerRef.current) clearTimeout(senderProfileToastTimerRef.current);
                        setSenderProfileToast("Impossibile caricare il profilo. Riprova.");
                        senderProfileToastTimerRef.current = setTimeout(() => setSenderProfileToast(null), 3500);
                      }
                    } catch {
                      if (senderProfileToastTimerRef.current) clearTimeout(senderProfileToastTimerRef.current);
                      setSenderProfileToast("Impossibile caricare il profilo. Riprova.");
                      senderProfileToastTimerRef.current = setTimeout(() => setSenderProfileToast(null), 3500);
                    } finally {
                      setLoadingSenderProfile(false);
                    }
                  }}
                  data-testid="button-view-sender-profile"
                  title="Vedi profilo completo"
                >
                  <img src={selectedColdMsg.fromProfile.imageUrl} alt={selectedColdMsg.fromProfile.name} className="w-12 h-12 rounded-full object-cover border-2 border-purple-500 hover:border-purple-300 transition-colors" loading="lazy" />
                  {loadingSenderProfile && (
                    <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50">
                      <svg className="w-5 h-5 text-white animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                      </svg>
                    </span>
                  )}
                </button>
                <div
                  className="cursor-pointer"
                  onClick={async () => {
                    if (loadingSenderProfile) return;
                    const current = selectedColdMsg;
                    setLoadingSenderProfile(true);
                    try {
                      const res = await fetch(`/api/profiles/${current.fromProfile.id}`, { credentials: "include" });
                      if (res.ok) {
                        const p = await res.json();
                        setReturnToColdMsg(current);
                        setSelectedColdMsg(null);
                        setViewedSenderProfile(p);
                      } else {
                        setSenderProfileToast("Impossibile caricare il profilo. Riprova.");
                        setTimeout(() => setSenderProfileToast(null), 3500);
                      }
                    } catch {
                      setSenderProfileToast("Impossibile caricare il profilo. Riprova.");
                      setTimeout(() => setSenderProfileToast(null), 3500);
                    } finally {
                      setLoadingSenderProfile(false);
                    }
                  }}
                  data-testid="button-view-sender-name"
                >
                  <p className="text-white font-bold hover:text-purple-300 transition-colors flex items-center gap-1">
                    {selectedColdMsg.fromProfile.name}, {selectedColdMsg.fromProfile.age}
                    <ExternalLink className="w-3.5 h-3.5 text-purple-400/70" />
                  </p>
                  <p className="text-white/50 text-xs">Ti ha inviato una presentazione · <span className="text-purple-400">Vedi profilo</span></p>
                </div>
              </div>
              <div className="bg-[#1f2937] rounded-xl p-3 mb-4 border border-purple-500/20">
                {selectedColdMsg.mediaType === "audio" && selectedColdMsg.mediaUrl ? (
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-purple-600/30 flex items-center justify-center shrink-0">
                      <Mic className="w-3.5 h-3.5 text-purple-400" />
                    </div>
                    <audio src={selectedColdMsg.mediaUrl} controls className="flex-1 h-8" style={{ accentColor: "#9333ea" }} />
                  </div>
                ) : (
                  <p className="text-white/80 text-sm">{selectedColdMsg.content}</p>
                )}
              </div>
              {reportedProfileIds.has(selectedColdMsg.fromProfile.id) && (
                <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/30" data-testid="banner-already-reported">
                  <Flag className="w-4 h-4 text-yellow-400 shrink-0" />
                  <p className="text-yellow-200 text-xs flex-1">
                    Hai già segnalato questo utente —{" "}
                    <button
                      type="button"
                      className="underline text-yellow-300 font-semibold"
                      onClick={() => { setSelectedColdMsg(null); setLocation("/profile?segnalazioni=1"); }}
                      data-testid="link-gestisci-segnalazione"
                    >
                      Gestisci segnalazione
                    </button>
                  </p>
                </div>
              )}
              <p className="text-white/50 text-xs mb-2">La tua risposta continua la conversazione su Vibrapp 💬</p>
              <textarea
                ref={replyInputRef}
                className="w-full bg-[#1f2937] text-white text-sm rounded-xl p-3 resize-none outline-none border border-white/10 focus:border-purple-500/50 mb-4"
                rows={3}
                maxLength={500}
                placeholder="Ciao! Anche tu mi hai incuriosito/a..."
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                data-testid="input-cold-reply"
              />
              {coldMsgDeleteConfirm ? (
                <div className="space-y-2">
                  <p className="text-white/70 text-sm text-center">Cancellare questa presentazione?</p>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      className="flex-1 text-white/60"
                      onClick={() => setColdMsgDeleteConfirm(false)}
                      data-testid="button-cancel-delete-confirm"
                    >
                      Annulla
                    </Button>
                    <Button
                      className="flex-1 bg-red-600 hover:bg-red-500 text-white"
                      disabled={deleteColdMsgMutation.isPending}
                      onClick={() => deleteColdMsgMutation.mutate(selectedColdMsg.id)}
                      data-testid="button-confirm-delete-coldmsg"
                    >
                      {deleteColdMsgMutation.isPending ? "..." : "🗑️ Sì, cancella"}
                    </Button>
                  </div>
                </div>
              ) : coldMsgBlockConfirm ? (
                <div className="space-y-2">
                  <p className="text-white/70 text-sm text-center">Bloccare {selectedColdMsg.fromProfile.name}? Non potrà più contattarti.</p>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      className="flex-1 text-white/60"
                      onClick={() => setColdMsgBlockConfirm(false)}
                      data-testid="button-cancel-block-confirm"
                    >
                      Annulla
                    </Button>
                    <Button
                      className="flex-1 bg-orange-600 hover:bg-orange-500 text-white"
                      disabled={blockSenderMutation.isPending}
                      onClick={() => blockSenderMutation.mutate({ blockedId: selectedColdMsg.fromProfile.id, coldMsgId: selectedColdMsg.id })}
                      data-testid="button-confirm-block-sender"
                    >
                      {blockSenderMutation.isPending ? "..." : "🚫 Sì, blocca"}
                    </Button>
                  </div>
                </div>
              ) : coldMsgReportConfirm ? (
                <div className="space-y-3">
                  <p className="text-white/70 text-sm text-center">Segnala {selectedColdMsg.fromProfile.name} per:</p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { value: "spam", label: "🗑️ Spam" },
                      { value: "inappropriate_content", label: "🔞 Contenuto inappropriato" },
                      { value: "harassment", label: "😠 Molestie" },
                      { value: "fake_profile", label: "🎭 Profilo falso" },
                    ].map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => setReportReason(opt.value)}
                        className={`text-sm rounded-lg px-3 py-2 border transition-colors ${reportReason === opt.value ? "border-yellow-500 bg-yellow-500/20 text-white" : "border-white/20 bg-white/5 text-white/70 hover:border-white/40"}`}
                        data-testid={`button-report-reason-${opt.value}`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-white/40 text-xs text-center">
                    🛡️ Dopo la segnalazione, i futuri messaggi di questo utente non ti raggiungeranno più — anche se il blocco venisse rimosso.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      className="flex-1 text-white/60"
                      onClick={() => { setColdMsgReportConfirm(false); setReportReason(""); }}
                      data-testid="button-cancel-report-confirm"
                    >
                      Annulla
                    </Button>
                    <Button
                      className="flex-1 bg-yellow-600 hover:bg-yellow-500 text-white"
                      disabled={!reportReason || reportSenderMutation.isPending}
                      onClick={() => reportSenderMutation.mutate({ reportedId: selectedColdMsg.fromProfile.id, reason: reportReason, coldMsgId: selectedColdMsg.id, alsoBlock: true })}
                      data-testid="button-confirm-report-sender"
                    >
                      {reportSenderMutation.isPending ? "..." : "🚩 Segnala e blocca"}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    className="text-red-400/70 hover:text-red-400 hover:bg-red-900/20 px-3"
                    onClick={() => setColdMsgDeleteConfirm(true)}
                    data-testid="button-delete-coldmsg"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    className="text-orange-400/70 hover:text-orange-400 hover:bg-orange-900/20 px-3"
                    onClick={() => setColdMsgBlockConfirm(true)}
                    data-testid="button-block-sender"
                    title="Blocca mittente"
                  >
                    <ShieldBan className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    className="text-yellow-400/70 hover:text-yellow-400 hover:bg-yellow-900/20 px-3"
                    onClick={() => setColdMsgReportConfirm(true)}
                    data-testid="button-report-sender"
                    title="Segnala mittente"
                  >
                    <Flag className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" className="flex-1 text-white/60" onClick={() => { setSelectedColdMsg(null); setColdMsgDeleteConfirm(false); setColdMsgBlockConfirm(false); setColdMsgReportConfirm(false); setReportReason(""); }} data-testid="button-cancel-cold-reply">
                    Chiudi
                  </Button>
                  <Button
                     className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white"
                    disabled={replyText.trim().length < 5 || replyColdMsgMutation.isPending}
                    onClick={() => replyColdMsgMutation.mutate({ id: selectedColdMsg.id, content: replyText })}
                    data-testid="button-confirm-cold-reply"
                  >
                    {replyColdMsgMutation.isPending ? "Invio..." : "💬 Rispondi su Vibrapp"}
                  </Button>
                </div>
              )}
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

      {viewedSenderProfile && (
        <ProfileDetailModal
          profile={viewedSenderProfile}
          isOpen={!!viewedSenderProfile}
          onClose={async () => {
            setViewedSenderProfile(null);
            if (returnToColdMsg) {
              const msgId = returnToColdMsg.id;
              setReturnToColdMsg(null);
              try {
                const res = await fetch(`/api/cold-messages/${msgId}`, { credentials: "include" });
                if (res.ok) {
                  setSelectedColdMsg(returnToColdMsg);
                } else {
                  // Message was deleted while the profile was open — don't restore the panel
                  setSenderProfileToast("Questo messaggio non è più disponibile");
                  setTimeout(() => setSenderProfileToast(null), 3500);
                }
              } catch {
                // Network error: restore the panel rather than losing the user's context
                setSelectedColdMsg(returnToColdMsg);
              }
            } else if (returnToSentColdMessageId) {
              const msgId = returnToSentColdMessageId;
              setReturnToSentColdMessageId(null);
              try {
                const res = await fetch(`/api/cold-messages/${msgId}`, { credentials: "include" });
                if (!res.ok) {
                  setIntroTarget(null);
                  setIntroSentContent(null);
                  setIntroSentAt(null);
                  setIntroColdMessageId(null);
                  sessionStorage.removeItem("vibrapp_intro_target");
                  void refetchSentColdMsgs();
                  showSenderProfileToast("Questo messaggio non è più disponibile");
                }
              } catch {
                // Keep the sent-message context if revalidation fails transiently.
              }
            }
          }}
        />
      )}

      {/* ── DM Banner (incoming DM while panel is closed) ─────────────────── */}
      <AnimatePresence>
        {dmBanner && (
          <motion.button
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            onClick={() => {
              clearDmBanner();
              setDmTarget({ id: dmBanner.fromId, name: dmBanner.name, age: 0, imageUrl: "" });
            }}
            className="fixed top-16 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-2 bg-[#1a5c4a]/95 backdrop-blur-sm text-white text-xs rounded-full px-4 py-2.5 shadow-xl border border-emerald-500/40 max-w-[85vw]"
            data-testid="banner-dm-new"
          >
            <span className="text-base shrink-0">💬</span>
            <span className="truncate"><strong>{dmBanner.name}</strong>: {dmBanner.text}</span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* ── DM Panel (WhatsApp-style 1:1 DM) ─────────────────────────────── */}
      <AnimatePresence>
        {dmTarget && (
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed inset-0 z-[150] flex flex-col bg-[#0a0d1e]"
            data-testid="dm-panel"
          >
            {/* DM Header */}
            <div className="bg-gradient-to-r from-[#075e54] to-[#128c7e] px-4 py-3 flex items-center gap-3 shrink-0 shadow-lg">
              <button
                onClick={() => { setDmTarget(null); setDmMessages([]); setDmInput(""); }}
                className="text-white/80 hover:text-white mr-1"
                data-testid="button-close-dm-panel"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
              {dmTarget.imageUrl ? (
                <img src={dmTarget.imageUrl} alt={dmTarget.name} className="w-10 h-10 rounded-full object-cover border-2 border-white/30" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center border-2 border-white/30">
                  <MessageCircle className="w-5 h-5 text-white" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-white font-bold text-base leading-tight truncate">
                  {dmTarget.name}{dmTarget.age > 0 ? `, ${dmTarget.age}` : ""}
                </p>
                <p className="text-white/60 text-xs">💬 Messaggio diretto</p>
              </div>
            </div>

            {/* DM Messages */}
            <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1 bg-slate-50" data-testid="dm-messages-container">
              {dmLoading && (
                <div className="flex justify-center py-10">
                  <div className="w-8 h-8 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin" />
                </div>
              )}
              {!dmLoading && dmMessages.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                  <MessageCircle className="w-12 h-12 mb-3 opacity-30" />
                  <p className="text-sm">Inizia la conversazione con {dmTarget.name} 🛸</p>
                </div>
              )}
              {dmMessages.map((msg) => {
                const mine = msg.fromProfileId === profile?.id;
                return (
                  <div key={msg.id} className={`flex ${mine ? "justify-end" : "justify-start"} mb-1`} data-testid={`dm-msg-${msg.id}`}>
                    <div className={`max-w-[75%] rounded-xl px-3 py-2 ${mine ? "bg-emerald-500 text-white rounded-tr-sm" : "bg-slate-200 text-slate-900 rounded-tl-sm"}`}>
                      <p className="text-[13px] leading-relaxed break-words whitespace-pre-wrap">{msg.content}</p>
                      <div className="flex items-center gap-1 mt-0.5 justify-end">
                        <span className="text-[9px] opacity-60">{formatTime(msg.createdAt)}</span>
                        {mine && (
                          msg.readAt
                            ? <CheckCheck className="w-3 h-3 text-blue-200" />
                            : <Check className="w-3 h-3 text-white/40" />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Bot typing indicator */}
              {dmBotTyping && (
                <div className="flex justify-start mb-1" data-testid="dm-bot-typing">
                  <div className="flex items-end gap-2">
                    {dmBotTyping.image && (
                      <img src={dmBotTyping.image} alt={dmBotTyping.name} className="w-6 h-6 rounded-full object-cover flex-shrink-0" />
                    )}
                    <div className="bg-slate-200 rounded-xl rounded-tl-sm px-4 py-3 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-2 h-2 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-2 h-2 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </div>
              )}

              <div ref={dmMessagesEndRef} />
            </div>

            {/* DM Input */}
            <div className="shrink-0 bg-[#1a1a2e] border-t border-white/10 pb-safe" data-testid="dm-input-area">
              <div className="flex items-center gap-2 px-3 py-2">
                <input
                  ref={dmInputRef}
                  type="text"
                  value={dmInput}
                  onChange={e => setDmInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendDm(); } }}
                  placeholder={socketConnected ? `Scrivi a ${dmTarget.name}…` : "⏳ Connessione in corso..."}
                  disabled={!socketConnected}
                  className="flex-1 bg-white/10 text-white placeholder:text-white/40 rounded-full px-4 py-2.5 text-sm border border-white/10 focus:border-emerald-500 focus:outline-none transition-colors disabled:opacity-50"
                  data-testid="input-dm-message"
                />
                <Button
                  onClick={sendDm}
                  disabled={!dmInput.trim() || !socketConnected}
                  className="w-10 h-10 rounded-full bg-emerald-600 hover:bg-emerald-500 p-0 shrink-0 disabled:opacity-30"
                  data-testid="button-send-dm"
                >
                  <Send className="w-4 h-4 text-white" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Sender profile fetch error toast ─────────────────────────────── */}
      <AnimatePresence>
        {senderProfileToast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[300] bg-red-600/90 text-white text-sm px-4 py-2 rounded-full shadow-lg pointer-events-none"
            data-testid="sender-profile-toast"
          >
            {senderProfileToast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

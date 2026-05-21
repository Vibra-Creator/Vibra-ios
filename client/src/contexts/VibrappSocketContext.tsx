import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { playNotificationSound } from "@/lib/notification-sound";
import { queryClient } from "@/lib/queryClient";

export interface DmMessage {
  id: string;
  fromProfileId: string;
  toProfileId: string;
  content: string;
  readAt: string | null;
  createdAt: string;
  senderName?: string;
  senderImage?: string | null;
}

interface VibrappSocketContextValue {
  socketRef: React.MutableRefObject<Socket | null>;
  socketConnected: boolean;
  onlineCount: number;
  dmUnreadCount: number;
  setDmUnreadCount: React.Dispatch<React.SetStateAction<number>>;
  dmBanner: { name: string; text: string; fromId: string } | null;
  clearDmBanner: () => void;
  showDmBanner: (name: string, text: string, fromId: string) => void;
  registerDmHandler: (cb: ((msg: DmMessage) => void) | null) => void;
}

const VibrappSocketContext = createContext<VibrappSocketContextValue>({
  socketRef: { current: null },
  socketConnected: false,
  onlineCount: 0,
  dmUnreadCount: 0,
  setDmUnreadCount: () => {},
  dmBanner: null,
  clearDmBanner: () => {},
  showDmBanner: () => {},
  registerDmHandler: () => {},
});

export function VibrappSocketProvider({
  children,
  profileId,
}: {
  children: React.ReactNode;
  profileId: string;
}) {
  const socketRef = useRef<Socket | null>(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const [onlineCount, setOnlineCount] = useState(0);
  const [dmUnreadCount, setDmUnreadCount] = useState(0);
  const [dmBanner, setDmBanner] = useState<{ name: string; text: string; fromId: string } | null>(null);
  const dmBannerTimerRef = useRef<NodeJS.Timeout | null>(null);
  const dmHandlerRef = useRef<((msg: DmMessage) => void) | null>(null);

  const registerDmHandler = useCallback((cb: ((msg: DmMessage) => void) | null) => {
    dmHandlerRef.current = cb;
  }, []);

  const clearDmBanner = useCallback(() => {
    setDmBanner(null);
    if (dmBannerTimerRef.current) clearTimeout(dmBannerTimerRef.current);
  }, []);

  const showDmBanner = useCallback((name: string, text: string, fromId: string) => {
    playNotificationSound();
    setDmUnreadCount(c => c + 1);
    queryClient.invalidateQueries({ queryKey: ["/api/vibrapp-dm/unread-count"] });
    setDmBanner({ name, text, fromId });
    if (dmBannerTimerRef.current) clearTimeout(dmBannerTimerRef.current);
    dmBannerTimerRef.current = setTimeout(() => setDmBanner(null), 5000);
  }, []);

  useEffect(() => {
    if (!profileId) return;

    const socket = io(window.location.origin, { path: "/vibrapp-socket" });
    socketRef.current = socket;

    socket.on("connect", () => setSocketConnected(true));
    socket.on("disconnect", () => setSocketConnected(false));
    socket.on("vibrapp:online-count", (count: number) => setOnlineCount(count));

    socket.on("vibrapp:dm-message", (msg: DmMessage) => {
      if (msg.fromProfileId === profileId) return;

      if (dmHandlerRef.current) {
        dmHandlerRef.current(msg);
        return;
      }

      // User is not on vibrapp page — show global banner + sound
      showDmBanner(
        msg.senderName || "Qualcuno",
        msg.content ? msg.content.substring(0, 60) : "📩 Messaggio",
        msg.fromProfileId
      );
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setSocketConnected(false);
      if (dmBannerTimerRef.current) clearTimeout(dmBannerTimerRef.current);
    };
  }, [profileId, showDmBanner]);

  return (
    <VibrappSocketContext.Provider
      value={{
        socketRef,
        socketConnected,
        onlineCount,
        dmUnreadCount,
        setDmUnreadCount,
        dmBanner,
        clearDmBanner,
        showDmBanner,
        registerDmHandler,
      }}
    >
      {children}
    </VibrappSocketContext.Provider>
  );
}

export function useVibrappSocket() {
  return useContext(VibrappSocketContext);
}

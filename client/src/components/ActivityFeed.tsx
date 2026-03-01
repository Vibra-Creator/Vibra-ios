import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/use-auth";
import {
  Eye,
  Heart,
  MessageCircle,
  Users,
  Zap,
  Sparkles,
  Radio,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface ActivityEvent {
  id: string;
  type: "profile_visit" | "compatibility" | "interaction" | "room_active" | "vibing_nearby";
  profileName?: string;
  profileImage?: string;
  roomName?: string;
  count?: number;
  sharedCount?: number;
}

interface ActivityData {
  onlineCount: number;
  events: ActivityEvent[];
}

const eventIcons: Record<string, any> = {
  profile_visit: Eye,
  compatibility: Heart,
  interaction: MessageCircle,
  room_active: Users,
  vibing_nearby: Zap,
};

const eventColors: Record<string, string> = {
  profile_visit: "from-cyan-500/90 to-blue-500/90",
  compatibility: "from-pink-500/90 to-rose-500/90",
  interaction: "from-purple-500/90 to-violet-500/90",
  room_active: "from-emerald-500/90 to-green-500/90",
  vibing_nearby: "from-amber-500/90 to-orange-500/90",
};

function formatEventMessage(event: ActivityEvent, t: (key: string) => string): string {
  switch (event.type) {
    case "profile_visit":
      return t("activity.profileVisit").replace("{name}", event.profileName || "");
    case "compatibility":
      if (event.sharedCount && event.sharedCount > 0) {
        return t("activity.compatibilityShared")
          .replace("{name}", event.profileName || "")
          .replace("{count}", String(event.sharedCount));
      }
      return t("activity.compatibilityGeneric").replace("{name}", event.profileName || "");
    case "interaction":
      return t("activity.interaction").replace("{name}", event.profileName || "");
    case "room_active":
      return t("activity.roomActive")
        .replace("{room}", event.roomName || "")
        .replace("{count}", String(event.count || 0));
    case "vibing_nearby":
      return t("activity.vibingNearby").replace("{count}", String(event.count || 0));
    default:
      return "";
  }
}

function ActivityToast({ event, onDismiss }: { event: ActivityEvent; onDismiss: () => void }) {
  const { t } = useLanguage();
  const Icon = eventIcons[event.type] || Sparkles;
  const gradient = eventColors[event.type] || "from-primary/90 to-accent/90";
  const message = formatEventMessage(event, t);

  useEffect(() => {
    const timer = setTimeout(onDismiss, 4000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 80, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.95 }}
      transition={{ type: "spring", damping: 20, stiffness: 300 }}
      className="pointer-events-auto cursor-pointer"
      onClick={onDismiss}
      data-testid={`toast-activity-${event.type}`}
    >
      <div className={`flex items-center gap-3 rounded-2xl bg-gradient-to-r ${gradient} backdrop-blur-xl px-4 py-3 shadow-2xl border border-white/20`}>
        <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center shrink-0 overflow-hidden">
          {event.profileImage ? (
            <img src={event.profileImage} alt="" className="w-9 h-9 rounded-full object-cover" />
          ) : (
            <Icon className="w-5 h-5 text-white" />
          )}
        </div>
        <p className="text-white text-sm font-medium leading-tight flex-1 line-clamp-2">
          {message}
        </p>
      </div>
    </motion.div>
  );
}

export function OnlineBanner() {
  const { t } = useLanguage();
  const { isAuthenticated } = useAuth();
  const [displayCount, setDisplayCount] = useState(0);
  const [pulse, setPulse] = useState(false);

  const { data: activityData } = useQuery<ActivityData>({
    queryKey: ["/api/activity/feed"],
    refetchInterval: 30000,
    enabled: isAuthenticated,
  });

  useEffect(() => {
    if (!activityData?.onlineCount) return;
    const target = activityData.onlineCount;
    const duration = 1500;
    const steps = 30;
    const increment = target / steps;
    let current = 0;
    const interval = setInterval(() => {
      current += increment;
      if (current >= target) {
        current = target;
        clearInterval(interval);
      }
      setDisplayCount(Math.round(current));
    }, duration / steps);
    return () => clearInterval(interval);
  }, [activityData?.onlineCount]);

  useEffect(() => {
    const interval = setInterval(() => {
      setPulse(true);
      setTimeout(() => setPulse(false), 1000);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  if (!activityData?.onlineCount) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-sm md:max-w-md lg:max-w-lg relative z-20 mb-2"
      data-testid="banner-online-count"
    >
      <div className="flex items-center justify-center gap-2 rounded-xl bg-black/40 backdrop-blur-md px-3 py-2 border border-white/10">
        <div className="relative">
          <Radio className={`w-4 h-4 text-green-400 ${pulse ? "animate-pulse" : ""}`} />
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-green-400 animate-ping" />
        </div>
        <span className="text-white/90 text-xs font-medium">
          <span className="text-green-400 font-bold">{displayCount}</span>
          {" "}{t("activity.onlineNow")}
        </span>
        <span className="text-white/30 text-xs">•</span>
        <span className="text-white/60 text-xs flex items-center gap-1">
          <Sparkles className="w-3 h-3" />
          {t("activity.activeVibes")}
        </span>
      </div>
    </motion.div>
  );
}

export function ActivityToastSystem() {
  const { isAuthenticated } = useAuth();
  const [activeToast, setActiveToast] = useState<ActivityEvent | null>(null);
  const [eventQueue, setEventQueue] = useState<ActivityEvent[]>([]);
  const [shownIds, setShownIds] = useState<Set<string>>(new Set());
  const [toastIndex, setToastIndex] = useState(0);
  const mountTimeRef = useRef(Date.now());

  const { data: activityData } = useQuery<ActivityData>({
    queryKey: ["/api/activity/feed"],
    refetchInterval: 30000,
    enabled: isAuthenticated,
  });

  useEffect(() => {
    if (!activityData?.events?.length) return;
    const newEvents = activityData.events.filter(e => !shownIds.has(e.id));
    if (newEvents.length > 0) {
      setEventQueue(prev => [...prev, ...newEvents]);
      newEvents.forEach(e => {
        setShownIds(prev => {
          const next = new Set(prev);
          next.add(e.id);
          return next;
        });
      });
    }
  }, [activityData?.events]);

  const showNext = useCallback(() => {
    setEventQueue(prev => {
      if (prev.length === 0) return prev;
      const [next, ...rest] = prev;
      setActiveToast(next);
      setToastIndex(i => i + 1);
      return rest;
    });
  }, []);

  useEffect(() => {
    if (eventQueue.length === 0) return;
    if (activeToast) return;
    if (toastIndex >= 4) return;

    const delay = toastIndex === 0 ? 30000 : 15000;

    const timeout = setTimeout(showNext, delay);
    return () => clearTimeout(timeout);
  }, [eventQueue.length, activeToast, toastIndex, showNext]);

  return (
    <div className="fixed bottom-20 left-0 right-0 z-50 flex justify-center px-4 pointer-events-none">
      <div className="w-full max-w-sm">
        <AnimatePresence mode="wait">
          {activeToast && (
            <ActivityToast
              key={activeToast.id}
              event={activeToast}
              onDismiss={() => setActiveToast(null)}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

interface VibrationData {
  vibrations: number;
  compatible: number;
  shown: number;
  newCompat: number;
}

export function VibrationActivity() {
  const { t } = useLanguage();
  const { user } = useAuth();

  const { data, isLoading } = useQuery<VibrationData>({
    queryKey: ["/api/activity/vibration"],
    refetchInterval: 120000,
    enabled: !!user,
  });

  if (isLoading || !data) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -5 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full relative z-20 py-1.5"
      data-testid="vibration-activity"
    >
      <div className="flex items-center justify-center gap-4">
        <motion.div
          className="flex items-center gap-2 px-3 py-1.5 rounded-full relative overflow-hidden"
          style={{ background: "linear-gradient(135deg, rgba(147,51,234,0.25), rgba(168,85,247,0.15))" }}
          animate={{
            boxShadow: [
              "0 0 8px rgba(168,85,247,0.3), 0 0 20px rgba(168,85,247,0.15)",
              "0 0 14px rgba(168,85,247,0.5), 0 0 30px rgba(168,85,247,0.25)",
              "0 0 8px rgba(168,85,247,0.3), 0 0 20px rgba(168,85,247,0.15)",
            ],
          }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
          data-testid="vibration-item-0"
        >
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-purple-500/0 via-purple-400/20 to-purple-500/0"
            animate={{ x: ["-100%", "100%"] }}
            transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
          />
          <motion.div
            animate={{ rotate: [0, 15, -15, 0], scale: [1, 1.2, 1] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          >
            <Sparkles className="w-4 h-4 text-purple-300 drop-shadow-[0_0_4px_rgba(168,85,247,0.8)]" />
          </motion.div>
          <span className="text-[13px] text-purple-100 font-medium relative z-10">
            <span className="font-extrabold text-white drop-shadow-[0_0_6px_rgba(168,85,247,0.8)]">{data.shown}</span>{" "}
            {t("vibration.shown")}
          </span>
        </motion.div>

        {data.newCompat > 0 && (
          <motion.div
            className="flex items-center gap-2 px-3 py-1.5 rounded-full relative overflow-hidden"
            style={{ background: "linear-gradient(135deg, rgba(236,72,153,0.25), rgba(244,114,182,0.15))" }}
            animate={{
              boxShadow: [
                "0 0 8px rgba(236,72,153,0.3), 0 0 20px rgba(236,72,153,0.15)",
                "0 0 14px rgba(236,72,153,0.5), 0 0 30px rgba(236,72,153,0.25)",
                "0 0 8px rgba(236,72,153,0.3), 0 0 20px rgba(236,72,153,0.15)",
              ],
            }}
            transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut", delay: 0.8 }}
            data-testid="vibration-item-1"
          >
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-pink-500/0 via-pink-400/20 to-pink-500/0"
              animate={{ x: ["-100%", "100%"] }}
              transition={{ duration: 3, repeat: Infinity, ease: "linear", delay: 1 }}
            />
            <motion.div
              animate={{ scale: [1, 1.3, 1] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            >
              <Heart className="w-4 h-4 text-pink-300 fill-pink-400/50 drop-shadow-[0_0_4px_rgba(236,72,153,0.8)]" />
            </motion.div>
            <span className="text-[13px] text-pink-100 font-medium relative z-10">
              <span className="font-extrabold text-white drop-shadow-[0_0_6px_rgba(236,72,153,0.8)]">{data.newCompat}</span>{" "}
              {t("vibration.newCompat")}
            </span>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

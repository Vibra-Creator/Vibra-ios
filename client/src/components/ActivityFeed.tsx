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

    const gaps = [2000, 8000, 12000, 15000, 18000];
    const delay = toastIndex < gaps.length ? gaps[toastIndex] : 18000;

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

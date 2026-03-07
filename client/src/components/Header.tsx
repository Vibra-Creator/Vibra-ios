import { useState, useEffect } from "react";
import { User, Heart, Home, Shield, Users, Trophy, Lock, Eye, Zap, MapPin, MessageCircle } from "lucide-react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/i18n/LanguageContext";
import vibraLogo from "@assets/Gemini_Generated_Image_adkxs1adkxs1adkx_1770480122018.png";

const PHRASES = [
  { emoji: "👽", text: "An alien is searching for you…" },
  { emoji: "🛸", text: "Cosmic signal detected" },
  { emoji: "✨", text: "A vibration is approaching" },
];

function CosmicBanner() {
  const [index, setIndex] = useState(0);
  const [scanning, setScanning] = useState(true);

  const { data: onlineData } = useQuery<{ count: number }>({
    queryKey: ["/api/vibrapp/online-count"],
    refetchInterval: 30000,
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setScanning(true);
      setTimeout(() => {
        setIndex(i => (i + 1) % PHRASES.length);
        setScanning(false);
      }, 600);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  const phrase = PHRASES[index];
  const onlineCount = onlineData?.count ?? 0;

  return (
    <div className="flex items-center gap-2 flex-1 min-w-0 overflow-hidden" data-testid="cosmic-banner">
      <div className="flex-1 min-w-0 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.35 }}
            className="flex items-center gap-1.5"
          >
            <motion.span
              animate={scanning ? { opacity: [1, 0.3, 1, 0.3, 1] } : { opacity: 1 }}
              transition={{ duration: 0.6 }}
              className="text-base leading-none shrink-0"
            >
              {phrase.emoji}
            </motion.span>
            <motion.span
              className="text-[11px] font-semibold tracking-wide truncate"
              style={{
                background: "linear-gradient(90deg, #c084fc, #67e8f9, #f472b6)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
              animate={scanning ? { opacity: [1, 0.4, 1] } : { opacity: 1 }}
              transition={{ duration: 0.6 }}
            >
              {phrase.text}
            </motion.span>
            <motion.span
              className="text-purple-400/70 text-[10px] shrink-0"
              animate={{ opacity: [1, 0, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
            >
              ▮
            </motion.span>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="flex items-center gap-1 shrink-0" data-testid="online-count-badge">
        <motion.span
          className="w-1.5 h-1.5 rounded-full bg-green-400"
          animate={{ scale: [1, 1.4, 1], opacity: [1, 0.5, 1] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
        <span className="text-[10px] text-white/70 font-medium whitespace-nowrap">
          {onlineCount} alieni online
        </span>
      </div>
    </div>
  );
}

export function Header() {
  return (
    <header className="sticky top-0 z-40 w-full">
      <div className="flex items-center gap-2 px-3 py-2.5 bg-black/30 backdrop-blur-xl border-b border-white/10">
        <Link href="/" data-testid="link-home">
          <img src={vibraLogo} alt="Vibra" className="w-9 h-9 object-contain rounded-full shrink-0" style={{ mixBlendMode: "screen" }} data-testid="vibra-logo-header" />
        </Link>
        <CosmicBanner />
      </div>
    </header>
  );
}

export function BottomNav() {
  const [location] = useLocation();
  const { user } = useAuth();
  const { t } = useLanguage();

  const isAdmin = !!user?.isAdmin;

  const { data: privateRoomPending } = useQuery<{ count: number }>({
    queryKey: ["/api/private-rooms/pending-count"],
    enabled: !!user,
    refetchInterval: 15000,
  });

  const { data: ratingCount } = useQuery<{ count: number }>({
    queryKey: ["/api/ratings/count"],
    enabled: !!user,
    refetchInterval: 15000,
  });

  const pendingRoomCount = privateRoomPending?.count || 0;
  const unrepliedRatingCount = ratingCount?.count || 0;

  const navItems = [
    { path: "/", icon: Home, label: t("nav.discover"), badge: 0, color: "text-violet-400", activeBg: "bg-violet-500" },
    { path: "/matches", icon: Heart, label: t("nav.matches"), badge: 0, color: "text-pink-400", activeBg: "bg-pink-500" },
    { path: "/rooms", icon: Users, label: t("nav.rooms"), badge: 0, color: "text-cyan-400", activeBg: "bg-cyan-600" },
    { path: "/challenges", icon: Trophy, label: t("nav.challenges"), badge: 0, color: "text-amber-400", activeBg: "bg-amber-500" },
    { path: "/vibing", icon: Zap, label: t("nav.vibing"), badge: 0, color: "text-lime-400", activeBg: "bg-lime-500" },
    { path: "/vibrapp", icon: MessageCircle, label: t("nav.vibrapp"), badge: 0, color: "text-green-400", activeBg: "bg-green-600" },
    { path: "/dove-sei", icon: MapPin, label: t("nav.location"), badge: 0, color: "text-sky-400", activeBg: "bg-sky-500" },
    { path: "/private-rooms", icon: Lock, label: t("nav.private"), badge: pendingRoomCount, color: "text-purple-400", activeBg: "bg-purple-500" },
    { path: "/prima-impressione", icon: Eye, label: t("nav.impression"), badge: unrepliedRatingCount, color: "text-rose-400", activeBg: "bg-rose-500" },
    { path: "/profile", icon: User, label: t("nav.profile"), badge: 0, color: "text-emerald-400", activeBg: "bg-emerald-500" },
    ...(isAdmin ? [{ path: "/admin", icon: Shield, label: t("nav.admin"), badge: 0, color: "text-red-400", activeBg: "bg-red-500" }] : []),
  ];

  const topRow = navItems.slice(0, 5);
  const bottomRow = navItems.slice(5);

  const renderItem = (item: typeof navItems[0]) => {
    const isActive = location === item.path;
    return (
      <Link key={item.path} href={item.path}>
        <motion.div
          whileTap={{ scale: 0.9 }}
          className="flex flex-col items-center gap-0.5 min-w-[56px]"
          data-testid={`nav-${item.label.toLowerCase()}`}
        >
          <div className={`relative flex items-center justify-center w-10 h-10 rounded-xl transition-colors ${
            isActive
              ? `${item.activeBg} text-white shadow-lg`
              : ""
          }`}>
            <item.icon className={`w-5 h-5 ${isActive ? "text-white" : item.color}`} />
            {item.badge > 0 && (
              <span
                className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-accent text-white text-[10px] font-bold flex items-center justify-center px-1"
                data-testid={`badge-${item.label.toLowerCase()}`}
              >
                {item.badge > 99 ? "99+" : item.badge}
              </span>
            )}
          </div>
          <span className={`text-[10px] leading-tight ${isActive ? "text-white font-semibold" : "text-white/60"}`}>
            {item.label}
          </span>
        </motion.div>
      </Link>
    );
  };

  return (
    <nav className="sticky bottom-0 z-40 w-full bg-black/50 backdrop-blur-xl border-t border-white/10" data-testid="bottom-nav">
      <div className="flex items-center justify-around px-3 pt-2 pb-1">
        {topRow.map(renderItem)}
      </div>
      {bottomRow.length > 0 && (
        <div className="flex items-center justify-around px-3 pb-2 pt-0.5">
          {bottomRow.map(renderItem)}
        </div>
      )}
    </nav>
  );
}

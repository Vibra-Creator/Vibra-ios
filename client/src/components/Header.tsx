import { useState, useEffect, useRef } from "react";
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

interface Blip {
  id: number;
  x: number;
  y: number;
  born: number;
  color: string;
}

const RADAR_SIZE = 68;
const CENTER = RADAR_SIZE / 2;
const BLIP_COLORS = ["#4ade80", "#67e8f9", "#e879f9", "#f472b6"];

function RadarDisplay({ onlineCount }: { onlineCount: number }) {
  const [blips, setBlips] = useState<Blip[]>([]);
  const [tick, setTick] = useState(0);
  const sweepRef = useRef(0);
  const idRef = useRef(0);

  useEffect(() => {
    const interval = setInterval(() => {
      sweepRef.current = (sweepRef.current + 6) % 360;
      setTick(t => t + 1);

      if (Math.random() < 0.35) {
        const rings = [10, 17, 24, 30];
        const r = rings[Math.floor(Math.random() * rings.length)] + (Math.random() - 0.5) * 4;
        const angleRad = (sweepRef.current + (Math.random() - 0.5) * 20) * (Math.PI / 180);
        setBlips(prev => [
          ...prev.filter(b => Date.now() - b.born < 3500).slice(-12),
          {
            id: idRef.current++,
            x: CENTER + r * Math.cos(angleRad),
            y: CENTER + r * Math.sin(angleRad),
            born: Date.now(),
            color: BLIP_COLORS[Math.floor(Math.random() * BLIP_COLORS.length)],
          },
        ]);
      }
    }, 50);
    return () => clearInterval(interval);
  }, []);

  const now = Date.now();

  return (
    <div className="relative shrink-0" style={{ width: RADAR_SIZE, height: RADAR_SIZE }} data-testid="radar-display">
      {/* Outer glow */}
      <motion.div
        className="absolute inset-0 rounded-full"
        style={{ boxShadow: "0 0 18px rgba(74,222,128,0.35), 0 0 40px rgba(74,222,128,0.12)" }}
        animate={{ opacity: [0.7, 1, 0.7] }}
        transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Outer pulse rings */}
      {[0, 1, 2].map(i => (
        <motion.div
          key={i}
          className="absolute inset-0 rounded-full border border-green-400/50"
          initial={{ scale: 1, opacity: 0.5 }}
          animate={{ scale: [1, 1.7], opacity: [0.4, 0] }}
          transition={{ duration: 2.2, repeat: Infinity, delay: i * 0.75, ease: "easeOut" }}
        />
      ))}

      {/* SVG: rings, crosshairs, blips */}
      <svg
        width={RADAR_SIZE}
        height={RADAR_SIZE}
        className="absolute inset-0"
        style={{ overflow: "visible" }}
      >
        {/* Background fill */}
        <circle cx={CENTER} cy={CENTER} r={CENTER - 1} fill="rgba(0,15,10,0.75)" />

        {/* Concentric rings */}
        {[32, 22, 13].map((r, i) => (
          <circle
            key={i}
            cx={CENTER}
            cy={CENTER}
            r={r}
            fill="none"
            stroke={`rgba(74,222,128,${0.45 - i * 0.1})`}
            strokeWidth={i === 0 ? 1.2 : 0.7}
          />
        ))}

        {/* Crosshairs */}
        <line x1={CENTER} y1={3} x2={CENTER} y2={RADAR_SIZE - 3} stroke="rgba(74,222,128,0.18)" strokeWidth="0.6" />
        <line x1={3} y1={CENTER} x2={RADAR_SIZE - 3} y2={CENTER} stroke="rgba(74,222,128,0.18)" strokeWidth="0.6" />
        <line x1={12} y1={12} x2={RADAR_SIZE - 12} y2={RADAR_SIZE - 12} stroke="rgba(74,222,128,0.08)" strokeWidth="0.5" />
        <line x1={RADAR_SIZE - 12} y1={12} x2={12} y2={RADAR_SIZE - 12} stroke="rgba(74,222,128,0.08)" strokeWidth="0.5" />

        {/* Blips */}
        {blips.map(blip => {
          const age = (now - blip.born) / 3500;
          const opacity = Math.max(0, 1 - age);
          const size = 1.5 + (1 - age) * 1.5;
          return (
            <g key={blip.id}>
              <circle cx={blip.x} cy={blip.y} r={size + 2} fill={blip.color} opacity={opacity * 0.2} />
              <circle cx={blip.x} cy={blip.y} r={size} fill={blip.color} opacity={opacity * 0.9} />
            </g>
          );
        })}

        {/* Center dot */}
        <circle cx={CENTER} cy={CENTER} r={2.5} fill="#4ade80" opacity={0.9} />
        <circle cx={CENTER} cy={CENTER} r={1.2} fill="white" opacity={0.8} />
      </svg>

      {/* Rotating sweep arc (conic gradient) */}
      <motion.div
        className="absolute inset-0 rounded-full"
        style={{
          background: "conic-gradient(from 0deg, transparent 270deg, rgba(74,222,128,0.04) 300deg, rgba(74,222,128,0.35) 350deg, rgba(200,255,200,0.5) 358deg, transparent 360deg)",
          mixBlendMode: "screen",
        }}
        animate={{ rotate: 360 }}
        transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
      />

      {/* Sweep line tip flash */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: 4,
          height: 4,
          top: CENTER - 2,
          left: CENTER - 2,
          background: "radial-gradient(circle, #ffffff 0%, #4ade80 60%, transparent 100%)",
          transformOrigin: "2px 2px",
        }}
        animate={{ rotate: 360 }}
        transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
      >
        <div
          style={{
            position: "absolute",
            width: 2,
            height: CENTER - 4,
            bottom: 2,
            left: 1,
            background: "linear-gradient(to top, transparent, rgba(74,222,128,0.6))",
            borderRadius: 1,
          }}
        />
      </motion.div>

      {/* Online count badge */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ paddingTop: 4 }}>
        <motion.span
          className="text-[11px] font-black leading-none"
          style={{ color: "#4ade80", textShadow: "0 0 8px rgba(74,222,128,0.8)" }}
          animate={{ opacity: [0.8, 1, 0.8] }}
          transition={{ duration: 1.8, repeat: Infinity }}
        >
          {onlineCount}
        </motion.span>
        <span className="text-[7px] text-green-300/60 font-medium leading-none mt-0.5 tracking-wider">ONLINE</span>
      </div>
    </div>
  );
}

function CosmicBanner() {
  const [index, setIndex] = useState(0);
  const [scanning, setScanning] = useState(false);

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
      }, 500);
    }, 4500);
    return () => clearInterval(timer);
  }, []);

  const phrase = PHRASES[index];
  const onlineCount = onlineData?.count ?? 0;

  return (
    <div className="flex items-center gap-3 flex-1 min-w-0" data-testid="cosmic-banner">
      <RadarDisplay onlineCount={onlineCount} />

      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        <AnimatePresence mode="wait">
          <motion.div
            key={index}
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            transition={{ duration: 0.3 }}
            className="flex items-center gap-1.5 min-w-0"
          >
            <motion.span
              className="text-sm leading-none shrink-0"
              animate={scanning ? { opacity: [1, 0.2, 1, 0.2, 1] } : { opacity: 1 }}
              transition={{ duration: 0.5 }}
            >
              {phrase.emoji}
            </motion.span>
            <motion.span
              className="text-[11px] font-semibold tracking-wide truncate"
              style={{
                background: "linear-gradient(90deg, #c084fc, #67e8f9, #f472b6, #c084fc)",
                backgroundSize: "200% 100%",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
              animate={{ backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"] }}
              transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
            >
              {phrase.text}
            </motion.span>
          </motion.div>
        </AnimatePresence>

        <div className="flex items-center gap-1.5">
          <motion.span
            className="text-[9px] text-green-300/70 font-mono tracking-widest"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.2, repeat: Infinity }}
          >
            ◈ SCANNING...
          </motion.span>
          <motion.span
            className="text-[9px] text-white/40 font-mono"
            animate={{ opacity: [1, 0, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
          >
            ▮
          </motion.span>
        </div>
      </div>
    </div>
  );
}

export function Header() {
  return (
    <header className="sticky top-0 z-40 w-full">
      <div className="flex items-center gap-2 px-3 py-2 bg-black/40 backdrop-blur-xl border-b border-green-500/10">
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

  const { data: coldMsgPending } = useQuery<{ count: number }>({
    queryKey: ["/api/cold-messages/pending-count"],
    enabled: !!user,
    refetchInterval: 20000,
  });

  const { data: vibrappUnread } = useQuery<{ count: number }>({
    queryKey: ["/api/vibrapp/unread-count"],
    enabled: !!user,
    refetchInterval: 15000,
  });

  const pendingRoomCount = privateRoomPending?.count || 0;
  const unrepliedRatingCount = ratingCount?.count || 0;
  const pendingIntroCount = coldMsgPending?.count || 0;
  const vibrappUnreadCount = vibrappUnread?.count || 0;
  const vibrappBadge = location === "/vibrapp" ? 0 : (pendingIntroCount + vibrappUnreadCount);

  const navItems = [
    { path: "/", icon: Home, label: t("nav.discover"), badge: 0, color: "text-violet-400", activeBg: "bg-violet-500" },
    { path: "/matches", icon: Heart, label: t("nav.matches"), badge: 0, color: "text-pink-400", activeBg: "bg-pink-500" },
    { path: "/rooms", icon: Users, label: t("nav.rooms"), badge: 0, color: "text-cyan-400", activeBg: "bg-cyan-600" },
    { path: "/challenges", icon: Trophy, label: t("nav.challenges"), badge: 0, color: "text-amber-400", activeBg: "bg-amber-500" },
    { path: "/vibing", icon: Zap, label: t("nav.vibing"), badge: 0, color: "text-lime-400", activeBg: "bg-lime-500" },
    { path: "/vibrapp", icon: MessageCircle, label: t("nav.vibrapp"), badge: vibrappBadge, color: "text-green-400", activeBg: "bg-green-600" },
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
            isActive ? `${item.activeBg} text-white shadow-lg` : ""
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

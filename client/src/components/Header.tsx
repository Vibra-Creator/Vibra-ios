import { User, Heart, Home, Shield, Users, Trophy, Lock, Eye, Zap, MapPin } from "lucide-react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import vibraLogo from "@assets/Gemini_Generated_Image_adkxs1adkxs1adkx_1770480122018.png";

export function Header() {
  return (
    <header className="sticky top-0 z-40 w-full">
      <div className="flex items-center justify-center px-4 py-3 bg-black/30 backdrop-blur-xl border-b border-white/10">
        <Link href="/" data-testid="link-home">
          <div className="flex items-center gap-2">
            <img src={vibraLogo} alt="Vibra" className="w-10 h-10 object-contain rounded-full" style={{ mixBlendMode: "screen" }} data-testid="vibra-logo-header" />
          </div>
        </Link>
      </div>
    </header>
  );
}

export function BottomNav() {
  const [location] = useLocation();
  const { user } = useAuth();

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
    { path: "/", icon: Home, label: "Scopri", badge: 0, color: "text-violet-400", activeBg: "bg-violet-500" },
    { path: "/matches", icon: Heart, label: "Match", badge: 0, color: "text-pink-400", activeBg: "bg-pink-500" },
    { path: "/rooms", icon: Users, label: "Stanze", badge: 0, color: "text-cyan-400", activeBg: "bg-cyan-600" },
    { path: "/challenges", icon: Trophy, label: "Sfide", badge: 0, color: "text-amber-400", activeBg: "bg-amber-500" },
    { path: "/vibing", icon: Zap, label: "Vibing", badge: 0, color: "text-lime-400", activeBg: "bg-lime-500" },
    { path: "/dove-sei", icon: MapPin, label: "Dove Sei", badge: 0, color: "text-sky-400", activeBg: "bg-sky-500" },
    { path: "/private-rooms", icon: Lock, label: "Private", badge: pendingRoomCount, color: "text-purple-400", activeBg: "bg-purple-500" },
    { path: "/prima-impressione", icon: Eye, label: "Impression", badge: unrepliedRatingCount, color: "text-rose-400", activeBg: "bg-rose-500" },
    { path: "/profile", icon: User, label: "Profilo", badge: 0, color: "text-emerald-400", activeBg: "bg-emerald-500" },
    ...(isAdmin ? [{ path: "/admin", icon: Shield, label: "Admin", badge: 0, color: "text-red-400", activeBg: "bg-red-500" }] : []),
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

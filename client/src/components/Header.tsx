import { User, Heart, Home, Shield, Users, Trophy, Lock, Eye } from "lucide-react";
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
            <img src={vibraLogo} alt="Vibra" className="w-10 h-10 object-contain" data-testid="vibra-logo-header" />
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
    { path: "/", icon: Home, label: "Scopri", badge: 0 },
    { path: "/matches", icon: Heart, label: "Match", badge: 0 },
    { path: "/rooms", icon: Users, label: "Stanze", badge: 0 },
    { path: "/challenges", icon: Trophy, label: "Sfide", badge: 0 },
    { path: "/private-rooms", icon: Lock, label: "Private", badge: pendingRoomCount },
    { path: "/prima-impressione", icon: Eye, label: "Vota", badge: unrepliedRatingCount },
    { path: "/profile", icon: User, label: "Profilo", badge: 0 },
    ...(isAdmin ? [{ path: "/admin", icon: Shield, label: "Admin", badge: 0 }] : []),
  ];

  return (
    <nav className="sticky bottom-0 z-40 w-full bg-black/40 backdrop-blur-xl border-t border-white/10" data-testid="bottom-nav">
      <div className="flex items-center justify-around px-2 py-2">
        {navItems.map((item) => {
          const isActive = location === item.path;
          return (
            <Link key={item.path} href={item.path}>
              <motion.div
                whileTap={{ scale: 0.9 }}
                className="flex flex-col items-center gap-1"
                data-testid={`nav-${item.label.toLowerCase()}`}
              >
                <div className={`relative flex items-center justify-center w-10 h-10 rounded-xl transition-colors ${
                  isActive
                    ? "bg-primary text-white"
                    : "text-white/60"
                }`}>
                  <item.icon className="w-5 h-5" />
                  {item.badge > 0 && (
                    <span
                      className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-accent text-white text-[10px] font-bold flex items-center justify-center px-1"
                      data-testid={`badge-${item.label.toLowerCase()}`}
                    >
                      {item.badge > 99 ? "99+" : item.badge}
                    </span>
                  )}
                </div>
                <span className={`text-[10px] ${isActive ? "text-white font-medium" : "text-white/50"}`}>
                  {item.label}
                </span>
              </motion.div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

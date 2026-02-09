import { User, Heart, Home, Shield, Users, Trophy, Lock } from "lucide-react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import vibraLogo from "@assets/Gemini_Generated_Image_adkxs1adkxs1adkx_1770480122018.png";
import type { User as UserType } from "@shared/schema";

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

  const { data: currentUser } = useQuery<UserType | null>({
    queryKey: ["/api/auth/user"],
    enabled: !!user,
  });

  const navItems = [
    { path: "/", icon: Home, label: "Scopri" },
    { path: "/matches", icon: Heart, label: "Match" },
    { path: "/rooms", icon: Users, label: "Stanze" },
    { path: "/challenges", icon: Trophy, label: "Sfide" },
    { path: "/private-rooms", icon: Lock, label: "Private" },
    { path: "/profile", icon: User, label: "Profilo" },
    ...(currentUser?.isAdmin ? [{ path: "/admin", icon: Shield, label: "Admin" }] : []),
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
                <div className={`flex items-center justify-center w-10 h-10 rounded-xl transition-colors ${
                  isActive
                    ? "bg-primary text-white"
                    : "text-white/60"
                }`}>
                  <item.icon className="w-5 h-5" />
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

import { User, Heart, Home, Shield } from "lucide-react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import type { User as UserType } from "@shared/schema";

export function Header() {
  const [location] = useLocation();
  const { user } = useAuth();

  const { data: currentUser } = useQuery<UserType | null>({
    queryKey: ["/api/auth/user"],
    enabled: !!user,
  });

  const navItems = [
    { path: "/", icon: Home, label: "Scopri" },
    { path: "/matches", icon: Heart, label: "Match" },
    { path: "/profile", icon: User, label: "Profilo" },
    ...(currentUser?.isAdmin ? [{ path: "/admin", icon: Shield, label: "Admin" }] : []),
  ];

  return (
    <header className="sticky top-0 z-40 w-full">
      <div className="flex items-center justify-between px-4 py-3 bg-card/80 backdrop-blur-xl border-b border-border">
        <Link href="/" data-testid="link-home">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-gradient-to-b from-indigo-500 to-purple-600 flex items-center justify-center"
                 style={{ boxShadow: "0 0 20px rgba(139, 92, 246, 0.5)" }}>
              <Heart className="w-6 h-6 text-pink-300" strokeWidth={2} />
            </div>
            <span className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              Vibra
            </span>
          </div>
        </Link>

        <nav className="flex items-center gap-2">
          {navItems.map((item) => {
            const isActive = location === item.path;
            return (
              <Link key={item.path} href={item.path}>
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className={`relative flex items-center justify-center w-12 h-12 rounded-xl transition-colors ${
                    isActive 
                      ? "bg-primary text-white" 
                      : "bg-secondary/30 text-white hover:bg-secondary/50"
                  }`}
                  data-testid={`nav-${item.label.toLowerCase()}`}
                >
                  <item.icon className="w-6 h-6" />
                </motion.div>
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}

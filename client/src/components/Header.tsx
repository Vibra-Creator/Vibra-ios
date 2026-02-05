import { Sparkles, User, Heart, Settings } from "lucide-react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";

export function Header() {
  const [location] = useLocation();

  const navItems = [
    { path: "/", icon: Sparkles, label: "Scopri" },
    { path: "/matches", icon: Heart, label: "Match" },
    { path: "/profile", icon: User, label: "Profilo" },
  ];

  return (
    <header className="sticky top-0 z-40 w-full">
      <div className="flex items-center justify-between px-4 py-3 bg-card/80 backdrop-blur-xl border-b border-border">
        <Link href="/" data-testid="link-home">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary via-accent to-secondary flex items-center justify-center"
                 style={{ boxShadow: "var(--glow-primary)" }}>
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-primary via-accent to-secondary bg-clip-text text-transparent">
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

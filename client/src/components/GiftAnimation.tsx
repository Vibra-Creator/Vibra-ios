import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Star, Heart, Sparkles } from "lucide-react";
import type { VirtualGift } from "@shared/schema";

const giftIcons: Record<string, typeof Star> = {
  star: Star,
  flower: Sparkles,
  heart: Heart,
  ring: Sparkles,
  explosion: Star,
  galaxy: Sparkles,
};

interface GiftAnimationProps {
  gift: VirtualGift;
  senderName: string;
  message?: string | null;
  onComplete: () => void;
}

function Particle({ color, delay, x, y }: { color: string; delay: number; x: number; y: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0, x: 0, y: 0 }}
      animate={{
        opacity: [0, 1, 1, 0],
        scale: [0, 1.5, 1, 0],
        x: x,
        y: y,
      }}
      transition={{ duration: 2, delay, ease: "easeOut" }}
      className="absolute w-3 h-3 rounded-full"
      style={{ backgroundColor: color, left: "50%", top: "50%", filter: `blur(1px)` }}
    />
  );
}

export default function GiftAnimation({ gift, senderName, message, onComplete }: GiftAnimationProps) {
  const [show, setShow] = useState(true);
  const IconComponent = giftIcons[gift.icon] || Star;

  useEffect(() => {
    const timer = setTimeout(() => {
      setShow(false);
      setTimeout(onComplete, 500);
    }, 4000);
    return () => clearTimeout(timer);
  }, [onComplete]);

  const particles = Array.from({ length: 12 }, (_, i) => {
    const angle = (i / 12) * Math.PI * 2;
    const distance = 80 + Math.random() * 60;
    return {
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance,
      delay: Math.random() * 0.5,
    };
  });

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center"
          onClick={() => { setShow(false); setTimeout(onComplete, 300); }}
          data-testid="gift-animation-overlay"
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-md" />
          
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: "spring", damping: 12, stiffness: 200 }}
            className="relative flex flex-col items-center"
          >
            <div className="relative">
              {particles.map((p, i) => (
                <Particle key={i} color={gift.color} delay={p.delay} x={p.x} y={p.y} />
              ))}
              
              <motion.div
                animate={{
                  scale: [1, 1.2, 1],
                  rotate: [0, 5, -5, 0],
                }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                className="relative w-28 h-28 rounded-full flex items-center justify-center"
                style={{
                  background: `radial-gradient(circle, ${gift.color}40, ${gift.color}10)`,
                  boxShadow: `0 0 60px ${gift.color}40, 0 0 120px ${gift.color}20`,
                }}
              >
                <IconComponent className="w-14 h-14" style={{ color: gift.color, filter: `drop-shadow(0 0 10px ${gift.color})` }} />
              </motion.div>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="mt-6 text-center"
            >
              <h3 className="text-2xl font-bold text-white mb-1" style={{ textShadow: `0 0 20px ${gift.color}` }}>
                {gift.name}
              </h3>
              <p className="text-white/70 text-sm">
                Da <span className="text-white font-medium">{senderName}</span>
              </p>
              {message && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1 }}
                  className="mt-3 text-white/80 text-sm italic max-w-xs px-4 py-2 rounded-xl bg-white/10 backdrop-blur-sm"
                >
                  "{message}"
                </motion.p>
              )}
            </motion.div>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 2 }}
              className="mt-6 text-white/40 text-xs"
            >
              Tocca per chiudere
            </motion.p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

import { motion, AnimatePresence } from "framer-motion";
import { Heart, MessageCircle, X, Sparkles, Zap, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";

function useHeartbeatReveal(isOpen: boolean) {
  const [elapsed, setElapsed] = useState(0);
  const [heartbeatPhase, setHeartbeatPhase] = useState(0);
  const startTimeRef = useRef<number>(0);
  const hapticIntervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const REVEAL_DURATION = 10000;

  const progress = Math.min(elapsed / REVEAL_DURATION, 1);
  const blurAmount = Math.max(20 * (1 - progress), 0);
  const separationX = Math.max(60 * (1 - progress), 0);
  const photoScale = 0.85 + 0.15 * progress;

  useEffect(() => {
    if (!isOpen) {
      setElapsed(0);
      setHeartbeatPhase(0);
      return;
    }

    startTimeRef.current = Date.now();

    const frame = () => {
      const now = Date.now();
      const e = now - startTimeRef.current;
      setElapsed(e);
      if (e < REVEAL_DURATION) {
        rafId = requestAnimationFrame(frame);
      }
    };
    let rafId = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const tick = () => {
      setHeartbeatPhase((p) => p + 1);

      const p = Math.min(elapsed / REVEAL_DURATION, 1);
      const interval = Math.max(300, 900 - p * 600);

      if ("vibrate" in navigator) {
        const intensity = Math.round(10 + p * 50);
        const pattern = p < 0.5
          ? [intensity, 80, Math.round(intensity * 0.6)]
          : [intensity, 50, Math.round(intensity * 0.8), 40, Math.round(intensity * 0.5)];
        try { navigator.vibrate(pattern); } catch {}
      }

      hapticIntervalRef.current = setTimeout(tick, interval);
    };

    hapticIntervalRef.current = setTimeout(tick, 800);

    return () => {
      if (hapticIntervalRef.current) clearTimeout(hapticIntervalRef.current);
      try { navigator.vibrate(0); } catch {}
    };
  }, [isOpen, elapsed]);

  return { progress, blurAmount, separationX, photoScale, heartbeatPhase };
}

function HeartbeatPhoto({
  src,
  alt,
  blurAmount,
  offsetX,
  scale,
  heartbeatPhase,
  direction,
  glowColor,
  conicGradient,
  testId,
}: {
  src: string;
  alt: string;
  blurAmount: number;
  offsetX: number;
  scale: number;
  heartbeatPhase: number;
  direction: "left" | "right";
  glowColor: string;
  conicGradient: string;
  testId?: string;
}) {
  const beatScale = heartbeatPhase % 2 === 0 ? 1.08 : 1;
  const translateX = direction === "left" ? -offsetX : offsetX;

  return (
    <motion.div
      className="relative"
      style={{
        transform: `translateX(${translateX}px) scale(${scale * beatScale})`,
        transition: "transform 0.15s cubic-bezier(0.4, 0, 0.2, 1)",
      }}
    >
      <motion.div
        className="absolute -inset-2 rounded-full"
        style={{
          background: conicGradient,
          filter: "blur(6px)",
          opacity: 0.5 + (1 - blurAmount / 20) * 0.5,
        }}
        animate={{ rotate: [0, direction === "left" ? 360 : -360] }}
        transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
      />
      <motion.div
        className="absolute -inset-3 rounded-full pointer-events-none"
        style={{
          boxShadow: `0 0 ${20 + (1 - blurAmount / 20) * 40}px ${glowColor}`,
          opacity: heartbeatPhase % 2 === 0 ? 0.8 : 0.3,
          transition: "opacity 0.15s ease, box-shadow 0.3s ease",
        }}
      />
      <img
        src={src}
        alt={alt}
        className="relative w-24 h-24 rounded-full object-cover border-2 border-white/50"
        style={{
          filter: `blur(${blurAmount}px)`,
          transition: "filter 0.5s ease-out",
          boxShadow: `0 0 30px ${glowColor}, 0 0 60px ${glowColor}44`,
        }}
        data-testid={testId}
      />
    </motion.div>
  );
}
import type { Profile } from "@shared/schema";

interface MatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  matchedProfile: Profile | null;
  currentProfile?: Profile | null;
  matchId?: string | null;
}

const PARTICLE_COLORS = [
  "#ff00ff", "#00ffff", "#ff0088", "#8800ff", "#00ff88",
  "#ffff00", "#ff4400", "#0088ff", "#ff00cc", "#88ff00",
  "#ff6600", "#6600ff", "#00ffaa", "#ff0044", "#44ff00",
  "#cc00ff", "#00ccff", "#ffcc00", "#ff0066", "#0066ff",
];

function generateParticles(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 8 + 2,
    color: PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)],
    delay: Math.random() * 2,
    duration: Math.random() * 3 + 2,
    angle: Math.random() * 360,
    distance: Math.random() * 300 + 100,
  }));
}

function generateStarbursts(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    angle: (360 / count) * i,
    length: Math.random() * 200 + 150,
    color: PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)],
    width: Math.random() * 3 + 1,
    delay: Math.random() * 0.5,
  }));
}

function generateFloatingHearts(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    startX: Math.random() * 100,
    delay: Math.random() * 3,
    duration: Math.random() * 4 + 3,
    size: Math.random() * 20 + 10,
    color: PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)],
  }));
}

function generateFireworks(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: 20 + Math.random() * 60,
    y: 20 + Math.random() * 40,
    delay: Math.random() * 3 + 0.5,
    color: PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)],
    sparks: Array.from({ length: 12 }, (_, j) => ({
      angle: (360 / 12) * j,
      distance: Math.random() * 80 + 40,
      size: Math.random() * 4 + 2,
    })),
  }));
}

function GlowOrb({ delay, x, y, color, size }: { delay: number; x: number; y: number; color: string; size: number }) {
  return (
    <motion.div
      className="absolute rounded-full pointer-events-none"
      style={{
        left: `${x}%`,
        top: `${y}%`,
        width: size,
        height: size,
        background: `radial-gradient(circle, ${color}88, ${color}44, transparent)`,
        boxShadow: `0 0 ${size * 2}px ${color}66, 0 0 ${size * 4}px ${color}33`,
      }}
      initial={{ scale: 0, opacity: 0 }}
      animate={{
        scale: [0, 1.5, 0.8, 1.2, 0],
        opacity: [0, 1, 0.6, 0.8, 0],
      }}
      transition={{ delay, duration: 3, repeat: Infinity, repeatDelay: Math.random() * 2 }}
    />
  );
}

function ExplosionRing({ delay, color, size }: { delay: number; color: string; size: number }) {
  return (
    <motion.div
      className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none"
      style={{
        border: `3px solid ${color}`,
        boxShadow: `0 0 20px ${color}88, inset 0 0 20px ${color}44`,
      }}
      initial={{ width: 0, height: 0, opacity: 1 }}
      animate={{ width: size, height: size, opacity: 0 }}
      transition={{ delay, duration: 1.5, ease: "easeOut" }}
    />
  );
}

function useMatchSound() {
  const audioContextRef = useRef<AudioContext | null>(null);

  const playMatchSound = useCallback(() => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = ctx;

      const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51, 1567.98];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = freq;
        osc.type = "sine";
        gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.12);
        gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + i * 0.12 + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.12 + 0.6);
        osc.start(ctx.currentTime + i * 0.12);
        osc.stop(ctx.currentTime + i * 0.12 + 0.6);
      });

      setTimeout(() => {
        const sparkle = [1200, 1400, 1600, 1800, 2000, 1500, 1800, 2200];
        sparkle.forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.frequency.value = freq;
          osc.type = "triangle";
          gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.06);
          gain.gain.linearRampToValueAtTime(0.08, ctx.currentTime + i * 0.06 + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.06 + 0.3);
          osc.start(ctx.currentTime + i * 0.06);
          osc.stop(ctx.currentTime + i * 0.06 + 0.3);
        });
      }, 800);

      setTimeout(() => {
        const bass = ctx.createOscillator();
        const bassGain = ctx.createGain();
        bass.connect(bassGain);
        bassGain.connect(ctx.destination);
        bass.frequency.value = 80;
        bass.type = "sine";
        bassGain.gain.setValueAtTime(0.2, ctx.currentTime);
        bassGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.0);
        bass.start(ctx.currentTime);
        bass.stop(ctx.currentTime + 1.0);
      }, 100);

    } catch {}
  }, []);

  useEffect(() => {
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
      }
    };
  }, []);

  return playMatchSound;
}

export function MatchModal({ isOpen, onClose, matchedProfile, currentProfile, matchId }: MatchModalProps) {
  const [, setLocation] = useLocation();
  const [phase, setPhase] = useState(0);
  const playMatchSound = useMatchSound();
  const { progress, blurAmount, separationX, photoScale, heartbeatPhase } = useHeartbeatReveal(isOpen);

  const particles = useMemo(() => generateParticles(80), []);
  const starbursts = useMemo(() => generateStarbursts(24), []);
  const floatingHearts = useMemo(() => generateFloatingHearts(20), []);
  const fireworks = useMemo(() => generateFireworks(6), []);
  const glowOrbs = useMemo(() => Array.from({ length: 15 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    color: PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)],
    size: Math.random() * 60 + 30,
    delay: Math.random() * 2,
  })), []);

  useEffect(() => {
    if (isOpen) {
      setPhase(0);
      playMatchSound();
      const t1 = setTimeout(() => setPhase(1), 300);
      const t2 = setTimeout(() => setPhase(2), 800);
      const t3 = setTimeout(() => setPhase(3), 1500);
      return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
    }
  }, [isOpen, playMatchSound]);

  if (!matchedProfile) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-hidden"
          onClick={onClose}
        >
          <div className="absolute inset-0 bg-black" />

          <motion.div
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            <div className="absolute inset-0" style={{
              background: "radial-gradient(ellipse at center, rgba(139,0,255,0.3) 0%, rgba(0,200,255,0.15) 30%, rgba(255,0,136,0.1) 60%, transparent 80%)"
            }} />
          </motion.div>

          {phase >= 0 && (
            <>
              <ExplosionRing delay={0.1} color="#ff00ff" size={600} />
              <ExplosionRing delay={0.3} color="#00ffff" size={800} />
              <ExplosionRing delay={0.5} color="#ff0088" size={1000} />
              <ExplosionRing delay={0.7} color="#8800ff" size={1200} />
              <ExplosionRing delay={0.9} color="#ffff00" size={500} />
              <ExplosionRing delay={1.1} color="#00ff88" size={900} />
              <ExplosionRing delay={1.5} color="#ff4400" size={700} />
              <ExplosionRing delay={2.0} color="#00ffcc" size={1100} />
            </>
          )}

          {phase >= 1 && starbursts.map((ray) => (
            <motion.div
              key={`ray-${ray.id}`}
              className="absolute left-1/2 top-1/2 origin-bottom pointer-events-none"
              style={{
                width: ray.width,
                height: 0,
                background: `linear-gradient(to top, ${ray.color}, transparent)`,
                transform: `rotate(${ray.angle}deg)`,
                boxShadow: `0 0 8px ${ray.color}88`,
              }}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: ray.length, opacity: [0, 1, 0.3] }}
              transition={{ delay: ray.delay, duration: 1.2, ease: "easeOut" }}
            />
          ))}

          {phase >= 1 && particles.map((p) => (
            <motion.div
              key={`particle-${p.id}`}
              className="absolute rounded-full pointer-events-none"
              style={{
                left: "50%",
                top: "50%",
                width: p.size,
                height: p.size,
                background: p.color,
                boxShadow: `0 0 ${p.size * 3}px ${p.color}, 0 0 ${p.size * 6}px ${p.color}88`,
              }}
              initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
              animate={{
                x: Math.cos(p.angle * Math.PI / 180) * p.distance,
                y: Math.sin(p.angle * Math.PI / 180) * p.distance,
                opacity: [1, 1, 0],
                scale: [1, 1.5, 0],
              }}
              transition={{ delay: p.delay * 0.5, duration: p.duration, ease: "easeOut" }}
            />
          ))}

          {phase >= 2 && glowOrbs.map((orb) => (
            <GlowOrb
              key={`orb-${orb.id}`}
              delay={orb.delay}
              x={orb.x}
              y={orb.y}
              color={orb.color}
              size={orb.size}
            />
          ))}

          {phase >= 2 && floatingHearts.map((h) => (
            <motion.div
              key={`heart-${h.id}`}
              className="absolute pointer-events-none"
              style={{
                left: `${h.startX}%`,
                bottom: -30,
                fontSize: h.size,
                color: h.color,
                filter: `drop-shadow(0 0 8px ${h.color})`,
              }}
              animate={{
                y: [0, -window.innerHeight - 100],
                x: [0, Math.sin(h.id) * 80],
                rotate: [0, h.id % 2 === 0 ? 360 : -360],
                opacity: [0, 1, 1, 0],
              }}
              transition={{
                delay: h.delay,
                duration: h.duration,
                repeat: Infinity,
                ease: "easeOut",
              }}
            >
              <Heart className="fill-current" style={{ width: h.size, height: h.size }} />
            </motion.div>
          ))}

          {phase >= 2 && fireworks.map((fw) => (
            <div key={`fw-${fw.id}`} className="absolute pointer-events-none" style={{ left: `${fw.x}%`, top: `${fw.y}%` }}>
              {fw.sparks.map((spark, si) => (
                <motion.div
                  key={si}
                  className="absolute rounded-full"
                  style={{
                    width: spark.size,
                    height: spark.size,
                    background: fw.color,
                    boxShadow: `0 0 ${spark.size * 4}px ${fw.color}, 0 0 ${spark.size * 8}px ${fw.color}66`,
                  }}
                  initial={{ x: 0, y: 0, opacity: 0, scale: 0 }}
                  animate={{
                    x: Math.cos(spark.angle * Math.PI / 180) * spark.distance,
                    y: Math.sin(spark.angle * Math.PI / 180) * spark.distance,
                    opacity: [0, 1, 1, 0],
                    scale: [0, 1.5, 1, 0],
                  }}
                  transition={{ delay: fw.delay, duration: 1.5, ease: "easeOut" }}
                />
              ))}
              <motion.div
                className="absolute rounded-full"
                style={{
                  width: 20,
                  height: 20,
                  background: `radial-gradient(circle, white, ${fw.color})`,
                  boxShadow: `0 0 30px ${fw.color}, 0 0 60px ${fw.color}88`,
                  transform: "translate(-50%, -50%)",
                }}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: [0, 2, 0], opacity: [0, 1, 0] }}
                transition={{ delay: fw.delay, duration: 0.6 }}
              />
            </div>
          ))}

          {phase >= 1 && (
            <>
              <motion.div
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none"
                style={{
                  width: 300,
                  height: 300,
                  background: "radial-gradient(circle, rgba(255,0,255,0.4), rgba(0,255,255,0.2), transparent)",
                  filter: "blur(40px)",
                }}
                animate={{
                  scale: [1, 1.5, 1],
                  opacity: [0.5, 0.8, 0.5],
                }}
                transition={{ duration: 2, repeat: Infinity }}
              />
              <motion.div
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none"
                style={{
                  width: 200,
                  height: 200,
                  background: "radial-gradient(circle, rgba(255,255,0,0.3), rgba(255,0,136,0.2), transparent)",
                  filter: "blur(30px)",
                }}
                animate={{
                  scale: [1.2, 0.8, 1.2],
                  opacity: [0.6, 1, 0.6],
                  rotate: [0, 180, 360],
                }}
                transition={{ duration: 3, repeat: Infinity }}
              />
            </>
          )}

          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            transition={{ delay: 0.3, type: "spring", stiffness: 200, damping: 20 }}
            className="relative z-10 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={onClose}
              className="absolute -top-2 -right-2 z-20 w-10 h-10 rounded-full bg-black/60 backdrop-blur-sm border border-white/20 flex items-center justify-center"
              data-testid="button-close-match-modal"
            >
              <X className="w-5 h-5 text-white" />
            </button>

            <div className="rounded-3xl overflow-hidden backdrop-blur-xl border border-white/20 p-1"
                 style={{
                   background: "linear-gradient(135deg, rgba(139,0,255,0.2), rgba(0,200,255,0.15), rgba(255,0,136,0.2))",
                   boxShadow: "0 0 60px rgba(139,0,255,0.3), 0 0 120px rgba(0,200,255,0.15), 0 0 180px rgba(255,0,136,0.1)",
                 }}>
              <div className="rounded-2xl bg-black/50 backdrop-blur-sm p-6 text-center relative overflow-hidden">

                <motion.div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background: "conic-gradient(from 0deg, transparent, rgba(255,0,255,0.1), transparent, rgba(0,255,255,0.1), transparent, rgba(255,255,0,0.1), transparent)",
                  }}
                  animate={{ rotate: [0, 360] }}
                  transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                />

                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ delay: 0.5, type: "spring", stiffness: 200 }}
                  className="mb-4 relative"
                >
                  <motion.div
                    className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
                    style={{
                      width: 120,
                      height: 120,
                      background: "radial-gradient(circle, rgba(255,0,255,0.4), transparent)",
                      filter: "blur(20px)",
                    }}
                    animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  />
                  <div className="relative inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-cyan-400"
                       style={{ boxShadow: "0 0 40px rgba(200,0,255,0.6), 0 0 80px rgba(0,200,255,0.3), 0 0 120px rgba(255,0,136,0.2)" }}>
                    <motion.div
                      animate={{ rotate: [0, 360] }}
                      transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                    >
                      <Heart className="w-10 h-10 text-white fill-white drop-shadow-lg" />
                    </motion.div>
                  </div>

                  {[...Array(8)].map((_, i) => (
                    <motion.div
                      key={`mini-star-${i}`}
                      className="absolute left-1/2 top-1/2 pointer-events-none"
                      style={{ color: PARTICLE_COLORS[i % PARTICLE_COLORS.length] }}
                      animate={{
                        x: Math.cos((i * 45) * Math.PI / 180) * 50,
                        y: Math.sin((i * 45) * Math.PI / 180) * 50,
                        scale: [0, 1, 0],
                        opacity: [0, 1, 0],
                      }}
                      transition={{ delay: 0.8 + i * 0.1, duration: 1.5, repeat: Infinity, repeatDelay: 1 }}
                    >
                      <Star className="w-4 h-4 fill-current" />
                    </motion.div>
                  ))}
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7 }}
                >
                  <div className="flex items-center justify-center gap-2 mb-1 flex-wrap">
                    <motion.div animate={{ rotate: [0, 15, -15, 0] }} transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 2 }}>
                      <Sparkles className="w-6 h-6 text-yellow-400" style={{ filter: "drop-shadow(0 0 8px rgba(255,255,0,0.8))" }} />
                    </motion.div>
                    <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 0.8, repeat: Infinity }}>
                      <h2 className="text-3xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400"
                          style={{
                            filter: "drop-shadow(0 0 20px rgba(200,0,255,0.8)) drop-shadow(0 0 40px rgba(0,200,255,0.4))",
                            WebkitTextStroke: "0.5px rgba(255,255,255,0.3)",
                          }}
                          data-testid="text-vibra-match">
                        VIBRA MATCH
                      </h2>
                    </motion.div>
                    <motion.div animate={{ rotate: [0, -15, 15, 0] }} transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 2 }}>
                      <Zap className="w-6 h-6 text-cyan-400" style={{ filter: "drop-shadow(0 0 8px rgba(0,255,255,0.8))" }} />
                    </motion.div>
                  </div>
                  <p className="text-white/80 mb-6 text-base">
                    Tu e <span className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-cyan-400"
                                style={{ filter: "drop-shadow(0 0 6px rgba(255,0,136,0.5))" }}>
                      {matchedProfile.name}
                    </span> vi siete piaciuti!
                  </p>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.9, type: "spring" }}
                  className="flex justify-center items-center gap-4 mb-6"
                >
                  {currentProfile && (
                    <HeartbeatPhoto
                      src={currentProfile.imageUrl}
                      alt="Tu"
                      blurAmount={blurAmount}
                      offsetX={separationX}
                      scale={photoScale}
                      heartbeatPhase={heartbeatPhase}
                      direction="left"
                      glowColor="rgba(200,0,255,0.5)"
                      conicGradient="conic-gradient(from 0deg, #ff00ff, #00ffff, #ff0088, #8800ff, #ff00ff)"
                    />
                  )}

                  <motion.div
                    className="relative flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-cyan-400"
                    style={{
                      boxShadow: `0 0 ${20 + progress * 30}px rgba(255,0,136,${0.3 + progress * 0.4}), 0 0 ${40 + progress * 40}px rgba(0,200,255,${0.2 + progress * 0.3})`,
                      transform: `scale(${heartbeatPhase % 2 === 0 ? 1.3 : 1})`,
                      transition: "transform 0.15s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.3s ease",
                    }}
                  >
                    <Heart className="w-7 h-7 text-white fill-white" />
                    <motion.div
                      className="absolute inset-0 rounded-full border-2 border-white/30"
                      animate={{ scale: [1, 2], opacity: [0.5, 0] }}
                      transition={{ duration: 1, repeat: Infinity }}
                    />
                    <motion.div
                      className="absolute inset-0 rounded-full border-2 border-pink-400/30"
                      animate={{ scale: [1, 2.5], opacity: [0.5, 0] }}
                      transition={{ duration: 1.2, repeat: Infinity, delay: 0.3 }}
                    />
                  </motion.div>

                  <HeartbeatPhoto
                    src={matchedProfile.imageUrl}
                    alt={matchedProfile.name}
                    blurAmount={blurAmount}
                    offsetX={separationX}
                    scale={photoScale}
                    heartbeatPhase={heartbeatPhase}
                    direction="right"
                    glowColor="rgba(0,200,255,0.5)"
                    conicGradient="conic-gradient(from 180deg, #00ffff, #ff00ff, #ff0088, #00ff88, #00ffff)"
                    testId="match-profile-image"
                  />
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.1 }}
                  className="space-y-3 relative z-10"
                >
                  <Button
                    className="w-full relative overflow-visible"
                    size="lg"
                    onClick={() => {
                      onClose();
                      if (matchId) {
                        setLocation(`/chat/${matchId}`);
                      } else {
                        setLocation("/matches");
                      }
                    }}
                    data-testid="button-send-message"
                    style={{ boxShadow: "0 0 20px rgba(139,0,255,0.4)" }}
                  >
                    <MessageCircle className="w-5 h-5 mr-2" />
                    Invia un Messaggio
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full border-white/30 text-white"
                    size="lg"
                    onClick={onClose}
                    data-testid="button-keep-swiping"
                  >
                    Continua a Esplorare
                  </Button>
                </motion.div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

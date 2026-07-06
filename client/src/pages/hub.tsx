import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Mic, MicOff, Send, Loader2, ExternalLink, ArrowRight, Sparkles, Lock } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/i18n/LanguageContext";

interface AIResult {
  action: "navigate" | "external" | "none";
  route: string | null;
  external_url: string | null;
  message: string;
  emoji: string;
}

declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}

type VoiceState = "idle" | "listening" | "processing";

function useVoiceInput(onResult: (text: string) => void) {
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [interim, setInterim] = useState("");
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const supported = typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  const start = useCallback(() => {
    if (!supported) return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SR();
    rec.lang = "it-IT";
    rec.continuous = false;
    rec.interimResults = true;
    rec.onstart = () => { setVoiceState("listening"); setInterim(""); };
    rec.onresult = (e: SpeechRecognitionEvent) => {
      let interim = "", final = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t; else interim += t;
      }
      setInterim(interim || final);
      if (final) { setVoiceState("processing"); setInterim(""); onResult(final.trim()); }
    };
    rec.onerror = () => { setVoiceState("idle"); setInterim(""); };
    rec.onend = () => setVoiceState(v => v === "listening" ? "idle" : v);
    recognitionRef.current = rec;
    rec.start();
  }, [supported, onResult]);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setVoiceState("idle");
    setInterim("");
  }, []);

  return { voiceState, interim, start, stop, supported };
}

const CARDS = [
  { key: "dating",    emoji: "❤️",  route: "/dating",          color: ["#ec4899","#f43f5e"], live: true },
  { key: "matches",   emoji: "💬",  route: "/matches",         color: ["#8b5cf6","#6d28d9"], live: true },
  { key: "rooms",     emoji: "🌐",  route: "/rooms",           color: ["#06b6d4","#0e7490"], live: true },
  { key: "signals",   emoji: "📡",  route: "/signals",         color: ["#f59e0b","#d97706"], live: true },
  { key: "challenges",emoji: "🏆",  route: "/challenges",      color: ["#10b981","#059669"], live: true },
  { key: "vibing",    emoji: "⚡",  route: "/vibing",          color: ["#84cc16","#65a30d"], live: true },
  { key: "reels",       emoji: "🎬",  route: "/reels",       color: ["#a855f7","#7c3aed"], live: true },
  { key: "vibrapp",     emoji: "🛸",  route: "/vibrapp",     color: ["#3b82f6","#1d4ed8"], live: true },
  { key: "marketplace", emoji: "🛒",  route: "/marketplace", color: ["#f97316","#ea580c"], live: true },
  { key: "mobility",    emoji: "🚗",  route: "/mobilita",    color: ["#64748b","#475569"], live: true },
  { key: "home",        emoji: "🏠",  route: "/casa",        color: ["#14b8a6","#0f766e"], live: true },
  { key: "work",        emoji: "💼",  route: "/lavoro",      color: ["#6366f1","#4f46e5"], live: true },
] as const;

const COMING: never[] = [];

export default function HubPage() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [query, setQuery] = useState("");
  const [aiResult, setAiResult] = useState<AIResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.title = "Vibra — Hub";
  }, []);

  const { data: profile } = useQuery<{ name?: string }>({
    queryKey: ["/api/profiles/me"],
    queryFn: async () => {
      const r = await fetch("/api/profiles/me", { credentials: "include" });
      return r.ok ? r.json() : null;
    },
    retry: false,
  });

  const search = useMutation({
    mutationFn: async (q: string) => {
      const res = await apiRequest("POST", "/api/ai-search", { query: q });
      return res.json() as Promise<AIResult>;
    },
    onSuccess: setAiResult,
  });

  const handleSubmit = useCallback((q?: string) => {
    const text = (q ?? query).trim();
    if (!text) return;
    setQuery(text);
    setAiResult(null);
    search.mutate(text);
  }, [query, search]);

  const { voiceState, interim, start, stop, supported } = useVoiceInput(handleSubmit);
  const isListening = voiceState === "listening";
  const isBusy = search.isPending || voiceState === "processing";

  const handleAction = () => {
    if (!aiResult) return;
    if (aiResult.action === "navigate" && aiResult.route) setLocation(aiResult.route);
    else if (aiResult.action === "external" && aiResult.external_url) window.open(aiResult.external_url, "_blank");
  };

  const firstName = profile?.name?.split(" ")[0] || user?.username || "";

  return (
    <div className="flex-1 overflow-y-auto pb-6" style={{ background: "transparent" }}>
      <div className="px-4 pt-4 max-w-lg mx-auto">

        {/* Greeting */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-5"
        >
          <p className="text-white/50 text-sm" style={{ fontFamily: "Space Grotesk, sans-serif" }}>
            {new Date().getHours() < 12 ? "🌅 Buongiorno" : new Date().getHours() < 18 ? "☀️ Buon pomeriggio" : "🌙 Buonasera"}
            {firstName ? `, ${firstName}` : ""}
          </p>
          <h1 className="text-white font-bold text-2xl mt-0.5" style={{ fontFamily: "Space Grotesk, sans-serif" }}>
            {t("hub.subtitle")}
          </h1>
        </motion.div>

        {/* AI Search Bar */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-2"
        >
          <div
            className="rounded-2xl p-[1px]"
            style={{ background: "linear-gradient(135deg, #8b5cf6, #ec4899, #06b6d4)" }}
          >
            <div className="rounded-2xl px-4 py-3 flex items-center gap-3" style={{ background: "#0f0a1e" }}>
              <Sparkles className="w-4 h-4 shrink-0" style={{ color: "#a78bfa" }} />
              <input
                ref={inputRef}
                data-testid="hub-ai-input"
                value={isListening ? interim : query}
                onChange={e => { if (!isListening) { setQuery(e.target.value); setAiResult(null); } }}
                onKeyDown={e => e.key === "Enter" && !isListening && handleSubmit()}
                placeholder={isListening ? t("hub.listening") : t("hub.search")}
                readOnly={isListening}
                className="flex-1 bg-transparent text-white placeholder-white/30 text-sm outline-none"
                style={{ fontFamily: "Space Grotesk, sans-serif" }}
              />
              {supported && (
                <motion.button
                  data-testid="hub-ai-mic"
                  onClick={isListening ? stop : start}
                  className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: isListening ? "linear-gradient(135deg,#ec4899,#f43f5e)" : "rgba(255,255,255,0.08)" }}
                  animate={isListening ? { scale: [1, 1.08, 1] } : {}}
                  transition={{ duration: 0.7, repeat: Infinity }}
                  whileTap={{ scale: 0.9 }}
                >
                  {isListening ? <MicOff className="w-4 h-4 text-white" /> : <Mic className="w-4 h-4 text-white/60" />}
                </motion.button>
              )}
              <motion.button
                data-testid="hub-ai-send"
                onClick={() => handleSubmit()}
                disabled={!(isListening ? interim : query).trim() || isBusy || isListening}
                className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 disabled:opacity-40"
                style={{ background: "linear-gradient(135deg,#8b5cf6,#ec4899)" }}
                whileTap={{ scale: 0.9 }}
              >
                {isBusy ? <Loader2 className="w-4 h-4 text-white animate-spin" /> : <Send className="w-4 h-4 text-white" />}
              </motion.button>
            </div>
          </div>

          {/* Listening wave */}
          <AnimatePresence>
            {isListening && (
              <motion.div
                className="mx-1 mt-2 rounded-xl px-4 py-2 flex items-center gap-3"
                style={{ background: "rgba(236,72,153,0.1)", border: "1px solid rgba(236,72,153,0.25)" }}
                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
              >
                <div className="flex items-end gap-[3px] h-4">
                  {[0.4,0.9,0.5,1,0.6,0.85,0.4].map((h, i) => (
                    <motion.div key={i} className="w-1 rounded-full" style={{ background: "#ec4899" }}
                      animate={{ scaleY: [h, 1, h*0.5, 1, h] }}
                      transition={{ duration: 0.6 + i*0.07, repeat: Infinity, ease: "easeInOut" }}
                    />
                  ))}
                </div>
                <p className="text-pink-300 text-xs flex-1 truncate">{interim || "Parla ora…"}</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* AI Result */}
          <AnimatePresence>
            {aiResult && (
              <motion.div
                className="mt-2 mx-1 rounded-2xl p-4"
                style={{ background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.3)" }}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              >
                <div className="flex items-start gap-3">
                  <span className="text-xl">{aiResult.emoji}</span>
                  <div className="flex-1">
                    <p className="text-white text-sm leading-relaxed">{aiResult.message}</p>
                    {aiResult.action !== "none" && (
                      <motion.button
                        data-testid="hub-ai-action"
                        onClick={handleAction}
                        className="mt-2 flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl text-white"
                        style={{ background: "linear-gradient(135deg,#8b5cf6,#ec4899)" }}
                        whileTap={{ scale: 0.95 }}
                      >
                        {aiResult.action === "external"
                          ? <><ExternalLink className="w-3 h-3" /> Apri</>
                          : <><ArrowRight className="w-3 h-3" /> Vai</>
                        }
                      </motion.button>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Active Features Grid */}
        <motion.p
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}
          className="text-white/40 text-xs font-semibold uppercase tracking-widest mb-3 mt-5"
        >
          {t("hub.features")}
        </motion.p>

        <div className="grid grid-cols-2 gap-3">
          {CARDS.map((card, i) => (
            <motion.button
              key={card.key}
              data-testid={`hub-card-${card.key}`}
              onClick={() => setLocation(card.route)}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.05 }}
              whileTap={{ scale: 0.96 }}
              className="relative rounded-2xl p-4 text-left overflow-hidden"
              style={{
                background: `linear-gradient(135deg, ${card.color[0]}22, ${card.color[1]}18)`,
                border: `1px solid ${card.color[0]}40`,
              }}
            >
              {/* Glow dot */}
              <div
                className="absolute top-0 right-0 w-16 h-16 rounded-full opacity-20 -translate-y-4 translate-x-4"
                style={{ background: `radial-gradient(circle, ${card.color[0]}, transparent)` }}
              />
              <span className="text-2xl block mb-2">{card.emoji}</span>
              <p className="text-white font-bold text-sm leading-tight" style={{ fontFamily: "Space Grotesk, sans-serif" }}>
                {t(`hub.card.${card.key}`)}
              </p>
            </motion.button>
          ))}
        </div>

        <div className="pb-2" />
      </div>
    </div>
  );
}

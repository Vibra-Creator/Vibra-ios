import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, X, Send, ExternalLink, ArrowRight, Loader2, Mic, MicOff } from "lucide-react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

const SUGGESTIONS = [
  "Taxi per l'aeroporto",
  "Voglio conoscere gente",
  "Vendo iPhone usato",
  "Cerco coinquilino",
  "Ho fame",
  "Cerco lavoro",
  "Stanze e chat",
  "Orari treni",
];

interface AIResult {
  action: "navigate" | "external" | "none";
  route: string | null;
  external_url: string | null;
  message: string;
  emoji: string;
}

type VoiceState = "idle" | "listening" | "processing" | "unsupported";

declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}

function useVoiceInput(onResult: (text: string) => void) {
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [interim, setInterim] = useState("");
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const supported = typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  const start = useCallback(() => {
    if (!supported) { setVoiceState("unsupported"); return; }

    try {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      const rec = new SR();
      rec.lang = "it-IT";
      rec.continuous = false;
      rec.interimResults = true;
      rec.maxAlternatives = 3;

      rec.onstart = () => { setVoiceState("listening"); setInterim(""); };

      rec.onresult = (e: SpeechRecognitionEvent) => {
        let interim = "";
        let final = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const t = e.results[i][0].transcript;
          if (e.results[i].isFinal) final += t;
          else interim += t;
        }
        setInterim(interim || final);
         if (final) {
          setVoiceState("processing");
          setInterim("");
          onResult(final.trim());
        }
      };

      rec.onerror = () => { setVoiceState("idle"); setInterim(""); };
      rec.onend = () => { setVoiceState(v => v === "listening" ? "idle" : v); };

      recognitionRef.current = rec;
      rec.start();
    } catch {
      recognitionRef.current = null;
      setVoiceState("unsupported");
      setInterim("");
    }
  }, [supported, onResult]);

  const stop = useCallback(() => {
    try {
      recognitionRef.current?.stop();
    } catch {}
    setVoiceState("idle");
    setInterim("");
  }, []);

  return { voiceState, interim, start, stop, supported };
}

export function VibraAI() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<AIResult | null>(null);
  const [, setLocation] = useLocation();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 300);
    if (!open) { setQuery(""); setResult(null); }
  }, [open]);

  const search = useMutation({
    mutationFn: async (q: string) => {
      const res = await apiRequest("POST", "/api/ai-search", { query: q });
      return res.json() as Promise<AIResult>;
    },
    onSuccess: (data) => setResult(data),
    onError: () => setResult({
      action: "none",
      route: null,
      external_url: null,
      message: "La ricerca non è riuscita. Prova con una parola chiave come chat, musica o profili",
      emoji: "⚠️",
    }),
  });

  const handleSubmit = useCallback((q?: string) => {
    const text = (q ?? query).trim();
    if (!text) return;
    setQuery(text);
    setResult(null);
    search.mutate(text);
  }, [query, search]);

  const { voiceState, interim, start, stop, supported } = useVoiceInput(handleSubmit);

  const handleMic = () => {
    if (voiceState === "listening") stop();
    else start();
  };

  const handleAction = () => {
    if (!result) return;
    if (result.action === "navigate" && result.route) {
      setOpen(false);
      setLocation(result.route);
    } else if (result.action === "external" && result.external_url) {
      window.open(result.external_url, "_blank");
    }
  };

  const isListening = voiceState === "listening";
  const isBusy = search.isPending || voiceState === "processing";
  const displayText = isListening ? interim : query;

  return (
    <>
      {/* Modal */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { stop(); setOpen(false); }}
            />

            <motion.div
              className="fixed inset-x-4 bottom-24 z-50 rounded-3xl overflow-hidden"
              style={{ background: "linear-gradient(135deg, #0f0a1e, #1a0a2e)" }}
              initial={{ opacity: 0, y: 40, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 40, scale: 0.95 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 pt-5 pb-3">
                <div className="flex items-center gap-3">
                  <motion.div
                    className="w-10 h-10 rounded-2xl flex items-center justify-center"
                    style={{ background: "linear-gradient(135deg, #8b5cf6, #ec4899)" }}
                    animate={isListening ? { scale: [1, 1.12, 1] } : {}}
                    transition={{ duration: 0.8, repeat: Infinity }}
                  >
                    {isListening
                      ? <Mic className="w-5 h-5 text-white" />
                      : <Sparkles className="w-5 h-5 text-white" />
                    }
                  </motion.div>
                  <div>
                    <p className="text-white font-bold text-base" style={{ fontFamily: "Space Grotesk, sans-serif" }}>
                      Vibra AI
                    </p>
                    <p className="text-purple-300 text-xs">
                      {isListening ? "Ti sto ascoltando…" : "Di cosa hai bisogno?"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => { stop(); setOpen(false); }}
                  className="w-8 h-8 rounded-full flex items-center justify-center bg-white/10"
                >
                  <X className="w-4 h-4 text-white" />
                </button>
              </div>

              {/* Listening wave */}
              <AnimatePresence>
                {isListening && (
                  <motion.div
                    className="mx-4 mb-3 rounded-2xl px-4 py-3 flex items-center gap-3"
                    style={{ background: "rgba(236,72,153,0.12)", border: "1px solid rgba(236,72,153,0.3)" }}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                  >
                    <div className="flex items-end gap-[3px] h-5">
                      {[0.4, 0.8, 0.5, 1, 0.6, 0.9, 0.4].map((h, i) => (
                        <motion.div
                          key={i}
                          className="w-1 rounded-full"
                          style={{ background: "#ec4899" }}
                          animate={{ scaleY: [h, 1, h * 0.5, 1, h] }}
                          transition={{ duration: 0.6 + i * 0.07, repeat: Infinity, ease: "easeInOut" }}
                        />
                      ))}
                    </div>
                    <p className="text-pink-300 text-sm flex-1 truncate">
                      {interim || "Parla ora…"}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Input row */}
              <div className="px-4 pb-3">
                <div className="flex items-center gap-2 bg-white/10 rounded-2xl px-4 py-3 border border-white/10">
                  <input
                    ref={inputRef}
                    data-testid="vibra-ai-input"
                    value={isListening ? interim : query}
                    onChange={e => { if (!isListening) { setQuery(e.target.value); setResult(null); } }}
                    onKeyDown={e => e.key === "Enter" && !isListening && handleSubmit()}
                    placeholder={isListening ? "Parla ora…" : "Scrivi o parla…"}
                    readOnly={isListening}
                    className="flex-1 bg-transparent text-white placeholder-white/40 text-sm outline-none"
                    style={{ fontFamily: "Space Grotesk, sans-serif" }}
                  />

                  {/* Mic button */}
                  {supported && (
                    <motion.button
                      data-testid="vibra-ai-mic"
                      onClick={handleMic}
                      disabled={isBusy && !isListening}
                      className="w-8 h-8 rounded-xl flex items-center justify-center disabled:opacity-40"
                      style={{
                        background: isListening
                          ? "linear-gradient(135deg, #ec4899, #f43f5e)"
                          : "rgba(255,255,255,0.12)",
                      }}
                      animate={isListening ? { scale: [1, 1.08, 1] } : {}}
                      transition={{ duration: 0.7, repeat: Infinity }}
                      whileTap={{ scale: 0.9 }}
                    >
                      {isListening
                        ? <MicOff className="w-4 h-4 text-white" />
                        : <Mic className="w-4 h-4 text-white/70" />
                      }
                    </motion.button>
                  )}

                  {/* Send button */}
                  <motion.button
                    data-testid="vibra-ai-send"
                    onClick={() => handleSubmit()}
                    disabled={!displayText?.trim() || isBusy || isListening}
                    className="w-8 h-8 rounded-xl flex items-center justify-center disabled:opacity-40"
                    style={{ background: "linear-gradient(135deg, #8b5cf6, #ec4899)" }}
                    whileTap={{ scale: 0.9 }}
                  >
                    {isBusy
                      ? <Loader2 className="w-4 h-4 text-white animate-spin" />
                      : <Send className="w-4 h-4 text-white" />
                    }
                  </motion.button>
                </div>

                {/* Mic hint */}
                {supported && !isListening && !result && !query && (
                  <p className="text-center text-white/25 text-xs mt-2">
                    🎙 Tocca il microfono e parla — basta una parola chiave
                  </p>
                )}
                {!supported && (
                  <p className="text-center text-orange-400/60 text-xs mt-2">
                    Il tuo browser non supporta i comandi vocali
                  </p>
                )}
              </div>

              {/* Result */}
              <AnimatePresence>
                {result && (
                  <motion.div
                    className="mx-4 mb-4 rounded-2xl p-4"
                    style={{ background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.3)" }}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">{result.emoji}</span>
                      <div className="flex-1">
                        <p className="text-white text-sm leading-relaxed">{result.message}</p>
                        {result.action !== "none" && (
                          <motion.button
                            data-testid="vibra-ai-action"
                            onClick={handleAction}
                            className="mt-3 flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-xl text-white"
                            style={{ background: "linear-gradient(135deg, #8b5cf6, #ec4899)" }}
                            whileTap={{ scale: 0.95 }}
                          >
                            {result.action === "external"
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

              {/* Suggestions */}
              {!result && !isBusy && !isListening && (
                <div className="px-4 pb-5">
                  <p className="text-white/30 text-xs mb-2 px-1">Prova a dire o scrivere…</p>
                  <div className="flex flex-wrap gap-2">
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        data-testid={`vibra-ai-suggestion-${s.replace(/\s+/g, "-").slice(0, 15)}`}
                        onClick={() => handleSubmit(s)}
                        className="text-xs px-3 py-1.5 rounded-full text-purple-300 border border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 transition-colors"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

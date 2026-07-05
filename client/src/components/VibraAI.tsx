import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, X, Send, ExternalLink, ArrowRight, Loader2 } from "lucide-react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

const SUGGESTIONS = [
  "Cerco qualcuno con cui uscire stasera",
  "Ho bisogno di un taxi",
  "Voglio vendere il mio iPhone",
  "Cerco un coinquilino a Milano",
  "Voglio conoscere gente nuova",
  "Ho fame, cerco un ristorante",
  "Cerco lavoro come grafico",
  "Voglio sfogarmi con qualcuno",
];

interface AIResult {
  action: "navigate" | "external" | "none";
  route: string | null;
  external_url: string | null;
  message: string;
  emoji: string;
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
  });

  const handleSubmit = (q?: string) => {
    const text = q ?? query;
    if (!text.trim()) return;
    setQuery(text);
    setResult(null);
    search.mutate(text);
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

  return (
    <>
      {/* Floating button */}
      <motion.button
        data-testid="vibra-ai-button"
        onClick={() => setOpen(true)}
        className="fixed bottom-24 right-4 z-50 w-14 h-14 rounded-full flex items-center justify-center shadow-2xl"
        style={{
          background: "linear-gradient(135deg, #8b5cf6, #ec4899, #06b6d4)",
        }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        animate={{
          boxShadow: [
            "0 0 20px rgba(139,92,246,0.5)",
            "0 0 35px rgba(236,72,153,0.6)",
            "0 0 20px rgba(6,182,212,0.5)",
            "0 0 20px rgba(139,92,246,0.5)",
          ],
        }}
        transition={{ duration: 3, repeat: Infinity }}
      >
        <Sparkles className="w-6 h-6 text-white" />
      </motion.button>

      {/* Modal */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
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
                  <div
                    className="w-10 h-10 rounded-2xl flex items-center justify-center"
                    style={{ background: "linear-gradient(135deg, #8b5cf6, #ec4899)" }}
                  >
                    <Sparkles className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-white font-bold text-base" style={{ fontFamily: "Space Grotesk, sans-serif" }}>
                      Vibra AI
                    </p>
                    <p className="text-purple-300 text-xs">Di cosa hai bisogno?</p>
                  </div>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="w-8 h-8 rounded-full flex items-center justify-center bg-white/10"
                >
                  <X className="w-4 h-4 text-white" />
                </button>
              </div>

              {/* Input */}
              <div className="px-4 pb-3">
                <div className="flex items-center gap-2 bg-white/10 rounded-2xl px-4 py-3 border border-white/10">
                  <input
                    ref={inputRef}
                    data-testid="vibra-ai-input"
                    value={query}
                    onChange={e => { setQuery(e.target.value); setResult(null); }}
                    onKeyDown={e => e.key === "Enter" && handleSubmit()}
                    placeholder="Scrivi cosa ti serve..."
                    className="flex-1 bg-transparent text-white placeholder-white/40 text-sm outline-none"
                    style={{ fontFamily: "Space Grotesk, sans-serif" }}
                  />
                  <motion.button
                    data-testid="vibra-ai-send"
                    onClick={() => handleSubmit()}
                    disabled={!query.trim() || search.isPending}
                    className="w-8 h-8 rounded-xl flex items-center justify-center disabled:opacity-40"
                    style={{ background: "linear-gradient(135deg, #8b5cf6, #ec4899)" }}
                    whileTap={{ scale: 0.9 }}
                  >
                    {search.isPending
                      ? <Loader2 className="w-4 h-4 text-white animate-spin" />
                      : <Send className="w-4 h-4 text-white" />
                    }
                  </motion.button>
                </div>
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
              {!result && !search.isPending && (
                <div className="px-4 pb-5">
                  <p className="text-white/30 text-xs mb-2 px-1">Prova a chiedere...</p>
                  <div className="flex flex-wrap gap-2">
                    {SUGGESTIONS.slice(0, 4).map((s) => (
                      <button
                        key={s}
                        data-testid={`vibra-ai-suggestion-${s.slice(0, 10)}`}
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

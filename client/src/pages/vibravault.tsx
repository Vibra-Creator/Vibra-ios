import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { ArrowLeft, Lock, Plus, Flame, Clock, X, Image, Send, Trash2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import type { VaultConfession } from "@shared/schema";

function formatCountdown(expiresAt: string | Date): { label: string; urgent: boolean; critical: boolean } {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return { label: "Scaduta", urgent: true, critical: true };
  const hours = ms / 3_600_000;
  if (hours < 1) {
    const mins = Math.floor(ms / 60_000);
    return { label: `${mins}m`, urgent: true, critical: true };
  }
  if (hours < 24) return { label: `${Math.floor(hours)}h`, urgent: true, critical: false };
  const days = Math.floor(ms / 86_400_000);
  return { label: `${days}g`, urgent: false, critical: false };
}

function ConfessionCard({ c, onDelete }: { c: VaultConfession; onDelete: (id: string) => void }) {
  const isDeleted = !!c.deletedAt;
  const { label, urgent, critical } = formatCountdown(c.expiresAt);
  let legacy: { emotion?: string; emoji?: string; essence?: string } = {};
  if (c.sentimentLegacy) {
    try { legacy = JSON.parse(c.sentimentLegacy); } catch {}
  }

  if (isDeleted) {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="rounded-2xl border border-white/5 bg-white/3 p-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-900/10 to-pink-900/10" />
        <div className="relative z-10 text-center py-2">
          <p className="text-white/30 text-xs uppercase tracking-widest mb-3">✦ Sentimento Rimasto ✦</p>
          {legacy.emoji ? (
            <div>
              <div className="text-5xl mb-2">{legacy.emoji}</div>
              <p className="text-violet-300 font-semibold capitalize">{legacy.emotion}</p>
              {legacy.essence && <p className="text-white/50 text-sm italic mt-1">"{legacy.essence}"</p>}
            </div>
          ) : (
            <p className="text-white/20 text-sm">Il messaggio si è dissolto nel cosmo</p>
          )}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl border p-4 relative overflow-hidden ${
        critical ? "border-red-500/30 bg-red-500/5" : urgent ? "border-amber-500/20 bg-amber-500/5" : "border-white/10 bg-white/5"
      }`}>
      {critical && (
        <motion.div className="absolute inset-0 rounded-2xl border-2 border-red-500/20"
          animate={{ opacity: [0.2, 0.8, 0.2] }} transition={{ repeat: Infinity, duration: 1.5 }} />
      )}
      <div className="relative z-10">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
            critical ? "bg-red-500/20 text-red-400" : urgent ? "bg-amber-500/20 text-amber-400" : "bg-green-500/20 text-green-400"
          }`}>
            {critical ? <Flame className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
            {label}
          </div>
          <Button size="icon" variant="ghost" className="h-7 w-7 text-white/30 hover:text-red-400 shrink-0"
            onClick={() => onDelete(c.id)} data-testid={`button-delete-confession-${c.id}`}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
        <p className="text-white/80 text-sm leading-relaxed mb-3">{c.content}</p>
        {c.mediaUrl && <img src={c.mediaUrl} alt="" className="rounded-xl max-h-48 object-cover w-full" />}
      </div>
    </motion.div>
  );
}

export default function VibraVault() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [content, setContent] = useState("");
  const [ttlDays, setTtlDays] = useState(3);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: confessions, isLoading } = useQuery<VaultConfession[]>({
    queryKey: ["/api/vault"],
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const form = new FormData();
      form.append("content", content);
      form.append("ttlDays", String(ttlDays));
      if (mediaFile) form.append("media", mediaFile);
      const res = await fetch("/api/vault", { method: "POST", body: form, credentials: "include" });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: () => {
      setContent(""); setMediaFile(null); setMediaPreview(null); setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ["/api/vault"] });
      toast({ title: "Confessione salvata nel Vault 🔒", description: `Si autodistruggerà tra ${ttlDays} giorn${ttlDays === 1 ? "o" : "i"}.` });
    },
    onError: (e: any) => toast({ title: "Errore", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/vault/${id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Errore");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vault"] });
      toast({ title: "Confessione eliminata" });
    },
  });

  const active = confessions?.filter(c => !c.deletedAt) ?? [];
  const dissolved = confessions?.filter(c => !!c.deletedAt) ?? [];

  return (
    <div className="flex-1 overflow-y-auto relative z-10">
      <div className="fixed inset-0 z-0 bg-gradient-to-b from-[#0a0118] via-[#0d0120] to-[#0a0118]" />

      {/* Floating particles */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        {[...Array(6)].map((_, i) => (
          <motion.div key={i}
            className="absolute w-1 h-1 rounded-full bg-violet-400/30"
            style={{ left: `${15 + i * 15}%`, top: `${20 + (i % 3) * 25}%` }}
            animate={{ y: [-10, 10, -10], opacity: [0.2, 0.5, 0.2] }}
            transition={{ duration: 3 + i, repeat: Infinity, delay: i * 0.5 }} />
        ))}
      </div>

      <div className="relative z-10 p-4 pb-32">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" className="text-white bg-black/30 backdrop-blur-sm" onClick={() => setLocation("/profile")} data-testid="button-back-vault">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-600 to-red-500 flex items-center justify-center">
            <Lock className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">VibraVault</h1>
            <p className="text-sm text-white/50">Confessioni con autodistruzione</p>
          </div>
        </motion.div>

        {/* Info box */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
          className="rounded-xl bg-violet-500/10 border border-violet-500/20 p-4 mb-6">
          <p className="text-white/60 text-sm leading-relaxed">
            🔒 Le tue confessioni sono <span className="text-violet-300">private</span>. Nessuno le vede — tranne te.
            Dopo la scadenza si autodistruggono, ma lasciano un <span className="text-pink-300">sentimento emotivo</span> generato dall'AI.
          </p>
        </motion.div>

        {/* Active confessions */}
        {isLoading ? (
          <div className="space-y-4">{[1, 2].map(i => <Skeleton key={i} className="h-32 rounded-2xl" />)}</div>
        ) : active.length > 0 ? (
          <div className="space-y-3 mb-6">
            <h2 className="text-white/60 text-xs uppercase tracking-widest mb-2">In scadenza</h2>
            {active.map(c => (
              <ConfessionCard key={c.id} c={c} onDelete={id => deleteMutation.mutate(id)} />
            ))}
          </div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-10 mb-6">
            <div className="w-16 h-16 rounded-full bg-violet-500/10 flex items-center justify-center mx-auto mb-3">
              <Lock className="w-8 h-8 text-violet-400/50" />
            </div>
            <p className="text-white/30 text-sm">Il tuo vault è vuoto</p>
          </motion.div>
        )}

        {/* Dissolved confessions (legacies) */}
        {dissolved.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-white/30 text-xs uppercase tracking-widest mb-2 flex items-center gap-2">
              <Sparkles className="w-3 h-3" /> Sentimenti rimasti
            </h2>
            {dissolved.map(c => (
              <ConfessionCard key={c.id} c={c} onDelete={() => {}} />
            ))}
          </div>
        )}
      </div>

      {/* Floating CTA */}
      <div className="fixed bottom-20 left-0 right-0 px-4 z-30">
        <AnimatePresence>
          {showForm ? (
            <motion.div key="form" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
              className="bg-[#120225] border border-violet-500/30 rounded-2xl p-4 shadow-2xl">
              <div className="flex items-center justify-between mb-3">
                <span className="text-white/80 text-sm font-semibold">🔒 Nuova confessione</span>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-white/50" onClick={() => setShowForm(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>

              <Textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                placeholder="Cosa vuoi confessare al cosmo?"
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30 resize-none mb-3"
                rows={4}
                data-testid="input-confession-content"
              />

              {/* TTL selector */}
              <div className="flex gap-2 mb-3">
                <span className="text-white/40 text-xs self-center mr-1">Scade in:</span>
                {[1, 3, 7].map(d => (
                  <button key={d}
                    className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${ttlDays === d ? "bg-violet-600 text-white" : "bg-white/10 text-white/50 hover:bg-white/15"}`}
                    onClick={() => setTtlDays(d)}
                    data-testid={`button-ttl-${d}`}>
                    {d === 1 ? "1 giorno" : `${d} giorni`}
                  </button>
                ))}
              </div>

              {mediaPreview && (
                <div className="relative mb-3">
                  <img src={mediaPreview} alt="" className="rounded-xl max-h-32 object-cover w-full" />
                  <Button size="icon" variant="ghost" className="absolute top-1 right-1 bg-black/60 h-6 w-6"
                    onClick={() => { setMediaFile(null); setMediaPreview(null); }}>
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              )}
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => {
                const f = e.target.files?.[0];
                if (f) { setMediaFile(f); setMediaPreview(URL.createObjectURL(f)); }
              }} />

              <div className="flex gap-2">
                <Button size="icon" variant="outline" className="border-white/10 text-white/50 h-10 w-10 shrink-0"
                  onClick={() => fileRef.current?.click()}>
                  <Image className="w-4 h-4" />
                </Button>
                <Button className="flex-1 bg-violet-600 hover:bg-violet-700 gap-2"
                  onClick={() => createMutation.mutate()}
                  disabled={!content.trim() || createMutation.isPending}
                  data-testid="button-submit-confession">
                  {createMutation.isPending ? "Salvataggio..." : <><Lock className="w-4 h-4" /> Sigilla nel Vault</>}
                </Button>
              </div>
            </motion.div>
          ) : (
            <motion.div key="btn" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Button className="w-full bg-gradient-to-r from-violet-600 to-red-600 hover:from-violet-700 hover:to-red-700 h-12 rounded-2xl gap-2 shadow-lg"
                onClick={() => setShowForm(true)}
                data-testid="button-new-confession">
                <Plus className="w-5 h-5" /> Nuova confessione segreta
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

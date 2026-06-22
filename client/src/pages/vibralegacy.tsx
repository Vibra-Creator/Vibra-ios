import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { ArrowLeft, BookMarked, Trash2, Clock, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { VibraLegacy } from "@shared/schema";

const REVEAL_OPTIONS = [
  { label: "7 giorni", value: "7" },
  { label: "14 giorni", value: "14" },
  { label: "30 giorni", value: "30" },
  { label: "60 giorni", value: "60" },
  { label: "90 giorni", value: "90" },
];

export default function VibraLegacyPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [message, setMessage] = useState("");
  const [revealAfterDays, setRevealAfterDays] = useState("30");
  const [isEditing, setIsEditing] = useState(false);

  const { data: legacy, isLoading } = useQuery<VibraLegacy | null>({
    queryKey: ["/api/legacy"],
  });

  const saveMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/legacy", { message, revealAfterDays: parseInt(revealAfterDays) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/legacy"] });
      setIsEditing(false);
      toast({ title: "📜 Messaggio cosmico salvato", description: "Il tuo legacy è al sicuro tra le stelle." });
    },
    onError: () => toast({ title: "Errore nel salvataggio", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", "/api/legacy", {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/legacy"] });
      setMessage("");
      toast({ title: "Legacy eliminato" });
    },
    onError: () => toast({ title: "Errore nell'eliminazione", variant: "destructive" }),
  });

  const handleEdit = () => {
    if (legacy) {
      setMessage(legacy.message);
      setRevealAfterDays(String(legacy.revealAfterDays));
    }
    setIsEditing(true);
  };

  const revealDate = legacy
    ? new Date(new Date(legacy.createdAt).getTime() + legacy.revealAfterDays * 86_400_000)
    : null;

  return (
    <div className="flex-1 overflow-y-auto relative z-10">
      <div className="fixed inset-0 z-0 bg-gradient-to-b from-[#0a0118] via-[#0c0820] to-[#0a0118]" />

      {/* Floating particles */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        {[...Array(12)].map((_, i) => (
          <motion.div key={i}
            className="absolute rounded-full bg-purple-400/20"
            style={{ width: Math.random() * 4 + 1, height: Math.random() * 4 + 1, left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%` }}
            animate={{ y: [-10, 10, -10], opacity: [0.2, 0.6, 0.2] }}
            transition={{ duration: 3 + Math.random() * 4, repeat: Infinity, delay: Math.random() * 2 }} />
        ))}
      </div>

      <div className="relative z-10 p-4 pb-8 max-w-lg mx-auto">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" className="text-white bg-black/30 backdrop-blur-sm" onClick={() => setLocation("/profile")} data-testid="button-back-legacy">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center">
            <BookMarked className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">VibraLegacy</h1>
            <p className="text-xs text-white/50">Il tuo messaggio nell'universo</p>
          </div>
        </motion.div>

        {/* Intro card */}
        <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }}
          className="rounded-2xl bg-gradient-to-br from-violet-500/15 to-purple-500/10 border border-violet-500/25 p-5 mb-6">
          <div className="flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-violet-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-white/80 text-sm font-medium mb-1">Cos'è VibraLegacy?</p>
              <p className="text-white/50 text-sm leading-relaxed">
                Scrivi un messaggio che rimarrà segreto per un periodo da te scelto. Potranno leggerlo solo i tuoi match speciali, al momento giusto, come una lettera dal passato cosmico.
              </p>
            </div>
          </div>
        </motion.div>

        {isLoading ? (
          <Skeleton className="h-48 rounded-2xl" />
        ) : legacy && !isEditing ? (
          /* Existing legacy card */
          <motion.div key="existing" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="rounded-2xl bg-white/5 border border-white/10 p-5 mb-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-white/70 font-semibold text-sm">Il tuo messaggio</span>
              {revealDate && (
                <Badge className="bg-violet-500/20 text-violet-300 border-violet-500/30 gap-1 text-xs">
                  <Clock className="w-3 h-3" />
                  Rivela il {revealDate.toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" })}
                </Badge>
              )}
            </div>
            <div className="rounded-xl bg-white/5 p-4 mb-4">
              <p className="text-white/80 text-sm leading-relaxed italic">"{legacy.message}"</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 border-violet-500/30 text-violet-300 hover:bg-violet-500/10"
                onClick={handleEdit} data-testid="button-edit-legacy">
                Modifica
              </Button>
              <Button variant="outline" className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
                data-testid="button-delete-legacy">
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </motion.div>
        ) : (
          /* Write / edit form */
          <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="rounded-2xl bg-white/5 border border-white/10 p-5 mb-4">
            <p className="text-white/70 font-semibold text-sm mb-3">
              {legacy ? "Modifica il tuo messaggio" : "Scrivi il tuo messaggio"}
            </p>
            <Textarea
              placeholder="Caro futuro lettore, voglio che tu sappia che…"
              value={message}
              onChange={e => setMessage(e.target.value)}
              className="min-h-32 bg-white/5 border-white/15 text-white placeholder:text-white/30 resize-none mb-4 text-sm"
              maxLength={1000}
              data-testid="textarea-legacy-message"
            />
            <div className="flex items-center gap-2 text-white/40 text-xs mb-4">
              <span>{message.length}/1000 caratteri</span>
            </div>

            <div className="mb-4">
              <p className="text-white/60 text-xs mb-2">Rivela dopo</p>
              <Select value={revealAfterDays} onValueChange={setRevealAfterDays}>
                <SelectTrigger className="bg-white/5 border-white/15 text-white" data-testid="select-reveal-days">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#1a0a30] border-white/10">
                  {REVEAL_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2">
              {legacy && (
                <Button variant="outline" className="border-white/10 text-white/50" onClick={() => setIsEditing(false)}>
                  Annulla
                </Button>
              )}
              <Button
                className="flex-1 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white font-semibold gap-2"
                onClick={() => saveMutation.mutate()}
                disabled={!message.trim() || saveMutation.isPending}
                data-testid="button-save-legacy"
              >
                <Send className="w-4 h-4" />
                {saveMutation.isPending ? "Invio…" : "Sigilla nell'universo"}
              </Button>
            </div>
          </motion.div>
        )}

        <p className="text-center text-white/25 text-xs px-4">
          Il tuo messaggio è privato e crittografato. Solo tu decidi quando diventa visibile.
        </p>
      </div>
    </div>
  );
}

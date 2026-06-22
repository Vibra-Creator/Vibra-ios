import { useQuery, useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { ArrowLeft, Zap, CheckCircle, Star, Swords, MessageCircle, Users, Radio, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { UserQuest } from "@shared/schema";

const QUEST_META: Record<string, { icon: any; color: string; bg: string }> = {
  swipe_10:    { icon: Swords,         color: "text-red-400",    bg: "bg-red-500/15 border-red-500/20" },
  message_5:   { icon: MessageCircle,  color: "text-blue-400",   bg: "bg-blue-500/15 border-blue-500/20" },
  room_visit:  { icon: Users,          color: "text-green-400",  bg: "bg-green-500/15 border-green-500/20" },
  signal_post: { icon: Radio,          color: "text-cyan-400",   bg: "bg-cyan-500/15 border-cyan-500/20" },
  gift_send:   { icon: Gift,           color: "text-pink-400",   bg: "bg-pink-500/15 border-pink-500/20" },
};

const QUEST_TITLES: Record<string, { title: string; desc: string }> = {
  swipe_10:    { title: "Gravitazione Cosmica",  desc: "Esplora 10 profili" },
  message_5:   { title: "Connessioni Stellari",  desc: "Invia 5 messaggi" },
  room_visit:  { title: "Esplora il Cosmo",      desc: "Visita una stanza" },
  signal_post: { title: "Segnale Cosmico",        desc: "Pubblica un Cosmic Signal" },
  gift_send:   { title: "Regalo Alieno",          desc: "Invia un regalo virtuale" },
};

export default function VibraQuests() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: quests, isLoading } = useQuery<UserQuest[]>({ queryKey: ["/api/quests"] });

  const claimMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/quests/${id}/claim`, {}),
    onSuccess: async (data: any) => {
      await queryClient.invalidateQueries({ queryKey: ["/api/quests"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/profiles/me"] });
      toast({
        title: `+${data.points} punti cosmici! ⭐`,
        description: "Ricompensa riscossa con successo.",
      });
    },
    onError: () => toast({ title: "Errore nel riscuotere la ricompensa", variant: "destructive" }),
  });

  const today = new Date().toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" });
  const totalPoints = quests?.reduce((sum, q) => sum + (q.claimed ? q.pointsReward : 0), 0) ?? 0;
  const completedCount = quests?.filter(q => q.completed).length ?? 0;
  const claimedCount = quests?.filter(q => q.claimed).length ?? 0;
  const allClaimed = quests?.length ? claimedCount === quests.length : false;

  return (
    <div className="flex-1 overflow-y-auto relative z-10">
      <div className="fixed inset-0 z-0 bg-gradient-to-b from-[#0a0118] via-[#100820] to-[#0a0118]" />

      <div className="relative z-10 p-4 pb-8">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" className="text-white bg-black/30 backdrop-blur-sm" onClick={() => setLocation("/profile")} data-testid="button-back-quests">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">VibraQuest</h1>
            <p className="text-xs text-white/50 capitalize">{today}</p>
          </div>
        </motion.div>

        {/* Daily progress card */}
        <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }}
          className="rounded-2xl bg-gradient-to-br from-amber-500/15 to-orange-500/10 border border-amber-500/25 p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-white/80 font-semibold">Progresso giornaliero</span>
            <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 gap-1">
              <Star className="w-3 h-3" /> {totalPoints} punti
            </Badge>
          </div>
          <Progress value={(claimedCount / (quests?.length || 5)) * 100} className="h-2 mb-2" />
          <p className="text-white/40 text-sm">{claimedCount}/{quests?.length ?? 5} missioni completate</p>
          {allClaimed && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="text-amber-400 text-sm font-semibold mt-2">
              🏆 Hai completato tutte le missioni di oggi!
            </motion.p>
          )}
        </motion.div>

        {/* Quest list */}
        {isLoading ? (
          <div className="space-y-3">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-24 rounded-2xl" />)}</div>
        ) : (
          <div className="space-y-3">
            {quests?.map((q, i) => {
              const meta = QUEST_META[q.questType] ?? { icon: Zap, color: "text-amber-400", bg: "bg-amber-500/15 border-amber-500/20" };
              const titles = QUEST_TITLES[q.questType] ?? { title: q.questType, desc: "" };
              const Icon = meta.icon;
              const pct = Math.min((q.progress / q.target) * 100, 100);

              return (
                <motion.div key={q.id} initial={{ opacity: 0, x: -15 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.07 }}
                  className={`rounded-2xl border p-4 ${q.claimed ? "opacity-50" : ""} ${meta.bg}`}
                  data-testid={`card-quest-${q.questType}`}>
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-xl bg-black/30 flex items-center justify-center flex-shrink-0 ${meta.color}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <span className="text-white font-semibold text-sm truncate">{titles.title}</span>
                        <Badge className={`text-xs shrink-0 ${q.claimed ? "bg-green-500/20 text-green-400" : q.completed ? "bg-amber-500/20 text-amber-300" : "bg-white/10 text-white/50"}`}>
                          {q.claimed ? "✅ Riscosso" : q.completed ? "✨ Completato" : `${q.progress}/${q.target}`}
                        </Badge>
                      </div>
                      <p className="text-white/50 text-xs mb-2">{titles.desc}</p>
                      <Progress value={pct} className="h-1.5" />
                    </div>
                  </div>
                  {q.completed && !q.claimed && (
                    <div className="mt-3 flex justify-end">
                      <Button size="sm" className="bg-amber-500 hover:bg-amber-600 text-black font-bold gap-1.5 h-8"
                        onClick={() => claimMutation.mutate(q.id)}
                        disabled={claimMutation.isPending}
                        data-testid={`button-claim-${q.id}`}>
                        <Star className="w-3.5 h-3.5" /> Riscuoti +{q.pointsReward}pts
                      </Button>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

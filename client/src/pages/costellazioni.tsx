import { useQuery, useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { ArrowLeft, Star, Users, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";

const CONSTELLATION_ICONS: Record<string, string> = {
  Esploratori: "🔴", Narratori: "💜", Pionieri: "🔵",
  Custodi: "🟢", Guerrieri: "🟡", Equilibrati: "🩵",
};

export default function Costellazioni() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data, isLoading, refetch } = useQuery<{
    constellation: { name: string; color: string; description: string; memberCount: number };
    members: Array<{ id: string; name: string; imageUrl: string | null; age: number | null }>;
  }>({ queryKey: ["/api/constellation"] });

  const reassignMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/constellation/reassign", {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/constellation"] });
      toast({ title: "Costellazione ricalcolata 🌟" });
    },
    onError: () => toast({ title: "Errore", variant: "destructive" }),
  });

  const constellation = data?.constellation;
  const members = data?.members ?? [];
  const icon = constellation ? (CONSTELLATION_ICONS[constellation.name] ?? "✨") : "✨";

  return (
    <div className="flex-1 overflow-y-auto relative z-10">
      <div className="fixed inset-0 z-0 bg-gradient-to-b from-[#0a0118] via-[#080320] to-[#0a0118]" />

      {/* Starfield */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <motion.div key={i}
            className="absolute rounded-full bg-white/20"
            style={{ width: Math.random() * 3 + 1, height: Math.random() * 3 + 1, left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%` }}
            animate={{ opacity: [0.1, 0.8, 0.1] }}
            transition={{ duration: 2 + Math.random() * 3, repeat: Infinity, delay: Math.random() * 2 }} />
        ))}
      </div>

      <div className="relative z-10 p-4 pb-8">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" className="text-white bg-black/30 backdrop-blur-sm" onClick={() => setLocation("/profile")} data-testid="button-back-constellation">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <Star className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Costellazioni</h1>
            <p className="text-sm text-white/50">Il tuo gruppo di affinità cosmico</p>
          </div>
        </motion.div>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-48 rounded-2xl" />
            <Skeleton className="h-32 rounded-2xl" />
          </div>
        ) : constellation ? (
          <>
            {/* Constellation card */}
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }}
              className="rounded-3xl overflow-hidden mb-6 relative"
              style={{ background: `linear-gradient(135deg, ${constellation.color}22, ${constellation.color}08)`, border: `1px solid ${constellation.color}33` }}>
              <div className="p-6 text-center">
                <motion.div className="text-7xl mb-4" animate={{ scale: [1, 1.08, 1] }} transition={{ duration: 3, repeat: Infinity }}>
                  {icon}
                </motion.div>
                <h2 className="text-3xl font-bold text-white mb-2">{constellation.name}</h2>
                <p className="text-white/60 text-sm mb-4">{constellation.description}</p>
                <div className="flex items-center justify-center gap-2">
                  <Users className="w-4 h-4 text-white/50" />
                  <span className="text-white/60 text-sm">{constellation.memberCount} membri</span>
                </div>
              </div>
            </motion.div>

            {/* Members */}
            {members.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                className="rounded-2xl bg-white/5 border border-white/10 p-4 mb-5">
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="w-4 h-4 text-white/50" />
                  <span className="text-white/70 text-sm font-semibold">Membri attivi</span>
                </div>
                <div className="flex flex-wrap gap-3">
                  {members.map((m, i) => (
                    <motion.div key={m.id} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.04 }}
                      className="flex flex-col items-center gap-1" data-testid={`member-${m.id}`}>
                      <Avatar className="w-12 h-12 border-2" style={{ borderColor: constellation.color + "44" }}>
                        <AvatarImage src={m.imageUrl ?? ""} />
                        <AvatarFallback style={{ background: constellation.color + "33" }} className="text-white text-sm font-bold">
                          {m.name[0]}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-white/60 text-xs truncate max-w-[52px]">{m.name.split(" ")[0]}</span>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Reassign */}
            <Button variant="outline" className="w-full border-white/10 text-white/50 gap-2"
              onClick={() => reassignMutation.mutate()}
              disabled={reassignMutation.isPending}
              data-testid="button-reassign-constellation">
              <RefreshCw className={`w-4 h-4 ${reassignMutation.isPending ? "animate-spin" : ""}`} />
              {reassignMutation.isPending ? "Ricalcolo..." : "Ricalcola in base al DNA"}
            </Button>
            <p className="text-center text-white/30 text-xs mt-2">Aggiorna dopo aver accumulato più attività</p>
          </>
        ) : (
          <div className="text-center py-16">
            <p className="text-white/40">Nessuna costellazione assegnata</p>
            <Button className="mt-4" onClick={() => refetch()}>Riprova</Button>
          </div>
        )}
      </div>
    </div>
  );
}

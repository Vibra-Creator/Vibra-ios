import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, Send, MessageCircle, Star, ArrowLeft, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Profile, ProfileRating } from "@shared/schema";

type RatingWithRater = ProfileRating & { rater: Profile };

export default function PrimaImpressione() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const { data: ratings, isLoading } = useQuery<RatingWithRater[]>({
    queryKey: ["/api/ratings/received"],
    enabled: !!user,
    refetchInterval: 10000,
  });

  const { data: myProfile } = useQuery<Profile | null>({
    queryKey: ["/api/profiles/me"],
    enabled: !!user,
  });

  const unreplied = ratings?.filter(r => !r.ratedReply) || [];
  const replied = ratings?.filter(r => !!r.ratedReply) || [];

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!myProfile) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="text-center">
          <Eye className="w-12 h-12 text-white/30 mx-auto mb-3" />
          <p className="text-white/60 text-sm">Crea il tuo profilo per iniziare</p>
          <Button className="mt-4" onClick={() => setLocation("/profile/edit")} data-testid="button-create-profile">
            Crea Profilo
          </Button>
        </div>
      </div>
    );
  }

  if (!myProfile.ratingEnabled) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="text-center max-w-xs">
          <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4">
            <Eye className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Prima Impressione</h2>
          <p className="text-white/60 text-sm mb-4">
            Attiva la funzione di valutazione nel tuo profilo per scoprire cosa pensano gli altri di te. Gli altri potranno darti un voto da 1 a 5 sulla tua card.
          </p>
          <Button onClick={() => setLocation("/profile")} data-testid="button-enable-rating">
            Vai al Profilo per Attivare
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center">
            <Eye className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white" data-testid="text-page-title">Prima Impressione</h1>
            <p className="text-white/50 text-xs">Scopri cosa pensano gli altri di te</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {(!ratings || ratings.length === 0) ? (
          <div className="flex-1 flex items-center justify-center py-16">
            <div className="text-center">
              <Sparkles className="w-12 h-12 text-white/20 mx-auto mb-3" />
              <p className="text-white/50 text-sm">Nessuna valutazione ricevuta ancora</p>
              <p className="text-white/30 text-xs mt-1">Continua a farti notare!</p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {unreplied.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-white/70 mb-3 flex items-center gap-2">
                  <MessageCircle className="w-4 h-4 text-primary" />
                  In attesa di risposta ({unreplied.length})
                </h2>
                <div className="space-y-3">
                  {unreplied.map((rating) => (
                    <RatingCard key={rating.id} rating={rating} myProfileId={myProfile.id} />
                  ))}
                </div>
              </div>
            )}

            {replied.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-white/70 mb-3 flex items-center gap-2">
                  <Star className="w-4 h-4 text-yellow-400" />
                  Risposte inviate ({replied.length})
                </h2>
                <div className="space-y-3">
                  {replied.map((rating) => (
                    <RatingCard key={rating.id} rating={rating} myProfileId={myProfile.id} isReplied />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function RatingCard({ rating, myProfileId, isReplied = false }: { rating: RatingWithRater; myProfileId: string; isReplied?: boolean }) {
  const [replyText, setReplyText] = useState("");
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const replyMutation = useMutation({
    mutationFn: async (reply: string) => {
      return apiRequest("POST", `/api/ratings/${rating.id}/reply`, { reply });
    },
    onSuccess: (data: any) => {
      toast({ title: "Risposta inviata!", description: `La chat con ${rating.rater.name} è ora aperta.` });
      queryClient.invalidateQueries({ queryKey: ["/api/ratings/received"] });
      queryClient.invalidateQueries({ queryKey: ["/api/matches", myProfileId] });
      if (data.match?.id) {
        setTimeout(() => setLocation(`/chat/${data.match.id}`), 1000);
      }
    },
    onError: () => {
      toast({ title: "Errore", description: "Non è stato possibile inviare la risposta.", variant: "destructive" });
    },
  });

  const handleReply = () => {
    if (replyText.trim()) {
      replyMutation.mutate(replyText.trim());
    }
  };

  const ratingLabels: Record<number, string> = { 1: "Preferisco non pronunciarmi", 2: "Non sei il mio tipo", 3: "Qualcosa in te mi attrae", 4: "Sei il mio tipo ideale", 5: "Sei fantastico/a!" };
  const ratingColor = rating.rating >= 4 ? "text-green-400" : rating.rating >= 3 ? "text-yellow-400" : "text-orange-400";
  const ratingBg = rating.rating >= 4 ? "bg-green-500/20 border-green-500/30" : rating.rating >= 3 ? "bg-yellow-500/20 border-yellow-500/30" : "bg-orange-500/20 border-orange-500/30";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl bg-white/5 backdrop-blur-sm border border-white/10 overflow-hidden"
      data-testid={`rating-card-${rating.id}`}
    >
      <div className="flex items-center gap-3 p-3">
        <Avatar className="w-12 h-12 border-2 border-white/20">
          <AvatarImage src={rating.rater.imageUrl} alt={rating.rater.name} />
          <AvatarFallback className="bg-primary/20 text-primary">{rating.rater.name[0]}</AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-white font-medium text-sm" data-testid={`rating-rater-name-${rating.id}`}>
              {rating.rater.name}
            </span>
            <span className="text-white/40 text-xs">{rating.rater.age} anni</span>
          </div>
          <p className="text-white/40 text-xs truncate">{rating.rater.location}</p>
        </div>

        <div className={`flex flex-col items-end gap-0.5 px-3 py-1.5 rounded-lg border ${ratingBg}`} data-testid={`rating-score-${rating.id}`}>
          <div className="flex items-center gap-1">
            <Star className={`w-4 h-4 ${ratingColor}`} />
            <span className={`text-lg font-bold ${ratingColor}`}>{rating.rating}</span>
            <span className="text-white/40 text-xs">/5</span>
          </div>
          <span className="text-white/50 text-[9px] leading-tight max-w-[120px] text-right">{ratingLabels[rating.rating] || ""}</span>
        </div>
      </div>

      {!isReplied && (
        <div className="px-3 pb-3">
          <div className="flex gap-2">
            <Input
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Rispondi con un messaggio..."
              className="flex-1 bg-white/10 border-white/20 text-white placeholder:text-white/40 text-sm"
              onKeyDown={(e) => { if (e.key === "Enter") handleReply(); }}
              disabled={replyMutation.isPending}
              data-testid={`input-reply-${rating.id}`}
            />
            <Button
              size="icon"
              onClick={handleReply}
              disabled={!replyText.trim() || replyMutation.isPending}
              data-testid={`button-reply-${rating.id}`}
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-white/30 text-[10px] mt-1.5">
            Dopo la tua risposta si aprirà la chat con {rating.rater.name}
          </p>
        </div>
      )}

      {isReplied && (
        <div className="px-3 pb-3">
          <div className="bg-primary/10 rounded-lg p-2 border border-primary/20">
            <p className="text-white/70 text-xs italic" data-testid={`text-reply-${rating.id}`}>
              "{rating.ratedReply}"
            </p>
          </div>
          {rating.matchCreated && (
            <Button
              variant="ghost"
              className="w-full mt-2 text-primary text-xs"
              onClick={() => setLocation("/matches")}
              data-testid={`button-go-chat-${rating.id}`}
            >
              <MessageCircle className="w-3 h-3 mr-1" />
              Vai alla chat
            </Button>
          )}
        </div>
      )}
    </motion.div>
  );
}

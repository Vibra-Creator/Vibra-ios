import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Eye, Send, MessageCircle, Star, Sparkles, Heart, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/use-auth";
import { useGuest } from "@/hooks/use-guest";
import { useGuestBlocker } from "@/components/GuestBlocker";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Link } from "wouter";
import type { Profile, ProfileRating, Match } from "@shared/schema";

type RatingWithRater = ProfileRating & { rater: Profile };

const ratingLabels: Record<number, string> = {
  1: "Preferisco non pronunciarmi",
  2: "Non sei il mio tipo",
  3: "Qualcosa in te mi attrae",
  4: "Sei il mio tipo ideale",
  5: "Sei fantastico/a!",
};

const ratingIcons: Record<number, typeof Star> = {
  1: Star,
  2: Star,
  3: Heart,
  4: Heart,
  5: Sparkles,
};

export default function PrimaImpressione() {
  const { user } = useAuth();
  const { isGuest } = useGuest();
  const { blockIfGuest, GuestBlockerModal } = useGuestBlocker();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const { data: ratings, isLoading } = useQuery<RatingWithRater[]>({
    queryKey: ["/api/ratings/received"],
    enabled: !!user && !isGuest,
    refetchInterval: 10000,
  });

  const { data: myProfile } = useQuery<Profile | null>({
    queryKey: ["/api/profiles/me"],
    enabled: !!user && !isGuest,
  });

  if (isGuest) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center">
              <Eye className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <h1 className="text-xl font-bold text-white" data-testid="text-page-title">Prima Impressione</h1>
              <p className="text-white/50 text-xs">Scopri cosa pensano gli altri di te</p>
            </div>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center max-w-xs">
            <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4">
              <Eye className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2" data-testid="text-guest-prima-title">Mettiti in Gioco!</h2>
            <p className="text-white/60 text-sm mb-2" data-testid="text-guest-prima-description">
              Attiva Prima Impressione e scopri cosa pensano gli altri di te. Chi ti vota potrà anche scriverti un messaggio!
            </p>
            <p className="text-white/40 text-xs mb-4">
              Registrati per attivare questa funzione e iniziare a ricevere voti e messaggi.
            </p>
            <div className="flex flex-col gap-3">
              <Link href="/register">
                <Button className="w-full bg-gradient-to-r from-primary to-accent" data-testid="button-guest-register-prima"
                  onClick={() => blockIfGuest("votare i profili")}>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Registrati Gratis
                </Button>
              </Link>
            </div>
          </div>
        </div>
        <GuestBlockerModal />
      </div>
    );
  }

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
          <h2 className="text-xl font-bold text-white mb-2">Mettiti in Gioco!</h2>
          <p className="text-white/60 text-sm mb-2">
            Attiva Prima Impressione e scopri cosa pensano gli altri di te.
          </p>
          <p className="text-white/40 text-xs mb-4">
            Sulla tua card apparirà il pulsante che permette agli altri di votarti da 1 a 5. Chi ti vota potrà anche scriverti un messaggio e aprire una conversazione con te!
          </p>
          <Button onClick={() => setLocation("/profile")} data-testid="button-enable-rating">
            Attiva dal Profilo
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center">
            <Eye className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-white" data-testid="text-page-title">Impressioni Ricevute</h1>
            <p className="text-white/50 text-xs">
              {ratings && ratings.length > 0
                ? `${ratings.length} ${ratings.length === 1 ? "impressione ricevuta" : "impressioni ricevute"}`
                : "Nessuna impressione ancora"}
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {(!ratings || ratings.length === 0) ? (
          <div className="flex-1 flex items-center justify-center py-16">
            <div className="text-center px-4">
              <Sparkles className="w-12 h-12 text-white/20 mx-auto mb-3" />
              <p className="text-white/50 text-sm">Nessuna impressione ricevuta ancora</p>
              <p className="text-white/30 text-xs mt-1">Quando qualcuno ti voterà, apparirà qui</p>
            </div>
          </div>
        ) : (
          <div>
            {ratings.map((rating, i) => (
              <RatingItem key={rating.id} rating={rating} myProfileId={myProfile.id} index={i} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function RatingItem({ rating, myProfileId, index }: { rating: RatingWithRater; myProfileId: string; index: number }) {
  const [replyText, setReplyText] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const replyMutation = useMutation({
    mutationFn: async (reply: string) => {
      return apiRequest("POST", `/api/ratings/${rating.id}/reply`, { reply });
    },
    onSuccess: async (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/matches", myProfileId] });
      await new Promise(resolve => setTimeout(resolve, 200));
      if (data.match?.id) {
        setLocation(`/chat/${data.match.id}`);
      }
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/ratings/received"] });
        queryClient.invalidateQueries({ queryKey: ["/api/ratings/count"] });
      }, 500);
      toast({ title: "Chat aperta!", description: `Conversazione con ${rating.rater.name} avviata.` });
    },
    onError: () => {
      toast({ title: "Errore", description: "Non è stato possibile inviare il messaggio.", variant: "destructive" });
    },
  });

  const handleReply = () => {
    if (replyText.trim()) {
      replyMutation.mutate(replyText.trim());
    }
  };

  const ratingColor = rating.rating >= 4 ? "text-green-400" : rating.rating >= 3 ? "text-yellow-400" : "text-orange-400";
  const ratingBgColor = rating.rating >= 4 ? "bg-green-500/20" : rating.rating >= 3 ? "bg-yellow-500/20" : "bg-orange-500/20";
  const IconComponent = ratingIcons[rating.rating] || Star;
  const timeAgo = getTimeAgo(new Date(rating.createdAt));
  const hasReplied = !!rating.ratedReply;

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className="border-b border-white/5"
      data-testid={`rating-card-${rating.id}`}
    >
      <div
        className={`flex items-center gap-3 px-4 py-3 hover-elevate cursor-pointer ${hasReplied ? "opacity-70" : ""}`}
        onClick={() => {
          if (hasReplied) return;
          setIsExpanded(!isExpanded);
        }}
        data-testid={`voter-banner-${rating.id}`}
      >
        <div className="relative">
          <Avatar className="w-12 h-12 border-2 border-white/20">
            <AvatarImage src={rating.rater.imageUrl} alt={rating.rater.name} />
            <AvatarFallback className="bg-primary/20 text-primary">{rating.rater.name[0]}</AvatarFallback>
          </Avatar>
          <div className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full ${ratingBgColor} flex items-center justify-center border-2 border-[#1a0a2e]`}>
            <span className={`text-xs font-bold ${ratingColor}`}>{rating.rating}</span>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-white font-medium text-sm" data-testid={`rating-rater-name-${rating.id}`}>
              {rating.rater.name}
            </span>
            <span className="text-white/30 text-[11px]">{rating.rater.age} anni</span>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <IconComponent className={`w-3 h-3 ${ratingColor}`} />
            <span className="text-white/50 text-xs truncate">{ratingLabels[rating.rating]}</span>
          </div>
          {hasReplied && (
            <p className="text-white/40 text-xs truncate mt-0.5">
              Hai risposto: {rating.ratedReply}
            </p>
          )}
        </div>

        <div className="flex flex-col items-end gap-1">
          <span className="text-white/30 text-[10px]">{timeAgo}</span>
          {!hasReplied && <div className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />}
          {hasReplied && <MessageCircle className="w-3.5 h-3.5 text-white/30" />}
        </div>
      </div>

      {isExpanded && !hasReplied && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="px-4 pb-3"
        >
          <div className="bg-white/5 rounded-lg p-3 border border-white/10">
            <p className="text-white/40 text-[11px] mb-2">
              Scrivi un messaggio per iniziare a chattare con {rating.rater.name}
            </p>
            <div className="flex gap-2">
              <Input
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder={`Scrivi a ${rating.rater.name}...`}
                className="flex-1 bg-white/10 border-white/20 text-white placeholder:text-white/30 text-sm"
                onKeyDown={(e) => { if (e.key === "Enter") handleReply(); }}
                disabled={replyMutation.isPending}
                autoFocus
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
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffMin < 1) return "ora";
  if (diffMin < 60) return `${diffMin}m`;
  if (diffHour < 24) return `${diffHour}h`;
  if (diffDay < 7) return `${diffDay}g`;
  return date.toLocaleDateString("it-IT", { day: "numeric", month: "short" });
}

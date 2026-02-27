import { motion } from "framer-motion";
import { Heart, MessageCircle, Sparkles, MapPin, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState, useCallback } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import type { Profile } from "@shared/schema";

interface MatchCardProps {
  profile: Profile;
  matchId: string;
  matchDate?: Date;
  index?: number;
}

export function MatchCard({ profile, matchId, matchDate, index = 0 }: MatchCardProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [showConfirm, setShowConfirm] = useState(false);
  const { t } = useLanguage();

  const unmatchMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/matches/${matchId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (query) => {
        const key = query.queryKey[0];
        return typeof key === "string" && key.startsWith("/api/matches");
      }});
      toast({
        title: t("matchCard.removed"),
        description: `${t("matchCard.removedDesc")} ${profile.name}`,
      });
    },
    onError: () => {
      toast({
        title: t("common.error"),
        description: t("matchCard.removeError"),
        variant: "destructive",
      });
    },
  });

  const handleCardClick = useCallback(() => {
    if (!showConfirm) {
      setLocation(`/chat/${matchId}`);
    }
  }, [showConfirm, matchId, setLocation]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className="group relative"
      data-testid={`match-card-${profile.id}`}
    >
      <div
        className="rounded-2xl overflow-hidden bg-card border border-card-border shadow-lg cursor-pointer"
        onClick={handleCardClick}
      >
        <div className="relative aspect-square overflow-hidden">
          <img
            src={profile.imageUrl}
            alt={profile.name}
            className="w-full h-full object-cover object-top"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
          
          <div className="absolute top-3 left-3">
            <Badge variant="secondary" className="bg-primary/80 text-primary-foreground backdrop-blur-sm">
              <Sparkles className="w-3 h-3 mr-1" />
              {profile.alienType}
            </Badge>
          </div>

          <div className="absolute top-2 right-2 z-10">
            <Button
              variant="ghost"
              size="icon"
              className="bg-black/50 backdrop-blur-sm text-white rounded-full"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setShowConfirm(true);
              }}
              data-testid={`button-unmatch-${profile.id}`}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
          
          <div className="absolute bottom-3 left-3 right-3">
            <h3 className="text-lg font-bold text-white mb-1">
              {profile.name}, {profile.age}
            </h3>
            <div className="flex items-center gap-1 text-white/80">
              <MapPin className="w-3 h-3" />
              <span className="text-xs">{profile.location}</span>
            </div>
          </div>
          
          <div className="absolute bottom-2 right-2">
            <div className="w-8 h-8 rounded-full bg-primary/80 backdrop-blur-sm flex items-center justify-center">
              <MessageCircle className="w-4 h-4 text-white" />
            </div>
          </div>
        </div>
        
        <div className="p-3 flex items-center justify-between gap-1 flex-wrap">
          <div className="flex items-center gap-2 text-muted-foreground text-xs">
            <Heart className="w-4 h-4 text-accent fill-accent" />
            <span>{t("matchCard.match")}</span>
          </div>
          {matchDate && (
            <span className="text-xs text-muted-foreground">
              {new Date(matchDate).toLocaleDateString('it-IT')}
            </span>
          )}
        </div>
      </div>

      {showConfirm && (
        <div
          className="absolute inset-0 z-20 rounded-2xl bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-4 gap-3"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-white text-sm text-center font-medium">
            {t("matchCard.removeConfirm")} {profile.name}?
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="text-white border-white/30"
              onClick={(e) => {
                e.stopPropagation();
                setShowConfirm(false);
              }}
              data-testid={`button-cancel-unmatch-${profile.id}`}
            >
              {t("common.cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={(e) => {
                e.stopPropagation();
                unmatchMutation.mutate();
              }}
              disabled={unmatchMutation.isPending}
              data-testid={`button-confirm-unmatch-${profile.id}`}
            >
              {unmatchMutation.isPending ? "..." : t("matchCard.remove")}
            </Button>
          </div>
        </div>
      )}
    </motion.div>
  );
}

export function MatchCardSkeleton() {
  return (
    <div className="rounded-2xl overflow-hidden bg-card border border-card-border shadow-lg animate-pulse">
      <div className="aspect-square bg-muted" />
      <div className="p-3">
        <div className="h-4 bg-muted rounded w-2/3" />
      </div>
    </div>
  );
}

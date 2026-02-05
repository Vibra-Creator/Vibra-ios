import { motion } from "framer-motion";
import { Heart, MessageCircle, Sparkles, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import type { Profile } from "@shared/schema";

interface MatchCardProps {
  profile: Profile;
  matchId: string;
  matchDate?: Date;
  index?: number;
}

export function MatchCard({ profile, matchId, matchDate, index = 0 }: MatchCardProps) {
  const [, setLocation] = useLocation();
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className="group relative"
      data-testid={`match-card-${profile.id}`}
    >
      <div className="rounded-2xl overflow-hidden bg-card border border-card-border shadow-lg hover-elevate">
        <div className="relative aspect-square overflow-hidden">
          <img
            src={profile.imageUrl}
            alt={profile.name}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
          
          <div className="absolute top-3 left-3">
            <Badge variant="secondary" className="bg-primary/80 text-primary-foreground backdrop-blur-sm">
              <Sparkles className="w-3 h-3 mr-1" />
              {profile.alienType}
            </Badge>
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
          
          <motion.div
            initial={{ opacity: 0 }}
            whileHover={{ opacity: 1 }}
            className="absolute inset-0 bg-black/50 flex items-center justify-center"
          >
            <Button 
              size="lg"
              className="bg-primary/90 backdrop-blur-sm"
              onClick={() => setLocation(`/chat/${matchId}`)}
              data-testid={`button-message-${profile.id}`}
            >
              <MessageCircle className="w-5 h-5 mr-2" />
              Messaggio
            </Button>
          </motion.div>
        </div>
        
        <div className="p-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-muted-foreground text-xs">
            <Heart className="w-4 h-4 text-accent fill-accent" />
            <span>Match</span>
          </div>
          {matchDate && (
            <span className="text-xs text-muted-foreground">
              {new Date(matchDate).toLocaleDateString('it-IT')}
            </span>
          )}
        </div>
      </div>
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

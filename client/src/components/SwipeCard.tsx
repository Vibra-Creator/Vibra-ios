import { useState, forwardRef } from "react";
import { motion, useMotionValue, useTransform, PanInfo } from "framer-motion";
import { Heart, X, Star, MapPin, Sparkles, BadgeCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Profile } from "@shared/schema";

interface SwipeCardProps {
  profile: Profile;
  onSwipe: (direction: "left" | "right") => void;
  isTop?: boolean;
}

export const SwipeCard = forwardRef<HTMLDivElement, SwipeCardProps>(
  function SwipeCard({ profile, onSwipe, isTop = false }, ref) {
    const [exitX, setExitX] = useState(0);
    const x = useMotionValue(0);
    const rotate = useTransform(x, [-200, 200], [-25, 25]);
    const opacity = useTransform(x, [-200, -100, 0, 100, 200], [0.5, 1, 1, 1, 0.5]);
    
    const likeOpacity = useTransform(x, [0, 100], [0, 1]);
    const nopeOpacity = useTransform(x, [-100, 0], [1, 0]);

    const handleDragEnd = (_: any, info: PanInfo) => {
      if (info.offset.x > 100) {
        setExitX(300);
        onSwipe("right");
      } else if (info.offset.x < -100) {
        setExitX(-300);
        onSwipe("left");
      }
    };

    return (
      <motion.div
        ref={ref}
        className="absolute w-full cursor-grab active:cursor-grabbing"
        style={{ x, rotate, opacity }}
        drag={isTop ? "x" : false}
        dragConstraints={{ left: 0, right: 0 }}
        onDragEnd={handleDragEnd}
        initial={{ scale: isTop ? 1 : 0.95, y: isTop ? 0 : 20 }}
        animate={{ 
          scale: isTop ? 1 : 0.95, 
          y: isTop ? 0 : 20,
          x: exitX,
        }}
        exit={{ x: exitX, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
        data-testid={`swipe-card-${profile.id}`}
      >
        <div className="relative rounded-2xl overflow-hidden bg-card shadow-2xl border border-card-border">
          <div className="relative aspect-[3/4] overflow-hidden">
            <img
              src={profile.imageUrl}
              alt={profile.name}
              className="w-full h-full object-cover"
              data-testid={`profile-image-${profile.id}`}
            />
            
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
            
            <motion.div 
              className="absolute top-6 right-6 px-4 py-2 rounded-lg border-2 border-green-400 bg-green-400/20 backdrop-blur-sm"
              style={{ opacity: likeOpacity }}
            >
              <span className="text-green-400 font-bold text-xl tracking-wider">LIKE</span>
            </motion.div>
            
            <motion.div 
              className="absolute top-6 left-6 px-4 py-2 rounded-lg border-2 border-red-400 bg-red-400/20 backdrop-blur-sm"
              style={{ opacity: nopeOpacity }}
            >
              <span className="text-red-400 font-bold text-xl tracking-wider">NOPE</span>
            </motion.div>
            
            <div className="absolute bottom-0 left-0 right-0 p-6">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="secondary" className="bg-primary/80 text-primary-foreground backdrop-blur-sm">
                  <Sparkles className="w-3 h-3 mr-1" />
                  {profile.alienType}
                </Badge>
              </div>
              
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-3xl font-bold text-white" data-testid={`profile-name-${profile.id}`}>
                  {profile.name}, {profile.age}
                </h2>
                {profile.isVerified && (
                  <BadgeCheck className="w-6 h-6 text-blue-400" />
                )}
              </div>
              
              <div className="flex items-center gap-1 text-white/80 mb-3">
                <MapPin className="w-4 h-4" />
                <span className="text-sm">{profile.location}</span>
              </div>
              
              <p className="text-white/90 text-sm line-clamp-2 mb-3" data-testid={`profile-bio-${profile.id}`}>
                {profile.bio}
              </p>
              
              <div className="flex flex-wrap gap-2">
                {profile.interests.slice(0, 3).map((interest, idx) => (
                  <Badge 
                    key={idx} 
                    variant="outline" 
                    className="bg-white/10 border-white/30 text-white backdrop-blur-sm"
                  >
                    {interest}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }
);

interface ActionButtonsProps {
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  onSuperLike?: () => void;
  disabled?: boolean;
}

export function ActionButtons({ onSwipeLeft, onSwipeRight, onSuperLike, disabled }: ActionButtonsProps) {
  return (
    <div className="flex items-center justify-center gap-6 py-6">
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={onSwipeLeft}
        disabled={disabled}
        className="w-16 h-16 rounded-full bg-card border border-destructive/50 flex items-center justify-center shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
        data-testid="button-swipe-left"
      >
        <X className="w-8 h-8 text-destructive" />
      </motion.button>
      
      {onSuperLike && (
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={onSuperLike}
          disabled={disabled}
          className="w-12 h-12 rounded-full bg-card border border-secondary/50 flex items-center justify-center shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          data-testid="button-super-like"
        >
          <Star className="w-6 h-6 text-secondary" />
        </motion.button>
      )}
      
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={onSwipeRight}
        disabled={disabled}
        className="w-16 h-16 rounded-full bg-primary flex items-center justify-center shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ boxShadow: "var(--glow-primary)" }}
        data-testid="button-swipe-right"
      >
        <Heart className="w-8 h-8 text-primary-foreground" />
      </motion.button>
    </div>
  );
}

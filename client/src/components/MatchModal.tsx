import { motion, AnimatePresence } from "framer-motion";
import { Heart, MessageCircle, X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import type { Profile } from "@shared/schema";

interface MatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  matchedProfile: Profile | null;
  currentProfile?: Profile | null;
  matchId?: string | null;
}

export function MatchModal({ isOpen, onClose, matchedProfile, currentProfile, matchId }: MatchModalProps) {
  const [, setLocation] = useLocation();
  if (!matchedProfile) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <video
            autoPlay
            loop
            muted
            playsInline
            className="absolute inset-0 w-full h-full object-cover"
          >
            <source src="/videos/vibra-match.mp4" type="video/mp4" />
          </video>
          <div className="absolute inset-0 bg-black/50" />

          <motion.div
            initial={{ scale: 0.8, opacity: 0, y: 50 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: 50 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="relative z-10 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={onClose}
              className="absolute -top-2 -right-2 z-10 w-10 h-10 rounded-full bg-black/60 backdrop-blur-sm border border-white/20 flex items-center justify-center"
              data-testid="button-close-match-modal"
            >
              <X className="w-5 h-5 text-white" />
            </button>

            <div className="rounded-3xl overflow-hidden bg-white/10 backdrop-blur-xl border border-white/20 p-1">
              <div className="rounded-2xl bg-black/40 backdrop-blur-sm p-6 text-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: "spring" }}
                  className="mb-4"
                >
                  <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-primary to-accent"
                       style={{ boxShadow: "0 0 40px rgba(200,0,255,0.5)" }}>
                    <Heart className="w-10 h-10 text-white fill-white" />
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <Sparkles className="w-6 h-6 text-yellow-400" />
                    <h2 className="text-3xl font-black tracking-wider text-white"
                        style={{ textShadow: "0 0 20px rgba(200,0,255,0.8), 0 0 40px rgba(0,200,255,0.4)" }}
                        data-testid="text-vibra-match">
                      VIBRA MATCH
                    </h2>
                    <Sparkles className="w-6 h-6 text-yellow-400" />
                  </div>
                  <p className="text-white/80 mb-6 text-base">
                    Tu e <span className="font-bold text-white">{matchedProfile.name}</span> vi siete piaciuti!
                  </p>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.4 }}
                  className="flex justify-center items-center gap-4 mb-6"
                >
                  {currentProfile && (
                    <div className="relative">
                      <img
                        src={currentProfile.imageUrl}
                        alt="Tu"
                        className="w-24 h-24 rounded-full object-cover border-4 border-primary"
                        style={{ boxShadow: "0 0 20px rgba(200,0,255,0.5)" }}
                      />
                    </div>
                  )}

                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                    className="flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-primary to-accent"
                  >
                    <Heart className="w-6 h-6 text-white fill-white" />
                  </motion.div>

                  <div className="relative">
                    <img
                      src={matchedProfile.imageUrl}
                      alt={matchedProfile.name}
                      className="w-24 h-24 rounded-full object-cover border-4 border-accent"
                      style={{ boxShadow: "0 0 20px rgba(0,200,255,0.5)" }}
                      data-testid="match-profile-image"
                    />
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="space-y-3"
                >
                  <Button
                    className="w-full"
                    size="lg"
                    onClick={() => {
                      onClose();
                      if (matchId) {
                        setLocation(`/chat/${matchId}`);
                      } else {
                        setLocation("/matches");
                      }
                    }}
                    data-testid="button-send-message"
                  >
                    <MessageCircle className="w-5 h-5 mr-2" />
                    Invia un Messaggio
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full border-white/30 text-white"
                    size="lg"
                    onClick={onClose}
                    data-testid="button-keep-swiping"
                  >
                    Continua a Esplorare
                  </Button>
                </motion.div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { useGuest } from "@/hooks/use-guest";
import { useAuth } from "@/hooks/use-auth";

interface GuestBlockerProps {
  show: boolean;
  onClose: () => void;
  action?: string;
}

export function GuestBlocker({ show, onClose, action }: GuestBlockerProps) {
  const { exitGuestMode } = useGuest();

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/70 backdrop-blur-sm"
          onClick={onClose}
          data-testid="guest-blocker-overlay"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="w-full max-w-sm rounded-2xl bg-card border border-border p-6 text-center"
            onClick={(e) => e.stopPropagation()}
            data-testid="guest-blocker-modal"
          >
            <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-primary/20 flex items-center justify-center">
              <Lock className="w-7 h-7 text-primary" />
            </div>

            <h3 className="text-lg font-bold text-foreground mb-2">
              Funzione riservata agli iscritti
            </h3>

            <p className="text-sm text-muted-foreground mb-6">
              {action
                ? `Per ${action}, devi creare un account gratuito. Ci vogliono solo 30 secondi!`
                : "Per interagire con gli altri utenti, devi creare un account gratuito. Ci vogliono solo 30 secondi!"}
            </p>

            <div className="flex flex-col gap-3">
              <Link href="/register" onClick={() => exitGuestMode()}>
                <Button
                  className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90"
                  data-testid="button-guest-register"
                >
                  <UserPlus className="w-4 h-4 mr-2" />
                  Crea Account Gratuito
                </Button>
              </Link>

              <Link href="/login" onClick={() => exitGuestMode()}>
                <Button variant="outline" className="w-full" data-testid="button-guest-login">
                  Ho già un account
                </Button>
              </Link>

              <Button
                variant="ghost"
                className="text-muted-foreground"
                onClick={onClose}
                data-testid="button-guest-continue"
              >
                Continua a esplorare
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function useGuestBlocker() {
  const { isGuest } = useGuest();
  const { isAuthenticated } = useAuth();
  const [showBlocker, setShowBlocker] = useState(false);
  const [blockerAction, setBlockerAction] = useState<string | undefined>();

  const blockIfGuest = (action?: string): boolean => {
    if (isGuest && !isAuthenticated) {
      setBlockerAction(action);
      setShowBlocker(true);
      return true;
    }
    return false;
  };

  return {
    showBlocker,
    blockerAction,
    setShowBlocker,
    blockIfGuest,
    GuestBlockerModal: () => (
      <GuestBlocker
        show={showBlocker}
        onClose={() => setShowBlocker(false)}
        action={blockerAction}
      />
    ),
  };
}

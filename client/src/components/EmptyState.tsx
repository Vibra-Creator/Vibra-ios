import { motion } from "framer-motion";
import { Sparkles, Heart, Rocket, RefreshCw, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  type: "no-profiles" | "no-matches" | "loading" | "error";
  onRetry?: () => void;
  onResetDislikes?: () => void;
  isResetting?: boolean;
}

export function EmptyState({ type, onRetry, onResetDislikes, isResetting }: EmptyStateProps) {
  const content = {
    "no-profiles": {
      icon: Rocket,
      title: "Nessun profilo disponibile",
      description: "Hai esplorato tutti i profili disponibili nella galassia. Ricarica per rivedere i profili scartati e scoprire nuovi arrivi!",
      action: "Ricarica Profili",
    },
    "no-matches": {
      icon: Heart,
      title: "Nessun match ancora",
      description: "Continua a esplorare per trovare la tua connessione cosmica. Le stelle potrebbero allinearsi presto!",
      action: "Esplora",
    },
    "loading": {
      icon: Sparkles,
      title: "Caricamento in corso...",
      description: "Stiamo cercando profili compatibili nella galassia.",
      action: null,
    },
    "error": {
      icon: RefreshCw,
      title: "Ops! Qualcosa è andato storto",
      description: "Si è verificato un errore durante il caricamento. Per favore riprova.",
      action: "Riprova",
    },
  };

  const { icon: Icon, title, description, action } = content[type];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center p-8 text-center"
    >
      <motion.div
        animate={type === "loading" ? { rotate: 360 } : {}}
        transition={type === "loading" ? { duration: 2, repeat: Infinity, ease: "linear" } : {}}
        className="w-24 h-24 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mb-6"
        style={{ boxShadow: "var(--glow-primary)" }}
      >
        <Icon className="w-12 h-12 text-primary" />
      </motion.div>
      
      <h3 className="text-xl font-bold mb-2" data-testid="empty-state-title">{title}</h3>
      <p className="text-muted-foreground max-w-sm mb-6">{description}</p>
      
      <div className="flex items-center gap-3 flex-wrap justify-center">
        {action && onRetry && (
          <Button onClick={onRetry} disabled={isResetting} data-testid="button-retry">
            <RefreshCw className={`w-4 h-4 mr-2 ${isResetting ? "animate-spin" : ""}`} />
            {isResetting ? "Ripristino..." : action}
          </Button>
        )}
      </div>
    </motion.div>
  );
}

export function ProfileCardSkeleton() {
  return (
    <div className="w-full rounded-2xl overflow-hidden bg-card shadow-2xl border border-card-border animate-pulse">
      <div className="aspect-[3/4] bg-muted" />
    </div>
  );
}

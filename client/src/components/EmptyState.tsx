import { motion } from "framer-motion";
import { Sparkles, Heart, Rocket, RefreshCw, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/i18n/LanguageContext";

interface EmptyStateProps {
  type: "no-profiles" | "no-matches" | "loading" | "error";
  onRetry?: () => void;
  onResetDislikes?: () => void;
  isResetting?: boolean;
}

export function EmptyState({ type, onRetry, onResetDislikes, isResetting }: EmptyStateProps) {
  const { t } = useLanguage();

  const content = {
    "no-profiles": {
      icon: Rocket,
      title: t("empty.noProfiles"),
      description: t("empty.noProfilesDesc"),
      action: t("empty.reload"),
    },
    "no-matches": {
      icon: Heart,
      title: t("empty.noMatches"),
      description: t("empty.noMatchesDesc"),
      action: t("empty.explore"),
    },
    "loading": {
      icon: Sparkles,
      title: t("empty.loading"),
      description: t("empty.loadingDesc"),
      action: null,
    },
    "error": {
      icon: RefreshCw,
      title: t("empty.error"),
      description: t("empty.errorDesc"),
      action: t("empty.retry"),
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
            {isResetting ? t("empty.resetting") : action}
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

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Gift, Star, Heart, Sparkles, X, Coins } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useLanguage } from "@/i18n/LanguageContext";
import type { VirtualGift } from "@shared/schema";

const giftIcons: Record<string, typeof Star> = {
  star: Star,
  flower: Sparkles,
  heart: Heart,
  ring: Sparkles,
  explosion: Star,
  galaxy: Sparkles,
};

const giftAnimationClasses: Record<string, string> = {
  shooting_star: "animate-pulse",
  cosmic_rose: "animate-bounce",
  nebula_heart: "animate-pulse",
  saturn_ring: "animate-spin",
  supernova: "animate-ping",
  galaxy_love: "animate-pulse",
};

interface GiftPickerProps {
  receiverId: string;
  receiverName: string;
  onClose: () => void;
  onGiftSent: (gift: VirtualGift) => void;
}

export default function GiftPicker({ receiverId, receiverName, onClose, onGiftSent }: GiftPickerProps) {
  const [selectedGift, setSelectedGift] = useState<VirtualGift | null>(null);
  const [giftMessage, setGiftMessage] = useState("");
  const { toast } = useToast();
  const { t } = useLanguage();

  const { data: gifts = [] } = useQuery<VirtualGift[]>({
    queryKey: ["/api/gifts"],
  });

  const { data: pointsData } = useQuery<{ points: number }>({
    queryKey: ["/api/points/me"],
  });

  const myPoints = pointsData?.points ?? 0;

  const sendGiftMutation = useMutation({
    mutationFn: async () => {
      if (!selectedGift) return;
      return apiRequest("POST", "/api/gifts/send", {
        giftId: selectedGift.id,
        receiverId,
        message: giftMessage || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/points/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/gifts/sent"] });
      queryClient.invalidateQueries({ queryKey: ["/api/profiles/me"] });
      if (selectedGift) {
        onGiftSent(selectedGift);
      }
      toast({
        title: t("gift.sent"),
        description: `${t("gift.sentDesc")} ${selectedGift?.name} ${t("gift.to")} ${receiverName}`,
      });
      onClose();
    },
    onError: (error: any) => {
      const msg = error?.message?.includes("insufficienti")
        ? t("gift.notEnoughPoints")
        : t("gift.error");
      toast({
        title: t("common.error"),
        description: msg,
        variant: "destructive",
      });
    },
  });

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="relative w-full max-w-lg rounded-t-3xl bg-black/80 backdrop-blur-xl border-t border-white/10 p-6 pb-10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-white" data-testid="text-gift-title">
              {t("gift.sendTo")} {receiverName}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <Coins className="w-4 h-4 text-yellow-400" />
              <span className="text-sm text-yellow-400 font-medium" data-testid="text-points-balance">
                {myPoints} {t("gift.pointsAvailable")}
              </span>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} data-testid="button-close-gifts">
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-4">
          {gifts.map((gift) => {
            const IconComponent = giftIcons[gift.icon] || Gift;
            const canAfford = myPoints >= gift.cost;
            const isSelected = selectedGift?.id === gift.id;

            return (
              <motion.button
                key={gift.id}
                whileTap={{ scale: 0.95 }}
                onClick={() => canAfford && setSelectedGift(isSelected ? null : gift)}
                className={`relative flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${
                  isSelected
                    ? "border-primary bg-primary/20"
                    : canAfford
                    ? "border-white/10 bg-white/5 hover-elevate"
                    : "border-white/5 bg-white/5 opacity-40"
                }`}
                disabled={!canAfford}
                data-testid={`button-gift-${gift.animationType}`}
              >
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center ${giftAnimationClasses[gift.animationType] || ""}`}
                  style={{ backgroundColor: `${gift.color}30` }}
                >
                  <IconComponent className="w-5 h-5" style={{ color: gift.color }} />
                </div>
                <span className="text-xs text-white font-medium text-center leading-tight">{gift.name}</span>
                <div className="flex items-center gap-1">
                  <Coins className="w-3 h-3 text-yellow-400" />
                  <span className="text-xs text-yellow-400">{gift.cost}</span>
                </div>
              </motion.button>
            );
          })}
        </div>

        {selectedGift && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="space-y-3"
          >
            <Input
              value={giftMessage}
              onChange={(e) => setGiftMessage(e.target.value)}
              placeholder={t("gift.addMessage")}
              className="bg-white/10 backdrop-blur-sm border-white/20 text-white placeholder:text-white/40"
              maxLength={100}
              data-testid="input-gift-message"
            />
            <Button
              onClick={() => sendGiftMutation.mutate()}
              disabled={sendGiftMutation.isPending}
              className="w-full bg-gradient-to-r from-primary to-accent"
              data-testid="button-send-gift"
            >
              {sendGiftMutation.isPending ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  {t("gift.sending")}
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Gift className="w-4 h-4" />
                  {t("gift.sendGift")} {selectedGift.name} ({selectedGift.cost} {t("gift.points")})
                </span>
              )}
            </Button>
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  );
}

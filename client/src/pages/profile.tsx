import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { User, MapPin, Sparkles, Edit2, Settings, Heart, Star, Coins, Gift, Plus, LogOut, Trash2, ArrowLeft, Eye, UserPlus, Lock, EyeOff, HelpCircle, Download, Ban, X, Share2, Bell, BellOff, Play, VideoIcon, AlertCircle, Ghost, Dna, Zap, Moon, Fingerprint, BookMarked, ShieldCheck, CheckCircle2, XCircle, Users, Flag, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";
import { useGuest } from "@/hooks/use-guest";
import { useGuestBlocker } from "@/components/GuestBlocker";
import { useToast } from "@/hooks/use-toast";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Link } from "wouter";
import { useLanguage } from "@/i18n/LanguageContext";
import type { Profile, Match, SentGift, VirtualGift } from "@shared/schema";
import { ProfileDetailModal } from "@/components/SwipeCard";
import { ProfileVideosSection } from "@/components/ProfileVideosSection";

function ProfileSkeleton() {
  return (
    <div className="flex-1 p-4 max-w-lg mx-auto space-y-6">
      <Skeleton className="aspect-[3/4] rounded-2xl" />
      <div className="grid grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-48 rounded-lg" />
    </div>
  );
}

function CreateProfilePrompt() {
  const [, setLocation] = useLocation();
  const { t } = useLanguage();

  return (
    <div className="flex-1 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center max-w-sm"
      >
        <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center"
             style={{ boxShadow: "var(--glow-primary)" }}>
          <Sparkles className="w-12 h-12 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">{t("profile.createTitle")}</h2>
        <p className="text-white/60 mb-6">
          {t("profile.createDesc")}
        </p>
        <Button 
          size="lg" 
          className="w-full"
          onClick={() => setLocation("/profile/edit")}
          data-testid="button-create-profile"
        >
          <Plus className="w-5 h-5 mr-2" />
          {t("profile.createBtn")}
        </Button>
      </motion.div>
    </div>
  );
}

const ProfileBackground = () => (
  <div className="fixed inset-0 z-0">
    <img src="/images/vibra-profile-bg.jpg" alt="" className="w-full h-full object-cover" />
    <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/20 to-black/40" />
  </div>
);

function PrimaImpressioneToggle({ profile }: { profile: Profile }) {
  const { toast } = useToast();
  const { t } = useLanguage();
  
  const toggleMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("PUT", `/api/profiles/${profile.id}`, {
        ratingEnabled: !profile.ratingEnabled,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profiles/me"] });
      toast({
        title: profile.ratingEnabled ? t("profile.piDeactivated") : t("profile.piActivated"),
        description: profile.ratingEnabled
          ? t("profile.piDeactivatedDesc")
          : t("profile.piActivatedDesc"),
      });
    },
    onError: () => {
      toast({ title: t("common.error"), description: t("profile.piUpdateError"), variant: "destructive" });
    },
  });

  return (
    <button
      type="button"
      onClick={() => toggleMutation.mutate()}
      disabled={toggleMutation.isPending}
      className={`w-full p-5 rounded-xl border-2 transition-all text-left ${
        profile.ratingEnabled
          ? "bg-gradient-to-r from-purple-500/30 via-pink-500/30 to-cyan-500/30 border-primary shadow-lg shadow-primary/30 backdrop-blur-md"
          : "bg-black/40 border-white/20 backdrop-blur-md"
      }`}
      data-testid="toggle-prima-impressione-profile"
    >
      <div className="flex items-center gap-3">
        <div className={`w-14 h-14 rounded-full flex items-center justify-center shrink-0 transition-all ${
          profile.ratingEnabled ? "bg-primary/40" : "bg-white/15"
        }`}>
          <Eye className={`w-7 h-7 transition-colors ${profile.ratingEnabled ? "text-primary" : "text-white/50"}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className={`font-extrabold text-xl tracking-wide mb-1 transition-colors drop-shadow-lg ${profile.ratingEnabled ? "text-white" : "text-white/90"}`}>
            {t("profile.primaImpressione")}
          </p>
          <p className={`text-sm leading-relaxed font-semibold ${profile.ratingEnabled ? "text-white/90" : "text-white/70"}`}>
            {profile.ratingEnabled
              ? t("profile.piEnabled")
              : t("profile.piDisabled")}
          </p>
        </div>
        <div className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors shrink-0 ${
          profile.ratingEnabled ? "bg-primary" : "bg-white/20"
        }`}>
          <span className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform shadow-sm ${
            profile.ratingEnabled ? "translate-x-7" : "translate-x-1"
          }`} />
        </div>
      </div>
      {profile.ratingEnabled && (
        <div className="mt-3 pt-3 border-t border-white/10 flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse" />
          <span className="text-sm text-green-400 font-semibold">{t("profile.active")}</span>
        </div>
      )}
    </button>
  );
}

function ReferralSection() {
  const { toast } = useToast();
  const { t } = useLanguage();
  const { data: referralData, isLoading } = useQuery<{ code: string; referrals: number; paidReferrals: number }>({
    queryKey: ["/api/referral/my-code"],
  });

  const shareCode = () => {
    const code = referralData?.code || "";
    const shareText = `${t("profile.inviteFriends")}! ${code}\nhttps://vibraalienmatch.com/register`;
    if (navigator.share) {
      navigator.share({ title: t("profile.inviteShareTitle"), text: shareText }).catch(() => {});
    } else {
      navigator.clipboard.writeText(shareText);
      toast({ title: t("profile.copied"), description: t("profile.copiedDesc") });
    }
  };

  if (isLoading) return null;
  if (!referralData) return null;

  return (
    <div className="p-5 rounded-xl bg-gradient-to-r from-cyan-500/20 via-primary/20 to-pink-500/20 border-2 border-primary/30 backdrop-blur-md" data-testid="referral-section">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-12 h-12 rounded-full bg-primary/30 flex items-center justify-center shrink-0">
          <UserPlus className="w-6 h-6 text-primary" />
        </div>
        <div className="flex-1">
          <p className="font-bold text-white text-lg">{t("profile.inviteFriends")}</p>
          <p className="text-xs text-white/60">{t("profile.inviteDesc")}</p>
        </div>
      </div>
      <div className="bg-black/40 rounded-lg p-3 mb-3 flex items-center justify-between">
        <div>
          <p className="text-[10px] text-white/40 uppercase tracking-wider">{t("profile.yourCode")}</p>
          <p className="text-xl font-bold text-white tracking-widest" data-testid="text-referral-code">{referralData.code}</p>
        </div>
        <Button size="sm" variant="outline" className="text-white border-white/30" onClick={shareCode} data-testid="button-share-referral">
          <Gift className="w-4 h-4 mr-1" />
          {t("profile.share")}
        </Button>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <div className="flex-1 flex items-center bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 overflow-hidden" data-testid="share-app-link-box">
          <span className="text-white/50 text-sm truncate select-all">vibraalienmatch.com</span>
        </div>
        <button
          onClick={async () => {
            const url = "https://vibraalienmatch.com";
            if (navigator.share) {
              try { await navigator.share({ title: "Vibra – Cosmic Community 👽", text: "Unisciti a me su Vibra, la community cosmica delle connessioni 🛸", url }); } catch {}
            } else {
              await navigator.clipboard.writeText(url);
              toast({ title: "Link copiato!", description: "vibraalienmatch.com copiato negli appunti" });
            }
          }}
          className="w-11 h-11 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0 active:scale-95 transition-transform"
          data-testid="button-share-app-link"
        >
          <Share2 className="w-5 h-5 text-primary" />
        </button>
      </div>
      <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 mb-3 flex items-center gap-2">
        <Coins className="w-5 h-5 text-yellow-400 shrink-0" />
        <p className="text-sm text-yellow-200 font-medium" data-testid="text-referral-reward-info">{t("referral.rewardExplain")}</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-white/5 rounded-lg p-2 text-center">
          <p className="text-2xl font-bold text-white" data-testid="text-referral-count">{referralData.referrals}</p>
          <p className="text-[10px] text-white/50">{t("profile.friendsInvited")}</p>
        </div>
        <div className="bg-white/5 rounded-lg p-2 text-center">
          <p className="text-2xl font-bold text-white" data-testid="text-referral-paid">{referralData.paidReferrals}</p>
          <p className="text-[10px] text-white/50">{t("profile.subscribers")}</p>
        </div>
      </div>
    </div>
  );
}

function PianeteCard({ profileId }: { profileId: string }) {
  const { data, isLoading } = useQuery<{
    orbits: Array<{ roomId: string; roomName: string; visitCount: number; orbitStability: number }>;
    gravity: number;
  }>({ queryKey: ["/api/planets/my-orbits"], staleTime: 60_000 });

  if (isLoading) return null;
  const orbits = data?.orbits ?? [];
  const gravity = data?.gravity ?? 0;
  if (!orbits.length) return null;

  const gravityStars = Math.min(5, Math.round(gravity));

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="w-full rounded-2xl bg-gradient-to-br from-blue-900/20 to-indigo-900/15 border border-blue-500/15 p-4 mb-3">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-base">🪐</span>
          <span className="text-white/70 font-semibold text-sm">Le tue Orbite</span>
        </div>
        <div className="flex items-center gap-1">
          {[...Array(5)].map((_, i) => (
            <span key={i} className={`text-xs ${i < gravityStars ? "text-yellow-400" : "text-white/20"}`}>⭐</span>
          ))}
          <span className="text-white/40 text-xs ml-1">gravità</span>
        </div>
      </div>
      <div className="space-y-2">
        {orbits.map((o, i) => (
          <div key={o.roomId} className="flex items-center gap-2">
            <span className="text-white/40 text-xs w-4">{i + 1}.</span>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-center mb-0.5">
                <span className="text-white/70 text-xs truncate">{o.roomName}</span>
                <span className="text-white/40 text-xs shrink-0 ml-2">{o.visitCount}x</span>
              </div>
              <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full"
                  style={{ width: `${Math.min(100, o.orbitStability * 100)}%` }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

function BadgeSection({ profileId, profileName }: { profileId: string; profileName: string }) {
  const { toast } = useToast();
  const profileUrl = `${window.location.origin}/p/${profileId}`;
  const badgeUrl   = `${window.location.origin}/api/badge/${profileId}`;
  const embedCode  = `<a href="${profileUrl}" target="_blank" rel="noopener"><img src="${badgeUrl}" alt="${profileName} su Vibra" width="380" height="110" /></a>`;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast({ title: "Copiato!", description: label });
    }).catch(() => {
      toast({ title: "Errore", description: "Non riuscito a copiare", variant: "destructive" });
    });
  };

  const shareProfile = () => {
    if (navigator.share) {
      navigator.share({ title: `${profileName} su Vibra`, text: `Guardami su Vibra 🛸`, url: profileUrl }).catch(() => {});
    } else {
      copyToClipboard(profileUrl, "Link profilo copiato negli appunti");
    }
  };

  return (
    <div className="p-5 rounded-xl bg-gradient-to-br from-purple-500/15 via-primary/10 to-cyan-500/15 border border-primary/30 backdrop-blur-md space-y-4 mx-auto w-full" data-testid="badge-section">
      <div className="flex items-center gap-3 justify-center sm:justify-start">
        <div className="w-12 h-12 rounded-full bg-primary/30 flex items-center justify-center shrink-0">
          <Star className="w-6 h-6 text-primary" />
        </div>
        <div>
          <p className="font-bold text-white text-lg leading-tight">Il tuo Badge Vibra</p>
          <p className="text-xs text-white/55">Condividi il tuo profilo ovunque</p>
        </div>
      </div>

      {/* Badge preview */}
      <div className="rounded-xl overflow-hidden border border-white/10 bg-black/40">
        <img
          src={`/api/badge/${profileId}`}
          alt={`Badge di ${profileName}`}
          width={380}
          height={110}
          className="w-full h-auto"
          data-testid="img-badge-preview"
        />
      </div>

      {/* Actions */}
      <div className="grid grid-cols-2 gap-2 w-full">
        <button
          onClick={shareProfile}
          className="flex items-center justify-center gap-2 h-11 rounded-xl bg-primary/20 border border-primary/30 text-white text-sm font-semibold active:scale-95 transition-transform w-full"
          data-testid="button-share-badge-profile"
        >
          <Share2 className="w-4 h-4" />
          Condividi link
        </button>
        <button
          onClick={() => copyToClipboard(embedCode, "Codice embed copiato")}
          className="flex items-center justify-center gap-2 h-11 rounded-xl bg-white/10 border border-white/20 text-white text-sm font-semibold active:scale-95 transition-transform w-full"
          data-testid="button-copy-embed"
        >
          <Download className="w-4 h-4" />
          Copia embed
        </button>
      </div>

      {/* Link display */}
      <div className="flex items-center bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 gap-2">
        <span className="text-white/45 text-xs truncate flex-1 select-all" data-testid="text-profile-link">
          {profileUrl}
        </span>
        <button
          onClick={() => copyToClipboard(profileUrl, "Link profilo copiato")}
          className="text-primary text-xs font-semibold shrink-0 active:opacity-60 transition-opacity"
          data-testid="button-copy-profile-link"
        >
          Copia
        </button>
      </div>
    </div>
  );
}

function ChangePasswordDialog() {
  const [open, setOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const { toast } = useToast();
  const { t } = useLanguage();

  const changeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/auth/change-password", {
        currentPassword,
        newPassword,
      });
      return (res as Response).json();
    },
    onSuccess: () => {
      toast({ title: t("profile.passwordUpdated"), description: t("profile.passwordUpdatedDesc") });
      setOpen(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (err: any) => {
      toast({ title: t("common.error"), description: err.message || t("profile.passwordError"), variant: "destructive" });
    },
  });

  const handleSubmit = () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast({ title: t("profile.missingFields"), description: t("profile.fillAllFields"), variant: "destructive" });
      return;
    }
    if (newPassword.length < 8) {
      toast({ title: t("profile.passwordTooShort"), description: t("profile.passwordTooShortDesc"), variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: t("profile.passwordMismatch"), description: t("profile.passwordMismatchDesc"), variant: "destructive" });
      return;
    }
    changeMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setCurrentPassword(""); setNewPassword(""); setConfirmPassword(""); } }}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="w-full justify-start gap-3"
          data-testid="button-change-password"
        >
          <Lock className="w-5 h-5" />
          {t("profile.changePassword")}
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-card border-border">
        <DialogHeader>
          <DialogTitle>{t("profile.changePassword")}</DialogTitle>
          <DialogDescription>
            {t("profile.changePasswordDesc")}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <label className="text-sm font-medium">{t("profile.currentPassword")}</label>
            <div className="relative">
              <Input
                type={showCurrent ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder={t("profile.currentPasswordPlaceholder")}
                data-testid="input-current-password"
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                data-testid="button-toggle-current-password"
              >
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">{t("profile.newPassword")}</label>
            <div className="relative">
              <Input
                type={showNew ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={t("profile.newPasswordHint")}
                data-testid="input-new-password"
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                data-testid="button-toggle-new-password"
              >
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">{t("profile.confirmNewPassword")}</label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder={t("profile.confirmNewPasswordPlaceholder")}
              data-testid="input-confirm-password"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} data-testid="button-cancel-password">
            {t("profile.cancel")}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={changeMutation.isPending}
            data-testid="button-submit-password"
          >
            {changeMutation.isPending ? t("profile.updating") : t("profile.changePassword")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConsentInbox() {
  const { toast } = useToast();
  const { data: consents = [], refetch } = useQuery<Array<{
    id: string; fromProfileId: string; contentType: string; message: string | null; createdAt: string;
  }>>({ queryKey: ["/api/consent"], staleTime: 60_000 });

  const respondMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'accepted' | 'declined' }) =>
      apiRequest("POST", `/api/consent/${id}/respond`, { status }),
    onSuccess: () => { refetch(); queryClient.invalidateQueries({ queryKey: ["/api/consent"] }); },
  });

  const CONTENT_LABELS: Record<string, string> = {
    video_call: "📹 Video chiamata", voice_message: "🎤 Messaggio vocale",
    photo_share: "📷 Foto", location_share: "📍 Posizione",
  };

  const [open, setOpen] = useState(false);

  if (!consents.length) return (
    <Button variant="outline" className="w-full justify-start gap-3 text-base h-12 text-white/40 border-white/10 cursor-default" disabled>
      <ShieldCheck className="w-5 h-5" />
      VibraConsent — Nessuna richiesta
    </Button>
  );

  return (
    <>
      <Button variant="outline"
        className="w-full justify-start gap-3 text-base h-12 border-green-500/30 text-green-300 hover:bg-green-500/10 relative"
        onClick={() => setOpen(true)} data-testid="button-consent-inbox">
        <ShieldCheck className="w-5 h-5" />
        VibraConsent — Richieste consenso
        <Badge className="ml-auto bg-green-500 text-black text-xs h-5 min-w-[20px] rounded-full">
          {consents.length}
        </Badge>
      </Button>
      {open && (
        <div className="rounded-2xl bg-black/60 border border-green-500/20 p-4 space-y-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-white/70 font-semibold text-sm">Richieste in attesa</span>
            <Button variant="ghost" size="icon" className="h-6 w-6 text-white/40" onClick={() => setOpen(false)}><X className="w-4 h-4" /></Button>
          </div>
          {consents.map(c => (
            <div key={c.id} className="rounded-xl bg-white/5 p-3 flex items-start gap-3" data-testid={`consent-item-${c.id}`}>
              <div className="flex-1 min-w-0">
                <p className="text-white/80 text-sm font-medium">{CONTENT_LABELS[c.contentType] ?? c.contentType}</p>
                {c.message && <p className="text-white/50 text-xs mt-0.5 truncate">{c.message}</p>}
                <p className="text-white/30 text-xs mt-1">{new Date(c.createdAt).toLocaleString("it-IT", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
              </div>
              <div className="flex gap-1.5 shrink-0">
                <Button size="icon" className="h-8 w-8 bg-green-500/20 hover:bg-green-500/40 text-green-400 border-0"
                  onClick={() => respondMutation.mutate({ id: c.id, status: 'accepted' })}
                  disabled={respondMutation.isPending} data-testid={`button-accept-consent-${c.id}`}>
                  <CheckCircle2 className="w-4 h-4" />
                </Button>
                <Button size="icon" className="h-8 w-8 bg-red-500/20 hover:bg-red-500/40 text-red-400 border-0"
                  onClick={() => { respondMutation.mutate({ id: c.id, status: 'declined' }); toast({ title: "Richiesta rifiutata" }); }}
                  disabled={respondMutation.isPending} data-testid={`button-decline-consent-${c.id}`}>
                  <XCircle className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

export default function ProfilePage() {
  const [, setLocation] = useLocation();
  const { user, logout, isLoggingOut } = useAuth();
  const { isGuest } = useGuest();
  const { blockIfGuest, GuestBlockerModal } = useGuestBlocker();
  const { toast } = useToast();
  const { t } = useLanguage();
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [showReportsList, setShowReportsList] = useState(false);
  const [removeReportConfirmId, setRemoveReportConfirmId] = useState<string | null>(null);
  const { isSupported: pushSupported, isSubscribed: pushSubscribed, permission: pushPermission, subscribe: pushSubscribe, unsubscribe: pushUnsubscribe } = usePushNotifications();

  if (isGuest) {
    return (
      <div className="relative">
        <ProfileBackground />
        <div className="relative z-10 flex-1 flex items-center justify-center p-4 min-h-[60vh]">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center max-w-sm"
          >
            <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center"
                 style={{ boxShadow: "var(--glow-primary)" }}>
              <User className="w-12 h-12 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2" data-testid="text-guest-profile-title">{t("profile.createTitle")}</h2>
            <p className="text-white/60 mb-6" data-testid="text-guest-profile-description">
              {t("profile.guestCreateDesc")}
            </p>
            <div className="flex flex-col gap-3">
              <Link href="/register">
                <Button className="w-full bg-gradient-to-r from-primary to-accent" data-testid="button-guest-register-profile">
                  <UserPlus className="w-5 h-5 mr-2" />
                  {t("profile.registerFree")}
                </Button>
              </Link>
              <Link href="/login">
                <Button variant="outline" className="w-full" data-testid="button-guest-login-profile">
                  {t("profile.haveAccount")}
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
        <GuestBlockerModal />
      </div>
    );
  }

  const deleteProfileMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("DELETE", "/api/profiles/me");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profiles/me"] });
      toast({ title: t("profile.profileDeleted"), description: t("profile.profileDeletedDesc") });
      setIsDeleteOpen(false);
      setLocation("/profile/edit");
    },
    onError: () => {
      toast({ title: t("common.error"), description: t("profile.profileDeleteError"), variant: "destructive" });
    },
  });

  const [isAccountDeleteOpen, setIsAccountDeleteOpen] = useState(false);
  const deleteAccountMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("DELETE", "/api/profiles/me?deleteAccount=true");
    },
    onSuccess: () => {
      toast({ title: t("profile.accountDeleted"), description: t("profile.accountDeletedDesc") });
      window.location.href = "/login";
    },
    onError: () => {
      toast({ title: t("common.error"), description: t("profile.accountDeleteError"), variant: "destructive" });
    },
  });

  const handleExportData = async () => {
    try {
      const res = await fetch("/api/gdpr/export", { credentials: "include" });
      if (!res.ok) throw new Error("Export failed");
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "vibra-personal-data.json";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: t("profile.downloadComplete"), description: t("profile.downloadCompleteDesc") });
    } catch {
      toast({ title: t("common.error"), description: t("profile.downloadError"), variant: "destructive" });
    }
  };

  const { data: profile, isLoading } = useQuery<Profile | null>({
    queryKey: ["/api/profiles/me"],
    enabled: !!user,
    staleTime: 0,
    refetchOnMount: "always",
  });

  const { data: matchesData } = useQuery<(Match & { profile: Profile })[]>({
    queryKey: ["/api/matches", profile?.id],
    enabled: !!profile,
  });

  const { data: receivedGiftsData } = useQuery<(SentGift & { gift: VirtualGift; sender: Profile })[]>({
    queryKey: ["/api/gifts/received"],
    enabled: !!profile,
  });

  const { data: dnaData } = useQuery<{ profileId: string; vector: Record<string, number> }>({
    queryKey: ["/api/dna/my-dna"],
    enabled: !!profile && !isGuest,
    staleTime: 5 * 60 * 1000,
  });

  const { data: visitorsData } = useQuery<{ id: string; name: string; age: number; imageUrl: string; location: string; viewedAt: string }[]>({
    queryKey: ["/api/profiles/visitors"],
    enabled: !!profile && !isGuest,
    staleTime: 5 * 60 * 1000,
  });

  const { data: ghostStatus, refetch: refetchGhost } = useQuery<{ active: boolean; expiresAt: string | null }>({
    queryKey: ["/api/ghost/status"],
    enabled: !!profile && !isGuest,
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });

  const ghostActivateMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/ghost/activate", { hours: 24 }),
    onSuccess: () => {
      refetchGhost();
      queryClient.invalidateQueries({ queryKey: ["/api/ghost/status"] });
      toast({ title: "👻 Modalità Fantasma attiva", description: "Sei invisibile per 24 ore. Puoi ancora scrivere e swipare." });
    },
  });

  const ghostDeactivateMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/ghost/deactivate"),
    onSuccess: () => {
      refetchGhost();
      queryClient.invalidateQueries({ queryKey: ["/api/ghost/status"] });
      toast({ title: "👁️ Modalità Fantasma disattivata", description: "Il tuo profilo è nuovamente visibile." });
    },
  });

  const { data: mysteryStatus, refetch: refetchMystery } = useQuery<{ active: boolean; expiresAt: string | null }>({
    queryKey: ["/api/mystery/status"],
    enabled: !!profile && !isGuest,
    staleTime: 30 * 1000,
  });

  const mysteryActivateMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/mystery/activate", { hours: 24 }),
    onSuccess: () => { refetchMystery(); toast({ title: "🎭 Modalità Mistero attiva", description: "Gli altri vedono solo un alias per 24 ore." }); },
  });
  const mysteryDeactivateMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/mystery/deactivate"),
    onSuccess: () => { refetchMystery(); toast({ title: "🎭 Modalità Mistero disattivata" }); },
  });

  const { data: eclipseStatus, refetch: refetchEclipse } = useQuery<{ active: boolean; until: string | null }>({
    queryKey: ["/api/eclipse/status"],
    enabled: !!profile && !isGuest,
    staleTime: 30 * 1000,
  });

  const eclipseActivateMutation = useMutation({
    mutationFn: (days: number) => apiRequest("POST", "/api/eclipse/activate", { days }),
    onSuccess: () => { refetchEclipse(); toast({ title: "🌑 Eclissi attivata", description: "Il tuo profilo è in pausa." }); },
  });
  const eclipseDeactivateMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/eclipse/deactivate"),
    onSuccess: () => { refetchEclipse(); toast({ title: "🌕 Eclissi terminata", description: "Sei tornato nella galassia!" }); },
  });

  const [selectedReactionProfileId, setSelectedReactionProfileId] = useState<string | null>(null);

  type ReceivedReaction = { id: string; reaction: string; createdAt: string; fromProfile: { id: string; name: string; imageUrl: string; age: number } };
  const { data: receivedReactions = [] } = useQuery<ReceivedReaction[]>({
    queryKey: ["/api/reactions/received"],
    enabled: !!profile,
  });

  type MyReport = { id: string; reportedId: string; reason: string; description: string | null; status: string | null; createdAt: string; reportedName: string | null; reportedImage: string | null; reportedAge: number | null };
  const { data: myReports = [], refetch: refetchMyReports } = useQuery<MyReport[]>({
    queryKey: ["/api/reports/mine"],
    enabled: !!profile && showReportsList,
  });

  const removeReportMutation = useMutation({
    mutationFn: async (reportId: string) => apiRequest("DELETE", `/api/reports/${reportId}`),
    onSuccess: () => {
      setRemoveReportConfirmId(null);
      refetchMyReports();
      queryClient.invalidateQueries({ queryKey: ["/api/reports/mine"] });
      toast({ title: "Segnalazione rimossa", description: "Questo utente potrà di nuovo inviarti presentazioni." });
    },
    onError: () => {
      toast({ title: "Errore", description: "Impossibile rimuovere la segnalazione. Riprova.", variant: "destructive" });
    },
  });

  const { data: selectedReactionProfile } = useQuery<Profile>({
    queryKey: ["/api/profiles", selectedReactionProfileId],
    enabled: !!selectedReactionProfileId,
  });

  const REACTION_EMOJI: Record<string, string> = { fire: "🔥", ufo: "🛸", spark: "✨", crush: "😍" };

  const stats = [
    { icon: Heart, label: t("profile.match"), value: String(matchesData?.length ?? 0), color: "text-accent" },
    { icon: Coins, label: t("profile.points"), value: String(profile?.points ?? 0), color: "text-yellow-400" },
    { icon: Gift, label: t("profile.gifts"), value: String(receivedGiftsData?.length ?? 0), color: "text-primary" },
  ];

  if (isLoading) {
    return (
      <div className="relative">
        <ProfileBackground />
        <div className="relative z-10">
          <ProfileSkeleton />
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="relative">
        <ProfileBackground />
        <div className="relative z-10">
          <CreateProfilePrompt />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 px-4 py-4 w-full max-w-lg mx-auto overflow-y-auto relative">
      <ProfileBackground />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 space-y-6 w-full mx-auto"
      >
        <div className="flex justify-start">
          <Button variant="ghost" size="icon" className="text-white bg-black/30 backdrop-blur-sm" onClick={() => setLocation("/")} data-testid="button-back">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </div>
        <div className="relative w-full">
          <div className="aspect-[3/4] rounded-2xl overflow-hidden w-full">
            <img
              src={profile.imageUrl}
              alt={profile.name}
              className="w-full h-full object-cover object-top"
              data-testid="user-profile-image"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
          </div>
          
          <Button
            size="icon"
            variant="secondary"
            className="absolute top-4 right-4"
            onClick={() => setLocation("/profile/edit")}
            data-testid="button-edit-profile"
          >
            <Edit2 className="w-4 h-4" />
          </Button>
          
          <div className="absolute bottom-4 left-4 right-4 text-left">
            <Badge 
              variant="secondary" 
              className="bg-primary/80 text-primary-foreground backdrop-blur-sm mb-2"
            >
              <Sparkles className="w-3 h-3 mr-1" />
              {profile.alienType}
            </Badge>
            <h1 className="text-3xl font-bold text-white" data-testid="user-profile-name">
              {profile.name}, {profile.age}
            </h1>
            <div className="flex items-center gap-1 text-white/80">
              <MapPin className="w-4 h-4" />
              <span className="text-base">{profile.location}</span>
            </div>
          </div>
        </div>

        {profile.photos && profile.photos.length > 0 && (
          <div className="grid grid-cols-3 gap-2" data-testid="gallery-photos">
            {profile.photos.map((photo, idx) => (
              <div key={idx} className="aspect-square rounded-xl overflow-hidden border border-white/10">
                <img src={photo} alt={`${t("profileEdit.photo")} ${idx + 1}`} className="w-full h-full object-cover object-top" loading="lazy" data-testid={`img-gallery-photo-${idx}`} />
              </div>
            ))}
          </div>
        )}

        <ProfileVideosSection profileId={profile.id} currentMainVideoUrl={profile.profileVideoUrl} hideUpload={true} />

        <div className="grid grid-cols-3 gap-3 w-full text-center">
          {stats.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 * index }}
            >
              <div className="text-center p-4 w-full">
                <stat.icon className={`w-6 h-6 mx-auto mb-2 ${stat.color}`} />
                <div className="text-3xl font-bold text-white">{stat.value}</div>
                <div className="text-sm text-white/60">{stat.label}</div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Chi ti ha visitato */}
        {visitorsData && visitorsData.length > 0 && (
          <div className="w-full" data-testid="section-visitors">
            <h3 className="text-base font-semibold mb-3 flex items-center gap-2 text-white">
              <Eye className="w-4 h-4 text-purple-400" />
              Chi ha visitato il tuo profilo
              <Badge className="bg-purple-500/30 text-purple-200 text-xs">{visitorsData.length}</Badge>
            </h3>
            <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
              {visitorsData.map((v) => (
                <div key={v.id} className="flex flex-col items-center gap-1.5 min-w-[68px]" data-testid={`visitor-${v.id}`}>
                  <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-purple-500/40">
                    <img src={v.imageUrl} alt={v.name} className="w-full h-full object-cover object-top" />
                  </div>
                  <span className="text-white text-[11px] font-medium text-center leading-tight">{v.name}</span>
                  <span className="text-white/40 text-[10px]">{v.age} anni</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Social links */}
        {((profile as any).instagramHandle || (profile as any).tiktokHandle || (profile as any).facebookUrl) && (
          <div className="flex flex-wrap gap-2" data-testid="social-links-section">
            {(profile as any).instagramHandle && (
              <a href={`https://instagram.com/${(profile as any).instagramHandle}`} target="_blank" rel="noopener noreferrer"
                data-testid="link-instagram"
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold text-white transition-all active:scale-95"
                style={{ background:"linear-gradient(135deg,#833ab4,#fd1d1d,#fcb045)", boxShadow:"0 2px 12px rgba(253,29,29,0.2)" }}>
                <span>📸</span> @{(profile as any).instagramHandle}
              </a>
            )}
            {(profile as any).tiktokHandle && (
              <a href={`https://tiktok.com/@${(profile as any).tiktokHandle}`} target="_blank" rel="noopener noreferrer"
                data-testid="link-tiktok"
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold text-white transition-all active:scale-95"
                style={{ background:"linear-gradient(135deg,#010101,#69C9D0)", boxShadow:"0 2px 12px rgba(105,201,208,0.2)" }}>
                <span>🎵</span> @{(profile as any).tiktokHandle}
              </a>
            )}
            {(profile as any).facebookUrl && (
              <a href={(profile as any).facebookUrl} target="_blank" rel="noopener noreferrer"
                data-testid="link-facebook"
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold text-white transition-all active:scale-95"
                style={{ background:"linear-gradient(135deg,#1877f2,#0d5db8)", boxShadow:"0 2px 12px rgba(24,119,242,0.2)" }}>
                <span>👤</span> Facebook
              </a>
            )}
          </div>
        )}

        {/* Share to socials */}
        <div className="flex gap-2 flex-wrap" data-testid="share-to-socials">
          {[
            { label:"Instagram", emoji:"📸", color:"#fd1d1d", fn: () => navigator.share ? navigator.share({ title:`${profile.name} su Vibra`, text:`Seguimi su Vibra 🛸`, url:`https://vibraalienmatch.com/p/${profile.id}` }).catch(()=>{}) : navigator.clipboard.writeText(`https://vibraalienmatch.com/p/${profile.id}`) },
            { label:"TikTok",    emoji:"🎵", color:"#69C9D0", fn: () => navigator.share ? navigator.share({ title:`${profile.name} su Vibra`, text:`Guardami su Vibra 🛸`, url:`https://vibraalienmatch.com/p/${profile.id}` }).catch(()=>{}) : window.open("https://www.tiktok.com","_blank") },
            { label:"Facebook",  emoji:"👤", color:"#1877f2", fn: () => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(`https://vibraalienmatch.com/p/${profile.id}`)}`, "_blank") },
          ].map(s => (
            <button key={s.label} onClick={s.fn} data-testid={`button-share-${s.label.toLowerCase()}`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white/70 active:scale-95 transition-all"
              style={{ background:"rgba(255,255,255,0.07)", border:"1px solid rgba(255,255,255,0.12)" }}>
              <span>{s.emoji}</span>{s.label}
            </button>
          ))}
        </div>

        <div className="space-y-4 w-full">
          <div>
            <h3 className="text-base font-semibold mb-2 flex items-center gap-2 text-white">
              <User className="w-4 h-4 text-primary" />
              {t("profile.bio")}
            </h3>
            <p className="text-white/60 text-base" data-testid="user-profile-bio">
              {profile.bio}
            </p>
          </div>
          
          <div>
            <h3 className="text-base font-semibold mb-2 flex items-center gap-2 text-white">
              <Sparkles className="w-4 h-4 text-secondary" />
              {t("profile.interests")}
            </h3>
            <div className="flex flex-wrap gap-2">
              {profile.interests.map((interest, idx) => (
                <Badge 
                  key={idx} 
                  variant="outline"
                  className="bg-white/20 text-white border-white/30"
                >
                  {interest}
                </Badge>
              ))}
            </div>
          </div>
        </div>

        {receivedReactions.length > 0 && (
          <div className="space-y-3" data-testid="received-reactions-section">
            <h3 className="font-semibold flex items-center gap-2 text-white">
              <span className="text-lg">🛸</span>
              Chi ti ha reagito
              <span className="ml-auto text-xs text-white/50 font-normal">{receivedReactions.length}</span>
            </h3>
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
              {receivedReactions.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setSelectedReactionProfileId(r.fromProfile.id)}
                  className="flex-shrink-0 flex flex-col items-center gap-1 group"
                  data-testid={`reaction-received-${r.id}`}
                >
                  <div className="relative">
                    <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-white/20 group-active:border-primary transition-all">
                      <img src={r.fromProfile.imageUrl} alt={r.fromProfile.name} className="w-full h-full object-cover object-top" loading="lazy" />
                    </div>
                    <span className="absolute -bottom-1 -right-1 text-lg leading-none">{REACTION_EMOJI[r.reaction] ?? r.reaction}</span>
                  </div>
                  <span className="text-xs text-white/70 truncate max-w-[56px]">{r.fromProfile.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <PrimaImpressioneToggle profile={profile} />

        {/* ── VibraDNA Card ───────────────────────────────────────────── */}
        {dnaData && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-4 space-y-3"
          >
            <h3 className="font-semibold flex items-center gap-2 text-white text-base">
              <Dna className="w-4 h-4 text-purple-400" />
              VibraDNA
              <span className="ml-auto text-xs text-white/40 font-normal">Il tuo profilo comportamentale</span>
            </h3>
            {[
              { key: "engagement_depth", label: "🎯 Curiosità", color: "bg-purple-500" },
              { key: "expressiveness", label: "💬 Espressività", color: "bg-cyan-500" },
              { key: "social_initiative", label: "🚀 Iniziativa", color: "bg-pink-500" },
              { key: "community_engagement", label: "🌐 Community", color: "bg-green-500" },
              { key: "gamification_drive", label: "🎮 Spirito Gamer", color: "bg-yellow-500" },
            ].map(({ key, label, color }) => {
              const val = dnaData.vector[key] ?? 0.5;
              return (
                <div key={key} className="space-y-1">
                  <div className="flex justify-between text-xs text-white/60">
                    <span>{label}</span>
                    <span>{Math.round(val * 100)}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${color} transition-all duration-700`}
                      style={{ width: `${Math.round(val * 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
            <p className="text-xs text-white/40 pt-1">
              Aggiornato automaticamente in base ai tuoi comportamenti nell'app.
            </p>
          </motion.div>
        )}

        <ReferralSection />

        <BadgeSection profileId={profile.id} profileName={profile.name} />

        <PianeteCard profileId={profile.id} />

        <div className="space-y-2 w-full">
          <Button
            variant="outline"
            className="w-full justify-start gap-3 text-base h-12 border-violet-500/30 text-violet-300 hover:bg-violet-500/10"
            onClick={() => setLocation("/vault")}
            data-testid="button-vibravault"
          >
            <Lock className="w-5 h-5" />
            VibraVault — Confessioni Segrete
          </Button>

          {/* VibraQuest */}
          <Button
            variant="outline"
            className="w-full justify-start gap-3 text-base h-12 border-amber-500/30 text-amber-300 hover:bg-amber-500/10"
            onClick={() => setLocation("/quests")}
            data-testid="button-vibraquests"
          >
            <Zap className="w-5 h-5" />
            VibraQuest — Missioni Giornaliere
          </Button>

          {/* Costellazioni */}
          <Button
            variant="outline"
            className="w-full justify-start gap-3 text-base h-12 border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/10"
            onClick={() => setLocation("/constellations")}
            data-testid="button-costellazioni"
          >
            <Star className="w-5 h-5" />
            Costellazioni — Il tuo gruppo cosmico
          </Button>

          {/* VibraLegacy */}
          <Button
            variant="outline"
            className="w-full justify-start gap-3 text-base h-12 border-purple-500/30 text-purple-300 hover:bg-purple-500/10"
            onClick={() => setLocation("/legacy")}
            data-testid="button-vibralegacy"
          >
            <BookMarked className="w-5 h-5" />
            VibraLegacy — Messaggio nell'universo
          </Button>

          {/* VibraConsent badge */}
          <ConsentInbox />

          {/* VibraMystery Toggle */}
          {mysteryStatus !== undefined && (
            <Button
              variant="outline"
              className={`w-full justify-start gap-3 text-base h-12 transition-colors ${mysteryStatus.active ? "text-pink-300 border-pink-400/40 bg-pink-900/20" : "text-white/70"}`}
              onClick={() => {
                if (mysteryStatus.active) mysteryDeactivateMutation.mutate();
                else mysteryActivateMutation.mutate();
              }}
              disabled={mysteryActivateMutation.isPending || mysteryDeactivateMutation.isPending}
              data-testid="button-mystery-mode"
            >
              <Fingerprint className="w-5 h-5" />
              <span className="flex-1 text-left">
                {mysteryStatus.active ? "🎭 Mistero attivo" : "🎭 VibraMystery"}
              </span>
              {mysteryStatus.active && mysteryStatus.expiresAt && (
                <span className="text-xs text-pink-300/70 ml-auto">
                  fino alle {new Date(mysteryStatus.expiresAt).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
            </Button>
          )}

          {/* Eclissi Toggle */}
          {eclipseStatus !== undefined && (
            <Button
              variant="outline"
              className={`w-full justify-start gap-3 text-base h-12 transition-colors ${eclipseStatus.active ? "text-slate-300 border-slate-400/40 bg-slate-900/30" : "text-white/70"}`}
              onClick={() => {
                if (eclipseStatus.active) eclipseDeactivateMutation.mutate();
                else eclipseActivateMutation.mutate(3);
              }}
              disabled={eclipseActivateMutation.isPending || eclipseDeactivateMutation.isPending}
              data-testid="button-eclipse-mode"
            >
              <Moon className="w-5 h-5" />
              <span className="flex-1 text-left">
                {eclipseStatus.active ? "🌑 Eclissi attiva (pausa)" : "🌑 VibraEclissi"}
              </span>
              {eclipseStatus.active && eclipseStatus.until && (
                <span className="text-xs text-slate-300/70 ml-auto">
                  fino al {new Date(eclipseStatus.until).toLocaleDateString("it-IT", { day: "numeric", month: "short" })}
                </span>
              )}
            </Button>
          )}

          <Button 
            variant="outline" 
            className="w-full justify-start gap-3 text-base h-12"
            onClick={() => setLocation("/profile/edit")}
            data-testid="button-edit-full-profile"
          >
            <Edit2 className="w-5 h-5" />
            {t("profile.editProfile")}
          </Button>
          <Button 
            variant="outline" 
            className="w-full justify-start gap-3 text-base h-12"
            onClick={() => setLocation("/onboarding")}
            data-testid="button-guide"
          >
            <HelpCircle className="w-5 h-5" />
            {t("profile.guide")}
          </Button>
          {!pushSupported ? (
            <Button
              variant="outline"
              className="w-full justify-start gap-3 text-base h-12"
              onClick={() => toast({
                title: "Notifiche non disponibili",
                description: 'Su iPhone: tocca Condividi → "Aggiungi a schermata Home". Su Android usa Chrome.',
              })}
              data-testid="button-push-notifications"
            >
              <Bell className="w-5 h-5" />
              {t("push.enable")}
            </Button>
          ) : pushPermission === "denied" ? (
            <Button
              variant="outline"
              className="w-full justify-start gap-3 text-base h-12 text-yellow-400 border-yellow-400/30"
              onClick={() => toast({ title: t("push.denied"), variant: "destructive" })}
              data-testid="button-push-notifications"
            >
              <BellOff className="w-5 h-5" />
              {t("push.enable")}
            </Button>
          ) : (
            <Button
              variant="outline"
              className={`w-full justify-start gap-3 text-base h-12 ${pushSubscribed ? "text-green-400 border-green-400/30" : ""}`}
              onClick={async () => {
                if (pushSubscribed) {
                  await pushUnsubscribe();
                } else {
                  const ok = await pushSubscribe();
                  if (ok) {
                    toast({ title: t("push.success"), description: t("push.successDesc") });
                  }
                }
              }}
              data-testid="button-push-notifications"
            >
              {pushSubscribed ? <BellOff className="w-5 h-5" /> : <Bell className="w-5 h-5" />}
              {pushSubscribed ? t("push.disable") : t("push.enable")}
            </Button>
          )}
          {/* ── VibraGhost Toggle ──────────────────────────────────── */}
          {ghostStatus !== undefined && (
            <Button
              variant="outline"
              className={`w-full justify-start gap-3 text-base h-12 transition-colors ${ghostStatus.active ? "text-purple-300 border-purple-400/40 bg-purple-900/20" : "text-white/70"}`}
              onClick={() => {
                if (ghostStatus.active) ghostDeactivateMutation.mutate();
                else ghostActivateMutation.mutate();
              }}
              disabled={ghostActivateMutation.isPending || ghostDeactivateMutation.isPending}
              data-testid="button-ghost-mode"
            >
              <Ghost className="w-5 h-5" />
              <span className="flex-1 text-left">
                {ghostStatus.active ? "👻 Fantasma attivo" : "👻 Modalità Fantasma"}
              </span>
              {ghostStatus.active && ghostStatus.expiresAt && (
                <span className="text-xs text-purple-300/70 ml-auto">
                  fino alle {new Date(ghostStatus.expiresAt).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
            </Button>
          )}
          {/* Segnalazioni */}
          <Button
            variant="outline"
            className="w-full justify-start gap-3 text-base h-12 text-orange-300 border-orange-500/30 hover:bg-orange-500/10"
            onClick={() => setShowReportsList(true)}
            data-testid="button-segnalazioni"
          >
            <Flag className="w-5 h-5" />
            Segnalazioni
            <ChevronRight className="w-4 h-4 ml-auto" />
          </Button>

          <Button 
            variant="outline" 
            className="w-full justify-start gap-3 text-base h-12"
            onClick={() => setLocation("/profile/edit")}
            data-testid="button-settings"
          >
            <Settings className="w-5 h-5" />
            {t("profile.settings")}
          </Button>
          <ChangePasswordDialog />
          <Button 
            variant="outline" 
            className="w-full justify-start gap-3 text-xl h-12 text-black border-red-400/30 hover:text-black"
            onClick={() => logout()}
            disabled={isLoggingOut}
            data-testid="button-logout"
          >
            <LogOut className="w-5 h-5" />
            {isLoggingOut ? t("profile.loggingOut") : t("profile.logout")}
          </Button>

          <Button 
            variant="outline" 
            className="w-full justify-start gap-3 text-base h-12"
            onClick={handleExportData}
            data-testid="button-export-data"
          >
            <Download className="w-5 h-5" />
            {t("profile.exportData")}
          </Button>

          <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
            <AlertDialogTrigger asChild>
              <Button 
                variant="outline" 
                className="w-full justify-start gap-3 text-xl h-12 text-black border-red-500/30"
                data-testid="button-delete-profile"
              >
                <Trash2 className="w-5 h-5" />
                {t("profile.deleteProfile")}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-card border-border">
              <AlertDialogHeader>
                <AlertDialogTitle>{t("profile.deleteProfileTitle")}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t("profile.deleteProfileDesc")}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel data-testid="button-cancel-delete">{t("profile.cancel")}</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-red-600 hover:bg-red-700 text-white"
                  onClick={() => deleteProfileMutation.mutate()}
                  disabled={deleteProfileMutation.isPending}
                  data-testid="button-confirm-delete"
                >
                  {deleteProfileMutation.isPending ? t("profile.deleting") : t("profile.deleteProfile")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog open={isAccountDeleteOpen} onOpenChange={setIsAccountDeleteOpen}>
            <AlertDialogTrigger asChild>
              <Button 
                variant="outline" 
                className="w-full justify-start gap-3 text-xl h-12 text-black border-red-600/30"
                data-testid="button-delete-account"
              >
                <X className="w-5 h-5" />
                {t("profile.deleteAccountComplete")}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-card border-border">
              <AlertDialogHeader>
                <AlertDialogTitle>{t("profile.deleteAccountTitle")}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t("profile.deleteAccountDesc")}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel data-testid="button-cancel-account-delete">{t("profile.cancel")}</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-red-600 hover:bg-red-700 text-white"
                  onClick={() => deleteAccountMutation.mutate()}
                  disabled={deleteAccountMutation.isPending}
                  data-testid="button-confirm-account-delete"
                >
                  {deleteAccountMutation.isPending ? t("profile.deleting") : t("profile.deleteAccountBtn")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </motion.div>

      {selectedReactionProfile && (
        <ProfileDetailModal
          profile={selectedReactionProfile}
          isOpen={!!selectedReactionProfile}
          onClose={() => setSelectedReactionProfileId(null)}
        />
      )}

      {/* ── Segnalazioni Panel ────────────────────────────────────── */}
      {showReportsList && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col" data-testid="segnalazioni-panel">
          <div className="flex items-center gap-3 px-4 pt-6 pb-4 border-b border-white/10">
            <Button variant="ghost" size="icon" className="text-white" onClick={() => { setShowReportsList(false); setRemoveReportConfirmId(null); }}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h2 className="text-lg font-bold text-white">🚩 Segnalazioni</h2>
              <p className="text-xs text-white/50">Profili che hai segnalato</p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {myReports.length === 0 ? (
              <div className="text-center py-16 text-white/40">
                <Flag className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p className="text-sm">Nessuna segnalazione attiva</p>
              </div>
            ) : (
              myReports.map((report) => (
                <div key={report.id} className="bg-white/5 border border-white/10 rounded-xl p-4">
                  <div className="flex items-center gap-3 mb-3">
                    {report.reportedImage ? (
                      <img src={report.reportedImage} alt={report.reportedName ?? ""} className="w-12 h-12 rounded-full object-cover object-top" />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
                        <User className="w-6 h-6 text-white/40" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-white truncate">
                        {report.reportedName ?? "Utente rimosso"}{report.reportedAge ? `, ${report.reportedAge}` : ""}
                      </p>
                      <p className="text-xs text-white/50 truncate">Motivo: {report.reason}</p>
                      <p className="text-xs text-white/30">
                        {new Date(report.createdAt).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" })}
                      </p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${report.status === "resolved" ? "text-green-400 border-green-400/30" : report.status === "dismissed" ? "text-white/30 border-white/10" : "text-orange-400 border-orange-400/30"}`}>
                      {report.status === "resolved" ? "Risolto" : report.status === "dismissed" ? "Archiviato" : "In esame"}
                    </span>
                  </div>

                  {removeReportConfirmId === report.id ? (
                    <div className="bg-orange-900/30 border border-orange-500/30 rounded-lg p-3 space-y-2">
                      <p className="text-xs text-orange-200 leading-snug">
                        ⚠️ <strong>Attenzione:</strong> rimuovendo questa segnalazione, <strong>{report.reportedName ?? "questo utente"}</strong> potrà di nuovo inviarti presentazioni (cold message). Eventuali blocchi restano invariati.
                      </p>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 text-white/70 border-white/20 text-xs h-8"
                          onClick={() => setRemoveReportConfirmId(null)}
                        >
                          Annulla
                        </Button>
                        <Button
                          size="sm"
                          className="flex-1 bg-orange-600 hover:bg-orange-700 text-white text-xs h-8"
                          onClick={() => removeReportMutation.mutate(report.id)}
                          disabled={removeReportMutation.isPending}
                        >
                          {removeReportMutation.isPending ? "Rimozione…" : "Conferma rimozione"}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full text-xs h-8 text-red-400 border-red-400/20 hover:bg-red-500/10"
                      onClick={() => setRemoveReportConfirmId(report.id)}
                    >
                      <Trash2 className="w-3 h-3 mr-1" />
                      Rimuovi segnalazione
                    </Button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

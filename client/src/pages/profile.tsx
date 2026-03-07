import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { User, MapPin, Sparkles, Edit2, Settings, Heart, Star, Coins, Gift, Plus, LogOut, Trash2, ArrowLeft, Eye, UserPlus, Lock, EyeOff, HelpCircle, Download, Ban, X, Share2, Bell, BellOff, Play, VideoIcon, AlertCircle } from "lucide-react";
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
import type { Profile, Match, SentGift, VirtualGift, ProfileVideo } from "@shared/schema";

function ProfileVideosSection({ profileId }: { profileId: string }) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadState, setUploadState] = useState<"idle" | "uploading" | "moderating">("idle");

  const { data: videos = [] } = useQuery<ProfileVideo[]>({
    queryKey: ['/api/profiles', profileId, 'videos'],
  });

  const deleteMutation = useMutation({
    mutationFn: (videoId: string) => apiRequest("DELETE", `/api/profiles/videos/${videoId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/profiles', profileId, 'videos'] });
      toast({ title: t("profile.videoDeleted"), description: t("profile.videoDeletedDesc") });
    },
    onError: () => {
      toast({ title: t("profile.videoDeleteError"), variant: "destructive" });
    },
  });

  async function extractThumbnail(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const video = document.createElement("video");
      video.preload = "metadata";
      video.muted = true;
      video.playsInline = true;
      const url = URL.createObjectURL(file);
      video.src = url;
      video.addEventListener("loadeddata", () => {
        video.currentTime = 0;
      });
      video.addEventListener("seeked", () => {
        const canvas = document.createElement("canvas");
        canvas.width = 320;
        canvas.height = 240;
        const ctx = canvas.getContext("2d");
        if (!ctx) { URL.revokeObjectURL(url); reject(new Error("canvas")); return; }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const base64 = canvas.toDataURL("image/jpeg", 0.7).split(",")[1];
        URL.revokeObjectURL(url);
        resolve(base64);
      });
      video.addEventListener("error", () => { URL.revokeObjectURL(url); reject(new Error("video load")); });
    });
  }

  async function handleVideoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!e.target) return;
    (e.target as HTMLInputElement).value = "";
    if (!file) return;

    if (file.size > 50 * 1024 * 1024) {
      toast({ title: t("profile.videoTooLarge"), description: t("profile.videoTooLargeDesc"), variant: "destructive" });
      return;
    }

    const checkDuration = (): Promise<number> => new Promise((resolve, reject) => {
      const v = document.createElement("video");
      v.preload = "metadata";
      v.src = URL.createObjectURL(file);
      v.onloadedmetadata = () => { URL.revokeObjectURL(v.src); resolve(v.duration); };
      v.onerror = () => reject(new Error("duration check"));
    });

    try {
      const duration = await checkDuration();
      if (duration > 30) {
        toast({ title: t("profile.videoTooLong"), description: t("profile.videoTooLongDesc"), variant: "destructive" });
        return;
      }
    } catch {}

    setUploadState("uploading");
    try {
      const urlRes = await apiRequest("POST", "/api/profiles/videos/request-upload", {
        contentType: file.type,
        size: file.size,
      });
      const { uploadURL, objectPath } = urlRes;

      await fetch(uploadURL, { method: "PUT", body: file, headers: { "Content-Type": file.type } });

      setUploadState("moderating");

      let thumbnailBase64 = "";
      try { thumbnailBase64 = await extractThumbnail(file); } catch {}

      await apiRequest("POST", "/api/profiles/videos", { objectPath, thumbnailBase64 });

      queryClient.invalidateQueries({ queryKey: ['/api/profiles', profileId, 'videos'] });
      toast({ title: t("profile.videoApproved"), description: t("profile.videoApprovedDesc") });
    } catch (err: any) {
      const msg = err?.message || "";
      let body: any = {};
      try {
        const jsonStart = msg.indexOf("{");
        if (jsonStart !== -1) body = JSON.parse(msg.slice(jsonStart));
      } catch {}
      if (body?.error === "rejected") {
        toast({ title: t("profile.videoRejected"), description: t("profile.videoRejectedDesc"), variant: "destructive" });
      } else if (body?.error === "max_videos") {
        toast({ title: t("profile.videoMaxReached"), description: t("profile.videoMaxReachedDesc"), variant: "destructive" });
      } else if (body?.error === "too_large") {
        toast({ title: t("profile.videoTooLarge"), description: t("profile.videoTooLargeDesc"), variant: "destructive" });
      } else {
        toast({ title: t("profile.videoUploadError"), variant: "destructive" });
      }
    } finally {
      setUploadState("idle");
    }
  }

  const uploading = uploadState === "uploading";
  const moderating = uploadState === "moderating";

  return (
    <div className="space-y-3" data-testid="profile-videos-section">
      <div className="flex items-center gap-2">
        <VideoIcon className="w-4 h-4 text-cyan-400" />
        <h3 className="font-semibold text-white">{t("profile.videos")}</h3>
        <span className="text-xs text-white/40 ml-1">{videos.length}/2</span>
      </div>
      <p className="text-white/50 text-xs">{t("profile.videosDesc")}</p>

      <div className="grid grid-cols-2 gap-3">
        {videos.map((video) => (
          <div key={video.id} className="relative aspect-video rounded-xl overflow-hidden border border-white/10 bg-black/40 group" data-testid={`profile-video-item-${video.id}`}>
            <video
              src={video.videoUrl}
              className="w-full h-full object-cover"
              preload="metadata"
              muted
              playsInline
            />
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <Play className="w-8 h-8 text-white/80 fill-white/80" />
            </div>
            <button
              onClick={() => deleteMutation.mutate(video.id)}
              disabled={deleteMutation.isPending}
              className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/70 border border-white/20 flex items-center justify-center text-white/80 hover:text-red-400 hover:bg-black/90 transition-colors z-10"
              data-testid={`button-delete-video-${video.id}`}
              title={t("profile.deleteVideo")}
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}

        {videos.length < 2 && (
          <button
            onClick={() => !uploading && !moderating && fileInputRef.current?.click()}
            disabled={uploading || moderating}
            className="aspect-video rounded-xl border-2 border-dashed border-white/20 flex flex-col items-center justify-center gap-1.5 text-white/40 hover:border-cyan-400/50 hover:text-cyan-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-white/5"
            data-testid="button-add-video"
          >
            {uploading ? (
              <>
                <div className="w-5 h-5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                <span className="text-[10px]">{t("profile.videoUploading")}</span>
              </>
            ) : moderating ? (
              <>
                <div className="w-5 h-5 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
                <span className="text-[10px] text-yellow-300">{t("profile.videoModerating")}</span>
              </>
            ) : (
              <>
                <Plus className="w-5 h-5" />
                <span className="text-[10px]">{t("profile.addVideo")}</span>
              </>
            )}
          </button>
        )}
      </div>

      <p className="text-white/30 text-[10px] flex items-center gap-1">
        <AlertCircle className="w-3 h-3 shrink-0" />
        {t("profile.videoInactiveNotice")}
      </p>

      <input
        ref={fileInputRef}
        type="file"
        accept="video/mp4,video/webm,video/quicktime,video/mov"
        className="hidden"
        onChange={handleVideoSelect}
        data-testid="input-video-upload"
      />
    </div>
  );
}

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

export default function ProfilePage() {
  const [, setLocation] = useLocation();
  const { user, logout, isLoggingOut } = useAuth();
  const { isGuest } = useGuest();
  const { blockIfGuest, GuestBlockerModal } = useGuestBlocker();
  const { toast } = useToast();
  const { t } = useLanguage();
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
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
    <div className="flex-1 p-4 max-w-lg mx-auto overflow-y-auto relative">
      <ProfileBackground />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 space-y-6"
      >
        <div className="flex justify-start">
          <Button variant="ghost" size="icon" className="text-white bg-black/30 backdrop-blur-sm" onClick={() => setLocation("/")} data-testid="button-back">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </div>
        <div className="relative">
          <div className="aspect-[3/4] rounded-2xl overflow-hidden">
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
          
          <div className="absolute bottom-4 left-4 right-4">
            <Badge 
              variant="secondary" 
              className="bg-primary/80 text-primary-foreground backdrop-blur-sm mb-2"
            >
              <Sparkles className="w-3 h-3 mr-1" />
              {profile.alienType}
            </Badge>
            <h1 className="text-2xl font-bold text-white" data-testid="user-profile-name">
              {profile.name}, {profile.age}
            </h1>
            <div className="flex items-center gap-1 text-white/80">
              <MapPin className="w-4 h-4" />
              <span className="text-sm">{profile.location}</span>
            </div>
          </div>
        </div>

        {profile.photos && profile.photos.length > 0 && (
          <div className="grid grid-cols-3 gap-2" data-testid="gallery-photos">
            {profile.photos.map((photo, idx) => (
              <div key={idx} className="aspect-square rounded-xl overflow-hidden border border-white/10">
                <img src={photo} alt={`${t("profileEdit.photo")} ${idx + 1}`} className="w-full h-full object-cover object-top" data-testid={`img-gallery-photo-${idx}`} />
              </div>
            ))}
          </div>
        )}

        <ProfileVideosSection profileId={profile.id} />

        <div className="grid grid-cols-3 gap-3">
          {stats.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 * index }}
            >
              <div className="text-center p-4">
                <stat.icon className={`w-6 h-6 mx-auto mb-2 ${stat.color}`} />
                <div className="text-2xl font-bold text-white">{stat.value}</div>
                <div className="text-xs text-white/60">{stat.label}</div>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2 flex items-center gap-2 text-white">
              <User className="w-4 h-4 text-primary" />
              {t("profile.bio")}
            </h3>
            <p className="text-white/60 text-sm" data-testid="user-profile-bio">
              {profile.bio}
            </p>
          </div>
          
          <div>
            <h3 className="font-semibold mb-2 flex items-center gap-2 text-white">
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

        <PrimaImpressioneToggle profile={profile} />

        <ReferralSection />

        <div className="space-y-2">
          <Button 
            variant="outline" 
            className="w-full justify-start gap-3"
            onClick={() => setLocation("/profile/edit")}
            data-testid="button-edit-full-profile"
          >
            <Edit2 className="w-5 h-5" />
            {t("profile.editProfile")}
          </Button>
          <Button 
            variant="outline" 
            className="w-full justify-start gap-3"
            onClick={() => setLocation("/onboarding")}
            data-testid="button-guide"
          >
            <HelpCircle className="w-5 h-5" />
            {t("profile.guide")}
          </Button>
          {pushSupported && (
            <Button 
              variant="outline" 
              className={`w-full justify-start gap-3 ${pushSubscribed ? "text-green-400 border-green-400/30" : ""}`}
              onClick={async () => {
                if (pushSubscribed) {
                  await pushUnsubscribe();
                } else {
                  if (pushPermission === "denied") {
                    toast({ title: t("push.denied"), variant: "destructive" });
                    return;
                  }
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
          <Button 
            variant="outline" 
            className="w-full justify-start gap-3"
            onClick={() => setLocation("/profile/edit")}
            data-testid="button-settings"
          >
            <Settings className="w-5 h-5" />
            {t("profile.settings")}
          </Button>
          <ChangePasswordDialog />
          <Button 
            variant="outline" 
            className="w-full justify-start gap-3 text-red-400 border-red-400/30 hover:text-red-300"
            onClick={() => logout()}
            disabled={isLoggingOut}
            data-testid="button-logout"
          >
            <LogOut className="w-5 h-5" />
            {isLoggingOut ? t("profile.loggingOut") : t("profile.logout")}
          </Button>

          <Button 
            variant="outline" 
            className="w-full justify-start gap-3"
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
                className="w-full justify-start gap-3 text-red-500 border-red-500/30"
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
                className="w-full justify-start gap-3 text-red-600 border-red-600/30"
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
    </div>
  );
}

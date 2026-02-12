import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { User, MapPin, Sparkles, Edit2, Settings, Heart, Star, Coins, Gift, Plus, LogOut, Trash2, ArrowLeft, Eye, UserPlus, Lock, EyeOff } from "lucide-react";
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
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Link } from "wouter";
import type { Profile, Match, SentGift, VirtualGift } from "@shared/schema";

function ProfileSkeleton() {
  return (
    <div className="flex-1 p-4 max-w-lg mx-auto space-y-6">
      <Skeleton className="aspect-[4/3] rounded-2xl" />
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
        <h2 className="text-2xl font-bold text-white mb-2">Crea il Tuo Profilo</h2>
        <p className="text-white/60 mb-6">
          Unisciti alla comunità galattica e inizia a trovare le tue connessioni cosmiche!
        </p>
        <Button 
          size="lg" 
          className="w-full"
          onClick={() => setLocation("/profile/edit")}
          data-testid="button-create-profile"
        >
          <Plus className="w-5 h-5 mr-2" />
          Crea Profilo
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
  
  const toggleMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("PUT", `/api/profiles/${profile.id}`, {
        ratingEnabled: !profile.ratingEnabled,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profiles/me"] });
      toast({
        title: profile.ratingEnabled ? "Prima Impressione disattivata" : "Sei in gioco!",
        description: profile.ratingEnabled
          ? "Non riceverai più voti sulla tua card."
          : "Ora gli altri potranno votarti e scriverti il primo messaggio!",
      });
    },
    onError: () => {
      toast({ title: "Errore", description: "Non è stato possibile aggiornare l'impostazione.", variant: "destructive" });
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
            Prima Impressione
          </p>
          <p className={`text-sm leading-relaxed font-semibold ${profile.ratingEnabled ? "text-white/90" : "text-white/70"}`}>
            {profile.ratingEnabled
              ? "Sei in gioco! Gli altri possono votarti e iniziare a chattare con te"
              : "Mettiti in gioco! Attiva e scopri cosa pensano gli altri di te. Chi ti vota potrà scriverti"}
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
          <span className="text-sm text-green-400 font-semibold">Attivo</span>
        </div>
      )}
    </button>
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

  const changeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/auth/change-password", {
        currentPassword,
        newPassword,
      });
      return (res as Response).json();
    },
    onSuccess: () => {
      toast({ title: "Password aggiornata!", description: "La tua password è stata cambiata con successo." });
      setOpen(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (err: any) => {
      toast({ title: "Errore", description: err.message || "Non è stato possibile cambiare la password.", variant: "destructive" });
    },
  });

  const handleSubmit = () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast({ title: "Campi mancanti", description: "Compila tutti i campi.", variant: "destructive" });
      return;
    }
    if (newPassword.length < 8) {
      toast({ title: "Password troppo corta", description: "La nuova password deve avere almeno 8 caratteri.", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Le password non corrispondono", description: "Controlla che le due password siano uguali.", variant: "destructive" });
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
          Cambia Password
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-card border-border">
        <DialogHeader>
          <DialogTitle>Cambia Password</DialogTitle>
          <DialogDescription>
            Inserisci la tua password attuale e scegli una nuova password.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <label className="text-sm font-medium">Password Attuale</label>
            <div className="relative">
              <Input
                type={showCurrent ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="La tua password attuale"
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
            <label className="text-sm font-medium">Nuova Password</label>
            <div className="relative">
              <Input
                type={showNew ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimo 8 caratteri"
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
            <label className="text-sm font-medium">Conferma Nuova Password</label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Ripeti la nuova password"
              data-testid="input-confirm-password"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} data-testid="button-cancel-password">
            Annulla
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={changeMutation.isPending}
            data-testid="button-submit-password"
          >
            {changeMutation.isPending ? "Aggiornamento..." : "Cambia Password"}
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
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

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
            <h2 className="text-2xl font-bold text-white mb-2" data-testid="text-guest-profile-title">Crea il Tuo Profilo</h2>
            <p className="text-white/60 mb-6" data-testid="text-guest-profile-description">
              Crea il tuo profilo per personalizzare la tua esperienza. Mostra chi sei, i tuoi interessi e trova le tue connessioni cosmiche!
            </p>
            <div className="flex flex-col gap-3">
              <Link href="/register">
                <Button className="w-full bg-gradient-to-r from-primary to-accent" data-testid="button-guest-register-profile">
                  <UserPlus className="w-5 h-5 mr-2" />
                  Registrati Gratis
                </Button>
              </Link>
              <Link href="/login">
                <Button variant="outline" className="w-full" data-testid="button-guest-login-profile">
                  Ho già un account
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
      toast({ title: "Profilo eliminato", description: "Il tuo profilo e tutti i dati associati sono stati cancellati." });
      setIsDeleteOpen(false);
      setLocation("/profile/edit");
    },
    onError: () => {
      toast({ title: "Errore", description: "Non è stato possibile eliminare il profilo.", variant: "destructive" });
    },
  });

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
    { icon: Heart, label: "Match", value: String(matchesData?.length ?? 0), color: "text-accent" },
    { icon: Coins, label: "Punti", value: String(profile?.points ?? 0), color: "text-yellow-400" },
    { icon: Gift, label: "Regali", value: String(receivedGiftsData?.length ?? 0), color: "text-primary" },
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
          <div className="aspect-[4/3] rounded-2xl overflow-hidden">
            <img
              src={profile.imageUrl}
              alt={profile.name}
              className="w-full h-full object-cover"
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
                <img src={photo} alt={`Foto ${idx + 1}`} className="w-full h-full object-cover" data-testid={`img-gallery-photo-${idx}`} />
              </div>
            ))}
          </div>
        )}

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
              Bio
            </h3>
            <p className="text-white/60 text-sm" data-testid="user-profile-bio">
              {profile.bio}
            </p>
          </div>
          
          <div>
            <h3 className="font-semibold mb-2 flex items-center gap-2 text-white">
              <Sparkles className="w-4 h-4 text-secondary" />
              Interessi
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

        <div className="space-y-2">
          <Button 
            variant="outline" 
            className="w-full justify-start gap-3"
            onClick={() => setLocation("/profile/edit")}
            data-testid="button-edit-full-profile"
          >
            <Edit2 className="w-5 h-5" />
            Modifica Profilo
          </Button>
          <Button 
            variant="outline" 
            className="w-full justify-start gap-3"
            onClick={() => setLocation("/profile/edit")}
            data-testid="button-settings"
          >
            <Settings className="w-5 h-5" />
            Impostazioni
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
            {isLoggingOut ? "Uscita..." : "Esci"}
          </Button>

          <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
            <AlertDialogTrigger asChild>
              <Button 
                variant="outline" 
                className="w-full justify-start gap-3 text-red-500 border-red-500/30"
                data-testid="button-delete-profile"
              >
                <Trash2 className="w-5 h-5" />
                Elimina Profilo
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-card border-border">
              <AlertDialogHeader>
                <AlertDialogTitle>Sei sicuro?</AlertDialogTitle>
                <AlertDialogDescription>
                  Questa azione è irreversibile. Il tuo profilo, i match, i messaggi, le stanze private e tutti i dati associati verranno eliminati definitivamente.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel data-testid="button-cancel-delete">Annulla</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-red-600 hover:bg-red-700 text-white"
                  onClick={() => deleteProfileMutation.mutate()}
                  disabled={deleteProfileMutation.isPending}
                  data-testid="button-confirm-delete"
                >
                  {deleteProfileMutation.isPending ? "Eliminazione..." : "Elimina Profilo"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </motion.div>
    </div>
  );
}

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { User, MapPin, Sparkles, Edit2, Settings, Heart, Star, Coins, Gift, Plus, LogOut, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
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

export default function Profile() {
  const [, setLocation] = useLocation();
  const { user, logout, isLoggingOut } = useAuth();
  const { toast } = useToast();
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

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

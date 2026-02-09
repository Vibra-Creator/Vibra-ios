import { useQuery, useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Users, Heart, MessageCircle, UserCheck, Trash2, Shield, ArrowLeft, BadgeCheck, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { User, Profile } from "@shared/schema";

interface AdminStats {
  totalUsers: number;
  totalProfiles: number;
  totalMatches: number;
  totalMessages: number;
  recentUsers: User[];
}

export default function Admin() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: stats, isLoading: statsLoading, error: statsError } = useQuery<AdminStats>({
    queryKey: ["/api/admin/stats"],
  });

  const { data: profiles, isLoading: profilesLoading } = useQuery<Profile[]>({
    queryKey: ["/api/admin/profiles"],
  });

  const { data: users } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
  });

  const deleteProfileMutation = useMutation({
    mutationFn: async (profileId: string) => {
      return apiRequest("DELETE", `/api/admin/profiles/${profileId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/profiles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
    },
  });

  const verifyProfileMutation = useMutation({
    mutationFn: async ({ profileId, isVerified }: { profileId: string; isVerified: boolean }) => {
      return apiRequest("PATCH", `/api/admin/profiles/${profileId}/verify`, { isVerified });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/profiles"] });
    },
  });

  const resetTestDataMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/admin/reset-test-data") as Promise<{ deleted: { swipes: number; matches: number; messages: number } }>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/profiles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/profiles/swipable"] });
      queryClient.invalidateQueries({ queryKey: ["/api/matches"] });
      toast({
        title: "Dati di test resettati!",
        description: `Eliminati: ${data.deleted.swipes} swipe, ${data.deleted.matches} match, ${data.deleted.messages} messaggi`,
      });
    },
    onError: () => {
      toast({ title: "Errore", description: "Impossibile resettare i dati di test.", variant: "destructive" });
    },
  });

  if (statsError) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center">
            <Shield className="w-16 h-16 mx-auto mb-4 text-destructive" />
            <h2 className="text-xl font-semibold mb-2">Accesso Negato</h2>
            <p className="text-muted-foreground mb-4">
              Non hai i permessi per accedere alla dashboard admin.
            </p>
            <Button onClick={() => setLocation("/")} data-testid="button-back-home">
              Torna alla Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const statCards = [
    { label: "Utenti", value: stats?.totalUsers || 0, icon: Users, color: "from-blue-500 to-cyan-500" },
    { label: "Profili", value: stats?.totalProfiles || 0, icon: UserCheck, color: "from-purple-500 to-pink-500" },
    { label: "Match", value: stats?.totalMatches || 0, icon: Heart, color: "from-pink-500 to-red-500" },
    { label: "Messaggi", value: stats?.totalMessages || 0, icon: MessageCircle, color: "from-green-500 to-emerald-500" },
  ];

  return (
    <div className="flex-1 p-4 md:p-6 max-w-7xl mx-auto overflow-y-auto">
      <div className="fixed inset-0 -z-10">
        <img src="/backgrounds/vibra-couple-rose.png" alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/40 to-black/60" />
      </div>
      <div className="flex items-center gap-4 mb-8">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setLocation("/")}
          data-testid="button-back"
        >
          <ArrowLeft className="w-5 h-5 text-white" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
          <p className="text-sm text-white/60">Gestisci l'app Vibra</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {statCards.map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card className="hover-elevate">
              <CardContent className="p-4 md:p-6">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center flex-shrink-0`}>
                    <stat.icon className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <Card className="mb-8">
        <CardContent className="p-4 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h3 className="font-semibold text-foreground">Reset Dati di Test</h3>
            <p className="text-sm text-muted-foreground">Resetta swipe, match e messaggi dei profili di test (Luna, Nova, Orion) per riutilizzarli</p>
          </div>
          <Button
            variant="outline"
            onClick={() => resetTestDataMutation.mutate()}
            disabled={resetTestDataMutation.isPending}
            data-testid="button-reset-test-data"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            {resetTestDataMutation.isPending ? "Resettando..." : "Reset Test Data"}
          </Button>
        </CardContent>
      </Card>

      <Tabs defaultValue="profiles" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="profiles" data-testid="tab-profiles">
            Profili ({profiles?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="users" data-testid="tab-users">
            Utenti ({users?.length || 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profiles">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Gestione Profili</CardTitle>
            </CardHeader>
            <CardContent>
              {profilesLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-4 p-3 rounded-lg bg-muted/50 animate-pulse">
                      <div className="w-12 h-12 rounded-full bg-muted" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-muted rounded w-32" />
                        <div className="h-3 bg-muted rounded w-24" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {profiles?.map((profile) => (
                    <div
                      key={profile.id}
                      className="flex items-center gap-4 p-3 rounded-lg bg-card border border-border hover-elevate"
                      data-testid={`profile-row-${profile.id}`}
                    >
                      <Avatar className="w-12 h-12">
                        <AvatarImage src={profile.imageUrl} alt={profile.name} />
                        <AvatarFallback>{profile.name[0]}</AvatarFallback>
                      </Avatar>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-foreground truncate">
                            {profile.name}, {profile.age}
                          </h3>
                          {profile.isVerified && (
                            <BadgeCheck className="w-4 h-4 text-blue-500" />
                          )}
                          {profile.isBot && (
                            <Badge variant="secondary" className="text-xs">
                              Bot
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          {profile.alienType} • {profile.location}
                        </p>
                      </div>

                      <Button
                        variant="ghost"
                        size="icon"
                        className={profile.isVerified ? "text-blue-500 hover:bg-blue-500/10" : "text-muted-foreground hover:bg-muted"}
                        onClick={() => verifyProfileMutation.mutate({ 
                          profileId: profile.id, 
                          isVerified: !profile.isVerified 
                        })}
                        disabled={verifyProfileMutation.isPending}
                        data-testid={`button-verify-${profile.id}`}
                      >
                        <BadgeCheck className="w-4 h-4" />
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:bg-destructive/10"
                        onClick={() => {
                          if (confirm(`Sei sicuro di voler eliminare il profilo di ${profile.name}?`)) {
                            deleteProfileMutation.mutate(profile.id);
                          }
                        }}
                        disabled={deleteProfileMutation.isPending}
                        data-testid={`button-delete-${profile.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}

                  {(!profiles || profiles.length === 0) && (
                    <div className="text-center py-8 text-muted-foreground">
                      Nessun profilo trovato
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Utenti Registrati</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {users?.map((u) => (
                  <div
                    key={u.id}
                    className="flex items-center gap-4 p-3 rounded-lg bg-card border border-border"
                    data-testid={`user-row-${u.id}`}
                  >
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={u.profileImageUrl || undefined} alt={u.firstName || "User"} />
                      <AvatarFallback>{(u.firstName?.[0] || u.email?.[0] || "U").toUpperCase()}</AvatarFallback>
                    </Avatar>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-foreground truncate">
                          {u.firstName && u.lastName ? `${u.firstName} ${u.lastName}` : u.email || "Utente"}
                        </h3>
                        {u.isAdmin && (
                          <Badge className="bg-purple-500">Admin</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {u.email || "Nessuna email"}
                      </p>
                    </div>

                    <span className="text-xs text-muted-foreground">
                      {u.createdAt ? new Date(u.createdAt).toLocaleDateString("it-IT") : "N/A"}
                    </span>
                  </div>
                ))}

                {(!users || users.length === 0) && (
                  <div className="text-center py-8 text-muted-foreground">
                    Nessun utente trovato
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

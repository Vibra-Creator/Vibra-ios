import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Users, Heart, MessageCircle, UserCheck, Trash2, Shield, ArrowLeft, BadgeCheck, RotateCcw, AlertTriangle, Ban, Filter, Flag, Eye, CheckCircle, XCircle, Plus, X, ChevronDown, ChevronUp, Mail, Phone, MapPin, Calendar, Ruler, BookOpen, Globe, Star, MessageSquare, UserPlus, Gift, Database, Download, Loader2, FileText, Crown, Upload, Send, EyeOff, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { User, Profile, Report, UserSuspension, BannedWord, RoomMessage, ChallengeSubmission } from "@shared/schema";

interface AdminStats {
  totalUsers: number;
  totalProfiles: number;
  totalMatches: number;
  totalMessages: number;
  realSubscriberCount: number;
  recentUsers: User[];
}

interface ChatMessage {
  id: string;
  matchId: string;
  senderId: string;
  content: string;
  createdAt: string;
  read: boolean;
  senderName: string;
  senderImage: string | null;
  receiverName: string;
  receiverImage: string | null;
}

export default function Admin() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [suspendUserId, setSuspendUserId] = useState("");
  const [suspendReason, setSuspendReason] = useState("");
  const [suspendPermanent, setSuspendPermanent] = useState(false);
  const [newBannedWord, setNewBannedWord] = useState("");
  const [expandedProfile, setExpandedProfile] = useState<string | null>(null);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [videoUploadState, setVideoUploadState] = useState<Record<string, "idle" | "uploading">>({});
  const videoInputRef = useRef<HTMLInputElement>(null);
  const [videoUploadTarget, setVideoUploadTarget] = useState<string | null>(null);
  const [resetPwUserId, setResetPwUserId] = useState<string | null>(null);
  const [resetPwValue, setResetPwValue] = useState("");
  const [changeEmailUserId, setChangeEmailUserId] = useState<string | null>(null);
  const [changeEmailValue, setChangeEmailValue] = useState("");
  const [customEmailSubject, setCustomEmailSubject] = useState("");
  const [customEmailBody, setCustomEmailBody] = useState("");
  const [showEmailPreview, setShowEmailPreview] = useState(false);
  const [profileSearch, setProfileSearch] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: stats, isLoading: statsLoading, error: statsError } = useQuery<AdminStats>({
    queryKey: ["/api/admin/stats"],
  });

  const { data: profiles, isLoading: profilesLoading } = useQuery<Profile[]>({
    queryKey: ["/api/admin/profiles"],
  });

  const { data: users } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
  });

  const { data: reports } = useQuery<Report[]>({
    queryKey: ["/api/admin/reports"],
  });

  const { data: suspensions } = useQuery<UserSuspension[]>({
    queryKey: ["/api/admin/suspensions"],
  });

  const { data: bannedWordsList } = useQuery<BannedWord[]>({
    queryKey: ["/api/admin/banned-words"],
  });

  const { data: roomMessages } = useQuery<RoomMessage[]>({
    queryKey: ["/api/admin/room-messages"],
  });

  const { data: chatMessages } = useQuery<ChatMessage[]>({
    queryKey: ["/api/admin/chat-messages"],
  });

  const { data: submissions } = useQuery<ChallengeSubmission[]>({
    queryKey: ["/api/admin/challenge-submissions"],
  });

  const { data: referralStats } = useQuery<any[]>({
    queryKey: ["/api/admin/referrals"],
  });

  const { data: allCodes } = useQuery<any[]>({
    queryKey: ["/api/admin/all-codes"],
  });

  const { data: appSettingsData } = useQuery<Record<string, string>>({
    queryKey: ["/api/admin/settings"],
  });

  const updateSettingMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: number }) =>
      apiRequest("PUT", "/api/admin/settings", { key, value }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settings"] });
      toast({ title: "Impostazione salvata!", description: "La percentuale è stata aggiornata." });
    },
    onError: () => {
      toast({ title: "Errore", description: "Impossibile salvare l'impostazione", variant: "destructive" });
    },
  });

  const { data: expandedProfileVideos = [] } = useQuery<any[]>({
    queryKey: ["/api/admin/profiles", expandedProfile, "videos"],
    enabled: !!expandedProfile,
  });

  const { data: backups, isLoading: backupsLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/backups"],
  });

  const createBackupMutation = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/admin/backups/create"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/backups"] });
      toast({ title: "Backup completato!", description: "Il backup del database è stato creato con successo." });
    },
    onError: () => {
      toast({ title: "Errore", description: "Impossibile creare il backup", variant: "destructive" });
    },
  });

  const sendWelcomeEmailsMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/admin/send-welcome-emails");
    },
    onSuccess: (data: any) => {
      toast({ title: "Email di benvenuto inviate!", description: `Inviate: ${data.sent}, Fallite: ${data.failed}, Totale: ${data.total}` });
    },
    onError: () => {
      toast({ title: "Errore", description: "Impossibile inviare le email di benvenuto", variant: "destructive" });
    },
  });

  const handleSendEmails = () => {
    if (sendWelcomeEmailsMutation.isPending) return;
    const confirmed = window.confirm(
      `Stai per inviare l'email di benvenuto a ${realSubscriberCount} iscritti reali. L'invio può richiedere fino a 30 secondi. Continuare?`
    );
    if (confirmed) {
      sendWelcomeEmailsMutation.mutate();
    }
  };

  const sendCustomEmailMutation = useMutation({
    mutationFn: async ({ subject, htmlBody }: { subject: string; htmlBody: string }) => {
      return await apiRequest("POST", "/api/admin/send-custom-email", { subject, htmlBody });
    },
    onSuccess: (data: any) => {
      toast({ title: "Email personalizzata inviata!", description: `Inviate: ${data.sent}, Fallite: ${data.failed}, Totale: ${data.total}` });
    },
    onError: () => {
      toast({ title: "Errore", description: "Impossibile inviare l'email personalizzata", variant: "destructive" });
    },
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      setCustomEmailBody(content);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleSendCustomEmail = () => {
    if (sendCustomEmailMutation.isPending) return;
    if (!customEmailSubject.trim()) {
      toast({ title: "Errore", description: "Inserisci un oggetto per l'email", variant: "destructive" });
      return;
    }
    if (!customEmailBody.trim()) {
      toast({ title: "Errore", description: "Il corpo dell'email è vuoto", variant: "destructive" });
      return;
    }
    const confirmed = window.confirm(
      `Stai per inviare l'email "${customEmailSubject}" a ${realSubscriberCount} iscritti reali. Continuare?`
    );
    if (confirmed) {
      sendCustomEmailMutation.mutate({ subject: customEmailSubject, htmlBody: customEmailBody });
    }
  };

  const downloadCSV = (filename: string, content: string) => {
    const bom = "\uFEFF";
    const blob = new Blob([bom + content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const generateFullReport = () => {
    if (!referralStats || referralStats.length === 0) return;
    const discountPct = appSettingsData?.referral_discount_percent || "10";
    const commissionPct = appSettingsData?.referral_commission_percent || "15";
    let csv = "REPORT REFERRAL VIBRA\n";
    csv += `Data Report;${new Date().toLocaleString("it-IT")}\n`;
    csv += `Sconto Invitato;${discountPct}%\n`;
    csv += `Commissione Procacciatore;${commissionPct}%\n\n`;
    csv += "Procacciatore;Codice;Tot. Invitati;Abbonati;Commissione Dovuta\n";
    for (const r of referralStats) {
      csv += `${r.name};${r.code};${r.totalReferred};${r.paidReferred};Da calcolare\n`;
    }
    csv += `\n\nDETTAGLIO PER PROCACCIATORE\n`;
    for (const r of referralStats) {
      csv += `\n--- ${r.name} (${r.code}) ---\n`;
      csv += "Nome Invitato;Email;Data Registrazione;Ha Pagato\n";
      for (const u of r.referredUsers) {
        csv += `${u.name || "N/A"};${u.email};${new Date(u.createdAt).toLocaleDateString("it-IT")};${u.hasPaid ? "Si" : "No"}\n`;
      }
    }
    downloadCSV(`report-referral-vibra-${new Date().toISOString().slice(0, 10)}.csv`, csv);
    toast({ title: "Report scaricato!", description: "Il file CSV è stato generato con successo." });
  };

  const generateSingleReport = (referrer: any) => {
    const discountPct = appSettingsData?.referral_discount_percent || "10";
    const commissionPct = appSettingsData?.referral_commission_percent || "15";
    let csv = `REPORT PROCACCIATORE - ${referrer.name}\n`;
    csv += `Data Report;${new Date().toLocaleString("it-IT")}\n`;
    csv += `Codice Referral;${referrer.code}\n`;
    csv += `Totale Invitati;${referrer.totalReferred}\n`;
    csv += `Abbonati;${referrer.paidReferred}\n`;
    csv += `Sconto Invitato;${discountPct}%\n`;
    csv += `Commissione Procacciatore;${commissionPct}%\n\n`;
    csv += "Nome Invitato;Email;Data Registrazione;Ha Pagato\n";
    for (const u of referrer.referredUsers) {
      csv += `${u.name || "N/A"};${u.email};${new Date(u.createdAt).toLocaleDateString("it-IT")};${u.hasPaid ? "Si" : "No"}\n`;
    }
    downloadCSV(`report-${referrer.name.replace(/\s+/g, "-").toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`, csv);
    toast({ title: "Report scaricato!", description: `Report di ${referrer.name} generato.` });
  };

  async function handleAdminVideoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    (e.target as HTMLInputElement).value = "";
    const profileId = videoUploadTarget;
    if (!profileId) return;

    if (file.size > 50 * 1024 * 1024) {
      toast({ title: "Video troppo grande", description: "Max 50MB", variant: "destructive" });
      return;
    }

    setVideoUploadState(s => ({ ...s, [profileId]: "uploading" }));
    try {
      const formData = new FormData();
      formData.append("video", file);

      const res = await fetch(`/api/admin/profiles/${profileId}/videos`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(errData?.error || `Errore ${res.status}`);
      }

      queryClient.invalidateQueries({ queryKey: ["/api/admin/profiles", profileId, "videos"] });
      toast({ title: "Video caricato!", description: "Il video è stato aggiunto al profilo." });
    } catch (err: any) {
      const msg = err?.message || "";
      console.error("[admin-upload] Error:", err);
      toast({ title: "Errore upload", description: msg || "Impossibile caricare il video.", variant: "destructive" });
    } finally {
      setVideoUploadState(s => ({ ...s, [profileId]: "idle" }));
      setVideoUploadTarget(null);
    }
  }

  const deleteAdminVideoMutation = useMutation({
    mutationFn: ({ profileId, videoId }: { profileId: string; videoId: string }) =>
      apiRequest("DELETE", `/api/admin/profiles/${profileId}/videos/${videoId}`),
    onSuccess: (_data, { profileId }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/profiles", profileId, "videos"] });
      toast({ title: "Video eliminato" });
    },
    onError: () => {
      toast({ title: "Errore eliminazione", variant: "destructive" });
    },
  });

  const deleteProfileMutation = useMutation({
    mutationFn: async (profileId: string) => apiRequest("DELETE", `/api/admin/profiles/${profileId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/profiles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.removeQueries({ queryKey: ["/api/profiles/swipable"] });
      queryClient.removeQueries({ queryKey: ["/api/profiles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/matches"] });
      toast({ title: "Profilo eliminato" });
    },
    onError: (err: any) => {
      toast({ title: "Errore eliminazione", description: err?.message || "Si è verificato un errore", variant: "destructive" });
    },
  });

  const verifyProfileMutation = useMutation({
    mutationFn: async ({ profileId, isVerified }: { profileId: string; isVerified: boolean }) =>
      apiRequest("PATCH", `/api/admin/profiles/${profileId}/verify`, { isVerified }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/profiles"] });
      toast({ title: "Stato verifica aggiornato" });
    },
  });

  const highlightProfileMutation = useMutation({
    mutationFn: async ({ profileId, days }: { profileId: string; days: number }) =>
      apiRequest("PATCH", `/api/admin/profiles/${profileId}/highlight`, { days }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/profiles"] });
      toast({ title: "Evidenziazione aggiornata" });
    },
  });

  const resetTestDataMutation = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/admin/reset-test-data") as Promise<{ deleted: { swipes: number; matches: number; messages: number } }>,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/profiles"] });
      toast({ title: "Dati di test resettati!", description: `Eliminati: ${data.deleted.swipes} swipe, ${data.deleted.matches} match, ${data.deleted.messages} messaggi` });
    },
  });

  const changeEmailMutation = useMutation({
    mutationFn: async ({ userId, newEmail }: { userId: string; newEmail: string }) =>
      apiRequest("POST", "/api/admin/change-email", { userId, newEmail }),
    onSuccess: () => {
      setChangeEmailUserId(null);
      setChangeEmailValue("");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Email aggiornata con successo!" });
    },
    onError: () => {
      toast({ title: "Errore: email già in uso o non valida", variant: "destructive" });
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async ({ userId, newPassword }: { userId: string; newPassword: string }) =>
      apiRequest("POST", "/api/admin/reset-password", { userId, newPassword }),
    onSuccess: () => {
      setResetPwUserId(null);
      setResetPwValue("");
      toast({ title: "Password resettata con successo!" });
    },
    onError: () => {
      toast({ title: "Errore nel reset della password", variant: "destructive" });
    },
  });

  const updateReportMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) =>
      apiRequest("PATCH", `/api/admin/reports/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/reports"] });
      toast({ title: "Segnalazione aggiornata" });
    },
  });

  const suspendUserMutation = useMutation({
    mutationFn: async (data: { userId: string; reason: string; isPermanent: boolean }) =>
      apiRequest("POST", "/api/admin/suspensions", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/suspensions"] });
      setSuspendUserId("");
      setSuspendReason("");
      setSuspendPermanent(false);
      toast({ title: "Utente sospeso" });
    },
  });

  const liftSuspensionMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/admin/suspensions/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/suspensions"] });
      toast({ title: "Sospensione rimossa" });
    },
  });

  const addBannedWordMutation = useMutation({
    mutationFn: async (word: string) => apiRequest("POST", "/api/admin/banned-words", { word }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/banned-words"] });
      setNewBannedWord("");
      toast({ title: "Parola aggiunta alla lista" });
    },
  });

  const removeBannedWordMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/admin/banned-words/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/banned-words"] });
      toast({ title: "Parola rimossa" });
    },
  });

  const deleteRoomMessageMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/admin/room-messages/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/room-messages"] });
      toast({ title: "Messaggio eliminato" });
    },
  });

  const deleteChatMessageMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/admin/chat-messages/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/chat-messages"] });
      toast({ title: "Messaggio chat eliminato" });
    },
  });

  const reviewSubmissionMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) =>
      apiRequest("PATCH", `/api/admin/challenge-submissions/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/challenge-submissions"] });
      toast({ title: "Foto revisata" });
    },
  });

  const deleteSubmissionMutation = useMutation({
    mutationFn: async (id: string) =>
      apiRequest("DELETE", `/api/admin/challenge-submissions/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/challenge-submissions"] });
      toast({ title: "Foto eliminata definitivamente" });
    },
  });

  if (statsError) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center">
            <Shield className="w-16 h-16 mx-auto mb-4 text-destructive" />
            <h2 className="text-xl font-semibold mb-2">Accesso Negato</h2>
            <p className="text-muted-foreground mb-4">Non hai i permessi per accedere alla dashboard admin.</p>
            <Button onClick={() => setLocation("/")} data-testid="button-back-home">Torna alla Home</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const pendingReports = reports?.filter(r => r.status === "pending") || [];
  const activeSuspensions = suspensions?.filter(s => s.isActive) || [];
  const pendingSubmissions = submissions?.filter(s => s.status === "pending") || [];

  const realSubscriberCount = stats?.realSubscriberCount || 0;

  const statCards = [
    { label: "Iscritti Reali", value: realSubscriberCount, icon: Users, color: "from-blue-500 to-cyan-500" },
    { label: "Profili", value: stats?.totalProfiles || 0, icon: UserCheck, color: "from-purple-500 to-pink-500" },
    { label: "Match", value: stats?.totalMatches || 0, icon: Heart, color: "from-pink-500 to-red-500" },
    { label: "Messaggi", value: stats?.totalMessages || 0, icon: MessageCircle, color: "from-green-500 to-emerald-500" },
    { label: "Segnalazioni", value: pendingReports.length, icon: Flag, color: "from-orange-500 to-red-500" },
    { label: "Sospesi", value: activeSuspensions.length, icon: Ban, color: "from-red-500 to-rose-500" },
  ];

  const getProfileName = (profileId: string) => {
    const p = profiles?.find(pr => pr.id === profileId);
    return p ? p.name : profileId;
  };

  const getUserEmail = (userId: string) => {
    const u = users?.find(usr => usr.id === userId);
    return u ? (u.email || `${u.firstName} ${u.lastName}`) : userId;
  };

  const getUserForProfile = (profile: Profile) => {
    return users?.find(u => u.id === profile.userId);
  };

  const renderProfileDetail = (label: string, value: string | number | null | undefined) => {
    if (!value) return null;
    return (
      <div className="flex justify-between py-1 border-b border-border/30">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-xs text-foreground font-medium">{value}</span>
      </div>
    );
  };

  return (
    <div className="flex-1 p-2 sm:p-4 md:p-6 w-full max-w-7xl mx-auto overflow-y-auto overflow-x-hidden">
      <div className="fixed inset-0 z-0">
        <img src="/backgrounds/vibra-couple-rose.png" alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/40 to-black/60" />
      </div>
      <div className="relative z-10">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/")} data-testid="button-back">
            <ArrowLeft className="w-5 h-5 text-white" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
            <p className="text-sm text-white/60">Gestisci e modera l'app Vibra</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
          {statCards.map((stat, index) => (
            <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}>
              <Card className="hover-elevate">
                <CardContent className="p-3 md:p-4">
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${stat.color} flex items-center justify-center flex-shrink-0`}>
                      <stat.icon className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <p className="text-xl font-bold text-foreground">{stat.value}</p>
                      <p className="text-xs text-muted-foreground">{stat.label}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        <Card className="mb-6">
          <CardContent className="p-4 flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h3 className="font-semibold text-foreground">Reset Dati di Test</h3>
              <p className="text-sm text-muted-foreground">Resetta swipe, match e messaggi dei profili di test</p>
            </div>
            <Button variant="outline" onClick={() => resetTestDataMutation.mutate()} disabled={resetTestDataMutation.isPending} data-testid="button-reset-test-data">
              <RotateCcw className="w-4 h-4 mr-2" />
              {resetTestDataMutation.isPending ? "Resettando..." : "Reset Test Data"}
            </Button>
          </CardContent>
        </Card>

        <Tabs defaultValue="profiles" className="w-full">
          <TabsList className="mb-4 flex-wrap h-auto gap-1">
            <TabsTrigger value="profiles" data-testid="tab-profiles">Profili</TabsTrigger>
            <TabsTrigger value="users" data-testid="tab-users">Utenti</TabsTrigger>
            <TabsTrigger value="reports" data-testid="tab-reports">
              Segnalazioni {pendingReports.length > 0 && <Badge variant="destructive" className="ml-1">{pendingReports.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="suspensions" data-testid="tab-suspensions">Sospensioni</TabsTrigger>
            <TabsTrigger value="chat" data-testid="tab-chat">Chat Private</TabsTrigger>
            <TabsTrigger value="messages" data-testid="tab-messages">Msg Stanze</TabsTrigger>
            <TabsTrigger value="photos" data-testid="tab-photos">
              Foto {pendingSubmissions.length > 0 && <Badge variant="destructive" className="ml-1">{pendingSubmissions.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="words" data-testid="tab-words">Filtro Parole</TabsTrigger>
            <TabsTrigger value="referrals" data-testid="tab-referrals">
              <UserPlus className="w-3 h-3 mr-1" />
              Referral {referralStats && referralStats.length > 0 && <Badge variant="secondary" className="ml-1">{referralStats.reduce((a: number, r: any) => a + r.totalReferred, 0)}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="backups" data-testid="tab-backups">
              <Database className="w-3 h-3 mr-1" />
              Backup
            </TabsTrigger>
            <TabsTrigger value="email" data-testid="tab-email">
              <Mail className="w-4 h-4 mr-1" />
              Email {realSubscriberCount > 0 && <Badge variant="secondary" className="ml-1">{realSubscriberCount}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="positions" data-testid="tab-positions">
              <MapPin className="w-3 h-3 mr-1" />
              Posizioni
            </TabsTrigger>
          </TabsList>

          {/* PROFILI TAB */}
          <TabsContent value="profiles">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Gestione Profili ({profiles?.length || 0})</CardTitle>
                <div className="relative mt-2">
                  <input
                    type="text"
                    placeholder="Cerca per nome, email, città, tipo alieno…"
                    value={profileSearch}
                    onChange={e => setProfileSearch(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg pl-9 pr-4 py-2 text-sm text-foreground placeholder-muted-foreground outline-none focus:border-primary/50"
                    data-testid="input-profile-search"
                  />
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                  {profileSearch && (
                    <button onClick={() => setProfileSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {(profileSearch
                    ? (profiles || []).filter(p => {
                        const q = profileSearch.toLowerCase();
                        const profileUser = getUserForProfile(p);
                        return (
                          p.name?.toLowerCase().includes(q) ||
                          p.location?.toLowerCase().includes(q) ||
                          p.alienType?.toLowerCase().includes(q) ||
                          profileUser?.email?.toLowerCase().includes(q) ||
                          p.id?.toLowerCase().includes(q)
                        );
                      })
                    : profiles || []
                  ).map((profile) => {
                    const profileUser = getUserForProfile(profile);
                    const isExpanded = expandedProfile === profile.id;
                    return (
                      <div key={profile.id} className="rounded-lg bg-card border border-border" data-testid={`profile-row-${profile.id}`}>
                        <div className="flex items-center gap-3 p-3 cursor-pointer hover:bg-accent/10" onClick={() => setExpandedProfile(isExpanded ? null : profile.id)}>
                          <Avatar className="w-10 h-10">
                            <AvatarImage src={profile.imageUrl} alt={profile.name} />
                            <AvatarFallback>{profile.name[0]}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-medium text-foreground truncate">{profile.name}, {profile.age}</h3>
                              {profile.isVerified && <BadgeCheck className="w-4 h-4 text-blue-500" />}
                              {profile.isBot && <Badge variant="secondary" className="text-xs">Bot</Badge>}
                              {profile.gender && <Badge variant="outline" className="text-xs">{profile.gender}</Badge>}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              <span className="text-xs text-muted-foreground">{profile.alienType}</span>
                              {profile.location && <span className="text-xs text-muted-foreground">- {profile.location}</span>}
                              {profileUser?.email && <span className="text-xs text-cyan-400">{profileUser.email}</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-0 shrink-0">
                            {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                            <Button variant="ghost" size="icon" className={`h-8 w-8 ${profile.isVerified ? "text-blue-500" : "text-muted-foreground"}`} onClick={(e) => { e.stopPropagation(); verifyProfileMutation.mutate({ profileId: profile.id, isVerified: !profile.isVerified }); }} data-testid={`button-verify-${profile.id}`}>
                              <BadgeCheck className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className={`h-8 w-8 ${profile.highlightedUntil && new Date(profile.highlightedUntil) > new Date() ? "text-yellow-400" : "text-muted-foreground"}`} onClick={(e) => { e.stopPropagation(); const isHighlighted = profile.highlightedUntil && new Date(profile.highlightedUntil) > new Date(); highlightProfileMutation.mutate({ profileId: profile.id, days: isHighlighted ? 0 : 7 }); }} data-testid={`button-highlight-${profile.id}`} title={profile.highlightedUntil && new Date(profile.highlightedUntil) > new Date() ? "Rimuovi evidenziazione" : "Evidenzia per 7 giorni"}>
                              <Crown className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={(e) => { e.stopPropagation(); setLocation(`/profile/edit/${profile.id}`); }} data-testid={`button-edit-${profile.id}`} title="Modifica profilo">
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={(e) => { e.stopPropagation(); if (confirm(`Eliminare il profilo di ${profile.name}?`)) deleteProfileMutation.mutate(profile.id); }} data-testid={`button-delete-${profile.id}`}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="px-4 pb-4 border-t border-border/50">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-3">
                              <div>
                                <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1"><Mail className="w-3 h-3" /> Contatti</h4>
                                {renderProfileDetail("Email", profileUser?.email)}
                                {renderProfileDetail("Telefono", profile.phoneNumber ? `${profile.phonePrefix || ""}${profile.phoneNumber}` : null)}
                                {renderProfileDetail("Città", profile.location)}
                                {renderProfileDetail("ID Utente", profile.userId?.slice(0, 12) + "...")}
                                {renderProfileDetail("Registrato", profileUser?.createdAt ? new Date(profileUser.createdAt).toLocaleString("it-IT") : null)}
                              </div>
                              <div>
                                <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1"><Eye className="w-3 h-3" /> Aspetto</h4>
                                {renderProfileDetail("Genere", profile.gender)}
                                {renderProfileDetail("Altezza", profile.height ? `${profile.height} cm` : null)}
                                {renderProfileDetail("Capelli", profile.hairColor)}
                                {renderProfileDetail("Occhi", profile.eyeColor)}
                                {renderProfileDetail("Corporatura", profile.bodyType)}
                                {renderProfileDetail("Segno Zodiacale", profile.zodiacSign)}
                              </div>
                              <div>
                                <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1"><Heart className="w-3 h-3" /> Preferenze</h4>
                                {renderProfileDetail("Cerca Genere", profile.preferredGender)}
                                {renderProfileDetail("Età Min-Max", (profile.preferredAgeMin || profile.preferredAgeMax) ? `${profile.preferredAgeMin || "?"} - ${profile.preferredAgeMax || "?"}` : null)}
                                {renderProfileDetail("Altezza Min-Max", (profile.preferredHeightMin || profile.preferredHeightMax) ? `${profile.preferredHeightMin || "?"} - ${profile.preferredHeightMax || "?"} cm` : null)}
                                {renderProfileDetail("Tipo Relazione", profile.relationshipType)}
                                {renderProfileDetail("Figli", profile.wantsChildren)}
                                {renderProfileDetail("Distanza Max", profile.maxDistanceKm ? `${profile.maxDistanceKm} km` : null)}
                              </div>
                              <div>
                                <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1"><BookOpen className="w-3 h-3" /> Altro</h4>
                                {renderProfileDetail("Istruzione", profile.education)}
                                {renderProfileDetail("Istruz. Preferita", profile.preferredEducation)}
                                {renderProfileDetail("Lingue", profile.languages?.join(", "))}
                                {renderProfileDetail("Linguaggio Amore", profile.loveLanguage)}
                                {renderProfileDetail("Stile Comunicaz.", profile.communicationStyle)}
                                {renderProfileDetail("Stile di Vita", profile.lifestyle)}
                                {renderProfileDetail("Motivazione", profile.accessMotivation)}
                              </div>
                              <div className="md:col-span-2 lg:col-span-2">
                                <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1"><Star className="w-3 h-3" /> Bio e Interessi</h4>
                                {profile.bio && <p className="text-xs text-foreground bg-accent/10 p-2 rounded mb-2">{profile.bio}</p>}
                                {profile.interests && profile.interests.length > 0 && (
                                  <div className="flex flex-wrap gap-1">
                                    {profile.interests.map((int, i) => (
                                      <Badge key={i} variant="outline" className="text-xs">{int}</Badge>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                            {profile.photos && profile.photos.length > 0 && (
                              <div className="mt-3">
                                <h4 className="text-sm font-semibold text-foreground mb-2">Galleria Foto ({profile.photos.length})</h4>
                                <div className="flex gap-2 overflow-x-auto pb-2">
                                  {profile.photos.map((photo, i) => (
                                    <img key={i} src={photo} alt={`Foto ${i + 1}`} className="w-16 h-16 rounded-lg object-cover border border-border flex-shrink-0" />
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Video management section */}
                            <div className="mt-3 border border-border/50 rounded-lg p-3 bg-muted/10">
                              <div className="flex items-center justify-between mb-2">
                                <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                                  🎬 Video ({isExpanded ? expandedProfileVideos.length : 0}/4)
                                </h4>
                                {isExpanded && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs gap-1"
                                    disabled={videoUploadState[profile.id] === "uploading"}
                                    onClick={() => {
                                      setVideoUploadTarget(profile.id);
                                      setTimeout(() => videoInputRef.current?.click(), 50);
                                    }}
                                    data-testid={`button-add-video-${profile.id}`}
                                  >
                                    {videoUploadState[profile.id] === "uploading" ? (
                                      <><Loader2 className="w-3 h-3 animate-spin" /> Caricamento...</>
                                    ) : (
                                      <><Upload className="w-3 h-3" /> Aggiungi Video</>
                                    )}
                                  </Button>
                                )}
                              </div>
                              {isExpanded && expandedProfileVideos.length > 0 ? (
                                <div className="flex gap-2 overflow-x-auto pb-1">
                                  {expandedProfileVideos.map((video: any) => (
                                    <div key={video.id} className="relative flex-shrink-0">
                                      <video
                                        src={`/api/video-stream/${video.id}`}
                                        className="w-24 h-16 rounded-lg object-cover border border-border bg-black"
                                        preload="metadata"
                                        muted
                                        playsInline
                                      />
                                      <button
                                        onClick={() => deleteAdminVideoMutation.mutate({ profileId: profile.id, videoId: video.id })}
                                        className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive text-white flex items-center justify-center hover:bg-red-700 transition-colors"
                                        data-testid={`button-delete-admin-video-${video.id}`}
                                      >
                                        <X className="w-3 h-3" />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              ) : isExpanded ? (
                                <p className="text-xs text-muted-foreground">Nessun video. Clicca "Aggiungi Video" per caricare.</p>
                              ) : null}
                            </div>

                            <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                              <span>Punti: {profile.points || 0}</span>
                              <span>|</span>
                              <span>Rating: {profile.ratingEnabled ? "Attivo" : "Disattivo"}</span>
                              <span>|</span>
                              <span>Posizione: {profile.locationSharingEnabled ? "Condivisa" : "Non condivisa"}</span>
                              {profile.profileLatitude && <span>| Coord: {profile.profileLatitude?.toFixed(2)}, {profile.profileLongitude?.toFixed(2)}</span>}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {(profileSearch
                    ? (profiles || []).filter(p => {
                        const q = profileSearch.toLowerCase();
                        const pu = getUserForProfile(p);
                        return p.name?.toLowerCase().includes(q) || p.location?.toLowerCase().includes(q) || p.alienType?.toLowerCase().includes(q) || pu?.email?.toLowerCase().includes(q) || p.id?.toLowerCase().includes(q);
                      }).length === 0
                    : (!profiles || profiles.length === 0)) && (
                    <div className="text-center py-8 text-muted-foreground">
                      {profileSearch ? `Nessun profilo trovato per "${profileSearch}"` : "Nessun profilo trovato"}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* UTENTI TAB */}
          <TabsContent value="users">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Utenti Registrati ({users?.length || 0})</CardTitle>
                <div className="relative mt-2">
                  <input
                    type="text"
                    placeholder="Cerca per nome, email, telefono, città…"
                    value={userSearch}
                    onChange={e => setUserSearch(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg pl-9 pr-4 py-2 text-sm text-foreground placeholder-muted-foreground outline-none focus:border-primary/50"
                    data-testid="input-user-search"
                  />
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                  {userSearch && (
                    <button onClick={() => setUserSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {(userSearch
                    ? (users || []).filter(u => {
                        const q = userSearch.toLowerCase();
                        const up = profiles?.find(p => p.userId === u.id);
                        return (
                          u.email?.toLowerCase().includes(q) ||
                          u.firstName?.toLowerCase().includes(q) ||
                          u.lastName?.toLowerCase().includes(q) ||
                          up?.name?.toLowerCase().includes(q) ||
                          up?.location?.toLowerCase().includes(q) ||
                          up?.phoneNumber?.toLowerCase().includes(q) ||
                          u.id?.toLowerCase().includes(q)
                        );
                      })
                    : users || []
                  ).map((u) => {
                    const userProfile = profiles?.find(p => p.userId === u.id);
                    const isExpanded = expandedUser === u.id;
                    return (
                      <div key={u.id} className="rounded-lg bg-card border border-border" data-testid={`user-row-${u.id}`}>
                        <div className="flex items-center gap-3 p-3 cursor-pointer hover:bg-accent/10" onClick={() => setExpandedUser(isExpanded ? null : u.id)}>
                          <Avatar className="w-10 h-10">
                            <AvatarImage src={userProfile?.imageUrl || u.profileImageUrl || undefined} alt={u.firstName || "User"} />
                            <AvatarFallback>{(u.firstName?.[0] || u.email?.[0] || "U").toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-medium text-foreground truncate">{userProfile?.name || (u.firstName && u.lastName ? `${u.firstName} ${u.lastName}` : "Utente")}</h3>
                              {u.isAdmin && <Badge className="bg-purple-500">Admin</Badge>}
                              {userProfile?.isVerified && <BadgeCheck className="w-4 h-4 text-blue-500" />}
                            </div>
                            <div className="flex flex-col gap-0.5 mt-0.5">
                              <p className="text-sm text-cyan-400 truncate" data-testid={`user-email-${u.id}`}>
                                {u.email || "Nessuna email"}
                              </p>
                              <div className="flex items-center gap-3 flex-wrap">
                                {userProfile?.phoneNumber && (
                                  <span className="text-xs text-muted-foreground" data-testid={`user-phone-${u.id}`}>
                                    {userProfile.phonePrefix || ""}{userProfile.phoneNumber}
                                  </span>
                                )}
                                {userProfile?.location && (
                                  <span className="text-xs text-muted-foreground">{userProfile.location}</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="text-right flex-shrink-0">
                              <span className="text-xs text-muted-foreground block">{u.createdAt ? new Date(u.createdAt).toLocaleDateString("it-IT") : "N/A"}</span>
                              {userProfile && <span className="text-xs text-muted-foreground block">{userProfile.age ? `${userProfile.age} anni` : ""}</span>}
                            </div>
                            {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="px-4 pb-4 border-t border-border/50">
                            {!userProfile && (
                              <div className="mt-3 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                                <p className="text-yellow-400 text-sm font-medium">Profilo non creato</p>
                                <p className="text-yellow-400/70 text-xs mt-1">L'utente si è registrato ma non ha completato la creazione del profilo.</p>
                                {renderProfileDetail("Email", u.email)}
                                {renderProfileDetail("Nome", u.firstName && u.lastName ? `${u.firstName} ${u.lastName}` : "Non inserito")}
                                {renderProfileDetail("Registrato il", u.createdAt ? new Date(u.createdAt).toLocaleString("it-IT") : null)}
                              </div>
                            )}
                            {userProfile && (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                                <div>
                                  <h4 className="text-sm font-semibold text-foreground mb-2">Informazioni Personali</h4>
                                  {renderProfileDetail("Email", u.email)}
                                  {renderProfileDetail("Telefono", userProfile.phoneNumber ? `${userProfile.phonePrefix || ""}${userProfile.phoneNumber}` : "Non inserito")}
                                  {renderProfileDetail("Città", userProfile.location || "Non inserita")}
                                  {renderProfileDetail("Genere", userProfile.gender || "Non specificato")}
                                  {renderProfileDetail("Età", userProfile.age ? `${userProfile.age} anni` : null)}
                                  {renderProfileDetail("Altezza", userProfile.height ? `${userProfile.height} cm` : null)}
                                  {renderProfileDetail("Tipo Alieno", userProfile.alienType)}
                                  {renderProfileDetail("Istruzione", userProfile.education)}
                                  {renderProfileDetail("Lingue", userProfile.languages?.join(", "))}
                                </div>
                                <div>
                                  <h4 className="text-sm font-semibold text-foreground mb-2">Preferenze e Ricerca</h4>
                                  {renderProfileDetail("Cerca Genere", userProfile.preferredGender || "Indifferente")}
                                  {renderProfileDetail("Età cercata", (userProfile.preferredAgeMin || userProfile.preferredAgeMax) ? `${userProfile.preferredAgeMin || "?"} - ${userProfile.preferredAgeMax || "?"} anni` : null)}
                                  {renderProfileDetail("Tipo Relazione", userProfile.relationshipType)}
                                  {renderProfileDetail("Figli", userProfile.wantsChildren)}
                                  {renderProfileDetail("Motivazione", userProfile.accessMotivation)}
                                  {renderProfileDetail("Stile di Vita", userProfile.lifestyle)}
                                  {renderProfileDetail("Punti", userProfile.points?.toString())}
                                  {renderProfileDetail("Registrato il", u.createdAt ? new Date(u.createdAt).toLocaleString("it-IT") : null)}
                                </div>
                              </div>
                            )}
                            {userProfile?.bio && (
                              <div className="mt-3">
                                <h4 className="text-sm font-semibold text-foreground mb-1">Bio</h4>
                                <p className="text-xs text-foreground bg-accent/10 p-2 rounded">{userProfile.bio}</p>
                              </div>
                            )}
                            <div className="mt-3 pt-3 border-t border-border/50 space-y-2">
                              {changeEmailUserId === u.id ? (
                                <div className="flex items-center gap-2">
                                  <Input
                                    placeholder="Nuova email"
                                    type="email"
                                    value={changeEmailValue}
                                    onChange={(e) => setChangeEmailValue(e.target.value)}
                                    className="h-8 text-sm max-w-[250px]"
                                    data-testid={`input-change-email-${u.id}`}
                                  />
                                  <Button
                                    size="sm"
                                    className="h-8"
                                    disabled={!changeEmailValue || changeEmailMutation.isPending}
                                    onClick={() => changeEmailMutation.mutate({ userId: u.id, newEmail: changeEmailValue })}
                                    data-testid={`button-confirm-change-email-${u.id}`}
                                  >
                                    {changeEmailMutation.isPending ? "..." : "Salva"}
                                  </Button>
                                  <Button size="sm" variant="ghost" className="h-8" onClick={() => { setChangeEmailUserId(null); setChangeEmailValue(""); }}>
                                    Annulla
                                  </Button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => { setChangeEmailUserId(u.id); setChangeEmailValue(u.email || ""); }} data-testid={`button-change-email-${u.id}`}>
                                    <Mail className="w-3 h-3 mr-1" /> Cambia Email
                                  </Button>
                                </div>
                              )}
                              {resetPwUserId === u.id ? (
                                <div className="flex items-center gap-2">
                                  <Input
                                    placeholder="Nuova password"
                                    value={resetPwValue}
                                    onChange={(e) => setResetPwValue(e.target.value)}
                                    className="h-8 text-sm max-w-[200px]"
                                    data-testid={`input-reset-pw-${u.id}`}
                                  />
                                  <Button
                                    size="sm"
                                    className="h-8"
                                    disabled={!resetPwValue || resetPasswordMutation.isPending}
                                    onClick={() => resetPasswordMutation.mutate({ userId: u.id, newPassword: resetPwValue })}
                                    data-testid={`button-confirm-reset-pw-${u.id}`}
                                  >
                                    {resetPasswordMutation.isPending ? "..." : "Conferma"}
                                  </Button>
                                  <Button size="sm" variant="ghost" className="h-8" onClick={() => { setResetPwUserId(null); setResetPwValue(""); }}>
                                    Annulla
                                  </Button>
                                </div>
                              ) : (
                                <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setResetPwUserId(u.id)} data-testid={`button-reset-pw-${u.id}`}>
                                  Reset Password
                                </Button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {(userSearch
                    ? (users || []).filter(u => {
                        const q = userSearch.toLowerCase();
                        const up = profiles?.find(p => p.userId === u.id);
                        return u.email?.toLowerCase().includes(q) || u.firstName?.toLowerCase().includes(q) || u.lastName?.toLowerCase().includes(q) || up?.name?.toLowerCase().includes(q) || up?.location?.toLowerCase().includes(q) || up?.phoneNumber?.toLowerCase().includes(q) || u.id?.toLowerCase().includes(q);
                      }).length === 0
                    : (!users || users.length === 0)) && (
                    <div className="text-center py-8 text-muted-foreground">
                      {userSearch ? `Nessun utente trovato per "${userSearch}"` : "Nessun utente trovato"}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* SEGNALAZIONI TAB */}
          <TabsContent value="reports">
            <Card>
              <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Flag className="w-5 h-5" /> Segnalazioni Utenti</CardTitle></CardHeader>
              <CardContent>
                {(!reports || reports.length === 0) ? (
                  <div className="text-center py-8 text-muted-foreground">Nessuna segnalazione</div>
                ) : (
                  <div className="space-y-3">
                    {reports.map((report) => (
                      <div key={report.id} className="p-4 rounded-lg bg-card border border-border" data-testid={`report-row-${report.id}`}>
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <Badge variant={report.status === "pending" ? "destructive" : "secondary"}>
                                {report.status === "pending" ? "In attesa" : report.status === "resolved" ? "Risolta" : "Archiviata"}
                              </Badge>
                              <span className="text-xs text-muted-foreground">{new Date(report.createdAt).toLocaleString("it-IT")}</span>
                            </div>
                            <p className="text-sm text-foreground"><strong>Da:</strong> {getProfileName(report.reporterId)} <strong>Contro:</strong> {getProfileName(report.reportedId)}</p>
                            <p className="text-sm text-foreground mt-1"><strong>Motivo:</strong> {report.reason}</p>
                            {report.description && <p className="text-sm text-muted-foreground mt-1">{report.description}</p>}
                          </div>
                          {report.status === "pending" && (
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" className="text-green-600" onClick={() => updateReportMutation.mutate({ id: report.id, status: "resolved" })} data-testid={`button-resolve-report-${report.id}`}>
                                <CheckCircle className="w-4 h-4 mr-1" /> Risolvi
                              </Button>
                              <Button size="sm" variant="outline" className="text-muted-foreground" onClick={() => updateReportMutation.mutate({ id: report.id, status: "dismissed" })} data-testid={`button-dismiss-report-${report.id}`}>
                                <XCircle className="w-4 h-4 mr-1" /> Archivia
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* SOSPENSIONI TAB */}
          <TabsContent value="suspensions">
            <Card className="mb-4">
              <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Ban className="w-5 h-5" /> Sospendi Utente</CardTitle></CardHeader>
              <CardContent>
                <div className="flex flex-col gap-3">
                  <div className="flex gap-2 flex-wrap">
                    <select className="flex-1 min-w-[200px] rounded-md border border-border bg-background px-3 py-2 text-sm" value={suspendUserId} onChange={(e) => setSuspendUserId(e.target.value)} data-testid="select-suspend-user">
                      <option value="">Seleziona utente...</option>
                      {users?.filter(u => !u.isAdmin).map((u) => (
                        <option key={u.id} value={u.id}>{u.email || `${u.firstName} ${u.lastName}`} ({u.id.slice(0, 8)}...)</option>
                      ))}
                    </select>
                    <Input placeholder="Motivo della sospensione" value={suspendReason} onChange={(e) => setSuspendReason(e.target.value)} className="flex-1 min-w-[200px]" data-testid="input-suspend-reason" />
                  </div>
                  <div className="flex items-center gap-4 flex-wrap">
                    <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                      <input type="checkbox" checked={suspendPermanent} onChange={(e) => setSuspendPermanent(e.target.checked)} className="rounded" />
                      Sospensione permanente
                    </label>
                    <Button onClick={() => { if (suspendUserId && suspendReason) suspendUserMutation.mutate({ userId: suspendUserId, reason: suspendReason, isPermanent: suspendPermanent }); }} disabled={!suspendUserId || !suspendReason || suspendUserMutation.isPending} data-testid="button-suspend-user">
                      <Ban className="w-4 h-4 mr-2" /> Sospendi
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-lg">Sospensioni Attive</CardTitle></CardHeader>
              <CardContent>
                {(!suspensions || suspensions.length === 0) ? (
                  <div className="text-center py-8 text-muted-foreground">Nessuna sospensione</div>
                ) : (
                  <div className="space-y-2">
                    {suspensions.map((s) => (
                      <div key={s.id} className="flex items-center justify-between gap-3 p-3 rounded-lg bg-card border border-border flex-wrap" data-testid={`suspension-row-${s.id}`}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-foreground">{getUserEmail(s.userId)}</p>
                            <Badge variant={s.isActive ? "destructive" : "secondary"}>{s.isActive ? "Attiva" : "Rimossa"}</Badge>
                            {s.isPermanent && <Badge variant="destructive">Permanente</Badge>}
                          </div>
                          <p className="text-sm text-muted-foreground">{s.reason}</p>
                          <p className="text-xs text-muted-foreground">{new Date(s.suspendedAt).toLocaleString("it-IT")}</p>
                        </div>
                        {s.isActive && (
                          <Button size="sm" variant="outline" onClick={() => liftSuspensionMutation.mutate(s.id)} data-testid={`button-lift-suspension-${s.id}`}>
                            Rimuovi
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* CHAT PRIVATE TAB */}
          <TabsContent value="chat">
            <Card>
              <CardHeader><CardTitle className="text-lg flex items-center gap-2"><MessageSquare className="w-5 h-5" /> Messaggi Chat Private (ultimi 200)</CardTitle></CardHeader>
              <CardContent>
                {(!chatMessages || chatMessages.length === 0) ? (
                  <div className="text-center py-8 text-muted-foreground">Nessun messaggio nelle chat private</div>
                ) : (
                  <div className="space-y-2 max-h-[600px] overflow-y-auto">
                    {chatMessages.map((msg) => (
                      <div key={msg.id} className="flex items-start justify-between gap-3 p-3 rounded-lg bg-card border border-border" data-testid={`chat-msg-${msg.id}`}>
                        <div className="flex items-start gap-2 flex-1 min-w-0">
                          <Avatar className="w-8 h-8 flex-shrink-0">
                            <AvatarImage src={msg.senderImage || undefined} />
                            <AvatarFallback className="text-xs">{msg.senderName?.[0] || "?"}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-sm text-foreground">{msg.senderName}</span>
                              <span className="text-xs text-muted-foreground">→</span>
                              <span className="font-medium text-sm text-cyan-400">{msg.receiverName}</span>
                              <span className="text-xs text-muted-foreground">{new Date(msg.createdAt).toLocaleString("it-IT")}</span>
                            </div>
                            <p className="text-sm text-foreground break-words mt-1">{msg.content}</p>
                          </div>
                        </div>
                        <Button variant="ghost" size="icon" className="text-destructive flex-shrink-0" onClick={() => { if (confirm("Eliminare questo messaggio?")) deleteChatMessageMutation.mutate(msg.id); }} data-testid={`button-delete-chat-${msg.id}`}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* MESSAGGI STANZE TAB */}
          <TabsContent value="messages">
            <Card>
              <CardHeader><CardTitle className="text-lg flex items-center gap-2"><MessageCircle className="w-5 h-5" /> Messaggi nelle Stanze</CardTitle></CardHeader>
              <CardContent>
                {(!roomMessages || roomMessages.length === 0) ? (
                  <div className="text-center py-8 text-muted-foreground">Nessun messaggio nelle stanze</div>
                ) : (
                  <div className="space-y-2 max-h-[500px] overflow-y-auto">
                    {roomMessages.slice(0, 100).map((msg) => (
                      <div key={msg.id} className="flex items-start justify-between gap-3 p-3 rounded-lg bg-card border border-border" data-testid={`room-msg-${msg.id}`}>
                        <div className="flex items-start gap-2 flex-1 min-w-0">
                          <Avatar className="w-8 h-8 flex-shrink-0">
                            <AvatarImage src={msg.senderImage || undefined} />
                            <AvatarFallback className="text-xs">{msg.senderName[0]}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-sm text-foreground">{msg.senderName}</span>
                              <span className="text-xs text-muted-foreground">{new Date(msg.createdAt).toLocaleString("it-IT")}</span>
                            </div>
                            <p className="text-sm text-foreground break-words">{msg.content}</p>
                          </div>
                        </div>
                        <Button variant="ghost" size="icon" className="text-destructive flex-shrink-0" onClick={() => { if (confirm("Eliminare questo messaggio?")) deleteRoomMessageMutation.mutate(msg.id); }} data-testid={`button-delete-msg-${msg.id}`}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* FOTO MODERAZIONE TAB */}
          <TabsContent value="photos">
            <Card>
              <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Eye className="w-5 h-5" /> Moderazione Foto Sfide</CardTitle></CardHeader>
              <CardContent>
                {(!submissions || submissions.length === 0) ? (
                  <div className="text-center py-8 text-muted-foreground">Nessuna foto da moderare</div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {submissions.map((sub) => (
                      <div key={sub.id} className="rounded-lg bg-card border border-border overflow-hidden" data-testid={`submission-row-${sub.id}`}>
                        <div className="aspect-video relative">
                          <img src={sub.imageUrl} alt="Submission" className="w-full h-full object-cover" />
                          <Badge className="absolute top-2 right-2" variant={sub.status === "pending" ? "destructive" : sub.status === "approved" ? "default" : "secondary"}>
                            {sub.status === "pending" ? "In attesa AI ok" : sub.status === "approved" ? "Approvata" : "Rifiutata"}
                          </Badge>
                        </div>
                        <div className="p-3">
                          <p className="text-sm text-foreground"><strong>Profilo:</strong> {getProfileName(sub.profileId)}</p>
                          <p className="text-xs text-muted-foreground">{new Date(sub.createdAt).toLocaleString("it-IT")}</p>
                          {sub.status === "pending" && (
                            <div className="flex gap-2 mt-2">
                              <Button size="sm" className="flex-1" onClick={() => reviewSubmissionMutation.mutate({ id: sub.id, status: "approved" })} data-testid={`button-approve-${sub.id}`}>
                                <CheckCircle className="w-4 h-4 mr-1" /> Approva
                              </Button>
                              <Button size="sm" variant="destructive" className="flex-1" onClick={() => reviewSubmissionMutation.mutate({ id: sub.id, status: "rejected" })} data-testid={`button-reject-${sub.id}`}>
                                <XCircle className="w-4 h-4 mr-1" /> Rifiuta
                              </Button>
                            </div>
                          )}
                          <div className="flex gap-2 mt-2">
                            <Button size="sm" variant="destructive" className="flex-1" onClick={() => { if (confirm("Eliminare definitivamente questa foto e la submission?")) deleteSubmissionMutation.mutate(sub.id); }} data-testid={`button-delete-submission-${sub.id}`}>
                              <Trash2 className="w-4 h-4 mr-1" /> Elimina
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* FILTRO PAROLE TAB */}
          <TabsContent value="words">
            <Card>
              <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Filter className="w-5 h-5" /> Filtro Parole Vietate</CardTitle></CardHeader>
              <CardContent>
                <div className="flex gap-2 mb-4">
                  <Input placeholder="Aggiungi parola vietata..." value={newBannedWord} onChange={(e) => setNewBannedWord(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && newBannedWord.trim()) addBannedWordMutation.mutate(newBannedWord.trim()); }} data-testid="input-banned-word" />
                  <Button onClick={() => { if (newBannedWord.trim()) addBannedWordMutation.mutate(newBannedWord.trim()); }} disabled={!newBannedWord.trim()} data-testid="button-add-banned-word">
                    <Plus className="w-4 h-4 mr-1" /> Aggiungi
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {bannedWordsList?.map((bw) => (
                    <Badge key={bw.id} variant="secondary" className="gap-1 pr-1" data-testid={`banned-word-${bw.id}`}>
                      {bw.word}
                      <button onClick={() => removeBannedWordMutation.mutate(bw.id)} className="ml-1 rounded-full p-0.5 hover:bg-destructive/20" data-testid={`button-remove-word-${bw.id}`}>
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                  {(!bannedWordsList || bannedWordsList.length === 0) && <p className="text-sm text-muted-foreground">Nessuna parola nella lista</p>}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="referrals">
            <Card className="mb-4">
              <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Gift className="w-5 h-5" /> Impostazioni Percentuali</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">Imposta le percentuali per il sistema referral. Le modifiche hanno effetto immediato.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="border rounded-lg p-4 space-y-3" data-testid="setting-discount">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="secondary" className="text-xs">Invitato</Badge>
                      <p className="font-semibold">Sconto Utente Invitato</p>
                    </div>
                    <p className="text-xs text-muted-foreground">Chi si registra con un codice referral riceve questo sconto sull'abbonamento</p>
                    <div className="flex items-center gap-3">
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="1"
                        value={appSettingsData?.referral_discount_percent || "10"}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          if (!isNaN(val) && val >= 0 && val <= 100) {
                            updateSettingMutation.mutate({ key: "referral_discount_percent", value: val });
                          }
                        }}
                        className="w-24 text-center font-bold text-lg"
                        data-testid="input-discount-percent"
                      />
                      <span className="text-2xl font-bold text-muted-foreground">%</span>
                    </div>
                  </div>
                  <div className="border rounded-lg p-4 space-y-3" data-testid="setting-commission">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="default" className="text-xs">Procacciatore</Badge>
                      <p className="font-semibold">Commissione Procacciatore</p>
                    </div>
                    <p className="text-xs text-muted-foreground">Chi invita altri utenti guadagna questa percentuale su ogni abbonamento</p>
                    <div className="flex items-center gap-3">
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="1"
                        value={appSettingsData?.referral_commission_percent || "15"}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          if (!isNaN(val) && val >= 0 && val <= 100) {
                            updateSettingMutation.mutate({ key: "referral_commission_percent", value: val });
                          }
                        }}
                        className="w-24 text-center font-bold text-lg"
                        data-testid="input-commission-percent"
                      />
                      <span className="text-2xl font-bold text-muted-foreground">%</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {allCodes && allCodes.length > 0 && (
              <Card className="mb-4">
                <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Users className="w-5 h-5" /> Codici Utenti ({allCodes.length})</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {allCodes.map((user: any) => (
                      <div key={user.profileId} className="flex items-center justify-between p-2 bg-muted/30 rounded-lg text-sm" data-testid={`code-${user.profileId}`}>
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium">{user.name}</span>
                          <span className="text-muted-foreground">{user.email}</span>
                        </div>
                        <span className="font-mono font-bold text-primary">{user.referralCode}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2"><UserPlus className="w-5 h-5" /> Procacciatori & Referral</CardTitle>
                  {referralStats && referralStats.length > 0 && (
                    <Button size="sm" variant="outline" onClick={generateFullReport} data-testid="button-download-full-report">
                      <FileText className="w-4 h-4 mr-1" /> Scarica Report Completo
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {referralStats && referralStats.length > 0 ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-3 mb-4">
                      <div className="bg-muted/50 rounded-lg p-3 text-center">
                        <p className="text-2xl font-bold">{referralStats.length}</p>
                        <p className="text-xs text-muted-foreground">Procacciatori</p>
                      </div>
                      <div className="bg-muted/50 rounded-lg p-3 text-center">
                        <p className="text-2xl font-bold">{referralStats.reduce((a: number, r: any) => a + r.totalReferred, 0)}</p>
                        <p className="text-xs text-muted-foreground">Totale Invitati</p>
                      </div>
                      <div className="bg-muted/50 rounded-lg p-3 text-center">
                        <p className="text-2xl font-bold">{referralStats.reduce((a: number, r: any) => a + r.paidReferred, 0)}</p>
                        <p className="text-xs text-muted-foreground">Abbonati</p>
                      </div>
                    </div>
                    {referralStats.map((referrer: any) => (
                      <div key={referrer.profileId} className="border rounded-lg p-4 space-y-3" data-testid={`referrer-${referrer.profileId}`}>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-bold text-lg">{referrer.name}</p>
                            <p className="text-sm text-muted-foreground">Codice: <span className="font-mono font-bold">{referrer.code}</span></p>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="text-right">
                              <Badge variant="secondary" className="mb-1">{referrer.totalReferred} invitati</Badge>
                              {referrer.paidReferred > 0 && <Badge variant="default" className="ml-1">{referrer.paidReferred} abbonati</Badge>}
                            </div>
                            <Button size="sm" variant="ghost" onClick={() => generateSingleReport(referrer)} title="Scarica report" data-testid={`button-report-${referrer.profileId}`}>
                              <FileText className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                        {referrer.referredUsers.length > 0 && (
                          <div className="space-y-2 pl-4 border-l-2 border-primary/30">
                            {referrer.referredUsers.map((u: any, idx: number) => (
                              <div key={idx} className="flex items-center justify-between text-sm py-1">
                                <div>
                                  <span className="font-medium">{u.name || "N/A"}</span>
                                  <span className="text-muted-foreground ml-2">{u.email}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-muted-foreground">{new Date(u.createdAt).toLocaleDateString("it-IT")}</span>
                                  <Badge variant={u.hasPaid ? "default" : "outline"} className="text-xs">
                                    {u.hasPaid ? "Pagato" : "Non pagato"}
                                  </Badge>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">Nessun referral registrato</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="backups">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2"><Database className="w-5 h-5" /> Backup Database</CardTitle>
                  <Button onClick={() => createBackupMutation.mutate()} disabled={createBackupMutation.isPending} data-testid="button-create-backup">
                    {createBackupMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Download className="w-4 h-4 mr-1" />}
                    {createBackupMutation.isPending ? "Creazione..." : "Crea Backup Ora"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Il backup automatico viene eseguito ogni 24 ore. I dati vengono salvati nell'Object Storage cloud. Vengono mantenuti gli ultimi 7 backup.
                </p>
                {backupsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : backups && backups.length > 0 ? (
                  <div className="space-y-2">
                    {backups.map((backup: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border" data-testid={`backup-item-${idx}`}>
                        <div className="flex items-center gap-3">
                          <Database className="w-5 h-5 text-primary" />
                          <div>
                            <p className="font-medium text-sm">{backup.name.split("/").pop()}</p>
                            <p className="text-xs text-muted-foreground">
                              {backup.date !== "unknown" ? new Date(backup.date).toLocaleString("it-IT", { dateStyle: "medium", timeStyle: "short" }) : "Data sconosciuta"}
                            </p>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {backup.size ? `${(backup.size / 1024 / 1024).toFixed(2)} MB` : "N/A"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Database className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
                    <p className="text-muted-foreground">Nessun backup disponibile</p>
                    <p className="text-xs text-muted-foreground mt-1">Il primo backup automatico verrà creato entro 1 minuto dall'avvio</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="email">
            {(() => {
              const realProfileMap = new Map(
                (profiles || []).filter((p: Profile) => !p.isBot).map((p: Profile) => [p.userId, p])
              );
              const emailRecipients = (users || []).filter((u: User) => {
                return realProfileMap.has(String(u.id)) && u.email && !u.email.endsWith("@vibra.com") && !u.isAdmin;
              });
              return (
                <>
                  <Card className="mb-4">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg flex items-center gap-2"><Send className="w-5 h-5" /> Invia Email Personalizzata</CardTitle>
                        <Badge className="text-sm bg-purple-500/20 text-purple-400 border-purple-500/30">
                          {realSubscriberCount} destinatari
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div>
                          <label className="text-sm font-medium text-foreground mb-1 block">Oggetto</label>
                          <Input
                            data-testid="input-custom-email-subject"
                            placeholder="Es: Novità su Vibra 🚀"
                            value={customEmailSubject}
                            onChange={e => setCustomEmailSubject(e.target.value)}
                          />
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-sm font-medium text-foreground">Corpo HTML</label>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                data-testid="button-upload-html"
                                onClick={() => fileInputRef.current?.click()}
                                className="text-xs"
                              >
                                <Upload className="w-3 h-3 mr-1" /> Carica file HTML
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                data-testid="button-toggle-preview"
                                onClick={() => setShowEmailPreview(p => !p)}
                                className="text-xs"
                              >
                                {showEmailPreview ? <EyeOff className="w-3 h-3 mr-1" /> : <Eye className="w-3 h-3 mr-1" />}
                                {showEmailPreview ? "Nascondi" : "Anteprima"}
                              </Button>
                            </div>
                          </div>
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept=".html,.htm"
                            className="hidden"
                            onChange={handleFileUpload}
                            data-testid="input-file-html"
                          />
                          {showEmailPreview && customEmailBody ? (
                            <div className="rounded-lg border overflow-hidden" style={{ height: 400 }}>
                              <iframe
                                srcDoc={customEmailBody}
                                title="Anteprima email"
                                className="w-full h-full"
                                sandbox="allow-same-origin"
                              />
                            </div>
                          ) : (
                            <Textarea
                              data-testid="textarea-custom-email-body"
                              placeholder="Inserisci qui il corpo HTML dell'email oppure carica un file .html..."
                              value={customEmailBody}
                              onChange={e => setCustomEmailBody(e.target.value)}
                              className="font-mono text-xs min-h-[200px]"
                            />
                          )}
                        </div>
                        <Button
                          onClick={handleSendCustomEmail}
                          disabled={sendCustomEmailMutation.isPending || !customEmailSubject.trim() || !customEmailBody.trim()}
                          data-testid="button-send-custom-email"
                          className="w-full bg-purple-600 hover:bg-purple-700"
                        >
                          {sendCustomEmailMutation.isPending
                            ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Invio in corso... attendere</>
                            : <><Send className="w-4 h-4 mr-2" /> Invia a Tutti ({realSubscriberCount})</>
                          }
                        </Button>
                        {sendCustomEmailMutation.isPending && (
                          <p className="text-xs text-yellow-400 text-center animate-pulse">
                            Invio in corso a {realSubscriberCount} iscritti... non chiudere la pagina
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="mb-4">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg flex items-center gap-2"><Mail className="w-5 h-5" /> Email di Benvenuto</CardTitle>
                        <Badge className="text-sm bg-green-500/20 text-green-400 border-green-500/30">
                          {realSubscriberCount} iscritti reali
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="bg-muted/30 rounded-lg border p-4">
                          <p className="text-sm text-muted-foreground mb-2">
                            Invia un'email di benvenuto a tema cosmico a tutti gli utenti reali registrati (esclusi bot e admin). Le email vengono inviate da <span className="font-medium text-foreground">privacyvibra@gmail.com</span>.
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Le email di benvenuto vengono anche inviate automaticamente a ogni nuovo utente al momento della registrazione.
                          </p>
                        </div>
                        <Button
                          onClick={handleSendEmails}
                          disabled={sendWelcomeEmailsMutation.isPending}
                          data-testid="button-send-welcome-emails"
                          className="w-full"
                        >
                          {sendWelcomeEmailsMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Mail className="w-4 h-4 mr-2" />}
                          {sendWelcomeEmailsMutation.isPending ? "Invio in corso... attendere fino a 30 secondi" : `Invia Email di Benvenuto a Tutti (${realSubscriberCount})`}
                        </Button>
                        {sendWelcomeEmailsMutation.isPending && (
                          <p className="text-xs text-yellow-400 text-center animate-pulse">
                            Invio email in corso a {realSubscriberCount} iscritti... non chiudere la pagina
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="mb-4">
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Download className="w-5 h-5" /> QR Code Vibra
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-col items-center gap-4">
                        <div className="rounded-xl overflow-hidden shadow-lg max-w-xs w-full">
                          <img
                            src="/api/qrcode-vibra.png"
                            alt="QR Code Vibra"
                            className="w-full h-auto"
                            data-testid="img-qrcode"
                          />
                        </div>
                        <a
                          href="/api/qrcode-vibra.png"
                          download="qrcode-vibra.jpg"
                          data-testid="link-download-qrcode"
                          className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-medium px-6 py-2 rounded-lg transition-colors"
                        >
                          <Download className="w-4 h-4" /> Scarica QR Code
                        </a>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Users className="w-5 h-5" /> Lista Iscritti Reali ({emailRecipients.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {emailRecipients.length === 0 ? (
                        <p className="text-center text-muted-foreground py-4" data-testid="text-no-subscribers">Caricamento iscritti...</p>
                      ) : (
                        <div className="space-y-2 max-h-96 overflow-y-auto">
                          {emailRecipients.map((u: User, idx: number) => {
                            const profile = realProfileMap.get(String(u.id));
                            return (
                              <div key={u.id} className="flex items-center justify-between p-3 bg-green-500/10 rounded-lg border border-green-500/20" data-testid={`email-subscriber-${u.id}`}>
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center text-white text-sm font-bold">
                                    {idx + 1}
                                  </div>
                                  <Avatar className="w-10 h-10">
                                    <AvatarImage src={profile?.imageUrl || ""} />
                                    <AvatarFallback>{(profile?.name || u.firstName || "?")[0].toUpperCase()}</AvatarFallback>
                                  </Avatar>
                                  <div>
                                    <p className="font-medium text-sm text-foreground">{profile?.name || u.firstName || "Utente"}</p>
                                    <p className="text-xs text-cyan-400">{u.email}</p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="text-xs text-muted-foreground">
                                    {u.createdAt ? new Date(u.createdAt).toLocaleDateString("it-IT") : ""}
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </>
              );
            })()}
          </TabsContent>

          <TabsContent value="positions">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2"><MapPin className="w-5 h-5" /> Posizioni Utenti</CardTitle>
              </CardHeader>
              <CardContent>
                {profilesLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (() => {
                  const allWithLocation = (profiles || []).filter(
                    (p: Profile) => p.profileLatitude && p.profileLongitude
                  );
                  const realProfiles = allWithLocation.filter((p: Profile) => !p.isBot);
                  const botProfiles = allWithLocation.filter((p: Profile) => p.isBot);
                  return (
                    <div>
                      <div className="flex items-center gap-4 mb-4">
                        <Badge variant="outline" className="text-sm">
                          {realProfiles.length} utenti reali
                        </Badge>
                        <Badge variant="secondary" className="text-sm">
                          {botProfiles.length} bot
                        </Badge>
                        <Badge className="text-sm">
                          {allWithLocation.length} totali
                        </Badge>
                      </div>

                      {realProfiles.length > 0 && (
                        <div className="mb-4">
                          <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-1"><Users className="w-4 h-4" /> Utenti Reali</h3>
                          <div className="space-y-2">
                            {realProfiles.map((p: Profile) => (
                              <div key={p.id} className="flex items-center justify-between p-3 bg-green-500/10 rounded-lg border border-green-500/20" data-testid={`position-real-${p.id}`}>
                                <div className="flex items-center gap-3">
                                  <Avatar className="w-10 h-10">
                                    <AvatarImage src={p.imageUrl || ""} />
                                    <AvatarFallback>{(p.name || "?")[0]}</AvatarFallback>
                                  </Avatar>
                                  <div>
                                    <p className="font-medium text-sm flex items-center gap-1">
                                      {p.name}{p.isVerified && <BadgeCheck className="w-3.5 h-3.5 text-blue-400" />}
                                    </p>
                                    <p className="text-xs text-muted-foreground">{p.location || "Città non impostata"}</p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="text-xs font-mono text-muted-foreground">
                                    {Number(p.profileLatitude).toFixed(4)}, {Number(p.profileLongitude).toFixed(4)}
                                  </p>
                                  <a
                                    href={`https://www.google.com/maps?q=${p.profileLatitude},${p.profileLongitude}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-primary hover:underline flex items-center justify-end gap-1 mt-0.5"
                                    data-testid={`map-link-${p.id}`}
                                  >
                                    <Globe className="w-3 h-3" /> Apri in Google Maps
                                  </a>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {realProfiles.length === 0 && (
                        <div className="text-center py-4 mb-4 bg-muted/20 rounded-lg">
                          <p className="text-muted-foreground text-sm">Nessun utente reale ha attivato la posizione</p>
                        </div>
                      )}

                      <details className="group">
                        <summary className="text-sm font-semibold text-white mb-2 flex items-center gap-1 cursor-pointer list-none">
                          <ChevronDown className="w-4 h-4 group-open:rotate-180 transition-transform" />
                          Bot con posizione ({botProfiles.length})
                        </summary>
                        <div className="space-y-2 max-h-[400px] overflow-y-auto mt-2">
                          {botProfiles.map((p: Profile) => (
                            <div key={p.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border" data-testid={`position-bot-${p.id}`}>
                              <div className="flex items-center gap-3">
                                <Avatar className="w-10 h-10">
                                  <AvatarImage src={p.imageUrl || ""} />
                                  <AvatarFallback>{(p.name || "?")[0]}</AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="font-medium text-sm flex items-center gap-1">
                                    {p.name} <Badge variant="outline" className="text-[10px] py-0 px-1">BOT</Badge>
                                  </p>
                                  <p className="text-xs text-muted-foreground">{p.location || "Città non impostata"}</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-xs font-mono text-muted-foreground">
                                  {Number(p.profileLatitude).toFixed(4)}, {Number(p.profileLongitude).toFixed(4)}
                                </p>
                                <a
                                  href={`https://www.google.com/maps?q=${p.profileLatitude},${p.profileLongitude}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-primary hover:underline flex items-center justify-end gap-1 mt-0.5"
                                >
                                  <Globe className="w-3 h-3" /> Maps
                                </a>
                              </div>
                            </div>
                          ))}
                        </div>
                      </details>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Hidden file input for admin video upload */}
      <input
        ref={videoInputRef}
        type="file"
        accept="video/mp4,video/webm,video/quicktime,video/mov"
        className="hidden"
        onChange={handleAdminVideoUpload}
        data-testid="input-admin-video-upload"
      />
    </div>
  );
}

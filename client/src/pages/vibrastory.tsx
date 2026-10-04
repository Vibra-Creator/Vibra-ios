import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation, useParams } from "wouter";
import { ArrowLeft, BookOpen, Plus, ThumbsUp, ThumbsDown, Star, Send, Image, X, Sparkles, CheckCircle, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { ReportContentButton } from "@/components/ReportContentButton";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Story, StoryBriciola } from "@shared/schema";

type BriolaFull = StoryBriciola & { profileName: string; profileImageUrl: string; myVote?: string };

function formatTimeAgo(date: string | Date) {
  const diff = (Date.now() - new Date(date).getTime()) / 1000;
  if (diff < 60) return "ora";
  if (diff < 3600) return `${Math.floor(diff / 60)}m fa`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h fa`;
  return `${Math.floor(diff / 86400)}g fa`;
}

function StoriesList() {
  const [, setLocation] = useLocation();
  const { data: stories, isLoading } = useQuery<Story[]>({ queryKey: ["/api/stories"] });

  return (
    <div className="flex-1 overflow-y-auto relative z-10">
      <div className="fixed inset-0 z-0 bg-gradient-to-b from-[#0a0118] via-[#12012e] to-[#0a0118]" />
      <div className="relative z-10 p-4 pb-8">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" className="text-white bg-black/30 backdrop-blur-sm" onClick={() => setLocation("/rooms")} data-testid="button-back-stories">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">VibraStory</h1>
            <p className="text-sm text-white/60">Storie collettive della community</p>
          </div>
        </motion.div>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-36 rounded-xl" />)}
          </div>
        ) : !stories?.length ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16">
            <div className="w-20 h-20 rounded-full bg-violet-500/20 flex items-center justify-center mx-auto mb-4">
              <BookOpen className="w-10 h-10 text-violet-400" />
            </div>
            <p className="text-white/60 text-lg mb-2">Nessuna storia attiva</p>
            <p className="text-white/40 text-sm">Gli admin lanciano nuove storie ogni giorno</p>
          </motion.div>
        ) : (
          <div className="space-y-4">
            {stories.map((story, i) => (
              <motion.div
                key={story.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                onClick={() => setLocation(`/story/${story.id}`)}
                className="rounded-2xl overflow-hidden cursor-pointer bg-white/5 border border-white/10 backdrop-blur-md hover:bg-white/10 transition-all"
                data-testid={`card-story-${story.id}`}
              >
                <div className="p-5">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center flex-shrink-0">
                      <Sparkles className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-white font-bold text-lg leading-tight">{story.theme}</h3>
                      {story.description && <p className="text-white/60 text-sm mt-0.5 line-clamp-2">{story.description}</p>}
                    </div>
                    <Badge className="bg-violet-500/20 text-violet-300 border-violet-500/30 shrink-0">
                      {story.status === 'active' ? '🟢 Attiva' : '✅ Conclusa'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-white/40 text-xs">{formatTimeAgo(story.createdAt)}</span>
                    <Button size="sm" variant="ghost" className="text-violet-400 gap-1 h-7 px-3">
                      Partecipa <ArrowLeft className="w-3 h-3 rotate-180" />
                    </Button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StoryDetail({ id }: { id: string }) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const [content, setContent] = useState("");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: myProfile } = useQuery<{ id: string } | null>({
    queryKey: ["/api/profiles/me"],
    queryFn: async () => {
      const response = await fetch("/api/profiles/me", { credentials: "include" });
      return response.ok ? response.json() : null;
    },
    retry: false,
  });

  const { data, isLoading, refetch } = useQuery<{ story: Story; briciole: BriolaFull[] }>({
    queryKey: ["/api/stories", id],
    queryFn: () => fetch(`/api/stories/${id}`, { credentials: "include" }).then(r => r.json()),
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const form = new FormData();
      form.append("content", content);
      if (mediaFile) form.append("media", mediaFile);
      const res = await fetch(`/api/stories/${id}/briciole`, { method: "POST", body: form, credentials: "include" });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: () => {
      setContent(""); setMediaFile(null); setMediaPreview(null); setShowForm(false);
      refetch();
      toast({ title: "Briciola aggiunta! 🎉", description: "La tua voce è ora parte della storia." });
    },
    onError: (e: any) => toast({ title: "Errore", description: e.message, variant: "destructive" }),
  });

  const voteMutation = useMutation({
    mutationFn: async ({ briolaId, voteType, remove }: { briolaId: string; voteType: string; remove: boolean }) => {
      if (remove) {
        const res = await fetch(`/api/stories/briciole/${briolaId}/vote`, { method: "DELETE", credentials: "include" });
        if (!res.ok) throw new Error("Errore");
      } else {
        await apiRequest("POST", `/api/stories/briciole/${briolaId}/vote`, { voteType });
      }
    },
    onSuccess: () => refetch(),
    onError: () => toast({ title: "Errore nel voto", variant: "destructive" }),
  });

  if (isLoading) return (
    <div className="flex-1 p-4 space-y-4">
      <Skeleton className="h-24 rounded-xl" />
      {[1, 2, 3].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}
    </div>
  );

  const story = data?.story;
  const briciole = data?.briciole ?? [];
  const selected = briciole.filter(b => b.isSelected);
  const others = briciole.filter(b => !b.isSelected);

  return (
    <div className="flex-1 overflow-y-auto relative z-10">
      <div className="fixed inset-0 z-0 bg-gradient-to-b from-[#0a0118] via-[#12012e] to-[#0a0118]" />
      <div className="relative z-10 p-4 pb-32">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3 mb-5">
          <Button variant="ghost" size="icon" className="text-white bg-black/30 backdrop-blur-sm" onClick={() => setLocation("/stories")} data-testid="button-back-story">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-white">{story?.theme}</h1>
            <p className="text-xs text-white/50">{briciole.length} contributi</p>
          </div>
        </motion.div>

        {/* Story timeline — selected briciole */}
        {selected.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle className="w-4 h-4 text-amber-400" />
              <span className="text-amber-400 text-sm font-semibold">Narrativa Ufficiale</span>
            </div>
            <div className="relative pl-5 border-l-2 border-violet-500/40 space-y-4">
              {selected.map((b, i) => (
                <motion.div id={`story-briciola-${b.id}`} key={b.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}
                  className="relative">
                  <div className="absolute -left-[25px] top-3 w-4 h-4 rounded-full bg-violet-500 border-2 border-[#0a0118]" />
                  <div className="bg-violet-500/15 border border-violet-500/30 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Avatar className="w-6 h-6">
                        <AvatarImage src={b.profileImageUrl} />
                        <AvatarFallback>{b.profileName[0]}</AvatarFallback>
                      </Avatar>
                      <span className="text-violet-300 text-xs font-medium">{b.profileName}</span>
                      <Badge className="ml-auto bg-amber-500/20 text-amber-300 border-amber-500/30 text-xs">⭐ Selezionata</Badge>
                      <ReportContentButton
                        reportedId={b.profileId}
                        contentType="story_briciola"
                        contentId={b.id}
                        currentProfileId={myProfile?.id}
                        className="h-7 px-2 text-white/50 hover:text-red-300"
                      />
                    </div>
                    <p className="text-white/90 text-sm leading-relaxed">{b.content}</p>
                    {b.mediaUrl && <img src={b.mediaUrl} alt="" className="mt-2 rounded-lg max-h-40 object-cover w-full" />}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* All briciole for voting */}
        {others.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-4 h-4 text-white/60" />
              <span className="text-white/60 text-sm font-semibold">Contributi della community ({others.length})</span>
            </div>
            <div className="space-y-3">
              {others.map((b, i) => {
                const myVote = b.myVote;
                return (
                  <motion.div id={`story-briciola-${b.id}`} key={b.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                    className="bg-white/5 border border-white/10 rounded-xl p-4" data-testid={`card-briciola-${b.id}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <Avatar className="w-7 h-7">
                        <AvatarImage src={b.profileImageUrl} />
                        <AvatarFallback>{b.profileName[0]}</AvatarFallback>
                      </Avatar>
                      <span className="text-white/70 text-sm">{b.profileName}</span>
                      <span className="ml-auto text-white/30 text-xs">{formatTimeAgo(b.createdAt)}</span>
                    </div>
                    <p className="text-white/85 text-sm leading-relaxed mb-3">{b.content}</p>
                    {b.mediaUrl && <img src={b.mediaUrl} alt="" className="mb-3 rounded-lg max-h-32 object-cover w-full" />}
                    <div className="flex items-center gap-3">
                      <Button size="sm" variant="ghost"
                        className={`h-8 gap-1.5 px-3 rounded-full ${myVote === "up" ? "bg-green-500/20 text-green-400" : "text-white/50 hover:text-green-400"}`}
                        onClick={() => voteMutation.mutate({ briolaId: b.id, voteType: "up", remove: myVote === "up" })}
                        data-testid={`button-vote-up-${b.id}`}>
                        <ThumbsUp className="w-3.5 h-3.5" />
                      </Button>
                      <span className={`text-sm font-bold ${b.votes > 0 ? "text-green-400" : b.votes < 0 ? "text-red-400" : "text-white/40"}`}>{b.votes}</span>
                      <Button size="sm" variant="ghost"
                        className={`h-8 gap-1.5 px-3 rounded-full ${myVote === "down" ? "bg-red-500/20 text-red-400" : "text-white/50 hover:text-red-400"}`}
                        onClick={() => voteMutation.mutate({ briolaId: b.id, voteType: "down", remove: myVote === "down" })}
                        data-testid={`button-vote-down-${b.id}`}>
                        <ThumbsDown className="w-3.5 h-3.5" />
                      </Button>
                      <ReportContentButton
                        reportedId={b.profileId}
                        contentType="story_briciola"
                        contentId={b.id}
                        currentProfileId={myProfile?.id}
                        className="ml-auto h-8 px-2 text-white/50 hover:text-red-300"
                      />
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}

        {!briciole.length && (
          <div className="text-center py-10">
            <p className="text-white/40 text-sm">Nessun contributo ancora. Sii il primo!</p>
          </div>
        )}
      </div>

      {/* Floating add button + form */}
      {story?.status === 'active' && (
        <div className="fixed bottom-20 left-0 right-0 px-4 z-30">
          <AnimatePresence>
            {showForm ? (
              <motion.div key="form" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
                className="bg-[#1a0535] border border-violet-500/30 rounded-2xl p-4 shadow-2xl">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-white/80 text-sm font-semibold">✍️ Aggiungi la tua briciola</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-white/50" onClick={() => setShowForm(false)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                <Textarea
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  placeholder="Come continua la storia? Scrivi il tuo contributo..."
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/30 resize-none mb-3"
                  rows={3}
                  data-testid="input-briciola-content"
                />
                {mediaPreview && (
                  <div className="relative mb-3">
                    <img src={mediaPreview} alt="" className="rounded-lg max-h-32 object-cover w-full" />
                    <Button size="icon" variant="ghost" className="absolute top-1 right-1 bg-black/60 h-6 w-6"
                      onClick={() => { setMediaFile(null); setMediaPreview(null); }}>
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                )}
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) { setMediaFile(f); setMediaPreview(URL.createObjectURL(f)); }
                }} />
                <div className="flex gap-2">
                  <Button size="icon" variant="outline" className="border-white/10 text-white/50 h-10 w-10 shrink-0"
                    onClick={() => fileRef.current?.click()}>
                    <Image className="w-4 h-4" />
                  </Button>
                  <Button className="flex-1 bg-violet-600 hover:bg-violet-700 gap-2"
                    onClick={() => addMutation.mutate()}
                    disabled={!content.trim() || addMutation.isPending}
                    data-testid="button-submit-briciola">
                    {addMutation.isPending ? "Invio..." : <><Send className="w-4 h-4" /> Pubblica</>}
                  </Button>
                </div>
              </motion.div>
            ) : (
              <motion.div key="btn" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <Button className="w-full bg-violet-600 hover:bg-violet-700 h-12 rounded-2xl gap-2 shadow-lg shadow-violet-900/50"
                  onClick={() => setShowForm(true)}
                  data-testid="button-add-briciola">
                  <Plus className="w-5 h-5" /> Aggiungi la tua briciola
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

export default function VibraStory() {
  const params = useParams<{ id?: string }>();
  const [location] = useLocation();

  if (params.id || location.startsWith("/story/")) {
    const id = params.id ?? location.replace("/story/", "");
    return <StoryDetail id={id} />;
  }
  return <StoriesList />;
}

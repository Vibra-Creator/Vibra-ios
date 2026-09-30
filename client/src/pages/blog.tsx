import { useState, useRef, useEffect } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Newspaper, Heart, Trash2, PenSquare, X, Send, ChevronDown, ChevronUp, Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import vibraLogo from "@assets/Gemini_Generated_Image_adkxs1adkxs1adkx_1770480122018.png";
import type { BlogPost } from "@shared/schema";

const CATEGORIES = [
  { id: "tutti",     label: "Tutti",       emoji: "📰" },
  { id: "notizie",   label: "Notizie",     emoji: "🗞️" },
  { id: "sport",     label: "Sport",       emoji: "⚽" },
  { id: "musica",    label: "Musica",       emoji: "🎵" },
  { id: "cultura",   label: "Cultura",     emoji: "🎭" },
  { id: "tech",      label: "Tech",        emoji: "💡" },
  { id: "viaggi",    label: "Viaggi",      emoji: "✈️" },
  { id: "cibo",      label: "Cibo",        emoji: "🍕" },
  { id: "altro",     label: "Altro",       emoji: "💬" },
];

const CAT_COLORS: Record<string, string> = {
  notizie: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  sport:   "bg-green-500/20 text-green-300 border-green-500/30",
  musica:  "bg-purple-500/20 text-purple-300 border-purple-500/30",
  cultura: "bg-pink-500/20 text-pink-300 border-pink-500/30",
  tech:    "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
  viaggi:  "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  cibo:    "bg-orange-500/20 text-orange-300 border-orange-500/30",
  altro:   "bg-white/10 text-white/60 border-white/20",
};

const formSchema = z.object({
  title: z.string().min(5, "Titolo troppo corto").max(150, "Titolo troppo lungo"),
  content: z.string().min(20, "Contenuto troppo corto").max(3000, "Contenuto troppo lungo"),
  imageUrl: z.string().url("URL immagine non valido").optional().or(z.literal("")),
  category: z.string().min(1),
});

function timeAgo(dateStr: string | Date) {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return "adesso";
  if (diff < 3600) return `${Math.floor(diff / 60)}m fa`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h fa`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}g fa`;
  return new Date(dateStr).toLocaleDateString("it-IT", { day: "numeric", month: "short" });
}

function ArticleCard({ post, profileId, onLike, onDelete, onReport }: {
  post: BlogPost;
  profileId: string | null;
  onLike: (id: string) => void;
  onDelete: (id: string) => void;
  onReport: (post: BlogPost) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasLiked = profileId ? post.likes?.includes(profileId) : false;
  const isOwner = profileId === post.profileId;
  const catLabel = CATEGORIES.find(c => c.id === post.category);
  const isLong = post.content.length > 300;
  const displayContent = expanded || !isLong ? post.content : post.content.slice(0, 300) + "…";

  return (
    <article
      className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden hover:border-white/20 transition-all"
      id={`blog-post-${post.id}`}
      data-testid={`blog-post-${post.id}`}
    >
      {post.imageUrl && (
        <div className="w-full h-48 overflow-hidden">
          <img src={post.imageUrl} alt={post.title} className="w-full h-full object-cover" />
        </div>
      )}
      <div className="p-5">
        {/* Category & time */}
        <div className="flex items-center gap-2 mb-3">
          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${CAT_COLORS[post.category] || CAT_COLORS.altro}`}>
            {catLabel?.emoji} {catLabel?.label || post.category}
          </span>
          <span className="text-white/35 text-xs ml-auto">{timeAgo(post.createdAt)}</span>
        </div>

        {/* Title */}
        <h2 className="text-white font-bold text-lg leading-tight mb-3">{post.title}</h2>

        {/* Content */}
        <p className="text-white/65 text-sm leading-relaxed whitespace-pre-wrap">{displayContent}</p>
        {isLong && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-primary text-xs mt-2 hover:text-primary/80 transition-colors"
            data-testid={`button-expand-${post.id}`}
          >
            {expanded ? <><ChevronUp className="w-3 h-3" /> Mostra meno</> : <><ChevronDown className="w-3 h-3" /> Leggi tutto</>}
          </button>
        )}

        {/* Author + actions */}
        <div className="flex items-center gap-3 mt-4 pt-4 border-t border-white/10">
          <Avatar className="w-8 h-8 ring-1 ring-white/20">
            <AvatarImage src={post.profileImageUrl} />
            <AvatarFallback className="bg-primary/30 text-white text-xs">{post.profileName?.[0]}</AvatarFallback>
          </Avatar>
          <span className="text-white/55 text-xs flex-1">{post.profileName}</span>

          <button
            onClick={() => onLike(post.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              hasLiked
                ? "bg-red-500/20 text-red-400 border border-red-500/30"
                : "bg-white/5 text-white/50 border border-white/15 hover:bg-red-500/10 hover:text-red-400"
            }`}
            data-testid={`button-like-${post.id}`}
          >
            <Heart className={`w-3.5 h-3.5 ${hasLiked ? "fill-current" : ""}`} />
            {post.likesCount > 0 && post.likesCount}
          </button>

          {!isOwner && (
            <button
              onClick={() => onReport(post)}
              className="p-1.5 rounded-full text-white/30 hover:text-amber-400 hover:bg-amber-500/10 transition-all"
              title="Segnala contenuto"
              data-testid={`button-report-${post.id}`}
            >
              <Flag className="w-3.5 h-3.5" />
            </button>
          )}

          {isOwner && (
            <button
              onClick={() => onDelete(post.id)}
              className="p-1.5 rounded-full text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-all"
              data-testid={`button-delete-${post.id}`}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

export default function Blog() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeCategory, setActiveCategory] = useState("tutti");
  const [showForm, setShowForm] = useState(false);
  const topRef = useRef<HTMLDivElement>(null);

  const { data: profile } = useQuery<{ id: string }>({
    queryKey: ["/api/profiles/me"],
    enabled: !!user,
  });

  const { data: posts = [], isLoading } = useQuery<BlogPost[]>({
    queryKey: ["/api/blog-posts", activeCategory],
    queryFn: async () => {
      const qs = activeCategory !== "tutti" ? `?category=${activeCategory}` : "";
      const r = await fetch(`/api/blog-posts${qs}`);
      return r.json();
    },
  });

  useEffect(() => {
    if (!posts.length || !window.location.hash) return;
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (!id.startsWith("blog-post-")) return;
    const timeout = window.setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
    return () => window.clearTimeout(timeout);
  }, [posts]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { title: "", content: "", imageUrl: "", category: "notizie" },
  });

  const createMutation = useMutation({
    mutationFn: (data: z.infer<typeof formSchema>) =>
      apiRequest("POST", "/api/blog-posts", { ...data, imageUrl: data.imageUrl || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/blog-posts"] });
      form.reset();
      setShowForm(false);
      toast({ title: "Articolo pubblicato!", description: "Il tuo articolo è ora visibile nel feed." });
    },
    onError: () => toast({ title: "Errore", description: "Impossibile pubblicare l'articolo.", variant: "destructive" }),
  });

  const likeMutation = useMutation({
    mutationFn: (id: string) => apiRequest("PATCH", `/api/blog-posts/${id}/like`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/blog-posts"] }),
  });

  const reportMutation = useMutation({
    mutationFn: (post: BlogPost) => apiRequest("POST", "/api/reports", {
      reportedId: post.profileId,
      reason: "Contenuto del blog segnalato",
      reportedContentType: "blog_post",
      reportedContentId: post.id,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reports/mine"] });
      toast({ title: "Segnalazione inviata", description: "Il contenuto è stato inviato al team di moderazione." });
    },
    onError: () => toast({ title: "Errore", description: "Impossibile inviare la segnalazione.", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/blog-posts/${id}`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/blog-posts"] });
      toast({ title: "Eliminato", description: "Articolo rimosso." });
    },
  });

  const handleReport = (post: BlogPost) => {
    if (!user) {
      toast({ title: "Accedi per segnalare", description: "Devi accedere per inviare una segnalazione." });
      return;
    }
    reportMutation.mutate(post);
  };

  const onSubmit = (data: z.infer<typeof formSchema>) => createMutation.mutate(data);

  return (
    <div className="flex-1 overflow-y-auto bg-[#0a0118]" ref={topRef}>
      {/* Header */}
      <header className="sticky top-0 z-50 bg-black/60 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/">
            <Button variant="ghost" size="sm" className="text-white/70 hover:text-white gap-2 px-2" data-testid="button-blog-back">
              <ArrowLeft className="w-4 h-4" />
              <img src={vibraLogo} alt="Vibra" className="w-6 h-6 rounded-full" style={{ mixBlendMode: "screen" }} />
              <span className="font-semibold text-white">Vibra</span>
            </Button>
          </Link>
          <div className="w-px h-5 bg-white/20" />
          <Newspaper className="w-4 h-4 text-primary" />
          <span className="text-white/80 font-semibold text-sm flex-1">Blog & Notizie</span>
          {user && (
            <Button
              size="sm"
              onClick={() => setShowForm(!showForm)}
              className={`gap-2 text-xs h-8 ${showForm ? "bg-white/10 text-white border border-white/20" : "bg-primary hover:bg-primary/90 text-white"}`}
              data-testid="button-new-post"
            >
              {showForm ? <><X className="w-3.5 h-3.5" /> Annulla</> : <><PenSquare className="w-3.5 h-3.5" /> Pubblica</>}
            </Button>
          )}
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4">
        {/* Hero */}
        <div className="pt-10 pb-6 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/20 border border-primary/30 mb-4">
            <Newspaper className="w-3.5 h-3.5 text-primary" />
            <span className="text-sm font-medium text-primary/90">Giornale Comunitario</span>
          </div>
          <h1 className="text-4xl font-extrabold text-white mb-2">
            Blog di <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">Vibra</span>
          </h1>
          <p className="text-white/50 text-base max-w-lg mx-auto">
            Notizie, storie e aggiornamenti condivisi dalla community. Tutti possono pubblicare.
          </p>
        </div>

        {/* New post form */}
        {showForm && user && (
          <div className="mb-6 bg-white/5 border border-primary/30 rounded-2xl p-5">
            <h3 className="text-white font-bold mb-4 flex items-center gap-2">
              <PenSquare className="w-4 h-4 text-primary" /> Scrivi un articolo
            </h3>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
              <div>
                <Input
                  {...form.register("title")}
                  placeholder="Titolo dell'articolo…"
                  className="bg-white/8 border-white/15 text-white placeholder:text-white/30 focus:border-primary/60"
                  data-testid="input-blog-title"
                />
                {form.formState.errors.title && (
                  <p className="text-red-400 text-xs mt-1">{form.formState.errors.title.message}</p>
                )}
              </div>

              <div>
                <Textarea
                  {...form.register("content")}
                  placeholder="Scrivi qui il contenuto del tuo articolo…"
                  rows={5}
                  className="bg-white/8 border-white/15 text-white placeholder:text-white/30 focus:border-primary/60 resize-none"
                  data-testid="input-blog-content"
                />
                {form.formState.errors.content && (
                  <p className="text-red-400 text-xs mt-1">{form.formState.errors.content.message}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <select
                    {...form.register("category")}
                    className="w-full h-10 px-3 rounded-lg bg-white/8 border border-white/15 text-white text-sm focus:border-primary/60 focus:outline-none"
                    data-testid="select-blog-category"
                  >
                    {CATEGORIES.filter(c => c.id !== "tutti").map(c => (
                      <option key={c.id} value={c.id} className="bg-gray-900">{c.emoji} {c.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Input
                    {...form.register("imageUrl")}
                    placeholder="URL immagine (opzionale)"
                    className="bg-white/8 border-white/15 text-white placeholder:text-white/30 focus:border-primary/60"
                    data-testid="input-blog-image"
                  />
                </div>
              </div>

              <div className="flex justify-between items-center pt-1">
                <span className="text-white/35 text-xs">
                  {form.watch("content")?.length || 0}/3000 caratteri
                </span>
                <Button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="bg-primary hover:bg-primary/90 text-white gap-2 h-9 px-5"
                  data-testid="button-submit-post"
                >
                  <Send className="w-3.5 h-3.5" />
                  {createMutation.isPending ? "Pubblicazione…" : "Pubblica"}
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* Category filter */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-6 scrollbar-hide">
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap ${
                activeCategory === cat.id
                  ? "bg-primary text-white shadow-lg shadow-primary/30"
                  : "bg-white/8 text-white/60 border border-white/15 hover:bg-white/12 hover:text-white"
              }`}
              data-testid={`filter-category-${cat.id}`}
            >
              <span>{cat.emoji}</span>
              <span>{cat.label}</span>
            </button>
          ))}
        </div>

        {/* Feed */}
        {isLoading ? (
          <div className="space-y-4 pb-24">
            {[1,2,3].map(i => (
              <div key={i} className="h-48 bg-white/5 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">📰</div>
            <h3 className="text-white/60 font-semibold text-lg mb-2">Nessun articolo ancora</h3>
            <p className="text-white/35 text-sm mb-6">
              {user ? "Sii il primo a pubblicare qualcosa!" : "Accedi per pubblicare il primo articolo."}
            </p>
            {user && (
              <Button
                onClick={() => setShowForm(true)}
                className="bg-primary hover:bg-primary/90 text-white gap-2"
                data-testid="button-empty-new-post"
              >
                <PenSquare className="w-4 h-4" /> Scrivi il primo articolo
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-4 pb-24">
            {posts.map(post => (
              <ArticleCard
                key={post.id}
                post={post}
                profileId={profile?.id ?? null}
                onLike={(id) => user ? likeMutation.mutate(id) : toast({ title: "Accedi per mettere like", variant: "destructive" })}
                onDelete={(id) => deleteMutation.mutate(id)}
                onReport={handleReport}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-white/10 py-6 text-center text-sm text-white/35">
        <div className="flex items-center justify-center gap-2">
          <img src={vibraLogo} alt="Vibra" className="w-5 h-5 rounded-full" style={{ mixBlendMode: "screen" }} />
          <span>© 2026 Vibra · Giornale della community</span>
        </div>
      </footer>
    </div>
  );
}

import { useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, X, MapPin, Phone, Trash2, CheckCircle, ShoppingBag, AlertTriangle, ImagePlus, Loader2, MessageCircle, Pencil } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/i18n/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { ReportContentButton } from "@/components/ReportContentButton";
import type { HubPost } from "@shared/schema";

const SUBCATEGORIES = ["Elettronica","Abbigliamento","Auto & Moto","Casa & Arredo","Sport","Libri","Altro"] as const;

const SUB_COLORS: Record<string, string> = {
  "Elettronica": "#06b6d4", "Abbigliamento": "#ec4899", "Auto & Moto": "#f59e0b",
  "Casa & Arredo": "#10b981", "Sport": "#84cc16", "Libri": "#a855f7", "Altro": "#6b7280",
};

function ListingPhoto({
  src,
  title,
  index,
  unavailable,
  replaceLabel,
  removeLabel,
  isOwner,
  isUpdating,
  onReplace,
  onRemove,
}: {
  src: string;
  title: string;
  index: number;
  unavailable: string;
  replaceLabel: string;
  removeLabel: string;
  isOwner: boolean;
  isUpdating: boolean;
  onReplace: (file: File) => void;
  onRemove: () => void;
}) {
  const [failed, setFailed] = useState(false);
  const replaceInputRef = useRef<HTMLInputElement>(null);

  const replacementInput = isOwner && (
    <input
      ref={replaceInputRef}
      type="file"
      accept="image/jpeg,image/png,image/webp,image/gif"
      className="hidden"
      data-testid={`marketplace-replace-photo-${index}`}
      onChange={(event) => {
        const file = event.currentTarget.files?.[0];
        event.currentTarget.value = "";
        if (file) onReplace(file);
      }}
    />
  );
  const replaceButton = isOwner && (
    <button
      type="button"
      aria-label={`${replaceLabel} ${index}`}
      title={`${replaceLabel} ${index}`}
      disabled={isUpdating}
      onClick={() => replaceInputRef.current?.click()}
      className="rounded bg-white/10 p-1 text-white hover:bg-white/20 disabled:opacity-50"
    >
      {isUpdating ? <Loader2 aria-hidden="true" className="w-3 h-3 animate-spin" /> : <ImagePlus aria-hidden="true" className="w-3 h-3" />}
    </button>
  );

  return failed ? (
    <div className="w-24 h-24 rounded-xl shrink-0 flex flex-col items-center justify-center gap-1 bg-white/10 border border-white/15 text-white/70 text-center px-1 py-1">
      <div role="img" aria-label={`${title}, ${unavailable.toLowerCase()} ${index}`} className="min-h-0 flex-1 flex flex-col items-center justify-center gap-1">
        <ImagePlus aria-hidden="true" className="w-5 h-5 shrink-0" />
        <span aria-hidden="true" className="text-[10px] leading-tight">{unavailable}</span>
      </div>
      {isOwner && (
        <div className="flex items-center gap-2">
          {replacementInput}
          {replaceButton}
          <button
            type="button"
            aria-label={`${removeLabel} ${index}`}
            title={`${removeLabel} ${index}`}
            disabled={isUpdating}
            onClick={onRemove}
            className="rounded bg-white/10 p-1 text-white hover:bg-white/20 disabled:opacity-50"
          >
            <Trash2 aria-hidden="true" className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  ) : (
    <div className="relative w-24 h-24 shrink-0 group">
      <img src={src} alt={`${title} ${index}`} onError={() => setFailed(true)} className="w-full h-full rounded-xl object-cover" />
      {isOwner && (
        <>
          {replacementInput}
          <div className="absolute bottom-1 right-1 rounded bg-black/60">
            {replaceButton}
          </div>
        </>
      )}
    </div>
  );
}

type ListingPhotoUpdate =
  | { postId: string; imageUrl: string; action: "remove" }
  | { postId: string; imageUrl: string; action: "replace"; file: File };

export default function MarketplacePage() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { toast } = useToast();
  const [filter, setFilter] = useState<string>("tutti");
  const [showForm, setShowForm] = useState(false);
  const [editingPost, setEditingPost] = useState<HubPost | null>(null);
  const [form, setForm] = useState({ title:"", description:"", price:"", subcategory:"Elettronica", city:"", contactInfo:"", imageUrls: [] as string[] });
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const { data: myProfile } = useQuery<{ id: string }>({ queryKey: ["/api/profiles/me"], queryFn: async () => { const r = await fetch("/api/profiles/me",{credentials:"include"}); return r.ok ? r.json() : null; }, retry: false });

  const { data: posts = [], isLoading } = useQuery<HubPost[]>({
    queryKey: ["/api/hub-posts", "marketplace", filter],
    queryFn: async () => {
      const params = new URLSearchParams({ category: "marketplace" });
      if (filter !== "tutti") params.set("subcategory", filter);
      const r = await fetch(`/api/hub-posts?${params}`, { credentials: "include" });
      return r.json();
    },
  });

  const createPost = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/hub-posts", { ...form, price: form.price ? parseInt(form.price) : undefined, category: "marketplace" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hub-posts"] });
      setShowForm(false);
      setForm({ title:"", description:"", price:"", subcategory:"Elettronica", city:"", contactInfo:"", imageUrls: [] });
      toast({ title: t("market.publishSuccess"), description: t("market.publishSuccessDesc") });
    },
    onError: (error: Error) => {
      toast({ title: t("common.error"), description: error.message || t("market.publishError"), variant: "destructive" });
    },
  });

  const updatePost = useMutation({
    mutationFn: async ({ postId, details }: {
      postId: string;
      details: Pick<typeof form, "title" | "description" | "price" | "subcategory" | "city" | "contactInfo">;
    }) => apiRequest("PATCH", `/api/hub-posts/${postId}/details`, {
      ...details,
      price: details.price.trim() ? Number(details.price) : null,
      city: details.city.trim() || null,
      contactInfo: details.contactInfo.trim() || null,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hub-posts"] });
      setShowForm(false);
      setEditingPost(null);
      toast({ title: t("market.updateSuccess") });
    },
    onError: (error: Error) => {
      toast({ title: t("common.error"), description: error.message || t("market.updateError"), variant: "destructive" });
    },
  });

  const closeForm = () => {
    setShowForm(false);
    setEditingPost(null);
  };

  const openEditForm = (post: HubPost) => {
    setForm({
      title: post.title,
      description: post.description,
      price: post.price == null ? "" : String(post.price),
      subcategory: post.subcategory || SUBCATEGORIES[0],
      city: post.city || "",
      contactInfo: post.contactInfo || "",
      imageUrls: [],
    });
    setEditingPost(post);
    setShowForm(true);
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (form.imageUrls.length + files.length > 6) {
      toast({ title: t("market.tooManyImages"), description: t("market.tooManyImagesDesc"), variant: "destructive" });
      event.target.value = "";
      return;
    }
    for (const file of files) {
      if (!allowedTypes.includes(file.type)) {
        toast({ title: t("market.invalidImage"), description: t("market.invalidImageDesc"), variant: "destructive" });
        event.target.value = "";
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast({ title: t("market.imageTooLarge"), description: t("market.imageTooLargeDesc"), variant: "destructive" });
        event.target.value = "";
        return;
      }
    }

    setIsUploadingImage(true);
    try {
      const body = new FormData();
      files.forEach((file) => body.append("images", file));
      const response = await fetch("/api/hub-posts/upload-image", {
        method: "POST",
        body,
        credentials: "include",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || t("market.uploadError"));
      setForm((current) => ({ ...current, imageUrls: [...current.imageUrls, ...(data.urls || [])] }));
      toast({ title: t("market.photosUploaded"), description: t("market.photosUploadedDesc") });
    } catch (error: any) {
      toast({ title: t("common.error"), description: error?.message || t("market.uploadError"), variant: "destructive" });
    } finally {
      setIsUploadingImage(false);
      event.target.value = "";
    }
  };

  const markSold = useMutation({
    mutationFn: (id: string) => apiRequest("PATCH", `/api/hub-posts/${id}/status`, { status: "sold" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/hub-posts"] }),
  });

  const deletePost = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/hub-posts/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/hub-posts"] }),
  });

  const updateListingPhoto = useMutation({
    mutationFn: async (update: ListingPhotoUpdate) => {
      let replacementImageUrl: string | undefined;
      if (update.action === "replace") {
        const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
        if (!allowedTypes.includes(update.file.type)) {
          throw new Error(t("market.invalidImageDesc"));
        }
        if (update.file.size > 5 * 1024 * 1024) {
          throw new Error(t("market.imageTooLargeDesc"));
        }

        const body = new FormData();
        body.append("images", update.file);
        const uploadResponse = await fetch("/api/hub-posts/upload-image", {
          method: "POST",
          body,
          credentials: "include",
        });
        const uploadData = await uploadResponse.json().catch(() => ({}));
        if (!uploadResponse.ok || typeof uploadData.urls?.[0] !== "string") {
          throw new Error(uploadData.error || t("market.uploadError"));
        }
        replacementImageUrl = uploadData.urls[0];
      }

      return apiRequest("PATCH", `/api/hub-posts/${update.postId}/photos`, {
        action: update.action,
        imageUrl: update.imageUrl,
        ...(replacementImageUrl ? { replacementImageUrl } : {}),
      });
    },
    onSuccess: (_result, update) => {
      queryClient.invalidateQueries({ queryKey: ["/api/hub-posts"] });
      toast({
        title: update.action === "replace" ? t("market.photoReplaced") : t("market.photoRemoved"),
      });
    },
    onError: (error: Error) => {
      toast({ title: t("common.error"), description: error.message || t("market.photoUpdateError"), variant: "destructive" });
    },
  });

  return (
    <div className="flex-1 overflow-y-auto pb-24" style={{ background: "transparent" }}>
      <div className="px-4 pt-4 max-w-lg mx-auto">
        <motion.div initial={{ opacity:0,y:-10 }} animate={{ opacity:1,y:0 }} className="mb-4">
          <div className="flex items-center gap-2 mb-1">
            <ShoppingBag className="w-5 h-5 text-orange-400" />
            <h1 className="text-white font-bold text-xl" style={{ fontFamily:"Space Grotesk,sans-serif" }}>{t("market.title")}</h1>
          </div>
          <p className="text-white/40 text-sm">{t("market.subtitle")}</p>
        </motion.div>

        {/* Disclaimer legale */}
        <div className="flex items-start gap-2.5 p-3 mb-4 rounded-xl border border-amber-500/25 bg-amber-500/8" data-testid="marketplace-disclaimer">
          <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-amber-200/70 text-xs leading-relaxed">
            <span className="font-semibold text-amber-300">Vibra non è parte delle transazioni.</span>{" "}
            Gli annunci sono pubblicati da privati sotto la loro esclusiva responsabilità.
            Vibra non garantisce la qualità, la sicurezza o la legalità degli oggetti in vendita.
            Acquista e vendi in sicurezza, preferendo incontri in luoghi pubblici.
          </p>
        </div>

        {/* Filters */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide">
          {["tutti", ...SUBCATEGORIES].map(s => (
            <button key={s} onClick={() => setFilter(s)}
              className="shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
              style={{ background: filter === s ? "#f97316" : "rgba(255,255,255,0.08)", color: filter === s ? "#fff" : "rgba(255,255,255,0.5)" }}>
              {s === "tutti" ? t("market.all") : s}
            </button>
          ))}
        </div>

        {/* Posts */}
        {isLoading ? (
          <div className="flex justify-center py-12"><div className="w-8 h-8 rounded-full border-2 border-orange-400 border-t-transparent animate-spin"/></div>
        ) : posts.length === 0 ? (
          <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} className="text-center py-16">
            <span className="text-5xl">🛒</span>
            <p className="text-white/40 mt-3 text-sm">{t("market.empty")}</p>
            <button
              onClick={() => {
                setForm({ title:"", description:"", price:"", subcategory:"Elettronica", city:"", contactInfo:"", imageUrls: [] });
                setEditingPost(null);
                setShowForm(true);
              }}
              className="mt-4 px-4 py-2 rounded-xl text-sm font-semibold text-white"
              style={{ background:"linear-gradient(135deg,#f97316,#ea580c)" }}
            >
              {t("market.create")}
            </button>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
             {posts.map((post, i) => {
               const postImages = post.imageUrls?.length ? post.imageUrls : (post.imageUrl ? [post.imageUrl] : []);
               return (
               <motion.div id={`hub-post-${post.id}`} key={post.id} initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} transition={{ delay: i*0.04 }}
                 className="rounded-2xl overflow-hidden"
                 style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.08)" }}>
                 {postImages.length > 0 && (
                   <div className="flex gap-2 overflow-x-auto px-4 pt-4 scrollbar-hide">
                     {postImages.map((image, imageIndex) => (
                         <ListingPhoto
                           key={`${post.id}-image-${imageIndex}-${image}`}
                           src={image}
                           title={post.title}
                           index={imageIndex + 1}
                           unavailable={t("market.photoUnavailable")}
                           replaceLabel={t("market.replacePhoto")}
                           removeLabel={t("market.removePhoto")}
                           isOwner={Boolean(myProfile && post.profileId === myProfile.id)}
                           isUpdating={updateListingPhoto.isPending && updateListingPhoto.variables?.postId === post.id && updateListingPhoto.variables.imageUrl === image}
                           onReplace={(file) => updateListingPhoto.mutate({ postId: post.id, imageUrl: image, action: "replace", file })}
                           onRemove={() => updateListingPhoto.mutate({ postId: post.id, imageUrl: image, action: "remove" })}
                         />
                     ))}
                   </div>
                 )}
                 <div className="flex gap-3 p-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-white font-semibold text-sm leading-tight">{post.title}</p>
                      {post.price && <span className="text-orange-400 font-bold text-sm shrink-0">€{post.price}</span>}
                    </div>
                    <p className="text-white/50 text-xs mt-1 line-clamp-2">{post.description}</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background:`${SUB_COLORS[post.subcategory||"Altro"]}22`, color:SUB_COLORS[post.subcategory||"Altro"] }}>{post.subcategory}</span>
                      {post.city && <span className="text-[10px] text-white/40 flex items-center gap-1"><MapPin className="w-2.5 h-2.5"/>{post.city}</span>}
                    </div>
                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center gap-2">
                        <img src={post.profileImageUrl} alt="" className="w-5 h-5 rounded-full object-cover"/>
                        <span className="text-white/40 text-xs">{post.profileName}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {post.contactInfo && (
                          <a href={`tel:${post.contactInfo}`} className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg text-emerald-400" style={{ background:"rgba(16,185,129,0.12)" }}>
                            <Phone className="w-3 h-3"/>{t("market.contact")}
                          </a>
                        )}
                         {myProfile && post.profileId !== myProfile.id && (
                           <Link href={`/vibrapp?dm=${encodeURIComponent(post.profileId)}`} className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg text-cyan-300" style={{ background:"rgba(34,211,238,0.12)" }}>
                             <MessageCircle className="w-3 h-3"/>{t("market.messageSeller")}
                           </Link>
                         )}
                        {myProfile && post.profileId === myProfile.id && (
                          <>
                             <button
                               type="button"
                               data-testid={`marketplace-edit-post-${post.id}`}
                               onClick={() => openEditForm(post)}
                               className="p-1.5 rounded-lg text-orange-300"
                               style={{ background:"rgba(249,115,22,0.12)" }}
                               title={t("market.editPost")}
                               aria-label={`${t("market.editPost")}: ${post.title}`}
                             >
                               <Pencil aria-hidden="true" className="w-3.5 h-3.5"/>
                             </button>
                            <button onClick={() => markSold.mutate(post.id)} className="p-1.5 rounded-lg" style={{ background:"rgba(251,191,36,0.12)" }} title="Segna come venduto"><CheckCircle className="w-3.5 h-3.5 text-yellow-400"/></button>
                            <button onClick={() => deletePost.mutate(post.id)} className="p-1.5 rounded-lg" style={{ background:"rgba(239,68,68,0.12)" }}><Trash2 className="w-3.5 h-3.5 text-red-400"/></button>
                          </>
                        )}
                        <ReportContentButton
                          reportedId={post.profileId}
                          contentType="hub_post"
                          contentId={post.id}
                          currentProfileId={myProfile?.id}
                          className="h-7 px-2 text-white/50 hover:text-red-300"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
               );
             })}
          </div>
        )}
      </div>

      {/* FAB */}
      <motion.button data-testid="marketplace-fab" onClick={() => {
        setForm({ title:"", description:"", price:"", subcategory:"Elettronica", city:"", contactInfo:"", imageUrls: [] });
        setEditingPost(null);
        setShowForm(true);
      }}
        className="fixed bottom-24 right-4 w-14 h-14 rounded-full flex items-center justify-center shadow-2xl z-40"
        style={{ background:"linear-gradient(135deg,#f97316,#ea580c)" }}
        whileHover={{ scale:1.1 }} whileTap={{ scale:0.95 }}>
        <Plus className="w-6 h-6 text-white"/>
      </motion.button>

      {/* Create Form Modal */}
      <AnimatePresence>
        {showForm && (
          <>
            <motion.div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }} onClick={closeForm}/>
            <motion.div className="fixed inset-x-4 bottom-4 z-50 rounded-3xl overflow-y-auto max-h-[85vh]"
              style={{ background:"linear-gradient(135deg,#0f0a1e,#1a0a2e)" }}
              initial={{ opacity:0, y:40 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:40 }}
              transition={{ type:"spring", damping:25, stiffness:300 }}>
              <div className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-white font-bold text-lg" style={{ fontFamily:"Space Grotesk,sans-serif" }}>{editingPost ? t("market.editPost") : t("market.newPost")}</h3>
                  <button onClick={closeForm} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center"><X className="w-4 h-4 text-white"/></button>
                </div>
                <div className="space-y-3">
                  <input value={form.title} onChange={e => setForm(f=>({...f,title:e.target.value}))} placeholder={t("market.form.title")} className="w-full bg-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none placeholder-white/30" style={{ fontFamily:"Space Grotesk,sans-serif" }}/>
                  <textarea value={form.description} onChange={e => setForm(f=>({...f,description:e.target.value}))} placeholder={t("market.form.desc")} rows={3} className="w-full bg-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none placeholder-white/30 resize-none" style={{ fontFamily:"Space Grotesk,sans-serif" }}/>
                  <div className="grid grid-cols-2 gap-3">
                    <input value={form.price} onChange={e => setForm(f=>({...f,price:e.target.value}))} placeholder={t("market.form.price")} type="number" min="0" step="1" className="bg-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none placeholder-white/30" style={{ fontFamily:"Space Grotesk,sans-serif" }}/>
                    <input value={form.city} onChange={e => setForm(f=>({...f,city:e.target.value}))} placeholder={t("market.form.city")} className="bg-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none placeholder-white/30" style={{ fontFamily:"Space Grotesk,sans-serif" }}/>
                  </div>
                  <select value={form.subcategory} onChange={e => setForm(f=>({...f,subcategory:e.target.value}))} className="w-full bg-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none" style={{ fontFamily:"Space Grotesk,sans-serif" }}>
                    {SUBCATEGORIES.map(s => <option key={s} value={s} style={{ background:"#1a0a2e" }}>{s}</option>)}
                  </select>
                  <input value={form.contactInfo} onChange={e => setForm(f=>({...f,contactInfo:e.target.value}))} placeholder={t("market.form.contact")} className="w-full bg-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none placeholder-white/30" style={{ fontFamily:"Space Grotesk,sans-serif" }}/>
                    {!editingPost && <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                     <div className="flex items-center justify-between gap-3 mb-2">
                       <div>
                         <p className="text-white text-sm font-semibold flex items-center gap-2">
                           <ImagePlus className="w-4 h-4 text-orange-400" />
                           {t("market.form.photos")} ({form.imageUrls.length}/6)
                         </p>
                         <p className="text-white/40 text-[11px] mt-1">{t("market.form.photoHint")}</p>
                       </div>
                       <input
                         ref={imageInputRef}
                         type="file"
                         accept="image/jpeg,image/png,image/webp,image/gif"
                         multiple
                         className="hidden"
                         onChange={handleImageUpload}
                         disabled={isUploadingImage}
                       />
                       <button
                         type="button"
                         onClick={() => imageInputRef.current?.click()}
                         disabled={isUploadingImage}
                         className="shrink-0 rounded-lg bg-orange-500/20 px-3 py-2 text-xs font-semibold text-orange-300 disabled:opacity-50"
                       >
                         {isUploadingImage ? <Loader2 className="w-4 h-4 animate-spin" /> : t("market.form.addPhotos")}
                       </button>
                     </div>
                     {form.imageUrls.length > 0 && (
                       <div className="grid grid-cols-3 gap-2 mt-2">
                         {form.imageUrls.map((image, index) => (
                           <div key={`${image}-${index}`} className="relative aspect-square">
                             <img src={image} alt={`${t("market.form.photo")} ${index + 1}`} className="w-full h-full rounded-lg object-cover" />
                             <button
                               type="button"
                               onClick={() => setForm((current) => ({ ...current, imageUrls: current.imageUrls.filter((_, imageIndex) => imageIndex !== index) }))}
                               className="absolute -right-1 -top-1 w-6 h-6 rounded-full bg-black/80 flex items-center justify-center"
                               aria-label={t("market.form.removePhoto")}
                             >
                               <X className="w-3 h-3 text-white" />
                             </button>
                           </div>
                         ))}
                       </div>
                     )}
                    </div>}
                    <button
                     onClick={() => editingPost
                       ? updatePost.mutate({
                           postId: editingPost.id,
                           details: {
                             title: form.title,
                             description: form.description,
                             price: form.price,
                             subcategory: form.subcategory,
                             city: form.city,
                             contactInfo: form.contactInfo,
                           },
                         })
                       : createPost.mutate()}
                     disabled={!form.title.trim() || !form.description.trim() || (editingPost ? updatePost.isPending : form.imageUrls.length < 3 || createPost.isPending || isUploadingImage)}
                    className="w-full py-3 rounded-xl font-bold text-white disabled:opacity-40"
                    style={{ background:"linear-gradient(135deg,#f97316,#ea580c)", fontFamily:"Space Grotesk,sans-serif" }}>
                     {(editingPost ? updatePost.isPending : createPost.isPending) ? "..." : editingPost ? t("market.saveChanges") : t("market.publish")}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

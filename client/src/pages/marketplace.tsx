import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, X, Tag, MapPin, Phone, Trash2, CheckCircle, ShoppingBag, AlertTriangle } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/i18n/LanguageContext";
import type { HubPost } from "@shared/schema";

const SUBCATEGORIES = ["Elettronica","Abbigliamento","Auto & Moto","Casa & Arredo","Sport","Libri","Altro"] as const;

const SUB_COLORS: Record<string, string> = {
  "Elettronica": "#06b6d4", "Abbigliamento": "#ec4899", "Auto & Moto": "#f59e0b",
  "Casa & Arredo": "#10b981", "Sport": "#84cc16", "Libri": "#a855f7", "Altro": "#6b7280",
};

export default function MarketplacePage() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [filter, setFilter] = useState<string>("tutti");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title:"", description:"", price:"", subcategory:"Elettronica", city:"", contactInfo:"", imageUrl:"" });

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
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/hub-posts"] }); setShowForm(false); setForm({ title:"", description:"", price:"", subcategory:"Elettronica", city:"", contactInfo:"", imageUrl:"" }); },
  });

  const markSold = useMutation({
    mutationFn: (id: string) => apiRequest("PATCH", `/api/hub-posts/${id}/status`, { status: "sold" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/hub-posts"] }),
  });

  const deletePost = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/hub-posts/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/hub-posts"] }),
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
            <button onClick={() => setShowForm(true)} className="mt-4 px-4 py-2 rounded-xl text-sm font-semibold text-white" style={{ background:"linear-gradient(135deg,#f97316,#ea580c)" }}>{t("market.create")}</button>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {posts.map((post, i) => (
              <motion.div key={post.id} initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} transition={{ delay: i*0.04 }}
                className="rounded-2xl overflow-hidden"
                style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.08)" }}>
                <div className="flex gap-3 p-4">
                  {post.imageUrl && <img src={post.imageUrl} alt="" className="w-20 h-20 rounded-xl object-cover shrink-0"/>}
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
                        {myProfile && post.profileId === myProfile.id && (
                          <>
                            <button onClick={() => markSold.mutate(post.id)} className="p-1.5 rounded-lg" style={{ background:"rgba(251,191,36,0.12)" }} title="Segna come venduto"><CheckCircle className="w-3.5 h-3.5 text-yellow-400"/></button>
                            <button onClick={() => deletePost.mutate(post.id)} className="p-1.5 rounded-lg" style={{ background:"rgba(239,68,68,0.12)" }}><Trash2 className="w-3.5 h-3.5 text-red-400"/></button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* FAB */}
      <motion.button data-testid="marketplace-fab" onClick={() => setShowForm(true)}
        className="fixed bottom-24 right-4 w-14 h-14 rounded-full flex items-center justify-center shadow-2xl z-40"
        style={{ background:"linear-gradient(135deg,#f97316,#ea580c)" }}
        whileHover={{ scale:1.1 }} whileTap={{ scale:0.95 }}>
        <Plus className="w-6 h-6 text-white"/>
      </motion.button>

      {/* Create Form Modal */}
      <AnimatePresence>
        {showForm && (
          <>
            <motion.div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }} onClick={() => setShowForm(false)}/>
            <motion.div className="fixed inset-x-4 bottom-4 z-50 rounded-3xl overflow-y-auto max-h-[85vh]"
              style={{ background:"linear-gradient(135deg,#0f0a1e,#1a0a2e)" }}
              initial={{ opacity:0, y:40 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:40 }}
              transition={{ type:"spring", damping:25, stiffness:300 }}>
              <div className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-white font-bold text-lg" style={{ fontFamily:"Space Grotesk,sans-serif" }}>{t("market.newPost")}</h3>
                  <button onClick={() => setShowForm(false)} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center"><X className="w-4 h-4 text-white"/></button>
                </div>
                <div className="space-y-3">
                  <input value={form.title} onChange={e => setForm(f=>({...f,title:e.target.value}))} placeholder={t("market.form.title")} className="w-full bg-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none placeholder-white/30" style={{ fontFamily:"Space Grotesk,sans-serif" }}/>
                  <textarea value={form.description} onChange={e => setForm(f=>({...f,description:e.target.value}))} placeholder={t("market.form.desc")} rows={3} className="w-full bg-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none placeholder-white/30 resize-none" style={{ fontFamily:"Space Grotesk,sans-serif" }}/>
                  <div className="grid grid-cols-2 gap-3">
                    <input value={form.price} onChange={e => setForm(f=>({...f,price:e.target.value}))} placeholder={t("market.form.price")} type="number" className="bg-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none placeholder-white/30" style={{ fontFamily:"Space Grotesk,sans-serif" }}/>
                    <input value={form.city} onChange={e => setForm(f=>({...f,city:e.target.value}))} placeholder={t("market.form.city")} className="bg-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none placeholder-white/30" style={{ fontFamily:"Space Grotesk,sans-serif" }}/>
                  </div>
                  <select value={form.subcategory} onChange={e => setForm(f=>({...f,subcategory:e.target.value}))} className="w-full bg-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none" style={{ fontFamily:"Space Grotesk,sans-serif" }}>
                    {SUBCATEGORIES.map(s => <option key={s} value={s} style={{ background:"#1a0a2e" }}>{s}</option>)}
                  </select>
                  <input value={form.contactInfo} onChange={e => setForm(f=>({...f,contactInfo:e.target.value}))} placeholder={t("market.form.contact")} className="w-full bg-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none placeholder-white/30" style={{ fontFamily:"Space Grotesk,sans-serif" }}/>
                  <input value={form.imageUrl} onChange={e => setForm(f=>({...f,imageUrl:e.target.value}))} placeholder={t("market.form.imageUrl")} className="w-full bg-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none placeholder-white/30" style={{ fontFamily:"Space Grotesk,sans-serif" }}/>
                  <button onClick={() => createPost.mutate()} disabled={!form.title || !form.description || createPost.isPending}
                    className="w-full py-3 rounded-xl font-bold text-white disabled:opacity-40"
                    style={{ background:"linear-gradient(135deg,#f97316,#ea580c)", fontFamily:"Space Grotesk,sans-serif" }}>
                    {createPost.isPending ? "..." : t("market.publish")}
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

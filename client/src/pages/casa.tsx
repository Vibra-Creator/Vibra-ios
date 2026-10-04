import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, X, MapPin, Phone, Trash2, ExternalLink, Home } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useLanguage } from "@/i18n/LanguageContext";
import { ReportContentButton } from "@/components/ReportContentButton";
import type { HubPost } from "@shared/schema";

const SUBCATEGORIES = ["Cerco stanza","Offro stanza","Cerco coinquilino","Subaffitto","Affitto breve","Altro"] as const;

const SUB_COLORS: Record<string, string> = {
  "Cerco stanza":"#06b6d4","Offro stanza":"#10b981","Cerco coinquilino":"#8b5cf6",
  "Subaffitto":"#f59e0b","Affitto breve":"#ec4899","Altro":"#6b7280",
};

const EXTERNAL = [
  { name:"Immobiliare.it", emoji:"🏠", desc:"Il portale leader", url:"https://www.immobiliare.it", color:"#e30613" },
  { name:"Idealista", emoji:"🔑", desc:"Annunci immobiliari", url:"https://www.idealista.it", color:"#f59e0b" },
  { name:"Subito Casa", emoji:"🏡", desc:"Annunci locali", url:"https://www.subito.it/case", color:"#e87722" },
  { name:"Airbnb", emoji:"🛎️", desc:"Affitti brevi", url:"https://www.airbnb.it", color:"#ff5a5f" },
];

export default function CasaPage() {
  const { t } = useLanguage();
  const [filter, setFilter] = useState("tutti");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title:"", description:"", price:"", subcategory:"Cerco stanza", city:"", contactInfo:"" });

  const { data: myProfile } = useQuery<{ id: string }>({ queryKey: ["/api/profiles/me"], queryFn: async () => { const r = await fetch("/api/profiles/me",{credentials:"include"}); return r.ok ? r.json() : null; }, retry: false });

  const { data: posts = [], isLoading } = useQuery<HubPost[]>({
    queryKey: ["/api/hub-posts", "casa", filter],
    queryFn: async () => {
      const params = new URLSearchParams({ category: "casa" });
      if (filter !== "tutti") params.set("subcategory", filter);
      const r = await fetch(`/api/hub-posts?${params}`, { credentials:"include" });
      return r.json();
    },
  });

  const createPost = useMutation({
    mutationFn: () => apiRequest("POST", "/api/hub-posts", { ...form, price: form.price ? parseInt(form.price) : undefined, category:"casa" }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/hub-posts"] }); setShowForm(false); setForm({ title:"", description:"", price:"", subcategory:"Cerco stanza", city:"", contactInfo:"" }); },
  });

  const deletePost = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/hub-posts/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/hub-posts"] }),
  });

  return (
    <div className="flex-1 overflow-y-auto pb-24" style={{ background:"transparent" }}>
      <div className="px-4 pt-4 max-w-lg mx-auto">
        <motion.div initial={{ opacity:0,y:-10 }} animate={{ opacity:1,y:0 }} className="mb-4">
          <div className="flex items-center gap-2 mb-1">
            <Home className="w-5 h-5 text-teal-400"/>
            <h1 className="text-white font-bold text-xl" style={{ fontFamily:"Space Grotesk,sans-serif" }}>{t("casa.title")}</h1>
          </div>
          <p className="text-white/40 text-sm">{t("casa.subtitle")}</p>
        </motion.div>

        {/* External portals */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          {EXTERNAL.map(e => (
            <motion.button key={e.name} onClick={() => window.open(e.url,"_blank")} whileTap={{ scale:0.96 }}
              className="flex items-center gap-2 rounded-xl px-3 py-2.5"
              style={{ background:`${e.color}18`, border:`1px solid ${e.color}30` }}>
              <span className="text-lg">{e.emoji}</span>
              <div className="text-left min-w-0">
                <p className="text-white font-semibold text-xs leading-tight truncate">{e.name}</p>
                <p className="text-white/40 text-[10px]">{e.desc}</p>
              </div>
              <ExternalLink className="w-3 h-3 text-white/30 shrink-0 ml-auto"/>
            </motion.button>
          ))}
        </div>

        {/* Filters */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide">
          {["tutti", ...SUBCATEGORIES].map(s => (
            <button key={s} onClick={() => setFilter(s)}
              className="shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
              style={{ background: filter === s ? "#14b8a6" : "rgba(255,255,255,0.08)", color: filter === s ? "#fff" : "rgba(255,255,255,0.5)" }}>
              {s === "tutti" ? t("casa.all") : s}
            </button>
          ))}
        </div>

        {/* Community posts */}
        <p className="text-white/40 text-xs font-semibold uppercase tracking-widest mb-3">{t("casa.community")}</p>

        {isLoading ? (
          <div className="flex justify-center py-12"><div className="w-8 h-8 rounded-full border-2 border-teal-400 border-t-transparent animate-spin"/></div>
        ) : posts.length === 0 ? (
          <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} className="text-center py-10">
            <span className="text-4xl">🏠</span>
            <p className="text-white/40 mt-3 text-sm">{t("casa.empty")}</p>
          </motion.div>
        ) : (
          <div className="space-y-3">
            {posts.map((post, i) => (
              <motion.div id={`hub-post-${post.id}`} key={post.id} initial={{ opacity:0,y:12 }} animate={{ opacity:1,y:0 }} transition={{ delay:i*0.04 }}
                className="rounded-2xl p-4"
                style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.08)" }}>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full mr-2"
                      style={{ background:`${SUB_COLORS[post.subcategory||"Altro"]}22`, color:SUB_COLORS[post.subcategory||"Altro"] }}>
                      {post.subcategory}
                    </span>
                    {post.price && <span className="text-teal-400 font-bold text-sm">€{post.price}/mese</span>}
                  </div>
                  {myProfile && post.profileId === myProfile.id && (
                    <button onClick={() => deletePost.mutate(post.id)} className="p-1.5 rounded-lg shrink-0" style={{ background:"rgba(239,68,68,0.12)" }}>
                      <Trash2 className="w-3.5 h-3.5 text-red-400"/>
                    </button>
                  )}
                </div>
                <p className="text-white font-semibold text-sm">{post.title}</p>
                <p className="text-white/50 text-xs mt-1">{post.description}</p>
                <div className="flex items-center justify-between mt-3">
                  <div className="flex items-center gap-2">
                    <img src={post.profileImageUrl} alt="" className="w-5 h-5 rounded-full object-cover"/>
                    <span className="text-white/40 text-xs">{post.profileName}</span>
                    {post.city && <span className="text-white/30 text-xs flex items-center gap-1"><MapPin className="w-2.5 h-2.5"/>{post.city}</span>}
                  </div>
                  {post.contactInfo && (
                    <a href={`tel:${post.contactInfo}`} className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg text-emerald-400" style={{ background:"rgba(16,185,129,0.12)" }}>
                      <Phone className="w-3 h-3"/>{t("casa.contact")}
                    </a>
                  )}
                  <ReportContentButton
                    reportedId={post.profileId}
                    contentType="hub_post"
                    contentId={post.id}
                    currentProfileId={myProfile?.id}
                    className="h-7 px-2 text-white/50 hover:text-red-300"
                  />
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* FAB */}
      <motion.button data-testid="casa-fab" onClick={() => setShowForm(true)}
        className="fixed bottom-24 right-4 w-14 h-14 rounded-full flex items-center justify-center shadow-2xl z-40"
        style={{ background:"linear-gradient(135deg,#14b8a6,#0f766e)" }}
        whileHover={{ scale:1.1 }} whileTap={{ scale:0.95 }}>
        <Plus className="w-6 h-6 text-white"/>
      </motion.button>

      {/* Form Modal */}
      <AnimatePresence>
        {showForm && (
          <>
            <motion.div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }} onClick={() => setShowForm(false)}/>
            <motion.div className="fixed inset-x-4 bottom-4 z-50 rounded-3xl overflow-y-auto max-h-[85vh]"
              style={{ background:"linear-gradient(135deg,#0f0a1e,#1a0a2e)" }}
              initial={{ opacity:0,y:40 }} animate={{ opacity:1,y:0 }} exit={{ opacity:0,y:40 }}
              transition={{ type:"spring",damping:25,stiffness:300 }}>
              <div className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-white font-bold text-lg" style={{ fontFamily:"Space Grotesk,sans-serif" }}>{t("casa.newPost")}</h3>
                  <button onClick={() => setShowForm(false)} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center"><X className="w-4 h-4 text-white"/></button>
                </div>
                <div className="space-y-3">
                  <select value={form.subcategory} onChange={e => setForm(f=>({...f,subcategory:e.target.value}))} className="w-full bg-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none" style={{ fontFamily:"Space Grotesk,sans-serif" }}>
                    {SUBCATEGORIES.map(s => <option key={s} value={s} style={{ background:"#1a0a2e" }}>{s}</option>)}
                  </select>
                  <input value={form.title} onChange={e => setForm(f=>({...f,title:e.target.value}))} placeholder={t("casa.form.title")} className="w-full bg-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none placeholder-white/30" style={{ fontFamily:"Space Grotesk,sans-serif" }}/>
                  <textarea value={form.description} onChange={e => setForm(f=>({...f,description:e.target.value}))} placeholder={t("casa.form.desc")} rows={3} className="w-full bg-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none placeholder-white/30 resize-none" style={{ fontFamily:"Space Grotesk,sans-serif" }}/>
                  <div className="grid grid-cols-2 gap-3">
                    <input value={form.price} onChange={e => setForm(f=>({...f,price:e.target.value}))} placeholder="€/mese" type="number" className="bg-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none placeholder-white/30" style={{ fontFamily:"Space Grotesk,sans-serif" }}/>
                    <input value={form.city} onChange={e => setForm(f=>({...f,city:e.target.value}))} placeholder={t("casa.form.city")} className="bg-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none placeholder-white/30" style={{ fontFamily:"Space Grotesk,sans-serif" }}/>
                  </div>
                  <input value={form.contactInfo} onChange={e => setForm(f=>({...f,contactInfo:e.target.value}))} placeholder={t("casa.form.contact")} className="w-full bg-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none placeholder-white/30" style={{ fontFamily:"Space Grotesk,sans-serif" }}/>
                  <button onClick={() => createPost.mutate()} disabled={!form.title || !form.description || createPost.isPending}
                    className="w-full py-3 rounded-xl font-bold text-white disabled:opacity-40"
                    style={{ background:"linear-gradient(135deg,#14b8a6,#0f766e)", fontFamily:"Space Grotesk,sans-serif" }}>
                    {createPost.isPending ? "..." : t("casa.publish")}
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

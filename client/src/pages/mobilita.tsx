import { useState } from "react";
import { motion } from "framer-motion";
import { ExternalLink, Navigation } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";

const SERVICES = [
  { name: "Uber", emoji: "🚗", desc: "Taxi e auto privata", color: ["#1a1a1a","#333"], url: "https://www.uber.com/it/it/ride/", category: "taxi" },
  { name: "FREE NOW", emoji: "🟡", desc: "Taxi in tutta Italia", color: ["#f59e0b","#d97706"], url: "https://www.free-now.com/it/", category: "taxi" },
  { name: "Google Maps", emoji: "🗺️", desc: "Trasporti pubblici", color: ["#4285f4","#1a73e8"], url: "https://www.google.com/maps/dir/?api=1&travelmode=transit", category: "transit" },
  { name: "Trenitalia", emoji: "🚆", desc: "Treni in Italia", color: ["#e30613","#b00000"], url: "https://www.trenitalia.com", category: "treno" },
  { name: "Italo", emoji: "🚄", desc: "Alta velocità", color: ["#d63384","#c2185b"], url: "https://www.italotreno.it", category: "treno" },
  { name: "BlaBlaCar", emoji: "🚗", desc: "Carpooling", color: ["#00b2e3","#0099cc"], url: "https://www.blablacar.it", category: "sharing" },
  { name: "Flixbus", emoji: "🚌", desc: "Autobus low cost", color: ["#73d700","#5cb800"], url: "https://www.flixbus.it", category: "bus" },
  { name: "Skyscanner", emoji: "✈️", desc: "Voli economici", color: ["#0770e3","#0055cc"], url: "https://www.skyscanner.it", category: "volo" },
  { name: "Ryanair", emoji: "✈️", desc: "Low cost", color: ["#004990","#003d7a"], url: "https://www.ryanair.com/it/it", category: "volo" },
  { name: "EasyJet", emoji: "🟠", desc: "Low cost europeo", color: ["#ff6600","#e65c00"], url: "https://www.easyjet.com/it", category: "volo" },
  { name: "Booking.com", emoji: "🏨", desc: "Hotel e alloggi", color: ["#003580","#002a66"], url: "https://www.booking.com", category: "hotel" },
  { name: "Airbnb", emoji: "🏠", desc: "Case e appartamenti", color: ["#ff5a5f","#e04247"], url: "https://www.airbnb.it", category: "hotel" },
];

const CATEGORIES = [
  { key: "tutti", label: "Tutti", emoji: "🌐" },
  { key: "taxi", label: "Taxi", emoji: "🚗" },
  { key: "treno", label: "Treno", emoji: "🚆" },
  { key: "bus", label: "Bus", emoji: "🚌" },
  { key: "sharing", label: "Sharing", emoji: "🤝" },
  { key: "volo", label: "Voli", emoji: "✈️" },
  { key: "hotel", label: "Hotel", emoji: "🏨" },
  { key: "transit", label: "Pubblici", emoji: "🗺️" },
];

export default function MobilitaPage() {
  const { t } = useLanguage();
  const [filter, setFilter] = useState("tutti");
  const [destination, setDestination] = useState("");

  const filtered = filter === "tutti" ? SERVICES : SERVICES.filter(s => s.category === filter);

  const openWithDest = (base: string) => {
    if (!destination.trim()) { window.open(base, "_blank"); return; }
    if (base.includes("google.com/maps")) {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}&travelmode=transit`, "_blank");
    } else if (base.includes("uber.com")) {
      window.open(`https://m.uber.com/ul/?action=setPickup&client_id=&dropoff[formatted_address]=${encodeURIComponent(destination)}`, "_blank");
    } else {
      window.open(base, "_blank");
    }
  };

  return (
    <div className="flex-1 overflow-y-auto pb-24" style={{ background:"transparent" }}>
      <div className="px-4 pt-4 max-w-lg mx-auto">
        <motion.div initial={{ opacity:0,y:-10 }} animate={{ opacity:1,y:0 }} className="mb-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">🚗</span>
            <h1 className="text-white font-bold text-xl" style={{ fontFamily:"Space Grotesk,sans-serif" }}>{t("mobility.title")}</h1>
          </div>
          <p className="text-white/40 text-sm">{t("mobility.subtitle")}</p>
        </motion.div>

        {/* Destination input */}
        <motion.div initial={{ opacity:0,y:8 }} animate={{ opacity:1,y:0 }} transition={{ delay:0.1 }}
          className="mb-4 flex items-center gap-2 bg-white/10 rounded-2xl px-4 py-3 border border-white/10">
          <Navigation className="w-4 h-4 text-white/40 shrink-0"/>
          <input value={destination} onChange={e => setDestination(e.target.value)}
            placeholder={t("mobility.destination")}
            className="flex-1 bg-transparent text-white text-sm outline-none placeholder-white/30"
            style={{ fontFamily:"Space Grotesk,sans-serif" }}/>
          {destination && <button onClick={() => setDestination("")} className="text-white/30 hover:text-white text-xs">✕</button>}
        </motion.div>

        {/* Category filters */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide">
          {CATEGORIES.map(c => (
            <button key={c.key} onClick={() => setFilter(c.key)}
              className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
              style={{ background: filter === c.key ? "#06b6d4" : "rgba(255,255,255,0.08)", color: filter === c.key ? "#fff" : "rgba(255,255,255,0.5)" }}>
              <span>{c.emoji}</span>{c.label}
            </button>
          ))}
        </div>

        {/* Service grid */}
        <div className="grid grid-cols-2 gap-3">
          {filtered.map((svc, i) => (
            <motion.button key={svc.name} initial={{ opacity:0,y:16 }} animate={{ opacity:1,y:0 }} transition={{ delay:i*0.05 }}
              onClick={() => openWithDest(svc.url)} whileTap={{ scale:0.96 }}
              className="rounded-2xl p-4 text-left relative overflow-hidden"
              style={{ background:`linear-gradient(135deg,${svc.color[0]}33,${svc.color[1]}22)`, border:`1px solid ${svc.color[0]}40` }}>
              <div className="absolute top-0 right-0 w-12 h-12 rounded-full opacity-20 -translate-y-3 translate-x-3"
                style={{ background:`radial-gradient(circle,${svc.color[0]},transparent)` }}/>
              <span className="text-2xl block mb-2">{svc.emoji}</span>
              <p className="text-white font-bold text-sm" style={{ fontFamily:"Space Grotesk,sans-serif" }}>{svc.name}</p>
              <p className="text-white/50 text-xs mt-0.5">{svc.desc}</p>
              <div className="flex items-center gap-1 mt-2 text-xs" style={{ color: svc.color[0] }}>
                <ExternalLink className="w-3 h-3"/>
                <span>{t("mobility.open")}</span>
              </div>
            </motion.button>
          ))}
        </div>

        {destination && (
          <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} className="mt-4 rounded-2xl p-4"
            style={{ background:"rgba(6,182,212,0.1)", border:"1px solid rgba(6,182,212,0.3)" }}>
            <p className="text-cyan-300 text-sm">📍 Destinazione: <span className="font-semibold">{destination}</span></p>
            <p className="text-white/40 text-xs mt-1">{t("mobility.destHint")}</p>
          </motion.div>
        )}
      </div>
    </div>
  );
}

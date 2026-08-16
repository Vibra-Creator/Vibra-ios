import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, MapPin, Euro, Search, ExternalLink } from "lucide-react";
import type { HubPost } from "@shared/schema";

const CITIES = [
  "Ovunque",
  "Agrigento","Alessandria","Ancona","Aosta","Arezzo","Ascoli Piceno",
  "Asti","Avellino","Bari","Barletta","Belluno","Benevento","Bergamo",
  "Biella","Bologna","Bolzano","Brescia","Brindisi","Cagliari",
  "Caltanissetta","Campobasso","Caserta","Catania","Catanzaro","Chieti",
  "Como","Cosenza","Cremona","Crotone","Cuneo","Enna","Fermo","Ferrara",
  "Firenze","Foggia","Forlì","Frosinone","Genova","Gorizia","Grosseto",
  "Imperia","Isernia","L'Aquila","La Spezia","Latina","Lecce","Lecco",
  "Livorno","Lodi","Lucca","Macerata","Mantova","Massa","Matera",
  "Messina","Milano","Modena","Monza","Napoli","Novara","Nuoro",
  "Oristano","Padova","Palermo","Parma","Pavia","Perugia","Pesaro",
  "Pescara","Piacenza","Pisa","Pistoia","Pordenone","Potenza","Prato",
  "Ragusa","Ravenna","Reggio Calabria","Reggio Emilia","Rieti","Rimini",
  "Roma","Rovigo","Salerno","Sassari","Savona","Siena","Siracusa",
  "Sondrio","Taranto","Teramo","Terni","Torino","Trapani","Trento",
  "Treviso","Trieste","Udine","Varese","Venezia","Verbania","Vercelli",
  "Verona","Vibo Valentia","Vicenza","Viterbo",
];

// Mapping città → slug Resident Advisor
const RA_SLUGS: Record<string, string> = {
  "Roma": "rome", "Milano": "milan", "Napoli": "naples", "Torino": "turin",
  "Firenze": "florence", "Bologna": "bologna", "Venezia": "venice",
  "Genova": "genoa", "Palermo": "palermo", "Bari": "bari",
  "Catania": "catania", "Verona": "verona", "Trieste": "trieste",
  "Padova": "padova", "Brescia": "brescia", "Cagliari": "cagliari",
  "Rimini": "rimini", "Reggio Emilia": "reggio-emilia",
  "Parma": "parma", "Modena": "modena", "Perugia": "perugia",
  "Bergamo": "bergamo", "Lecce": "lecce", "Pescara": "pescara",
  "Reggio Calabria": "reggio-calabria",
};

const BUDGETS = [
  { label: "Gratis", value: 0 },
  { label: "€10", value: 10 },
  { label: "€20", value: 20 },
  { label: "€50", value: 50 },
  { label: "Tutto", value: -1 },
];

type CatDef = {
  key: string;
  emoji: string;
  label: string;
  color: string;
  externalUrl: (city: string) => string;
  externalLabel: string;
};

const CATEGORIES: CatDef[] = [
  {
    key: "ristorante",
    emoji: "🍽️",
    label: "Ristoranti",
    color: "#f59e0b",
    externalUrl: (city) =>
      `https://www.google.com/maps/search/ristoranti+a+${encodeURIComponent(city === "Ovunque" ? "Italia" : city)}`,
    externalLabel: "Google Maps",
  },
  {
    key: "concerto",
    emoji: "🎵",
    label: "Concerti",
    color: "#ec4899",
    externalUrl: (city) =>
      `https://www.ticketone.it/search/?q=${encodeURIComponent(city === "Ovunque" ? "" : city)}&c=5010`,
    externalLabel: "TicketOne",
  },
  {
    key: "discoteca",
    emoji: "🎉",
    label: "Serate & Club",
    color: "#8b5cf6",
    externalUrl: (city) => {
      const slug = RA_SLUGS[city];
      if (slug) return `https://ra.co/events/it/${slug}`;
      return `https://www.google.com/maps/search/discoteche+club+${encodeURIComponent(city === "Ovunque" ? "Italia" : city)}`;
    },
    externalLabel: "RA / Maps",
  },
  {
    key: "cinema",
    emoji: "🎬",
    label: "Cinema",
    color: "#06b6d4",
    externalUrl: (city) =>
      city === "Ovunque"
        ? "https://www.mymovies.it"
        : `https://www.mymovies.it/cinema/${city.toLowerCase()}/`,
    externalLabel: "MYmovies",
  },
  {
    key: "sagra",
    emoji: "🎪",
    label: "Sagre & Feste",
    color: "#10b981",
    externalUrl: (city) =>
      `https://www.eventbrite.it/d/italy--${city === "Ovunque" ? "italia" : city.toLowerCase()}/events/?q=sagra`,
    externalLabel: "Eventbrite",
  },
  {
    key: "fiera",
    emoji: "🎡",
    label: "Fiere & Mercati",
    color: "#f97316",
    externalUrl: (city) =>
      `https://www.eventbrite.it/d/italy--${city === "Ovunque" ? "italia" : city.toLowerCase()}/events/?q=fiera`,
    externalLabel: "Eventbrite",
  },
  {
    key: "aperitivo",
    emoji: "🍹",
    label: "Aperitivi",
    color: "#e879f9",
    externalUrl: (city) =>
      `https://www.google.com/maps/search/aperitivo+musica+dal+vivo+${city === "Ovunque" ? "" : encodeURIComponent(city)}`,
    externalLabel: "Google Maps",
  },
  {
    key: "lastminute",
    emoji: "✈️",
    label: "Last Minute",
    color: "#3b82f6",
    externalUrl: (city) => {
      const dest = city === "Ovunque" ? "Italia" : city;
      const today = new Date().toISOString().slice(0, 10).replace(/-/g, "-");
      return `https://www.booking.com/searchresults.it.html?ss=${encodeURIComponent(dest)}&checkin=${today}&checkout=${today}&order=price`;
    },
    externalLabel: "Booking.com",
  },
  {
    key: "weekend",
    emoji: "🏕️",
    label: "Weekend",
    color: "#84cc16",
    externalUrl: (city) =>
      `https://www.booking.com/searchresults.it.html?ss=${encodeURIComponent(city === "Ovunque" ? "Italia" : city)}`,
    externalLabel: "Booking.com",
  },
];

export default function CosaFarePage() {
  const [, setLocation] = useLocation();
  const [selectedCity, setSelectedCity] = useState("Ovunque");
  const [selectedBudget, setSelectedBudget] = useState(-1);
  const [searched, setSearched] = useState(false);

  const { data: posts = [], isFetching, refetch } = useQuery<HubPost[]>({
    queryKey: ["/api/cosa-fare", selectedCity, selectedBudget],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedCity !== "Ovunque") params.set("city", selectedCity);
      if (selectedBudget >= 0) params.set("max_price", String(selectedBudget));
      const r = await fetch(`/api/cosa-fare?${params}`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: false,
    retry: false,
  });

  const handleSearch = () => {
    setSearched(true);
    refetch();
  };

  return (
    <div className="flex-1 overflow-y-auto pb-24" style={{ background: "transparent" }}>
      <div className="px-4 pt-4 max-w-lg mx-auto">

        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <button
            onClick={() => setLocation("/hub")}
            className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
            style={{ background: "rgba(255,255,255,0.08)" }}
          >
            <ArrowLeft className="w-4 h-4 text-white" />
          </button>
          <div>
            <h1 className="text-white font-bold text-xl" style={{ fontFamily: "Space Grotesk, sans-serif" }}>
              🎯 Cosa faccio?
            </h1>
            <p className="text-white/40 text-xs">Scegli città e budget, trova la tua serata</p>
          </div>
        </div>

        {/* City selector */}
        <div className="mb-4">
          <div className="flex items-center gap-1.5 mb-2">
            <MapPin className="w-3.5 h-3.5 text-purple-400" />
            <p className="text-white/60 text-xs font-semibold uppercase tracking-wider">Città</p>
          </div>
          <div className="relative">
            <select
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              className="w-full appearance-none rounded-xl px-4 py-3 text-sm font-semibold pr-10"
              style={{
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(139,92,246,0.35)",
                color: "#fff",
                outline: "none",
              }}
            >
              {CITIES.map((city) => (
                <option key={city} value={city} style={{ background: "#1a1035", color: "#fff" }}>
                  {city === "Ovunque" ? "📍 Ovunque in Italia" : city}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
              <svg className="w-4 h-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>

        {/* Budget selector */}
        <div className="mb-5">
          <div className="flex items-center gap-1.5 mb-2">
            <Euro className="w-3.5 h-3.5 text-emerald-400" />
            <p className="text-white/60 text-xs font-semibold uppercase tracking-wider">Budget massimo</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {BUDGETS.map((b) => (
              <button
                key={b.value}
                onClick={() => setSelectedBudget(b.value)}
                className="px-4 py-2 rounded-full text-sm font-semibold transition-all"
                style={{
                  background:
                    selectedBudget === b.value
                      ? "linear-gradient(135deg,#10b981,#059669)"
                      : "rgba(255,255,255,0.08)",
                  color: selectedBudget === b.value ? "#fff" : "rgba(255,255,255,0.5)",
                }}
              >
                {b.label}
              </button>
            ))}
          </div>
        </div>

        {/* Category grid — external platforms */}
        <p className="text-white/40 text-xs font-semibold uppercase tracking-widest mb-3">
          Esplora per categoria
        </p>
        <div className="grid grid-cols-3 gap-3 mb-6">
          {CATEGORIES.map((cat, i) => (
            <motion.a
              key={cat.key}
              href={cat.externalUrl(selectedCity)}
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              whileTap={{ scale: 0.93 }}
              className="relative rounded-2xl p-3 text-center flex flex-col items-center gap-1 overflow-hidden"
              style={{
                background: `linear-gradient(135deg, ${cat.color}22, ${cat.color}10)`,
                border: `1px solid ${cat.color}35`,
                textDecoration: "none",
              }}
            >
              <div
                className="absolute top-0 right-0 w-12 h-12 rounded-full opacity-15 -translate-y-3 translate-x-3"
                style={{ background: `radial-gradient(circle, ${cat.color}, transparent)` }}
              />
              <span className="text-2xl">{cat.emoji}</span>
              <p
                className="text-white text-[10px] font-bold leading-tight"
                style={{ fontFamily: "Space Grotesk, sans-serif" }}
              >
                {cat.label}
              </p>
              <span className="text-[9px] text-white/30 flex items-center gap-0.5">
                {cat.externalLabel} <ExternalLink className="w-2 h-2 inline" />
              </span>
            </motion.a>
          ))}
        </div>

        {/* Community offers */}
        <div
          className="rounded-2xl p-4 mb-6"
          style={{
            background: "rgba(139,92,246,0.08)",
            border: "1px solid rgba(139,92,246,0.22)",
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <div>
              <p
                className="text-white font-semibold text-sm"
                style={{ fontFamily: "Space Grotesk, sans-serif" }}
              >
                Offerte della community
              </p>
              <p className="text-white/40 text-xs mt-0.5">
                Inserite dagli utenti Vibra con città e prezzo
              </p>
            </div>
            <button
              onClick={handleSearch}
              disabled={isFetching}
              className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl text-white shrink-0"
              style={{ background: "linear-gradient(135deg,#8b5cf6,#ec4899)" }}
            >
              {isFetching ? (
                <div className="w-3 h-3 border border-white/60 border-t-white rounded-full animate-spin" />
              ) : (
                <Search className="w-3 h-3" />
              )}
              Filtra
            </button>
          </div>

          <AnimatePresence mode="wait">
            {!searched && (
              <motion.p
                key="hint"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-white/25 text-xs text-center py-6"
              >
                Seleziona città e budget, poi tocca "Filtra"
              </motion.p>
            )}

            {searched && isFetching && (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex justify-center py-6"
              >
                <div className="w-6 h-6 rounded-full border-2 border-purple-400 border-t-transparent animate-spin" />
              </motion.div>
            )}

            {searched && !isFetching && posts.length === 0 && (
              <motion.p
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-white/30 text-xs text-center py-6"
              >
                Nessuna offerta trovata. Usa i link sopra per esplorare!
              </motion.p>
            )}

            {searched && !isFetching && posts.length > 0 && (
              <motion.div
                key="results"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col gap-3"
              >
                {posts.map((post, i) => {
                  const cat = CATEGORIES.find((c) => c.key === post.category);
                  return (
                    <motion.div
                      key={post.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className="rounded-xl p-3"
                      style={{
                        background: "rgba(255,255,255,0.05)",
                        border: "1px solid rgba(255,255,255,0.09)",
                      }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span className="text-xl shrink-0">{cat?.emoji ?? "📌"}</span>
                          <div className="min-w-0">
                            <p className="text-white font-semibold text-sm leading-tight truncate">
                              {post.title}
                            </p>
                            <p className="text-white/40 text-xs mt-0.5 line-clamp-2">
                              {post.description}
                            </p>
                          </div>
                        </div>
                        {post.price != null && (
                          <span className="text-emerald-400 font-bold text-sm shrink-0">
                            {post.price === 0 ? "Gratis" : `€${post.price}`}
                          </span>
                        )}
                      </div>
                      {post.city && (
                        <div className="flex items-center gap-1 mt-2">
                          <MapPin className="w-3 h-3 text-white/30" />
                          <span className="text-white/30 text-xs">{post.city}</span>
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

      </div>
    </div>
  );
}

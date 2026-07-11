import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Music2, ExternalLink, Headphones, Mic2, Radio, Heart, Zap, Star } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";

const DEMO_ARTISTS = [
  { name: "The Weeknd", genre: "R&B / Pop", emoji: "🌙" },
  { name: "Dua Lipa", genre: "Pop / Dance", emoji: "💃" },
  { name: "Bad Bunny", genre: "Reggaeton", emoji: "🐰" },
  { name: "Arctic Monkeys", genre: "Indie Rock", emoji: "🎸" },
  { name: "Rosalía", genre: "Flamenco / Pop", emoji: "🌹" },
  { name: "Frank Ocean", genre: "R&B / Soul", emoji: "🌊" },
];

const GENRES = [
  { label: "Pop", color: "from-pink-500 to-rose-500", pct: 34 },
  { label: "R&B", color: "from-purple-500 to-violet-600", pct: 22 },
  { label: "Indie", color: "from-blue-500 to-cyan-500", pct: 18 },
  { label: "Hip-hop", color: "from-yellow-500 to-orange-500", pct: 15 },
  { label: "Electronic", color: "from-green-500 to-teal-500", pct: 11 },
];

const VIBE_MATCHES = [
  { name: "Sofia", avatar: "🛸", pct: 92, genres: ["Pop", "Indie"] },
  { name: "Luca", avatar: "🌙", pct: 87, genres: ["R&B", "Soul"] },
  { name: "Mia", avatar: "✨", pct: 78, genres: ["Electronic", "Pop"] },
];

export default function SpotifyPage() {
  const { t } = useLanguage();
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    document.title = "Vibra — Spotify";
  }, []);

  const handleConnect = () => {
    setConnecting(true);
    setTimeout(() => {
      setConnected(true);
      setConnecting(false);
    }, 1800);
  };

  return (
    <div className="flex-1 overflow-y-auto pb-24" style={{ background: "transparent" }}>
      <div className="px-4 pt-4 max-w-lg mx-auto space-y-5">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">🎵</span>
            <h1 className="text-white font-bold text-xl" style={{ fontFamily: "Space Grotesk, sans-serif" }}>
              {t("spotify.title")}
            </h1>
          </div>
          <p className="text-white/55 text-sm">{t("spotify.subtitle")}</p>
        </motion.div>

        {/* Connect card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl overflow-hidden"
          style={{ background: "linear-gradient(135deg,#1DB954,#158a3e)", boxShadow: "0 8px 32px rgba(29,185,84,0.35)" }}
        >
          <div className="p-5 flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-black/30 flex items-center justify-center shrink-0">
              <svg viewBox="0 0 168 168" className="w-8 h-8" fill="white">
                <path d="M84 0C37.6 0 0 37.6 0 84s37.6 84 84 84 84-37.6 84-84S130.4 0 84 0zm38.6 121.2c-1.5 2.5-4.8 3.3-7.3 1.7-20-12.2-45.2-15-74.9-8.2-2.9.7-5.7-1.1-6.4-4-.7-2.9 1.1-5.7 4-6.4 32.5-7.4 60.4-4.2 82.9 9.6 2.5 1.5 3.2 4.8 1.7 7.3zm10.3-22.8c-1.9 3.1-5.9 4-9 2.1-22.9-14.1-57.8-18.2-84.9-9.9-3.4 1-7.1-.9-8.2-4.3-1-3.4.9-7.1 4.3-8.2 31-9.4 69.5-4.8 95.7 11.3 3.1 1.9 4.1 5.9 2.1 9zm.9-23.7c-27.5-16.3-72.8-17.8-99-9.8-4.1 1.2-8.4-1.1-9.6-5.2-1.2-4.1 1.1-8.4 5.2-9.6 30.1-9.1 80.1-7.4 111.7 11.3 3.7 2.2 4.9 6.9 2.8 10.6-2.2 3.7-7 4.9-10.6 2.7l-.5-.0z"/>
              </svg>
            </div>
            <div className="flex-1">
              {connected ? (
                <>
                  <p className="text-white font-bold text-base">{t("spotify.connected")}</p>
                  <p className="text-white/70 text-xs mt-0.5">famax61 · Premium</p>
                </>
              ) : (
                <>
                  <p className="text-white font-bold text-base">{t("spotify.connect")}</p>
                  <p className="text-white/70 text-xs mt-0.5">Mostra la tua musica ai match</p>
                </>
              )}
            </div>
            {connected ? (
              <button
                onClick={() => setConnected(false)}
                className="px-3 py-1.5 rounded-xl bg-black/30 text-white/70 text-xs font-semibold"
                data-testid="button-spotify-disconnect"
              >
                {t("spotify.disconnect")}
              </button>
            ) : (
              <button
                onClick={handleConnect}
                disabled={connecting}
                className="px-4 py-2 rounded-xl bg-black/30 text-white font-bold text-sm active:scale-95 transition-all disabled:opacity-60"
                data-testid="button-spotify-connect"
              >
                {connecting ? "..." : "Collega"}
              </button>
            )}
          </div>

          {/* Now playing bar */}
          {connected && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="border-t border-white/20 px-5 py-3 flex items-center gap-3"
            >
              <div className="w-8 h-8 rounded-lg bg-black/40 flex items-center justify-center shrink-0">
                <Music2 className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-xs font-semibold truncate">Blinding Lights</p>
                <p className="text-white/60 text-xs truncate">The Weeknd</p>
              </div>
              <div className="flex gap-0.5 items-end shrink-0">
                {[3,5,4,6,3,5,4].map((h, i) => (
                  <motion.div
                    key={i}
                    className="w-1 rounded-full bg-white/80"
                    animate={{ height: [h * 2, h * 4, h * 2] }}
                    transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.1 }}
                    style={{ height: h * 2 }}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </motion.div>

        {/* Vibe Match */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-4 h-4 text-yellow-400" />
            <h2 className="text-white font-bold text-sm" style={{ fontFamily: "Space Grotesk, sans-serif" }}>
              {t("spotify.vibeMatch")}
            </h2>
          </div>
          <div className="space-y-3">
            {VIBE_MATCHES.map((m, i) => (
              <motion.div
                key={m.name}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.25 + i * 0.07 }}
                className="rounded-2xl p-3.5 flex items-center gap-3"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
              >
                <div className="w-11 h-11 rounded-2xl bg-white/10 flex items-center justify-center text-xl shrink-0">
                  {m.avatar}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-white font-semibold text-sm">{m.name}</span>
                    <span className="text-green-400 font-bold text-sm">{m.pct}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: "linear-gradient(90deg,#1DB954,#158a3e)" }}
                      initial={{ width: 0 }}
                      animate={{ width: `${m.pct}%` }}
                      transition={{ duration: 0.8, delay: 0.4 + i * 0.1 }}
                    />
                  </div>
                  <div className="flex gap-1 mt-1.5">
                    {m.genres.map(g => (
                      <span key={g} className="text-xs px-2 py-0.5 rounded-full bg-green-500/15 text-green-300 border border-green-500/25">{g}</span>
                    ))}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Top Artists */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <div className="flex items-center gap-2 mb-3">
            <Star className="w-4 h-4 text-yellow-400" />
            <h2 className="text-white font-bold text-sm" style={{ fontFamily: "Space Grotesk, sans-serif" }}>
              {t("spotify.topArtists")}
            </h2>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {DEMO_ARTISTS.map((a, i) => (
              <motion.div
                key={a.name}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.35 + i * 0.05 }}
                className="rounded-2xl p-3 text-center"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
              >
                <div className="text-2xl mb-1">{a.emoji}</div>
                <p className="text-white font-semibold text-xs leading-tight">{a.name}</p>
                <p className="text-white/40 text-xs mt-0.5">{a.genre}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Genres */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <div className="flex items-center gap-2 mb-3">
            <Radio className="w-4 h-4 text-purple-400" />
            <h2 className="text-white font-bold text-sm" style={{ fontFamily: "Space Grotesk, sans-serif" }}>
              {t("spotify.genres")}
            </h2>
          </div>
          <div className="rounded-2xl p-4 space-y-3" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
            {GENRES.map((g, i) => (
              <div key={g.label}>
                <div className="flex justify-between mb-1">
                  <span className="text-white/80 text-xs font-semibold">{g.label}</span>
                  <span className="text-white/40 text-xs">{g.pct}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <motion.div
                    className={`h-full rounded-full bg-gradient-to-r ${g.color}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${g.pct}%` }}
                    transition={{ duration: 0.7, delay: 0.5 + i * 0.08 }}
                  />
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Open Spotify CTA */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
          <a
            href="https://open.spotify.com"
            target="_blank"
            rel="noopener noreferrer"
            data-testid="link-open-spotify"
            className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl text-white font-bold text-sm active:scale-95 transition-all"
            style={{ background: "linear-gradient(135deg,#1DB954,#158a3e)", boxShadow: "0 4px 20px rgba(29,185,84,0.3)" }}
          >
            <ExternalLink className="w-4 h-4" />
            {t("spotify.openSpotify")}
          </a>
        </motion.div>

        {/* Coming soon note */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="rounded-2xl p-4 text-center"
          style={{ background: "rgba(29,185,84,0.08)", border: "1px solid rgba(29,185,84,0.2)" }}
        >
          <Headphones className="w-6 h-6 text-green-400 mx-auto mb-2" />
          <p className="text-green-300 text-xs font-semibold">Integrazione Spotify in arrivo</p>
          <p className="text-white/40 text-xs mt-1">La sincronizzazione vera con il tuo account Spotify sarà disponibile presto.</p>
        </motion.div>

      </div>
    </div>
  );
}

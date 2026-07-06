import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ExternalLink, Save, Check } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/i18n/LanguageContext";
import { useToast } from "@/hooks/use-toast";

const PLATFORMS = [
  {
    key: "instagramHandle",
    label: "Instagram",
    emoji: "📸",
    prefix: "@",
    placeholder: "tuonome",
    profileUrl: (v: string) => `https://instagram.com/${v}`,
    gradient: "linear-gradient(135deg,#833ab4,#fd1d1d,#fcb045)",
    shadow: "rgba(253,29,29,0.3)",
  },
  {
    key: "tiktokHandle",
    label: "TikTok",
    emoji: "🎵",
    prefix: "@",
    placeholder: "tuonome",
    profileUrl: (v: string) => `https://tiktok.com/@${v}`,
    gradient: "linear-gradient(135deg,#010101,#69C9D0)",
    shadow: "rgba(105,201,208,0.3)",
  },
  {
    key: "facebookUrl",
    label: "Facebook",
    emoji: "👤",
    prefix: "",
    placeholder: "https://facebook.com/tuonome",
    profileUrl: (v: string) => v,
    gradient: "linear-gradient(135deg,#1877f2,#0d5db8)",
    shadow: "rgba(24,119,242,0.3)",
  },
] as const;

function ShareRow({ profileId, profileName }: { profileId: string; profileName: string }) {
  const url = `https://vibraalienmatch.com/p/${profileId}`;

  const share = (platform: string) => {
    if (platform === "facebook") {
      window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, "_blank");
      return;
    }
    if (navigator.share) {
      navigator.share({ title: `${profileName} su Vibra`, text: "Trovami su Vibra 🛸", url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url).then(() => {});
    }
  };

  return (
    <div className="rounded-2xl p-4 space-y-3" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
      <p className="text-white font-semibold text-sm" style={{ fontFamily: "Space Grotesk,sans-serif" }}>
        🔗 Condividi il tuo profilo Vibra
      </p>
      <div className="bg-black/30 rounded-xl px-3 py-2.5 flex items-center gap-2">
        <span className="text-white/40 text-xs truncate flex-1 select-all">{url}</span>
        <button
          onClick={() => navigator.clipboard.writeText(url)}
          className="text-purple-400 text-xs font-semibold shrink-0"
          data-testid="button-copy-profile-link"
        >
          Copia
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Instagram", emoji: "📸", platform: "instagram", gradient: "linear-gradient(135deg,#833ab4,#fd1d1d,#fcb045)" },
          { label: "TikTok",    emoji: "🎵", platform: "tiktok",    gradient: "linear-gradient(135deg,#010101,#69C9D0)" },
          { label: "Facebook",  emoji: "👤", platform: "facebook",  gradient: "linear-gradient(135deg,#1877f2,#0d5db8)" },
        ].map(s => (
          <button
            key={s.platform}
            onClick={() => share(s.platform)}
            data-testid={`button-share-${s.platform}`}
            className="flex flex-col items-center gap-1.5 py-3 rounded-xl text-white text-xs font-semibold active:scale-95 transition-all"
            style={{ background: s.gradient }}
          >
            <span className="text-xl">{s.emoji}</span>
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function SocialPage() {
  const { t } = useLanguage();
  const { toast } = useToast();

  const { data: profile } = useQuery<any>({
    queryKey: ["/api/profiles/me"],
    queryFn: async () => {
      const r = await fetch("/api/profiles/me", { credentials: "include" });
      return r.ok ? r.json() : null;
    },
    retry: false,
  });

  const [values, setValues] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  const currentValue = (key: string) =>
    key in values ? values[key] : (profile?.[key] ?? "");

  const saveMutation = useMutation({
    mutationFn: () =>
      apiRequest("PATCH", `/api/profiles/${profile.id}`, {
        instagramHandle: currentValue("instagramHandle"),
        tiktokHandle: currentValue("tiktokHandle"),
        facebookUrl: currentValue("facebookUrl"),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profiles/me"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      toast({ title: "Social salvati!", description: "I tuoi link social sono stati aggiornati." });
    },
    onError: () => toast({ title: "Errore", description: "Riprova.", variant: "destructive" }),
  });

  const hasChanges = Object.keys(values).length > 0;

  return (
    <div className="flex-1 overflow-y-auto pb-24" style={{ background: "transparent" }}>
      <div className="px-4 pt-4 max-w-lg mx-auto space-y-4">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">📱</span>
            <h1 className="text-white font-bold text-xl" style={{ fontFamily: "Space Grotesk,sans-serif" }}>
              Social
            </h1>
          </div>
          <p className="text-white/40 text-sm">Collega i tuoi profili social a Vibra</p>
        </motion.div>

        {/* Social platform cards */}
        <div className="space-y-3">
          {PLATFORMS.map((p, i) => {
            const val = currentValue(p.key);
            const hasVal = val.trim().length > 0;
            return (
              <motion.div
                key={p.key}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                className="rounded-2xl p-4 space-y-3"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)",
                }}
              >
                {/* Platform header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-lg"
                      style={{ background: p.gradient }}
                    >
                      {p.emoji}
                    </div>
                    <div>
                      <p className="text-white font-semibold text-sm" style={{ fontFamily: "Space Grotesk,sans-serif" }}>
                        {p.label}
                      </p>
                      <p className="text-white/40 text-xs">
                        {hasVal ? "Collegato ✓" : "Non collegato"}
                      </p>
                    </div>
                  </div>
                  {hasVal && (
                    <a
                      href={p.profileUrl(val)}
                      target="_blank"
                      rel="noopener noreferrer"
                      data-testid={`link-open-${p.key}`}
                      className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg font-semibold text-white"
                      style={{ background: p.gradient }}
                    >
                      <ExternalLink className="w-3 h-3" />
                      Apri
                    </a>
                  )}
                </div>

                {/* Input */}
                <div className="flex items-center bg-black/30 rounded-xl px-3 py-2.5 gap-2 border border-white/10 focus-within:border-white/30 transition-all">
                  {p.prefix && (
                    <span className="text-white/40 text-sm shrink-0">{p.prefix}</span>
                  )}
                  <input
                    value={val}
                    onChange={e => setValues(v => ({ ...v, [p.key]: e.target.value }))}
                    placeholder={p.placeholder}
                    data-testid={`input-social-${p.key}`}
                    className="flex-1 bg-transparent text-white text-sm outline-none placeholder-white/30"
                    style={{ fontFamily: "Space Grotesk,sans-serif" }}
                  />
                  {val.trim() && (
                    <button
                      onClick={() => setValues(v => ({ ...v, [p.key]: "" }))}
                      className="text-white/30 hover:text-white text-xs shrink-0"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Save button */}
        <motion.button
          onClick={() => saveMutation.mutate()}
          disabled={!profile || saveMutation.isPending}
          data-testid="button-save-social"
          className="w-full py-3.5 rounded-2xl font-bold text-white flex items-center justify-center gap-2 disabled:opacity-40"
          style={{ background: "linear-gradient(135deg,#8b5cf6,#ec4899)", fontFamily: "Space Grotesk,sans-serif" }}
          whileTap={{ scale: 0.97 }}
        >
          {saveMutation.isPending ? (
            <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
          ) : saved ? (
            <><Check className="w-4 h-4" /> Salvato!</>
          ) : (
            <><Save className="w-4 h-4" /> Salva Social</>
          )}
        </motion.button>

        {/* Share profile section */}
        {profile && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
            <ShareRow profileId={profile.id} profileName={profile.name} />
          </motion.div>
        )}

        {/* Info box */}
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
          className="rounded-2xl p-4 space-y-2"
          style={{ background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.2)" }}
        >
          <p className="text-purple-300 text-sm font-semibold">💡 Come funziona</p>
          <ul className="text-white/50 text-xs space-y-1.5">
            <li>• I tuoi handle appariranno sul tuo profilo come badge cliccabili</li>
            <li>• Gli altri utenti potranno seguirti direttamente su Instagram e TikTok</li>
            <li>• Il bottone "Condividi" manda il link del tuo profilo Vibra</li>
            <li>• Su TikTok/Instagram puoi incollare il tuo link Vibra nella bio</li>
          </ul>
        </motion.div>

      </div>
    </div>
  );
}

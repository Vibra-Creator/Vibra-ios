import { useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { MapPin, Sparkles, BadgeCheck, Heart, Star, Zap, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface PublicProfile {
  id: string;
  name: string;
  age: number;
  imageUrl: string;
  photos: string[];
  bio: string;
  location: string;
  interests: string[];
  alienType: string;
  isVerified: boolean | null;
  profileVideoUrl: string | null;
  height: number | null;
  zodiacSign: string | null;
  loveLanguage: string | null;
  education: string | null;
  lifestyle: string | null;
}

export default function PublicProfile() {
  const params = useParams<{ profileId: string }>();
  const profileId = params.profileId;
  const [, navigate] = useLocation();

  const { data: profile, isLoading, isError } = useQuery<PublicProfile>({
    queryKey: [`/api/public/profile/${profileId}`],
    enabled: !!profileId,
    staleTime: 60_000,
    retry: false,
  });

  useEffect(() => {
    if (!profile) return;
    document.title = `${profile.name}, ${profile.age} su Vibra`;
    const setMeta = (property: string, content: string) => {
      let el = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement | null;
      if (!el) { el = document.createElement("meta"); el.setAttribute("property", property); document.head.appendChild(el); }
      el.setAttribute("content", content);
    };
    const setNameMeta = (name: string, content: string) => {
      let el = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
      if (!el) { el = document.createElement("meta"); el.setAttribute("name", name); document.head.appendChild(el); }
      el.setAttribute("content", content);
    };
    const desc = `${profile.name}, ${profile.age} anni${profile.location ? ` · ${profile.location}` : ""}${profile.alienType ? ` · ${profile.alienType}` : ""}. Scopri il suo profilo su Vibra.`;
    setMeta("og:title", `${profile.name}, ${profile.age} — Vibra`);
    setMeta("og:description", desc);
    setMeta("og:image", profile.imageUrl);
    setMeta("og:type", "profile");
    setMeta("og:url", `${window.location.origin}/p/${profile.id}`);
    setNameMeta("description", desc);
    setNameMeta("twitter:card", "summary_large_image");
    setNameMeta("twitter:title", `${profile.name}, ${profile.age} — Vibra`);
    setNameMeta("twitter:description", desc);
    setNameMeta("twitter:image", profile.imageUrl);
  }, [profile]);

  useEffect(() => {
    if (!profile || window.location.hash !== "#profile-media") return;
    const timeout = window.setTimeout(() => {
      document.getElementById("profile-media")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
    return () => window.clearTimeout(timeout);
  }, [profile]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#0a0118" }}>
        <div className="w-12 h-12 rounded-full border-4 border-purple-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (isError || !profile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-6" style={{ background: "#0a0118" }}>
        <div className="text-6xl">🛸</div>
        <h1 className="text-2xl font-bold text-white text-center">Profilo non trovato</h1>
        <p className="text-white/60 text-center max-w-xs">Questo profilo potrebbe essere stato rimosso o non è più disponibile.</p>
        <Button
          onClick={() => navigate("/")}
          className="bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-90"
          data-testid="button-goto-vibra"
        >
          Vai su Vibra
        </Button>
      </div>
    );
  }

  const allPhotos = [profile.imageUrl, ...profile.photos].filter(Boolean);

  return (
    <div className="min-h-screen" style={{ background: "#0a0118" }}>
      {/* Stars background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {Array.from({ length: 60 }).map((_, i) => (
          <div key={i} className="absolute rounded-full bg-white animate-pulse"
            style={{
              width: `${Math.random() * 2 + 1}px`, height: `${Math.random() * 2 + 1}px`,
              top: `${Math.random() * 100}%`, left: `${Math.random() * 100}%`,
              opacity: Math.random() * 0.6 + 0.1,
              animationDelay: `${Math.random() * 3}s`, animationDuration: `${2 + Math.random() * 3}s`,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 max-w-lg mx-auto pb-32" id="profile-media">
        {/* Hero image */}
        <div className="relative">
          <div className="aspect-[3/4] overflow-hidden">
            {profile.profileVideoUrl ? (
              <video
                src={profile.profileVideoUrl.startsWith("/objects/")
                  ? `/api/video-stream-object?path=${encodeURIComponent(profile.profileVideoUrl)}`
                  : profile.profileVideoUrl.startsWith("https://") || profile.profileVideoUrl.startsWith("http://")
                  ? `/api/video-proxy?url=${encodeURIComponent(profile.profileVideoUrl)}`
                  : profile.profileVideoUrl}
                autoPlay loop playsInline muted
                poster={profile.imageUrl}
                className="w-full h-full object-cover object-top"
                data-testid="public-profile-video"
              />
            ) : (
              <img src={profile.imageUrl} alt={profile.name}
                className="w-full h-full object-cover object-top"
                data-testid="public-profile-image" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-[#0a0118] via-black/20 to-transparent" />
          </div>

          {/* Vibra watermark */}
          <div className="absolute top-4 left-4 flex items-center gap-2 bg-black/50 backdrop-blur-md rounded-full px-3 py-1.5"
            data-testid="vibra-watermark">
            <span className="text-lg">🛸</span>
            <span className="text-white font-bold text-sm tracking-wide">Vibra</span>
          </div>

          {/* Name overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-6">
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-4xl font-bold text-white" data-testid="public-profile-name">
                {profile.name}, {profile.age}
              </h1>
              {profile.isVerified && <BadgeCheck className="w-6 h-6 text-blue-400 shrink-0" />}
            </div>
            {profile.location && (
              <div className="flex items-center gap-1.5 text-white/75 mb-2">
                <MapPin className="w-4 h-4" />
                <span className="text-base">{profile.location}</span>
              </div>
            )}
            {profile.alienType && (
              <Badge className="bg-purple-600/80 text-white border-purple-400/40 backdrop-blur-sm">
                <Sparkles className="w-3 h-3 mr-1" />
                {profile.alienType}
              </Badge>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="px-5 pt-6 space-y-6">
          {/* Bio */}
          {profile.bio && (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
              className="p-4 rounded-2xl bg-white/5 border border-white/10">
              <p className="text-white/80 text-base leading-relaxed" data-testid="public-profile-bio">
                {profile.bio}
              </p>
            </motion.div>
          )}

          {/* Extra photos */}
          {allPhotos.length > 1 && (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
              <div className="grid grid-cols-3 gap-2">
                {allPhotos.slice(1, 4).map((photo, idx) => (
                  <div key={idx} className="aspect-square rounded-xl overflow-hidden border border-white/10">
                    <img src={photo} alt="" className="w-full h-full object-cover object-top" loading="lazy" />
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Interests */}
          {profile.interests.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-400" />
                Interessi
              </h3>
              <div className="flex flex-wrap gap-2">
                {profile.interests.map((interest, idx) => (
                  <Badge key={idx} variant="outline" className="bg-white/10 text-white border-white/20 text-sm">
                    {interest}
                  </Badge>
                ))}
              </div>
            </motion.div>
          )}

          {/* Quick details */}
          {(profile.zodiacSign || profile.height || profile.education || profile.lifestyle) && (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
              className="grid grid-cols-2 gap-3">
              {[
                profile.zodiacSign   && { icon: "⭐", label: "Segno",     value: profile.zodiacSign },
                profile.height       && { icon: "📏", label: "Altezza",   value: `${profile.height} cm` },
                profile.education    && { icon: "🎓", label: "Istruzione", value: profile.education },
                profile.lifestyle    && { icon: "✨", label: "Stile",     value: profile.lifestyle },
              ].filter(Boolean).map((item: any, idx) => (
                <div key={idx} className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-center gap-2">
                  <span className="text-xl">{item.icon}</span>
                  <div>
                    <p className="text-xs text-white/50">{item.label}</p>
                    <p className="text-sm text-white font-medium">{item.value}</p>
                  </div>
                </div>
              ))}
            </motion.div>
          )}
        </div>
      </div>

      {/* Sticky CTA */}
      <div className="fixed bottom-0 left-0 right-0 z-50 p-4 pb-6"
        style={{ background: "linear-gradient(to top, #0a0118 70%, transparent)" }}>
        <div className="max-w-lg mx-auto space-y-3">
          <div className="text-center mb-1">
            <p className="text-white/60 text-sm">Vuoi conoscere {profile.name}?</p>
          </div>
          <Button
            className="w-full h-14 text-lg font-bold bg-gradient-to-r from-purple-600 via-pink-500 to-cyan-500 hover:opacity-90 transition-opacity shadow-[0_0_30px_rgba(155,93,229,0.5)]"
            onClick={() => navigate("/register")}
            data-testid="button-cta-register"
          >
            <Zap className="w-5 h-5 mr-2" />
            Unisciti a Vibra — È gratis
          </Button>
          <Button variant="ghost" className="w-full text-white/60 hover:text-white"
            onClick={() => navigate("/login")}
            data-testid="button-cta-login">
            Ho già un account
          </Button>
        </div>
      </div>
    </div>
  );
}

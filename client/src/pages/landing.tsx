import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Rocket, MessageCircle, ShieldCheck, Sparkles, ChevronRight, Shield, Eye, Users, Star, UserPlus, ArrowRight, Trophy, Radio, X, Play, Heart, Video, Zap } from "lucide-react";
import { useGuest } from "@/hooks/use-guest";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link, useLocation } from "wouter";
import { useLanguage } from "@/i18n/LanguageContext";
import { LanguageSelector } from "@/components/LanguageSelector";
import vibraLogo from "@assets/Gemini_Generated_Image_adkxs1adkxs1adkx_1770480122018.png";

export default function Landing() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [showPromo, setShowPromo] = useState(false);
  const { enterGuestMode } = useGuest();
  const [, setLocation] = useLocation();
  const { t } = useLanguage();

  useEffect(() => {
    document.title = "Vibra - Non è Dating. È Connessione Vera.";
    const setMeta = (selector: string, attr: "name" | "property", key: string, content: string) => {
      let el = document.querySelector(`${selector}[${attr}="${key}"]`) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attr, key);
        document.head.appendChild(el);
      }
      el.setAttribute("content", content);
    };
    setMeta("meta", "name", "description", "Vibra non è una dating app. È una porta aperta per chi si sente invisibile, incompreso o solo. Carica il tuo video, racconta la tua verità, connettiti con chi capisce.");
    setMeta("meta", "property", "og:title", "Vibra - Non è Dating. È Connessione Vera.");
    setMeta("meta", "property", "og:description", "Una community cosmica per chi si sente trasparente. Carica il tuo video manifesto e trova chi vibra come te.");
    setMeta("meta", "property", "og:image", "/vibra-logo.png");
    setMeta("meta", "name", "twitter:title", "Vibra - Non è Dating. È Connessione Vera.");
    setMeta("meta", "name", "twitter:description", "Una community cosmica per chi si sente trasparente. Carica il tuo video manifesto e trova chi vibra come te.");
    setMeta("meta", "name", "twitter:image", "/vibra-logo.png");
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = true;
    video.setAttribute("muted", "");
    video.setAttribute("playsinline", "");
    video.setAttribute("webkit-playsinline", "");
    const onPlaying = () => setVideoPlaying(true);
    video.addEventListener("playing", onPlaying);
    const tryPlay = () => {
      video.play().then(() => setVideoPlaying(true)).catch(() => {});
    };
    tryPlay();
    const handleClick = () => { tryPlay(); };
    document.addEventListener("touchstart", handleClick, { once: true });
    document.addEventListener("click", handleClick, { once: true });
    return () => {
      video.removeEventListener("playing", onPlaying);
      document.removeEventListener("touchstart", handleClick);
      document.removeEventListener("click", handleClick);
    };
  }, []);

  const steps = [
    {
      num: "1",
      icon: UserPlus,
      title: t("landing.step1.title"),
      description: t("landing.step1.desc"),
    },
    {
      num: "2",
      icon: Video,
      title: t("landing.step2.title"),
      description: t("landing.step2.desc"),
    },
    {
      num: "3",
      icon: Heart,
      title: t("landing.step3.title"),
      description: t("landing.step3.desc"),
    }
  ];

  const features = [
    { icon: Video,        title: t("landing.feature9.title"), description: t("landing.feature9.desc"), color: "from-rose-500 to-pink-600" },
    { icon: Star,         title: t("landing.feature7.title"), description: t("landing.feature7.desc"), color: "from-amber-500 to-yellow-500" },
    { icon: Zap,          title: t("landing.feature8.title"), description: t("landing.feature8.desc"), color: "from-cyan-500 to-blue-500" },
    { icon: Sparkles,     title: t("landing.feature1.title"), description: t("landing.feature1.desc"), color: "from-purple-500 to-pink-500" },
    { icon: MessageCircle,title: t("landing.feature2.title"), description: t("landing.feature2.desc"), color: "from-indigo-500 to-purple-500" },
    { icon: ShieldCheck,  title: t("landing.feature3.title"), description: t("landing.feature3.desc"), color: "from-green-500 to-emerald-500" },
    { icon: Users,        title: t("landing.feature4.title"), description: t("landing.feature4.desc"), color: "from-orange-500 to-amber-500" },
    { icon: Trophy,       title: t("landing.feature5.title"), description: t("landing.feature5.desc"), color: "from-yellow-500 to-orange-500" },
    { icon: Radio,        title: t("landing.feature6.title"), description: t("landing.feature6.desc"), color: "from-pink-500 to-rose-500" },
  ];

  return (
    <div className="relative h-full overflow-y-auto">
      {showPromo && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-white/15 bg-[#12061f]/95 p-5 shadow-2xl shadow-black/40">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-white/50">Promo Android</p>
                <h2 className="text-2xl font-bold text-white mt-1">Scarica Vibra su Google Play</h2>
              </div>
              <button type="button" onClick={() => setShowPromo(false)} className="text-white/60 hover:text-white" data-testid="button-close-promo">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-white/70 mb-5">
              Accedi, registrati oppure installa l'app Android per vivere Vibra sul tuo telefono.
            </p>
            <div className="flex flex-col gap-3">
              <a href="https://play.google.com/store/apps/details?id=com.vibra.app" target="_blank" rel="noreferrer" data-testid="link-google-play">
                <Button className="w-full h-12 bg-white text-black hover:bg-white/90">
                  <Play className="w-4 h-4 mr-2 fill-current" />
                  Scarica su Google Play
                </Button>
              </a>
              <Link href="/register">
                <Button className="w-full h-12 bg-gradient-to-r from-primary to-accent hover:opacity-90" data-testid="button-promo-register">
                  Registrati
                </Button>
              </Link>
              <Link href="/login">
                <Button variant="outline" className="w-full h-12 border-white/20 text-white hover:bg-white/10" data-testid="button-promo-login">
                  Accedi
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Video background */}
      <div className="fixed inset-0 z-0">
        {!videoPlaying && (
          <div className="absolute inset-0" style={{ background: "#0a0118" }}>
            <motion.div
              className="absolute inset-0"
              style={{
                background: "radial-gradient(ellipse at 30% 20%, rgba(147,51,234,0.3) 0%, transparent 50%), radial-gradient(ellipse at 70% 80%, rgba(236,72,153,0.25) 0%, transparent 50%), radial-gradient(ellipse at 50% 50%, rgba(6,182,212,0.2) 0%, transparent 60%)"
              }}
              animate={{ opacity: [0.6, 1, 0.6] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            />
          </div>
        )}
        <video
          ref={videoRef}
          autoPlay
          loop
          muted
          playsInline
          webkit-playsinline=""
          preload="auto"
          className={`w-full h-full object-cover ${videoPlaying ? 'opacity-100' : 'opacity-0'}`}
          style={{ transition: 'opacity 0.5s ease-in' }}
          data-testid="video-landing-background"
          src="/backgrounds/vibra-landing.mp4"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/50 to-black/70" />
      </div>

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={vibraLogo} alt="Vibra" className="w-9 h-9 object-contain rounded-full" style={{ mixBlendMode: "screen" }} data-testid="vibra-logo-header" />
            <span className="text-white font-bold text-lg hidden sm:block">Vibra</span>
          </div>
          <div className="flex items-center gap-3">
            <LanguageSelector />
            {/* Nav desktop */}
            <nav className="hidden md:flex items-center gap-6 text-sm text-white/70">
              <a href="#how-it-works" className="hover:text-white transition-colors">{t("landing.howItWorks")}</a>
              <a href="#features" className="hover:text-white transition-colors">{t("landing.features")}</a>
              <Link href="/blog" className="hover:text-white transition-colors font-semibold text-primary/90">Blog</Link>
              <Link href="/privacy" className="hover:text-white transition-colors">{t("landing.privacy")}</Link>
            </nav>
            {/* Blog icon visibile su mobile */}
            <Link href="/blog" className="md:hidden">
              <div className="flex items-center gap-1 px-2 py-1 rounded-full border border-primary/40 bg-primary/15">
                <Rss className="w-3.5 h-3.5 text-primary" />
                <span className="text-[11px] font-semibold text-primary/90">Blog</span>
              </div>
            </Link>
            <Link href="/login">
              <Button className="bg-gradient-to-r from-primary to-accent hover:opacity-90" data-testid="button-login-header">
                {t("landing.login")}
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="relative z-10 pt-16">

        {/* ── HERO ── */}
        <section className="min-h-[85vh] flex items-center justify-center px-4">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center max-w-3xl mx-auto"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-rose-500/20 border border-rose-500/40 backdrop-blur-sm mb-6"
            >
              <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />
              <span className="text-sm font-semibold text-rose-300 tracking-wide">{t("landing.badge")}</span>
            </motion.div>

            <div className="mx-auto mb-5 flex justify-center">
              <motion.img
                src={vibraLogo}
                alt="Vibra"
                className="w-28 h-28 object-contain rounded-full"
                style={{ mixBlendMode: "screen" }}
                data-testid="vibra-logo-hero"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              />
            </div>

            <h1 className="text-5xl md:text-7xl font-extrabold text-white mb-5 leading-tight" data-testid="text-hero-title">
              {t("landing.hero")}
            </h1>

            <p className="text-xl md:text-2xl text-white/80 max-w-2xl mx-auto mb-8 leading-relaxed">
              {t("landing.subtitle")}
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-6">
              <Link href="/register">
                <Button size="lg" className="h-16 px-10 text-xl font-bold bg-gradient-to-r from-primary to-accent hover:opacity-90 shadow-2xl shadow-primary/30" data-testid="button-get-started">
                  {t("landing.cta")}
                  <ChevronRight className="w-6 h-6 ml-2" />
                </Button>
              </Link>
              <Button
                size="lg"
                variant="outline"
                className="h-16 px-8 text-lg text-white/90 border-white/30 backdrop-blur-sm hover:bg-white/10"
                onClick={() => {
                  enterGuestMode();
                  setLocation("/");
                  window.location.reload();
                }}
                data-testid="button-guest-explore"
              >
                <Eye className="w-5 h-5 mr-2" />
                {t("landing.explore")}
              </Button>
            </div>

            <Link href="/onboarding">
              <Button
                variant="ghost"
                className="text-white/70 hover:text-white hover:bg-white/10 text-base"
                data-testid="button-know-vibra"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                {t("landing.knowVibra")}
              </Button>
            </Link>

            <div className="flex items-center justify-center gap-6 text-sm text-white/60 flex-wrap mt-2">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-green-400" />
                <span>{t("landing.free")}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Rocket className="w-4 h-4 text-pink-400 rotate-[-20deg]" />
                <span>{t("landing.noCost")}</span>
              </div>
            </div>

            <motion.div
              className="mt-10"
              animate={{ y: [0, 8, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            >
              <a href="#how-it-works">
                <ChevronRight className="w-8 h-8 text-white/40 mx-auto rotate-90" />
              </a>
            </motion.div>
          </motion.div>
        </section>

        {/* ── NOT DATING BANNER ── */}
        <section className="px-4 pb-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-4xl mx-auto rounded-2xl border border-rose-500/30 bg-rose-500/10 backdrop-blur-md p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center gap-5"
          >
            <div className="shrink-0 w-14 h-14 rounded-2xl bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center shadow-lg shadow-rose-500/30">
              <Heart className="w-7 h-7 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white mb-1">{t("landing.notDatingTitle")}</h3>
              <p className="text-white/65 text-sm leading-relaxed">{t("landing.notDatingDesc")}</p>
            </div>
          </motion.div>
        </section>

        {/* ── HOW IT WORKS ── */}
        <section id="how-it-works" className="max-w-5xl mx-auto px-4 py-20">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-14"
          >
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-3">
              {t("landing.howItWorks")}
            </h2>
            <p className="text-lg text-white/60">
              {t("landing.howItWorksDesc")}
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6">
            {steps.map((step, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.15 }}
              >
                <div className="relative bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-8 text-center h-full hover:bg-white/10 transition-all">
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold text-sm shadow-lg">
                    {step.num}
                  </div>
                  <div className="w-14 h-14 mx-auto mb-5 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mt-2">
                    <step.icon className="w-7 h-7 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-3">{step.title}</h3>
                  <p className="text-white/60 text-sm leading-relaxed">{step.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ── IL CUORE DI VIBRA — VIDEO MANIFESTO ── */}
        <section className="px-4 py-6 md:py-10">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="max-w-4xl mx-auto"
          >
            <div className="relative overflow-hidden rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/15 via-accent/10 to-rose-500/15 backdrop-blur-md p-8 md:p-12">
              {/* Glow */}
              <div className="absolute -top-20 -left-20 w-64 h-64 rounded-full bg-primary/20 blur-3xl pointer-events-none" />
              <div className="absolute -bottom-20 -right-20 w-64 h-64 rounded-full bg-rose-500/20 blur-3xl pointer-events-none" />

              <div className="relative z-10 flex flex-col md:flex-row gap-8 items-start">
                {/* Icon */}
                <div className="shrink-0">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-rose-500 to-primary flex items-center justify-center shadow-2xl shadow-rose-500/30">
                    <Video className="w-10 h-10 text-white" />
                  </div>
                </div>

                {/* Text */}
                <div className="flex-1">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/20 border border-rose-500/30 mb-4">
                    <span className="text-xs font-semibold text-rose-300 uppercase tracking-widest">{t("landing.coreTag")}</span>
                  </div>
                  <h2 className="text-2xl md:text-4xl font-extrabold text-white mb-2 leading-tight">
                    {t("landing.coreTitle")}
                  </h2>
                  <p className="text-lg text-white/60 mb-4 font-medium">
                    {t("landing.coreSubtitle")}
                  </p>
                  <p className="text-white/70 leading-relaxed text-sm md:text-base mb-6">
                    {t("landing.coreDesc")}
                  </p>

                  {/* Emotion tags */}
                  <div className="flex flex-wrap gap-2 mb-6">
                    {["😔 Inquietudine", "⚖️ Ingiustizia", "🛡️ Bullismo", "💔 Torti ricevuti", "👁️ Invisibilità", "🗣️ Verità"].map((tag) => (
                      <span key={tag} className="px-3 py-1 rounded-full bg-white/10 border border-white/15 text-white/70 text-xs font-medium">
                        {tag}
                      </span>
                    ))}
                  </div>

                  <Link href="/register">
                    <Button
                      className="bg-gradient-to-r from-rose-500 to-primary hover:opacity-90 font-bold shadow-lg shadow-rose-500/20"
                      data-testid="button-core-upload"
                    >
                      <Video className="w-4 h-4 mr-2" />
                      {t("landing.coreUpload")}
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        {/* ── STATS ── */}
        <section className="py-16 px-4">
          <div className="max-w-4xl mx-auto">
            <div className="grid grid-cols-3 gap-4">
              {[
                { value: "1.2K+", label: t("landing.stats.users"), icon: Users },
                { value: "500+", label: t("landing.stats.matches"), icon: Rocket },
                { value: "10K+", label: t("landing.stats.messages"), icon: MessageCircle },
              ].map((stat, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="text-center bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-5"
                >
                  <stat.icon className="w-6 h-6 text-primary mx-auto mb-2" />
                  <div className="text-2xl md:text-3xl font-extrabold text-white">{stat.value}</div>
                  <div className="text-xs md:text-sm text-white/50 mt-1">{stat.label}</div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ── FEATURES ── */}
        <section id="features" className="max-w-6xl mx-auto px-4 py-20">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-14"
          >
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-3">
              {t("landing.whyVibra")}
            </h2>
            <p className="text-lg text-white/60">
              {t("landing.whyVibraDesc")}
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.07 }}
              >
                <Card className={`bg-white/5 backdrop-blur-md border-white/10 h-full hover:bg-white/10 transition-all hover:border-white/20 ${index < 3 ? 'border-primary/20 bg-primary/5' : ''}`}>
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className={`w-12 h-12 shrink-0 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center`}>
                        <feature.icon className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-white mb-1.5">
                          {feature.title}
                        </h3>
                        <p className="text-white/50 text-sm leading-relaxed">
                          {feature.description}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="max-w-4xl mx-auto px-4 py-20 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-gradient-to-br from-primary/20 via-accent/10 to-primary/20 border border-primary/20 rounded-3xl p-10 md:p-16 backdrop-blur-md"
          >
            <Rocket className="w-12 h-12 text-pink-400 mx-auto mb-6 rotate-[-20deg]" />
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-4">
              {t("landing.readyTitle")}
            </h2>
            <p className="text-lg text-white/60 mb-8 max-w-lg mx-auto">
              {t("landing.readyDesc")}
            </p>
            <Link href="/register">
              <Button size="lg" className="h-16 px-12 text-xl font-bold bg-gradient-to-r from-primary to-accent hover:opacity-90 shadow-2xl shadow-primary/30" data-testid="button-join-now">
                {t("landing.readyCta")}
                <ArrowRight className="w-6 h-6 ml-2" />
              </Button>
            </Link>
          </motion.div>

          <div className="mt-8">
            <Link href="/login?admin=true">
              <Button variant="ghost" className="gap-2 text-white/40 hover:text-white/70 text-sm" data-testid="button-admin-access">
                <Shield className="w-3.5 h-3.5" />
                {t("landing.adminAccess")}
              </Button>
            </Link>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-white/10 py-8 text-center text-sm text-white/50">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <img src={vibraLogo} alt="Vibra" className="w-6 h-6 rounded-full" style={{ mixBlendMode: "screen" }} />
              <span>{t("landing.footerRights")}</span>
            </div>
            <div className="flex items-center gap-6">
              <Link href="/privacy" className="hover:text-white/80 transition-colors">
                {t("landing.footerPrivacy")}
              </Link>
              <Link href="/terms" className="hover:text-white/80 transition-colors">
                {t("landing.footerTerms")}
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

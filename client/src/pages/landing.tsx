import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Heart, MessageCircle, ShieldCheck, Sparkles, ChevronRight, Shield, Eye } from "lucide-react";
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
  const { enterGuestMode } = useGuest();
  const [, setLocation] = useLocation();
  const { t } = useLanguage();

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

  const features = [
    {
      icon: Sparkles,
      title: t("landing.feature1.title"),
      description: t("landing.feature1.desc"),
      color: "from-purple-500 to-pink-500"
    },
    {
      icon: MessageCircle,
      title: t("landing.feature2.title"),
      description: t("landing.feature2.desc"),
      color: "from-cyan-500 to-blue-500"
    },
    {
      icon: ShieldCheck,
      title: t("landing.feature3.title"),
      description: t("landing.feature3.desc"),
      color: "from-green-500 to-emerald-500"
    }
  ];

  return (
    <div className="relative h-full overflow-y-auto">
      <div className="fixed inset-0 z-0">
        {!videoPlaying && (
          <div className="absolute inset-0">
            <img src="/backgrounds/vibra-hero.jpg" alt="" className="w-full h-full object-cover" />
            <motion.div
              className="absolute inset-0"
              style={{
                background: "radial-gradient(ellipse at 30% 20%, rgba(147,51,234,0.3) 0%, transparent 50%), radial-gradient(ellipse at 70% 80%, rgba(236,72,153,0.25) 0%, transparent 50%), radial-gradient(ellipse at 50% 50%, rgba(6,182,212,0.2) 0%, transparent 60%)"
              }}
              animate={{
                opacity: [0.6, 1, 0.6],
              }}
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
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/40 to-black/60" />
      </div>
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={vibraLogo} alt="Vibra" className="w-10 h-10 object-contain rounded-full" style={{ mixBlendMode: "screen" }} data-testid="vibra-logo-header" />
          </div>
          
          <div className="flex items-center gap-4">
            <LanguageSelector />
            <nav className="hidden md:flex items-center gap-6 text-sm text-white/70">
              <a href="#features" className="hover:text-white transition-colors">{t("landing.features")}</a>
              <Link href="/privacy" className="hover:text-white transition-colors">{t("landing.privacy")}</Link>
              <Link href="/terms" className="hover:text-white transition-colors">{t("landing.termsNav")}</Link>
            </nav>

            <Link href="/login">
              <Button className="bg-gradient-to-r from-primary to-accent hover:opacity-90" data-testid="button-login-header">
                {t("landing.login")}
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="relative z-10 pt-20">
        <section className="max-w-6xl mx-auto px-4 py-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="mx-auto mb-6 flex justify-center">
              <img src={vibraLogo} alt="Vibra" className="w-36 h-36 object-contain rounded-full" style={{ mixBlendMode: "screen" }} data-testid="vibra-logo-hero" />
            </div>
            
            <h1 className="text-4xl md:text-6xl font-bold text-white mb-6" data-testid="text-hero-title">
              {t("landing.hero")}
            </h1>
            
            <p className="text-xl text-white/70 max-w-2xl mx-auto mb-10">
              {t("landing.subtitle")}
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/register">
                <Button size="lg" className="h-14 px-8 text-lg bg-gradient-to-r from-primary to-accent hover:opacity-90" data-testid="button-get-started">
                  {t("landing.cta")}
                  <ChevronRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
              <Button
                size="lg"
                variant="outline"
                className="h-14 px-8 text-lg text-white/90 border-white/30 backdrop-blur-sm"
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

            <div className="mt-8 flex items-center justify-center gap-8 text-base text-white/70 flex-wrap">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-green-500" />
                <span>{t("landing.free")}</span>
              </div>
              <div className="flex items-center gap-2">
                <Heart className="w-5 h-5 text-pink-500" />
                <span>{t("landing.noCost")}</span>
              </div>
            </div>

            <div className="mt-6">
              <Link href="/login?admin=true">
                <Button variant="outline" className="gap-2 text-white/70 border-white/20 backdrop-blur-sm" data-testid="button-admin-access">
                  <Shield className="w-4 h-4" />
                  {t("landing.adminAccess")}
                </Button>
              </Link>
            </div>
          </motion.div>
        </section>

        <section id="features" className="max-w-6xl mx-auto px-4 py-20">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              {t("landing.howItWorks")}
            </h2>
            <p className="text-lg text-white/60">
              {t("landing.howItWorksDesc")}
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="bg-white/10 backdrop-blur-md border-white/10 h-full hover:bg-white/15 transition-colors">
                  <CardContent className="p-8 text-center">
                    <div className={`w-16 h-16 mx-auto mb-6 rounded-full bg-gradient-to-br ${feature.color} flex items-center justify-center`}>
                      <feature.icon className="w-8 h-8 text-white" />
                    </div>
                    <h3 className="text-xl font-semibold text-white mb-3">
                      {feature.title}
                    </h3>
                    <p className="text-white/60">
                      {feature.description}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </section>

        <section className="max-w-4xl mx-auto px-4 py-20 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
              {t("landing.readyTitle")}
            </h2>
            <p className="text-lg text-white/60 mb-8">
              {t("landing.readyDesc")}
            </p>
            <Link href="/register">
              <Button size="lg" className="h-14 px-10 text-lg bg-gradient-to-r from-primary to-accent hover:opacity-90" data-testid="button-join-now">
                {t("landing.readyCta")}
                <Heart className="w-5 h-5 ml-2" />
              </Button>
            </Link>
          </motion.div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-white/10 py-8 text-center text-sm text-white/60">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Heart className="w-4 h-4 text-pink-500" />
              <span>{t("landing.footerRights")}</span>
            </div>
            <div className="flex items-center gap-6">
              <Link href="/privacy" className="hover:text-foreground transition-colors">
                {t("landing.footerPrivacy")}
              </Link>
              <Link href="/terms" className="hover:text-foreground transition-colors">
                {t("landing.footerTerms")}
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Heart, MessageCircle, ShieldCheck, Sparkles, ChevronRight, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "wouter";
import vibraLogo from "@assets/Gemini_Generated_Image_adkxs1adkxs1adkx_1770480122018.png";

export default function Landing() {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = true;
    video.setAttribute("muted", "");
    video.setAttribute("playsinline", "");
    video.setAttribute("webkit-playsinline", "");
    const tryPlay = () => {
      video.play().catch(() => {});
    };
    tryPlay();
    const handleClick = () => { tryPlay(); };
    document.addEventListener("touchstart", handleClick, { once: true });
    document.addEventListener("click", handleClick, { once: true });
    return () => {
      document.removeEventListener("touchstart", handleClick);
      document.removeEventListener("click", handleClick);
    };
  }, []);
  const features = [
    {
      icon: Sparkles,
      title: "Swipe & Match",
      description: "Scorri i profili e trova chi vibra con te. Un like reciproco crea una connessione speciale.",
      color: "from-purple-500 to-pink-500"
    },
    {
      icon: MessageCircle,
      title: "Chat Sicura",
      description: "Chatta con chi hai matchato e crea legami autentici in un ambiente protetto.",
      color: "from-cyan-500 to-blue-500"
    },
    {
      icon: ShieldCheck,
      title: "Profili Verificati",
      description: "Ogni profilo è verificato. Vibra è uno spazio sicuro dove puoi essere te stesso.",
      color: "from-green-500 to-emerald-500"
    }
  ];

  return (
    <div className="relative h-full overflow-y-auto">
      <div className="fixed inset-0 z-0">
        <video
          ref={videoRef}
          autoPlay
          loop
          muted
          playsInline
          webkit-playsinline=""
          preload="auto"
          poster="/backgrounds/vibra-hero.jpg"
          className="w-full h-full object-cover"
          data-testid="video-landing-background"
          src="/backgrounds/vibra-landing.mp4"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/40 to-black/60" />
      </div>
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={vibraLogo} alt="Vibra" className="w-10 h-10 object-contain" data-testid="vibra-logo-header" />
          </div>
          
          <nav className="hidden md:flex items-center gap-6 text-sm text-white/70">
            <a href="#features" className="hover:text-white transition-colors">Funzionalità</a>
            <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-white transition-colors">Termini</Link>
          </nav>

          <Link href="/login">
            <Button className="bg-gradient-to-r from-primary to-accent hover:opacity-90" data-testid="button-login-header">
              Accedi
            </Button>
          </Link>
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
              <img src={vibraLogo} alt="Vibra" className="w-36 h-36 object-contain" data-testid="vibra-logo-hero" />
            </div>
            
            <h1 className="text-4xl md:text-6xl font-bold text-white mb-6">
              L'app di incontri che ti fa{" "}
              <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                vibrare
              </span>{" "}
              di emozione
            </h1>
            
            <p className="text-xl text-white/70 max-w-2xl mx-auto mb-10">
              Connettiti con chi vibra come te. Scopri profili autentici, chatta in sicurezza e trova la tua connessione speciale.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/register">
                <Button size="lg" className="h-14 px-8 text-lg bg-gradient-to-r from-primary to-accent hover:opacity-90" data-testid="button-get-started">
                  Inizia Ora
                  <ChevronRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
            </div>

            <div className="mt-8 flex items-center justify-center gap-8 text-base text-white/70 flex-wrap">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-green-500" />
                <span>Free per un periodo di 30 giorni</span>
              </div>
              <div className="flex items-center gap-2">
                <Heart className="w-5 h-5 text-pink-500" />
                <span>Nessun costo nascosto</span>
              </div>
            </div>

            <div className="mt-6">
              <Link href="/login?admin=true">
                <Button variant="outline" className="gap-2 text-white/70 border-white/20 backdrop-blur-sm" data-testid="button-admin-access">
                  <Shield className="w-4 h-4" />
                  Accesso Admin
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
              Come Funziona Vibra
            </h2>
            <p className="text-lg text-white/60">
              Semplice, sicuro, autentico
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
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
              Pronto a Vibrare?
            </h2>
            <p className="text-lg text-white/60 mb-8">
              Unisciti a migliaia di persone che hanno già trovato la loro connessione su Vibra
            </p>
            <Link href="/register">
              <Button size="lg" className="h-14 px-10 text-lg bg-gradient-to-r from-primary to-accent hover:opacity-90" data-testid="button-join-now">
                Entra in Vibrazione
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
              <span>© 2026 Vibra. Tutti i diritti riservati.</span>
            </div>
            <div className="flex items-center gap-6">
              <Link href="/privacy" className="hover:text-foreground transition-colors">
                Privacy Policy
              </Link>
              <Link href="/terms" className="hover:text-foreground transition-colors">
                Termini di Servizio
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

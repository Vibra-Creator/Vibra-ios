import { motion } from "framer-motion";
import { ShieldCheck, User, Mail, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export default function Consent() {
  return (
    <div className="relative h-full overflow-y-auto flex flex-col items-center justify-center p-6">
      <div className="fixed inset-0 z-0">
        <img src="/backgrounds/vibra-couple-rose.png" alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/40 to-black/60" />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="relative z-10 w-full max-w-sm"
      >
        <div className="rounded-2xl bg-white/10 backdrop-blur-xl border border-white/15 p-8 text-center">
          <img
            src="/images/logo-vibra.png"
            alt="Vibra"
            className="w-28 mx-auto mb-4"
            style={{ filter: "drop-shadow(0 0 30px rgba(139, 92, 246, 0.5))" }}
          />
          <h1 className="text-2xl font-bold text-white mb-1" data-testid="text-consent-title">
            Vibra
          </h1>
          <p className="text-white/60 text-sm mb-6" data-testid="text-consent-subtitle">
            vorrebbe accedere al tuo account
          </p>

          <div className="space-y-3 mb-8 text-left">
            <div className="flex items-center gap-3 text-white/80">
              <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                <User className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-medium">Nome e foto profilo</p>
                <p className="text-xs text-white/50">Per personalizzare la tua esperienza</p>
              </div>
            </div>
            <div className="flex items-center gap-3 text-white/80">
              <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                <Mail className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-medium">Indirizzo email</p>
                <p className="text-xs text-white/50">Per le notifiche e il recupero account</p>
              </div>
            </div>
            <div className="flex items-center gap-3 text-white/80">
              <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-medium">Accesso sicuro</p>
                <p className="text-xs text-white/50">I tuoi dati sono protetti e criptati</p>
              </div>
            </div>
          </div>

          <a href="/api/login" data-testid="link-authorize">
            <Button
              className="w-full h-12 text-base bg-gradient-to-r from-primary to-accent hover:opacity-90 mb-3"
              data-testid="button-authorize"
            >
              <LogIn className="w-5 h-5 mr-2" />
              Autorizza e Accedi
            </Button>
          </a>

          <Link href="/">
            <Button variant="ghost" className="w-full text-white/60" data-testid="button-cancel-consent">
              Annulla
            </Button>
          </Link>

          <p className="text-xs text-white/40 mt-4">
            Continuando accetti i nostri{" "}
            <Link href="/terms" className="text-primary/80 hover:underline">
              Termini
            </Link>{" "}
            e la{" "}
            <Link href="/privacy" className="text-primary/80 hover:underline">
              Privacy Policy
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}

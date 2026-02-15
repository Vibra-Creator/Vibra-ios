import { motion } from "framer-motion";
import { ArrowLeft, Headphones, Mail, Clock, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useLocation } from "wouter";

export default function Support() {
  const [, setLocation] = useLocation();
  return (
    <div className="h-full overflow-y-auto p-6 bg-gradient-to-b from-background via-background to-card">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-3xl mx-auto"
      >
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => window.history.length > 1 ? window.history.back() : setLocation("/landing")} data-testid="button-back">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
              <Headphones className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-foreground" data-testid="text-support-title">Supporto Vibra</h1>
          </div>
        </div>

        <Card className="bg-card/80 backdrop-blur-xl border-border">
          <CardContent className="p-6 space-y-6 text-muted-foreground">
            <section>
              <p className="text-base leading-relaxed">
                Se riscontri problemi tecnici o hai domande riguardo l'app Vibra, contattaci.
                Siamo qui per aiutarti.
              </p>
            </section>

            <section className="flex items-start gap-4 p-4 rounded-xl bg-primary/5 border border-primary/10">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                <Mail className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground mb-1">Email di contatto</h2>
                <a
                  href="mailto:privacyvibra@gmail.com"
                  className="text-primary hover:underline text-base font-medium"
                  data-testid="link-support-email"
                >
                  privacyvibra@gmail.com
                </a>
              </div>
            </section>

            <section className="flex items-start gap-4 p-4 rounded-xl bg-cyan-500/5 border border-cyan-500/10">
              <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center shrink-0 mt-0.5">
                <Clock className="w-5 h-5 text-cyan-500" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground mb-1">Tempi di risposta</h2>
                <p>Rispondiamo entro 48 ore.</p>
              </div>
            </section>

            <section className="flex items-start gap-4 p-4 rounded-xl bg-green-500/5 border border-green-500/10">
              <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0 mt-0.5">
                <ShieldCheck className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground mb-1">Privacy e Sicurezza</h2>
                <p>
                  Per questioni relative alla privacy o alla sicurezza dell'account,
                  scrivici specificando il tuo username.
                </p>
              </div>
            </section>

            <section className="pt-4 border-t border-border">
              <p className="text-sm text-muted-foreground/70 text-center">
                &copy; 2026 Vibra
              </p>
            </section>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

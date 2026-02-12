import { motion } from "framer-motion";
import { ArrowLeft, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link, useLocation } from "wouter";

export default function Privacy() {
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
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Privacy Policy</h1>
          </div>
        </div>

        <Card className="bg-card/80 backdrop-blur-xl border-border">
          <CardContent className="p-6 space-y-6 text-muted-foreground">
            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">1. Introduzione</h2>
              <p>
                Vibra ("noi", "nostro" o "la Società") si impegna a proteggere la privacy degli utenti 
                della nostra applicazione mobile di incontri. Questa Privacy Policy spiega come 
                raccogliamo, utilizziamo, divulghiamo e proteggiamo le tue informazioni personali.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">2. Dati che Raccogliamo</h2>
              <ul className="list-disc pl-5 space-y-2">
                <li><strong>Dati di registrazione:</strong> nome, email, data di nascita, genere</li>
                <li><strong>Dati del profilo:</strong> foto, bio, interessi, posizione</li>
                <li><strong>Dati di utilizzo:</strong> swipe, match, messaggi, tempo di utilizzo</li>
                <li><strong>Dati del dispositivo:</strong> modello, sistema operativo, identificatori univoci</li>
                <li><strong>Dati di localizzazione:</strong> posizione geografica (con il tuo consenso)</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">3. Come Utilizziamo i Tuoi Dati</h2>
              <ul className="list-disc pl-5 space-y-2">
                <li>Fornire e migliorare i nostri servizi</li>
                <li>Suggerire profili compatibili basati sui tuoi interessi</li>
                <li>Comunicare con te riguardo al tuo account</li>
                <li>Garantire la sicurezza della piattaforma</li>
                <li>Rispettare gli obblighi legali</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">4. Condivisione dei Dati</h2>
              <p>
                Non vendiamo i tuoi dati personali. Potremmo condividere informazioni con:
              </p>
              <ul className="list-disc pl-5 space-y-2 mt-2">
                <li>Altri utenti (solo le informazioni del tuo profilo pubblico)</li>
                <li>Fornitori di servizi che ci aiutano a gestire l'app</li>
                <li>Autorità legali quando richiesto dalla legge</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">5. Sicurezza dei Dati</h2>
              <p>
                Implementiamo misure di sicurezza tecniche e organizzative per proteggere i tuoi dati, 
                inclusa la crittografia dei dati in transito e a riposo, controlli di accesso rigorosi 
                e monitoraggio continuo delle minacce.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">6. I Tuoi Diritti</h2>
              <p>Hai il diritto di:</p>
              <ul className="list-disc pl-5 space-y-2 mt-2">
                <li>Accedere ai tuoi dati personali</li>
                <li>Correggere dati inesatti</li>
                <li>Richiedere la cancellazione dei tuoi dati</li>
                <li>Opporti al trattamento dei tuoi dati</li>
                <li>Richiedere la portabilità dei dati</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">7. Conservazione dei Dati</h2>
              <p>
                Conserviamo i tuoi dati per il tempo necessario a fornirti i nostri servizi e per 
                rispettare gli obblighi legali. Puoi richiedere la cancellazione del tuo account 
                in qualsiasi momento.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">8. Contatti</h2>
              <p>
                Per domande sulla privacy, contattaci a: privacyvibra@gmail.com
              </p>
            </section>

            <section className="pt-4 border-t border-border">
              <p className="text-sm">
                Ultimo aggiornamento: Febbraio 2026
              </p>
            </section>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

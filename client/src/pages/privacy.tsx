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
            <section className="pb-2 border-b border-border">
              <p className="text-sm font-medium text-foreground">PRIVACY POLICY ESTESA – APP VIBRA</p>
              <p className="text-xs mt-1">Ultimo aggiornamento: 13/02/2026</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">1. Titolare del Trattamento</h2>
              <p>
                Il Titolare del trattamento dei dati personali ai sensi del Regolamento (UE) 2016/679 (GDPR)
                e del D.Lgs. 196/2003 è:
              </p>
              <div className="mt-2 pl-4 border-l-2 border-primary/30">
                <p className="font-medium text-foreground">Mattoni Fabio</p>
                <p>Email: <a href="mailto:privacyvibra@gmail.com" className="text-primary hover:underline">privacyvibra@gmail.com</a></p>
                <p>Luogo di trattamento: Italia</p>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">2. Principi Generali</h2>
              <p>
                Vibra tratta i dati personali nel rispetto dei principi di liceità, correttezza, trasparenza,
                limitazione delle finalità, minimizzazione dei dati, esattezza, limitazione della conservazione
                e integrità e riservatezza, come previsto dall'art. 5 GDPR.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">3. Dati Raccolti</h2>
              <p className="mb-2">Durante l'utilizzo dell'app Vibra possono essere raccolti:</p>
              <ul className="list-disc pl-5 space-y-2">
                <li><strong>Dati di registrazione</strong> (email, username, data di nascita)</li>
                <li><strong>Foto profilo</strong> caricate volontariamente</li>
                <li><strong>Dati tecnici</strong> (indirizzo IP, log di accesso, tipo di dispositivo, sistema operativo)</li>
              </ul>
              <p className="mt-3 text-sm">
                Vibra non raccoglie dati particolari (art. 9 GDPR) se non quelli eventualmente forniti
                volontariamente dall'utente all'interno del profilo.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">4. Finalità del Trattamento</h2>
              <p className="mb-2">I dati sono trattati per:</p>
              <ul className="list-disc pl-5 space-y-2">
                <li>Creazione e gestione dell'account</li>
                <li>Fornitura del servizio di matchmaking</li>
                <li>Comunicazione tra utenti</li>
                <li>Miglioramento del servizio e analisi tecnica</li>
                <li>Prevenzione frodi, abusi o violazioni dei Termini di utilizzo</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">5. Base Giuridica</h2>
              <p className="mb-2">Il trattamento si fonda su:</p>
              <ul className="list-disc pl-5 space-y-2">
                <li>Consenso dell'utente</li>
                <li>Esecuzione del contratto relativo all'utilizzo dell'app</li>
                <li>Legittimo interesse del titolare per sicurezza e prevenzione abusi</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">6. Conservazione dei Dati</h2>
              <p>
                I dati sono conservati per tutta la durata dell'account.
                In caso di cancellazione, i dati vengono eliminati entro un termine tecnico ragionevole,
                salvo obblighi di legge o necessità di tutela legale.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">7. Condivisione dei Dati</h2>
              <p>
                I dati non vengono venduti né commercializzati.
                Non vengono ceduti a terzi per finalità di marketing.
                Possono essere trattati da fornitori tecnici (hosting o servizi IT)
                esclusivamente per garantire il funzionamento della piattaforma.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">8. Trasferimenti Extra UE</h2>
              <p>
                I dati sono trattati in Italia.
                Eventuali trasferimenti verso paesi extra UE avverranno solo in presenza
                di adeguate garanzie previste dal GDPR.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">9. Sicurezza</h2>
              <p>
                Vibra adotta misure tecniche e organizzative adeguate per proteggere i dati
                contro accessi non autorizzati, perdita, distruzione o divulgazione indebita.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">10. Diritti dell'Utente</h2>
              <p className="mb-2">L'utente può esercitare i diritti previsti dagli artt. 15-22 GDPR:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Accesso</li>
                <li>Rettifica</li>
                <li>Cancellazione</li>
                <li>Limitazione</li>
                <li>Portabilità</li>
                <li>Opposizione</li>
                <li>Revoca del consenso</li>
              </ul>
              <p className="mt-3">
                Richieste via email: <a href="mailto:privacyvibra@gmail.com" className="text-primary hover:underline">privacyvibra@gmail.com</a>
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">11. Reclami</h2>
              <p>
                L'utente può proporre reclamo al Garante per la Protezione dei Dati Personali
                qualora ritenga violati i propri diritti.
              </p>
            </section>

            <section className="pt-4 border-t border-border">
              <p className="text-sm">
                Ultimo aggiornamento: 13 Febbraio 2026
              </p>
            </section>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

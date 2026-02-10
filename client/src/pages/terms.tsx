import { motion } from "framer-motion";
import { ArrowLeft, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "wouter";

export default function Terms() {
  return (
    <div className="h-full overflow-y-auto p-6 bg-gradient-to-b from-background via-background to-card">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-3xl mx-auto"
      >
        <div className="flex items-center gap-4 mb-8">
          <Link href="/login">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
              <FileText className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Termini di Servizio</h1>
          </div>
        </div>

        <Card className="bg-card/80 backdrop-blur-xl border-border">
          <CardContent className="p-6 space-y-6 text-muted-foreground">
            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">1. Accettazione dei Termini</h2>
              <p>
                Utilizzando Vibra, accetti di essere vincolato da questi Termini di Servizio. 
                Se non accetti questi termini, ti preghiamo di non utilizzare l'applicazione.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">2. Idoneità</h2>
              <p>
                Per utilizzare Vibra devi:
              </p>
              <ul className="list-disc pl-5 space-y-2 mt-2">
                <li>Avere almeno 18 anni di età</li>
                <li>Non essere stato precedentemente bannato dalla piattaforma</li>
                <li>Rispettare tutte le leggi applicabili</li>
                <li>Creare un solo account per persona</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">3. Il Tuo Account</h2>
              <p>
                Sei responsabile di mantenere la sicurezza del tuo account e di tutte le attività 
                che si verificano attraverso di esso. Devi:
              </p>
              <ul className="list-disc pl-5 space-y-2 mt-2">
                <li>Fornire informazioni accurate e veritiere</li>
                <li>Mantenere aggiornate le informazioni del profilo</li>
                <li>Non condividere le credenziali di accesso</li>
                <li>Notificarci immediatamente di qualsiasi uso non autorizzato</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">4. Regole della Community</h2>
              <p>
                Per mantenere Vibra uno spazio sicuro, NON è consentito:
              </p>
              <ul className="list-disc pl-5 space-y-2 mt-2">
                <li>Pubblicare contenuti offensivi, violenti o sessualmente espliciti</li>
                <li>Molestare, intimidire o minacciare altri utenti</li>
                <li>Creare profili falsi o impersonare altre persone</li>
                <li>Utilizzare l'app per scopi commerciali o spam</li>
                <li>Raccogliere dati di altri utenti senza consenso</li>
                <li>Violare diritti di proprietà intellettuale</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">5. Contenuti dell'Utente</h2>
              <p>
                Sei l'unico responsabile dei contenuti che pubblichi su Vibra. Concedi a Vibra 
                una licenza mondiale, non esclusiva e royalty-free per utilizzare, riprodurre 
                e visualizzare i tuoi contenuti nell'ambito della fornitura dei nostri servizi.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">6. Abbonamenti e Pagamenti</h2>
              <p>
                Vibra offre un servizio gratuito. Funzionalità premium potrebbero essere 
                disponibili in futuro. Eventuali acquisti saranno soggetti ai termini 
                dell'App Store o Google Play.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">7. Terminazione</h2>
              <p>
                Possiamo sospendere o terminare il tuo account se violi questi termini. 
                Puoi eliminare il tuo account in qualsiasi momento dalle impostazioni del profilo.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">8. Limitazione di Responsabilità</h2>
              <p>
                Vibra non è responsabile per le azioni degli utenti. Ti consigliamo di usare 
                prudenza quando incontri persone conosciute tramite l'app e di seguire le 
                nostre linee guida sulla sicurezza.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">9. Modifiche ai Termini</h2>
              <p>
                Possiamo modificare questi termini in qualsiasi momento. Ti notificheremo 
                di cambiamenti significativi via email o tramite l'app.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">10. Contatti</h2>
              <p>
                Per domande sui Termini di Servizio, contattaci a: legal@vibra.app
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

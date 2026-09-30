import { motion } from "framer-motion";
import { ArrowLeft, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link, useLocation } from "wouter";

export default function Terms() {
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
              <h2 className="text-lg font-semibold text-foreground mb-3">2. Idoneità e Verifica dell'Età</h2>
              <p>
                Per utilizzare Vibra devi:
              </p>
              <ul className="list-disc pl-5 space-y-2 mt-2">
                <li><strong>Avere almeno 18 anni di età</strong> — al momento della registrazione è richiesta la conferma esplicita dell'età</li>
                <li>Non essere stato precedentemente bannato dalla piattaforma</li>
                <li>Rispettare tutte le leggi applicabili</li>
                <li>Creare un solo account per persona</li>
              </ul>
              <p className="mt-2 text-sm">
                Vibra si riserva il diritto di richiedere documentazione aggiuntiva per verificare l'età dell'utente e di sospendere gli account che risultino appartenere a minori.
              </p>
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
              <p className="mt-2 text-sm">
                Puoi modificare la tua password in qualsiasi momento dalla sezione Profilo.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">4. Regole della Community</h2>
              <p>
                Per mantenere Vibra uno spazio sicuro e rispettoso, NON è consentito:
              </p>
              <ul className="list-disc pl-5 space-y-2 mt-2">
                <li>Pubblicare contenuti offensivi, violenti, sessualmente espliciti o che sfruttano minori</li>
                <li>Molestare, intimidire o minacciare altri utenti</li>
                <li>Creare profili falsi o impersonare altre persone</li>
                <li>Utilizzare l'app per scopi commerciali o spam</li>
                <li>Raccogliere dati di altri utenti senza consenso</li>
                <li>Violare diritti di proprietà intellettuale</li>
                <li>Inviare messaggi con linguaggio offensivo o inappropriato</li>
                <li>Utilizzare le Stanze (pubbliche o private) per promuovere contenuti illeciti</li>
              </ul>
              <p className="mt-3 font-medium">
                Vibra applica una politica di tolleranza zero verso contenuti offensivi o inappropriati e comportamenti abusivi.
                I contenuti che violano queste regole possono essere rimossi e gli account responsabili sospesi o chiusi.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">5. Filtro Contenuti e Moderazione</h2>
              <p>
                Vibra applica un filtro automatico ai testi inviati dagli utenti, inclusi profili,
                messaggi, commenti e post. Le parole presenti nell'elenco di moderazione vengono
                mascherate prima della pubblicazione. Foto e video possono essere segnalati per una
                revisione manuale.
              </p>
              <p className="mt-2">
                La moderazione combina filtri automatici e revisione del team di amministrazione.
                Vibra può rimuovere contenuti che violano queste regole e sospendere gli account
                responsabili.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">6. Sistema di Segnalazione</h2>
              <p>
                Gli utenti possono segnalare profili e singoli messaggi inappropriati dalla chat,
                dalle stanze pubbliche o dalle stanze private tramite l'azione Segnala.
                Le segnalazioni vengono inoltrate al team di moderazione, che le esamina e adotta
                le misure necessarie entro 24 ore dalla ricezione:
              </p>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li>Contenuto inappropriato</li>
                <li>Profilo falso</li>
                <li>Comportamento molesto</li>
                <li>Spam</li>
                <li>Minacce o violenza</li>
                <li>Altro</li>
              </ul>
              <p className="mt-2 text-sm">
                L'abuso del sistema di segnalazione (segnalazioni false o ripetute) può portare
                alla sospensione dell'account. Le segnalazioni possono inoltre essere inviate al
                team quando blocchi un utente.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">7. Blocco Utenti e Rimozione Match</h2>
              <p>
                Puoi bloccare un utente dalla chat o dal suo profilo. Il blocco lo rimuove dai
                suggerimenti di swipe e invia una segnalazione al team per la revisione.
              </p>
              <p className="mt-2">
                Puoi anche rimuovere un match (unmatch) dalla chat. Questa azione elimina il match 
                e tutti i messaggi scambiati con quell'utente. L'azione è irreversibile.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">8. Contenuti dell'Utente</h2>
              <p>
                Sei l'unico responsabile dei contenuti che pubblichi su Vibra, inclusi foto profilo, 
                immagini delle sfide giornaliere e messaggi nelle stanze. Concedi a Vibra 
                una licenza mondiale, non esclusiva e royalty-free per utilizzare, riprodurre 
                e visualizzare i tuoi contenuti nell'ambito della fornitura dei nostri servizi.
              </p>
              <p className="mt-2 text-sm">
                Le foto caricate vengono archiviate in modo sicuro nel cloud. Puoi rimuovere 
                le tue foto in qualsiasi momento modificando il profilo.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">9. Funzionalità dell'App</h2>
              <p className="mb-2">Vibra offre le seguenti funzionalità principali:</p>
              <ul className="list-disc pl-5 space-y-2">
                <li><strong>Swipe e Match</strong> — Scorri i profili e trova connessioni reciproche</li>
                <li><strong>Chat</strong> — Comunica con i tuoi match in tempo reale</li>
                <li><strong>Stanze d'Interesse</strong> — Partecipa a chat di gruppo tematiche basate sui tuoi interessi</li>
                <li><strong>Stanze Private</strong> — Crea la tua stanza esclusiva con sistema di approvazione accessi (limite: 1 stanza per utente)</li>
                <li><strong>Sfide Giornaliere</strong> — Completa sfide fotografiche per guadagnare punti. Le sfide scadono automaticamente dopo 12 ore. Le foto vengono verificate dal team o con assistenza AI</li>
                <li><strong>Regali Virtuali</strong> — Usa i punti guadagnati per inviare regali animati ad altri utenti</li>
                <li><strong>Prima Impressione</strong> — Sistema di valutazione opzionale (1-10). Puoi attivarlo dal profilo per ricevere valutazioni. Chi viene valutato può rispondere con un messaggio, creando automaticamente un match</li>
                <li><strong>Sto Vibing Ora</strong> — Modalità presenza live per 30 minuti. Vedi solo gli utenti attivi nelle vicinanze (1-10 km). Richiede la geolocalizzazione del dispositivo</li>
                <li><strong>Condivisione Posizione</strong> — Puoi condividere la tua posizione con i tuoi match nella chat</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">10. Punti e Regali Virtuali</h2>
              <p>
                I punti vengono guadagnati completando le Sfide Giornaliere. I punti possono essere 
                utilizzati esclusivamente per acquistare e inviare Regali Virtuali ad altri utenti. 
                I punti e i regali non hanno valore monetario reale e non possono essere convertiti 
                in denaro, trasferiti ad altri account o rimborsati.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">11. Modalità Ospite</h2>
              <p>
                Vibra offre una Modalità Ospite che permette di esplorare l'app senza registrarsi. 
                In questa modalità puoi visualizzare profili, stanze, sfide e funzionalità, 
                ma non puoi interagire (swipe, chat, partecipazione a stanze, invio regali). 
                Per interagire è necessaria la registrazione. I dati della sessione ospite 
                sono temporanei e non vengono salvati.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">12. Profili Bot e Intelligenza Artificiale</h2>
              <p>
                Vibra potrebbe includere profili gestiti automaticamente (bot) per migliorare 
                l'esperienza utente. Questi profili possono rispondere ai messaggi utilizzando 
                intelligenza artificiale. I profili bot sono chiaramente identificabili e non 
                rappresentano persone reali.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">13. Abbonamenti e Pagamenti</h2>
              <p>
                Vibra offre un servizio gratuito. Funzionalità premium potrebbero essere 
                disponibili in futuro. Eventuali acquisti saranno soggetti ai termini 
                dello store da cui è stato effettuato l'acquisto.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">14. Eliminazione Profilo e Account</h2>
              <p>
                Puoi eliminare il tuo profilo o l'intero account in qualsiasi momento 
                dalla sezione Profilo dell'app.
              </p>
              <ul className="list-disc pl-5 space-y-2 mt-2">
                <li><strong>Elimina Profilo</strong> — Rimuove il profilo, i match, i messaggi, le stanze private, 
                  i regali, le sfide e tutti i dati associati. L'account email resta attivo per un eventuale nuovo profilo</li>
                <li><strong>Elimina Account Completo</strong> — Rimuove permanentemente l'intero account, 
                  comprese le credenziali di accesso. Non sarà più possibile accedere con la stessa email</li>
              </ul>
              <p className="mt-2 text-sm">
                Entrambe le azioni sono irreversibili. Ti consigliamo di scaricare i tuoi dati 
                (vedi sezione GDPR) prima di procedere.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">15. Diritti GDPR e Esportazione Dati</h2>
              <p>
                In conformità al Regolamento (UE) 2016/679 (GDPR), puoi in qualsiasi momento:
              </p>
              <ul className="list-disc pl-5 space-y-2 mt-2">
                <li><strong>Scaricare i tuoi dati</strong> — Dalla sezione Profilo, clicca su "Scarica i Miei Dati (GDPR)" 
                  per ottenere un file JSON con tutte le tue informazioni personali (profilo, match, messaggi, blocchi, swipe)</li>
                <li><strong>Richiedere la cancellazione</strong> — Puoi eliminare il profilo o l'intero account 
                  direttamente dall'app</li>
                <li><strong>Contattarci</strong> — Per qualsiasi richiesta relativa ai tuoi dati, scrivi a 
                  privacyvibra@gmail.com</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">16. Geolocalizzazione</h2>
              <p>
                Alcune funzionalità di Vibra utilizzano la posizione del dispositivo:
              </p>
              <ul className="list-disc pl-5 space-y-2 mt-2">
                <li><strong>Sto Vibing Ora</strong> — La tua posizione viene usata per trovare utenti nelle vicinanze. 
                  I dati di posizione vengono conservati solo durante la sessione attiva (max 30 minuti) 
                  e cancellati alla scadenza</li>
                <li><strong>Condivisione Posizione in Chat</strong> — Puoi condividere volontariamente la tua posizione 
                  con un match. La posizione viene inviata come messaggio e resta visibile nella chat</li>
              </ul>
              <p className="mt-2 text-sm">
                L'accesso alla geolocalizzazione è sempre opzionale e richiede il tuo consenso esplicito 
                tramite il browser o il dispositivo.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">17. Terminazione</h2>
              <p>
                Possiamo sospendere o terminare il tuo account se violi questi termini, 
                in seguito a segnalazioni verificate, o per proteggere la sicurezza della community. 
                Puoi eliminare il tuo account in qualsiasi momento dalle impostazioni del profilo.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">18. Limitazione di Responsabilità</h2>
              <p>
                Vibra non è responsabile per le azioni degli utenti. Ti consigliamo di usare 
                prudenza quando interagisci con persone conosciute tramite l'app e di seguire le 
                nostre linee guida sulla sicurezza. Vibra non garantisce la veridicità 
                delle informazioni presenti nei profili degli utenti.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">19. Modifiche ai Termini</h2>
              <p>
                Possiamo modificare questi termini in qualsiasi momento. Ti notificheremo 
                di cambiamenti significativi via email o tramite l'app. L'uso continuato 
                dell'app dopo le modifiche costituisce accettazione dei nuovi termini.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">20. Contatti</h2>
              <p>
                Per domande sui Termini di Servizio, contattaci a:{" "}
                <a href="mailto:privacyvibra@gmail.com" className="text-primary hover:underline">privacyvibra@gmail.com</a>
              </p>
            </section>

            <section className="pt-4 border-t border-border">
              <p className="text-sm">
                Ultimo aggiornamento: 14 Febbraio 2026
              </p>
            </section>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

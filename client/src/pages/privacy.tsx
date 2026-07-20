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
            <div>
              <h1 className="text-2xl font-bold text-foreground">Privacy Policy</h1>
              <p className="text-xs text-muted-foreground">Aggiornata il 20 Luglio 2026 · GDPR conforme</p>
            </div>
          </div>
        </div>

        <Card className="bg-card/80 backdrop-blur-xl border-border">
          <CardContent className="p-6 space-y-6 text-muted-foreground text-sm leading-relaxed">

            <section className="pb-2 border-b border-border">
              <p className="font-bold text-foreground">INFORMATIVA SULLA PRIVACY – APP VIBRA</p>
              <p className="text-xs mt-1">Ai sensi del Reg. UE 2016/679 (GDPR), del D.Lgs. 196/2003 come modificato dal D.Lgs. 101/2018 e del Digital Services Act (DSA – Reg. UE 2022/2065)</p>
            </section>

            {/* 1. Titolare */}
            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">1. Titolare del Trattamento</h2>
              <p>Il Titolare del trattamento dei dati personali è:</p>
              <div className="mt-2 pl-4 border-l-2 border-primary/30 space-y-1">
                <p className="font-medium text-foreground">Mattoni Fabio</p>
                <p>Email privacy: <a href="mailto:privacyvibra@gmail.com" className="text-primary hover:underline">privacyvibra@gmail.com</a></p>
                <p>Luogo di trattamento: Italia</p>
              </div>
            </section>

            {/* 2. Principi */}
            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">2. Principi Generali</h2>
              <p>
                Vibra tratta i dati personali nel rispetto dei principi di liceità, correttezza, trasparenza,
                limitazione delle finalità, minimizzazione dei dati, esattezza, limitazione della conservazione
                e integrità e riservatezza, come previsto dall'art. 5 GDPR.
              </p>
            </section>

            {/* 3. Dati raccolti */}
            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">3. Dati Raccolti</h2>
              <p className="mb-2">Durante l'utilizzo dell'app Vibra possono essere raccolti:</p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li><strong>Dati di registrazione</strong>: email, username, data di nascita, età</li>
                <li><strong>Dati di profilo</strong>: foto, biografie, interessi, città di residenza</li>
                <li><strong>Dati di geolocalizzazione</strong>: posizione approssimativa, condivisa solo su consenso esplicito nell'attivazione della funzione "Sto Vibing Ora"</li>
                <li><strong>Contenuti pubblicati</strong>: messaggi, foto caricate, articoli del Blog, annunci del Marketplace, post nei Segnali Cosmici, video</li>
                <li><strong>Dati tecnici</strong>: indirizzo IP, log di accesso, tipo di dispositivo, sistema operativo, browser</li>
                <li><strong>Token di notifica push</strong>: per l'invio di notifiche, solo su consenso</li>
              </ul>
            </section>

            {/* 4. Finalità */}
            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">4. Finalità del Trattamento</h2>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>Creazione e gestione dell'account utente</li>
                <li>Fornitura del servizio di matchmaking e comunicazione tra utenti</li>
                <li>Pubblicazione di contenuti sulla piattaforma (Blog, Segnali, Marketplace)</li>
                <li>Calcolo della distanza tra utenti tramite formula di Haversine sulla città dichiarata</li>
                <li>Miglioramento del servizio, analisi tecnica e prevenzione abusi</li>
                <li>Invio di notifiche push sui match e messaggi (solo su consenso)</li>
                <li>Backup automatico dei dati della piattaforma a fini di sicurezza operativa</li>
              </ul>
            </section>

            {/* 5. Base giuridica */}
            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">5. Base Giuridica</h2>
              <ul className="list-disc pl-5 space-y-1.5">
                <li><strong>Consenso</strong> (art. 6 par. 1 lett. a GDPR): per geolocalizzazione, notifiche push, cookie non essenziali</li>
                <li><strong>Esecuzione del contratto</strong> (art. 6 par. 1 lett. b GDPR): per tutte le funzioni core dell'app</li>
                <li><strong>Legittimo interesse</strong> (art. 6 par. 1 lett. f GDPR): per sicurezza, prevenzione abusi e backup operativi</li>
              </ul>
            </section>

            {/* 6. Marketplace */}
            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">6. Marketplace — Compravendita tra Privati</h2>
              <p>
                Il Marketplace di Vibra è una bacheca di annunci tra utenti privati.{" "}
                <strong className="text-foreground">Vibra non è parte delle transazioni</strong> e non si assume alcuna responsabilità
                per la qualità, sicurezza, legalità degli oggetti messi in vendita né per eventuali controversie tra acquirente e venditore.
              </p>
              <p className="mt-2">
                I dati di contatto forniti negli annunci (numero di telefono, email) sono visibili agli utenti registrati
                e trattati al solo scopo di facilitare il contatto tra le parti. L'utente è responsabile delle informazioni
                personali che sceglie di pubblicare negli annunci.
              </p>
              <p className="mt-2">
                Vibra si riserva di rimuovere annunci che violino i Termini di Utilizzo, segnalino prodotti illegali
                o risultino fraudolenti, anche su segnalazione di altri utenti.
              </p>
            </section>

            {/* 7. Contenuti generati dagli utenti */}
            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">7. Contenuti Generati dagli Utenti (UGC) — Blog, Segnali, Chat</h2>
              <p>
                Gli utenti possono pubblicare contenuti testuali, fotografici, audio e video sulla piattaforma
                (Blog Comunitario, Segnali Cosmici, chat, Sfide). L'utente è il solo responsabile dei contenuti
                che pubblica e garantisce di possedere i diritti necessari.
              </p>
              <p className="mt-2">
                Ai sensi del <strong className="text-foreground">Digital Services Act (Reg. UE 2022/2065)</strong>, Vibra predispone
                un sistema di segnalazione contenuti illeciti. Gli utenti possono segnalare qualsiasi contenuto
                ritenuto inappropriato o illegale tramite i pulsanti "Segnala" presenti sulla piattaforma.
                Le segnalazioni sono esaminate e, se fondate, il contenuto viene rimosso entro un termine ragionevole.
              </p>
              <p className="mt-2">
                Per segnalazioni urgenti o contatti con autorità nazionali (es. AGCOM):
                <a href="mailto:privacyvibra@gmail.com" className="text-primary hover:underline ml-1">privacyvibra@gmail.com</a>
              </p>
            </section>

            {/* 8. Geolocalizzazione */}
            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">8. Geolocalizzazione</h2>
              <p>
                La funzione <strong className="text-foreground">"Sto Vibing Ora"</strong> richiede l'attivazione esplicita
                da parte dell'utente e condivide una posizione approssimativa (raggio configurabile da 1 a 10 km)
                con altri utenti attivi nelle vicinanze.
              </p>
              <p className="mt-2">
                I dati di posizione sono trattati esclusivamente durante la sessione attiva e non sono conservati
                dopo la disattivazione della funzione. L'utente può disattivare la condivisione in qualsiasi momento.
                La posizione non è mai mostrata in forma esatta: viene visualizzata solo la distanza approssimativa.
              </p>
            </section>

            {/* 9. Conservazione */}
            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">9. Conservazione dei Dati</h2>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>Dati account: conservati per tutta la durata dell'account attivo</li>
                <li>In caso di cancellazione account: eliminazione entro 30 giorni, salvo obblighi di legge</li>
                <li>Dati di geolocalizzazione (Vibing): eliminati al termine della sessione</li>
                <li>Log tecnici: conservati per massimo 12 mesi</li>
                <li>Backup operativi: conservati per 7 giorni, poi sostituiti dal backup successivo</li>
              </ul>
            </section>

            {/* 10. Condivisione */}
            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">10. Condivisione dei Dati</h2>
              <p>I dati non vengono venduti né commercializzati a terzi. Possono essere condivisi con:</p>
              <ul className="list-disc pl-5 space-y-1.5 mt-2">
                <li><strong>Replit Inc.</strong> (USA): hosting della piattaforma e object storage, con garanzie adeguate ex art. 46 GDPR</li>
                <li><strong>OpenAI</strong> (USA): elaborazione AI per le risposte dei profili virtuali e moderazione contenuti video, solo testo/frame anonimizzati</li>
                <li><strong>Google (Gmail)</strong>: invio email di benvenuto e comunicazioni di sistema</li>
                <li>Nessun trasferimento a terzi per finalità pubblicitarie o di profilazione commerciale</li>
              </ul>
            </section>

            {/* 11. Sicurezza */}
            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">11. Sicurezza</h2>
              <p>
                Vibra adotta misure tecniche e organizzative per proteggere i dati: connessioni cifrate (HTTPS/TLS),
                hashing delle password (bcrypt), backup automatici cifrati, accesso ai dati limitato al personale autorizzato.
              </p>
            </section>

            {/* 12. Diritti utente */}
            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">12. Diritti dell'Utente (artt. 15–22 GDPR)</h2>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>Accesso</strong>: ottenere copia dei propri dati</li>
                <li><strong>Rettifica</strong>: correggere dati inesatti</li>
                <li><strong>Cancellazione</strong>: richiedere l'eliminazione dell'account e dei dati</li>
                <li><strong>Limitazione</strong>: limitare il trattamento in determinati casi</li>
                <li><strong>Portabilità</strong>: ricevere i propri dati in formato strutturato</li>
                <li><strong>Opposizione</strong>: opporsi al trattamento basato su legittimo interesse</li>
                <li><strong>Revoca del consenso</strong>: in qualsiasi momento, senza pregiudicare la liceità del trattamento precedente</li>
              </ul>
              <p className="mt-3">
                Richieste: <a href="mailto:privacyvibra@gmail.com" className="text-primary hover:underline">privacyvibra@gmail.com</a> — risposta entro 30 giorni.
              </p>
            </section>

            {/* 13. Reclami */}
            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">13. Reclami</h2>
              <p>
                L'utente può proporre reclamo al{" "}
                <a href="https://www.garanteprivacy.it" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  Garante per la Protezione dei Dati Personali
                </a>{" "}
                (Piazza Venezia 11, 00187 Roma) qualora ritenga violati i propri diritti.
              </p>
            </section>

            {/* 14. Modifiche */}
            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">14. Modifiche alla Privacy Policy</h2>
              <p>
                Eventuali modifiche saranno pubblicate su questa pagina con indicazione della data di aggiornamento.
                In caso di modifiche sostanziali, gli utenti saranno informati tramite notifica in-app o email.
              </p>
            </section>

            <section className="pt-4 border-t border-border">
              <p className="text-xs text-muted-foreground">
                Ultimo aggiornamento: <strong>20 Luglio 2026</strong> · Versione 2.0
              </p>
            </section>

          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

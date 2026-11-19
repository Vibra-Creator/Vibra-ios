# Confronto caricamento dei media

## Metodo

Confronto eseguito prima e dopo le modifiche con Playwright Chromium, viewport mobile 402×874, cache e service worker esclusi. I byte sono quelli trasferiti entro cinque secondi da `DOMContentLoaded`.

Le schermate pubbliche misurate sono `/`, `/login` e `/register`. Le schermate protette (Hub, dating, Reels, chat e sfide) non sono state misurate nel browser automatico perché richiedono un accesso; per quelle è stata verificata la gestione dei media nel codice, senza simulare o aggirare l’autenticazione.

## Risultati delle schermate pubbliche

| Percorso | Prima | Dopo | Differenza entro 5 secondi |
|---|---:|---:|---:|
| `/` | 4.929.782 byte | 2.718.008 byte | −2.211.774 byte (circa −45%) |
| `/login` | 1.973.986 byte | 1.968.770 byte | −5.216 byte |
| `/register` | 2.747.283 byte | 2.741.891 byte | −5.392 byte |

La riduzione sulla landing deriva dal rinvio del video di sfondo: entro cinque secondi è visibile il poster leggero; il video parte dopo e continua a funzionare. Il test ha verificato che i video di landing, accesso e registrazione si caricano e riproducono dopo l’attesa. I valori non indicano un risparmio permanente quando il video viene effettivamente riprodotto.

## Asset alleggeriti

Gli originali non sono stati modificati né eliminati; l’app usa nuove copie WebP:

| Asset | Originale | Copia usata dall’app |
|---|---:|---:|
| Sfondo Hub | PNG 1.482.464 byte | WebP 75.268 byte (−95%) |
| Poster landing | JPEG 146.767 byte | WebP 33.482 byte (−77%) |

Sono stati aggiunti tre poster WebP da 17–27 KB per mantenere visibili gli sfondi di accesso, chat e sfide mentre i video attendono il caricamento.

## Schermate protette

- Hub/dating: rimosso il precaricamento esplicito di foto di 12 profili, richieste fino a 5 MB per ciascuno di un massimo di 15 video e gli otto video nascosti in autoplay. La scheda attiva conserva l’autoplay; la successiva non scarica il video in anticipo.
- Reels: il video attivo e i due adiacenti sono gestiti in modo progressivo; gli embed TikTok vengono creati solo quando l’elemento è vicino alla visualizzazione.
- Chat e sfide: i video di sfondo partono dopo che la schermata è visibile; il poster compare subito.
- Foto secondarie e contenuti nei pannelli dei profili usano caricamento differito; i video non partono finché non sono visibili o richiesti.

## Limiti della verifica

I totali protetti non sono stati misurati con un account reale. Il risparmio effettivo dipende dai contenuti presenti nei profili e dai media che ogni persona apre. Non è stata eseguita una pubblicazione in produzione.

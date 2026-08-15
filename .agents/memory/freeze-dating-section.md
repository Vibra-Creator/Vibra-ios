---
name: Freeze Dating Section for Apple Review
description: Piano concordato con Fabio per rimuovere temporaneamente la sezione dating dall'UI prima di ripubblicare su App Store, senza cancellare dati né codice.
---

## Piano operativo

**Obiettivo:** Superare la Guideline 4.3(b) di Apple ("app duplica dating apps già esistenti") rimuovendo la sezione dating dall'interfaccia visibile, mantenendo tutti i dati e il codice intatti in Replit.

**Why:** Apple usa revisori umani che interagiscono con l'app. Se la sezione dating non è raggiungibile dall'UI, non la trovano. Il codice nel repo è irrilevante per la revisione.

**Cosa rimuovere dall'UI (solo UI, nessuna cancellazione):**
- Il bottone/card nella Hub che porta alla sezione dating (swipe, match, profili).
- Le route client-side verso le pagine dating: `/` (home con swipe), `/chat`, `/matches` e simili.
- Qualsiasi link visibile che richiami il concetto di "dating" o "incontri romantici".

**Cosa lasciare intatto:**
- Tutte le tabelle del database (users, profiles, swipes, matches, messages, ecc.).
- Tutti gli iscritti e i loro dati.
- Il codice dei componenti dating (SwipeCard, MatchModal, ecc.) — solo disabilitato/commentato nelle route.
- Tutte le API server della parte dating.

**Come reintegrare dopo l'approvazione:**
- Rimettere il bottone Hub e le route client-side.
- Operazione stimata: pochi minuti.

**Stato:** IN ATTESA — Fabio ha chiesto di procedere tra circa 2 giorni (da agosto 2026). Non agire finché non arriva conferma esplicita.

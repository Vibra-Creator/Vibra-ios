---
name: Vibra Feature Blocks
description: Stato di avanzamento dei blocchi funzionalità avanzate di Vibra (VibraDNA, VibraGhost, VibraStory, VibraVault, ecc.)
---

## Blocchi completati

### Blocco 1 — VibraDNA + VibraGhost ✅
- Tabelle DB: `user_dna`, `dna_events`, `ghost_mode_expires_at` su `profiles`
- VibraDNA: traccia 5 tratti comportamentali (engagement, espressività, iniziativa, community, gamification)
- Compatibilità basata su complementarità (diff 0.2–0.6 per tratto = buona sinergia)
- VibraGhost: nasconde il profilo dagli swipe per 24h; filtrato da /api/profiles/swipable
- UI: DNA card con barre in profile.tsx; toggle Ghost in profile.tsx

### Blocco 2 — VibraStory + VibraVault ✅
- Tabelle DB: `stories`, `story_briciole`, `story_votes`, `vault_confessions`
- VibraStory: storie collettive; admin crea storia, utenti aggiungono "briciole" (testo + foto); voto up/down; admin seleziona briciola vincitrice; timeline narrativa
- Briciole usano lo stesso Object Storage (memoryUpload + objectStorageService) come foto profilo
- VibraVault: confessioni private con TTL 1–7 giorni; autodistruzione ogni ora via setInterval; AI genera sentiment legacy (emotion+emoji+essence) in background via OpenAI gpt-4o-mini
- Cleanup job: setInterval ogni 60min chiama storage.cleanExpiredVaultConfessions()
- Entry points: banner VibraStory in /rooms; pulsante VibraVault in /profile
- Route frontend: /stories (lista), /story/:id (dettaglio), /vault (confessioni)

## Blocchi rimanenti
- Blocco 3: VibraQuest (missioni giornaliere gamificate) + VibraLegacy (profilo "after you")
- Blocco 4: VibraMystery (profili anonimi a tempo) + VibraConsent (protocollo consenso esplicito)
- Blocco 5: Costellazioni (gruppi di affinità) + Eclissi (timeout volontario)

**Why:** VibraVibe (voice ML) NON è fattibile nello stack Node.js attuale — omessa.

## Pattern tecnici consolidati
- Upload media: `memoryUpload.single("field")` middleware → `objectStorageService.getObjectEntityUploadURL()` → PUT diretto → `trySetObjectEntityAclPolicy({ visibility: "public" })`
- Migrazioni: `CREATE TABLE IF NOT EXISTS` + `CREATE INDEX IF NOT EXISTS` in server/index.ts al startup
- AI async: fire-and-forget con `.then().catch()` per non bloccare la response

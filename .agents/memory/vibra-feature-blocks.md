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

### Blocco 3 — VibraQuest + VibraLegacy ✅
- VibraQuest: 5 missioni giornaliere (swipe_10, message_5, room_visit, signal_post, gift_send)
- Quest tracking fire-and-forget in tutte le route rilevanti
- Frontend: /quests page (vibraquests.tsx) con progress bar + claim ricompensa
- VibraLegacy: messaggio "nell'universo" con reveal timer
- Frontend: /legacy page (vibralegacy.tsx), bottone in profile.tsx

### Blocco 4 — VibraMystery + VibraConsent ✅
- VibraMystery: profilo anonimo temporaneo (mystery_mode_expires_at su profiles)
- Toggle in profile.tsx (Fingerprint icon, pink)
- VibraConsent: inbox richieste consenso (video_call, voice_message, photo_share, location_share)
- ConsentInbox component inline in profile.tsx con badge count + expandable drawer

### Blocco 5 — Costellazioni + Eclissi ✅
- Costellazioni: 6 gruppi di affinità basati su DNA dominante (Esploratori/Narratori/Pionieri/Custodi/Guerrieri/Equilibrati)
- Frontend: /constellations page (costellazioni.tsx), bottone in profile.tsx
- Eclissi: pausa profilo temporanea (eclipse_until su profiles)
- Toggle in profile.tsx (Moon icon, slate)

### Blocco 6 — VibraLegacy UI + VibraConsent UI + VibraTime ✅
- VibraTime: tabella `user_activity_log` (profileId, hour, dayOfWeek, count)
- Activity logging fire-and-forget su ogni /api/profiles/me
- Label "attivo/a di sera" etc. mostrata in chat header (solo utenti reali)
- Route: GET /api/time/my-pattern, GET /api/time/label/:profileId

## Pattern tecnici consolidati
- Upload media: `memoryUpload.single("field")` middleware → `objectStorageService.getObjectEntityUploadURL()` → PUT diretto → `trySetObjectEntityAclPolicy({ visibility: "public" })`
- Migrazioni: `CREATE TABLE IF NOT EXISTS` + `CREATE INDEX IF NOT EXISTS` in server/index.ts al startup
- AI async: fire-and-forget con `.then().catch()` per non bloccare la response
- VibraVibe (voice ML) NON è fattibile nello stack Node.js attuale — omessa
- Profile.tsx buttons order: VibraVault → VibraQuest → Costellazioni → VibraLegacy → ConsentInbox → VibraMystery toggle → Eclissi toggle → Ghost toggle → Edit → Guide → Push → Settings

import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import https from "https";
import { storage } from "./storage";
import { getProfileVideoCleanupCutoff, removeInactiveProfileVideos } from "./profile-video-cleanup";
import {
  createAdminBotImageFixHandler,
  registerAdminBotImageFixRoute,
} from "./admin-bot-image-fix";
import { insertSwipeSchema, insertProfileSchema, updateProfileSchema, insertMessageSchema, swipes, matches, messages, profiles, sentGifts, challengeSubmissions, dailyChallenges, roomMembers, roomMessages, privateRooms, privateRoomMessages, privateRoomRequests, profileRatings, blockedUsers, reports, vibingSessions, locationShares, users, referrals, appSettings, vibrappMessages, pushSubscriptions, hubPosts, insertHubPostSchema, events, insertEventSchema, blogPosts, insertBlogPostSchema, profileViews, coldMessages, userSuspensions } from "@shared/schema";
import { db } from "./db";
import { eq, or, and, ne, sql, lt, gt, desc, asc } from "drizzle-orm";
import { z } from "zod";
import {
  getReportSuspensionExpiry,
  isBlogPostAuthoredByReportedUser,
  isChatMessageAuthoredByReportedUser,
  isColdMessageAuthoredByReportedUser,
  isRoomMessageAuthoredByReportedUser,
  isReportContentType,
} from "./report-moderation";
import { captureDetailedReportContentSnapshot } from "./report-content-evidence";
import {
  isDetailedReportContentType,
  moderateDetailedReportInTransaction,
} from "./report-moderation-actions";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import { authStorage } from "./replit_integrations/auth/storage";
import multer from "multer";
import path from "path";
import fs from "fs";
import { randomUUID } from "crypto";
import { execFile } from "child_process";
import { promisify } from "util";
const execFileAsync = promisify(execFile);
import { registerObjectStorageRoutes, ObjectStorageService, ObjectNotFoundError, objectStorageClient } from "./replit_integrations/object_storage";
import { ObjectPermission } from "./replit_integrations/object_storage/objectAcl";
import OpenAI from "openai";
import { createBackup, getBackupList, startAutoBackup } from "./backup";
import { runMigrations } from "./migrate";
import { Server as SocketIOServer } from "socket.io";
import { getSession } from "./replit_integrations/auth/replitAuth";
import webpush from "web-push";
import {
  REPORT_CLEANUP_TTL_DAYS,
  buildReportCleanupStatusFailure,
  buildReportCleanupStatusResponse,
  createReportCleanupState,
  markReportCleanupFailed,
  markReportCleanupNotificationSent,
  markReportCleanupStarted,
  markReportCleanupSucceeded,
  restoreReportCleanupAlertState,
  shouldNotifyReportCleanupFailure,
  type ReportCleanupState,
} from "./report-cleanup";
import {
  COLD_MESSAGE_CLEANUP_TTL_DAYS,
  buildColdMessageCleanupStatusFailure,
  buildColdMessageCleanupStatusResponse,
  createColdMessageCleanupState,
  markColdMessageCleanupFailed,
  markColdMessageCleanupStarted,
  markColdMessageCleanupSucceeded,
  restoreColdMessageCleanupState,
  type ColdMessageCleanupState,
} from "./cold-message-cleanup";
import { getLegacyBotReplyState, shouldAutoReplyToDirectMessage } from "@shared/vibrapp-dm-policy";
import {
  renderLandingVideoSeoHtml,
  renderPublicProfileSeoHtml,
} from "./public-profile-seo";
import { filterOffensiveContent, filterUgcTextPayload, hasUgcTextPayload } from "./ugc-moderation";
import { createSuspensionWriteGuard } from "./suspension-write-guard";
import { createUserReportNotificationProcessor } from "./user-report-notifications";

const ADMIN_EMAILS = ["famax61@yahoo.com", "famax61@gmail.com"];

type AdminUserLookup = (userId: string) => Promise<Pick<NonNullable<Awaited<ReturnType<typeof storage.getUser>>>, "isAdmin" | "email"> | undefined>;
type AdminPromotion = (userId: string) => Promise<void>;
type ReportCleanupAdminUser = {
  email?: string | null;
  isAdmin?: boolean | null;
};
type ReportCleanupEmailRecipient = {
  email: string;
  name: string;
};
type ReportCleanupBulkEmailSender = (
  recipients: ReportCleanupEmailRecipient[],
  subject: string,
  htmlBody: string,
) => Promise<{ sent: number; failed: number }>;

export type ReportCleanupFailureNotifierDependencies = {
  getAllUsers: () => Promise<ReportCleanupAdminUser[]>;
  sendBulkCustomEmails: ReportCleanupBulkEmailSender;
  persistState: (state: ReportCleanupState) => Promise<void>;
  now?: () => string;
};

/**
 * Builds the cleanup alert sender used by the daily scheduler.
 *
 * Keeping recipient discovery and the Gmail boundary injectable makes this
 * operational path testable without connecting to Gmail or waiting on the
 * scheduler interval.
 */
export function createReportCleanupFailureNotifier(
  dependencies: ReportCleanupFailureNotifierDependencies,
) {
  return async (
    state: ReportCleanupState,
  ): Promise<ReportCleanupState> => {
    const notificationTimestamp = dependencies.now?.() ?? new Date().toISOString();
    const notificationTime = Date.parse(notificationTimestamp);
    if (!shouldNotifyReportCleanupFailure(
      state,
      Number.isFinite(notificationTime) ? notificationTime : Date.now(),
    )) {
      return state;
    }

    try {
      const adminUsers = await dependencies.getAllUsers();
      const recipientEmails = Array.from(new Set(
        adminUsers
          .filter((user) =>
            Boolean(user.email) &&
            (Boolean(user.isAdmin) || ADMIN_EMAILS.includes(user.email!.toLowerCase()))
          )
          .map((user) => user.email!.trim().toLowerCase())
          .filter((email) => email && !email.endsWith("@vibra.com")),
      ));

      if (recipientEmails.length === 0) {
        console.warn("[report-cleanup] failure alert skipped: no admin email recipients");
        return state;
      }

      const failureStreak = state.consecutiveFailures;
      const lastError = state.lastError || "Unknown cleanup error";
      const safeError = lastError
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
      const subject = `[Vibra] Orphaned report cleanup failed ${failureStreak} times`;
      const htmlBody = `
        <h2>Orphaned report cleanup requires attention</h2>
        <p>The scheduled cleanup has failed <strong>${failureStreak} consecutive times</strong>.</p>
        <p><strong>Last observed error:</strong> ${safeError}</p>
        <p>Check the admin cleanup status endpoint and deployment logs for more details.</p>
      `;

      const result = await dependencies.sendBulkCustomEmails(
        recipientEmails.map((email) => ({ email, name: "Vibra admin" })),
        subject,
        htmlBody,
      );

      if (result.sent > 0) {
        const notifiedState = markReportCleanupNotificationSent(
          state,
          notificationTimestamp,
        );
        try {
          await dependencies.persistState(notifiedState);
        } catch (stateError) {
          console.error("[report-cleanup] alert state persistence failed:", stateError);
        }
        console.warn(
          `[report-cleanup] failure alert sent=${result.sent} failed=${result.failed} ` +
          `consecutiveFailures=${failureStreak}`,
        );
        return notifiedState;
      }

      console.error("[report-cleanup] failure alert could not be sent to any admin");
    } catch (notificationError) {
      console.error("[report-cleanup] failure alert error:", notificationError);
    }

    return state;
  };
}

export function createAdminAuthorizationMiddleware(
  getUser: AdminUserLookup = (userId) => storage.getUser(userId),
  promoteUser: AdminPromotion = async (userId) => {
    await db.update(users).set({ isAdmin: true }).where(eq(users.id, userId));
  },
) {
  return async (req: any, res: any, next: any) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const user = await getUser(userId);
      if (!user) {
        return res.status(403).json({ error: "Admin access required" });
      }

      if (!user.isAdmin && user.email && ADMIN_EMAILS.includes(user.email.toLowerCase())) {
        await promoteUser(userId);
        user.isAdmin = true;
      }

      if (!user.isAdmin) {
        return res.status(403).json({ error: "Admin access required" });
      }

      return next();
    } catch (error) {
      return res.status(500).json({ error: "Server error" });
    }
  };
}

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  timeout: 15_000,
});

function getAiSearchFallback(query: string) {
  const q = query.toLowerCase();
  const routes: Array<{ words: string[]; route: string; message: string; emoji: string }> = [
    { words: ["conoscere", "gente", "persone", "dating", "profili", "swipe"], route: "/", message: "Ti porto a scoprire nuove persone", emoji: "❤️" },
    { words: ["match", "chat", "messaggi", "conversazione"], route: "/matches", message: "Apri i tuoi match e le conversazioni", emoji: "💬" },
    { words: ["stanza", "stanze", "gruppo", "community"], route: "/rooms", message: "Dai un'occhiata alle stanze della community", emoji: "🌐" },
    { words: ["sfida", "challenge", "concorso"], route: "/challenges", message: "Scopri le challenge di oggi", emoji: "🏆" },
    { words: ["video", "reel", "reels"], route: "/reels", message: "Guarda gli ultimi video", emoji: "🎬" },
    { words: ["online", "vicine", "vicino"], route: "/vibing", message: "Scopri chi sta vibing ora", emoji: "⚡" },
    { words: ["profilo", "modifica"], route: "/profile", message: "Apri il tuo profilo", emoji: "👤" },
    { words: ["musica", "spotify", "canzoni"], route: "/spotify", message: "Apri la sezione musica", emoji: "🎵" },
    { words: ["lavoro", "lavorare"], route: "/lavoro", message: "Vai alla sezione lavoro", emoji: "💼" },
    { words: ["giovani", "erasmus", "volontariato"], route: "/giovani", message: "Scopri le opportunità per giovani", emoji: "✨" },
  ];
  const match = routes.find((item) => item.words.some((word) => q.includes(word)));
  return match
    ? { action: "navigate" as const, route: match.route, external_url: null, message: match.message, emoji: match.emoji }
    : { action: "none" as const, route: null, external_url: null, message: "Posso aiutarti a trovare una sezione di Vibra: prova con chat, musica, lavoro o profili", emoji: "✨" };
}

async function moderateVideoThumbnail(thumbnailBase64: string): Promise<{ approved: boolean; reason: string }> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_completion_tokens: 100,
      messages: [
        {
          role: "system",
          content: `You are a content moderator for a dating app. Review the image and determine if it contains any of the following prohibited content: nudity, sexual content, graphic violence, hate symbols, racism, religious blasphemy, self-harm promotion, or any other content inappropriate for a social dating platform. Respond ONLY with JSON: {"approved": true/false, "reason": "brief reason in Italian"}`
        },
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${thumbnailBase64}`, detail: "low" } }
          ]
        }
      ]
    });
    const text = response.choices[0]?.message?.content || "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return { approved: parsed.approved !== false, reason: parsed.reason || "" };
    }
    return { approved: true, reason: "" };
  } catch (err: any) {
    console.error("[video-moderation] AI error, defaulting to approved:", err?.message);
    return { approved: true, reason: "" };
  }
}

async function generateBotReply(
  botProfile: any,
  userProfile: any,
  chatHistory: { senderId: string; content: string }[]
): Promise<string> {
  try {
    const recentMessages = chatHistory.slice(-10);

    const isMale = botProfile.gender === "Uomo";
    const systemPrompt = `Sei ${botProfile.name}, ${isMale ? "un tizio" : "una tipa"} di ${botProfile.age} anni di ${botProfile.location}. ${botProfile.bio || ""}
Interessi: ${(botProfile.interests || []).join(", ")}.${botProfile.zodiacSign ? ` Sei ${botProfile.zodiacSign}.` : ""}

Stai scrivendo su un'app di incontri con ${userProfile.name}. Scrivi esattamente come faresti su WhatsApp con qualcuno che hai appena conosciuto.

STILE:
- Frasi cortissime. Max 1-2 frasi, spesso anche solo mezza.
- Usa abbreviazioni naturali: cmq, nn, ke, xché, boh, tipo, cioè, ngl, tra, sto, amo, dai, ma va, esatto, lol, ahah, haha, ok, oki, mh.
- Niente punteggiatura formale. Niente maiuscole all'inizio. Niente punto finale.
- Tono rilassato, a volte pigro. Come se stessi scrivendo dal divano.

CARATTERE — IMPORTANTISSIMO:
- NON dare sempre ragione. Se non sei d'accordo, dillo chiaramente ma senza essere scortese.
- Hai opinioni tue e le difendi. Se ${userProfile.name} dice una cazzata, puoi dirlo bonariamente.
- Non sei entusiasta di tutto. Qualcosa ti piace, qualcosa no. Reagisci in modo onesto.
- Non fare domande a ogni messaggio. A volte rispondi e basta, senza chiedere nulla.
- Non essere servile o accondiscendente. Niente "wow che bello!", "che interessante!", "hai ragione!".
- Se l'altro flirta, rispondi con ironia o curiosità, non in modo scontato.
- Puoi essere un po' pigro/a, distante, o concentrato/a su altro — è umano.

VIETATO:
- Fare liste o rispondere in modo strutturato.
- Usare più di 1 emoji (spesso zero è meglio).
- Dire che sei un bot, IA, programma. Sei una persona reale.
- Ripetere frasi già dette.
- Iniziare con "Ciao!" o il nome dell'altro ogni volta.`;

    const messagesForAI: any[] = [
      { role: "system", content: systemPrompt }
    ];

    for (const msg of recentMessages) {
      const isBot = msg.senderId === botProfile.id;
      messagesForAI.push({
        role: isBot ? "assistant" : "user",
        content: msg.content
      });
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: messagesForAI,
      max_tokens: 120,
      temperature: 1.1,
    });

    return response.choices[0]?.message?.content?.trim() || "mh nn so cosa dirti lol";
  } catch (error) {
    console.error("Error generating bot reply:", error);
    const fallbackReplies = [
      "boh, nn sono sicuro/a di quello che dici",
      "mh dipende, non è così scontato",
      "ahah ok ok, ma tipo... davvero?",
      "nn so, ho idee diverse su questa cosa",
      "ma va, esagerato/a 😄",
      "cmq sì, anche se nn sono del tutto d'accordo",
      "oki ma tipo aspetta che ci penso",
    ];
    return fallbackReplies[Math.floor(Math.random() * fallbackReplies.length)];
  }
}

// Genera il primo messaggio del bot dopo un match (mai ripetuto, personalizzato)
// ─── Helper: calcola il delay realistico per la risposta del bot ─────────────
function getBotDelay(botProfile: any): { readDelayMs: number; isOnline: boolean } {
  const lastActive = botProfile.lastActiveAt ? new Date(botProfile.lastActiveAt) : null;
  const minutesSince = lastActive
    ? (Date.now() - lastActive.getTime()) / 60_000
    : 9999;

  if (minutesSince < 30) {
    // Bot attivamente online: legge in 5-25s
    return { isOnline: true, readDelayMs: 5_000 + Math.random() * 20_000 };
  } else if (minutesSince < 120) {
    // Bot "away": legge in 3-20 min
    return { isOnline: false, readDelayMs: 3 * 60_000 + Math.random() * 17 * 60_000 };
  } else {
    // Bot offline: legge in 30 min - 5 ore
    return { isOnline: false, readDelayMs: 30 * 60_000 + Math.random() * 4.5 * 60 * 60_000 };
  }
}

function getBotTypingMs(replyText: string): number {
  // Velocità di scrittura realistica: min 6s, max 28s
  return Math.max(6_000, Math.min(28_000, replyText.length * 180));
}

async function generateBotOpener(botProfile: any, userProfile: any): Promise<string> {
  try {
    const isMaleOpener = botProfile.gender === "Uomo";
    const commonInterests = (botProfile.interests || []).filter((i: string) =>
      (userProfile.interests || []).includes(i)
    );
    const systemPrompt = `Sei ${botProfile.name}, ${isMaleOpener ? "un tizio" : "una tipa"} di ${botProfile.age} anni di ${botProfile.location}.
Interessi: ${(botProfile.interests || []).join(", ")}.${commonInterests.length ? ` Interessi in comune con ${userProfile.name}: ${commonInterests.join(", ")}.` : ""}

Hai appena fatto match con ${userProfile.name}, ${userProfile.age} anni${userProfile.location ? ` di ${userProfile.location}` : ""}. Mandagli/le UN messaggio iniziale.

STILE — scrivi come su WhatsApp, max 1-2 frasi cortissime:
- Niente "Ciao [nome]!" come apertura — è banale.
- Niente entusiasmo forzato tipo "che bello il match!".
- Puoi fare una battuta, un commento ironico, una domanda semplice, o anche solo una mezza frase curiosa.
- Abbreviazioni ok: cmq, tipo, boh, ahah, nn, ngl.
- Zero maiuscole all'inizio, zero punto finale, max 1 emoji o zero.
- Tono: diretto, curioso, con un po' di personalità. Non servile.
- Non rivelare mai di essere un bot.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: "[Invia il tuo primo messaggio dopo il match]" },
      ],
      max_tokens: 80,
      temperature: 1.0,
    });
    return response.choices[0]?.message?.content?.trim() || "allora, dimmi qualcosa";
  } catch {
    const fallbacks = [
      "ok quindi... dimmi una cosa su di te che non si capisce dal profilo",
      "ehi. swipato quasi per sbaglio ma poi ho guardato meglio ahah",
      "ciao, nn so mai come iniziare sti messaggi lol",
      "dimmi che nn sei di quelli che spariscono dopo il match",
      "quindi, cosa ci fai su questa app?",
      "boh tipo ciao, vediamo come va",
    ];
    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
  }
}

async function generateBotReengagement(botProfile: any, userProfile: any, lastMessageContent?: string): Promise<string> {
  try {
    const isMale = botProfile.gender === "Uomo";
    const systemPrompt = `Sei ${botProfile.name}, ${isMale ? "un tizio" : "una tipa"} di ${botProfile.age} anni di ${botProfile.location}.
Hai matchato con ${userProfile.name} su un'app di incontri ma non vi scrivete da qualche giorno.

Mandagli/le UN messaggio di ripresa. STILE WhatsApp, max 1-2 frasi cortissime.

REGOLE ASSOLUTE — rispettale tutte:
- VIETATO riferirsi a eventi, uscite, film, locali, viaggi o qualsiasi cosa fatta "insieme" — non è mai successo niente.
- VIETATO inventare ricordi condivisi o situazioni passate specifiche.
- Messaggi GENERALI e INFORMALI: battuta leggera, domanda curiosa generica, pensiero random del momento.
- Niente "ci sei?" o "come stai?" — troppo banale.
- Abbreviazioni ok: cmq, tipo, boh, ahah, nn.
- Zero maiuscole all'inizio, zero punto finale, max 1 emoji o zero.
- Tono: diretto, un po' ironico, spontaneo.
- Non rivelare mai di essere un bot.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: "[Riprendi la conversazione]" },
      ],
      max_tokens: 80,
      temperature: 1.1,
    });
    return response.choices[0]?.message?.content?.trim() || "ehi, stavo pensando a te ahah";
  } catch {
    const fallbacks = [
      "ehi, ancora vivo/a ahah",
      "scommetto che hai dimenticato che esistevo lol",
      "ok tipo mi sono ricordato/a che esisti",
      "ciao, ancora qui 👀",
      "dimmi che non sono solo io a sparire ogni tanto",
      "boh stavo pensando a niente e poi ho aperto l'app",
      "si può sapere dove sei sparito/a",
    ];
    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
  }
}

const uploadsDir = path.join(process.cwd(), "uploads");
fs.mkdirSync(path.join(uploadsDir, "profiles"), { recursive: true });
fs.mkdirSync(path.join(uploadsDir, "challenges"), { recursive: true });

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowed.includes(file.mimetype)) {
      cb(new Error("Formato non supportato. Usa JPG, PNG, WebP o GIF."));
      return;
    }
    cb(null, true);
  },
});

const videoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 250 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["video/mp4", "video/quicktime", "video/webm", "video/x-m4v", "video/x-mp4"];
    if (!allowed.includes(file.mimetype)) {
      cb(new Error("Formato video non supportato. Usa MP4, MOV o WebM."));
      return;
    }
    cb(null, true);
  },
});

const objectStorageService = new ObjectStorageService();

export async function getColdMessageByIdHandler(req: any, res: any) {
  try {
    const userId = req.user?.claims?.sub || req.session?.userId;
    if (!userId) return res.status(401).json({ error: "Non autenticato" });
    const myProfile = await storage.getProfileByUserId(userId);
    if (!myProfile) return res.status(404).json({ error: "Profilo non trovato" });
    const msg = await storage.getColdMessageById(req.params.id);
    if (!msg) return res.status(404).json({ error: "Messaggio non trovato", reason: "message_deleted" });
    // Autorizzato solo se è il mittente o il destinatario
    if (msg.fromProfileId !== myProfile.id && msg.toProfileId !== myProfile.id) {
      return res.status(403).json({ error: "Non autorizzato" });
    }
    const isSentByMe = msg.fromProfileId === myProfile.id;
    // When the current user is the recipient, verify the sender is still reachable:
    // 1. Their profile must still exist (account not deleted)
    // 2. They must not have blocked the recipient after sending the message
    if (!isSentByMe) {
      const senderProfile = await storage.getProfile(msg.fromProfileId);
      if (!senderProfile) {
        return res.status(404).json({ error: "Il mittente ha eliminato il proprio account", reason: "sender_deleted" });
      }
      const senderBlockedRecipient = await storage.isBlocked(msg.fromProfileId, myProfile.id);
      if (senderBlockedRecipient) {
        return res.status(403).json({ error: "Messaggio non più disponibile", reason: "sender_blocked" });
      }
    }
    // Restituisce anche il profilo dell'altra persona
    const otherProfileId = isSentByMe ? msg.toProfileId : msg.fromProfileId;
    const otherProfile = await storage.getProfile(otherProfileId);
    // A sender can still view their sent message after the recipient deletes
    // their account; keep the detail response valid and represent that profile as null.
    res.json({
      ...msg,
      otherProfile: otherProfile ? { id: otherProfile.id, name: otherProfile.name, age: otherProfile.age, imageUrl: otherProfile.imageUrl } : null,
      isSentByMe,
    });
  } catch (err) {
    res.status(500).json({ error: "Errore" });
  }
}

type ColdMessageReplyNotifier = (
  dmMsg: {
    id: string;
    fromProfileId: string;
    toProfileId: string;
    content: string;
    readAt: Date | null;
    createdAt: Date;
    senderName: string;
    senderImage: string | null;
  },
  recipientProfileId: string,
  senderName: string,
) => void;

export async function postColdMessageReplyHandler(
  req: any,
  res: any,
  notifyReply?: ColdMessageReplyNotifier,
) {
  try {
    const userId = req.user?.claims?.sub || req.session?.userId;
    if (!userId) return res.status(401).json({ error: "Non autenticato" });
    const myProfile = await storage.getProfileByUserId(userId);
    if (!myProfile) return res.status(400).json({ error: "Profilo non trovato" });
    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: "Messaggio mancante" });
    const msg = await storage.getColdMessageById(req.params.id);
    if (!msg) return res.status(404).json({ error: "Messaggio non trovato" });
    if (msg.toProfileId !== myProfile.id) return res.status(403).json({ error: "Non autorizzato" });
    if (msg.replied) return res.status(400).json({ error: "Già risposto" });
    // The sender may have deleted their account or blocked the recipient
    // after the reply panel was opened. Re-check reachability immediately
    // before creating the Vibrapp DM.
    const senderProfile = await storage.getProfile(msg.fromProfileId);
    if (!senderProfile) {
      return res.status(403).json({
        error: "Questo messaggio non è più disponibile: il mittente ha eliminato il proprio account",
        reason: "sender_deleted",
      });
    }
    const senderBlockedRecipient = await storage.isBlocked(msg.fromProfileId, myProfile.id);
    if (senderBlockedRecipient) {
      return res.status(403).json({
        error: "Questo messaggio non è più disponibile: il mittente ti ha bloccato",
        reason: "sender_blocked",
      });
    }

    let vibrappDm: any;
    try {
      ({ vibrappDm } = await storage.replyColdMessage(req.params.id, content.trim().substring(0, 500)));
    } catch (err: any) {
      // Keep the HTTP contract stable if either reachability check changes
      // between the route validation and the storage operation.
      if (err?.code === "sender_deleted") {
        return res.status(403).json({
          error: "Questo messaggio non è più disponibile: il mittente ha eliminato il proprio account",
          reason: "sender_deleted",
        });
      }
      if (err?.code === "sender_blocked") {
        return res.status(403).json({
          error: "Questo messaggio non è più disponibile: il mittente ti ha bloccato",
          reason: "sender_blocked",
        });
      }
      throw err;
    }

    const dmMsg = {
      id: vibrappDm.id,
      fromProfileId: vibrappDm.fromProfileId,
      toProfileId: vibrappDm.toProfileId,
      content: vibrappDm.content,
      readAt: vibrappDm.readAt,
      createdAt: vibrappDm.createdAt,
      senderName: myProfile.name,
      senderImage: myProfile.imageUrl,
    };
    notifyReply?.(dmMsg, msg.fromProfileId, myProfile.name);
    return res.json({ dm: dmMsg, privateRoomId: null });
  } catch (err) {
    console.error("[cold-messages reply]", err);
    return res.status(500).json({ error: "Errore" });
  }
}

export function registerColdMessageListRoutes(app: Express): void {
  app.get("/api/cold-messages/pending-count", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) return res.status(401).json({ error: "Non autenticato" });
      const myProfile = await storage.getProfileByUserId(userId);
      if (!myProfile) return res.json({ count: 0 });
      const msgs = await storage.getColdMessagesReceived(myProfile.id);
      const count = msgs.filter(m => !m.replied).length;
      res.json({ count });
    } catch (err) {
      res.status(500).json({ error: "Errore" });
    }
  });

  app.get("/api/cold-messages/sent", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) return res.status(401).json({ error: "Non autenticato" });
      const myProfile = await storage.getProfileByUserId(userId);
      if (!myProfile) return res.status(404).json({ error: "Profilo non trovato" });
      const messages = await storage.getSentColdMessages(myProfile.id);
      res.json(messages);
    } catch (err) {
      console.error("[cold-messages sent]", err);
      res.status(500).json({ error: "Errore" });
    }
  });

  app.get("/api/cold-messages/received", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) return res.status(401).json({ error: "Non autenticato" });
      const myProfile = await storage.getProfileByUserId(userId);
      if (!myProfile) return res.status(404).json({ error: "Profilo non trovato" });
      const messages = await storage.getColdMessagesReceived(myProfile.id);
      res.json(messages);
    } catch (err) {
      console.error("[cold-messages received]", err);
      res.status(500).json({ error: "Errore" });
    }
  });
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  let reportCleanupStatus = createReportCleanupState();
  let coldMessageCleanupStatus = createColdMessageCleanupState();
  let bannedWordCache: string[] = [];
  let bannedWordCacheExpiresAt = 0;
  let bannedWordRefresh: Promise<string[]> | null = null;
  let disconnectUserSockets = (_profileId: string) => {};

  async function getBannedWordsForFiltering(): Promise<string[]> {
    if (Date.now() < bannedWordCacheExpiresAt) return bannedWordCache;
    if (bannedWordRefresh) return bannedWordRefresh;

    bannedWordRefresh = storage.getBannedWords()
      .then((words) => {
        bannedWordCache = words.map((entry) => entry.word).filter(Boolean);
        bannedWordCacheExpiresAt = Date.now() + 60_000;
        return bannedWordCache;
      })
      .finally(() => {
        bannedWordRefresh = null;
      });

    return bannedWordRefresh;
  }

  async function persistReportCleanupAlertState() {
    const lastNotificationAt = reportCleanupStatus.lastNotificationAt;
    await storage.saveReportCleanupAlertState({
      consecutiveFailures: reportCleanupStatus.consecutiveFailures,
      lastNotificationAt: lastNotificationAt ? new Date(lastNotificationAt) : null,
      lastError: reportCleanupStatus.lastError,
    });
  }

  async function persistColdMessageCleanupStatus() {
    try {
      await storage.saveColdMessageCleanupState({
        lastAttemptAt: coldMessageCleanupStatus.lastAttemptAt
          ? new Date(coldMessageCleanupStatus.lastAttemptAt)
          : null,
        lastSuccessAt: coldMessageCleanupStatus.lastSuccessAt
          ? new Date(coldMessageCleanupStatus.lastSuccessAt)
          : null,
        status: coldMessageCleanupStatus.status,
        lastDeletedCount: coldMessageCleanupStatus.lastDeletedCount,
        consecutiveFailures: coldMessageCleanupStatus.consecutiveFailures,
        lastError: coldMessageCleanupStatus.lastError,
      });
    } catch (stateError) {
      console.error("[cold-message-cleanup] status persistence failed:", stateError);
    }
  }

  const notifyAdminsOfReportCleanupFailure = createReportCleanupFailureNotifier({
    getAllUsers: () => storage.getAllUsers(),
    sendBulkCustomEmails: async (recipients, subject, htmlBody) => {
      const { sendBulkCustomEmails } = await import("./gmail");
      return sendBulkCustomEmails(recipients, subject, htmlBody);
    },
    persistState: async (state) => {
      reportCleanupStatus = state;
      await persistReportCleanupAlertState();
    },
  });

  const notifyAdminsOfNewUserReport = createUserReportNotificationProcessor({
    claimPendingReports: (options) => storage.claimPendingReportNotifications(options),
    getAdminRecipients: async () => (await storage.getAllUsers())
      .filter((user) => user.isAdmin && user.email)
      .map((user) => ({
        email: user.email!,
        name: user.firstName || "Admin",
      })),
    sendBulkEmail: async (recipients, subject, htmlBody) => {
      const { sendBulkCustomEmails } = await import("./gmail");
      return sendBulkCustomEmails(recipients, subject, htmlBody);
    },
    markSent: (reportId, sentAt) => storage.markReportNotificationSent(reportId, sentAt),
    scheduleRetry: (reportId, nextAttemptAt, error) =>
      storage.scheduleReportNotificationRetry(reportId, nextAttemptAt, error),
  });

  app.get("/sw.js", (req, res, next) => {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    next();
  });

  app.get("/robots.txt", (_req, res) => {
    res.setHeader("Content-Type", "text/plain");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.setHeader("X-Robots-Tag", "index, follow");
    res.send(`User-agent: *
Allow: /

Sitemap: https://vibraalienmatch.com/sitemap.xml
`);
  });

  app.get("/sitemap.xml", (_req, res) => {
    const baseUrl = "https://vibraalienmatch.com";
    const now = new Date().toISOString().slice(0, 10);
    const pages = [
      { url: "/", priority: "1.0", changefreq: "daily" },
      { url: "/landing", priority: "0.9", changefreq: "weekly" },
      { url: "/register", priority: "0.8", changefreq: "monthly" },
      { url: "/login", priority: "0.7", changefreq: "monthly" },
      { url: "/onboarding", priority: "0.6", changefreq: "monthly" },
      { url: "/privacy", priority: "0.5", changefreq: "yearly" },
      { url: "/terms", priority: "0.5", changefreq: "yearly" },
    ];
    const urlEntries = pages.map(p => `  <url>
    <loc>${baseUrl}${p.url}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`).join("\n");
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntries}
</urlset>`;
    res.setHeader("Content-Type", "application/xml");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.setHeader("X-Robots-Tag", "index, follow");
    res.send(xml);
  });

  app.get("/.well-known/assetlinks.json", (_req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.json([
      {
        relation: ["delegate_permission/common.handle_all_urls"],
        target: {
          namespace: "android_app",
          package_name: "com.vibraalienmatch.twa",
          sha256_cert_fingerprints: [
            "F2:EE:46:7D:EA:76:82:1D:81:24:17:35:94:33:EB:D8:47:8D:6A:2D:32:EA:DD:0C:C9:E1:A9:AE:11:45:63:45",
            "F2:3F:20:9E:5D:14:A2:21:35:C4:6E:9A:E2:3F:FA:01:AC:F4:94:B7:15:7C:72:55:F0:36:6E:9E:B3:34:3C:7C"
          ]
        }
      }
    ]);
  });

  app.get("/upload_certificate.pem", (_req, res) => {
    res.status(404).send("Not found");
  });

  app.get("/download/upload_certificate.pem", (req, res) => {
    const pemPath = path.join(process.cwd(), "server", "upload_certificate.pem");
    if (fs.existsSync(pemPath)) {
      res.setHeader("Content-Type", "application/x-pem-file");
      res.setHeader("Content-Disposition", "attachment; filename=upload_certificate.pem");
      res.sendFile(pemPath);
    } else {
      res.status(404).send("File not found");
    }
  });

  await setupAuth(app);
  registerAuthRoutes(app);
  app.use("/api", createSuspensionWriteGuard({
    getUser: (userId) => storage.getUser(userId),
    getActiveSuspension: (userId) => storage.getActiveSuspension(userId),
    adminEmails: ADMIN_EMAILS,
    logError: (message, error) => console.error(message, error),
  }));
  registerObjectStorageRoutes(app);

  app.use("/api", async (req: any, res, next) => {
    if (!["POST", "PUT", "PATCH"].includes(req.method) || !req.body || typeof req.body !== "object") {
      return next();
    }
    if (!hasUgcTextPayload(req.body)) return next();
    if (/^\/api\/reports(?:\/|$)/.test(req.originalUrl.split("?")[0])) {
      return next();
    }

    try {
      req.body = filterUgcTextPayload(req.body, await getBannedWordsForFiltering());
      return next();
    } catch (error) {
      console.error("[ugc-moderation] Could not load the banned-word list:", error);
      return res.status(503).json({
        error: "Content moderation is temporarily unavailable. Please try again shortly.",
      });
    }
  });

  const activityCache = new Map<string, number>();
  app.use(async (req: any, _res, next) => {
    try {
      const userId = req.session?.userId;
      if (userId) {
        const now = Date.now();
        const lastUpdate = activityCache.get(userId) || 0;
        if (now - lastUpdate > 60000) {
          activityCache.set(userId, now);
          const profile = await storage.getProfileByUserId(userId);
          if (profile) {
            db.update(profiles).set({ lastActiveAt: new Date() }).where(eq(profiles.id, profile.id)).execute().catch(() => {});
          }
        }
      }
    } catch {}
    next();
  });

  async function cleanExpiredRoomMembers() {
    try {
      const cutoff = new Date(Date.now() - 12 * 60 * 60 * 1000);
      const result = await db.delete(roomMembers).where(lt(roomMembers.joinedAt, cutoff));
      console.log(`[room-cleanup] Cleaned expired room members`);
    } catch (e) {
      console.error("[room-cleanup] Error:", e);
    }
  }
  cleanExpiredRoomMembers();
  setInterval(cleanExpiredRoomMembers, 30 * 60 * 1000);

  // ─── Run schema migrations (idempotent) ──────────────────────────────────
  try {
    await runMigrations();
    const persistedReportCleanupState = await storage.getReportCleanupAlertState();
    if (persistedReportCleanupState) {
      reportCleanupStatus = restoreReportCleanupAlertState(reportCleanupStatus, {
        consecutiveFailures: persistedReportCleanupState.consecutiveFailures,
        lastNotificationAt: persistedReportCleanupState.lastNotificationAt?.toISOString() ?? null,
        lastError: persistedReportCleanupState.lastError,
      });
    }
    const persistedColdMessageCleanupState = await storage.getColdMessageCleanupState();
    if (persistedColdMessageCleanupState) {
      coldMessageCleanupStatus = restoreColdMessageCleanupState(coldMessageCleanupStatus, {
        lastAttemptAt: persistedColdMessageCleanupState.lastAttemptAt?.toISOString() ?? null,
        lastSuccessAt: persistedColdMessageCleanupState.lastSuccessAt?.toISOString() ?? null,
        status: persistedColdMessageCleanupState.status as ColdMessageCleanupState["status"],
        lastDeletedCount: persistedColdMessageCleanupState.lastDeletedCount,
        consecutiveFailures: persistedColdMessageCleanupState.consecutiveFailures,
        lastError: persistedColdMessageCleanupState.lastError,
      });
    }
  } catch (e) {
    console.error("[migrate] migration error:", e);
    throw e;
  }
  void notifyAdminsOfNewUserReport();
  setInterval(() => void notifyAdminsOfNewUserReport(), 60 * 1000);

  async function cleanOldVibrappMessages() {
    try {
      const result = await db.execute(sql`
        DELETE FROM vibrapp_messages
        WHERE created_at < NOW() - INTERVAL '24 hours'
      `);
      const count = (result as any).rowCount ?? 0;
      if (count > 0) console.log(`[vibrapp-cleanup] Deleted ${count} messages older than 24h`);
    } catch (e) {
      console.error("[vibrapp-cleanup] Error:", e);
    }
  }
  cleanOldVibrappMessages();
  setInterval(cleanOldVibrappMessages, 30 * 60 * 1000);

  // ─── Orphaned report row cleanup ─────────────────────────────────────────
  // Reports whose reported profile has been deleted AND whose reportedUserId
  // no longer maps to any active profile are safe to remove after 90 days.
  // Reports where the userId still has a live profile are kept intentionally
  // so the cold-message filter survives account recreation (Task #23).
  async function pruneOrphanedReports() {
    const attemptAt = new Date().toISOString();
    reportCleanupStatus = markReportCleanupStarted(reportCleanupStatus, attemptAt);
    try {
      const deleted = await storage.pruneOrphanedReports(REPORT_CLEANUP_TTL_DAYS);
      const completedAt = new Date().toISOString();
      reportCleanupStatus = markReportCleanupSucceeded(reportCleanupStatus, deleted, completedAt);
      try {
        await persistReportCleanupAlertState();
      } catch (stateError) {
        console.error("[report-cleanup] alert state reset persistence failed:", stateError);
      }
      console.log(
        `[report-cleanup] status=success deleted=${deleted} ttlDays=${REPORT_CLEANUP_TTL_DAYS} ` +
        `attemptedAt=${attemptAt} completedAt=${completedAt}`
      );
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      reportCleanupStatus = markReportCleanupFailed(reportCleanupStatus, e);
      try {
        await persistReportCleanupAlertState();
      } catch (stateError) {
        console.error("[report-cleanup] alert state persistence failed:", stateError);
      }
      console.error(
        `[report-cleanup] status=failure ttlDays=${REPORT_CLEANUP_TTL_DAYS} ` +
        `attemptedAt=${attemptAt} consecutiveFailures=${reportCleanupStatus.consecutiveFailures} ` +
        `error=${errorMessage}`,
        e
      );
      reportCleanupStatus = await notifyAdminsOfReportCleanupFailure(reportCleanupStatus);
    }
  }
  pruneOrphanedReports();
  // Run once a day (every 24 h)
  setInterval(pruneOrphanedReports, 24 * 60 * 60 * 1000);

  // ─── Orphaned cold-message cleanup ───────────────────────────────────────
  // Cold messages addressed to deleted profiles no longer have a recipient and
  // can be removed once they are outside the retention window.
  async function pruneOrphanedColdMessages() {
    const attemptAt = new Date().toISOString();
    coldMessageCleanupStatus = markColdMessageCleanupStarted(coldMessageCleanupStatus, attemptAt);
    await persistColdMessageCleanupStatus();
    try {
      const deleted = await storage.pruneOrphanedColdMessages(COLD_MESSAGE_CLEANUP_TTL_DAYS);
      const completedAt = new Date().toISOString();
      coldMessageCleanupStatus = markColdMessageCleanupSucceeded(
        coldMessageCleanupStatus,
        deleted,
        completedAt,
      );
      await persistColdMessageCleanupStatus();
      console.log(
        `[cold-message-cleanup] status=success deleted=${deleted} ` +
        `ttlDays=${COLD_MESSAGE_CLEANUP_TTL_DAYS} attemptedAt=${attemptAt} completedAt=${completedAt}`,
      );
    } catch (e) {
      coldMessageCleanupStatus = markColdMessageCleanupFailed(coldMessageCleanupStatus, e);
      await persistColdMessageCleanupStatus();
      const errorMessage = e instanceof Error ? e.message : String(e);
      console.error(
        `[cold-message-cleanup] status=failure ttlDays=${COLD_MESSAGE_CLEANUP_TTL_DAYS} ` +
        `attemptedAt=${attemptAt} consecutiveFailures=${coldMessageCleanupStatus.consecutiveFailures} ` +
        `error=${errorMessage}`,
        e,
      );
    }
  }
  pruneOrphanedColdMessages();
  // Run once a day (every 24 h)
  setInterval(pruneOrphanedColdMessages, 24 * 60 * 60 * 1000);

  app.get("/api/auth/social-config", (req, res) => {
    res.json({
      googleClientId: process.env.GOOGLE_CLIENT_ID || null,
      appleClientId: process.env.APPLE_CLIENT_ID || null,
      appleRedirectUri: process.env.APPLE_REDIRECT_URI || null,
    });
  });

  app.use("/uploads", express.static(uploadsDir));

  app.get("/api/qrcode-vibra.png", (_req, res) => {
    const qrPath = path.join(process.cwd(), "attached_assets", "vibra_qrcode_official.jpeg");
    res.setHeader("Content-Disposition", "attachment; filename=qrcode-vibra.jpg");
    res.setHeader("Content-Type", "image/jpeg");
    res.sendFile(qrPath);
  });

  app.get("/api/profiles/me", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      let profile = await storage.getProfileByUserId(userId);
      if (profile) {
        const photos = profile.photos as string[] | null;
        const isDefaultAvatar = !profile.imageUrl || profile.imageUrl.startsWith('/images/avatar') || profile.imageUrl.startsWith('/images/profile-');
        if (photos && photos.length > 0 && isDefaultAvatar) {
          await db.update(profiles).set({ imageUrl: photos[0], lastActiveAt: new Date() }).where(eq(profiles.id, profile.id));
          profile = { ...profile, imageUrl: photos[0] };
          console.log(`[/api/profiles/me] Auto-fixed profile photo for "${profile.name}" -> ${photos[0]}`);
        } else {
          db.update(profiles).set({ lastActiveAt: new Date() }).where(eq(profiles.id, profile.id)).execute().catch(() => {});
        }
        console.log(`[/api/profiles/me] userId=${userId} profileId=${profile.id} points=${profile.points}`);
        storage.logActivity(profile.id).catch(() => {});
      } else {
        console.log(`[/api/profiles/me] userId=${userId} NO PROFILE FOUND`);
      }
      res.json(profile || null);
    } catch (error) {
      console.error("Error fetching user profile:", error);
      res.status(500).json({ error: "Failed to fetch profile" });
    }
  });
  
  app.get("/api/profiles", async (req: any, res) => {
    try {
      const profiles = await storage.getProfiles();
      const search = (req.query.search as string)?.toLowerCase().trim();

      // Exclude the currently authenticated user from results
      const currentUserId = req.user?.claims?.sub || req.session?.userId;
      let myProfileId: string | null = null;
      if (currentUserId) {
        try {
          const me = await storage.getProfileByUserId(currentUserId);
          myProfileId = me?.id ?? null;
        } catch {}
      }
      
      if (search) {
        const filtered = profiles.filter(p => 
          p.name.toLowerCase().includes(search) && p.id !== myProfileId
        );
        return res.json(filtered);
      }
      
      res.json(myProfileId ? profiles.filter(p => p.id !== myProfileId) : profiles);
    } catch (error) {
      console.error("Error fetching profiles:", error);
      res.status(500).json({ error: "Failed to fetch profiles" });
    }
  });

  app.get("/api/profiles/swipable", async (req: any, res) => {
    try {
      const profileId = req.query.profileId as string;
      if (!profileId) {
        const allProfiles = await storage.getProfiles();
        return res.json({ profiles: allProfiles, likedIds: [] });
      }
      const myProfile = await storage.getProfile(profileId);
      const allProfiles = await storage.getProfiles();
      // Carica in parallelo per efficienza
      const [likedIds, favoriteIds] = await Promise.all([
        storage.getLikedProfileIds(profileId),
        storage.getFavorites(profileId).then(favs => favs.map(f => f.favoritedProfileId)),
      ]);
      // I profili scartati (dislike) NON vengono mai esclusi dal pool:
      // l'utente vede sempre tutti i profili disponibili.
      // I profili già piaciuti restano visibili con badge "già piaciuto".
      const blockedIds = await storage.getBlockedIds(profileId);
      const blockedSet = new Set(blockedIds);

      const isGenderFlexible = (pref: string | null | undefined) =>
        !pref || pref === "" || pref === "Indifferente" || pref === "Entrambi" || pref === "Tutti";

      const genderMatches = (myGender: string | null | undefined, theirPref: string | null | undefined) => {
        if (isGenderFlexible(theirPref)) return true;
        if (!myGender || myGender === "" || myGender === "Preferisco non rispondere") return true;
        return myGender === theirPref;
      };

      const haversineKm = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLng = (lng2 - lng1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      };

      const now2 = new Date();
      let afterSelf = 0, afterBlocked = 0, afterGender = 0, afterAge = 0, afterDist = 0;
      const swipable = allProfiles.filter(p => {
        if (p.id === profileId) return false;
        afterSelf++;
        // I profili bloccati sono l'unico caso di esclusione permanente
        if (blockedSet.has(p.id)) return false;
        afterBlocked++;
        // VibraGhost: escludi profili in modalità fantasma attiva
        if (p.ghostModeExpiresAt && new Date(p.ghostModeExpiresAt) > now2) return false;

        if (myProfile) {
          if (!isGenderFlexible(myProfile.preferredGender) && p.gender && p.gender !== "" && p.gender !== "Preferisco non rispondere") {
            if (p.gender !== myProfile.preferredGender) return false;
          }
          afterGender++;

          if (myProfile.preferredAgeMin && p.age < myProfile.preferredAgeMin) return false;
          if (myProfile.preferredAgeMax && p.age > myProfile.preferredAgeMax) return false;
          afterAge++;

          if (myProfile.profileLatitude && myProfile.profileLongitude && myProfile.maxDistanceKm) {
            if (p.profileLatitude && p.profileLongitude) {
              const dist = haversineKm(myProfile.profileLatitude, myProfile.profileLongitude, p.profileLatitude, p.profileLongitude);
              if (dist > myProfile.maxDistanceKm) return false;
            }
          }
          afterDist++;
        }

        return true;
      });

      console.log(`[SWIPABLE] user=${myProfile?.name} total=${allProfiles.length} afterSelf=${afterSelf} afterBlocked=${afterBlocked} afterGender=${afterGender} afterAge=${afterAge} afterDist=${afterDist} final=${swipable.length} | prefs: gender=${myProfile?.preferredGender} ageMin=${myProfile?.preferredAgeMin} ageMax=${myProfile?.preferredAgeMax} maxDist=${myProfile?.maxDistanceKm}`);

      const now = new Date();
      const favSet = new Set(favoriteIds);
      const isFav = (p: any) => favSet.has(p.id);
      const isHL = (p: any) => p.highlightedUntil && new Date(p.highlightedUntil) > now;

      const favorites = swipable.filter(p => isFav(p));
      const highlighted = swipable.filter(p => !isFav(p) && isHL(p));
      const rest = swipable.filter(p => !isFav(p) && !isHL(p));

      // Interleave bots and real users deterministically (stable order)
      const bots = rest.filter(p => p.isBot);
      const nonBots = rest.filter(p => !p.isBot);
      const interleaved: any[] = [];
      const maxLen = Math.max(bots.length, nonBots.length);
      for (let i = 0; i < maxLen; i++) {
        if (i < nonBots.length) interleaved.push(nonBots[i]);
        if (i < bots.length) interleaved.push(bots[i]);
      }

      // Shuffle casuale ad ogni apertura — ordine diverso ogni volta
      for (let i = interleaved.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [interleaved[i], interleaved[j]] = [interleaved[j], interleaved[i]];
      }

      swipable.length = 0;
      swipable.push(...favorites, ...highlighted, ...interleaved);

      const profilesWithDistance = swipable.map(p => {
        let base: any = { ...p };

        // Per i bot: simula presenza online casuale (50% online, 50% offline con tempo variabile)
        if (p.isBot) {
          const now = Date.now();
          if (Math.random() < 0.5) {
            // Online: connesso 1–4 minuti fa
            base.lastActiveAt = new Date(now - (60_000 + Math.random() * 180_000));
          } else {
            // Offline: visto 2–72 ore fa (aspetto realistico)
            const hoursAgo = 2 + Math.random() * 70;
            base.lastActiveAt = new Date(now - hoursAgo * 3_600_000);
          }
        }

        if (myProfile?.profileLatitude && myProfile?.profileLongitude && p.profileLatitude && p.profileLongitude) {
          const dist = haversineKm(myProfile.profileLatitude, myProfile.profileLongitude, p.profileLatitude, p.profileLongitude);
          base.distanceKm = Math.round(dist);
        }
        return base;
      });

      res.json({ profiles: profilesWithDistance, likedIds });
    } catch (error) {
      console.error("Error fetching swipable profiles:", error);
      res.status(500).json({ error: "Failed to fetch profiles" });
    }
  });

  // ── Vibe Feed (TikTok-style vertical video feed) ──────────────────────────
  app.get("/api/feed/videos", async (req: any, res) => {
    try {
      const page = Math.max(0, parseInt((req.query.page as string) || "0"));
      const limit = Math.min(Math.max(1, parseInt((req.query.limit as string) || "15")), 30);

      const allProfiles = await storage.getProfiles();
      const withVideos = allProfiles.filter(p => p.profileVideoUrl);

      // Deterministic day-seeded shuffle (same order for all users within a day)
      const daySeed = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
      const shuffled = [...withVideos];
      let seed = daySeed;
      for (let i = shuffled.length - 1; i > 0; i--) {
        seed = (seed * 16807 + 1) % 2147483647;
        const j = seed % (i + 1);
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }

      const start = page * limit;
      const slice = shuffled.slice(start, start + limit);
      const profiles = slice.map(p => ({
        id: p.id,
        name: p.name,
        age: p.age,
        location: p.location,
        bio: p.bio,
        imageUrl: p.imageUrl,
        profileVideoUrl: p.profileVideoUrl,
        isVerified: p.isVerified,
        isBot: p.isBot,
        gender: p.gender,
        interests: p.interests,
      }));

      res.json({
        profiles,
        hasMore: start + limit < shuffled.length,
        total: shuffled.length,
        page,
      });
    } catch (error) {
      console.error("[feed/videos] error:", error);
      res.status(500).json({ error: "Errore nel caricamento del feed" });
    }
  });

  app.get("/api/favorites", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      const myProfile = await storage.getProfileByUserId(userId);
      if (!myProfile) return res.status(400).json({ error: "Profilo non trovato" });
      const favorites = await storage.getFavorites(myProfile.id);
      res.json(favorites);
    } catch (error) {
      console.error("[favorites] list error:", error);
      res.status(500).json({ error: "Errore nel recupero preferiti" });
    }
  });

  app.get("/api/guest/rooms", async (_req, res) => {
    try {
      const allRooms = await storage.getRooms();
      const currentHour = new Date().getUTCHours();
      const roomsWithCounts = await Promise.all(allRooms.map(async (room) => {
        const members = await db.select().from(roomMembers).where(eq(roomMembers.roomId, room.id));
        const roomIdNum = typeof room.id === "string" ? parseInt(room.id, 10) || room.id.charCodeAt(0) : Number(room.id);
        const seed = (roomIdNum * 2654435761 + currentHour * 31) >>> 0;
        const baseCount = (seed % 4) + 1;
        return { ...room, memberCount: members.length + baseCount };
      }));
      res.json(roomsWithCounts);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch rooms" });
    }
  });

  app.get("/api/guest/challenges", async (_req, res) => {
    try {
      const challenges = await storage.getChallenges();
      res.json(challenges);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch challenges" });
    }
  });

  app.get("/api/guest/private-rooms", async (_req, res) => {
    try {
      const rooms = await storage.getPrivateRooms();
      res.json(rooms);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch private rooms" });
    }
  });

  app.get("/api/guest/gifts", async (_req, res) => {
    try {
      const gifts = await storage.getVirtualGifts();
      res.json(gifts);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch gifts" });
    }
  });

  app.delete("/api/swipes/disliked", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Not authenticated" });
      const userProfile = await storage.getProfileByUserId(userId);
      if (!userProfile) return res.status(404).json({ error: "Profile not found" });

      const count = await storage.resetAllSwipes(userProfile.id);
      res.json({ reset: count });
    } catch (error) {
      console.error("Error resetting disliked swipes:", error);
      res.status(500).json({ error: "Failed to reset swipes" });
    }
  });

  app.delete("/api/swipes/last", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Non autenticato" });
      const userProfile = await storage.getProfileByUserId(userId);
      if (!userProfile) return res.status(404).json({ error: "Profilo non trovato" });

      const [lastSwipe] = await db
        .select()
        .from(swipes)
        .where(eq(swipes.swiperId, userProfile.id))
        .orderBy(desc(swipes.createdAt))
        .limit(1);

      if (!lastSwipe) return res.status(404).json({ error: "Nessuno swipe da annullare" });

      await db.delete(swipes).where(eq(swipes.id, lastSwipe.id));

      // Remove any match generated by this swipe
      if (lastSwipe.liked) {
        await db.delete(matches).where(
          or(
            and(eq(matches.profile1Id, userProfile.id), eq(matches.profile2Id, lastSwipe.swipedId)),
            and(eq(matches.profile1Id, lastSwipe.swipedId), eq(matches.profile2Id, userProfile.id))
          )
        );
      }

      res.json({ undoneProfileId: lastSwipe.swipedId, direction: lastSwipe.liked ? "right" : "left" });
    } catch (error) {
      console.error("[undo-swipe]", error);
      res.status(500).json({ error: "Errore annullamento swipe" });
    }
  });

  app.get("/api/profiles/:id", async (req, res) => {
    try {
      const profile = await storage.getProfile(req.params.id);
      if (!profile || profile.moderationHidden) {
        return res.status(404).json({ error: "Profile not found" });
      }
      res.json(profile);
    } catch (error) {
      console.error("Error fetching profile:", error);
      res.status(500).json({ error: "Failed to fetch profile" });
    }
  });

  app.get("/api/profiles/:id/compatibility", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) return res.status(401).json({ error: "Not authenticated" });
      
      const myProfile = await storage.getProfileByUserId(userId);
      if (!myProfile) return res.status(404).json({ error: "Your profile not found" });
      
      const otherProfile = await storage.getProfile(req.params.id);
      if (!otherProfile || otherProfile.moderationHidden) return res.status(404).json({ error: "Profile not found" });
      
      // Calculate compatibility score (0-100)
      let score = 50; // Base score
      
      // Age compatibility (±5 years = full points)
      const ageDiff = Math.abs(myProfile.age - otherProfile.age);
      if (ageDiff <= 5) score += 15;
      else if (ageDiff <= 10) score += 10;
      else if (ageDiff <= 15) score += 5;
      
      // Interests overlap (each matching interest +5)
      const myInterests = myProfile.interests || [];
      const otherInterests = otherProfile.interests || [];
      const commonInterests = myInterests.filter(i => otherInterests.includes(i));
      score += Math.min(commonInterests.length * 5, 15);
      
      // Alien type match (+10)
      if (myProfile.alienType === otherProfile.alienType) score += 10;
      
      // Zodiac sign match (+8)
      if (myProfile.zodiacSign && otherProfile.zodiacSign && myProfile.zodiacSign === otherProfile.zodiacSign) score += 8;
      
      // Same location (+5)
      if (myProfile.location && otherProfile.location && myProfile.location.toLowerCase() === otherProfile.location.toLowerCase()) score += 5;
      
      // Gender preference match
      if (myProfile.preferredGender && otherProfile.gender) {
        if (myProfile.preferredGender.toLowerCase() === otherProfile.gender.toLowerCase()) score += 7;
      }
      if (otherProfile.preferredGender && myProfile.gender) {
        if (otherProfile.preferredGender.toLowerCase() === myProfile.gender.toLowerCase()) score += 7;
      }
      
      // Love language match (+5)
      if (myProfile.loveLanguage && otherProfile.loveLanguage && myProfile.loveLanguage === otherProfile.loveLanguage) score += 5;
      
      // Communication style match (+3)
      if (myProfile.communicationStyle && otherProfile.communicationStyle && myProfile.communicationStyle === otherProfile.communicationStyle) score += 3;
      
      // Relationship type match (+5)
      if (myProfile.relationshipType && otherProfile.relationshipType && myProfile.relationshipType === otherProfile.relationshipType) score += 5;
      
      // Cap at 100
      score = Math.min(100, score);
      
      res.json({ 
        score,
        commonInterests: commonInterests.length,
        totalInterests: Math.max(myInterests.length, otherInterests.length)
      });
    } catch (error) {
      console.error("Error calculating compatibility:", error);
      res.status(500).json({ error: "Failed to calculate compatibility" });
    }
  });

  app.get("/api/my-profile/:userId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (userId !== req.params.userId) {
        return res.status(403).json({ error: "Not authorized to view this profile" });
      }
      const profile = await storage.getProfileByUserId(req.params.userId);
      res.json(profile || null);
    } catch (error) {
      console.error("Error fetching user profile:", error);
      res.status(500).json({ error: "Failed to fetch profile" });
    }
  });

  app.post("/api/profiles", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Not authenticated" });

      const validatedData = insertProfileSchema.parse(req.body);

      if (validatedData.phoneNumber && validatedData.phonePrefix) {
        const fullPhone = `${validatedData.phonePrefix}${validatedData.phoneNumber}`;
        const [duplicate] = await db.select().from(profiles).where(
          and(
            eq(profiles.phonePrefix, validatedData.phonePrefix),
            eq(profiles.phoneNumber, validatedData.phoneNumber)
          )
        );
        const existingProfile = await storage.getProfileByUserId(userId);
        if (duplicate && (!existingProfile || duplicate.id !== existingProfile.id)) {
          return res.status(409).json({ error: "Questo numero di telefono è già associato a un altro account" });
        }
      }

      const existingProfile = await storage.getProfileByUserId(userId);
      if (existingProfile) {
        const updated = await storage.updateProfile(existingProfile.id, {
          ...validatedData,
          userId,
          isBot: false,
        });
        return res.json(updated);
      }
      let refCode = "";
      for (let i = 0; i < 10; i++) {
        const candidate = "VBR-" + Math.random().toString(36).substring(2, 8).toUpperCase();
        const [existing] = await db.select().from(profiles).where(eq(profiles.referralCode, candidate));
        if (!existing) { refCode = candidate; break; }
      }
      if (!refCode) refCode = "VBR-" + Date.now().toString(36).toUpperCase();
      const profile = await storage.createProfile({
        ...validatedData,
        userId,
        isBot: false,
        points: 0,
        referralCode: refCode,
      });
      res.status(201).json(profile);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid profile data", details: error.errors });
      }
      console.error("Error creating profile:", error);
      res.status(500).json({ error: "Failed to create profile" });
    }
  });

  app.delete("/api/profiles/me", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Not authenticated" });
      const userProfile = await storage.getProfileByUserId(userId);
      if (!userProfile) return res.status(404).json({ error: "No profile found" });

      const profileId = userProfile.id;
      await db.delete(sentGifts).where(or(eq(sentGifts.senderId, profileId), eq(sentGifts.receiverId, profileId)));
      await db.delete(challengeSubmissions).where(eq(challengeSubmissions.profileId, profileId));
      await db.delete(roomMembers).where(eq(roomMembers.profileId, profileId));
      await db.delete(roomMessages).where(eq(roomMessages.senderId, profileId));
      await db.delete(privateRoomMessages).where(eq(privateRoomMessages.senderId, profileId));
      const ownedRooms = await db.select().from(privateRooms).where(eq(privateRooms.ownerId, profileId));
      for (const room of ownedRooms) {
        await db.delete(privateRoomMessages).where(eq(privateRoomMessages.roomId, room.id));
        await db.delete(privateRoomRequests).where(eq(privateRoomRequests.roomId, room.id));
        await db.delete(roomMembers).where(eq(roomMembers.roomId, room.id));
      }
      await db.delete(privateRooms).where(eq(privateRooms.ownerId, profileId));
      await db.delete(privateRoomRequests).where(eq(privateRoomRequests.requesterId, profileId));
      await db.delete(profileRatings).where(or(eq(profileRatings.raterId, profileId), eq(profileRatings.ratedId, profileId)));
      await db.delete(blockedUsers).where(or(eq(blockedUsers.blockerId, profileId), eq(blockedUsers.blockedId, profileId)));
      // Keep reports where this profile WAS reported so the reportedUserId anchor
      // survives — getColdMessagesReceived uses it to filter messages from
      // re-created accounts (same userId, new profile UUID). Only remove reports
      // this profile filed as the reporter.
      await db.delete(reports).where(eq(reports.reporterId, profileId));
      await db.delete(vibingSessions).where(eq(vibingSessions.profileId, profileId));
      await db.delete(locationShares).where(eq(locationShares.profileId, profileId));
      const userMatches = await db.select().from(matches).where(or(eq(matches.profile1Id, profileId), eq(matches.profile2Id, profileId)));
      for (const m of userMatches) {
        await db.delete(messages).where(eq(messages.matchId, m.id));
      }
      await db.delete(matches).where(or(eq(matches.profile1Id, profileId), eq(matches.profile2Id, profileId)));
      await db.delete(swipes).where(or(eq(swipes.swiperId, profileId), eq(swipes.swipedId, profileId)));
      await db.delete(profiles).where(eq(profiles.id, profileId));

      const deleteAccount = req.query.deleteAccount === "true";
      if (deleteAccount) {
        await db.delete(users).where(eq(users.id, userId));
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting own profile:", error);
      res.status(500).json({ error: "Failed to delete profile" });
    }
  });

  app.put("/api/profiles/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const existing = await storage.getProfile(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Profile not found" });
      }

      const requestingUser = await storage.getUser(userId);
      const isAdminUser = requestingUser?.isAdmin || (requestingUser?.email && ["famax61@yahoo.com", "famax61@gmail.com"].includes(requestingUser.email.toLowerCase()));
      if (existing.userId !== userId && !isAdminUser) {
        return res.status(403).json({ error: "Non autorizzato" });
      }
      
      const validatedData = updateProfileSchema.parse(req.body);

      if (validatedData.phoneNumber && validatedData.phonePrefix) {
        const [duplicate] = await db.select().from(profiles).where(
          and(
            eq(profiles.phonePrefix, validatedData.phonePrefix),
            eq(profiles.phoneNumber, validatedData.phoneNumber),
            ne(profiles.id, req.params.id)
          )
        );
        if (duplicate) {
          return res.status(409).json({ error: "Questo numero di telefono è già associato a un altro account" });
        }
      }

      console.log(`[PROFILE UPDATE] id=${req.params.id} saving: gender=${validatedData.preferredGender} ageMin=${validatedData.preferredAgeMin} ageMax=${validatedData.preferredAgeMax} heightMin=${validatedData.preferredHeightMin} heightMax=${validatedData.preferredHeightMax} maxDist=${validatedData.maxDistanceKm}`);
      const profile = await storage.updateProfile(req.params.id, validatedData);
      res.json(profile);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("[PROFILE UPDATE] Validation failed:", error.errors);
        return res.status(400).json({ error: "Invalid profile data", details: error.errors });
      }
      console.error("Error updating profile:", error);
      res.status(500).json({ error: "Failed to update profile" });
    }
  });

  app.post("/api/profiles/upload-photo", isAuthenticated, (req: any, res: any, next: any) => {
    memoryUpload.single("photo")(req, res, (err: any) => {
      if (err) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(400).json({ error: "File troppo grande. Massimo 5 MB." });
        }
        return res.status(400).json({ error: err.message || "Errore nel caricamento del file" });
      }
      next();
    });
  }, async (req: any, res: any) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Not authenticated" });

      const targetProfileId = req.query.targetProfileId as string | undefined;
      let userProfile;

      if (targetProfileId) {
        const requestingUser = await storage.getUser(userId);
        const isAdminUser = requestingUser?.isAdmin || (requestingUser?.email && ["famax61@yahoo.com", "famax61@gmail.com"].includes(requestingUser.email.toLowerCase()));
        if (!isAdminUser) return res.status(403).json({ error: "Non autorizzato" });
        userProfile = await storage.getProfile(targetProfileId);
        if (!userProfile) return res.status(404).json({ error: "Profile not found" });
      } else {
        userProfile = await storage.getProfileByUserId(userId);
        if (!userProfile) {
          const user = await storage.getUser(userId);
          const tempName = user?.firstName || "Nuovo Utente";
          userProfile = await storage.createProfile({
            userId,
            name: tempName,
            age: 25,
            bio: "",
            imageUrl: "/images/profile-1.png",
            location: "",
            interests: [],
            alienType: "Andromediano",
            isBot: false,
            points: 0,
          });
        }
      }

      if (!req.file) return res.status(400).json({ error: "No photo uploaded" });

      const currentPhotos = userProfile.photos || [];
      if (currentPhotos.length >= 6) {
        return res.status(400).json({ error: "Massimo 6 foto consentite" });
      }

      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);

      const putResponse = await fetch(uploadURL, {
        method: "PUT",
        body: req.file.buffer,
        headers: { "Content-Type": req.file.mimetype },
      });

      if (!putResponse.ok) {
        console.error("Object storage PUT failed:", putResponse.status, await putResponse.text().catch(() => ""));
        return res.status(500).json({ error: "Errore nel salvataggio della foto. Riprova." });
      }

      await objectStorageService.trySetObjectEntityAclPolicy(objectPath, {
        owner: userProfile.userId ?? userId,
        visibility: "public",
      });

      const updatedPhotos = [...currentPhotos, objectPath];
      const updateData: any = { photos: updatedPhotos };
      const isDefaultAvatar = !userProfile.imageUrl || userProfile.imageUrl.startsWith('/images/avatar') || userProfile.imageUrl.startsWith('/images/profile-');
      if (currentPhotos.length === 0 || isDefaultAvatar) {
        updateData.imageUrl = objectPath;
      }
      await storage.updateProfile(userProfile.id, updateData);

      res.json({ url: objectPath, photos: updatedPhotos });
    } catch (error: any) {
      console.error("Error uploading profile photo:", error?.message || error);
      res.status(500).json({ error: "Errore nel caricamento della foto. Riprova." });
    }
  });

  app.post("/api/profiles/upload-video", isAuthenticated, (req: any, res: any, next: any) => {
    videoUpload.single("video")(req, res, (err: any) => {
      if (err) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(400).json({ error: "Video troppo grande. Massimo 250 MB." });
        }
        return res.status(400).json({ error: err.message || "Errore nel caricamento del video" });
      }
      next();
    });
  }, async (req: any, res: any) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Not authenticated" });

      const targetProfileId = req.query.targetProfileId as string | undefined;
      let userProfile;

      if (targetProfileId) {
        const requestingUser = await storage.getUser(userId);
        const isAdminUser = requestingUser?.isAdmin || (requestingUser?.email && ["famax61@yahoo.com", "famax61@gmail.com"].includes(requestingUser.email.toLowerCase()));
        if (!isAdminUser) return res.status(403).json({ error: "Non autorizzato" });
        userProfile = await storage.getProfile(targetProfileId);
        if (!userProfile) return res.status(404).json({ error: "Profile not found" });
      } else {
        userProfile = await storage.getProfileByUserId(userId);
        if (!userProfile) return res.status(404).json({ error: "Profile not found" });
      }

      if (!req.file) return res.status(400).json({ error: "No video uploaded" });

      // ── Taglia il video a max 60s con ffmpeg e aggiunge faststart ──
      const tmpId = randomUUID();
      const tmpIn = `/tmp/vibra_in_${tmpId}.mp4`;
      const tmpOut = `/tmp/vibra_out_${tmpId}.mp4`;
      let videoBuffer: Buffer;
      try {
        fs.writeFileSync(tmpIn, req.file.buffer);
        await execFileAsync("ffmpeg", [
          "-y", "-i", tmpIn,
          "-t", "60",
          "-c:v", "libx264", "-preset", "ultrafast", "-crf", "26",
          "-c:a", "aac",
          "-movflags", "+faststart",
          tmpOut,
        ]);
        videoBuffer = fs.readFileSync(tmpOut);
      } catch (ffErr: any) {
        console.error("[ffmpeg trim] error:", ffErr?.message || ffErr);
        // fallback: usa il file originale senza taglio
        videoBuffer = req.file.buffer;
      } finally {
        try { fs.unlinkSync(tmpIn); } catch {}
        try { fs.unlinkSync(tmpOut); } catch {}
      }

      if (userProfile.profileVideoUrl) {
        try { await objectStorageService.deleteObject(userProfile.profileVideoUrl); } catch {}
      }

      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);

      const putResponse = await fetch(uploadURL, {
        method: "PUT",
        body: videoBuffer,
        headers: { "Content-Type": "video/mp4" },
      });

      if (!putResponse.ok) {
        console.error("Video storage PUT failed:", putResponse.status, await putResponse.text().catch(() => ""));
        return res.status(500).json({ error: "Errore nel salvataggio del video. Riprova." });
      }

      await objectStorageService.trySetObjectEntityAclPolicy(objectPath, {
        owner: userProfile.userId ?? userId,
        visibility: "public",
      });

      await storage.updateProfile(userProfile.id, { profileVideoUrl: objectPath });
      res.json({ profileVideoUrl: objectPath });
    } catch (error: any) {
      console.error("Error uploading profile video:", error?.message || error);
      res.status(500).json({ error: "Errore nel caricamento del video. Riprova." });
    }
  });

  app.post("/api/profiles/set-main-video", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Not authenticated" });
      const { videoUrl, targetProfileId } = req.body;
      let userProfile;
      if (targetProfileId) {
        const requestingUser = await storage.getUser(userId);
        const isAdminUser = requestingUser?.isAdmin || (requestingUser?.email && ["famax61@yahoo.com", "famax61@gmail.com"].includes(requestingUser.email.toLowerCase()));
        if (!isAdminUser) return res.status(403).json({ error: "Non autorizzato" });
        userProfile = await storage.getProfile(targetProfileId);
        if (!userProfile) return res.status(404).json({ error: "Profile not found" });
      } else {
        userProfile = await storage.getProfileByUserId(userId);
        if (!userProfile) return res.status(404).json({ error: "Profile not found" });
      }
      if (!videoUrl) return res.status(400).json({ error: "videoUrl required" });
      await storage.updateProfile(userProfile.id, { profileVideoUrl: videoUrl });
      res.json({ success: true, profileVideoUrl: videoUrl });
    } catch (error: any) {
      console.error("Error setting main video:", error?.message || error);
      res.status(500).json({ error: "Errore nel salvataggio." });
    }
  });

  app.delete("/api/profiles/delete-video", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Not authenticated" });

      const { targetProfileId } = req.body || {};
      let userProfile;
      if (targetProfileId) {
        const requestingUser = await storage.getUser(userId);
        const isAdminUser = requestingUser?.isAdmin || (requestingUser?.email && ["famax61@yahoo.com", "famax61@gmail.com"].includes(requestingUser.email.toLowerCase()));
        if (!isAdminUser) return res.status(403).json({ error: "Non autorizzato" });
        userProfile = await storage.getProfile(targetProfileId);
        if (!userProfile) return res.status(404).json({ error: "Profile not found" });
      } else {
        userProfile = await storage.getProfileByUserId(userId);
        if (!userProfile) return res.status(404).json({ error: "Profile not found" });
      }

      if (userProfile.profileVideoUrl) {
        try { await objectStorageService.deleteObject(userProfile.profileVideoUrl); } catch {}
      }

      await storage.updateProfile(userProfile.id, { profileVideoUrl: null });
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting profile video:", error?.message || error);
      res.status(500).json({ error: "Errore nell'eliminazione del video." });
    }
  });

  app.delete("/api/profiles/photo", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Not authenticated" });

      const { photoUrl, targetProfileId } = req.body;
      let userProfile;
      if (targetProfileId) {
        const requestingUser = await storage.getUser(userId);
        const isAdminUser = requestingUser?.isAdmin || (requestingUser?.email && ["famax61@yahoo.com", "famax61@gmail.com"].includes(requestingUser.email.toLowerCase()));
        if (!isAdminUser) return res.status(403).json({ error: "Non autorizzato" });
        userProfile = await storage.getProfile(targetProfileId);
        if (!userProfile) return res.status(403).json({ error: "Profile not found" });
      } else {
        userProfile = await storage.getProfileByUserId(userId);
        if (!userProfile) return res.status(403).json({ error: "Profile not found" });
      }

      const currentPhotos = userProfile.photos || [];
      const updatedPhotos = currentPhotos.filter((p: string) => p !== photoUrl);
      const updateData: any = { photos: updatedPhotos };
      if (userProfile.imageUrl === photoUrl) {
        updateData.imageUrl = updatedPhotos.length > 0 ? updatedPhotos[0] : '/images/profile-1.png';
      }
      await storage.updateProfile(userProfile.id, updateData);

      res.json({ photos: updatedPhotos });
    } catch (error) {
      console.error("Error removing profile photo:", error);
      res.status(500).json({ error: "Failed to remove photo" });
    }
  });

  app.post("/api/profiles/set-profile-photo", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Not authenticated" });

      const { photoUrl, targetProfileId } = req.body;
      let userProfile;
      if (targetProfileId) {
        const requestingUser = await storage.getUser(userId);
        const isAdminUser = requestingUser?.isAdmin || (requestingUser?.email && ["famax61@yahoo.com", "famax61@gmail.com"].includes(requestingUser.email.toLowerCase()));
        if (!isAdminUser) return res.status(403).json({ error: "Non autorizzato" });
        userProfile = await storage.getProfile(targetProfileId);
        if (!userProfile) return res.status(403).json({ error: "Profile not found" });
      } else {
        userProfile = await storage.getProfileByUserId(userId);
        if (!userProfile) return res.status(403).json({ error: "Profile not found" });
      }

      if (!photoUrl) return res.status(400).json({ error: "Missing photoUrl" });

      const currentPhotos = userProfile.photos || [];
      if (!currentPhotos.includes(photoUrl)) {
        return res.status(400).json({ error: "Photo not found in your gallery" });
      }

      await storage.updateProfile(userProfile.id, { imageUrl: photoUrl });
      res.json({ imageUrl: photoUrl });
    } catch (error) {
      console.error("Error setting profile photo:", error);
      res.status(500).json({ error: "Failed to set profile photo" });
    }
  });

  app.post("/api/swipe", async (req, res) => {
    try {
      const validatedData = insertSwipeSchema.parse(req.body);
      
      console.log(`[SWIPE] ${validatedData.swiperId} -> ${validatedData.swipedId}, liked: ${validatedData.liked}`);
      db.update(profiles).set({ lastActiveAt: new Date() }).where(eq(profiles.id, validatedData.swiperId)).execute().catch(() => {});
      
      const existingSwipe = await storage.getSwipe(validatedData.swiperId, validatedData.swipedId);
      if (existingSwipe) {
        console.log(`[SWIPE] Already swiped, skipping`);
        return res.status(400).json({ error: "Already swiped on this profile" });
      }
      
      const swipe = await storage.createSwipe(validatedData);
      // VibraDNA: traccia evento swipe (fire-and-forget)
      storage.trackDnaEvent(validatedData.swiperId, 'swipe', validatedData.liked ? 1 : 0).catch(() => {});
      if (validatedData.liked) storage.trackQuestProgress(validatedData.swiperId, 'swipe_10').catch(() => {});
      
      let match = false;
      let matchData = null;
      
      if (validatedData.liked) {
        const swipedProfile = await storage.getProfile(validatedData.swipedId);
        
        if (!swipedProfile) {
          return res.status(404).json({ error: "Profile not found" });
        }
        
        if (swipedProfile.isBot) {
          // Bot auto-likes back so mutual-like is recorded
          const existingBotSwipe = await storage.getSwipe(validatedData.swipedId, validatedData.swiperId);
          if (!existingBotSwipe) {
            await storage.createSwipe({
              swiperId: validatedData.swipedId,
              swipedId: validatedData.swiperId,
              liked: true,
            });
          }

          // Random bot match: max 1 bot match per real user per day, ~25% probability
          const existingMatch = await storage.getMatch(validatedData.swiperId, validatedData.swipedId);
          if (!existingMatch) {
            const todayStr = new Date().toISOString().slice(0, 10);
            const usedTodayRows = await db.execute(
              sql`SELECT 1 FROM bot_daily_match WHERE real_profile_id = ${validatedData.swiperId} AND match_date = ${todayStr} LIMIT 1`
            );
            const alreadyUsed = (usedTodayRows.rows?.length ?? 0) > 0;
            const lucky = Math.random() < 0.20; // 20% chance (~1 in 5)

            if (!alreadyUsed && lucky) {
              matchData = await storage.createMatch({
                profile1Id: validatedData.swiperId,
                profile2Id: validatedData.swipedId,
              });
              match = true;
              await db.execute(
                sql`INSERT INTO bot_daily_match (real_profile_id, bot_profile_id, match_date)
                    VALUES (${validatedData.swiperId}, ${validatedData.swipedId}, ${todayStr})
                    ON CONFLICT (real_profile_id, match_date) DO NOTHING`
              );
              console.log(`[SWIPE] BOT MATCH (random) ${validatedData.swiperId} <-> ${validatedData.swipedId}`);

              // ── Bot invia il primo messaggio dopo il match (30–90 secondi) ─
              const botMatchId = matchData.id;
              const botProfileForOpener = swipedProfile;
              const openerDelayMs = 30_000 + Math.random() * 60_000;
              setTimeout(async () => {
                try {
                  const realUserProfile = await storage.getProfile(validatedData.swiperId);
                  if (!realUserProfile) return;
                  const opener = await generateBotOpener(botProfileForOpener, realUserProfile);
                  await storage.createMessage({
                    matchId: botMatchId,
                    senderId: botProfileForOpener.id,
                    content: opener,
                  });
                  sendPushToProfile(validatedData.swiperId, {
                    title: `💫 ${botProfileForOpener.name} ti ha scritto!`,
                    body: opener.substring(0, 100),
                    icon: "/icons/icon-192.png",
                    url: `/chat/${botMatchId}`,
                  });
                  console.log(`[BOT] Opener inviato da ${botProfileForOpener.name} → match ${botMatchId}`);
                } catch (err) {
                  console.error("[BOT] Opener error:", err);
                }
              }, openerDelayMs);
            } else {
              console.log(`[SWIPE] Bot like recorded, no match today (used=${alreadyUsed}, lucky=${lucky})`);
            }
          }
        } else {
          const isMutualLike = await storage.checkMutualLike(validatedData.swiperId, validatedData.swipedId);
          console.log(`[SWIPE] Mutual like check: ${isMutualLike}`);
          
          if (isMutualLike) {
            const existingMatch = await storage.getMatch(validatedData.swiperId, validatedData.swipedId);
            console.log(`[SWIPE] Existing match: ${!!existingMatch}`);
            
            if (!existingMatch) {
              matchData = await storage.createMatch({
                profile1Id: validatedData.swiperId,
                profile2Id: validatedData.swipedId,
              });
              match = true;
              console.log(`[SWIPE] MATCH CREATED! ${validatedData.swiperId} <-> ${validatedData.swipedId}`);
            }
          }
        }
      }
      
      res.json({ swipe, match, matchData });
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("[SWIPE] Validation error:", error.errors);
        return res.status(400).json({ error: "Invalid swipe data", details: error.errors });
      }
      console.error("[SWIPE] Error:", error);
      res.status(500).json({ error: "Failed to create swipe" });
    }
  });

  app.get("/api/matches/:userId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const userProfile = await storage.getProfileByUserId(userId);
      
      if (!userProfile || userProfile.id !== req.params.userId) {
        return res.status(403).json({ error: "Not authorized to view these matches" });
      }
      
      const matches = await storage.getMatchesForUser(req.params.userId);
      const blockedIds = await storage.getBlockedIds(userProfile.id);
      const blockedSet = new Set(blockedIds);
      const filteredMatches = matches.filter(m => {
        const otherId = m.profile1Id === userProfile.id ? m.profile2Id : m.profile1Id;
        return !blockedSet.has(otherId);
      });
      res.json(filteredMatches);
    } catch (error) {
      console.error("Error fetching matches:", error);
      res.status(500).json({ error: "Failed to fetch matches" });
    }
  });

  app.get("/api/likes/received", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const userProfile = await storage.getProfileByUserId(userId);
      if (!userProfile) return res.status(404).json({ error: "Profile not found" });
      const likers = await storage.getReceivedLikes(userProfile.id);
      const blockedIds = await storage.getBlockedIds(userProfile.id);
      const blockedSet = new Set(blockedIds);
      const filtered = likers.filter(p => !blockedSet.has(p.id));
      res.json(filtered);
    } catch (error) {
      console.error("Error fetching received likes:", error);
      res.status(500).json({ error: "Failed to fetch received likes" });
    }
  });

  app.delete("/api/matches/:matchId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const userProfile = await storage.getProfileByUserId(userId);
      if (!userProfile) {
        return res.status(403).json({ error: "Profile not found" });
      }
      const matchId = req.params.matchId;
      const [match] = await db.select().from(matches).where(eq(matches.id, matchId));
      if (!match) {
        return res.status(404).json({ error: "Match not found" });
      }
      if (match.profile1Id !== userProfile.id && match.profile2Id !== userProfile.id) {
        return res.status(403).json({ error: "Not authorized to delete this match" });
      }
      await db.delete(messages).where(eq(messages.matchId, matchId));
      await db.delete(matches).where(eq(matches.id, matchId));
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting match:", error);
      res.status(500).json({ error: "Failed to delete match" });
    }
  });

  app.get("/api/messages/:matchId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const match = await storage.getMatchById(req.params.matchId);
      if (!match) {
        return res.status(404).json({ error: "Match not found" });
      }
      
      const userProfile = await storage.getProfileByUserId(userId);
      if (!userProfile) {
        return res.status(403).json({ error: "Profile not found" });
      }
      
      if (match.profile1Id !== userProfile.id && match.profile2Id !== userProfile.id) {
        return res.status(403).json({ error: "Not authorized to view these messages" });
      }
      
      const messages = await storage.getMessagesForMatch(req.params.matchId);
      
      await storage.markMessagesAsRead(req.params.matchId, userProfile.id);
      
      res.json(messages);
    } catch (error) {
      console.error("Error fetching messages:", error);
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  const isAdmin = createAdminAuthorizationMiddleware();

  app.get("/api/admin/report-cleanup/status", isAuthenticated, isAdmin, async (_req: any, res) => {
    try {
      const orphanedReportsOlderThanTtl = await storage.countOrphanedReports(REPORT_CLEANUP_TTL_DAYS);
      res.json(buildReportCleanupStatusResponse(reportCleanupStatus, orphanedReportsOlderThanTtl));
    } catch (error) {
      console.error("[report-cleanup] status-check-failure:", error);
      res.status(503).json(buildReportCleanupStatusFailure(reportCleanupStatus));
    }
  });

  app.get("/api/admin/cold-message-cleanup/status", isAuthenticated, isAdmin, async (_req: any, res) => {
    try {
      const orphanedColdMessagesOlderThanTtl = await storage.countOrphanedColdMessages(
        COLD_MESSAGE_CLEANUP_TTL_DAYS,
      );
      res.json(
        buildColdMessageCleanupStatusResponse(
          coldMessageCleanupStatus,
          orphanedColdMessagesOlderThanTtl,
          Date.now(),
        ),
      );
    } catch (error) {
      console.error("[cold-message-cleanup] status-check-failure:", error);
      res.status(503).json(
        buildColdMessageCleanupStatusFailure(
          coldMessageCleanupStatus,
          Date.now(),
        ),
      );
    }
  });

  app.get("/api/referral/my-code", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const profile = await storage.getProfileByUserId(userId);
      if (!profile) return res.status(404).json({ error: "Profile not found" });
      if (!profile.referralCode) {
        let code = "";
        for (let i = 0; i < 10; i++) {
          const candidate = "VBR-" + Math.random().toString(36).substring(2, 8).toUpperCase();
          const [existing] = await db.select().from(profiles).where(eq(profiles.referralCode, candidate));
          if (!existing) { code = candidate; break; }
        }
        if (!code) code = "VBR-" + Date.now().toString(36).toUpperCase();
        await db.update(profiles).set({ referralCode: code }).where(eq(profiles.id, profile.id));
        return res.json({ code, referrals: 0, paidReferrals: 0 });
      }
      const myReferrals = await db.select().from(referrals).where(eq(referrals.referrerProfileId, profile.id));
      const paidCount = myReferrals.filter(r => r.hasPaid).length;
      res.json({ code: profile.referralCode, referrals: myReferrals.length, paidReferrals: paidCount });
    } catch (error) {
      console.error("Error fetching referral code:", error);
      res.status(500).json({ error: "Failed to fetch referral code" });
    }
  });

  app.get("/api/referral/validate/:code", async (req, res) => {
    try {
      const code = req.params.code.toUpperCase();
      const [profile] = await db.select().from(profiles).where(eq(profiles.referralCode, code));
      if (!profile) return res.json({ valid: false });
      const [discountSetting] = await db.select().from(appSettings).where(eq(appSettings.key, "referral_discount_percent"));
      const discountPercent = discountSetting ? parseFloat(discountSetting.value) : 10;
      res.json({ valid: true, referrerName: profile.name, discountPercent });
    } catch (error) {
      res.status(500).json({ error: "Failed to validate code" });
    }
  });

  app.post("/api/referral/apply", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const { code } = req.body;
      if (!code) return res.status(400).json({ error: "Code is required" });
      const upperCode = code.toUpperCase();
      const [referrerProfile] = await db.select().from(profiles).where(eq(profiles.referralCode, upperCode));
      if (!referrerProfile) return res.status(404).json({ error: "Codice non valido" });
      const existing = await db.select().from(referrals).where(eq(referrals.referredUserId, userId));
      if (existing.length > 0) return res.status(400).json({ error: "Hai già usato un codice invito" });
      if (referrerProfile.userId === userId) return res.status(400).json({ error: "Non puoi usare il tuo codice" });
      await db.insert(referrals).values({
        referrerProfileId: referrerProfile.id,
        referredUserId: userId,
        referralCode: upperCode,
      });
      await storage.addPoints(referrerProfile.id, 50);
      res.json({ success: true, referrerName: referrerProfile.name });
    } catch (error) {
      console.error("Error applying referral:", error);
      res.status(500).json({ error: "Failed to apply referral code" });
    }
  });

  app.get("/api/admin/referrals", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const allReferrals = await db.select().from(referrals);
      const allProfiles = await storage.getProfiles();
      const allUsers = await storage.getAllUsers();
      const profileMap = new Map(allProfiles.map(p => [p.id, p]));
      const userMap = new Map(allUsers.map(u => [u.id, u]));
      const referrerStats = new Map<string, { profileId: string; name: string; code: string; totalReferred: number; paidReferred: number; referredUsers: any[] }>();
      for (const r of allReferrals) {
        const referrer = profileMap.get(r.referrerProfileId);
        if (!referrer) continue;
        if (!referrerStats.has(r.referrerProfileId)) {
          referrerStats.set(r.referrerProfileId, {
            profileId: r.referrerProfileId,
            name: referrer.name,
            code: referrer.referralCode || r.referralCode,
            totalReferred: 0,
            paidReferred: 0,
            referredUsers: [],
          });
        }
        const stat = referrerStats.get(r.referrerProfileId)!;
        stat.totalReferred++;
        if (r.hasPaid) stat.paidReferred++;
        const referredUser = userMap.get(r.referredUserId);
        stat.referredUsers.push({
          userId: r.referredUserId,
          email: referredUser?.email || "N/A",
          name: referredUser ? `${referredUser.firstName || ""} ${referredUser.lastName || ""}`.trim() : "N/A",
          hasPaid: r.hasPaid,
          createdAt: r.createdAt,
        });
      }
      res.json(Array.from(referrerStats.values()));
    } catch (error) {
      console.error("Error fetching admin referrals:", error);
      res.status(500).json({ error: "Failed to fetch referrals" });
    }
  });

  app.patch("/api/admin/referrals/:id/paid", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { hasPaid } = req.body;
      await db.update(referrals).set({ hasPaid: !!hasPaid }).where(eq(referrals.id, req.params.id));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to update referral" });
    }
  });

  app.get("/api/admin/settings", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const settings = await db.select().from(appSettings);
      const result: Record<string, string> = {};
      for (const s of settings) { result[s.key] = s.value; }
      if (!result["referral_discount_percent"]) result["referral_discount_percent"] = "10";
      if (!result["referral_commission_percent"]) result["referral_commission_percent"] = "15";
      res.json(result);
    } catch (error) {
      console.error("Error fetching settings:", error);
      res.status(500).json({ error: "Failed to fetch settings" });
    }
  });

  app.put("/api/admin/settings", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { key, value } = req.body;
      if (!key || value === undefined) return res.status(400).json({ error: "key and value required" });
      const allowedKeys = ["referral_discount_percent", "referral_commission_percent"];
      if (!allowedKeys.includes(key)) return res.status(400).json({ error: "Invalid setting key" });
      const numValue = parseFloat(value);
      if (isNaN(numValue) || numValue < 0 || numValue > 100) return res.status(400).json({ error: "Value must be between 0 and 100" });
      const [existing] = await db.select().from(appSettings).where(eq(appSettings.key, key));
      if (existing) {
        await db.update(appSettings).set({ value: String(numValue), updatedAt: new Date() }).where(eq(appSettings.key, key));
      } else {
        await db.insert(appSettings).values({ key, value: String(numValue) });
      }
      res.json({ success: true, key, value: numValue });
    } catch (error) {
      console.error("Error updating setting:", error);
      res.status(500).json({ error: "Failed to update setting" });
    }
  });

  app.get("/api/admin/all-codes", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const allProfiles = await storage.getProfiles();
      const allUsers = await storage.getAllUsers();
      const userMap = new Map(allUsers.map(u => [u.id, u]));
      const result = allProfiles
        .filter(p => !p.isBot && p.referralCode)
        .map(p => {
          const user = userMap.get(p.userId || "");
          return {
            profileId: p.id,
            name: p.name,
            email: user?.email || "N/A",
            referralCode: p.referralCode,
            isBot: p.isBot,
          };
        });
      res.json(result);
    } catch (error) {
      console.error("Error fetching all codes:", error);
      res.status(500).json({ error: "Failed to fetch codes" });
    }
  });

  app.post("/api/admin/send-welcome-emails", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { sendBulkWelcomeEmails } = await import("./gmail");
      const allUsers = await storage.getAllUsers();
      const allProfiles = await storage.getProfiles();
      const profileMap = new Map(allProfiles.filter(p => !p.isBot).map(p => [p.userId, p]));

      const realUsers = allUsers
        .filter(u => {
          const profile = profileMap.get(String(u.id));
          return profile && u.email && !u.email.endsWith("@vibra.com") && !u.isAdmin;
        })
        .map(u => ({
          email: u.email!,
          name: profileMap.get(String(u.id))?.name || u.firstName || "Esploratore",
        }));

      console.log(`[email] Trovati ${realUsers.length} iscritti reali per invio email`);
      const result = await sendBulkWelcomeEmails(realUsers);
      res.json({ ...result, total: realUsers.length });
    } catch (error: any) {
      console.error("Error sending welcome emails:", error);
      res.status(500).json({ error: "Failed to send welcome emails", message: error.message });
    }
  });

  app.post("/api/admin/send-custom-email", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { subject, htmlBody } = req.body;
      if (!subject || !htmlBody) {
        return res.status(400).json({ error: "Subject and htmlBody are required" });
      }
      const { sendBulkCustomEmails } = await import("./gmail");
      const allUsers = await storage.getAllUsers();
      const allProfiles = await storage.getProfiles();
      const profileMap = new Map(allProfiles.filter(p => !p.isBot).map(p => [p.userId, p]));

      const realUsers = allUsers
        .filter(u => {
          const profile = profileMap.get(String(u.id));
          return profile && u.email && !u.email.endsWith("@vibra.com") && !u.isAdmin;
        })
        .map(u => ({
          email: u.email!,
          name: profileMap.get(String(u.id))?.name || u.firstName || "Esploratore",
        }));

      console.log(`[custom-email] Sending to ${realUsers.length} users, subject: "${subject}"`);
      const result = await sendBulkCustomEmails(realUsers, subject, htmlBody);
      res.json({ ...result, total: realUsers.length });
    } catch (error: any) {
      console.error("Error sending custom email:", error);
      res.status(500).json({ error: "Failed to send custom email", message: error.message });
    }
  });

  app.get("/api/admin/backups", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const backups = await getBackupList();
      res.json(backups);
    } catch (error) {
      console.error("Error listing backups:", error);
      res.status(500).json({ error: "Failed to list backups" });
    }
  });

  app.post("/api/admin/backups/create", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const result = await createBackup();
      res.json(result);
    } catch (error) {
      console.error("Error creating backup:", error);
      res.status(500).json({ error: "Failed to create backup" });
    }
  });

  app.get("/api/admin/stats", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const [users, profiles, allMatches, allMessages] = await Promise.all([
        storage.getAllUsers(),
        storage.getAllProfiles(),
        storage.getAllMatches(),
        storage.getAllMessages(),
      ]);

      const botProfileIds = new Set(
        profiles.filter(p => p.isBot).map(p => p.id)
      );
      const realProfiles = profiles.filter(p => !p.isBot);
      const realProfileUserIds = new Set(realProfiles.map(p => p.userId));
      const realMatches = allMatches.filter(
        m => !botProfileIds.has(m.profile1Id) && !botProfileIds.has(m.profile2Id)
      );
      const realMessages = allMessages.filter(
        m => !botProfileIds.has(m.senderId)
      );

      const realSubscribers = users.filter(u => 
        realProfileUserIds.has(String(u.id)) && u.email && !u.email.endsWith("@vibra.com") && !u.isAdmin
      );

      // Same bot-detection as client isBot(): covers all bot accounts
      const realUsersCount = users.filter(u =>
        !String(u.id).startsWith("bot-user-") && u.email !== "nome@vibra.app"
      ).length;
      
      const sanitizedUsers = users.map(({ password, ...u }) => u);
      res.json({
        totalUsers: users.length,
        totalProfiles: realProfiles.length,
        totalMatches: realMatches.length,
        totalMessages: realMessages.length,
        realSubscriberCount: realSubscribers.length,
        realUsersCount,
        recentUsers: sanitizedUsers.slice(0, 10),
        recentMatches: realMatches.slice(0, 10),
      });
    } catch (error) {
      console.error("Error fetching admin stats:", error);
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });

  app.get("/api/admin/users", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const users = await storage.getAllUsers();
      const sanitizedUsers = users.map(({ password, ...u }) => u);
      res.json(sanitizedUsers);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  app.get("/api/admin/profiles", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const profiles = await storage.getAllProfiles();
      res.json(profiles);
    } catch (error) {
      console.error("Error fetching profiles:", error);
      res.status(500).json({ error: "Failed to fetch profiles" });
    }
  });

  app.delete("/api/admin/profiles/:id", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      await storage.deleteProfile(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting profile:", error);
      res.status(500).json({ error: "Failed to delete profile" });
    }
  });

  app.patch("/api/admin/profiles/:id/verify", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { isVerified } = req.body;
      const profile = await storage.setProfileVerified(req.params.id, isVerified);
      res.json(profile);
    } catch (error) {
      console.error("Error updating profile verification:", error);
      res.status(500).json({ error: "Failed to update profile verification" });
    }
  });

  app.patch("/api/admin/profiles/:id/highlight", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { days } = req.body;
      const profileId = req.params.id;
      if (days && days > 0) {
        const highlightedUntil = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
        await db.update(profiles).set({ highlightedUntil, highlightReason: "admin" }).where(eq(profiles.id, profileId));
        const profile = await storage.getProfile(profileId);
        res.json(profile);
      } else {
        await db.update(profiles).set({ highlightedUntil: null, highlightReason: null }).where(eq(profiles.id, profileId));
        const profile = await storage.getProfile(profileId);
        res.json(profile);
      }
    } catch (error) {
      console.error("Error updating profile highlight:", error);
      res.status(500).json({ error: "Failed to update profile highlight" });
    }
  });

  app.post("/api/admin/profiles/:id/login-as", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const profile = await storage.getProfile(req.params.id);
      if (!profile || !profile.userId) {
        return res.status(404).json({ error: "Profile or user not found" });
      }
      const user = await authStorage.getUser(profile.userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      (req.session as any).userId = user.id;
      res.json({ success: true, user: { id: user.id, email: user.email, firstName: user.firstName, isAdmin: user.isAdmin } });
    } catch (error) {
      console.error("Login-as error:", error);
      res.status(500).json({ error: "Failed to impersonate user" });
    }
  });

  app.get("/api/admin/profiles/:profileId/videos", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const videos = await storage.getProfileVideos(req.params.profileId);
      res.json(videos);
    } catch (err) {
      res.status(500).json({ error: "Errore nel recupero video" });
    }
  });

  const adminVideoUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      const allowed = ["video/mp4", "video/quicktime", "video/webm", "video/x-m4v", "video/x-mp4", "video/mov"];
      if (!allowed.includes(file.mimetype)) {
        cb(new Error("Formato video non supportato. Usa MP4, MOV o WebM."));
        return;
      }
      cb(null, true);
    },
  });

  app.post("/api/admin/profiles/:profileId/videos", isAuthenticated, isAdmin, (req: any, res: any, next: any) => {
    adminVideoUpload.single("video")(req, res, async (err: any) => {
      if (err) {
        if (err.code === "LIMIT_FILE_SIZE") return res.status(400).json({ error: "Video troppo grande. Massimo 50 MB." });
        return res.status(400).json({ error: err.message || "Errore upload" });
      }
      const profileId = req.params.profileId;
      console.log(`[admin-video] upload for profileId=${profileId}, file=${req.file?.originalname}, size=${req.file?.size}`);
      try {
        if (!req.file) return res.status(400).json({ error: "Nessun video ricevuto" });

        const profile = await storage.getProfile(profileId);
        if (!profile) return res.status(404).json({ error: "Profilo non trovato" });
        console.log(`[admin-video] Profile: ${profile.name}`);

        const MAX_VIDEOS = 10;
        const existingVideos = await storage.getProfileVideos(profile.id);
        if (existingVideos.length >= MAX_VIDEOS) {
          const sorted = [...existingVideos].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
          const oldest = sorted[0];
          console.log(`[admin-video] FIFO: deleting oldest ${oldest.id}`);
          try { await objectStorageService.deleteObject(oldest.videoUrl); } catch {}
          await storage.deleteProfileVideo(oldest.id);
        }

        const uploadURL = await objectStorageService.getObjectEntityUploadURL();
        const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);
        console.log(`[admin-video] Uploading to GCS: ${objectPath}`);

        const putResponse = await fetch(uploadURL, {
          method: "PUT",
          body: req.file.buffer,
          headers: { "Content-Type": req.file.mimetype },
        });
        if (!putResponse.ok) {
          const putErr = await putResponse.text().catch(() => putResponse.statusText);
          console.error(`[admin-video] GCS PUT failed: ${putResponse.status}`, putErr);
          return res.status(500).json({ error: "Errore nel salvataggio del video. Riprova." });
        }
        console.log(`[admin-video] GCS PUT OK`);

        try {
        await objectStorageService.trySetObjectEntityAclPolicy(objectPath, { visibility: "public", owner: null as any });
        } catch (aclErr: any) {
          console.log(`[admin-video] ACL set FAILED (non-fatal): ${aclErr?.message}`);
        }

        const { caption, location, gifOverlayUrl } = req.body;
        const video = await storage.addProfileVideo({
          profileId: profile.id,
          videoUrl: objectPath,
          thumbnailUrl: null,
          location: location || null,
          caption: caption || null,
          gifOverlayUrl: gifOverlayUrl || null,
        });
        console.log(`[admin-video] Saved OK: ${video.id}`);
        res.json(video);
      } catch (err: any) {
        console.error("[admin-video] error:", err?.message || err);
        res.status(500).json({ error: "Errore nel caricamento video", details: err?.message });
      }
    });
  });

  app.delete("/api/admin/profiles/:profileId/videos/:videoId", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const video = await storage.getProfileVideoById(req.params.videoId);
      if (!video) return res.status(404).json({ error: "Video non trovato" });
      if (video.profileId !== req.params.profileId) return res.status(403).json({ error: "Non corrisponde al profilo" });
      try { await objectStorageService.deleteObject(video.videoUrl); } catch {}
      await storage.deleteProfileVideo(req.params.videoId);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Errore nell'eliminazione" });
    }
  });

  app.get("/api/admin/challenge-submissions", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const submissions = await storage.getAllChallengeSubmissions();
      res.json(submissions);
    } catch (error) {
      console.error("Error fetching submissions:", error);
      res.status(500).json({ error: "Failed to fetch submissions" });
    }
  });

  app.patch("/api/admin/challenge-submissions/:id", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { status } = req.body;
      if (!status || !["approved", "rejected"].includes(status)) {
        return res.status(400).json({ error: "Invalid status" });
      }

      const submission = await storage.updateChallengeSubmissionStatus(req.params.id, status);
      if (!submission) return res.status(404).json({ error: "Submission not found" });

      if (status === "approved") {
        const challenges = await storage.getChallenges();
        const challenge = challenges.find(c => c.id === submission.challengeId);
        const pointsToAward = challenge?.points ?? 10;
        await storage.addPoints(submission.profileId, pointsToAward);

        const highlightThreshold = 60;
        if (pointsToAward >= highlightThreshold) {
          const highlightDays = 7;
          const highlightedUntil = new Date(Date.now() + highlightDays * 24 * 60 * 60 * 1000);
          await db.update(profiles).set({
            highlightedUntil,
            highlightReason: `challenge_winner`,
          }).where(eq(profiles.id, submission.profileId));
        }
      }

      if (status === "rejected" && submission.imageUrl) {
        await objectStorageService.deleteObject(submission.imageUrl);
      }

      res.json(submission);
    } catch (error) {
      console.error("Error updating submission:", error);
      res.status(500).json({ error: "Failed to update submission" });
    }
  });

  app.delete("/api/admin/challenge-submissions/:id", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const [sub] = await db.select().from(challengeSubmissions).where(eq(challengeSubmissions.id, req.params.id));
      if (sub?.imageUrl) {
        await objectStorageService.deleteObject(sub.imageUrl);
      }
      await db.delete(challengeSubmissions).where(eq(challengeSubmissions.id, req.params.id));
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting submission:", error);
      res.status(500).json({ error: "Failed to delete submission" });
    }
  });

  app.post("/api/admin/challenges", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { title, description, points } = req.body;
      if (!title || !description) return res.status(400).json({ error: "Titolo e descrizione richiesti" });
      const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000);
      const [challenge] = await db.insert(dailyChallenges).values({
        title,
        description,
        points: points || 10,
        isActive: true,
        expiresAt,
      }).returning();
      res.status(201).json(challenge);
    } catch (error) {
      console.error("Error creating challenge:", error);
      res.status(500).json({ error: "Failed to create challenge" });
    }
  });

  app.post("/api/admin/reset-test-data", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const testEmails = ["luna@test.com", "nova@test.com", "orion@test.com"];
      const testProfileIds: string[] = [];

      for (const email of testEmails) {
        const testUser = await storage.getUserByEmail(email);
        if (testUser) {
          const profile = await storage.getProfileByUserId(testUser.id);
          if (profile) testProfileIds.push(profile.id);
        }
      }

      if (testProfileIds.length === 0) {
        return res.json({ success: true, deleted: { swipes: 0, matches: 0, messages: 0 }, note: "Nessun profilo di test trovato" });
      }

      let totalSwipes = 0;
      let totalMatches = 0;
      let totalMessages = 0;

      for (const profileId of testProfileIds) {
        const profileMatches = await db.select().from(matches).where(
          or(eq(matches.profile1Id, profileId), eq(matches.profile2Id, profileId))
        );
        for (const m of profileMatches) {
          const deletedMsgs = await db.delete(messages).where(eq(messages.matchId, m.id)).returning();
          totalMessages += deletedMsgs.length;
        }
        const deletedMatches = await db.delete(matches).where(
          or(eq(matches.profile1Id, profileId), eq(matches.profile2Id, profileId))
        ).returning();
        totalMatches += deletedMatches.length;

        const deletedSwipes = await db.delete(swipes).where(
          or(eq(swipes.swiperId, profileId), eq(swipes.swipedId, profileId))
        ).returning();
        totalSwipes += deletedSwipes.length;
      }

      res.json({
        success: true,
        deleted: { swipes: totalSwipes, matches: totalMatches, messages: totalMessages },
      });
    } catch (error) {
      console.error("Error resetting test data:", error);
      res.status(500).json({ error: "Failed to reset test data" });
    }
  });

  // === ADMIN MODERATION ROUTES ===

  // Reports
  app.get("/api/admin/reports", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const reps = await storage.getReports();
      res.json(reps);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch reports" });
    }
  });

  app.patch("/api/admin/reports/:id", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { status } = req.body;
      if (!["resolved", "dismissed", "pending"].includes(status)) {
        return res.status(400).json({ error: "Invalid status" });
      }
      const moderatorUserId = req.user?.claims?.sub || req.session?.userId;
      if (!moderatorUserId) return res.status(401).json({ error: "Unauthorized" });
      if (status === "resolved") {
        const [report] = await db
          .select({
            reportedContentType: reports.reportedContentType,
            reportedContentId: reports.reportedContentId,
            coldMessageId: reports.coldMessageId,
          })
          .from(reports)
          .where(eq(reports.id, req.params.id))
          .limit(1);
        if (!report) return res.status(404).json({ error: "Report not found" });
        if (report.reportedContentId || report.coldMessageId) {
          return res.status(409).json({ error: "Remove the reported content before resolving this report" });
        }
      }
      const report = await storage.updateReportStatus(req.params.id, status, moderatorUserId);
      res.json(report);
    } catch (error) {
      res.status(500).json({ error: "Failed to update report" });
    }
  });

  app.post("/api/admin/reports/:id/suspend-user", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const moderatorUserId = req.user?.claims?.sub || req.session?.userId;
      if (!moderatorUserId) return res.status(401).json({ error: "Unauthorized" });
      const now = new Date();
      const result = await db.transaction(async (tx) => {
        const [report] = await tx
          .select()
          .from(reports)
          .where(eq(reports.id, req.params.id))
          .limit(1);
        if (!report) return { ok: false as const, error: "not_found" as const };
        if (report.status !== "pending") return { ok: false as const, error: "not_pending" as const };
        if (report.reportedContentId || report.coldMessageId) {
          return { ok: false as const, error: "content_linked" as const };
        }

        let reportedUserId = report.reportedUserId;
        if (!reportedUserId) {
          const [reportedProfile] = await tx
            .select({ userId: profiles.userId })
            .from(profiles)
            .where(eq(profiles.id, report.reportedId))
            .limit(1);
          reportedUserId = reportedProfile?.userId ?? null;
        }
        if (!reportedUserId) return { ok: false as const, error: "no_account" as const };

        const [claimedReport] = await tx
          .update(reports)
          .set({
            status: "resolved",
            resolvedAt: now,
            moderationAction: "author_suspended",
            moderatedBy: moderatorUserId,
            moderatedAt: now,
          })
          .where(and(eq(reports.id, report.id), eq(reports.status, "pending")))
          .returning({ id: reports.id });
        if (!claimedReport) return { ok: false as const, error: "not_pending" as const };

        const expiresAt = getReportSuspensionExpiry(now);
        await tx.insert(userSuspensions).values({
          userId: reportedUserId,
          reason: `Segnalazione ${report.id.slice(0, 8)}: ${report.reason}`.slice(0, 500),
          expiresAt,
          isPermanent: false,
        });
        return { ok: true as const, targetProfileId: report.reportedId, expiresAt };
      });

      if (!result.ok) {
        const responseMap = {
          not_found: [404, "Report not found"],
          not_pending: [409, "Report has already been handled"],
          content_linked: [409, "Remove the linked content through the report action"],
          no_account: [409, "The reported profile has no linked account to suspend"],
        } as const;
        const [status, error] = responseMap[result.error];
        return res.status(status).json({ error });
      }
      disconnectUserSockets(result.targetProfileId);
      return res.json({ success: true, authorSuspended: true, suspensionExpiresAt: result.expiresAt });
    } catch (error) {
      console.error("[ugc-moderation] report suspension failed:", error);
      return res.status(500).json({ error: "Failed to suspend reported user" });
    }
  });

  app.post("/api/admin/reports/:id/remove-and-suspend", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const moderatorUserId = req.user?.claims?.sub || req.session?.userId;
      if (!moderatorUserId) return res.status(401).json({ error: "Unauthorized" });
      const now = new Date();
      const result = await db.transaction(async (tx) => {
        const [report] = await tx
          .select()
          .from(reports)
          .where(eq(reports.id, req.params.id))
          .limit(1);

        if (!report) return { ok: false as const, error: "not_found" as const };
        if (report.status !== "pending") return { ok: false as const, error: "not_pending" as const };
        const contentType = isReportContentType(report.reportedContentType)
          ? report.reportedContentType
          : report.coldMessageId && !report.reportedContentType
            ? "cold_message"
            : null;
        const contentId = report.reportedContentId ?? report.coldMessageId;
        if (!contentType || !contentId) return { ok: false as const, error: "no_reported_content" as const };
        if (isDetailedReportContentType(contentType)) {
          return moderateDetailedReportInTransaction(tx, report, moderatorUserId, now);
        }

        let reportedUserId = report.reportedUserId;
        if (!reportedUserId) {
          const [reportedProfile] = await tx
            .select({ userId: profiles.userId })
            .from(profiles)
            .where(eq(profiles.id, report.reportedId))
            .limit(1);
          reportedUserId = reportedProfile?.userId ?? null;
        }
        const snapshotAvailable = Boolean(report.reportedContentSnapshot || report.coldMessageContent);
        let coldMessage:
          | { id: string; fromProfileId: string; toProfileId: string }
          | undefined;
        let chatMessage:
          | { id: string; matchId: string; senderId: string }
          | undefined;
        let roomMessage:
          | { id: string; roomId: string; senderId: string }
          | undefined;
        let privateRoomMessage:
          | { id: string; roomId: string; senderId: string }
          | undefined;
        let blogPost:
          | { id: string; profileId: string }
          | undefined;
        let profileExists = false;

        if (contentType === "cold_message") {
          if (report.coldMessageId && report.coldMessageId !== contentId) {
            return { ok: false as const, error: "content_mismatch" as const };
          }
          const [row] = await tx
            .select({
              id: coldMessages.id,
              fromProfileId: coldMessages.fromProfileId,
              toProfileId: coldMessages.toProfileId,
            })
            .from(coldMessages)
            .where(eq(coldMessages.id, contentId))
            .limit(1);
          coldMessage = row;
          if (coldMessage && !isColdMessageAuthoredByReportedUser(report, coldMessage)) {
            return { ok: false as const, error: "content_mismatch" as const };
          }
        } else if (contentType === "chat_message") {
          const [row] = await tx
            .select({
              id: messages.id,
              matchId: messages.matchId,
              senderId: messages.senderId,
            })
            .from(messages)
            .where(eq(messages.id, contentId))
            .limit(1);
          chatMessage = row;
          if (chatMessage) {
            const [match] = await tx
              .select({ profile1Id: matches.profile1Id, profile2Id: matches.profile2Id })
              .from(matches)
              .where(eq(matches.id, chatMessage.matchId))
              .limit(1);
            if (!isChatMessageAuthoredByReportedUser(report, chatMessage, match)) {
              return { ok: false as const, error: "content_mismatch" as const };
            }
          }
        } else if (contentType === "room_message") {
          const [row] = await tx
            .select({
              id: roomMessages.id,
              roomId: roomMessages.roomId,
              senderId: roomMessages.senderId,
            })
            .from(roomMessages)
            .where(eq(roomMessages.id, contentId))
            .limit(1);
          roomMessage = row;
          if (roomMessage && !isRoomMessageAuthoredByReportedUser(report, roomMessage)) {
            return { ok: false as const, error: "content_mismatch" as const };
          }
        } else if (contentType === "private_room_message") {
          const [row] = await tx
            .select({
              id: privateRoomMessages.id,
              roomId: privateRoomMessages.roomId,
              senderId: privateRoomMessages.senderId,
            })
            .from(privateRoomMessages)
            .where(eq(privateRoomMessages.id, contentId))
            .limit(1);
          privateRoomMessage = row;
          if (privateRoomMessage && !isRoomMessageAuthoredByReportedUser(report, privateRoomMessage)) {
            return { ok: false as const, error: "content_mismatch" as const };
          }
        } else if (contentType === "blog_post") {
          const [row] = await tx
            .select({ id: blogPosts.id, profileId: blogPosts.profileId })
            .from(blogPosts)
            .where(eq(blogPosts.id, contentId))
            .limit(1);
          blogPost = row;
          if (blogPost && !isBlogPostAuthoredByReportedUser(report, blogPost)) {
            return { ok: false as const, error: "content_mismatch" as const };
          }
        } else if (contentType === "profile") {
          if (contentId !== report.reportedId) {
            return { ok: false as const, error: "content_mismatch" as const };
          }
          const [row] = await tx
            .select({ id: profiles.id, userId: profiles.userId })
            .from(profiles)
            .where(eq(profiles.id, contentId))
            .limit(1);
          profileExists = Boolean(row);
          if (row && reportedUserId && row.userId && row.userId !== reportedUserId) {
            return { ok: false as const, error: "content_mismatch" as const };
          }
        }

        const linkedContentExists = Boolean(
          coldMessage || chatMessage || roomMessage || privateRoomMessage || blogPost || profileExists,
        );
        if (!linkedContentExists && !snapshotAvailable) {
          return { ok: false as const, error: "content_evidence_unavailable" as const };
        }

        // Claim the pending report before taking action. This condition also
        // prevents two moderators from applying the same action concurrently.
        const [claimedReport] = await tx
          .update(reports)
          .set({
            status: "resolved",
            resolvedAt: now,
            moderatedBy: moderatorUserId,
            moderatedAt: now,
          })
          .where(and(eq(reports.id, report.id), eq(reports.status, "pending")))
          .returning({ id: reports.id });
        if (!claimedReport) return { ok: false as const, error: "not_pending" as const };

        let contentRemoved = false;
        let contentHidden = false;
        if (coldMessage) {
          const deletedMessages = await tx
            .delete(coldMessages)
            .where(and(
              eq(coldMessages.id, contentId),
              eq(coldMessages.fromProfileId, report.reportedId),
              eq(coldMessages.toProfileId, report.reporterId),
            ))
            .returning({ id: coldMessages.id });
          contentRemoved = deletedMessages.length > 0;
        } else if (chatMessage) {
          const deletedMessages = await tx
            .delete(messages)
            .where(and(
              eq(messages.id, contentId),
              eq(messages.senderId, report.reportedId),
              eq(messages.matchId, chatMessage.matchId),
            ))
            .returning({ id: messages.id });
          contentRemoved = deletedMessages.length > 0;
        } else if (roomMessage) {
          const deletedMessages = await tx
            .delete(roomMessages)
            .where(and(
              eq(roomMessages.id, contentId),
              eq(roomMessages.roomId, roomMessage.roomId),
              eq(roomMessages.senderId, report.reportedId),
            ))
            .returning({ id: roomMessages.id });
          contentRemoved = deletedMessages.length > 0;
        } else if (privateRoomMessage) {
          const deletedMessages = await tx
            .delete(privateRoomMessages)
            .where(and(
              eq(privateRoomMessages.id, contentId),
              eq(privateRoomMessages.roomId, privateRoomMessage.roomId),
              eq(privateRoomMessages.senderId, report.reportedId),
            ))
            .returning({ id: privateRoomMessages.id });
          contentRemoved = deletedMessages.length > 0;
        } else if (blogPost) {
          const deletedPosts = await tx
            .delete(blogPosts)
            .where(and(
              eq(blogPosts.id, contentId),
              eq(blogPosts.profileId, report.reportedId),
            ))
            .returning({ id: blogPosts.id });
          contentRemoved = deletedPosts.length > 0;
        } else if (contentType === "profile" && profileExists) {
          const hiddenProfiles = await tx
            .update(profiles)
            .set({ moderationHidden: true })
            .where(and(
              eq(profiles.id, contentId),
              eq(profiles.moderationHidden, false),
            ))
            .returning({ id: profiles.id });
          contentHidden = hiddenProfiles.length > 0;
        }

        await tx.update(reports)
          .set({
            moderationAction: `${contentRemoved
              ? `${contentType}_removed`
              : contentHidden
                ? "profile_hidden"
                : "content_already_removed"}${reportedUserId ? "_and_suspended" : ""}`,
          })
          .where(eq(reports.id, report.id));

        let expiresAt: Date | null = null;
        if (reportedUserId) {
          expiresAt = getReportSuspensionExpiry(now);
          await tx.insert(userSuspensions).values({
            userId: reportedUserId,
            reason: `Segnalazione ${report.id.slice(0, 8)}: ${report.reason}`.slice(0, 500),
            expiresAt,
            isPermanent: false,
          });
        }

        return {
          ok: true as const,
          targetProfileId: report.reportedId,
          contentRemoved,
          contentHidden,
          authorSuspended: Boolean(reportedUserId),
          expiresAt,
        };
      });

      if (!result.ok) {
        const responses = {
          not_found: [404, "Report not found"],
          not_pending: [409, "Report has already been handled"],
          no_reported_content: [409, "This report is not linked to a specific content item"],
          content_mismatch: [409, "Reported content does not belong to this report"],
          content_evidence_unavailable: [409, "Reported content and its evidence are unavailable"],
        } as const;
        const [status, error] = responses[result.error];
        return res.status(status).json({ error });
      }

      disconnectUserSockets(result.targetProfileId);
      console.warn(
        `[ugc-moderation] report=${req.params.id} contentRemoved=${result.contentRemoved} contentHidden=${result.contentHidden} ` +
        `authorSuspended=${result.authorSuspended} suspensionHours=${result.authorSuspended ? 24 : 0}`,
      );
      return res.json({
        success: true,
        contentRemoved: result.contentRemoved,
        contentHidden: result.contentHidden,
        contentWasAlreadyRemoved: !result.contentRemoved && !result.contentHidden,
        authorSuspended: result.authorSuspended,
        suspensionExpiresAt: result.expiresAt,
      });
    } catch (error) {
      console.error("[ugc-moderation] remove-and-suspend action failed:", error);
      return res.status(500).json({ error: "Failed to moderate reported content" });
    }
  });

  // User report from any authenticated user
  app.post("/api/reports", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const profile = await storage.getProfileByUserId(userId);
      if (!profile) return res.status(404).json({ error: "Profile not found" });

      const {
        reportedId,
        reason,
        description,
        coldMessageId,
        reportedContentType: requestedContentType,
        reportedContentId: requestedContentId,
      } = req.body;
      if (typeof reportedId !== "string" || !reportedId || typeof reason !== "string" || !reason.trim()) {
        return res.status(400).json({ error: "reportedId and reason are required" });
      }
      if (reportedId === profile.id) {
        return res.status(400).json({ error: "You cannot report your own profile" });
      }
      if (coldMessageId !== undefined && typeof coldMessageId !== "string") {
        return res.status(400).json({ error: "coldMessageId must be a string" });
      }
      if (description !== undefined && typeof description !== "string") {
        return res.status(400).json({ error: "description must be a string" });
      }

      const reportedContentType = requestedContentType ?? (coldMessageId ? "cold_message" : undefined);
      const reportedContentId = requestedContentId ?? coldMessageId;
      if (reportedContentType !== undefined && !isReportContentType(reportedContentType)) {
        return res.status(400).json({ error: "Unsupported reported content type" });
      }
      if (
        (reportedContentType !== undefined && typeof reportedContentId !== "string") ||
        (reportedContentType === undefined && reportedContentId !== undefined) ||
        (reportedContentId !== undefined && typeof reportedContentId !== "string")
      ) {
        return res.status(400).json({ error: "A supported content type and content ID must be provided together" });
      }
      if (
        coldMessageId &&
        (reportedContentType !== "cold_message" || reportedContentId !== coldMessageId)
      ) {
        return res.status(400).json({ error: "Cold-message report reference does not match" });
      }

      let coldMessageContent: string | undefined;
      let reportedContentSnapshot: string | undefined;
      if (reportedContentType === "profile" && reportedContentId) {
        if (reportedContentId !== reportedId) {
          return res.status(400).json({ error: "Reported profile reference does not match the report target" });
        }
        const [reportedProfile] = await db
          .select({
            id: profiles.id,
            name: profiles.name,
            bio: profiles.bio,
            imageUrl: profiles.imageUrl,
            photos: profiles.photos,
            profileVideoUrl: profiles.profileVideoUrl,
          })
          .from(profiles)
          .where(eq(profiles.id, reportedContentId))
          .limit(1);
        if (!reportedProfile) return res.status(404).json({ error: "Reported profile not found" });
        reportedContentSnapshot = JSON.stringify(reportedProfile);
      } else if (reportedContentType === "chat_message" && reportedContentId) {
        const [message] = await db
          .select({
            id: messages.id,
            matchId: messages.matchId,
            senderId: messages.senderId,
            content: messages.content,
            createdAt: messages.createdAt,
          })
          .from(messages)
          .where(eq(messages.id, reportedContentId))
          .limit(1);
        const [match] = message
          ? await db
            .select({ profile1Id: matches.profile1Id, profile2Id: matches.profile2Id })
            .from(matches)
            .where(eq(matches.id, message.matchId))
            .limit(1)
          : [];
        if (!message || !isChatMessageAuthoredByReportedUser(
          { reporterId: profile.id, reportedId },
          message,
          match,
        )) {
          return res.status(400).json({ error: "Reported chat message does not belong to this report" });
        }
        reportedContentSnapshot = JSON.stringify({
          content: message.content,
          createdAt: message.createdAt,
        });
      } else if (reportedContentType === "room_message" && reportedContentId) {
        const [message] = await db
          .select({
            id: roomMessages.id,
            roomId: roomMessages.roomId,
            senderId: roomMessages.senderId,
            content: roomMessages.content,
            createdAt: roomMessages.createdAt,
          })
          .from(roomMessages)
          .where(eq(roomMessages.id, reportedContentId))
          .limit(1);
        if (!message || !isRoomMessageAuthoredByReportedUser({ reportedId }, message)) {
          return res.status(400).json({ error: "Reported room message does not belong to this report" });
        }
        reportedContentSnapshot = JSON.stringify(message);
      } else if (reportedContentType === "private_room_message" && reportedContentId) {
        const [message] = await db
          .select({
            id: privateRoomMessages.id,
            roomId: privateRoomMessages.roomId,
            senderId: privateRoomMessages.senderId,
            content: privateRoomMessages.content,
            createdAt: privateRoomMessages.createdAt,
          })
          .from(privateRoomMessages)
          .where(eq(privateRoomMessages.id, reportedContentId))
          .limit(1);
        if (!message || !isRoomMessageAuthoredByReportedUser({ reportedId }, message)) {
          return res.status(400).json({ error: "Reported private-room message does not belong to this report" });
        }
        if (!await storage.isPrivateRoomMember(message.roomId, profile.id)) {
          return res.status(403).json({ error: "You must be a member of this private room to report its messages" });
        }
        reportedContentSnapshot = JSON.stringify(message);
      } else if (reportedContentType === "blog_post" && reportedContentId) {
        const [post] = await db
          .select({
            id: blogPosts.id,
            profileId: blogPosts.profileId,
            title: blogPosts.title,
            content: blogPosts.content,
            imageUrl: blogPosts.imageUrl,
            category: blogPosts.category,
            createdAt: blogPosts.createdAt,
          })
          .from(blogPosts)
          .where(eq(blogPosts.id, reportedContentId))
          .limit(1);
        if (!post || !isBlogPostAuthoredByReportedUser({ reportedId }, post)) {
          return res.status(400).json({ error: "Reported blog post does not belong to this report" });
        }
        reportedContentSnapshot = JSON.stringify(post);
      } else if (reportedContentType === "cold_message" && reportedContentId) {
        const [cm] = await db
          .select({
            id: coldMessages.id,
            content: coldMessages.content,
            fromProfileId: coldMessages.fromProfileId,
            toProfileId: coldMessages.toProfileId,
          })
          .from(coldMessages)
          .where(eq(coldMessages.id, reportedContentId))
          .limit(1);
        if (!cm || !isColdMessageAuthoredByReportedUser(
          { reporterId: profile.id, reportedId },
          cm,
        )) {
          return res.status(400).json({ error: "Reported cold message does not belong to this report" });
        }
        coldMessageContent = cm.content;
        reportedContentSnapshot = JSON.stringify({ content: cm.content });
      } else if (
        reportedContentType &&
        reportedContentId &&
        isDetailedReportContentType(reportedContentType)
      ) {
        reportedContentSnapshot = await captureDetailedReportContentSnapshot({
          reporterId: profile.id,
          reportedId,
          contentType: reportedContentType,
          contentId: reportedContentId,
        }) ?? undefined;
        if (!reportedContentSnapshot) {
          return res.status(400).json({ error: "Reported content does not belong to this report" });
        }
      }

      const report = await storage.createReport({
        reporterId: profile.id,
        reportedId,
        reason,
        description,
        coldMessageId: reportedContentType === "cold_message" ? reportedContentId : undefined,
        coldMessageContent,
        reportedContentType,
        reportedContentId,
        reportedContentSnapshot,
      });
      void notifyAdminsOfNewUserReport(report.id);
      res.json(report);
    } catch (error) {
      res.status(500).json({ error: "Failed to create report" });
    }
  });

  // ─── User's own reports (read + delete) ─────────────────────────────────
  app.get("/api/reports/mine", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const profile = await storage.getProfileByUserId(userId);
      if (!profile) return res.status(404).json({ error: "Profile not found" });

      const myReports = await db
        .select({
          id: reports.id,
          reportedId: reports.reportedId,
          reason: reports.reason,
          description: reports.description,
          status: reports.status,
          createdAt: reports.createdAt,
          reportedName: profiles.name,
          reportedImage: profiles.imageUrl,
          reportedAge: profiles.age,
        })
        .from(reports)
        .leftJoin(profiles, eq(reports.reportedId, profiles.id))
        .where(eq(reports.reporterId, profile.id))
        .orderBy(desc(reports.createdAt));

      res.json(myReports);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch reports" });
    }
  });

  app.delete("/api/reports/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const profile = await storage.getProfileByUserId(userId);
      if (!profile) return res.status(404).json({ error: "Profile not found" });

      // Only the reporter can delete their own report
      const [existing] = await db
        .select({ id: reports.id, reporterId: reports.reporterId, reportedId: reports.reportedId })
        .from(reports)
        .where(and(eq(reports.id, req.params.id), eq(reports.reporterId, profile.id)));

      if (!existing) return res.status(404).json({ error: "Report not found" });

      // Deleting the report is the only action needed: the cold-message delivery
      // route (POST /api/cold-messages) filters exclusively on the reports table,
      // so once this record is gone the sender can reach the user again.
      // Blocks (blockedUsers) are a separate safety mechanism managed independently
      // and are intentionally NOT touched here.
      await db.delete(reports).where(
        and(eq(reports.id, req.params.id), eq(reports.reporterId, profile.id))
      );

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete report" });
    }
  });

  // Suspensions
  app.get("/api/admin/suspensions", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const suspensions = await storage.getUserSuspensions();
      res.json(suspensions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch suspensions" });
    }
  });

  app.post("/api/admin/suspensions", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { userId, reason, expiresAt, isPermanent } = req.body;
      if (!userId || !reason) return res.status(400).json({ error: "userId and reason are required" });
      const suspension = await storage.suspendUser({ userId, reason, expiresAt: expiresAt ? new Date(expiresAt) : undefined, isPermanent });
      const suspendedProfile = await storage.getProfileByUserId(userId);
      if (suspendedProfile) disconnectUserSockets(suspendedProfile.id);
      res.json(suspension);
    } catch (error) {
      res.status(500).json({ error: "Failed to suspend user" });
    }
  });

  app.delete("/api/admin/suspensions/:id", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      await storage.liftSuspension(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to lift suspension" });
    }
  });

  // Banned words
  app.get("/api/admin/banned-words", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const words = await storage.getBannedWords();
      res.json(words);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch banned words" });
    }
  });

  app.post("/api/admin/banned-words", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { word } = req.body;
      if (!word) return res.status(400).json({ error: "word is required" });
      const bw = await storage.addBannedWord(word);
      res.json(bw);
    } catch (error) {
      res.status(500).json({ error: "Failed to add banned word" });
    }
  });

  app.delete("/api/admin/banned-words/:id", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      await storage.removeBannedWord(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to remove banned word" });
    }
  });

  app.post("/api/admin/reset-password", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { userId, newPassword } = req.body;
      if (!userId || !newPassword) {
        return res.status(400).json({ error: "userId and newPassword required" });
      }
      const bcrypt = await import("bcryptjs");
      const hashedPassword = await bcrypt.hash(newPassword, 12);
      await db.update(users).set({ password: hashedPassword }).where(eq(users.id, userId));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to reset password" });
    }
  });

  app.post("/api/admin/change-email", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { userId, newEmail } = req.body;
      if (!userId || !newEmail) {
        return res.status(400).json({ error: "userId and newEmail required" });
      }
      const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, newEmail.toLowerCase().trim()));
      if (existing.length > 0) {
        return res.status(400).json({ error: "Email già in uso da un altro utente" });
      }
      await db.update(users).set({ email: newEmail.toLowerCase().trim() }).where(eq(users.id, userId));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to change email" });
    }
  });

  // Message moderation
  app.get("/api/admin/room-messages", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const msgs = await storage.getAllRoomMessages();
      res.json(msgs);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  app.delete("/api/admin/room-messages/:id", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      await storage.deleteRoomMessage(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete message" });
    }
  });

  app.delete("/api/admin/private-room-messages/:id", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      await storage.deletePrivateRoomMessage(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete message" });
    }
  });

  app.get("/api/admin/chat-messages", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const allMessages = await storage.getAllMessages();
      const allProfiles = await storage.getAllProfiles();
      const allMatches = await storage.getAllMatches();
      const profileMap = new Map(allProfiles.map(p => [p.id, p]));
      const matchMap = new Map(allMatches.map(m => [m.id, m]));

      const enriched = allMessages.slice(0, 200).map(msg => {
        const match = matchMap.get(msg.matchId);
        const sender = profileMap.get(msg.senderId);
        const receiverId = match ? (match.profile1Id === msg.senderId ? match.profile2Id : match.profile1Id) : null;
        const receiver = receiverId ? profileMap.get(receiverId) : null;
        return {
          ...msg,
          senderName: sender?.name || "Sconosciuto",
          senderImage: sender?.imageUrl || null,
          receiverName: receiver?.name || "Sconosciuto",
          receiverImage: receiver?.imageUrl || null,
        };
      });
      res.json(enriched);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch chat messages" });
    }
  });

  app.delete("/api/admin/chat-messages/:id", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      await storage.deleteMessage(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete message" });
    }
  });

  // Check user suspension status (used by frontend)
  app.get("/api/suspension-status", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const suspension = await storage.getActiveSuspension(userId);
      res.json({ suspended: !!suspension, suspension: suspension || null });
    } catch (error) {
      res.status(500).json({ error: "Failed to check suspension" });
    }
  });

  // Banned words check endpoint (used by frontend before sending messages)
  app.get("/api/banned-words", isAuthenticated, async (req: any, res) => {
    try {
      const words = await storage.getBannedWords();
      res.json(words.map(w => w.word));
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch banned words" });
    }
  });

  app.post("/api/messages", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const { matchId, content } = req.body;
      
      if (!matchId || !content) {
        return res.status(400).json({ error: "matchId and content are required" });
      }
      
      const match = await storage.getMatchById(matchId);
      if (!match) {
        return res.status(404).json({ error: "Match not found" });
      }
      
      const userProfile = await storage.getProfileByUserId(userId);
      if (!userProfile) {
        return res.status(403).json({ error: "Profile not found" });
      }
      
      if (match.profile1Id !== userProfile.id && match.profile2Id !== userProfile.id) {
        return res.status(403).json({ error: "Not authorized to send messages in this chat" });
      }
      
      const filteredContent = filterOffensiveContent(content, await getBannedWordsForFiltering());
      
      const message = await storage.createMessage({
        matchId,
        senderId: userProfile.id,
        content: filteredContent,
      });
      // VibraDNA: traccia lunghezza messaggio e tempo di risposta (fire-and-forget)
      storage.trackDnaEvent(userProfile.id, 'message', filteredContent.length).catch(() => {});
      storage.trackQuestProgress(userProfile.id, 'message_5').catch(() => {});
      res.status(201).json(message);

      const otherProfileId = match.profile1Id === userProfile.id ? match.profile2Id : match.profile1Id;

      sendPushToProfile(otherProfileId, {
        title: userProfile.name,
        body: filteredContent.substring(0, 100),
        icon: "/icons/icon-192.png",
        url: `/chat/${matchId}`,
      });

      const otherProfile = await storage.getProfile(otherProfileId);
      if (otherProfile && shouldAutoReplyToDirectMessage(otherProfile)) {
        // Delay realistico basato su lastActiveAt del bot
        const { readDelayMs } = getBotDelay(otherProfile);
        (async () => {
          try {
            await new Promise(r => setTimeout(r, readDelayMs));
            const allMessages = await storage.getMessagesForMatch(matchId);
            const botReply = await generateBotReply(otherProfile, userProfile, allMessages);
            const typingMs = getBotTypingMs(botReply);
            await new Promise(r => setTimeout(r, typingMs));
            await storage.createMessage({
              matchId,
              senderId: otherProfile.id,
              content: botReply,
            });
            sendPushToProfile(userProfile.id, {
              title: otherProfile.name,
              body: botReply.substring(0, 100),
              icon: "/icons/icon-192.png",
              url: `/chat/${matchId}`,
            });
            console.log(`[BOT] Match reply: ${otherProfile.name} (delay=${Math.round((readDelayMs)/1000)}s read + ${Math.round(typingMs/1000)}s typing)`);
          } catch (err) {
            console.error("Bot auto-reply error:", err);
          }
        })();
      }
    } catch (error) {
      console.error("Error creating message:", error);
      res.status(500).json({ error: "Failed to send message" });
    }
  });

  // Rooms API
  app.get("/api/rooms", isAuthenticated, async (req, res) => {
    try {
      const allRooms = await storage.getRooms();
      const currentHour = new Date().getUTCHours();
      const roomsWithCounts = await Promise.all(allRooms.map(async (room) => {
        const members = await db.select().from(roomMembers).where(eq(roomMembers.roomId, room.id));
        const roomIdNum = typeof room.id === "string" ? parseInt(room.id, 10) || room.id.charCodeAt(0) : Number(room.id);
        const seed = (roomIdNum * 2654435761 + currentHour * 31) >>> 0;
        const baseCount = (seed % 4) + 1;
        return { ...room, memberCount: members.length + baseCount };
      }));
      res.json(roomsWithCounts);
    } catch (error) {
      console.error("Error fetching rooms:", error);
      res.status(500).json({ error: "Failed to fetch rooms" });
    }
  });

  app.get("/api/rooms/:id", isAuthenticated, async (req, res) => {
    try {
      const room = await storage.getRoom(req.params.id as string);
      if (!room) return res.status(404).json({ error: "Room not found" });
      res.json(room);
    } catch (error) {
      console.error("Error fetching room:", error);
      res.status(500).json({ error: "Failed to fetch room" });
    }
  });

  app.get("/api/rooms/:id/messages", isAuthenticated, async (req, res) => {
    try {
      const msgs = await storage.getRoomMessages(req.params.id as string);
      res.json(msgs);
    } catch (error) {
      console.error("Error fetching room messages:", error);
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  app.post("/api/rooms/:id/messages", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Not authenticated" });
      const userProfile = await storage.getProfileByUserId(userId);
      if (!userProfile) return res.status(403).json({ error: "Profile not found" });

      const { content } = req.body;
      if (!content?.trim()) return res.status(400).json({ error: "Message content required" });

      const message = await storage.createRoomMessage({
        roomId: req.params.id,
        senderId: userProfile.id,
        senderName: userProfile.name,
        senderImage: userProfile.imageUrl || undefined,
        content: content.trim(),
      });
      res.status(201).json(message);
    } catch (error) {
      console.error("Error sending room message:", error);
      res.status(500).json({ error: "Failed to send message" });
    }
  });

  app.delete("/api/rooms/:id/messages/:msgId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Not authenticated" });
      const userProfile = await storage.getProfileByUserId(userId);
      if (!userProfile) return res.status(403).json({ error: "Profile not found" });
      const [msg] = await db.select().from(roomMessages).where(eq(roomMessages.id, req.params.msgId));
      if (!msg) return res.status(404).json({ error: "Messaggio non trovato" });
      if (msg.senderId !== userProfile.id) return res.status(403).json({ error: "Non puoi cancellare messaggi altrui" });
      await db.delete(roomMessages).where(eq(roomMessages.id, req.params.msgId));
      res.json({ ok: true });
    } catch (error) {
      console.error("Error deleting room message:", error);
      res.status(500).json({ error: "Failed to delete message" });
    }
  });

  app.post("/api/rooms/:id/join", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Not authenticated" });
      const userProfile = await storage.getProfileByUserId(userId);
      if (!userProfile) return res.status(403).json({ error: "Profile not found" });

      await storage.joinRoom(req.params.id, userProfile.id);
      // VibraDNA: traccia partecipazione a stanze (fire-and-forget)
      storage.trackDnaEvent(userProfile.id, 'room_join', 1).catch(() => {});
      storage.trackQuestProgress(userProfile.id, 'room_visit').catch(() => {});
      storage.trackRoomOrbit(userProfile.id, req.params.id).catch(() => {});
      res.json({ success: true });
    } catch (error) {
      console.error("Error joining room:", error);
      res.status(500).json({ error: "Failed to join room" });
    }
  });

  app.get("/api/challenges/leaderboard", async (_req, res) => {
    try {
      const rows = await db
        .select({
          profileId: challengeSubmissions.profileId,
          totalPoints: sql<number>`COALESCE(SUM(${dailyChallenges.points}), 0)`.as("total_points"),
          submissionCount: sql<number>`COUNT(${challengeSubmissions.id})`.as("submission_count"),
        })
        .from(challengeSubmissions)
        .innerJoin(dailyChallenges, eq(challengeSubmissions.challengeId, dailyChallenges.id))
        .where(eq(challengeSubmissions.status, "approved"))
        .groupBy(challengeSubmissions.profileId)
        .orderBy(sql`total_points DESC`)
        .limit(10);

      const leaderboard = await Promise.all(
        rows.map(async (row) => {
          const profile = await storage.getProfile(row.profileId);
          return {
            profileId: row.profileId,
            name: profile?.name || "Unknown",
            imageUrl: profile?.imageUrl || "",
            totalPoints: Number(row.totalPoints),
            submissionCount: Number(row.submissionCount),
          };
        })
      );

      res.json(leaderboard);
    } catch (error) {
      console.error("Error fetching leaderboard:", error);
      res.status(500).json({ error: "Failed to fetch leaderboard" });
    }
  });

  // Daily Challenges API
  app.get("/api/challenges", isAuthenticated, async (req, res) => {
    try {
      const challenges = await storage.getChallenges();
      res.json(challenges);
    } catch (error) {
      console.error("Error fetching challenges:", error);
      res.status(500).json({ error: "Failed to fetch challenges" });
    }
  });

  // Challenge Submission API
  app.post("/api/challenges/:id/submit", isAuthenticated, (req: any, res: any, next: any) => {
    memoryUpload.single("photo")(req, res, (err: any) => {
      if (err) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(400).json({ error: "File troppo grande. Massimo 5 MB." });
        }
        return res.status(400).json({ error: err.message || "Errore nel caricamento del file" });
      }
      next();
    });
  }, async (req: any, res: any) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Not authenticated" });

      const userProfile = await storage.getProfileByUserId(userId);
      if (!userProfile) return res.status(403).json({ error: "Profile not found" });

      if (!req.file) return res.status(400).json({ error: "No photo uploaded" });

      const allChallenges = await storage.getChallenges();
      const challenge = allChallenges.find(c => c.id === req.params.id);
      if (!challenge) return res.status(404).json({ error: "Sfida non trovata" });

      let aiApproved = true;
      let aiReason = "";
      try {
        const base64Image = req.file.buffer.toString("base64");
        const mimeType = req.file.mimetype || "image/jpeg";
        const aiResponse = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          max_completion_tokens: 300,
          messages: [
            {
              role: "system",
              content: `Sei un moderatore di una app di incontri. Devi verificare se una foto caricata da un utente è attinente al tema di una sfida giornaliera. Rispondi SOLO con un JSON: {"approved": true/false, "reason": "motivo breve in italiano"}.

REGOLE:
- Approva la foto se mostra qualcosa anche vagamente collegato al tema della sfida — sii GENEROSO e permissivo
- Le foto scattate con il telefono possono sembrare professionali: NON rifiutare una foto solo perché sembra di qualità alta
- Rifiuta SOLO se la foto è completamente irrilevante alla sfida (es. foto di un paesaggio per una sfida di cucina), oppure contiene contenuti offensivi, nudità esplicita o violenza
- NON rifiutare selfie, foto di cibo, animali, outfit, o qualsiasi foto ragionevole che un utente potrebbe scattare col telefono
- In caso di dubbio, APPROVA sempre`
            },
            {
              role: "user",
              content: [
                { type: "text", text: `La sfida è: "${challenge.title}" - "${challenge.description}". Questa foto è attinente al tema della sfida?` },
                { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64Image}` } }
              ]
            }
          ]
        });
        const aiText = aiResponse.choices[0]?.message?.content || "";
        const jsonMatch = aiText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          aiApproved = parsed.approved !== false;
          aiReason = parsed.reason || "";
        }
      } catch (aiErr: any) {
        console.error("AI verification failed, defaulting to approved:", aiErr?.message);
      }

      if (!aiApproved) {
        return res.status(400).json({
          error: `Foto non approvata: ${aiReason || "La foto non sembra attinente al tema della sfida. Prova con un'altra foto."}`,
          aiRejected: true
        });
      }

      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);

      const putResponse = await fetch(uploadURL, {
        method: "PUT",
        body: req.file.buffer,
        headers: { "Content-Type": req.file.mimetype },
      });

      if (!putResponse.ok) {
        console.error("Challenge storage PUT failed:", putResponse.status, await putResponse.text().catch(() => ""));
        return res.status(500).json({ error: "Errore nel salvataggio della foto. Riprova." });
      }

      await objectStorageService.trySetObjectEntityAclPolicy(objectPath, {
        owner: userId,
        visibility: "public",
      });

      const submission = await storage.createChallengeSubmission({
        challengeId: req.params.id,
        profileId: userProfile.id,
        imageUrl: objectPath,
      });
      // VibraDNA: traccia completamento sfida (fire-and-forget)
      storage.trackDnaEvent(userProfile.id, 'challenge_complete', 1).catch(() => {});

      console.log(`Challenge submission created: challengeId=${req.params.id} profileId=${userProfile.id} imageUrl=${objectPath} submissionId=${submission.id}`);
      res.status(201).json({ ...submission, status: "pending", message: "Foto caricata! In attesa di approvazione dall'admin." });
    } catch (error: any) {
      console.error("Error submitting challenge:", error?.message || error, error?.stack);
      res.status(500).json({ error: "Errore nel caricamento della foto. Riprova." });
    }
  });

  app.delete("/api/challenges/submissions/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Not authenticated" });
      const userProfile = await storage.getProfileByUserId(userId);
      if (!userProfile) return res.status(403).json({ error: "Profile not found" });
      const [sub] = await db.select().from(challengeSubmissions).where(eq(challengeSubmissions.id, req.params.id));
      if (!sub) return res.status(404).json({ error: "Submission non trovata" });
      if (sub.profileId !== userProfile.id) return res.status(403).json({ error: "Non autorizzato" });
      if (sub.status === "approved") return res.status(400).json({ error: "Non puoi eliminare una submission già approvata" });
      if (sub.imageUrl) {
        try { await objectStorageService.deleteObject(sub.imageUrl); } catch {}
      }
      await storage.deleteChallengeSubmission(sub.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting user submission:", error);
      res.status(500).json({ error: "Errore nell'eliminazione" });
    }
  });

  app.get("/api/challenges/submissions/me", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Not authenticated" });

      const userProfile = await storage.getProfileByUserId(userId);
      if (!userProfile) return res.json([]);

      const submissions = await storage.getChallengeSubmissions(userProfile.id);
      res.json(submissions);
    } catch (error) {
      console.error("Error fetching submissions:", error);
      res.status(500).json({ error: "Failed to fetch submissions" });
    }
  });

  // Private Rooms API

  app.get("/api/private-rooms/by-owner/:profileId", isAuthenticated, async (req: any, res) => {
    try {
      const room = await storage.getPrivateRoomByOwner(req.params.profileId);
      res.json(room || null);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch room" });
    }
  });

  app.get("/api/private-rooms/owners", isAuthenticated, async (req: any, res) => {
    try {
      const profileIds = (req.query.profileIds as string || "").split(",").filter(Boolean);
      if (!profileIds.length) return res.json({});
      const result: Record<string, boolean> = {};
      for (const pid of profileIds) {
        const room = await storage.getPrivateRoomByOwner(pid);
        result[pid] = !!room;
      }
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to check rooms" });
    }
  });

  app.get("/api/private-rooms", isAuthenticated, async (req, res) => {
    try {
      const rooms = await storage.getPrivateRooms();
      res.json(rooms);
    } catch (error) {
      console.error("Error fetching private rooms:", error);
      res.status(500).json({ error: "Failed to fetch private rooms" });
    }
  });

  app.get("/api/private-rooms/categorized", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Not authenticated" });
      const userProfile = await storage.getProfileByUserId(userId);
      if (!userProfile) return res.status(400).json({ error: "Profile required" });

      const allRooms = await storage.getPrivateRooms();
      const userMatches = await storage.getMatchesForUser(userProfile.id);
      const matchProfileIds = new Set(userMatches.map(m => m.profile.id));

      const myRooms = allRooms.filter(r => r.ownerId === userProfile.id);
      const matchRooms = allRooms.filter(r => matchProfileIds.has(r.ownerId) && r.ownerId !== userProfile.id);

      const memberCounts: Record<string, number> = {};
      for (const room of allRooms) {
        const members = await storage.getPrivateRoomMembers(room.id);
        memberCounts[room.id] = members.length;
      }

      const popularRooms = allRooms
        .filter(r => r.ownerId !== userProfile.id && !matchProfileIds.has(r.ownerId))
        .sort((a, b) => (memberCounts[b.id] || 0) - (memberCounts[a.id] || 0))
        .slice(0, 10);

      const ownerProfiles: Record<string, { name: string; imageUrl: string | null }> = {};
      for (const room of allRooms) {
        const owner = await storage.getProfile(room.ownerId);
        if (owner) {
          ownerProfiles[room.ownerId] = { name: owner.name, imageUrl: owner.imageUrl };
        }
      }

      const pendingCounts: Record<string, number> = {};
      const recentRequesters: Record<string, Array<{ name: string; imageUrl: string | null }>> = {};
      for (const room of allRooms) {
        const requests = await storage.getPrivateRoomRequests(room.id);
        const pending = requests.filter(r => r.status === "pending");
        pendingCounts[room.id] = pending.length;
        const approved = requests.filter(r => r.status === "approved");
        const recentMembers: Array<{ name: string; imageUrl: string | null; status: string }> = [];
        for (const req of approved.slice(0, 5)) {
          const profile = await storage.getProfile(req.requesterId);
          if (profile) {
            recentMembers.push({ name: profile.name, imageUrl: profile.imageUrl, status: "approved" });
          }
        }
        for (const req of pending.slice(0, 3)) {
          const profile = await storage.getProfile(req.requesterId);
          if (profile) {
            recentMembers.push({ name: profile.name, imageUrl: profile.imageUrl, status: "pending" });
          }
        }
        recentRequesters[room.id] = recentMembers;
      }

      res.json({
        myRooms,
        matchRooms,
        popularRooms,
        memberCounts,
        ownerProfiles,
        pendingCounts,
        recentRequesters,
      });
    } catch (error) {
      console.error("Error fetching categorized rooms:", error);
      res.status(500).json({ error: "Failed to fetch categorized rooms" });
    }
  });

  app.get("/api/private-rooms/pending-count", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Not authenticated" });
      const userProfile = await storage.getProfileByUserId(userId);
      if (!userProfile) return res.json({ count: 0 });
      const allRooms = await storage.getPrivateRooms();
      const myRooms = allRooms.filter(r => r.ownerId === userProfile.id);
      if (myRooms.length === 0) return res.json({ count: 0 });
      let totalPending = 0;
      for (const room of myRooms) {
        const requests = await storage.getPrivateRoomRequests(room.id);
        totalPending += requests.filter(r => r.status === "pending").length;
      }
      res.json({ count: totalPending });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch pending count" });
    }
  });

  app.get("/api/private-rooms/:id", isAuthenticated, async (req: any, res) => {
    try {
      const room = await storage.getPrivateRoom(req.params.id as string);
      if (!room) return res.status(404).json({ error: "Room not found" });
      res.json(room);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch room" });
    }
  });

  app.post("/api/private-rooms", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Not authenticated" });
      const userProfile = await storage.getProfileByUserId(userId);
      if (!userProfile) {
        console.error("Private room create: no profile for userId", userId);
        return res.status(400).json({ error: "Profile required" });
      }
      const currentPoints = userProfile.points ?? 0;
      const requiredPoints = 45;
      if (currentPoints < requiredPoints) {
        return res.status(403).json({
          error: `Servono almeno ${requiredPoints} punti per creare una stanza privata. Hai ${currentPoints} punti.`,
          requiredPoints,
          currentPoints,
        });
      }
      const { name, description, imageUrl } = req.body;
      if (!name) return res.status(400).json({ error: "Room name is required" });
      const room = await storage.createPrivateRoom({
        ownerId: userProfile.id,
        name,
        description,
        imageUrl: imageUrl || userProfile.imageUrl || null,
      });
      await storage.updateProfile(userProfile.id, { points: currentPoints - requiredPoints });
      res.json(room);
    } catch (error) {
      console.error("Error creating private room:", error);
      res.status(500).json({ error: "Failed to create room" });
    }
  });

  app.post("/api/private-rooms/:id/request", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Not authenticated" });
      const userProfile = await storage.getProfileByUserId(userId);
      if (!userProfile) return res.status(400).json({ error: "Profile required" });
      const room = await storage.getPrivateRoom(req.params.id);
      if (!room) return res.status(404).json({ error: "Room not found" });
      if (room.ownerId === userProfile.id) return res.status(400).json({ error: "You own this room" });
      const request = await storage.requestPrivateRoomAccess(req.params.id, userProfile.id);
      res.json(request);
    } catch (error) {
      console.error("Error requesting access:", error);
      res.status(500).json({ error: "Failed to request access" });
    }
  });

  app.get("/api/private-rooms/:id/requests", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Not authenticated" });
      const userProfile = await storage.getProfileByUserId(userId);
      if (!userProfile) return res.status(400).json({ error: "Profile required" });
      const room = await storage.getPrivateRoom(req.params.id);
      if (!room) return res.status(404).json({ error: "Room not found" });
      if (room.ownerId !== userProfile.id) return res.status(403).json({ error: "Only owner can view requests" });
      const requests = await storage.getPrivateRoomRequests(req.params.id);
      res.json(requests);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch requests" });
    }
  });

  app.get("/api/private-rooms/:id/my-request", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Not authenticated" });
      const userProfile = await storage.getProfileByUserId(userId);
      if (!userProfile) return res.json(null);
      const request = await storage.getMyPrivateRoomRequest(req.params.id, userProfile.id);
      res.json(request || null);
    } catch (error) {
      res.status(500).json({ error: "Failed to check request status" });
    }
  });

  app.post("/api/private-rooms/requests/:requestId/respond", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Not authenticated" });
      const userProfile = await storage.getProfileByUserId(userId);
      if (!userProfile) return res.status(400).json({ error: "Profile required" });
      const { status } = req.body;
      if (!["approved", "rejected"].includes(status)) return res.status(400).json({ error: "Invalid status" });
      const result = await storage.respondToPrivateRoomRequest(req.params.requestId, status);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to respond to request" });
    }
  });

  app.get("/api/private-rooms/:id/members", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Not authenticated" });
      const userProfile = await storage.getProfileByUserId(userId);
      if (!userProfile) return res.status(400).json({ error: "Profile required" });
      const isMember = await storage.isPrivateRoomMember(req.params.id, userProfile.id);
      if (!isMember) return res.json([]);
      const members = await storage.getPrivateRoomMembers(req.params.id);
      res.json(members);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch members" });
    }
  });

  app.get("/api/private-rooms/:id/messages", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Not authenticated" });
      const userProfile = await storage.getProfileByUserId(userId);
      if (!userProfile) return res.status(400).json({ error: "Profile required" });
      const isMember = await storage.isPrivateRoomMember(req.params.id, userProfile.id);
      if (!isMember) return res.status(403).json({ error: "Not a member of this room" });
      const messages = await storage.getPrivateRoomMessages(req.params.id);
      res.json(messages);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  app.post("/api/private-rooms/:id/messages", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Not authenticated" });
      const userProfile = await storage.getProfileByUserId(userId);
      if (!userProfile) return res.status(400).json({ error: "Profile required" });
      const isMember = await storage.isPrivateRoomMember(req.params.id, userProfile.id);
      if (!isMember) return res.status(403).json({ error: "Not a member of this room" });
      const { content } = req.body;
      if (!content?.trim()) return res.status(400).json({ error: "Message content required" });
      const message = await storage.createPrivateRoomMessage({
        roomId: req.params.id,
        senderId: userProfile.id,
        senderName: userProfile.name,
        senderImage: userProfile.imageUrl || undefined,
        content: content.trim(),
      });
      res.json(message);

      // Bot auto-reply in private room: find bot member and reply with a natural delay
      try {
        const roomMembers = await storage.getPrivateRoomMembers(req.params.id);
        const botMember = roomMembers.find((m: any) =>
          m.id !== userProfile.id && shouldAutoReplyToDirectMessage(m)
        );
        if (botMember) {
          const prMessages = await storage.getPrivateRoomMessages(req.params.id);
          const chatHistory = prMessages.map((m: any) => ({ senderId: m.senderId, content: m.content }));
          const delayMs = 3000 + Math.random() * 7000; // 3–10 seconds
          setTimeout(async () => {
            try {
              const botReplyText = await generateBotReply(botMember, userProfile, chatHistory);
              await storage.createPrivateRoomMessage({
                roomId: req.params.id,
                senderId: botMember.id,
                senderName: botMember.name,
                senderImage: botMember.imageUrl || undefined,
                content: botReplyText,
              });
            } catch (botErr) {
              console.error("[BOT] Private room auto-reply error:", botErr);
            }
          }, delayMs);
        }
      } catch (botCheckErr) {
        console.error("[BOT] Private room member check error:", botCheckErr);
      }
    } catch (error) {
      console.error("Error sending private room message:", error);
      res.status(500).json({ error: "Failed to send message" });
    }
  });

  // Virtual Gifts API
  app.get("/api/gifts", isAuthenticated, async (req, res) => {
    try {
      const gifts = await storage.getVirtualGifts();
      res.json(gifts);
    } catch (error) {
      console.error("Error fetching gifts:", error);
      res.status(500).json({ error: "Failed to fetch gifts" });
    }
  });

  app.get("/api/gifts/received", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Not authenticated" });
      const userProfile = await storage.getProfileByUserId(userId);
      if (!userProfile) return res.json([]);
      const gifts = await storage.getReceivedGifts(userProfile.id);
      res.json(gifts);
    } catch (error) {
      console.error("Error fetching received gifts:", error);
      res.status(500).json({ error: "Failed to fetch received gifts" });
    }
  });

  app.get("/api/gifts/sent", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Not authenticated" });
      const userProfile = await storage.getProfileByUserId(userId);
      if (!userProfile) return res.json([]);
      const gifts = await storage.getSentGifts(userProfile.id);
      res.json(gifts);
    } catch (error) {
      console.error("Error fetching sent gifts:", error);
      res.status(500).json({ error: "Failed to fetch sent gifts" });
    }
  });

  app.post("/api/gifts/send", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Not authenticated" });
      const userProfile = await storage.getProfileByUserId(userId);
      if (!userProfile) return res.status(403).json({ error: "Profile not found" });

      const { giftId, receiverId, message } = req.body;
      if (!giftId || !receiverId) return res.status(400).json({ error: "Missing giftId or receiverId" });

      const receiverProfile = await storage.getProfile(receiverId);
      if (!receiverProfile) return res.status(404).json({ error: "Receiver not found" });

      if (receiverId === userProfile.id) return res.status(400).json({ error: "Cannot send gift to yourself" });

      const gift = await storage.getVirtualGift(giftId);
      if (!gift) return res.status(404).json({ error: "Gift not found" });

      const currentPoints = userProfile.points ?? 0;
      if (currentPoints < gift.cost) {
        return res.status(400).json({ error: "Punti insufficienti", required: gift.cost, available: currentPoints });
      }

      await storage.deductPoints(userProfile.id, gift.cost);
      const sentGift = await storage.sendGift({
        giftId,
        senderId: userProfile.id,
        receiverId,
        message,
      });
      storage.trackQuestProgress(userProfile.id, 'gift_send').catch(() => {});

      res.status(201).json(sentGift);
    } catch (error) {
      console.error("Error sending gift:", error);
      res.status(500).json({ error: "Failed to send gift" });
    }
  });

  app.patch("/api/gifts/:id/seen", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Not authenticated" });
      const userProfile = await storage.getProfileByUserId(userId);
      if (!userProfile) return res.status(403).json({ error: "Profile not found" });

      const receivedGifts = await storage.getReceivedGifts(userProfile.id);
      const gift = receivedGifts.find(g => g.id === req.params.id);
      if (!gift) return res.status(403).json({ error: "Not your gift" });

      await storage.markGiftSeen(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking gift seen:", error);
      res.status(500).json({ error: "Failed to mark gift seen" });
    }
  });

  app.get("/api/points/me", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Not authenticated" });
      const userProfile = await storage.getProfileByUserId(userId);
      if (!userProfile) return res.json({ points: 0 });
      res.json({ points: userProfile.points ?? 0 });
    } catch (error) {
      console.error("Error fetching points:", error);
      res.status(500).json({ error: "Failed to fetch points" });
    }
  });

  // Prima Impressione - Profile Ratings
  app.post("/api/ratings", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Not authenticated" });
      const raterProfile = await storage.getProfileByUserId(userId);
      if (!raterProfile) return res.status(400).json({ error: "Profile required" });

      const { ratedId, rating } = req.body;
      if (!ratedId || !rating || rating < 1 || rating > 5) {
        return res.status(400).json({ error: "Invalid rating data" });
      }

      if (raterProfile.id === ratedId) {
        return res.status(400).json({ error: "Cannot rate yourself" });
      }

      const ratedProfile = await storage.getProfile(ratedId);
      if (!ratedProfile || !ratedProfile.ratingEnabled) {
        return res.status(400).json({ error: "This profile does not accept ratings" });
      }

      const existing = await storage.getExistingRating(raterProfile.id, ratedId);
      if (existing) {
        return res.status(400).json({ error: "Already rated this profile" });
      }

      const created = await storage.createProfileRating({
        raterId: raterProfile.id,
        ratedId,
        rating,
      });
      res.json(created);
    } catch (error) {
      console.error("Error creating rating:", error);
      res.status(500).json({ error: "Failed to create rating" });
    }
  });

  app.get("/api/ratings/received", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Not authenticated" });
      const profile = await storage.getProfileByUserId(userId);
      if (!profile) return res.json([]);
      const ratings = await storage.getReceivedRatings(profile.id);
      res.json(ratings);
    } catch (error) {
      console.error("Error fetching ratings:", error);
      res.status(500).json({ error: "Failed to fetch ratings" });
    }
  });

  app.get("/api/ratings/for-match/:matchId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Not authenticated" });
      const profile = await storage.getProfileByUserId(userId);
      if (!profile) return res.json({ rating: null });

      const match = await storage.getMatchById(req.params.matchId);
      if (!match) return res.json({ rating: null });

      if (match.profile1Id !== profile.id && match.profile2Id !== profile.id) {
        return res.status(403).json({ error: "Not authorized" });
      }

      const otherProfileId = match.profile1Id === profile.id ? match.profile2Id : match.profile1Id;
      const rating = await storage.getRatingBetweenProfiles(profile.id, otherProfileId);
      res.json({ rating: rating || null });
    } catch (error) {
      res.status(500).json({ error: "Failed to check rating" });
    }
  });

  app.post("/api/ratings/:id/reply", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Not authenticated" });
      const profile = await storage.getProfileByUserId(userId);
      if (!profile) return res.status(400).json({ error: "Profile required" });

      const ratingId = req.params.id;
      const { reply } = req.body;
      if (!reply || !reply.trim()) {
        return res.status(400).json({ error: "Reply message required" });
      }

      const rating = await storage.getProfileRating(ratingId);
      if (!rating) return res.status(404).json({ error: "Rating not found" });
      if (rating.ratedId !== profile.id) return res.status(403).json({ error: "Not authorized" });
      if (rating.ratedReply) return res.status(400).json({ error: "Already replied" });

      const updated = await storage.replyToRating(ratingId, reply.trim());

      const existingMatch = await storage.getMatch(profile.id, rating.raterId);
      let matchData = existingMatch;
      if (!existingMatch) {
        matchData = await storage.createMatch({
          profile1Id: rating.raterId,
          profile2Id: profile.id,
        });
        await storage.markRatingMatchCreated(ratingId);
      }

      if (matchData) {
        await storage.createMessage({
          matchId: matchData.id,
          senderId: profile.id,
          content: reply.trim(),
        });
      }

      res.json({ rating: updated, match: matchData });
    } catch (error) {
      console.error("Error replying to rating:", error);
      res.status(500).json({ error: "Failed to reply to rating" });
    }
  });

  app.get("/api/ratings/count", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Not authenticated" });
      const profile = await storage.getProfileByUserId(userId);
      if (!profile) return res.json({ count: 0 });
      const ratings = await storage.getReceivedRatings(profile.id);
      const unreplied = ratings.filter(r => !r.ratedReply).length;
      res.json({ count: unreplied });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch count" });
    }
  });

  // ==================== VIBING SESSIONS ====================

  app.post("/api/vibe/activate", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Not authenticated" });
      const profile = await storage.getProfileByUserId(userId);
      if (!profile) return res.status(404).json({ error: "Profile not found" });

      const { latitude, longitude, radiusKm } = req.body;
      if (typeof latitude !== "number" || typeof longitude !== "number") {
        return res.status(400).json({ error: "Latitude and longitude required" });
      }
      const radius = Math.min(Math.max(radiusKm || 5, 1), 10);

      const session = await storage.activateVibing({
        profileId: profile.id,
        latitude,
        longitude,
        radiusKm: radius,
      });
      res.json(session);
    } catch (error) {
      res.status(500).json({ error: "Failed to activate vibing" });
    }
  });

  app.post("/api/vibe/deactivate", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Not authenticated" });
      const profile = await storage.getProfileByUserId(userId);
      if (!profile) return res.status(404).json({ error: "Profile not found" });

      await storage.deactivateVibing(profile.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to deactivate vibing" });
    }
  });

  app.get("/api/vibe/status", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Not authenticated" });
      const profile = await storage.getProfileByUserId(userId);
      if (!profile) return res.json({ active: false });

      const session = await storage.getActiveVibingSession(profile.id);
      if (!session) return res.json({ active: false });

      res.json({
        active: true,
        session,
        remainingMs: Math.max(0, new Date(session.expiresAt).getTime() - Date.now()),
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to get vibing status" });
    }
  });

  app.get("/api/vibe/nearby", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Not authenticated" });
      const profile = await storage.getProfileByUserId(userId);
      if (!profile) return res.status(404).json({ error: "Profile not found" });

      const session = await storage.getActiveVibingSession(profile.id);
      if (!session) return res.json([]);

      const nearby = await storage.getNearbyVibers(
        session.latitude,
        session.longitude,
        session.radiusKm,
        profile.id
      );
      res.json(nearby);
    } catch (error) {
      res.status(500).json({ error: "Failed to get nearby vibers" });
    }
  });

  app.get("/api/vibe/count", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Not authenticated" });
      const profile = await storage.getProfileByUserId(userId);
      if (!profile) return res.json({ count: 0 });

      const session = await storage.getActiveVibingSession(profile.id);
      if (!session) return res.json({ count: 0 });

      const nearby = await storage.getNearbyVibers(session.latitude, session.longitude, session.radiusKm, profile.id);
      res.json({ count: nearby.length });
    } catch (error) {
      res.json({ count: 0 });
    }
  });

  // === BLOCKED USERS ===
  app.post("/api/block", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Not authenticated" });
      const profile = await storage.getProfileByUserId(userId);
      if (!profile) return res.status(404).json({ error: "Profile not found" });

      const { blockedId } = req.body;
      if (!blockedId) return res.status(400).json({ error: "blockedId required" });
      if (blockedId === profile.id) return res.status(400).json({ error: "Cannot block yourself" });

      const outgoingBlocks = await storage.getBlockedUsers(profile.id);
      const wasAlreadyBlocked = outgoingBlocks.some((entry) => entry.blockedId === blockedId);
      const block = await storage.blockUser(profile.id, blockedId);
      if (!wasAlreadyBlocked) {
        try {
          const [existingBlockReport] = await db.select({ id: reports.id })
            .from(reports)
            .where(and(
              eq(reports.reporterId, profile.id),
              eq(reports.reportedId, blockedId),
              eq(reports.status, "pending"),
              gt(reports.createdAt, new Date(Date.now() - 24 * 60 * 60 * 1000)),
            ))
            .limit(1);
          if (!existingBlockReport) {
            const report = await storage.createReport({
              reporterId: profile.id,
              reportedId: blockedId,
              reason: "Blocco utente",
              description: "Segnalazione automatica: l'utente è stato bloccato e richiede una verifica di moderazione.",
            });
            void notifyAdminsOfNewUserReport(report.id);
          }
        } catch (reportError) {
          console.error("[ugc-moderation] User was blocked, but the moderation report could not be created:", reportError);
        }
      }
      res.json(block);
    } catch (error) {
      res.status(500).json({ error: "Failed to block user" });
    }
  });

  app.delete("/api/block/:blockedId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Not authenticated" });
      const profile = await storage.getProfileByUserId(userId);
      if (!profile) return res.status(404).json({ error: "Profile not found" });

      await storage.unblockUser(profile.id, req.params.blockedId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to unblock user" });
    }
  });

  app.get("/api/blocked", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Not authenticated" });
      const profile = await storage.getProfileByUserId(userId);
      if (!profile) return res.json([]);

      const blocked = await storage.getBlockedUsers(profile.id);
      const blockedProfiles = [];
      for (const b of blocked) {
        const p = await storage.getProfile(b.blockedId);
        if (p) blockedProfiles.push({ ...b, profile: p });
      }
      res.json(blockedProfiles);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch blocked users" });
    }
  });

  // === LOCATION SHARING ("Mostra dove sei") ===
  app.post("/api/location/share", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Not authenticated" });
      const profile = await storage.getProfileByUserId(userId);
      if (!profile) return res.status(404).json({ error: "Profile not found" });
      if (!profile.locationSharingEnabled) return res.status(403).json({ error: "Location sharing not enabled in profile" });

      const { latitude, longitude } = req.body;
      if (latitude == null || longitude == null) return res.status(400).json({ error: "latitude and longitude required" });

      const share = await storage.updateLocationShare(profile.id, latitude, longitude);
      res.json(share);
    } catch (error) {
      res.status(500).json({ error: "Failed to share location" });
    }
  });

  app.post("/api/location/stop", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Not authenticated" });
      const profile = await storage.getProfileByUserId(userId);
      if (!profile) return res.status(404).json({ error: "Profile not found" });

      await storage.deactivateLocationShare(profile.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to stop sharing" });
    }
  });

  app.get("/api/location/status", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Not authenticated" });
      const profile = await storage.getProfileByUserId(userId);
      if (!profile) return res.json({ sharing: false });

      const share = await storage.getLocationShare(profile.id);
      res.json({ sharing: !!share, share: share || null });
    } catch (error) {
      res.status(500).json({ error: "Failed to get location status" });
    }
  });

  app.get("/api/location/matches", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Not authenticated" });
      const profile = await storage.getProfileByUserId(userId);
      if (!profile) return res.json([]);
      if (!profile.locationSharingEnabled) return res.json([]);

      const myShare = await storage.getLocationShare(profile.id);
      if (!myShare) return res.json([]);

      const blockedIds = await storage.getBlockedIds(profile.id);
      const matchShares = await storage.getMatchLocationShares(profile.id);
      const filtered = matchShares.filter(s => !blockedIds.includes(s.profileId));
      res.json(filtered);
    } catch (error) {
      res.status(500).json({ error: "Failed to get match locations" });
    }
  });

  // === GDPR DATA EXPORT ===
  app.get("/api/gdpr/export", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Not authenticated" });
      const user = await storage.getUser(userId);
      const profile = await storage.getProfileByUserId(userId);
      
      const exportData: any = {
        exportDate: new Date().toISOString(),
        account: user ? { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, createdAt: user.createdAt } : null,
        profile: profile || null,
      };

      if (profile) {
        const userMatches = await storage.getMatchesForUser(profile.id);
        exportData.matches = userMatches.map(m => ({ id: m.id, matchedWith: m.profile.name, createdAt: m.createdAt }));
        
        const allMessages: any[] = [];
        for (const m of userMatches) {
          const msgs = await storage.getMessagesForMatch(m.id);
          allMessages.push(...msgs.filter(msg => msg.senderId === profile.id).map(msg => ({ matchId: m.id, content: msg.content, createdAt: msg.createdAt })));
        }
        exportData.messagesSent = allMessages;
        
        const blocked = await storage.getBlockedUsers(profile.id);
        exportData.blockedUsers = blocked;
        
        const swipedIds = await storage.getSwipedProfileIds(profile.id);
        exportData.swipeCount = swipedIds.length;
      }

      res.setHeader("Content-Type", "application/json");
      res.setHeader("Content-Disposition", "attachment; filename=vibra-data-export.json");
      res.json(exportData);
    } catch (error) {
      console.error("Error exporting GDPR data:", error);
      res.status(500).json({ error: "Failed to export data" });
    }
  });

  setInterval(async () => {
    try {
      const now = new Date();
      const expiredRooms = await db.select().from(privateRooms).where(eq(privateRooms.isActive, true));
      for (const room of expiredRooms) {
        if (room.expiresAt && new Date(room.expiresAt) <= now) {
          await db.delete(privateRoomMessages).where(eq(privateRoomMessages.roomId, room.id));
          await db.delete(privateRoomRequests).where(eq(privateRoomRequests.roomId, room.id));
          await db.delete(privateRooms).where(eq(privateRooms.id, room.id));
          console.log(`Expired private room "${room.name}" (${room.id}) deleted.`);
        }
      }
    } catch (error) {
      console.error("Error cleaning up expired private rooms:", error);
    }
    try {
      const now = new Date();
      const activeChallenges = await db.select().from(dailyChallenges).where(eq(dailyChallenges.isActive, true));
      for (const challenge of activeChallenges) {
        if (challenge.expiresAt && new Date(challenge.expiresAt) <= now) {
          const subs = await db.select().from(challengeSubmissions).where(eq(challengeSubmissions.challengeId, challenge.id));
          for (const sub of subs) {
            if (sub.imageUrl) {
              await objectStorageService.deleteObject(sub.imageUrl);
              console.log(`Deleted challenge photo from storage: ${sub.imageUrl}`);
            }
          }
          await db.delete(challengeSubmissions).where(eq(challengeSubmissions.challengeId, challenge.id));
          await db.delete(dailyChallenges).where(eq(dailyChallenges.id, challenge.id));
          console.log(`Expired challenge "${challenge.title}" (${challenge.id}) and its submissions deleted.`);
        }
      }
    } catch (error) {
      console.error("Error cleaning up expired challenges:", error);
    }
  }, 5 * 60 * 1000);

  app.get("/api/activity/vibration", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const userProfile = await storage.getProfileByUserId(userId);
      if (!userProfile) return res.json(null);

      const now = Date.now();
      const hourBlock = Math.floor(now / 3600000);
      const minuteJitter = Math.floor(now / 300000);
      const profileSeed = (parseInt(userProfile.id, 36) || 1);
      const baseSeed = Math.abs(profileSeed * 2654435761 + hourBlock);
      const visitSeed = Math.abs(profileSeed * 1597334677 + minuteJitter);

      const vibrations = 2 + (baseSeed % 7) + (visitSeed % 3);
      const compatible = 1 + ((baseSeed * 3) % 4) + (visitSeed % 2);
      const shown = 8 + ((baseSeed * 7) % 15) + (visitSeed % 8);
      const newCompat = ((baseSeed * 11) % 3) + (visitSeed % 2);

      const realSwipes = await db.select({ count: sql<number>`count(*)` })
        .from(swipes)
        .where(and(eq(swipes.swipedId, userProfile.id), eq(swipes.liked, true)));
      const realLikes = Number(realSwipes[0]?.count || 0);

      res.json({
        vibrations: vibrations + Math.min(realLikes, 10),
        compatible,
        shown,
        newCompat: newCompat + (realLikes > 0 ? 1 : 0),
      });
    } catch (error) {
      console.error("Error fetching vibration data:", error);
      res.status(500).json({ error: "Failed to fetch vibration data" });
    }
  });

  app.get("/api/activity/feed", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const userProfile = await storage.getProfileByUserId(userId);
      if (!userProfile) return res.json({ onlineCount: 0, events: [] });

      const allProfiles = await storage.getAllProfiles();
      const botProfiles = allProfiles.filter(p => p.isBot && p.id !== userProfile.id);
      const activeRooms = await storage.getRooms();
      const activeRoomsList = activeRooms.filter(r => r.isActive);

      const now = Date.now();
      const vibingCount = await db.select({ count: sql<number>`count(*)` })
        .from(vibingSessions)
        .where(and(
          eq(vibingSessions.active, true),
          sql`${vibingSessions.expiresAt} > NOW()`
        ));
      const vibingNearby = Number(vibingCount[0]?.count || 0);

      const onlineBase = Math.min(botProfiles.length, 30);
      const timeVariation = Math.floor(Math.sin(now / 60000) * 5);
      const onlineCount = Math.max(8, onlineBase + timeVariation + vibingNearby);

      const events: any[] = [];
      const seed = Math.floor(now / 60000);

      const hashSort = (arr: typeof botProfiles) => [...arr].sort((a, b) => {
        const ha = ((parseInt(a.id, 36) || 0) * 2654435761 + seed) % 1000;
        const hb = ((parseInt(b.id, 36) || 0) * 2654435761 + seed) % 1000;
        return ha - hb;
      });

      const shuffled = hashSort(botProfiles);
      const prefGender = userProfile.preferredGender;
      const hasGenderPref = prefGender && prefGender !== "Tutti";
      const genderMatchBots = hasGenderPref
        ? hashSort(botProfiles.filter(p => p.gender === prefGender))
        : shuffled;

      if (shuffled[0]) {
        events.push({
          id: `visit-${seed}`,
          type: "profile_visit",
          profileName: shuffled[0].name,
          profileImage: shuffled[0].imageUrl,
        });
      }

      if (genderMatchBots[0]) {
        const bot = genderMatchBots[0];
        const shared = (userProfile.interests || []).filter(
          (i: string) => (bot.interests || []).includes(i)
        );
        events.push({
          id: `compat-${seed}`,
          type: "compatibility",
          profileName: bot.name,
          profileImage: bot.imageUrl,
          sharedCount: shared.length,
        });
      }

      if (shuffled[1]) {
        events.push({
          id: `interact-${seed}`,
          type: "interaction",
          profileName: shuffled[1].name,
          profileImage: shuffled[1].imageUrl,
        });
      }

      if (activeRoomsList.length > 0) {
        const room = activeRoomsList[seed % activeRoomsList.length];
        const memberCount = 3 + (seed % 6);
        events.push({
          id: `room-${seed}`,
          type: "room_active",
          roomName: room.name,
          count: memberCount,
        });
      }

      res.json({ onlineCount, events });
    } catch (error) {
      console.error("Error fetching activity feed:", error);
      res.status(500).json({ error: "Failed to fetch activity feed" });
    }
  });

  app.get("/api/activity/radar", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const userProfile = await storage.getProfileByUserId(userId);
      if (!userProfile) return res.json(null);

      const now = Date.now();
      const seed = Math.floor(now / 60000);
      const hourBlock = Math.floor(now / 3600000);

      const allProfiles = await storage.getAllProfiles();
      const botProfiles = allProfiles.filter(p => p.isBot && p.id !== userProfile.id);

      const vibingCount = await db.select({ count: sql<number>`count(*)` })
        .from(vibingSessions)
        .where(and(eq(vibingSessions.active, true), sql`${vibingSessions.expiresAt} > NOW()`));
      const vibingNearby = Number(vibingCount[0]?.count || 0);

      const onlineBase = Math.min(botProfiles.length, 30);
      const timeVariation = Math.floor(Math.sin(now / 60000) * 5);
      const soulsOnline = Math.max(8, onlineBase + timeVariation + vibingNearby);

      const realMatches = await db.select({ count: sql<number>`count(*)` }).from(matches);
      const totalMatches = Number(realMatches[0]?.count || 0);
      const cosmicConnections = Math.max(2, Math.min(totalMatches, 15) + (seed % 4));

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const profileSeed = (parseInt(userProfile.id, 36) || 1);
      const newAliens = 3 + (Math.abs(profileSeed * 7 + hourBlock) % 12);

      const shuffled = [...botProfiles].sort((a, b) => {
        const ha = ((parseInt(a.id, 36) || 0) * 2654435761 + seed) % 1000;
        const hb = ((parseInt(b.id, 36) || 0) * 2654435761 + seed) % 1000;
        return ha - hb;
      });

      const liveEvents: any[] = [];
      const cities = ["Milano", "Roma", "Madrid", "Barcelona", "Napoli", "Firenze", "Valencia", "Torino", "Palermo", "Siviglia"];

      for (let i = 0; i < Math.min(6, shuffled.length); i++) {
        const bot = shuffled[i];
        const city = bot.location || cities[(seed + i) % cities.length];
        const eventTypes = ["match", "join", "vibration", "superlike", "room"];
        const eType = eventTypes[(seed + i * 3) % eventTypes.length];
        liveEvents.push({
          id: `live-${seed}-${i}`,
          type: eType,
          name: bot.name,
          city: city,
          image: bot.imageUrl,
        });
      }

      res.json({
        soulsOnline,
        cosmicConnections,
        newAliens,
        liveEvents,
      });
    } catch (error) {
      console.error("Error fetching radar data:", error);
      res.status(500).json({ error: "Failed to fetch radar data" });
    }
  });

  // ===================== PUSH NOTIFICATIONS =====================

  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
      "mailto:admin@vibra.app",
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );
  }

  async function sendPushToProfile(targetProfileId: string, payload: { title: string; body: string; icon?: string; url?: string; type?: string }) {
    try {
      const subs = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.profileId, targetProfileId));
      for (const sub of subs) {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            JSON.stringify(payload)
          );
        } catch (err: any) {
          if (err.statusCode === 410 || err.statusCode === 404) {
            await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id));
          }
        }
      }
    } catch (err) {
      console.error("[push] sendPushToProfile error:", err);
    }
  }

  app.post("/api/push/subscribe", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      const profile = await storage.getProfileByUserId(userId);
      if (!profile) return res.status(404).json({ error: "Profile not found" });

      const { endpoint, keys } = req.body;
      if (!endpoint || !keys?.p256dh || !keys?.auth) {
        return res.status(400).json({ error: "Invalid subscription" });
      }

      // Remove any existing subscription with this endpoint (any profile) so one
      // device can only be linked to one profile at a time.
      await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));

      await db.insert(pushSubscriptions).values({
        profileId: profile.id,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
      });

      res.json({ success: true });
    } catch (err) {
      console.error("[push] subscribe error:", err);
      res.status(500).json({ error: "Failed to subscribe" });
    }
  });

  app.delete("/api/push/unsubscribe", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      const profile = await storage.getProfileByUserId(userId);
      if (!profile) return res.status(404).json({ error: "Profile not found" });

      const { endpoint } = req.body;
      if (endpoint) {
        await db.delete(pushSubscriptions).where(
          and(eq(pushSubscriptions.profileId, profile.id), eq(pushSubscriptions.endpoint, endpoint))
        );
      }
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to unsubscribe" });
    }
  });

  app.get("/api/push/vapid-key", (req, res) => {
    res.json({ publicKey: process.env.VAPID_PUBLIC_KEY || "" });
  });

  // ===================== VIBRAPP - Global Chat with Socket.io =====================

  const io = new SocketIOServer(httpServer, {
    path: "/vibrapp-socket",
  });
  disconnectUserSockets = (profileId) => {
    io.in(`user:${profileId}`).disconnectSockets(true);
  };

  const sessionMiddleware = getSession();
  io.use((socket, next) => {
    const req = socket.request as any;
    const res = { end: () => {} } as any;
    sessionMiddleware(req, res, async () => {
      if (!req.session?.userId) {
        return next(new Error("Unauthorized"));
      }
      try {
        const suspension = await storage.getActiveSuspension(req.session.userId);
        if (suspension) return next(new Error("Account suspended"));
        return next();
      } catch (error) {
        console.error("[ugc-moderation] Could not verify socket account status:", error);
        return next(new Error("Unable to verify account status"));
      }
    });
  });

  const vibrappOnlineUsers = new Map<string, Set<string>>();
  const vibrappForegroundUsers = new Map<string, Set<string>>();
  const vibrappUserProfiles = new Map<string, { name: string; image: string | null }>();
  const vibrappTypingUsers = new Map<string, { name: string; timeout: NodeJS.Timeout }>();

  const MAX_MSG_LENGTH = 2000;
  const ALLOWED_REACTIONS = ["❤️", "😂", "😮", "😢", "🔥", "👍"];

  io.on("connection", async (socket) => {
    const userId = (socket.request as any).session?.userId;
    if (!userId) { socket.disconnect(); return; }

    let userProfile: any = null;
    try {
      userProfile = await storage.getProfileByUserId(userId);
    } catch {}
    if (!userProfile) { socket.disconnect(); return; }

    const profileId = userProfile.id;

    socket.join(`user:${profileId}`);

    if (!vibrappOnlineUsers.has(profileId)) {
      vibrappOnlineUsers.set(profileId, new Set());
    }
    vibrappOnlineUsers.get(profileId)!.add(socket.id);
    vibrappUserProfiles.set(profileId, { name: userProfile.name, image: userProfile.imageUrl });
    io.emit("vibrapp:online-count", vibrappOnlineUsers.size);

    socket.on("vibrapp:visibility", (data: { visible?: boolean }) => {
      const visible = data?.visible === true;
      if (visible) {
        if (!vibrappForegroundUsers.has(profileId)) {
          vibrappForegroundUsers.set(profileId, new Set());
        }
        vibrappForegroundUsers.get(profileId)!.add(socket.id);
      } else {
        const foregroundSockets = vibrappForegroundUsers.get(profileId);
        foregroundSockets?.delete(socket.id);
        if (foregroundSockets?.size === 0) {
          vibrappForegroundUsers.delete(profileId);
        }
      }
    });

    socket.on("vibrapp:message", async (data: {
      content?: string;
      mediaUrl?: string;
      mediaType?: string;
      replyToId?: string;
      replyToSenderId?: string;
      replyToName?: string;
      replyToContent?: string;
    }) => {
      try {
        const rawContent = (data.content || "").trim().substring(0, MAX_MSG_LENGTH);
        const mediaUrl = typeof data.mediaUrl === "string" ? data.mediaUrl : null;
        const mediaType = typeof data.mediaType === "string" ? data.mediaType : null;

        if (!rawContent && !mediaUrl) return;

        const filteredContent = rawContent
          ? filterOffensiveContent(rawContent, await getBannedWordsForFiltering())
          : "";

        let replyToSenderId: string | null = null;
        if (data.replyToId) {
          try {
            const [repliedMsg] = await db.select().from(vibrappMessages).where(eq(vibrappMessages.id, data.replyToId));
            if (repliedMsg) {
              replyToSenderId = repliedMsg.senderId;
            }
          } catch {}
          // Fallback: use sender ID provided by the client if DB lookup missed
          // (can happen when the original message was already cleaned up by the 24h job)
          if (!replyToSenderId && typeof data.replyToSenderId === "string" && data.replyToSenderId) {
            replyToSenderId = data.replyToSenderId;
          }
        }

        const [msg] = await db.insert(vibrappMessages).values({
          senderId: profileId,
          senderName: userProfile.name,
          senderImage: userProfile.imageUrl,
          content: filteredContent,
          mediaUrl,
          mediaType,
          replyToId: data.replyToId || null,
          replyToSenderId: replyToSenderId,
          replyToName: data.replyToName || null,
          replyToContent: data.replyToContent ? data.replyToContent.substring(0, 100) : null,
        }).returning();

        const pushBody = mediaUrl
          ? `${userProfile.name}: ${mediaType === "video" ? "📹 Video" : mediaType === "audio" ? "🎤 Vocale" : "🖼️ Immagine"}`
          : `${userProfile.name}: ${filteredContent.substring(0, 100)}`;
        const vibrappPushPayload = {
          title: `🛸 ${userProfile.name}`,
          body: pushBody.replace(`${userProfile.name}: `, ""),
          icon: "/icons/icon-192.png",
          url: "/vibrapp",
          type: "vibrapp",
        };

        if (data.replyToId && replyToSenderId) {
          io.to(`user:${profileId}`).to(`user:${replyToSenderId}`).emit("vibrapp:new-message", msg);
          if (replyToSenderId !== profileId) {
            // Use "vibrapp-reply" type so the service worker assigns a distinct
            // notification tag from broadcast messages — prevents OS-level
            // sound suppression due to same-tag merging.
            sendPushToProfile(replyToSenderId, {
              title: `🛸 ${userProfile.name} ti ha risposto`,
              body: pushBody.replace(`${userProfile.name}: `, ""),
              icon: "/icons/icon-192.png",
              url: `/vibrapp`,
              type: "vibrapp-reply",
            });
          }
        } else {
          io.emit("vibrapp:new-message", msg);

          // Send push to subscribers who are offline (not connected to vibrapp socket)
          // Only active users in the last 48h to avoid spamming inactive accounts
          try {
            const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);
            const activeSubs = await db
              .select({ profileId: pushSubscriptions.profileId, endpoint: pushSubscriptions.endpoint, p256dh: pushSubscriptions.p256dh, auth: pushSubscriptions.auth, id: pushSubscriptions.id })
              .from(pushSubscriptions)
              .innerJoin(profiles, eq(profiles.id, pushSubscriptions.profileId))
              .where(sql`${profiles.lastActiveAt} > ${cutoff} AND ${pushSubscriptions.profileId} != ${profileId}`);

            const onlineSet = new Set(vibrappOnlineUsers.keys());
            const offlineSubs = activeSubs.filter(s => !onlineSet.has(s.profileId));

            for (const sub of offlineSubs) {
              try {
                await webpush.sendNotification(
                  { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
                  JSON.stringify(vibrappPushPayload)
                );
              } catch (err: any) {
                if (err.statusCode === 410 || err.statusCode === 404) {
                  await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id));
                }
              }
            }
          } catch (pushErr) {
            console.error("[vibrapp] offline push error:", pushErr);
          }
        }
      } catch (err) {
        console.error("[vibrapp] message error:", err);
      }
    });

    socket.on("vibrapp:typing", () => {
      const existing = vibrappTypingUsers.get(profileId);
      if (existing) clearTimeout(existing.timeout);
      const timeout = setTimeout(() => {
        vibrappTypingUsers.delete(profileId);
        io.emit("vibrapp:typing-update", Array.from(vibrappTypingUsers.entries()).map(([id, v]) => ({ profileId: id, name: v.name })));
      }, 3000);
      vibrappTypingUsers.set(profileId, { name: userProfile.name, timeout });
      io.emit("vibrapp:typing-update", Array.from(vibrappTypingUsers.entries()).map(([id, v]) => ({ profileId: id, name: v.name })));
    });

    socket.on("vibrapp:read", async (data: { messageId: string }) => {
      try {
        if (!data.messageId || typeof data.messageId !== "string") return;
        const [msg] = await db.select().from(vibrappMessages).where(eq(vibrappMessages.id, data.messageId));
        if (!msg) return;
        if (msg.replyToId && msg.senderId !== profileId && msg.replyToSenderId !== profileId) return;
        await db.execute(sql`UPDATE vibrapp_messages SET read_by = array_append(read_by, ${profileId}) WHERE id = ${data.messageId} AND NOT (${profileId} = ANY(read_by)) AND sender_id != ${profileId}`);
        if (msg.replyToId && msg.replyToSenderId) {
          io.to(`user:${msg.senderId}`).to(`user:${msg.replyToSenderId}`).emit("vibrapp:message-read", { messageId: data.messageId, profileId });
        } else {
          io.emit("vibrapp:message-read", { messageId: data.messageId, profileId });
        }
      } catch (err) {
        console.error("[vibrapp] read error:", err);
      }
    });

    socket.on("vibrapp:react", async (data: { messageId: string; emoji: string }) => {
      try {
        if (!data.messageId || !data.emoji || !ALLOWED_REACTIONS.includes(data.emoji)) return;
        const [msg] = await db.select().from(vibrappMessages).where(eq(vibrappMessages.id, data.messageId));
        if (!msg) return;
        if (msg.replyToId && msg.senderId !== profileId && msg.replyToSenderId !== profileId) return;
        const reactions: Record<string, string[]> = JSON.parse(msg.reactions || "{}");
        if (!reactions[data.emoji]) reactions[data.emoji] = [];
        const idx = reactions[data.emoji].indexOf(profileId);
        if (idx >= 0) {
          reactions[data.emoji].splice(idx, 1);
          if (reactions[data.emoji].length === 0) delete reactions[data.emoji];
        } else {
          reactions[data.emoji].push(profileId);
        }
        await db.update(vibrappMessages).set({ reactions: JSON.stringify(reactions) }).where(eq(vibrappMessages.id, data.messageId));
        if (msg.replyToId && msg.replyToSenderId) {
          io.to(`user:${msg.senderId}`).to(`user:${msg.replyToSenderId}`).emit("vibrapp:reaction-update", { messageId: data.messageId, reactions });
        } else {
          io.emit("vibrapp:reaction-update", { messageId: data.messageId, reactions });
        }
      } catch (err) {
        console.error("[vibrapp] react error:", err);
      }
    });

    socket.on("vibrapp:delete", async (data: { messageId: string }) => {
      try {
        if (!data.messageId) return;
        const [msg] = await db.select().from(vibrappMessages).where(eq(vibrappMessages.id, data.messageId));
        if (!msg) return;
        if (msg.senderId !== profileId) return;
        await db.delete(vibrappMessages).where(eq(vibrappMessages.id, data.messageId));
        io.emit("vibrapp:message-deleted", { messageId: data.messageId });
      } catch (err) {
        console.error("[vibrapp] delete error:", err);
      }
    });

    // ─── Vibrapp DM (1:1 direct messages) ───────────────────────────────
    socket.on("vibrapp:dm-send", async (data: { toProfileId: string; content: string }) => {
      try {
        if (!data.toProfileId || typeof data.content !== "string") return;
        if (data.toProfileId === profileId) return; // prevent self-DM
        const content = data.content.trim().substring(0, 1000);
        if (!content) return;

        const dmTarget = await storage.getProfile(data.toProfileId);
        if (!dmTarget) return;

        const dm = await storage.sendVibrappDm(profileId, data.toProfileId, content);

        const dmMsg = {
          id: dm.id,
          fromProfileId: dm.fromProfileId,
          toProfileId: dm.toProfileId,
          content: dm.content,
          readAt: dm.readAt,
          createdAt: dm.createdAt,
          senderName: userProfile.name,
          senderImage: userProfile.imageUrl,
        };

        io.to(`user:${profileId}`).emit("vibrapp:dm-sent", dmMsg);
        io.to(`user:${data.toProfileId}`).emit("vibrapp:dm-message", dmMsg);

        const isForeground = (vibrappForegroundUsers.get(data.toProfileId)?.size ?? 0) > 0;
        if (!isForeground) {
          sendPushToProfile(data.toProfileId, {
            title: `💬 ${userProfile.name}`,
            body: content.substring(0, 100),
            icon: "/icons/icon-192.png",
            url: `/vibrapp?dm=${profileId}`,
            type: "vibrapp-dm",
          });
        }

        // ── Bot auto-reply per DM diretti ────────────────────────────────
        if (shouldAutoReplyToDirectMessage(dmTarget)) {
          (async () => {
            try {
              const { readDelayMs } = getBotDelay(dmTarget);
              // Aspetta il read delay PRIMA di mostrare i puntini
              await new Promise(r => setTimeout(r, readDelayMs));

              // Ora il bot "ha letto" → mostra typing indicator al mittente
              io.to(`user:${profileId}`).emit("vibrapp:dm-bot-typing", {
                fromProfileId: dmTarget.id,
                name: dmTarget.name,
                image: dmTarget.imageUrl,
              });

              // Genera la risposta e aspetta il tempo di scrittura
              const thread = await storage.getVibrappDmThread(profileId, dmTarget.id);
              const chatHistory = thread.map((m: any) => ({ senderId: m.fromProfileId, content: m.content }));
              const botReplyText = await generateBotReply(dmTarget, userProfile, chatHistory);
              const typingMs = getBotTypingMs(botReplyText);
              await new Promise(r => setTimeout(r, typingMs));

              // Salva la risposta nel DB e invia al mittente
              const replyDm = await storage.sendVibrappDm(dmTarget.id, profileId, botReplyText);
              const replyMsg = {
                id: replyDm.id,
                fromProfileId: dmTarget.id,
                toProfileId: profileId,
                content: botReplyText,
                readAt: null,
                createdAt: replyDm.createdAt,
                senderName: dmTarget.name,
                senderImage: dmTarget.imageUrl,
              };
              io.to(`user:${profileId}`).emit("vibrapp:dm-message", replyMsg);
              // Ferma il typing indicator
              io.to(`user:${profileId}`).emit("vibrapp:dm-bot-typing-stop", { fromProfileId: dmTarget.id });
              console.log(`[BOT] DM reply: ${dmTarget.name} → ${userProfile.name} (read=${Math.round(readDelayMs/1000)}s typing=${Math.round(typingMs/1000)}s)`);
            } catch (botErr) {
              console.error("[vibrapp] bot dm reply error:", botErr);
              io.to(`user:${profileId}`).emit("vibrapp:dm-bot-typing-stop", { fromProfileId: data.toProfileId });
            }
          })();
        }
      } catch (err) {
        console.error("[vibrapp] dm-send error:", err);
      }
    });

    socket.on("disconnect", () => {
      const sockets = vibrappOnlineUsers.get(profileId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          vibrappOnlineUsers.delete(profileId);
          vibrappUserProfiles.delete(profileId);
        }
      }
      vibrappTypingUsers.delete(profileId);
      const foregroundSockets = vibrappForegroundUsers.get(profileId);
      foregroundSockets?.delete(socket.id);
      if (foregroundSockets?.size === 0) {
        vibrappForegroundUsers.delete(profileId);
      }
      io.emit("vibrapp:online-count", vibrappOnlineUsers.size);
    });
  });

  app.get("/api/vibrapp/messages", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session?.userId;
      const profile = await storage.getProfileByUserId(userId);
      if (!profile) return res.status(404).json({ error: "Profile not found" });

      const profileId = profile.id;
      const limit = parseInt(req.query.limit as string) || 50;
      const before = req.query.before as string | undefined;

      const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const visibilityFilter = and(
        gt(vibrappMessages.createdAt, cutoff24h),
        or(
          sql`${vibrappMessages.replyToId} IS NULL`,
          eq(vibrappMessages.senderId, profileId),
          eq(vibrappMessages.replyToSenderId, profileId)
        )
      );

      let query;
      if (before) {
        const [beforeMsg] = await db.select().from(vibrappMessages).where(eq(vibrappMessages.id, before));
        if (beforeMsg) {
          query = await db.select().from(vibrappMessages)
            .where(and(lt(vibrappMessages.createdAt, beforeMsg.createdAt), visibilityFilter!))
            .orderBy(desc(vibrappMessages.createdAt))
            .limit(limit);
        } else {
          query = await db.select().from(vibrappMessages)
            .where(visibilityFilter!)
            .orderBy(desc(vibrappMessages.createdAt))
            .limit(limit);
        }
      } else {
        query = await db.select().from(vibrappMessages)
          .where(visibilityFilter!)
          .orderBy(desc(vibrappMessages.createdAt))
          .limit(limit);
      }

      res.json(query.reverse());
    } catch (err) {
      console.error("[vibrapp] fetch messages error:", err);
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  app.post("/api/vibrapp/request-upload", isAuthenticated, async (req: any, res) => {
    try {
      const { contentType, size } = req.body;
      const ALLOWED_IMAGE = ["image/jpeg", "image/png", "image/webp", "image/gif"];
      const ALLOWED_VIDEO = ["video/mp4", "video/webm", "video/quicktime", "video/mov"];
      const ALLOWED_AUDIO = ["audio/webm", "audio/ogg", "audio/wav", "audio/mp4", "audio/mpeg", "audio/mp3"];
      const isImage = ALLOWED_IMAGE.includes(contentType);
      const isVideo = ALLOWED_VIDEO.includes(contentType);
      const isAudio = ALLOWED_AUDIO.includes(contentType);
      if (!isImage && !isVideo && !isAudio) {
        return res.status(400).json({ error: "Tipo file non supportato" });
      }
      const maxSize = isVideo ? 60 * 1024 * 1024 : isAudio ? 10 * 1024 * 1024 : 20 * 1024 * 1024;
      if (size && size > maxSize) {
        return res.status(400).json({ error: isVideo ? "Video troppo grande (max 60MB)" : isAudio ? "Audio troppo grande (max 10MB)" : "Immagine troppo grande (max 20MB)" });
      }
      const objectStorageService = new ObjectStorageService();
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);
      res.json({ uploadURL, objectPath, mediaType: isVideo ? "video" : isAudio ? "audio" : "image" });
    } catch (err) {
      console.error("[vibrapp] request-upload error:", err);
      res.status(500).json({ error: "Upload non disponibile" });
    }
  });

  // ─── Cold Messages (Intro DM) ─────────────────────────────────────────────
  app.post("/api/cold-messages", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) return res.status(401).json({ error: "Non autenticato" });
      const myProfile = await storage.getProfileByUserId(userId);
      if (!myProfile) return res.status(400).json({ error: "Profilo non trovato" });
      const { toProfileId, content, mediaUrl, mediaType } = req.body;
      if (!toProfileId || (!content?.trim() && !mediaUrl)) return res.status(400).json({ error: "Parametri mancanti" });
      if (toProfileId === myProfile.id) return res.status(400).json({ error: "Non puoi scrivere a te stesso" });

      // Note: the silent-drop guard (report-based filter) is enforced inside
      // storage.sendColdMessage — no HTTP-layer check needed here.
      const result = await storage.sendColdMessage(myProfile.id, toProfileId, (content || "").trim().substring(0, 500), mediaUrl || undefined, mediaType || undefined);
      // Gate ALL delivery side effects (push notifications, bot reply, match creation)
      // on a real persisted message. When the guard silently drops the message it
      // returns { status: "sent" } without a coldMessage — we must not trigger any
      // notification or bot logic in that case.
      if (result.status === "sent" && result.coldMessage) {
        const targetProfile = await storage.getProfile(toProfileId);
        if (targetProfile) {
          sendPushToProfile(toProfileId, {
            title: `🛸 ${myProfile.name} ti ha scritto`,
            body: mediaType === "audio" ? "🎤 Ha inviato un messaggio vocale" : (content || "").trim().substring(0, 100),
            icon: "/icons/icon-192.png",
            url: `/vibrapp?coldMessageId=${result.coldMessage.id}`,
            type: "vibrapp",
          });

          // Se il destinatario è un bot: risposta proporzionale alla lunghezza del testo
          if (shouldAutoReplyToDirectMessage(targetProfile) && result.coldMessage) {
            const coldMsgId = result.coldMessage.id;
            // Delay realistico basato su lastActiveAt del bot
            (async () => {
              try {
                const chatHistory = [{ senderId: myProfile.id, content: (content || "").trim() }];
                const botReplyText = await generateBotReply(targetProfile, myProfile, chatHistory);

                const { readDelayMs } = getBotDelay(targetProfile);
                const typingMs = getBotTypingMs(botReplyText);
                const totalDelay = readDelayMs + typingMs;

                // Prima aspetta il read delay, poi il typing delay
                await new Promise(r => setTimeout(r, readDelayMs));
                await new Promise(r => setTimeout(r, typingMs));
                {
                    try {
                      const replyResult = await storage.replyColdMessage(coldMsgId, botReplyText);
                      sendPushToProfile(myProfile.id, {
                        title: `🛸 ${targetProfile.name} ha risposto!`,
                        body: botReplyText.substring(0, 100),
                        icon: "/icons/icon-192.png",
                        url: `/vibrapp?coldMessageId=${coldMsgId}`,
                        type: "vibrapp",
                      });
                      console.log(`[BOT] Cold message auto-reply: ${targetProfile.name} → ${myProfile.name} (read=${Math.round(readDelayMs/1000)}s typing=${Math.round(typingMs/1000)}s)`);

                      // 2. Bot mette like all'utente (se non lo ha già fatto)
                      const existingBotLike = await storage.getSwipe(targetProfile.id, myProfile.id);
                      if (!existingBotLike) {
                        await storage.createSwipe({ swiperId: targetProfile.id, swipedId: myProfile.id, liked: true });
                      }

                      // 3. Controlla se l'utente aveva già messo like al bot → crea match
                      const userAlreadyLiked = await storage.getSwipe(myProfile.id, targetProfile.id);
                      const existingMatch = await storage.getMatch(myProfile.id, targetProfile.id);
                      if (userAlreadyLiked?.liked && !existingMatch) {
                        const newMatch = await storage.createMatch({
                          profile1Id: myProfile.id,
                          profile2Id: targetProfile.id,
                        });
                        const opener = await generateBotOpener(targetProfile, myProfile);
                        await storage.createMessage({ matchId: newMatch.id, senderId: targetProfile.id, content: opener });
                        sendPushToProfile(myProfile.id, {
                          title: `💫 Match con ${targetProfile.name}!`,
                          body: opener.substring(0, 100),
                          icon: "/icons/icon-192.png",
                          url: `/chat/${newMatch.id}`,
                        });
                        console.log(`[BOT] Match creato dopo cold message: ${targetProfile.name} <-> ${myProfile.name}`);
                      } else if (!userAlreadyLiked?.liked) {
                        sendPushToProfile(myProfile.id, {
                          title: `❤️ ${targetProfile.name} ti ha messo like!`,
                          body: "Swipa per fare match e continuare a chattare",
                          icon: "/icons/icon-192.png",
                          url: "/",
                        });
                      }
                    } catch (innerErr) {
                      console.error("[BOT] Cold message save-reply error:", innerErr);
                    }
                }
              } catch (botErr) {
                console.error("[BOT] Cold message auto-reply error:", botErr);
              }
            })();
          }
        }
      }
      res.json(result);
    } catch (err) {
      console.error("[cold-messages POST]", err);
      res.status(500).json({ error: "Errore" });
    }
  });

  registerColdMessageListRoutes(app);

  app.get("/api/cold-messages/check/:toProfileId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) return res.status(401).json({ error: "Non autenticato" });
      const myProfile = await storage.getProfileByUserId(userId);
      if (!myProfile) return res.status(404).json({ error: "Profilo non trovato" });
      const msg = await storage.getColdMessageBetween(myProfile.id, req.params.toProfileId);
      const targetProfile = await storage.getProfile(req.params.toProfileId);
      const legacyReply = getLegacyBotReplyState(targetProfile, msg);
      res.json({
        id: msg?.id ?? null,
        exists: !!msg,
        // This endpoint is polled by the bot-style composer. Do not expose
        // legacy reply_content from a real person's old cold message.
        ...legacyReply,
        privateRoomId: msg?.privateRoomId ?? null,
        content: msg?.content ?? null,
        mediaUrl: msg?.mediaUrl ?? null,
        mediaType: msg?.mediaType ?? null,
        createdAt: msg?.createdAt ?? null,
      });
    } catch (err) {
      res.status(500).json({ error: "Errore" });
    }
  });

  // Recupera cold message per ID (usato dal deeplink da notifica push e dalla ri-validazione on-close)
  app.get("/api/cold-messages/:id", isAuthenticated, getColdMessageByIdHandler);

  app.post("/api/cold-messages/:id/reply", isAuthenticated, (req: any, res) =>
    postColdMessageReplyHandler(req, res, (dmMsg, recipientProfileId, senderName) => {
      io.to(`user:${recipientProfileId}`).emit("vibrapp:dm-message", dmMsg);
      io.to(`user:${dmMsg.fromProfileId}`).emit("vibrapp:dm-sent", dmMsg);
      sendPushToProfile(recipientProfileId, {
        title: `🛸 ${senderName} ha risposto!`,
        body: "Ha risposto su Vibrapp 💬",
        icon: "/icons/icon-192.png",
        url: `/vibrapp?dm=${dmMsg.fromProfileId}`,
        type: "vibrapp-dm",
      });
    }),
  );

  // DELETE a received cold message (recipient only)
  app.delete("/api/cold-messages/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) return res.status(401).json({ error: "Non autenticato" });
      const myProfile = await storage.getProfileByUserId(userId);
      if (!myProfile) return res.status(400).json({ error: "Profilo non trovato" });
      await storage.deleteColdMessage(req.params.id, myProfile.id);
      res.json({ ok: true });
    } catch (err) {
      console.error("[cold-messages delete]", err);
      res.status(500).json({ error: "Errore" });
    }
  });

  // Cancella una cold message inviata dal mittente (usato dal pannello SwipeCard dopo la conversazione)
  app.delete("/api/cold-messages/sent/:toProfileId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) return res.status(401).json({ error: "Non autenticato" });
      const myProfile = await storage.getProfileByUserId(userId);
      if (!myProfile) return res.status(400).json({ error: "Profilo non trovato" });
      await storage.deleteSentColdMessage(myProfile.id, req.params.toProfileId);
      res.json({ ok: true });
    } catch (err) {
      console.error("[cold-messages delete sent]", err);
      res.status(500).json({ error: "Errore" });
    }
  });

  // ─── Vibrapp DM REST endpoints ────────────────────────────────────────────
  app.get("/api/vibrapp-dm/thread/:otherProfileId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) return res.status(401).json({ error: "Non autenticato" });
      const myProfile = await storage.getProfileByUserId(userId);
      if (!myProfile) return res.status(404).json({ error: "Profilo non trovato" });
      const thread = await storage.getVibrappDmThread(myProfile.id, req.params.otherProfileId);
      await storage.markVibrappDmRead(myProfile.id, req.params.otherProfileId);
      res.json(thread);
    } catch (err) {
      console.error("[vibrapp-dm thread]", err);
      res.status(500).json({ error: "Errore" });
    }
  });

  app.get("/api/vibrapp-dm/unread-count", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) return res.status(401).json({ error: "Non autenticato" });
      const myProfile = await storage.getProfileByUserId(userId);
      if (!myProfile) return res.json({ count: 0 });
      const count = await storage.getVibrappDmUnreadCount(myProfile.id);
      res.json({ count });
    } catch (err) {
      res.status(500).json({ error: "Errore" });
    }
  });

  app.post("/api/vibrapp-dm/read/:otherProfileId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) return res.status(401).json({ error: "Non autenticato" });
      const myProfile = await storage.getProfileByUserId(userId);
      if (!myProfile) return res.status(404).json({ error: "Profilo non trovato" });
      await storage.markVibrappDmRead(myProfile.id, req.params.otherProfileId);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: "Errore" });
    }
  });

  app.get("/api/vibrapp-dm/conversations", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) return res.status(401).json({ error: "Non autenticato" });
      const myProfile = await storage.getProfileByUserId(userId);
      if (!myProfile) return res.json([]);
      const convos = await storage.getVibrappDmConversations(myProfile.id);
      res.json(convos);
    } catch (err) {
      console.error("[vibrapp-dm conversations]", err);
      res.status(500).json({ error: "Errore" });
    }
  });

  app.post("/api/vibrapp-dm/send", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) return res.status(401).json({ error: "Non autenticato" });
      const myProfile = await storage.getProfileByUserId(userId);
      if (!myProfile) return res.status(404).json({ error: "Profilo non trovato" });

      const { toProfileId, content } = req.body;
      if (!toProfileId || typeof content !== "string") {
        return res.status(400).json({ error: "toProfileId e content richiesti" });
      }
      if (toProfileId === myProfile.id) {
        return res.status(400).json({ error: "Non puoi inviare un messaggio a te stesso" });
      }
      const trimmed = content.trim().substring(0, 1000);
      if (!trimmed) return res.status(400).json({ error: "Messaggio vuoto" });

      const targetProfile = await storage.getProfile(toProfileId);
      if (!targetProfile) return res.status(404).json({ error: "Destinatario non trovato" });

      const dm = await storage.sendVibrappDm(myProfile.id, toProfileId, trimmed);

      const dmMsg = {
        id: dm.id,
        fromProfileId: dm.fromProfileId,
        toProfileId: dm.toProfileId,
        content: dm.content,
        readAt: dm.readAt,
        createdAt: dm.createdAt,
        senderName: myProfile.name,
        senderImage: myProfile.imageUrl,
      };

      io.to(`user:${myProfile.id}`).emit("vibrapp:dm-sent", dmMsg);
      io.to(`user:${toProfileId}`).emit("vibrapp:dm-message", dmMsg);

      const isForeground = (vibrappForegroundUsers.get(toProfileId)?.size ?? 0) > 0;
      if (!isForeground) {
        sendPushToProfile(toProfileId, {
          title: `💬 ${myProfile.name}`,
          body: trimmed.substring(0, 100),
          icon: "/icons/icon-192.png",
          url: `/vibrapp?dm=${myProfile.id}`,
          type: "vibrapp-dm",
        });
      }

      res.json(dmMsg);
    } catch (err) {
      console.error("[vibrapp-dm send]", err);
      res.status(500).json({ error: "Errore invio messaggio" });
    }
  });

  // ─── Profile Reactions ────────────────────────────────────────────────────
  app.get("/api/reactions/received", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Non autenticato" });
      const myProfile = await storage.getProfileByUserId(userId);
      if (!myProfile) return res.status(404).json({ error: "Profilo non trovato" });
      const reactions = await storage.getReceivedReactions(myProfile.id);
      res.json(reactions);
    } catch (err) {
      console.error("[reactions/received]", err);
      res.status(500).json({ error: "Errore" });
    }
  });

  app.get("/api/profiles/:profileId/reactions", isAuthenticated, async (req: any, res) => {
    try {
      const { profileId } = req.params;
      const userId = req.user?.claims?.sub;
      let viewerProfileId: string | undefined;
      if (userId) {
        const vp = await storage.getProfileByUserId(userId);
        viewerProfileId = vp?.id;
      }
      const data = await storage.getReactionCounts(profileId, viewerProfileId);
      res.json(data);
    } catch (err) {
      console.error("[reactions GET]", err);
      res.status(500).json({ error: "Errore" });
    }
  });

  app.post("/api/reactions", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Non autenticato" });
      const myProfile = await storage.getProfileByUserId(userId);
      if (!myProfile) return res.status(400).json({ error: "Profilo non trovato" });
      const { toProfileId, reaction } = req.body;
      if (!toProfileId || !reaction) return res.status(400).json({ error: "Parametri mancanti" });
      const VALID = ["fire", "ufo", "spark", "crush"];
      if (!VALID.includes(reaction)) return res.status(400).json({ error: "Reazione non valida" });
      const result = await storage.upsertProfileReaction(myProfile.id, toProfileId, reaction as any);
      res.json({ status: result });
    } catch (err) {
      console.error("[reactions POST]", err);
      res.status(500).json({ error: "Errore" });
    }
  });

  // ─── Video Stream by objectPath (Range-request aware) ────────────────────
  // ─── Video Proxy (archive.org e URL esterni → streaming server-side) ────────
  app.get("/api/video-proxy", async (req, res) => {
    const rawUrl = req.query.url as string;
    if (!rawUrl || !rawUrl.startsWith("https://")) {
      return res.status(400).end();
    }
    try {
      const upstreamReq = https.get(rawUrl, {
        headers: {
          ...(req.headers.range ? { Range: req.headers.range as string } : {}),
          "User-Agent": "Mozilla/5.0 (compatible; VibraProxy/1.0)",
        },
      }, (upstreamRes) => {
        const status = upstreamRes.statusCode || 200;
        const headers: Record<string, string> = {
          "Content-Type": (upstreamRes.headers["content-type"] as string) || "video/mp4",
          "Accept-Ranges": "bytes",
          "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
          "Access-Control-Allow-Origin": "*",
        };
        if (upstreamRes.headers["content-range"]) headers["Content-Range"] = upstreamRes.headers["content-range"] as string;
        if (upstreamRes.headers["content-length"]) headers["Content-Length"] = upstreamRes.headers["content-length"] as string;
        res.writeHead(status, headers);
        upstreamRes.pipe(res);
        req.on("close", () => upstreamReq.destroy());
      });
      upstreamReq.on("error", (err) => {
        console.error("[video-proxy] upstream error:", err.message);
        if (!res.headersSent) res.status(502).end();
      });
    } catch (err) {
      console.error("[video-proxy] error:", err);
      if (!res.headersSent) res.status(502).end();
    }
  });

  app.get("/api/video-stream-object", async (req, res) => {
    try {
      const objectPath = req.query.path as string;
      if (!objectPath) return res.status(400).end();

      // CORS: permette al browser di caricare il video anche con crossOrigin attribute
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Range, Content-Type");
      res.setHeader("Access-Control-Expose-Headers", "Content-Range, Accept-Ranges, Content-Length");
      if (req.method === "OPTIONS") { res.status(204).end(); return; }

      const file = await objectStorageService.getObjectEntityFile(objectPath);
      const [metadata] = await file.getMetadata();
      const totalSize = parseInt(String(metadata.size || "0"), 10);
      const contentType = (metadata.contentType as string) || "video/mp4";

      const safeTag = objectPath.replace(/[^a-z0-9]/gi, "").slice(-32);
      const etag = `"obj-${safeTag}"`;
      res.setHeader("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");
      res.setHeader("ETag", etag);
      if (req.headers["if-none-match"] === etag) {
        res.writeHead(304);
        return res.end();
      }

      // INITIAL_CHUNK = 5MB: coincide con il range precaricato dalla home (bytes=0-5242879).
      // Quando il video element fa la prima range request, il browser trova la risposta
      // già in cache (caricata dalla preload fetch) → play immediato senza buffering.
      const INITIAL_CHUNK = 5 * 1024 * 1024;
      const SUBSEQUENT_CHUNK = 2 * 1024 * 1024;
      const rangeHeader = req.headers.range;
      if (rangeHeader) {
        const parts = rangeHeader.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const chunkLimit = start === 0 ? INITIAL_CHUNK : SUBSEQUENT_CHUNK;
        const end = parts[1] ? parseInt(parts[1], 10) : Math.min(start + chunkLimit - 1, totalSize - 1);
        const chunkSize = end - start + 1;
        res.writeHead(206, {
          "Content-Range": `bytes ${start}-${end}/${totalSize}`,
          "Accept-Ranges": "bytes",
          "Content-Length": chunkSize,
          "Content-Type": contentType,
        });
        file.createReadStream({ start, end }).pipe(res);
      } else {
        res.writeHead(200, {
          "Content-Length": totalSize,
          "Content-Type": contentType,
          "Accept-Ranges": "bytes",
        });
        file.createReadStream().pipe(res);
      }
    } catch (err) {
      console.error("[video-stream-object]", err);
      if (!res.headersSent) res.status(500).end();
    }
  });

  // ─── Video Stream (Range-request aware, no ACL required) ─────────────────
  app.get("/api/video-stream/:videoId", async (req, res) => {
    try {
      const video = await storage.getProfileVideoById(req.params.videoId);
      if (!video) return res.status(404).end();

      const file = await objectStorageService.getObjectEntityFile(video.videoUrl);
      const [metadata] = await file.getMetadata();
      const totalSize = parseInt(String(metadata.size || "0"), 10);
      const contentType = (metadata.contentType as string) || "video/mp4";

      const etag = `"vid-${req.params.videoId}"`;
      res.setHeader("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");
      res.setHeader("ETag", etag);
      if (req.headers["if-none-match"] === etag) {
        res.writeHead(304);
        return res.end();
      }

      // Initial chunk piccolo (512KB) → primo frame riproducibile in <1s su mobile.
      const INITIAL_CHUNK = 512 * 1024;
      const SUBSEQUENT_CHUNK = 2 * 1024 * 1024;
      const rangeHeader = req.headers.range;
      if (rangeHeader) {
        const parts = rangeHeader.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const chunkLimit = start === 0 ? INITIAL_CHUNK : SUBSEQUENT_CHUNK;
        const end = parts[1] ? parseInt(parts[1], 10) : Math.min(start + chunkLimit - 1, totalSize - 1);
        const chunkSize = end - start + 1;
        res.writeHead(206, {
          "Content-Range": `bytes ${start}-${end}/${totalSize}`,
          "Accept-Ranges": "bytes",
          "Content-Length": chunkSize,
          "Content-Type": contentType,
        });
        file.createReadStream({ start, end }).pipe(res);
      } else {
        res.writeHead(200, {
          "Content-Length": totalSize,
          "Content-Type": contentType,
          "Accept-Ranges": "bytes",
        });
        file.createReadStream().pipe(res);
      }
    } catch (err) {
      console.error("[video-stream]", err);
      if (!res.headersSent) res.status(500).end();
    }
  });

  // ─── Stories Feed ─────────────────────────────────────────────────────────
  app.get("/api/stories", async (req, res) => {
    try {
      const stories = await storage.getStoriesFeed(20);
      res.json(stories);
    } catch (err) {
      console.error("[stories] feed error:", err);
      res.status(500).json({ error: "Errore nel recupero storie" });
    }
  });

  // ─── Profile Videos (user) ────────────────────────────────────────────────

  app.post("/api/profiles/videos/request-upload", isAuthenticated, async (req: any, res) => {
    try {
      const { contentType, size } = req.body;
      const ALLOWED_VIDEO = ["video/mp4", "video/webm", "video/quicktime", "video/mov"];
      if (!ALLOWED_VIDEO.includes(contentType)) {
        return res.status(400).json({ error: "Formato video non supportato. Usa MP4, WebM o MOV." });
      }
      const MAX_SIZE = 250 * 1024 * 1024;
      if (size && size > MAX_SIZE) {
        return res.status(400).json({ error: "Video troppo grande. Massimo 250 MB." });
      }
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);
      res.json({ uploadURL, objectPath });
    } catch (err) {
      console.error("[profile-videos] request-upload error:", err);
      res.status(500).json({ error: "Upload non disponibile" });
    }
  });

  app.post("/api/profiles/videos", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Non autenticato" });
      const userProfile = await storage.getProfileByUserId(userId);
      if (!userProfile) return res.status(404).json({ error: "Profilo non trovato" });

      const { objectPath, thumbnailBase64, caption, location, gifOverlayUrl } = req.body;
      if (!objectPath) return res.status(400).json({ error: "objectPath richiesto" });

      try {
        await objectStorageService.trySetObjectEntityAclPolicy(objectPath, { owner: userId, visibility: "public" });
      } catch {}

      if (thumbnailBase64) {
        try {
          const thumbnailBuf = Buffer.from(thumbnailBase64, "base64");
          const thumbUploadURL = await objectStorageService.getObjectEntityUploadURL();
          const thumbPath = objectStorageService.normalizeObjectEntityPath(thumbUploadURL);
          await fetch(thumbUploadURL, { method: "PUT", body: thumbnailBuf, headers: { "Content-Type": "image/jpeg" } });
          await objectStorageService.trySetObjectEntityAclPolicy(thumbPath, { owner: userId, visibility: "public" }).catch(() => {});
        } catch {}
      }

      // Limite 10 video per utente — FIFO: elimina il più vecchio se al limite
      const MAX_USER_VIDEOS = 10;
      const existingVideos = await storage.getProfileVideos(userProfile.id);
      if (existingVideos.length >= MAX_USER_VIDEOS) {
        const oldest = [...existingVideos].sort((a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        )[0];
        try { await objectStorageService.deleteObject(oldest.videoUrl); } catch {}
        await storage.deleteProfileVideo(oldest.id);
      }

      const video = await storage.addProfileVideo({
        profileId: userProfile.id,
        videoUrl: objectPath,
        thumbnailUrl: null,
        location: location || null,
        caption: caption || null,
        gifOverlayUrl: gifOverlayUrl || null,
      });

      res.json(video);
    } catch (err: any) {
      console.error("[profile-videos] save error:", err?.message || err);
      res.status(500).json({ error: "Errore nel salvataggio del video" });
    }
  });

  app.delete("/api/profiles/videos/:videoId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Non autenticato" });
      const userProfile = await storage.getProfileByUserId(userId);
      if (!userProfile) return res.status(404).json({ error: "Profilo non trovato" });

      const video = await storage.getProfileVideoById(req.params.videoId);
      if (!video) return res.status(404).json({ error: "Video non trovato" });
      if (video.profileId !== userProfile.id) return res.status(403).json({ error: "Non autorizzato" });

      try { await objectStorageService.deleteObject(video.videoUrl); } catch {}
      await storage.deleteProfileVideo(req.params.videoId);
      res.json({ success: true });
    } catch (err) {
      console.error("[profile-videos] delete error:", err);
      res.status(500).json({ error: "Errore nell'eliminazione" });
    }
  });

  app.get("/api/profiles/:profileId/videos", async (req, res) => {
    try {
      const profile = await storage.getProfile(req.params.profileId);
      if (!profile || profile.moderationHidden) {
        return res.status(404).json({ error: "Profile not found" });
      }
      const videos = await storage.getProfileVideos(req.params.profileId);
      res.json(videos);
    } catch (err) {
      console.error("[profile-videos] get error:", err);
      res.status(500).json({ error: "Errore nel recupero video" });
    }
  });


  // Cleanup job: elimina video di profili inattivi da 30+ giorni
  async function cleanInactiveProfileVideos() {
    try {
      const cutoff = getProfileVideoCleanupCutoff();
      const staleVideos = await storage.getVideosForInactiveProfiles(cutoff);
      if (staleVideos.length === 0) return;
      console.log(`[profile-videos] cleanup: rimozione ${staleVideos.length} video inattivi`);
      const cleanupResult = await removeInactiveProfileVideos(
        staleVideos,
        (videoUrl) => objectStorageService.deleteObject(videoUrl),
        (videoId) => storage.deleteProfileVideo(videoId),
      );
      if (cleanupResult.skippedMissingUrlCount > 0) {
        console.warn(
          `[profile-videos] cleanup preserved ${cleanupResult.skippedMissingUrlCount} inactive video(s) with a missing URL`,
        );
      }
    } catch (err) {
      console.error("[profile-videos] cleanup error:", err);
    }
  }
  setInterval(cleanInactiveProfileVideos, 60 * 60 * 1000);

  // ──────────────────────────────────────────────────────────────────────────

  app.post("/api/vibrapp/mark-all-read", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Non autenticato" });
      const myProfile = await storage.getProfileByUserId(userId);
      if (!myProfile) return res.json({ ok: true });
      await db.execute(
        sql`UPDATE vibrapp_messages
            SET read_by = array_append(read_by, ${myProfile.id})
            WHERE sender_id != ${myProfile.id}
              AND NOT (${myProfile.id} = ANY(read_by))`
      );
      res.json({ ok: true });
    } catch (err) {
      console.error("[vibrapp/mark-all-read]", err);
      res.json({ ok: true });
    }
  });

  app.get("/api/vibrapp/unread-count", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Non autenticato" });
      const myProfile = await storage.getProfileByUserId(userId);
      if (!myProfile) return res.json({ count: 0 });
      const [row] = await db.select({ count: sql<number>`count(*)::int` })
        .from(vibrappMessages)
        .where(
          and(
            ne(vibrappMessages.senderId, myProfile.id),
            sql`NOT (${myProfile.id} = ANY(${vibrappMessages.readBy}))`
          )
        );
      res.json({ count: Number(row?.count ?? 0) });
    } catch (err) {
      console.error("[vibrapp/unread-count]", err);
      res.json({ count: 0 });
    }
  });

  app.get("/api/vibrapp/online-count", isAuthenticated, async (req: any, res) => {
    try {
      const cutoff = new Date(Date.now() - 4 * 60 * 60 * 1000);
      const [row] = await db.select({ count: sql<number>`count(*)::int` })
        .from(profiles)
        .where(and(eq(profiles.isBot, false), gt(profiles.lastActiveAt, cutoff)));
      const activeCount = Number(row?.count ?? 0);
      const socketCount = vibrappOnlineUsers.size;
      res.json({ count: Math.max(activeCount, socketCount) });
    } catch {
      res.json({ count: vibrappOnlineUsers.size });
    }
  });

  // ─── Cosmic Signals ──────────────────────────────────────────────────────────

  app.get("/api/signals", async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      let myProfileId = "";
      if (userId) {
        const myProfile = await storage.getProfileByUserId(userId);
        myProfileId = myProfile?.id || "";
      }
      const feed = await storage.getSignalsFeed(myProfileId, 50);
      res.json(feed);
    } catch (err) {
      console.error("[signals] feed error:", err);
      res.status(500).json({ error: "Errore nel recupero segnali" });
    }
  });

  app.post("/api/signals", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const myProfile = await storage.getProfileByUserId(userId);
      if (!myProfile) return res.status(400).json({ error: "Profilo non trovato" });
      const { content, mediaUrl, mediaType, toProfileId, textColor, backgroundColor } = req.body;
      if (!content?.trim() && !mediaUrl) return res.status(400).json({ error: "Contenuto richiesto" });
      if (mediaUrl) {
        const objectStorageService = new ObjectStorageService();
        await objectStorageService.trySetObjectEntityAclPolicy(mediaUrl, { owner: userId, visibility: "public" }).catch(() => {});
      }
      const signal = await storage.createSignal({
        profileId: myProfile.id,
        content: (content || "").trim().substring(0, 500),
        mediaUrl: mediaUrl || undefined,
        mediaType: mediaType || "text",
        toProfileId: toProfileId || undefined,
        textColor: textColor || null,
        backgroundColor: backgroundColor || null,
      });
      // VibraQuest tracking
      const _sigUserId = req.user?.claims?.sub || req.session?.userId;
      if (_sigUserId) { const _sigP = await storage.getProfileByUserId(_sigUserId).catch(() => null); if (_sigP) storage.trackQuestProgress(_sigP.id, 'signal_post').catch(() => {}); }
      res.json(signal);
    } catch (err) {
      console.error("[signals] create error:", err);
      res.status(500).json({ error: "Errore nella creazione segnale" });
    }
  });

  app.get("/api/signals/received", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const myProfile = await storage.getProfileByUserId(userId);
      if (!myProfile) return res.status(400).json({ error: "Profilo non trovato" });
      const signals = await storage.getReceivedDirectSignals(myProfile.id);
      res.json(signals);
    } catch (err) {
      console.error("[signals] received error:", err);
      res.status(500).json({ error: "Errore nel recupero signal ricevuti" });
    }
  });

  app.delete("/api/signals/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const myProfile = await storage.getProfileByUserId(userId);
      if (!myProfile) return res.status(400).json({ error: "Profilo non trovato" });
      await storage.deleteSignal(req.params.id, myProfile.id);
      res.json({ ok: true });
    } catch (err) {
      console.error("[signals] delete error:", err);
      res.status(500).json({ error: "Errore nella cancellazione" });
    }
  });

  app.post("/api/signals/:id/like", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const myProfile = await storage.getProfileByUserId(userId);
      if (!myProfile) return res.status(400).json({ error: "Profilo non trovato" });
      const result = await storage.toggleSignalLike(req.params.id, myProfile.id);
      res.json(result);
    } catch (err) {
      console.error("[signals] like error:", err);
      res.status(500).json({ error: "Errore nel like" });
    }
  });

  app.get("/api/signals/:id/comments", isAuthenticated, async (req: any, res) => {
    try {
      const comments = await storage.getSignalComments(req.params.id);
      res.json(comments);
    } catch (err) {
      console.error("[signals] comments get error:", err);
      res.status(500).json({ error: "Errore nel recupero commenti" });
    }
  });

  app.post("/api/signals/:id/comments", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const myProfile = await storage.getProfileByUserId(userId);
      if (!myProfile) return res.status(400).json({ error: "Profilo non trovato" });
      const { content } = req.body;
      if (!content?.trim()) return res.status(400).json({ error: "Commento vuoto" });
      const comment = await storage.addSignalComment({
        signalId: req.params.id,
        profileId: myProfile.id,
        content: content.trim().substring(0, 300),
      });
      res.json(comment);
    } catch (err) {
      console.error("[signals] comment post error:", err);
      res.status(500).json({ error: "Errore nel commento" });
    }
  });

  app.get("/api/signals/profile/:profileId", async (req, res) => {
    try {
      const profile = await storage.getProfile(req.params.profileId);
      if (!profile || profile.moderationHidden) {
        return res.status(404).json({ error: "Profile not found" });
      }
      const signals = await storage.getProfileSignals(req.params.profileId, 5);
      res.json(signals);
    } catch (err) {
      console.error("[signals] profile signals error:", err);
      res.status(500).json({ error: "Errore nel recupero segnali" });
    }
  });

  app.post("/api/signals/request-upload", isAuthenticated, async (req: any, res) => {
    try {
      const { contentType, size } = req.body;
      const ALLOWED_IMAGE = ["image/jpeg", "image/png", "image/webp", "image/gif"];
      const ALLOWED_VIDEO = ["video/mp4", "video/webm", "video/quicktime"];
      const ALLOWED_AUDIO = ["audio/mpeg", "audio/mp4", "audio/webm", "audio/ogg", "audio/wav"];
      const isImage = ALLOWED_IMAGE.includes(contentType);
      const isVideo = ALLOWED_VIDEO.includes(contentType);
      const isAudio = ALLOWED_AUDIO.includes(contentType);
      if (!isImage && !isVideo && !isAudio) return res.status(400).json({ error: "Tipo file non supportato" });
      const maxSize = isVideo ? 60 * 1024 * 1024 : 20 * 1024 * 1024;
      if (size && size > maxSize) return res.status(400).json({ error: "File troppo grande" });
      const objectStorageService = new ObjectStorageService();
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);
      let mediaType = "image";
      if (isVideo) mediaType = "video";
      if (isAudio) mediaType = "audio";
      res.json({ uploadURL, objectPath, mediaType });
    } catch (err) {
      console.error("[signals] request-upload error:", err);
      res.status(500).json({ error: "Upload non disponibile" });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Favorites
  app.get("/api/favorites", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const myProfile = await storage.getProfileByUserId(userId);
      if (!myProfile) return res.status(404).json({ error: "Profile not found" });
      const favorites = await storage.getFavorites(myProfile.id);
      res.json(favorites);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch favorites" });
    }
  });

  app.post("/api/favorites/:profileId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const myProfile = await storage.getProfileByUserId(userId);
      if (!myProfile) return res.status(404).json({ error: "Profile not found" });
      const fav = await storage.addFavorite(myProfile.id, req.params.profileId);
      res.json(fav);
    } catch (err) {
      res.status(500).json({ error: "Failed to add favorite" });
    }
  });

  app.delete("/api/favorites/:profileId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const myProfile = await storage.getProfileByUserId(userId);
      if (!myProfile) return res.status(404).json({ error: "Profile not found" });
      await storage.removeFavorite(myProfile.id, req.params.profileId);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to remove favorite" });
    }
  });

  // Admin fix route for bot image extensions
  registerAdminBotImageFixRoute(
    app,
    isAuthenticated,
    isAdmin,
    createAdminBotImageFixHandler({
      getProfiles: async () =>
        db
          .select({
            id: profiles.id,
            isBot: profiles.isBot,
            imageUrl: profiles.imageUrl,
            photos: profiles.photos,
          })
          .from(profiles)
          .where(eq(profiles.isBot, true)),
      updateProfile: async (profileId, updates) => {
        await db
          .update(profiles)
          .set(updates)
          .where(and(eq(profiles.id, profileId), eq(profiles.isBot, true)));
      },
      countFixedBotImages: async () => {
        const fixed = await db
          .select({ count: sql<number>`COUNT(*)`.as("count") })
          .from(profiles)
          .where(
            and(
              eq(profiles.isBot, true),
              sql`image_url LIKE '/images/bots/bot%.webp'`,
            ),
          );
        return Number(fixed[0]?.count || 0);
      },
    }),
  );

  // ─── BADGE & PROFILO PUBBLICO ────────────────────────────────────────────────

  app.get("/api/badge/:profileId", async (req, res) => {
    try {
      const profile = await storage.getProfile(req.params.profileId);
      if (!profile) return res.status(404).send("Not found");

      const esc = (s: string) => s
        .replace(/&/g, "&amp;").replace(/</g, "&lt;")
        .replace(/>/g, "&gt;").replace(/"/g, "&quot;");

      const name     = esc(`${profile.name}, ${profile.age}`);
      const location = profile.location ? esc(`📍 ${profile.location}`) : "";
      const alien    = profile.alienType ? esc(profile.alienType) : "Vibrante";

      const svg = `<svg width="380" height="110" viewBox="0 0 380 110" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg${profile.id}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0D0B1E"/>
      <stop offset="100%" stop-color="#1a0f2e"/>
    </linearGradient>
    <linearGradient id="br${profile.id}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#9b5de5"/>
      <stop offset="50%" stop-color="#00b4d8"/>
      <stop offset="100%" stop-color="#f72585"/>
    </linearGradient>
  </defs>
  <rect width="380" height="110" rx="18" fill="url(#br${profile.id})"/>
  <rect x="2" y="2" width="376" height="106" rx="16" fill="url(#bg${profile.id})"/>
  <circle cx="60" cy="55" r="32" fill="#1a0530" stroke="rgba(155,93,229,0.7)" stroke-width="1.5"/>
  <text x="60" y="66" text-anchor="middle" font-size="28">🛸</text>
  <text x="108" y="40" font-family="system-ui,sans-serif" font-weight="700" font-size="21" fill="white">${name}</text>
  <text x="108" y="60" font-family="system-ui,sans-serif" font-size="13" fill="rgba(255,255,255,0.55)">${location}</text>
  <text x="108" y="80" font-family="system-ui,sans-serif" font-size="12" fill="rgba(155,93,229,0.95)">✨ ${alien} · Trovami su Vibra</text>
  <line x1="310" y1="18" x2="310" y2="92" stroke="rgba(255,255,255,0.07)" stroke-width="1"/>
  <text x="344" y="48" text-anchor="middle" font-family="system-ui,sans-serif" font-weight="800" font-size="15" fill="rgba(155,93,229,0.95)">Vibra</text>
  <text x="344" y="72" text-anchor="middle" font-size="20">🛸</text>
</svg>`;

      res.setHeader("Content-Type", "image/svg+xml");
      res.setHeader("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");
      res.send(svg);
    } catch (err) {
      console.error("Badge error:", err);
      res.status(500).send("Error generating badge");
    }
  });

  app.get(["/", "/landing"], async (req: any, res, next) => {
    if (process.env.NODE_ENV !== "production") return next();

    try {
      const htmlPath = process.env.NODE_ENV === "production"
        ? path.resolve(process.cwd(), "dist/public/index.html")
        : path.resolve(process.cwd(), "client/index.html");
      const template = await fs.promises.readFile(htmlPath, "utf8");
      const isAuthenticated = Boolean(req.user || req.session?.userId);
      const canonicalPath = req.path === "/landing" ? "/landing" : "/";
      const html = isAuthenticated
        ? template
        : renderLandingVideoSeoHtml(template, canonicalPath);

      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("X-Robots-Tag", "index, follow");
      res.setHeader(
        "Cache-Control",
        isAuthenticated ? "private, no-cache" : "public, max-age=60",
      );
      return res.status(200).send(html);
    } catch (error) {
      return next(error);
    }
  });

  app.get("/p/:profileId", async (req, res, next) => {
    if (process.env.NODE_ENV !== "production") return next();

    try {
      const profile = await storage.getProfile(req.params.profileId);
      if (!profile) return res.status(404).send("Profilo non trovato");

      const htmlPath = process.env.NODE_ENV === "production"
        ? path.resolve(process.cwd(), "dist/public/index.html")
        : path.resolve(process.cwd(), "client/index.html");
      const template = await fs.promises.readFile(htmlPath, "utf8");
      const html = renderPublicProfileSeoHtml(template, {
        id: profile.id,
        name: profile.name,
        age: profile.age,
        imageUrl: profile.imageUrl,
        location: profile.location,
        alienType: profile.alienType,
        profileVideoUrl: profile.profileVideoUrl,
      });

      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("X-Robots-Tag", "index, follow");
      res.setHeader("Cache-Control", "public, max-age=60");
      return res.status(200).send(html);
    } catch (error) {
      return next(error);
    }
  });

  app.get("/api/public/profile/:profileId", async (req, res) => {
    try {
      const profile = await storage.getProfile(req.params.profileId);
      if (!profile) return res.status(404).json({ error: "Profile not found" });
      // Restituisce solo i campi pubblici sicuri (no userId, no dati privati)
      const pub = {
        id: profile.id,
        name: profile.name,
        age: profile.age,
        imageUrl: profile.imageUrl,
        photos: profile.photos || [],
        bio: profile.bio,
        location: profile.location,
        interests: profile.interests || [],
        alienType: profile.alienType,
        isVerified: profile.isVerified,
        profileVideoUrl: profile.profileVideoUrl,
        height: profile.height,
        zodiacSign: profile.zodiacSign,
        loveLanguage: profile.loveLanguage,
        education: profile.education,
        lifestyle: profile.lifestyle,
      };
      res.setHeader("Cache-Control", "public, max-age=60");
      res.json(pub);
    } catch (err) {
      console.error("Public profile error:", err);
      res.status(500).json({ error: "Failed to fetch profile" });
    }
  });

  // ─── VibraDNA API ─────────────────────────────────────────────────────────────
  app.get("/api/dna/my-dna", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const profile = await storage.getProfileByUserId(userId);
      if (!profile) return res.status(404).json({ error: "Profile not found" });
      const vector = await storage.getDna(profile.id);
      res.json({ profileId: profile.id, vector });
    } catch (err) {
      console.error("[DNA] my-dna error:", err);
      res.status(500).json({ error: "Failed to get DNA" });
    }
  });

  app.get("/api/dna/compatibility/:profileId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const myProfile = await storage.getProfileByUserId(userId);
      if (!myProfile) return res.status(404).json({ error: "Profile not found" });
      const compat = await storage.getDnaCompatibility(myProfile.id, req.params.profileId);
      res.json(compat);
    } catch (err) {
      console.error("[DNA] compatibility error:", err);
      res.status(500).json({ error: "Failed to compute compatibility" });
    }
  });

  // ─── VibraGhost API ───────────────────────────────────────────────────────────
  app.get("/api/ghost/status", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const profile = await storage.getProfileByUserId(userId);
      if (!profile) return res.status(404).json({ error: "Profile not found" });
      const status = await storage.getGhostStatus(profile.id);
      res.json(status);
    } catch (err) {
      res.status(500).json({ error: "Failed to get ghost status" });
    }
  });

  app.post("/api/ghost/activate", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const profile = await storage.getProfileByUserId(userId);
      if (!profile) return res.status(404).json({ error: "Profile not found" });
      const hours = Number(req.body.hours) || 24;
      const expiresAt = await storage.setGhostMode(profile.id, hours);
      res.json({ active: true, expiresAt });
    } catch (err) {
      res.status(500).json({ error: "Failed to activate ghost mode" });
    }
  });

  app.post("/api/ghost/deactivate", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const profile = await storage.getProfileByUserId(userId);
      if (!profile) return res.status(404).json({ error: "Profile not found" });
      await storage.deactivateGhostMode(profile.id);
      res.json({ active: false, expiresAt: null });
    } catch (err) {
      res.status(500).json({ error: "Failed to deactivate ghost mode" });
    }
  });

  // ── VibraStory ──────────────────────────────────────────────────────────────

  app.get("/api/stories", isAuthenticated, async (req: any, res) => {
    try {
      const roomId = req.query.roomId as string | undefined;
      const items = await storage.getStories(roomId);
      res.json(items);
    } catch { res.status(500).json({ error: "Errore nel caricamento delle storie" }); }
  });

  app.post("/api/stories", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const user = await storage.getUser(userId);
      const isAdmin = user?.isAdmin || (user?.email && ["famax61@yahoo.com", "famax61@gmail.com"].includes(user.email.toLowerCase()));
      if (!isAdmin) return res.status(403).json({ error: "Solo admin" });
      const { theme, description, roomId } = req.body;
      if (!theme?.trim()) return res.status(400).json({ error: "Il tema è obbligatorio" });
      const story = await storage.createStory({ theme: theme.trim(), description: description?.trim(), roomId });
      res.json(story);
    } catch { res.status(500).json({ error: "Errore nella creazione della storia" }); }
  });

  app.get("/api/stories/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session?.userId;
      const story = await storage.getStory(req.params.id);
      if (!story) return res.status(404).json({ error: "Storia non trovata" });
      const profile = userId ? await storage.getProfileByUserId(userId) : null;
      const briciole = await storage.getStoryBriciole(story.id, profile?.id);
      res.json({ story, briciole });
    } catch { res.status(500).json({ error: "Errore nel caricamento" }); }
  });

  app.post("/api/stories/:id/briciole", isAuthenticated, (req: any, res: any, next: any) => {
    memoryUpload.single("media")(req, res, (err: any) => {
      if (err) return res.status(400).json({ error: err.message || "Errore upload" });
      next();
    });
  }, async (req: any, res: any) => {
    try {
      const userId = req.session?.userId;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const profile = await storage.getProfileByUserId(userId);
      if (!profile) return res.status(404).json({ error: "Profilo non trovato" });
      const story = await storage.getStory(req.params.id);
      if (!story || story.status !== 'active') return res.status(404).json({ error: "Storia non attiva" });
      const content = req.body.content?.trim();
      if (!content) return res.status(400).json({ error: "Il testo è obbligatorio" });

      let mediaUrl: string | undefined;
      if (req.file) {
        const uploadURL = await objectStorageService.getObjectEntityUploadURL();
        const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);
        const putRes = await fetch(uploadURL, { method: "PUT", body: req.file.buffer, headers: { "Content-Type": req.file.mimetype } });
        if (putRes.ok) {
          await objectStorageService.trySetObjectEntityAclPolicy(objectPath, { visibility: "public", owner: null as any });
          mediaUrl = objectPath;
        }
      }

      const briciola = await storage.addBriciola({ storyId: story.id, profileId: profile.id, content, mediaUrl });
      res.json(briciola);
    } catch { res.status(500).json({ error: "Errore nell'aggiunta della briciola" }); }
  });

  app.post("/api/stories/briciole/:briolaId/vote", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const profile = await storage.getProfileByUserId(userId);
      if (!profile) return res.status(404).json({ error: "Profilo non trovato" });
      const { voteType } = req.body;
      if (!["up", "down"].includes(voteType)) return res.status(400).json({ error: "Tipo voto non valido" });
      await storage.voteBriciola(req.params.briolaId, profile.id, voteType);
      res.json({ ok: true });
    } catch { res.status(500).json({ error: "Errore nel voto" }); }
  });

  app.delete("/api/stories/briciole/:briolaId/vote", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const profile = await storage.getProfileByUserId(userId);
      if (!profile) return res.status(404).json({ error: "Profilo non trovato" });
      await storage.removeVoteBriciola(req.params.briolaId, profile.id);
      res.json({ ok: true });
    } catch { res.status(500).json({ error: "Errore nella rimozione voto" }); }
  });

  app.post("/api/stories/:id/select/:briolaId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const user = await storage.getUser(userId);
      const isAdmin = user?.isAdmin || (user?.email && ["famax61@yahoo.com", "famax61@gmail.com"].includes(user.email.toLowerCase()));
      if (!isAdmin) return res.status(403).json({ error: "Solo admin" });
      await storage.selectBriciola(req.params.briolaId);
      res.json({ ok: true });
    } catch { res.status(500).json({ error: "Errore nella selezione" }); }
  });

  app.post("/api/stories/:id/complete", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const user = await storage.getUser(userId);
      const isAdmin = user?.isAdmin || (user?.email && ["famax61@yahoo.com", "famax61@gmail.com"].includes(user.email.toLowerCase()));
      if (!isAdmin) return res.status(403).json({ error: "Solo admin" });
      await storage.completeStory(req.params.id);
      res.json({ ok: true });
    } catch { res.status(500).json({ error: "Errore nel completamento" }); }
  });

  // ── VibraVault ─────────────────────────────────────────────────────────────

  app.get("/api/vault", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const profile = await storage.getProfileByUserId(userId);
      if (!profile) return res.status(404).json({ error: "Profilo non trovato" });
      const confessions = await storage.getMyVaultConfessions(profile.id);
      res.json(confessions);
    } catch { res.status(500).json({ error: "Errore nel caricamento del vault" }); }
  });

  app.post("/api/vault", isAuthenticated, (req: any, res: any, next: any) => {
    memoryUpload.single("media")(req, res, (err: any) => {
      if (err) return res.status(400).json({ error: err.message || "Errore upload" });
      next();
    });
  }, async (req: any, res: any) => {
    try {
      const userId = req.session?.userId;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const profile = await storage.getProfileByUserId(userId);
      if (!profile) return res.status(404).json({ error: "Profilo non trovato" });
      const content = req.body.content?.trim();
      if (!content) return res.status(400).json({ error: "La confessione non può essere vuota" });
      const ttlDays = Math.min(Math.max(parseInt(req.body.ttlDays ?? "3") || 3, 1), 7);

      let mediaUrl: string | undefined;
      if (req.file) {
        const uploadURL = await objectStorageService.getObjectEntityUploadURL();
        const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);
        const putRes = await fetch(uploadURL, { method: "PUT", body: req.file.buffer, headers: { "Content-Type": req.file.mimetype } });
        if (putRes.ok) {
          await objectStorageService.trySetObjectEntityAclPolicy(objectPath, { visibility: "public", owner: null as any });
          mediaUrl = objectPath;
        }
      }

      const confession = await storage.createVaultConfession({ profileId: profile.id, content, mediaUrl, ttlDays });

      // Generate AI sentiment async (non-blocking)
      openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: `Analizza questa confessione anonima e restituisci SOLO un JSON con: {"emotion": "parola emozione in italiano", "emoji": "emoji calzante", "essence": "frase poetica breve max 10 parole in italiano"}. Confessione: "${content.substring(0, 300)}"` }],
        max_tokens: 60,
      }).then(async (r) => {
        try {
          const raw = r.choices[0]?.message?.content?.trim() ?? "{}";
          const clean = raw.replace(/```json|```/g, "").trim();
          const parsed = JSON.parse(clean);
          await db.execute(sql`UPDATE vault_confessions SET sentiment_legacy = ${JSON.stringify(parsed)} WHERE id = ${confession.id}`);
        } catch {}
      }).catch(() => {});

      res.json(confession);
    } catch { res.status(500).json({ error: "Errore nella creazione della confessione" }); }
  });

  app.delete("/api/vault/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const profile = await storage.getProfileByUserId(userId);
      if (!profile) return res.status(404).json({ error: "Profilo non trovato" });
      await storage.deleteVaultConfession(req.params.id, profile.id);
      res.json({ ok: true });
    } catch { res.status(500).json({ error: "Errore nella cancellazione" }); }
  });

  // ── VibraQuest ──────────────────────────────────────────────────────────────

  app.get("/api/quests", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const profile = await storage.getProfileByUserId(userId);
      if (!profile) return res.status(404).json({ error: "Profile not found" });
      const quests = await storage.getDailyQuests(profile.id);
      res.json(quests);
    } catch { res.status(500).json({ error: "Errore quests" }); }
  });

  app.post("/api/quests/:id/claim", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const profile = await storage.getProfileByUserId(userId);
      if (!profile) return res.status(404).json({ error: "Profile not found" });
      const result = await storage.claimQuestReward(req.params.id, profile.id);
      res.json(result);
    } catch (e: any) { res.status(400).json({ error: e.message || "Errore claim" }); }
  });

  // ── VibraLegacy ─────────────────────────────────────────────────────────────

  app.get("/api/legacy", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const profile = await storage.getProfileByUserId(userId);
      if (!profile) return res.status(404).json({ error: "Profile not found" });
      const legacy = await storage.getLegacy(profile.id);
      res.json(legacy ?? null);
    } catch { res.status(500).json({ error: "Errore legacy" }); }
  });

  app.post("/api/legacy", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const profile = await storage.getProfileByUserId(userId);
      if (!profile) return res.status(404).json({ error: "Profile not found" });
      const { message, revealAfterDays } = req.body;
      if (!message?.trim()) return res.status(400).json({ error: "Il messaggio è obbligatorio" });
      const legacy = await storage.saveLegacy(profile.id, {
        message: message.trim(),
        revealAfterDays: parseInt(revealAfterDays ?? "30") || 30,
      });
      res.json(legacy);
    } catch { res.status(500).json({ error: "Errore salvataggio legacy" }); }
  });

  app.delete("/api/legacy", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const profile = await storage.getProfileByUserId(userId);
      if (!profile) return res.status(404).json({ error: "Profile not found" });
      await storage.deleteLegacy(profile.id);
      res.json({ ok: true });
    } catch { res.status(500).json({ error: "Errore eliminazione legacy" }); }
  });

  // ── VibraMystery ─────────────────────────────────────────────────────────────

  app.get("/api/mystery/status", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const profile = await storage.getProfileByUserId(userId);
      if (!profile) return res.status(404).json({ error: "Profile not found" });
      res.json(await storage.getMysteryStatus(profile.id));
    } catch { res.status(500).json({ error: "Errore mystery status" }); }
  });

  app.post("/api/mystery/activate", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const profile = await storage.getProfileByUserId(userId);
      if (!profile) return res.status(404).json({ error: "Profile not found" });
      const hours = parseInt(req.body.hours ?? "24") || 24;
      const expiresAt = await storage.setMysteryMode(profile.id, Math.min(hours, 72));
      res.json({ active: true, expiresAt });
    } catch { res.status(500).json({ error: "Errore mystery activate" }); }
  });

  app.post("/api/mystery/deactivate", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const profile = await storage.getProfileByUserId(userId);
      if (!profile) return res.status(404).json({ error: "Profile not found" });
      await storage.deactivateMysteryMode(profile.id);
      res.json({ active: false, expiresAt: null });
    } catch { res.status(500).json({ error: "Errore mystery deactivate" }); }
  });

  // ── VibraConsent ─────────────────────────────────────────────────────────────

  app.get("/api/consent", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const profile = await storage.getProfileByUserId(userId);
      if (!profile) return res.status(404).json({ error: "Profile not found" });
      res.json(await storage.getPendingConsents(profile.id));
    } catch { res.status(500).json({ error: "Errore consent" }); }
  });

  app.post("/api/consent", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const profile = await storage.getProfileByUserId(userId);
      if (!profile) return res.status(404).json({ error: "Profile not found" });
      const { toProfileId, contentType, message } = req.body;
      if (!toProfileId || !contentType) return res.status(400).json({ error: "Dati mancanti" });
      const req_ = await storage.sendConsentRequest(profile.id, toProfileId, contentType, message);
      res.json(req_);
    } catch { res.status(500).json({ error: "Errore invio consenso" }); }
  });

  app.post("/api/consent/:id/respond", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const profile = await storage.getProfileByUserId(userId);
      if (!profile) return res.status(404).json({ error: "Profile not found" });
      const { status } = req.body;
      if (!["accepted", "declined"].includes(status)) return res.status(400).json({ error: "Status non valido" });
      await storage.respondConsentRequest(req.params.id, profile.id, status);
      res.json({ ok: true });
    } catch { res.status(500).json({ error: "Errore risposta consenso" }); }
  });

  // ── Costellazioni ─────────────────────────────────────────────────────────────

  app.get("/api/constellation", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const profile = await storage.getProfileByUserId(userId);
      if (!profile) return res.status(404).json({ error: "Profile not found" });
      let constellation = await storage.getMyConstellation(profile.id);
      if (!constellation) {
        const name = await storage.assignConstellation(profile.id);
        constellation = await storage.getMyConstellation(profile.id);
      }
      if (!constellation) return res.status(404).json({ error: "Costellazione non assegnata" });
      const members = await storage.getConstellationMembers(constellation.name);
      res.json({ constellation, members });
    } catch { res.status(500).json({ error: "Errore costellazione" }); }
  });

  app.post("/api/constellation/reassign", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const profile = await storage.getProfileByUserId(userId);
      if (!profile) return res.status(404).json({ error: "Profile not found" });
      const name = await storage.assignConstellation(profile.id);
      const constellation = await storage.getMyConstellation(profile.id);
      const members = await storage.getConstellationMembers(name);
      res.json({ constellation, members });
    } catch { res.status(500).json({ error: "Errore riassegnazione" }); }
  });

  // ── Eclissi ──────────────────────────────────────────────────────────────────

  app.get("/api/eclipse/status", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const profile = await storage.getProfileByUserId(userId);
      if (!profile) return res.status(404).json({ error: "Profile not found" });
      res.json(await storage.getEclipseStatus(profile.id));
    } catch { res.status(500).json({ error: "Errore eclipse status" }); }
  });

  app.post("/api/eclipse/activate", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const profile = await storage.getProfileByUserId(userId);
      if (!profile) return res.status(404).json({ error: "Profile not found" });
      const days = Math.min(parseInt(req.body.days ?? "1") || 1, 7);
      const until = await storage.activateEclipse(profile.id, days);
      res.json({ active: true, until });
    } catch { res.status(500).json({ error: "Errore eclipse activate" }); }
  });

  app.post("/api/eclipse/deactivate", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const profile = await storage.getProfileByUserId(userId);
      if (!profile) return res.status(404).json({ error: "Profile not found" });
      await storage.deactivateEclipse(profile.id);
      res.json({ active: false, until: null });
    } catch { res.status(500).json({ error: "Errore eclipse deactivate" }); }
  });

  // ── Pianeti ───────────────────────────────────────────────────────────────

  app.get("/api/planets/my-orbits", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const profile = await storage.getProfileByUserId(userId);
      if (!profile) return res.status(404).json({ error: "Profile not found" });
      const orbits = await storage.getTopOrbits(profile.id, 5);
      const gravity = await storage.getSocialGravity(profile.id);
      res.json({ orbits, gravity });
    } catch { res.status(500).json({ error: "Errore orbite" }); }
  });

  app.get("/api/planets/gravity/:profileId", isAuthenticated, async (req: any, res) => {
    try {
      const gravity = await storage.getSocialGravity(req.params.profileId);
      const orbits = await storage.getTopOrbits(req.params.profileId, 3);
      res.json({ gravity, orbits });
    } catch { res.status(500).json({ error: "Errore gravity" }); }
  });

  // ── VibraTime ─────────────────────────────────────────────────────────────

  app.get("/api/time/my-pattern", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const profile = await storage.getProfileByUserId(userId);
      if (!profile) return res.status(404).json({ error: "Profile not found" });
      const pattern = await storage.getActivityPattern(profile.id);
      const label = await storage.getActivityLabel(profile.id);
      res.json({ pattern, label });
    } catch { res.status(500).json({ error: "Errore pattern" }); }
  });

  app.get("/api/time/label/:profileId", isAuthenticated, async (req: any, res) => {
    try {
      const label = await storage.getActivityLabel(req.params.profileId);
      res.json({ label });
    } catch { res.status(500).json({ error: "Errore label" }); }
  });

  // ─── Cosa Faccio — offerte leisure filtrate per città e budget ───────────────
  app.get("/api/cosa-fare", isAuthenticated, async (req: any, res) => {
    try {
      const city = (req.query.city as string | undefined)?.trim();
      const maxPrice = req.query.max_price !== undefined ? parseInt(req.query.max_price as string) : undefined;
      const LEISURE_CATEGORIES = ['ristorante','concerto','discoteca','cinema','sagra','fiera','aperitivo','lastminute','weekend'];
      const conditions: any[] = [
        eq(hubPosts.status, "active"),
        sql`${hubPosts.category} = ANY(ARRAY[${sql.raw(LEISURE_CATEGORIES.map(c => `'${c}'`).join(","))}]::text[])`,
      ];
      if (city) conditions.push(sql`LOWER(${hubPosts.city}) = LOWER(${city})`);
      if (maxPrice !== undefined && maxPrice >= 0) {
        conditions.push(sql`(${hubPosts.price} IS NULL OR ${hubPosts.price} <= ${maxPrice})`);
      }
      const posts = await db.select().from(hubPosts)
        .where(and(...conditions))
        .orderBy(desc(hubPosts.createdAt))
        .limit(60);
      res.json(posts);
    } catch (e) {
      res.status(500).json({ error: "Errore interno" });
    }
  });

  // ─── Hub Posts (Marketplace · Casa · Lavoro) ─────────────────────────────────
  app.get("/api/hub-posts", isAuthenticated, async (req: any, res) => {
    try {
      const { category, subcategory } = req.query;
      const conditions = [eq(hubPosts.status, "active")];
      if (category) conditions.push(eq(hubPosts.category, category as string));
      if (subcategory) conditions.push(eq(hubPosts.subcategory, subcategory as string));
      const posts = await db.select().from(hubPosts)
        .where(and(...conditions))
        .orderBy(desc(hubPosts.createdAt))
        .limit(100);
      res.json(posts);
    } catch { res.status(500).json({ error: "Errore hub-posts" }); }
  });

  app.post("/api/hub-posts/upload-image", isAuthenticated, (req: any, res: any, next: any) => {
    memoryUpload.array("images", 6)(req, res, (err: any) => {
      if (err) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(400).json({ error: "Foto troppo grande. Massimo 5 MB." });
        }
        return res.status(400).json({ error: err.message || "Errore nel caricamento della foto" });
      }
      next();
    });
  }, async (req: any, res: any) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) return res.status(401).json({ error: "Non autenticato" });
      const files = (req.files || []) as Express.Multer.File[];
      if (files.length === 0) return res.status(400).json({ error: "Nessuna foto caricata" });

      const urls: string[] = [];
      for (const file of files) {
        const uploadURL = await objectStorageService.getMarketplaceImageUploadURL();
        const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);
        const putResponse = await fetch(uploadURL, {
          method: "PUT",
          body: file.buffer,
          headers: { "Content-Type": file.mimetype },
        });

        if (!putResponse.ok) {
          console.error("Marketplace image PUT failed:", putResponse.status, await putResponse.text().catch(() => ""));
          return res.status(500).json({ error: "Errore nel salvataggio di una foto. Riprova." });
        }

        await objectStorageService.trySetObjectEntityAclPolicy(objectPath, {
          owner: userId,
          visibility: "public",
        });
        urls.push(objectPath);
      }

      res.json({ urls });
    } catch (error: any) {
      console.error("Error uploading marketplace image:", error?.message || error);
      res.status(500).json({ error: "Errore nel caricamento della foto. Riprova." });
    }
  });

  app.post("/api/hub-posts", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) return res.status(401).json({ error: "Non autenticato" });
      const profile = await storage.getProfileByUserId(userId);
      if (!profile) return res.status(404).json({ error: "Profilo non trovato" });
      const imageUrls = Array.isArray(req.body.imageUrls)
        ? [...new Set(req.body.imageUrls.filter((url: unknown): url is string => typeof url === "string" && url.trim().length > 0))]
        : (typeof req.body.imageUrl === "string" && req.body.imageUrl.trim() ? [req.body.imageUrl.trim()] : []);
      if (req.body.category === "marketplace" && imageUrls.length < 3) {
        return res.status(400).json({ error: "Un annuncio Marketplace deve avere almeno 3 foto." });
      }
      if (imageUrls.length > 6) {
        return res.status(400).json({ error: "Puoi caricare al massimo 6 foto per annuncio." });
      }
      if (req.body.category === "marketplace") {
        const unavailablePhotosError = "Una o più foto non sono più disponibili o non appartengono al tuo account. Ricarica le foto mancanti e riprova.";
        const marketplaceUploadPath = /^\/objects\/marketplace\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        for (const imageUrl of imageUrls) {
          // New Marketplace listings may only attach purpose-scoped Marketplace uploads.
          // Generic legacy object URLs have no reliable ownership or purpose provenance.
          if (!marketplaceUploadPath.test(imageUrl)) {
            return res.status(400).json({ error: unavailablePhotosError });
          }

          try {
            const objectFile = await objectStorageService.getObjectEntityFile(imageUrl);
            const isOwnedUpload = await objectStorageService.canAccessObjectEntity({
              userId,
              objectFile,
              requestedPermission: ObjectPermission.WRITE,
            });
            if (!isOwnedUpload) {
              return res.status(400).json({ error: unavailablePhotosError });
            }
          } catch (error) {
            if (error instanceof ObjectNotFoundError) {
              return res.status(400).json({ error: unavailablePhotosError });
            }
            console.error("Error verifying Marketplace photo before publication:", error);
            return res.status(503).json({ error: "Non è stato possibile verificare le foto. Riprova tra poco." });
          }
        }
      }
      const parsed = insertHubPostSchema.safeParse({
        ...req.body,
        profileId: profile.id,
        profileName: profile.name,
        profileImageUrl: profile.imageUrl,
        imageUrl: imageUrls[0] || req.body.imageUrl || null,
        imageUrls,
      });
      if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
      const [post] = await db.insert(hubPosts).values(parsed.data).returning();
      res.json(post);
    } catch { res.status(500).json({ error: "Errore creazione post" }); }
  });

  app.patch("/api/hub-posts/:id/photos", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) return res.status(401).json({ error: "Non autenticato" });
      const profile = await storage.getProfileByUserId(userId);
      if (!profile) return res.status(403).json({ error: "Non autorizzato" });

      const [post] = await db.select().from(hubPosts).where(eq(hubPosts.id, req.params.id));
      if (!post) return res.status(404).json({ error: "Post non trovato" });
      if (post.category !== "marketplace") return res.status(404).json({ error: "Post Marketplace non trovato" });
      if (post.profileId !== profile.id) return res.status(403).json({ error: "Non autorizzato" });

      const { action, imageUrl } = req.body || {};
      if (!["replace", "remove"].includes(action) || typeof imageUrl !== "string" || !imageUrl.trim()) {
        return res.status(400).json({ error: "Modifica foto non valida" });
      }

      const imageUrls = Array.isArray(post.imageUrls) && post.imageUrls.length > 0
        ? [...post.imageUrls]
        : (post.imageUrl ? [post.imageUrl] : []);
      const imageIndex = imageUrls.indexOf(imageUrl);
      if (imageIndex < 0) return res.status(409).json({ error: "La foto dell'annuncio è già stata modificata" });

      if (action === "remove") {
        imageUrls.splice(imageIndex, 1);
      } else {
        const { replacementImageUrl } = req.body;
        if (typeof replacementImageUrl !== "string" || !/^\/objects\/marketplace\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(replacementImageUrl)) {
          return res.status(400).json({ error: "La nuova foto non è valida" });
        }
        if (imageUrls.includes(replacementImageUrl)) {
          return res.status(400).json({ error: "La nuova foto è già presente nell'annuncio" });
        }

        try {
          const replacementFile = await objectStorageService.getObjectEntityFile(replacementImageUrl);
          const isOwnedUpload = await objectStorageService.canAccessObjectEntity({
            userId,
            objectFile: replacementFile,
            requestedPermission: ObjectPermission.WRITE,
          });
          if (!isOwnedUpload) return res.status(403).json({ error: "La nuova foto non appartiene al tuo account" });
        } catch {
          return res.status(400).json({ error: "La nuova foto non è disponibile" });
        }
        imageUrls[imageIndex] = replacementImageUrl;
      }

      const updateConditions = [
        eq(hubPosts.id, post.id),
        eq(hubPosts.profileId, profile.id),
        sql`${hubPosts.imageUrls} = ARRAY[${sql.join(post.imageUrls.map((url) => sql`${url}`), sql`, `)}]::text[]`,
        post.imageUrl === null ? sql`${hubPosts.imageUrl} IS NULL` : eq(hubPosts.imageUrl, post.imageUrl),
      ];
      const [updated] = await db.update(hubPosts)
        .set({ imageUrls, imageUrl: imageUrls[0] || null })
        .where(and(...updateConditions))
        .returning();
      if (!updated) return res.status(409).json({ error: "Le foto dell'annuncio sono cambiate. Ricarica la pagina." });
      res.json(updated);
    } catch (error) {
      console.error("Error updating Marketplace photo:", error);
      res.status(500).json({ error: "Errore aggiornamento foto" });
    }
  });

  app.patch("/api/hub-posts/:id/status", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) return res.status(401).json({ error: "Non autenticato" });
      const profile = await storage.getProfileByUserId(userId);
      if (!profile) return res.status(403).json({ error: "Non autorizzato" });
      const { status } = req.body;
      if (!["active","sold","closed"].includes(status)) return res.status(400).json({ error: "Status non valido" });
      const [post] = await db.select().from(hubPosts).where(eq(hubPosts.id, req.params.id));
      if (!post || post.profileId !== profile.id) return res.status(403).json({ error: "Non autorizzato" });
      await db.update(hubPosts).set({ status }).where(eq(hubPosts.id, req.params.id));
      res.json({ ok: true });
    } catch { res.status(500).json({ error: "Errore aggiornamento status" }); }
  });

  app.delete("/api/hub-posts/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (!userId) return res.status(401).json({ error: "Non autenticato" });
      const profile = await storage.getProfileByUserId(userId);
      if (!profile) return res.status(403).json({ error: "Non autorizzato" });
      const [post] = await db.select().from(hubPosts).where(eq(hubPosts.id, req.params.id));
      if (!post) return res.status(404).json({ error: "Post non trovato" });
      if (post.profileId !== profile.id && !req.user.isAdmin) return res.status(403).json({ error: "Non autorizzato" });
      const [deleted] = await db.delete(hubPosts).where(eq(hubPosts.id, req.params.id)).returning();
      if (!deleted) return res.status(404).json({ error: "Post non trovato" });
      if (deleted.category === "marketplace") {
        const owner = await storage.getProfile(deleted.profileId).catch((error) => {
          console.error("Marketplace image cleanup owner lookup failed:", { postId: deleted.id }, error);
          return null;
        });
        const images = new Set([...(deleted.imageUrls || []), deleted.imageUrl].filter((url): url is string => typeof url === "string" && url.length > 0));
        for (const image of Array.from(images)) {
          // A saved URL can be reused by another listing. Never remove a shared object.
          try {
            const [reference] = await db.select({ id: hubPosts.id }).from(hubPosts)
              .where(sql`${hubPosts.imageUrl} = ${image} OR ${image} = ANY(${hubPosts.imageUrls}) OR ${hubPosts.profileImageUrl} = ${image}`)
              .limit(1);
            const [profileReference] = reference ? [null] : await db.select({ id: profiles.id }).from(profiles)
              .where(sql`${profiles.imageUrl} = ${image} OR ${image} = ANY(COALESCE(${profiles.photos}, ARRAY[]::text[])) OR ${profiles.profileVideoUrl} = ${image}`)
              .limit(1);
            if (!reference && !profileReference && owner?.userId) await objectStorageService.deleteListingImage(image, owner.userId);
          } catch (error) {
            console.error("Marketplace image cleanup failed:", { postId: deleted.id, image }, error);
          }
        }
      }
      res.json({ ok: true });
    } catch { res.status(500).json({ error: "Errore eliminazione post" }); }
  });

  // ─── Blog Posts (Giornale Comunitario) ────────────────────────────────────────
  app.get("/api/blog-posts", async (req, res) => {
    try {
      const category = req.query.category as string | undefined;
      const conditions = [eq(blogPosts.status, "active")];
      if (category && category !== "tutti") conditions.push(eq(blogPosts.category, category));
      const rows = await db.select({ post: blogPosts })
        .from(blogPosts)
        .innerJoin(
          profiles,
          and(eq(profiles.id, blogPosts.profileId), eq(profiles.moderationHidden, false)),
        )
        .where(and(...conditions))
        .orderBy(desc(blogPosts.createdAt))
        .limit(50);
      const list = rows.map((row) => row.post);
      res.json(list);
    } catch { res.status(500).json({ error: "Errore caricamento articoli" }); }
  });

  app.post("/api/blog-posts", isAuthenticated, async (req: any, res) => {
    try {
      const profile = await storage.getProfileByUserId(req.user.id);
      if (!profile) return res.status(403).json({ error: "Non autorizzato" });
      const body = { ...req.body, profileId: profile.id, profileName: profile.name || "Anonimo", profileImageUrl: profile.imageUrl || "" };
      const parsed = insertBlogPostSchema.parse(body);
      const [post] = await db.insert(blogPosts).values(parsed).returning();
      res.json(post);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: "Dati non validi", details: error.errors });
      res.status(500).json({ error: "Errore creazione articolo" });
    }
  });

  app.patch("/api/blog-posts/:id/like", isAuthenticated, async (req: any, res) => {
    try {
      const profile = await storage.getProfileByUserId(req.user.id);
      if (!profile) return res.status(403).json({ error: "Non autorizzato" });
      const [post] = await db.select().from(blogPosts).where(eq(blogPosts.id, req.params.id));
      if (!post) return res.status(404).json({ error: "Articolo non trovato" });
      const current = post.likes || [];
      const hasLiked = current.includes(profile.id);
      const newLikes = hasLiked ? current.filter((id: string) => id !== profile.id) : [...current, profile.id];
      const [updated] = await db.update(blogPosts).set({ likes: newLikes, likesCount: newLikes.length }).where(eq(blogPosts.id, req.params.id)).returning();
      res.json({ post: updated, liked: !hasLiked });
    } catch { res.status(500).json({ error: "Errore like" }); }
  });

  app.delete("/api/blog-posts/:id", isAuthenticated, async (req: any, res) => {
    try {
      const profile = await storage.getProfileByUserId(req.user.id);
      if (!profile) return res.status(403).json({ error: "Non autorizzato" });
      const [post] = await db.select().from(blogPosts).where(eq(blogPosts.id, req.params.id));
      if (!post) return res.status(404).json({ error: "Non trovato" });
      if (post.profileId !== profile.id && !req.user.isAdmin) return res.status(403).json({ error: "Non autorizzato" });
      await db.delete(blogPosts).where(eq(blogPosts.id, req.params.id));
      res.json({ ok: true });
    } catch { res.status(500).json({ error: "Errore eliminazione" }); }
  });

  // ─── Vibra Events ─────────────────────────────────────────────────────────────
  app.get("/api/events", async (req, res) => {
    try {
      const city = req.query.city as string | undefined;
      const type = req.query.type as string | undefined;
      const conditions = [eq(events.status, "active")];
      if (city) conditions.push(sql`LOWER(${events.city}) = LOWER(${city})`);
      if (type) conditions.push(eq(events.eventType, type));
      const list = await db.select().from(events).where(and(...conditions)).orderBy(desc(events.createdAt)).limit(50);
      res.json(list);
    } catch { res.status(500).json({ error: "Errore caricamento eventi" }); }
  });

  app.post("/api/events", isAuthenticated, async (req: any, res) => {
    try {
      const profile = await storage.getProfileByUserId(req.user.id);
      if (!profile) return res.status(403).json({ error: "Non autorizzato" });
      const body = { ...req.body, profileId: profile.id, profileName: profile.name || "Anonimo", profileImageUrl: profile.imageUrl || "" };
      const parsed = insertEventSchema.parse(body);
      const [event] = await db.insert(events).values(parsed).returning();
      res.json(event);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: "Dati evento non validi", details: error.errors });
      res.status(500).json({ error: "Errore creazione evento" });
    }
  });

  app.patch("/api/events/:id/going", isAuthenticated, async (req: any, res) => {
    try {
      const profile = await storage.getProfileByUserId(req.user.id);
      if (!profile) return res.status(403).json({ error: "Non autorizzato" });
      const [event] = await db.select().from(events).where(eq(events.id, req.params.id));
      if (!event) return res.status(404).json({ error: "Evento non trovato" });
      const current = event.attendees || [];
      const isGoing = current.includes(profile.id);
      const newAttendees = isGoing ? current.filter((id: string) => id !== profile.id) : [...current, profile.id];
      const [updated] = await db.update(events).set({ attendees: newAttendees, goingCount: newAttendees.length }).where(eq(events.id, req.params.id)).returning();
      res.json({ event: updated, going: !isGoing });
    } catch { res.status(500).json({ error: "Errore aggiornamento" }); }
  });

  app.patch("/api/events/:id/status", isAuthenticated, async (req: any, res) => {
    try {
      const profile = await storage.getProfileByUserId(req.user.id);
      if (!profile) return res.status(403).json({ error: "Non autorizzato" });
      const { status } = req.body;
      if (!["active","closed"].includes(status)) return res.status(400).json({ error: "Status non valido" });
      const [event] = await db.select().from(events).where(eq(events.id, req.params.id));
      if (!event || (event.profileId !== profile.id && !req.user.isAdmin)) return res.status(403).json({ error: "Non autorizzato" });
      const [updated] = await db.update(events).set({ status }).where(eq(events.id, req.params.id)).returning();
      res.json(updated);
    } catch { res.status(500).json({ error: "Errore aggiornamento status" }); }
  });

  app.delete("/api/events/:id", isAuthenticated, async (req: any, res) => {
    try {
      const profile = await storage.getProfileByUserId(req.user.id);
      if (!profile) return res.status(403).json({ error: "Non autorizzato" });
      const [event] = await db.select().from(events).where(eq(events.id, req.params.id));
      if (!event) return res.status(404).json({ error: "Evento non trovato" });
      if (event.profileId !== profile.id && !req.user.isAdmin) return res.status(403).json({ error: "Non autorizzato" });
      await db.delete(events).where(eq(events.id, req.params.id));
      res.json({ ok: true });
    } catch { res.status(500).json({ error: "Errore eliminazione evento" }); }
  });

  // ─── Vibra AI Search ──────────────────────────────────────────────────────────
  app.post("/api/ai-search", isAuthenticated, async (req: any, res) => {
    try {
      const { query } = req.body;
      if (!query || typeof query !== "string") return res.status(400).json({ error: "Query mancante" });

      const systemPrompt = `Sei l'assistente AI di Vibra, una super-app italiana. 
Analizza la richiesta dell'utente e rispondi con un JSON che indica dove indirizzarlo.

Le sezioni interne di Vibra sono:
- / → scoprire profili, swipe, dating, incontrare gente, conoscere persone
- /matches → match, chat, messaggi, conversazioni
- /rooms → stanze, community, gruppi, interessi comuni
- /challenges → sfide, challenge, foto, concorsi
- /private-rooms → stanze private, club esclusivi
- /signals → segnali cosmici, post, feed, condividere pensieri, confessioni pubbliche
- /vibing → Sto Vibing Ora, persone vicine, chi è online
- /vibrapp → Vibrapp, chat globale, messaggi a tutti
- /prima-impressione → Prima Impressione, valutazione profilo, feedback
- /profile → profilo personale, modifica profilo
- /reels → video, reels, storie video
- /blog → blog, notizie, articoli
- /dove-sei → mappa, posizione, chi è vicino
- /quests → missioni, quest, punti, ricompense
- /vault → vault, segreti
- /constellations → costellazioni, compatibilità

Per richieste esterne usa external_url:
- taxi, uber, mytaxi → https://www.uber.com/it/it/ride/
- autobus, bus, trasporti, atm, gtts, transport → https://www.google.com/maps/dir/?api=1&travelmode=transit
- treno, trenitalia, italo → https://www.trenitalia.com
- ristorante, mangiare, cibo, pizzeria, locale, bar → https://www.thefork.it
- hotel, dormire, alloggio, b&b → https://www.booking.com
- voli, aereo, volare → https://www.skyscanner.it
- compra, vendi, marketplace, usato, second hand, annunci → https://www.subito.it
- lavoro, offerte lavoro, cerco lavoro → https://www.linkedin.com/jobs
- affitto, casa, appartamento, stanza → https://www.immobiliare.it
- farmacia, medico, dottore, salute → https://www.miodottore.it
- meteo, tempo, pioggia → https://www.ilmeteo.it
- notizie, news → https://www.ansa.it
- musica, spotify, canzoni → https://open.spotify.com
- film, cinema, serie → https://www.justwatch.com/it

Rispondi SOLO con questo JSON (nessun altro testo):
{
  "action": "navigate" | "external" | "none",
  "route": "/percorso-interno" | null,
  "external_url": "https://..." | null,
  "message": "Messaggio breve e amichevole in italiano (max 20 parole)",
  "emoji": "un emoji pertinente"
}`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: query }
        ],
        response_format: { type: "json_object" },
        max_tokens: 200,
        temperature: 0.3,
      });

      const result = JSON.parse(completion.choices[0].message.content || "{}");
      res.json(result);
    } catch (e) {
      console.error("[ai-search] error:", e);
      // Keep the banner usable even when the AI provider is unavailable or slow.
      res.json(getAiSearchFallback(String(req.body?.query || "")));
    }
  });

  // ─── Visite al profilo ────────────────────────────────────────────────────────

  app.post("/api/profiles/:id/visit", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      const viewer = await storage.getProfileByUserId(userId);
      if (!viewer) return res.status(404).json({ error: "Profile not found" });

      const viewedId = req.params.id;
      if (viewer.id === viewedId) return res.json({ ok: true });

      const viewedProfile = await storage.getProfile(viewedId);
      if (!viewedProfile || viewedProfile.isBot) return res.json({ ok: true });

      const now = new Date();
      const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const [existing] = await db
        .select()
        .from(profileViews)
        .where(
          and(
            eq(profileViews.viewerId, viewer.id),
            eq(profileViews.viewedId, viewedId),
            gt(profileViews.viewedAt, since24h)
          )
        )
        .limit(1);

      if (!existing) {
        await db.insert(profileViews).values({
          viewerId: viewer.id,
          viewedId,
        });

        await sendPushToProfile(viewedId, {
          title: `👀 Qualcuno ha visitato il tuo profilo`,
          body: `${viewer.name}, ${viewer.age} anni da ${viewer.location || "Italia"} ha visitato il tuo profilo`,
          icon: viewer.imageUrl || "/icons/icon-192.png",
          url: `/profile`,
          type: "profile-visit",
        });
      }

      res.json({ ok: true });
    } catch (err) {
      console.error("[profile-visit] error:", err);
      res.status(500).json({ error: "Errore interno" });
    }
  });

  app.get("/api/profiles/visitors", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      const profile = await storage.getProfileByUserId(userId);
      if (!profile) return res.status(404).json({ error: "Profile not found" });

      const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      const rows = await db
        .select({
          viewerId: profileViews.viewerId,
          viewedAt: profileViews.viewedAt,
        })
        .from(profileViews)
        .where(
          and(
            eq(profileViews.viewedId, profile.id),
            gt(profileViews.viewedAt, since7d)
          )
        )
        .orderBy(desc(profileViews.viewedAt))
        .limit(50);

      const uniqueViewerIds = [...new Set(rows.map((r) => r.viewerId))];
      const visitorProfiles = await Promise.all(
        uniqueViewerIds.map((id) => storage.getProfile(id))
      );

      const visitors = uniqueViewerIds
        .map((id) => {
          const p = visitorProfiles.find((vp) => vp?.id === id);
          const row = rows.find((r) => r.viewerId === id);
          if (!p) return null;
          return {
            id: p.id,
            name: p.name,
            age: p.age,
            imageUrl: p.imageUrl,
            location: p.location,
            viewedAt: row?.viewedAt,
          };
        })
        .filter(Boolean);

      res.json(visitors);
    } catch (err) {
      console.error("[profile-visitors] error:", err);
      res.status(500).json({ error: "Errore interno" });
    }
  });

  // ─── Bot Re-engagement Job (ogni 8 ore) ──────────────────────────────────────
  async function runBotReengagementJob() {
    try {
      console.log("[bot-reengagement] Starting job...");
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

      const allMatches = await db.select().from(matches);

      let sent = 0;
      for (const match of allMatches) {
        try {
          const [p1, p2] = await Promise.all([
            storage.getProfile(match.profile1Id),
            storage.getProfile(match.profile2Id),
          ]);
          if (!p1 || !p2) continue;

          const botProfile = p1.isBot ? p1 : p2.isBot ? p2 : null;
          const realProfile = p1.isBot ? p2 : p2.isBot ? p1 : null;
          if (!botProfile || !realProfile) continue;

          const matchMessages = await db
            .select()
            .from(messages)
            .where(eq(messages.matchId, match.id))
            .orderBy(desc(messages.createdAt))
            .limit(1);

          const lastMsg = matchMessages[0];
          if (lastMsg && new Date(lastMsg.createdAt) > threeDaysAgo) continue;
          if (lastMsg && lastMsg.senderId === botProfile.id) continue;

          const delayMs = Math.random() * 4 * 60 * 60 * 1000;
          setTimeout(async () => {
            try {
              const text = await generateBotReengagement(
                botProfile,
                realProfile,
                lastMsg?.content
              );
              await storage.createMessage({
                matchId: match.id,
                senderId: botProfile.id,
                content: text,
              });
              sendPushToProfile(realProfile.id, {
                title: `💫 ${botProfile.name} ti ha scritto!`,
                body: text.substring(0, 100),
                icon: botProfile.imageUrl || "/icons/icon-192.png",
                url: `/chat/${match.id}`,
                type: "bot-reengagement",
              });
              console.log(`[bot-reengagement] Sent from ${botProfile.name} → ${realProfile.name}`);
            } catch (e) {
              console.error("[bot-reengagement] send error:", e);
            }
          }, delayMs);

          sent++;
          if (sent >= 20) break;
        } catch {}
      }
      console.log(`[bot-reengagement] Job done — queued ${sent} messages`);
    } catch (err) {
      console.error("[bot-reengagement] job error:", err);
    }
  }

  // Bot re-engagement is intentionally disabled. Vibra now serves real users only.

  // ─── Bot Visit Job ────────────────────────────────────────────────────────────
  async function runBotVisitJob() {
    try {
      console.log("[bot-visit] Starting job...");

      // Fetch all real users and all bots
      const [realProfiles, botProfiles] = await Promise.all([
        db.execute(sql`SELECT id, name, age, location, image_url FROM profiles WHERE is_bot = false AND id IS NOT NULL`),
        db.execute(sql`SELECT id, name, age, location, image_url FROM profiles WHERE is_bot = true`),
      ]);

      const reals = (realProfiles as any).rows ?? realProfiles;
      const bots  = (botProfiles  as any).rows ?? botProfiles;

      if (!bots.length || !reals.length) return;

      const since48h = new Date(Date.now() - 48 * 60 * 60 * 1000);
      let sent = 0;

      for (const realUser of reals) {
        try {
          // ~40% probability per run so not every user gets a visit every day
          if (Math.random() > 0.4) continue;

          // Pick a bot that hasn't visited this user in the last 48h
          const recentVisitors = await db
            .select({ viewerId: profileViews.viewerId })
            .from(profileViews)
            .where(
              and(
                eq(profileViews.viewedId, realUser.id),
                gt(profileViews.viewedAt, since48h)
              )
            );

          const recentIds = new Set(recentVisitors.map((r: any) => r.viewerId));
          const eligible = bots.filter((b: any) => !recentIds.has(b.id));
          if (!eligible.length) continue;

          const bot = eligible[Math.floor(Math.random() * eligible.length)];

          // Record the visit
          await db.insert(profileViews).values({
            viewerId: bot.id,
            viewedId: realUser.id,
          }).onConflictDoNothing();

          // Send push notification
          await sendPushToProfile(realUser.id, {
            title: `👀 Qualcuno ha visitato il tuo profilo`,
            body: `${bot.name}, ${bot.age} anni da ${bot.location || "Italia"} ha visitato il tuo profilo`,
            icon: bot.image_url || "/icons/icon-192.png",
            url: `/profile`,
            type: "profile-visit",
          });

          sent++;
          console.log(`[bot-visit] ${bot.name} → ${realUser.name}`);
        } catch {}
      }

      console.log(`[bot-visit] Job done — notified ${sent} users`);
    } catch (err) {
      console.error("[bot-visit] job error:", err);
    }
  }

  // Run once 2 minutes after startup, then every 24h
  // Simulated bot visits are intentionally disabled. Vibra now serves real users only.

  // ─────────────────────────────────────────────────────────────────────────────

  return httpServer;
}

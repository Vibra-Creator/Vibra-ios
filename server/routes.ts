import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertSwipeSchema, insertProfileSchema, updateProfileSchema, insertMessageSchema, swipes, matches, messages, profiles, sentGifts, challengeSubmissions, dailyChallenges, roomMembers, roomMessages, privateRooms, privateRoomMessages, privateRoomRequests, profileRatings, blockedUsers, reports, vibingSessions, locationShares, users, referrals, appSettings, vibrappMessages, pushSubscriptions } from "@shared/schema";
import { db } from "./db";
import { eq, or, and, ne, sql, lt, desc, asc } from "drizzle-orm";
import { z } from "zod";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import multer from "multer";
import path from "path";
import fs from "fs";
import { randomUUID } from "crypto";
import { registerObjectStorageRoutes, ObjectStorageService } from "./replit_integrations/object_storage";
import OpenAI from "openai";
import { createBackup, getBackupList, startAutoBackup } from "./backup";
import { Server as SocketIOServer } from "socket.io";
import { getSession } from "./replit_integrations/auth/replitAuth";
import webpush from "web-push";

const OFFENSIVE_WORDS = [
  "cazzo", "minchia", "stronzo", "stronza", "vaffanculo", "puttana", "troia",
  "bastardo", "bastarda", "coglione", "cogliona", "merda", "fanculo", "porco",
  "negro", "negra", "frocio", "finocchio", "ritardato", "ritardata",
  "mongoloide", "handicappato", "deficiente", "idiota",
  "ti ammazzo", "ti uccido", "crepa", "muori", "suicidati",
  "fuck", "shit", "bitch", "asshole", "nigger", "faggot", "retard",
  "dick pic", "nudes", "sesso orale",
];

function filterOffensiveContent(text: string): string {
  let filtered = text;
  for (const word of OFFENSIVE_WORDS) {
    const regex = new RegExp(word.replace(/\s+/g, "\\s+"), "gi");
    filtered = filtered.replace(regex, (match) => "*".repeat(match.length));
  }
  return filtered;
}

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

async function generateBotReply(
  botProfile: any,
  userProfile: any,
  chatHistory: { senderId: string; content: string }[]
): Promise<string> {
  try {
    const recentMessages = chatHistory.slice(-10);

    const systemPrompt = `Sei ${botProfile.name}, ${botProfile.gender === "Uomo" ? "un ragazzo" : "una ragazza"} di ${botProfile.age} anni che vive a ${botProfile.location}. ${botProfile.bio}

I tuoi interessi sono: ${(botProfile.interests || []).join(", ")}.
${botProfile.education ? `Istruzione: ${botProfile.education}.` : ""}
${botProfile.zodiacSign ? `Segno zodiacale: ${botProfile.zodiacSign}.` : ""}
${botProfile.communicationStyle ? `Stile comunicativo: ${botProfile.communicationStyle}.` : ""}
${botProfile.lifestyle ? `Stile di vita: ${botProfile.lifestyle}.` : ""}
${botProfile.loveLanguage ? `Linguaggio dell'amore: ${botProfile.loveLanguage}.` : ""}

Stai chattando su un'app di incontri con ${userProfile.name}.

REGOLE IMPORTANTI:
- Rispondi come una persona vera, naturale e rilassata.
- Usa italiano colloquiale, come una vera chat WhatsApp (1-3 frasi brevi).
- RISPONDI alle domande che ti vengono fatte, non cambiare argomento.
- NON fare troppe domande di fila. Se l'altro ti ha chiesto qualcosa, rispondi e basta. Puoi aggiungere UNA domanda ogni tanto, non sempre.
- NON essere ${botProfile.gender === "Uomo" ? "invadente" : "invadente"}. Non chiedere subito di vedersi, non insistere, non essere ${botProfile.gender === "Uomo" ? "appiccicoso" : "appiccicosa"}.
- Sii ${botProfile.gender === "Uomo" ? "genuino" : "genuina"} e ${botProfile.gender === "Uomo" ? "tranquillo" : "tranquilla"}. Flirta solo se l'altro flirta prima.
- Usa al massimo 1 emoji, oppure nessuno. Mai faccine esagerate.
- Non ripetere frasi già dette nella conversazione.
- Non dire MAI che sei un bot, un'IA o un programma. Sei una persona reale.
- Se non sai cosa dire, commenta qualcosa di semplice sulla giornata o su un tuo interesse.`;

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
      max_tokens: 150,
      temperature: 0.9,
    });

    return response.choices[0]?.message?.content || "Scusa, non ho capito bene... puoi ripetere?";
  } catch (error) {
    console.error("Error generating bot reply:", error);
    const fallbackReplies = [
      "Che bello! Raccontami di più",
      "Mi piace come la pensi!",
      "Davvero interessante, dimmi di più",
      "Ah che carino! E tu cosa fai di bello?",
      "Mi fa piacere sentirti, continua pure",
    ];
    return fallbackReplies[Math.floor(Math.random() * fallbackReplies.length)];
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

const objectStorageService = new ObjectStorageService();

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.get("/sw.js", (req, res, next) => {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    next();
  });

  app.get("/download/upload_certificate.pem", (req, res) => {
    const pemPath = path.join(process.cwd(), "client", "public", "upload_certificate.pem");
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
  registerObjectStorageRoutes(app);

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
      const userId = req.user?.claims?.sub;
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
      } else {
        console.log(`[/api/profiles/me] userId=${userId} NO PROFILE FOUND`);
      }
      res.json(profile || null);
    } catch (error) {
      console.error("Error fetching user profile:", error);
      res.status(500).json({ error: "Failed to fetch profile" });
    }
  });
  
  app.get("/api/profiles", async (req, res) => {
    try {
      const profiles = await storage.getProfiles();
      res.json(profiles);
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
      const swipedIds = await storage.getSwipedProfileIds(profileId);
      const likedIds = await storage.getLikedProfileIds(profileId);
      const likedSet = new Set(likedIds);
      const dislikedSet = new Set(swipedIds.filter(id => !likedSet.has(id)));
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

      let afterSelf = 0, afterSwiped = 0, afterBlocked = 0, afterGender = 0, afterAge = 0, afterDist = 0;
      const swipable = allProfiles.filter(p => {
        if (p.id === profileId) return false;
        afterSelf++;
        if (dislikedSet.has(p.id)) return false;
        afterSwiped++;
        if (blockedSet.has(p.id)) return false;
        afterBlocked++;

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

      console.log(`[SWIPABLE] user=${myProfile?.name} total=${allProfiles.length} afterSelf=${afterSelf} afterSwiped=${afterSwiped} afterBlocked=${afterBlocked} afterGender=${afterGender} afterAge=${afterAge} afterDist=${afterDist} final=${swipable.length} | prefs: gender=${myProfile?.preferredGender} ageMin=${myProfile?.preferredAgeMin} ageMax=${myProfile?.preferredAgeMax} maxDist=${myProfile?.maxDistanceKm}`);

      const now = new Date();
      swipable.sort((a, b) => {
        const aHL = a.highlightedUntil && new Date(a.highlightedUntil) > now ? 1 : 0;
        const bHL = b.highlightedUntil && new Date(b.highlightedUntil) > now ? 1 : 0;
        return bHL - aHL;
      });

      const profilesWithDistance = swipable.map(p => {
        if (myProfile?.profileLatitude && myProfile?.profileLongitude && p.profileLatitude && p.profileLongitude) {
          const dist = haversineKm(myProfile.profileLatitude, myProfile.profileLongitude, p.profileLatitude, p.profileLongitude);
          return { ...p, distanceKm: Math.round(dist) };
        }
        return p;
      });

      res.json({ profiles: profilesWithDistance, likedIds });
    } catch (error) {
      console.error("Error fetching swipable profiles:", error);
      res.status(500).json({ error: "Failed to fetch profiles" });
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

  app.get("/api/profiles/:id", async (req, res) => {
    try {
      const profile = await storage.getProfile(req.params.id);
      if (!profile) {
        return res.status(404).json({ error: "Profile not found" });
      }
      res.json(profile);
    } catch (error) {
      console.error("Error fetching profile:", error);
      res.status(500).json({ error: "Failed to fetch profile" });
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
      await db.delete(reports).where(or(eq(reports.reporterId, profileId), eq(reports.reportedId, profileId)));
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

  app.put("/api/profiles/:id", async (req, res) => {
    try {
      const existing = await storage.getProfile(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Profile not found" });
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

      let userProfile = await storage.getProfileByUserId(userId);
      
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
        owner: userId,
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

  app.delete("/api/profiles/photo", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Not authenticated" });

      const userProfile = await storage.getProfileByUserId(userId);
      if (!userProfile) return res.status(403).json({ error: "Profile not found" });

      const { photoUrl } = req.body;
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

      const userProfile = await storage.getProfileByUserId(userId);
      if (!userProfile) return res.status(403).json({ error: "Profile not found" });

      const { photoUrl } = req.body;
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
      
      let match = false;
      let matchData = null;
      
      if (validatedData.liked) {
        const swipedProfile = await storage.getProfile(validatedData.swipedId);
        
        if (!swipedProfile) {
          return res.status(404).json({ error: "Profile not found" });
        }
        
        if (swipedProfile.isBot) {
          const existingBotSwipe = await storage.getSwipe(validatedData.swipedId, validatedData.swiperId);
          if (!existingBotSwipe) {
            await storage.createSwipe({
              swiperId: validatedData.swipedId,
              swipedId: validatedData.swiperId,
              liked: true,
            });
            console.log(`[SWIPE] Bot ${validatedData.swipedId} auto-liked back ${validatedData.swiperId}`);
          }
          
          const existingMatch = await storage.getMatch(validatedData.swiperId, validatedData.swipedId);
          if (!existingMatch) {
            matchData = await storage.createMatch({
              profile1Id: validatedData.swiperId,
              profile2Id: validatedData.swipedId,
            });
            match = true;
            console.log(`[SWIPE] BOT MATCH CREATED! ${validatedData.swiperId} <-> ${validatedData.swipedId}`);
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

  const ADMIN_EMAILS = ["famax61@yahoo.com", "famax61@gmail.com"];

  const isAdmin = async (req: any, res: any, next: any) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(403).json({ error: "Admin access required" });
      }

      if (!user.isAdmin && user.email && ADMIN_EMAILS.includes(user.email.toLowerCase())) {
        await db.update(users).set({ isAdmin: true }).where(eq(users.id, userId));
        user.isAdmin = true;
      }

      if (!user.isAdmin) {
        return res.status(403).json({ error: "Admin access required" });
      }
      
      next();
    } catch (error) {
      res.status(500).json({ error: "Server error" });
    }
  };

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
      
      const sanitizedUsers = users.map(({ password, ...u }) => u);
      res.json({
        totalUsers: users.length,
        totalProfiles: realProfiles.length,
        totalMatches: realMatches.length,
        totalMessages: realMessages.length,
        realSubscriberCount: realSubscribers.length,
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
      const report = await storage.updateReportStatus(req.params.id, status);
      res.json(report);
    } catch (error) {
      res.status(500).json({ error: "Failed to update report" });
    }
  });

  // User report from any authenticated user
  app.post("/api/reports", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const profile = await storage.getProfileByUserId(userId);
      if (!profile) return res.status(404).json({ error: "Profile not found" });

      const { reportedId, reason, description } = req.body;
      if (!reportedId || !reason) return res.status(400).json({ error: "reportedId and reason are required" });

      const report = await storage.createReport({ reporterId: profile.id, reportedId, reason, description });
      res.json(report);
    } catch (error) {
      res.status(500).json({ error: "Failed to create report" });
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
      
      const filteredContent = filterOffensiveContent(content);
      
      const message = await storage.createMessage({
        matchId,
        senderId: userProfile.id,
        content: filteredContent,
      });
      res.status(201).json(message);

      const otherProfileId = match.profile1Id === userProfile.id ? match.profile2Id : match.profile1Id;

      sendPushToProfile(otherProfileId, {
        title: userProfile.name,
        body: filteredContent.substring(0, 100),
        icon: "/icons/icon-192.png",
        url: `/chat/${matchId}`,
      });

      const otherProfile = await storage.getProfile(otherProfileId);
      if (otherProfile && otherProfile.isBot) {
        const delay = 2000 + Math.random() * 4000;
        setTimeout(async () => {
          try {
            const allMessages = await storage.getMessagesForMatch(matchId);
            const botReply = await generateBotReply(otherProfile, userProfile, allMessages);
            await storage.createMessage({
              matchId,
              senderId: otherProfile.id,
              content: botReply,
            });
          } catch (err) {
            console.error("Bot auto-reply error:", err);
          }
        }, delay);
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

  app.post("/api/rooms/:id/join", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Not authenticated" });
      const userProfile = await storage.getProfileByUserId(userId);
      if (!userProfile) return res.status(403).json({ error: "Profile not found" });

      await storage.joinRoom(req.params.id, userProfile.id);
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
              content: `Sei un moderatore di una app di incontri. Devi verificare se una foto caricata da un utente è REALMENTE attinente al tema di una sfida giornaliera. Rispondi SOLO con un JSON: {"approved": true/false, "reason": "motivo breve in italiano"}.

REGOLE IMPORTANTI:
- La foto DEVE mostrare chiaramente qualcosa di collegato al tema della sfida
- NON approvare foto generiche, selfie casuali, o immagini che non c'entrano con il tema
- NON approvare screenshot, meme, o immagini scaricate da internet
- Rifiuta foto offensive, inappropriata, con nudità o contenuti sessuali
- Sii ragionevolmente severo: la foto deve dimostrare che l'utente ha davvero fatto lo sforzo di completare la sfida
- Se la sfida chiede un selfie o una foto personale, deve essere una foto reale e non una foto trovata online`
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

      console.log(`Challenge submission created: challengeId=${req.params.id} profileId=${userProfile.id} imageUrl=${objectPath} submissionId=${submission.id}`);
      res.status(201).json({ ...submission, status: "pending", message: "Foto caricata! In attesa di approvazione dall'admin." });
    } catch (error: any) {
      console.error("Error submitting challenge:", error?.message || error, error?.stack);
      res.status(500).json({ error: "Errore nel caricamento della foto. Riprova." });
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

      const block = await storage.blockUser(profile.id, blockedId);
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

  async function sendPushToProfile(targetProfileId: string, payload: { title: string; body: string; icon?: string; url?: string }) {
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
      const userId = req.session?.userId;
      const profile = await storage.getProfileByUserId(userId);
      if (!profile) return res.status(404).json({ error: "Profile not found" });

      const { endpoint, keys } = req.body;
      if (!endpoint || !keys?.p256dh || !keys?.auth) {
        return res.status(400).json({ error: "Invalid subscription" });
      }

      const existing = await db.select().from(pushSubscriptions)
        .where(and(eq(pushSubscriptions.profileId, profile.id), eq(pushSubscriptions.endpoint, endpoint)));

      if (existing.length === 0) {
        await db.insert(pushSubscriptions).values({
          profileId: profile.id,
          endpoint,
          p256dh: keys.p256dh,
          auth: keys.auth,
        });
      }

      res.json({ success: true });
    } catch (err) {
      console.error("[push] subscribe error:", err);
      res.status(500).json({ error: "Failed to subscribe" });
    }
  });

  app.delete("/api/push/unsubscribe", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session?.userId;
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

  const sessionMiddleware = getSession();
  io.use((socket, next) => {
    const req = socket.request as any;
    const res = { end: () => {} } as any;
    sessionMiddleware(req, res, () => {
      if (!req.session?.userId) {
        return next(new Error("Unauthorized"));
      }
      next();
    });
  });

  const vibrappOnlineUsers = new Map<string, Set<string>>();
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

    socket.on("vibrapp:message", async (data: {
      content: string;
      replyToId?: string;
      replyToName?: string;
      replyToContent?: string;
    }) => {
      try {
        if (!data.content || typeof data.content !== "string") return;
        const content = data.content.trim().substring(0, MAX_MSG_LENGTH);
        if (!content) return;

        const filteredContent = filterOffensiveContent(content);

        let replyToSenderId: string | null = null;
        if (data.replyToId) {
          try {
            const [repliedMsg] = await db.select().from(vibrappMessages).where(eq(vibrappMessages.id, data.replyToId));
            if (repliedMsg) {
              replyToSenderId = repliedMsg.senderId;
            }
          } catch {}
        }

        const [msg] = await db.insert(vibrappMessages).values({
          senderId: profileId,
          senderName: userProfile.name,
          senderImage: userProfile.imageUrl,
          content: filteredContent,
          replyToId: data.replyToId || null,
          replyToSenderId: replyToSenderId,
          replyToName: data.replyToName || null,
          replyToContent: data.replyToContent ? data.replyToContent.substring(0, 100) : null,
        }).returning();

        if (data.replyToId && replyToSenderId) {
          io.to(`user:${profileId}`).to(`user:${replyToSenderId}`).emit("vibrapp:new-message", msg);

          if (replyToSenderId !== profileId) {
            sendPushToProfile(replyToSenderId, {
              title: "Vibrapp",
              body: `${userProfile.name}: ${filteredContent.substring(0, 100)}`,
              icon: "/icons/icon-192.png",
              url: "/vibrapp",
            });
          }
        } else {
          io.emit("vibrapp:new-message", msg);
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

      const visibilityFilter = or(
        sql`${vibrappMessages.replyToId} IS NULL`,
        eq(vibrappMessages.senderId, profileId),
        eq(vibrappMessages.replyToSenderId, profileId)
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

  app.get("/api/vibrapp/online-count", isAuthenticated, async (req: any, res) => {
    res.json({ count: vibrappOnlineUsers.size });
  });

  return httpServer;
}

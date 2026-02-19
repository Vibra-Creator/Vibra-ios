import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertSwipeSchema, insertProfileSchema, updateProfileSchema, insertMessageSchema, swipes, matches, messages, profiles, sentGifts, challengeSubmissions, dailyChallenges, roomMembers, roomMessages, privateRooms, privateRoomMessages, privateRoomRequests, profileRatings, blockedUsers, reports, vibingSessions, locationShares, users } from "@shared/schema";
import { db } from "./db";
import { eq, or, and, ne } from "drizzle-orm";
import { z } from "zod";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import multer from "multer";
import path from "path";
import fs from "fs";
import { randomUUID } from "crypto";
import { registerObjectStorageRoutes, ObjectStorageService } from "./replit_integrations/object_storage";
import OpenAI from "openai";

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

    const systemPrompt = `Sei ${botProfile.name}, una ${botProfile.gender === "Uomo" ? "ragazzo" : "ragazza"} di ${botProfile.age} anni che vive a ${botProfile.location}. ${botProfile.bio}

I tuoi interessi sono: ${(botProfile.interests || []).join(", ")}.
${botProfile.education ? `Istruzione: ${botProfile.education}.` : ""}
${botProfile.zodiacSign ? `Segno zodiacale: ${botProfile.zodiacSign}.` : ""}
${botProfile.communicationStyle ? `Il tuo stile comunicativo è: ${botProfile.communicationStyle}.` : ""}
${botProfile.lifestyle ? `Il tuo stile di vita è: ${botProfile.lifestyle}.` : ""}
${botProfile.loveLanguage ? `Il tuo linguaggio dell'amore è: ${botProfile.loveLanguage}.` : ""}

Stai chattando su un'app di incontri con ${userProfile.name}. Rispondi in modo naturale, come una persona vera. Sii ${botProfile.gender === "Uomo" ? "caloroso" : "calorosa"}, ${botProfile.gender === "Uomo" ? "interessato" : "interessata"} e flirta leggermente quando appropriato. Usa l'italiano colloquiale, rispondi in modo breve e naturale (1-3 frasi), come in una vera chat. Non usare emoji eccessivi, al massimo 1-2. Non ripetere mai le stesse frasi. Non dire mai che sei un bot o un'IA.`;

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
  
  await setupAuth(app);
  registerAuthRoutes(app);
  registerObjectStorageRoutes(app);

  app.get("/api/auth/social-config", (req, res) => {
    res.json({
      googleClientId: process.env.GOOGLE_CLIENT_ID || null,
      appleClientId: process.env.APPLE_CLIENT_ID || null,
      appleRedirectUri: process.env.APPLE_REDIRECT_URI || null,
    });
  });

  app.use("/uploads", express.static(uploadsDir));

  app.get("/api/profiles/me", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const profile = await storage.getProfileByUserId(userId);
      if (profile) {
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

      const swipable = allProfiles.filter(p => {
        if (p.id === profileId) return false;
        if (dislikedSet.has(p.id)) return false;
        if (blockedSet.has(p.id)) return false;

        if (myProfile) {
          if (!isGenderFlexible(myProfile.preferredGender) && p.gender && p.gender !== "" && p.gender !== "Preferisco non rispondere") {
            if (p.gender !== myProfile.preferredGender) return false;
          }

          if (!genderMatches(myProfile.gender, p.preferredGender)) return false;

          if (myProfile.preferredAgeMin && p.age < myProfile.preferredAgeMin) return false;
          if (myProfile.preferredAgeMax && p.age > myProfile.preferredAgeMax) return false;

          if (p.preferredAgeMin && myProfile.age < p.preferredAgeMin) return false;
          if (p.preferredAgeMax && myProfile.age > p.preferredAgeMax) return false;

          if (myProfile.preferredHeightMin && p.height && p.height < myProfile.preferredHeightMin) return false;
          if (myProfile.preferredHeightMax && p.height && p.height > myProfile.preferredHeightMax) return false;

          if (p.preferredHeightMin && myProfile.height && myProfile.height < p.preferredHeightMin) return false;
          if (p.preferredHeightMax && myProfile.height && myProfile.height > p.preferredHeightMax) return false;

          if (myProfile.profileLatitude && myProfile.profileLongitude && myProfile.maxDistanceKm) {
            if (p.profileLatitude && p.profileLongitude) {
              const dist = haversineKm(myProfile.profileLatitude, myProfile.profileLongitude, p.profileLatitude, p.profileLongitude);
              if (dist > myProfile.maxDistanceKm) return false;
            }
          }
        }

        return true;
      });

      res.json({ profiles: swipable, likedIds });
    } catch (error) {
      console.error("Error fetching swipable profiles:", error);
      res.status(500).json({ error: "Failed to fetch profiles" });
    }
  });

  app.get("/api/guest/rooms", async (_req, res) => {
    try {
      const rooms = await storage.getRooms();
      res.json(rooms);
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

      const count = await storage.resetDislikedSwipes(userProfile.id);
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
      const profile = await storage.createProfile({
        ...validatedData,
        userId,
        isBot: false,
        points: 0,
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

      const profile = await storage.updateProfile(req.params.id, validatedData);
      res.json(profile);
    } catch (error) {
      if (error instanceof z.ZodError) {
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
      if (currentPhotos.length === 0 || userProfile.imageUrl === '/images/profile-1.png' || !userProfile.imageUrl) {
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

  const isAdmin = async (req: any, res: any, next: any) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const user = await storage.getUser(userId);
      if (!user?.isAdmin) {
        return res.status(403).json({ error: "Admin access required" });
      }
      
      next();
    } catch (error) {
      res.status(500).json({ error: "Server error" });
    }
  };

  app.get("/api/admin/stats", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const [users, profiles, matches, messages] = await Promise.all([
        storage.getAllUsers(),
        storage.getAllProfiles(),
        storage.getAllMatches(),
        storage.getAllMessages(),
      ]);
      
      const sanitizedUsers = users.map(({ password, ...u }) => u);
      res.json({
        totalUsers: users.length,
        totalProfiles: profiles.length,
        totalMatches: matches.length,
        totalMessages: messages.length,
        recentUsers: sanitizedUsers.slice(0, 10),
        recentMatches: matches.slice(0, 10),
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
      const rooms = await storage.getRooms();
      res.json(rooms);
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

  return httpServer;
}

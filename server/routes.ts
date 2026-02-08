import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertSwipeSchema, insertProfileSchema, updateProfileSchema, insertMessageSchema } from "@shared/schema";
import { z } from "zod";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import multer from "multer";
import path from "path";
import fs from "fs";
import { randomUUID } from "crypto";
import { registerObjectStorageRoutes, ObjectStorageService } from "./replit_integrations/object_storage";

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

  app.use("/uploads", express.static(uploadsDir));

  app.get("/api/profiles/me", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const profile = await storage.getProfileByUserId(userId);
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
        return res.json(allProfiles);
      }
      const allProfiles = await storage.getProfiles();
      const swipedIds = await storage.getSwipedProfileIds(profileId);
      const swipedSet = new Set(swipedIds);
      const swipable = allProfiles.filter(p => p.id !== profileId && !swipedSet.has(p.id));
      res.json(swipable);
    } catch (error) {
      console.error("Error fetching swipable profiles:", error);
      res.status(500).json({ error: "Failed to fetch profiles" });
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

  app.post("/api/profiles", async (req, res) => {
    try {
      const validatedData = insertProfileSchema.parse(req.body);
      const profile = await storage.createProfile({
        ...validatedData,
        isBot: false,
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

  app.put("/api/profiles/:id", async (req, res) => {
    try {
      const existing = await storage.getProfile(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Profile not found" });
      }
      
      const validatedData = updateProfileSchema.parse(req.body);
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
      res.json(matches);
    } catch (error) {
      console.error("Error fetching matches:", error);
      res.status(500).json({ error: "Failed to fetch matches" });
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
      
      res.json({
        totalUsers: users.length,
        totalProfiles: profiles.length,
        totalMatches: matches.length,
        totalMessages: messages.length,
        recentUsers: users.slice(0, 10),
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
      res.json(users);
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

      res.json(submission);
    } catch (error) {
      console.error("Error updating submission:", error);
      res.status(500).json({ error: "Failed to update submission" });
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
      
      const message = await storage.createMessage({
        matchId,
        senderId: userProfile.id,
        content,
      });
      res.status(201).json(message);
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
      res.status(201).json(submission);
    } catch (error: any) {
      console.error("Error submitting challenge:", error?.message || error);
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
  app.get("/api/private-rooms", isAuthenticated, async (req, res) => {
    try {
      const rooms = await storage.getPrivateRooms();
      res.json(rooms);
    } catch (error) {
      console.error("Error fetching private rooms:", error);
      res.status(500).json({ error: "Failed to fetch private rooms" });
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

  return httpServer;
}

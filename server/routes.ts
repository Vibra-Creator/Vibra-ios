import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertSwipeSchema, insertProfileSchema, updateProfileSchema, insertMessageSchema } from "@shared/schema";
import { z } from "zod";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  await setupAuth(app);
  registerAuthRoutes(app);

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

  app.post("/api/swipe", async (req, res) => {
    try {
      const validatedData = insertSwipeSchema.parse(req.body);
      
      const existingSwipe = await storage.getSwipe(validatedData.swiperId, validatedData.swipedId);
      if (existingSwipe) {
        return res.status(400).json({ error: "Already swiped on this profile" });
      }
      
      const swipe = await storage.createSwipe(validatedData);
      
      let match = false;
      let matchData = null;
      
      if (validatedData.liked) {
        const isMutualLike = await storage.checkMutualLike(validatedData.swiperId, validatedData.swipedId);
        
        if (isMutualLike) {
          const existingMatch = await storage.getMatch(validatedData.swiperId, validatedData.swipedId);
          
          if (!existingMatch) {
            matchData = await storage.createMatch({
              profile1Id: validatedData.swiperId,
              profile2Id: validatedData.swipedId,
            });
            match = true;
          }
        }
      }
      
      res.json({ swipe, match, matchData });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid swipe data", details: error.errors });
      }
      console.error("Error creating swipe:", error);
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

  return httpServer;
}

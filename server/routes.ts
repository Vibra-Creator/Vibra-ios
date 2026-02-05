import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertSwipeSchema, insertProfileSchema, updateProfileSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
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

  app.get("/api/my-profile/:userId", async (req, res) => {
    try {
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

  app.get("/api/matches/:userId", async (req, res) => {
    try {
      const matches = await storage.getMatchesForUser(req.params.userId);
      res.json(matches);
    } catch (error) {
      console.error("Error fetching matches:", error);
      res.status(500).json({ error: "Failed to fetch matches" });
    }
  });

  return httpServer;
}

import { 
  type User, type UpsertUser, 
  type Profile, type InsertProfile,
  type Swipe, type InsertSwipe,
  type Match, type InsertMatch,
  type Message, type InsertMessage,
  type Room, type PrivateRoom, type DailyChallenge,
  users, profiles, swipes, matches, messages,
  rooms, privateRooms, dailyChallenges
} from "@shared/schema";
import { db } from "./db";
import { eq, and, or, desc } from "drizzle-orm";
import { randomUUID } from "crypto";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  getProfiles(): Promise<Profile[]>;
  getProfile(id: string): Promise<Profile | undefined>;
  getProfileByUserId(userId: string): Promise<Profile | undefined>;
  createProfile(profile: InsertProfile): Promise<Profile>;
  updateProfile(id: string, profile: Partial<InsertProfile>): Promise<Profile | undefined>;
  
  createSwipe(swipe: InsertSwipe): Promise<Swipe>;
  getSwipe(swiperId: string, swipedId: string): Promise<Swipe | undefined>;
  checkMutualLike(userId1: string, userId2: string): Promise<boolean>;
  
  createMatch(match: InsertMatch): Promise<Match>;
  getMatchesForUser(userId: string): Promise<(Match & { profile: Profile })[]>;
  getMatch(profile1Id: string, profile2Id: string): Promise<Match | undefined>;
  getMatchById(matchId: string): Promise<Match | undefined>;
  
  getMessagesForMatch(matchId: string): Promise<Message[]>;
  createMessage(message: InsertMessage): Promise<Message>;
  markMessagesAsRead(matchId: string, recipientId: string): Promise<void>;
  
  getAllUsers(): Promise<User[]>;
  getAllProfiles(): Promise<Profile[]>;
  getAllMatches(): Promise<Match[]>;
  getAllMessages(): Promise<Message[]>;
  deleteProfile(id: string): Promise<void>;
  setProfileVerified(id: string, isVerified: boolean): Promise<Profile | undefined>;
  
  getRooms(): Promise<Room[]>;
  getChallenges(): Promise<DailyChallenge[]>;
  getPrivateRooms(): Promise<PrivateRoom[]>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db.insert(users).values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
          profileImageUrl: userData.profileImageUrl,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async getProfiles(): Promise<Profile[]> {
    return db.select().from(profiles);
  }

  async getProfile(id: string): Promise<Profile | undefined> {
    const [profile] = await db.select().from(profiles).where(eq(profiles.id, id));
    return profile;
  }

  async createProfile(insertProfile: InsertProfile): Promise<Profile> {
    const [profile] = await db.insert(profiles).values(insertProfile).returning();
    return profile;
  }

  async getProfileByUserId(userId: string): Promise<Profile | undefined> {
    const [profile] = await db.select().from(profiles).where(eq(profiles.userId, userId));
    return profile;
  }

  async updateProfile(id: string, profileData: Partial<InsertProfile>): Promise<Profile | undefined> {
    const [profile] = await db.update(profiles)
      .set(profileData)
      .where(eq(profiles.id, id))
      .returning();
    return profile;
  }

  async createSwipe(insertSwipe: InsertSwipe): Promise<Swipe> {
    const [swipe] = await db.insert(swipes).values(insertSwipe).returning();
    return swipe;
  }

  async getSwipe(swiperId: string, swipedId: string): Promise<Swipe | undefined> {
    const [swipe] = await db.select().from(swipes).where(
      and(eq(swipes.swiperId, swiperId), eq(swipes.swipedId, swipedId))
    );
    return swipe;
  }

  async checkMutualLike(userId1: string, userId2: string): Promise<boolean> {
    const [swipe] = await db.select().from(swipes).where(
      and(
        eq(swipes.swiperId, userId2),
        eq(swipes.swipedId, userId1),
        eq(swipes.liked, true)
      )
    );
    return !!swipe;
  }

  async createMatch(insertMatch: InsertMatch): Promise<Match> {
    const [match] = await db.insert(matches).values(insertMatch).returning();
    return match;
  }

  async getMatchesForUser(userId: string): Promise<(Match & { profile: Profile })[]> {
    const userMatches = await db.select().from(matches).where(
      or(eq(matches.profile1Id, userId), eq(matches.profile2Id, userId))
    ).orderBy(desc(matches.createdAt));

    const result: (Match & { profile: Profile })[] = [];
    
    for (const match of userMatches) {
      const otherProfileId = match.profile1Id === userId ? match.profile2Id : match.profile1Id;
      const profile = await this.getProfile(otherProfileId);
      if (profile) {
        result.push({ ...match, profile });
      }
    }
    
    return result;
  }

  async getMatch(profile1Id: string, profile2Id: string): Promise<Match | undefined> {
    const [match] = await db.select().from(matches).where(
      or(
        and(eq(matches.profile1Id, profile1Id), eq(matches.profile2Id, profile2Id)),
        and(eq(matches.profile1Id, profile2Id), eq(matches.profile2Id, profile1Id))
      )
    );
    return match;
  }

  async getMatchById(matchId: string): Promise<Match | undefined> {
    const [match] = await db.select().from(matches).where(eq(matches.id, matchId));
    return match;
  }

  async getMessagesForMatch(matchId: string): Promise<Message[]> {
    return db.select().from(messages)
      .where(eq(messages.matchId, matchId))
      .orderBy(messages.createdAt);
  }

  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    const [message] = await db.insert(messages).values(insertMessage).returning();
    return message;
  }

  async markMessagesAsRead(matchId: string, recipientId: string): Promise<void> {
    await db.update(messages)
      .set({ read: true })
      .where(
        and(
          eq(messages.matchId, matchId),
          eq(messages.read, false)
        )
      );
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users).orderBy(desc(users.createdAt));
  }

  async getAllProfiles(): Promise<Profile[]> {
    return db.select().from(profiles);
  }

  async getAllMatches(): Promise<Match[]> {
    return db.select().from(matches).orderBy(desc(matches.createdAt));
  }

  async getAllMessages(): Promise<Message[]> {
    return db.select().from(messages).orderBy(desc(messages.createdAt));
  }

  async deleteProfile(id: string): Promise<void> {
    await db.delete(profiles).where(eq(profiles.id, id));
  }

  async setProfileVerified(id: string, isVerified: boolean): Promise<Profile | undefined> {
    const [profile] = await db.update(profiles)
      .set({ isVerified })
      .where(eq(profiles.id, id))
      .returning();
    return profile;
  }

  async getRooms(): Promise<Room[]> {
    return db.select().from(rooms).where(eq(rooms.isActive, true));
  }

  async getChallenges(): Promise<DailyChallenge[]> {
    return db.select().from(dailyChallenges).where(eq(dailyChallenges.isActive, true));
  }

  async getPrivateRooms(): Promise<PrivateRoom[]> {
    return db.select().from(privateRooms).where(eq(privateRooms.isActive, true));
  }
}

export const storage = new DatabaseStorage();

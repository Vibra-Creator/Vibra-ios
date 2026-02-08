import { 
  type User, type UpsertUser, 
  type Profile, type InsertProfile,
  type Swipe, type InsertSwipe,
  type Match, type InsertMatch,
  type Message, type InsertMessage,
  type Room, type RoomMessage, type PrivateRoom, type PrivateRoomRequest, type PrivateRoomMessage,
  type DailyChallenge, type ChallengeSubmission,
  type VirtualGift, type SentGift,
  users, profiles, swipes, matches, messages,
  rooms, roomMembers, roomMessages, privateRooms, privateRoomRequests, privateRoomMessages,
  dailyChallenges, challengeSubmissions,
  virtualGifts, sentGifts
} from "@shared/schema";
import { db } from "./db";
import { eq, and, or, desc, sql } from "drizzle-orm";
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
  getSwipedProfileIds(swiperId: string): Promise<string[]>;
  resetDislikedSwipes(swiperId: string): Promise<number>;
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
  getRoom(id: string): Promise<Room | undefined>;
  getRoomMessages(roomId: string): Promise<RoomMessage[]>;
  createRoomMessage(msg: { roomId: string; senderId: string; senderName: string; senderImage?: string; content: string }): Promise<RoomMessage>;
  joinRoom(roomId: string, profileId: string): Promise<void>;
  getChallenges(): Promise<DailyChallenge[]>;
  getPrivateRooms(): Promise<PrivateRoom[]>;
  getPrivateRoom(id: string): Promise<PrivateRoom | undefined>;
  getPrivateRoomByOwner(ownerId: string): Promise<PrivateRoom | undefined>;
  createPrivateRoom(data: { ownerId: string; name: string; description?: string; imageUrl?: string }): Promise<PrivateRoom>;
  requestPrivateRoomAccess(roomId: string, requesterId: string): Promise<PrivateRoomRequest>;
  getPrivateRoomRequests(roomId: string): Promise<(PrivateRoomRequest & { requester: Profile })[]>;
  getMyPrivateRoomRequest(roomId: string, requesterId: string): Promise<PrivateRoomRequest | undefined>;
  respondToPrivateRoomRequest(requestId: string, status: "approved" | "rejected"): Promise<PrivateRoomRequest | undefined>;
  getPrivateRoomMembers(roomId: string): Promise<Profile[]>;
  getPrivateRoomMessages(roomId: string): Promise<PrivateRoomMessage[]>;
  createPrivateRoomMessage(msg: { roomId: string; senderId: string; senderName: string; senderImage?: string; content: string }): Promise<PrivateRoomMessage>;
  isPrivateRoomMember(roomId: string, profileId: string): Promise<boolean>;
  createChallengeSubmission(submission: { challengeId: string; profileId: string; imageUrl: string }): Promise<ChallengeSubmission>;
  getChallengeSubmissions(profileId: string): Promise<ChallengeSubmission[]>;
  getAllChallengeSubmissions(): Promise<ChallengeSubmission[]>;
  updateChallengeSubmissionStatus(id: string, status: string): Promise<ChallengeSubmission | undefined>;
  
  getVirtualGifts(): Promise<VirtualGift[]>;
  getVirtualGift(id: string): Promise<VirtualGift | undefined>;
  sendGift(data: { giftId: string; senderId: string; receiverId: string; message?: string }): Promise<SentGift>;
  getReceivedGifts(profileId: string): Promise<(SentGift & { gift: VirtualGift; sender: Profile })[]>;
  getSentGifts(profileId: string): Promise<(SentGift & { gift: VirtualGift; receiver: Profile })[]>;
  markGiftSeen(giftId: string): Promise<void>;
  addPoints(profileId: string, points: number): Promise<Profile | undefined>;
  deductPoints(profileId: string, points: number): Promise<Profile | undefined>;
  getProfilePoints(profileId: string): Promise<number>;
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

  async getSwipedProfileIds(swiperId: string): Promise<string[]> {
    const result = await db.select({ swipedId: swipes.swipedId }).from(swipes).where(eq(swipes.swiperId, swiperId));
    return result.map(r => r.swipedId);
  }

  async resetDislikedSwipes(swiperId: string): Promise<number> {
    const result = await db.delete(swipes).where(
      and(eq(swipes.swiperId, swiperId), eq(swipes.liked, false))
    ).returning();
    return result.length;
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

  async getRoom(id: string): Promise<Room | undefined> {
    const [room] = await db.select().from(rooms).where(eq(rooms.id, id));
    return room;
  }

  async getRoomMessages(roomId: string): Promise<RoomMessage[]> {
    return db.select().from(roomMessages)
      .where(eq(roomMessages.roomId, roomId))
      .orderBy(roomMessages.createdAt);
  }

  async createRoomMessage(msg: { roomId: string; senderId: string; senderName: string; senderImage?: string; content: string }): Promise<RoomMessage> {
    const [message] = await db.insert(roomMessages).values(msg).returning();
    return message;
  }

  async joinRoom(roomId: string, profileId: string): Promise<void> {
    const existing = await db.select().from(roomMembers)
      .where(and(eq(roomMembers.roomId, roomId), eq(roomMembers.profileId, profileId)));
    if (existing.length === 0) {
      await db.insert(roomMembers).values({ roomId, profileId });
    }
  }

  async getChallenges(): Promise<DailyChallenge[]> {
    return db.select().from(dailyChallenges).where(eq(dailyChallenges.isActive, true));
  }

  async getPrivateRooms(): Promise<PrivateRoom[]> {
    return db.select().from(privateRooms).where(eq(privateRooms.isActive, true));
  }

  async getPrivateRoom(id: string): Promise<PrivateRoom | undefined> {
    const [room] = await db.select().from(privateRooms).where(eq(privateRooms.id, id));
    return room;
  }

  async getPrivateRoomByOwner(ownerId: string): Promise<PrivateRoom | undefined> {
    const [room] = await db.select().from(privateRooms)
      .where(and(eq(privateRooms.ownerId, ownerId), eq(privateRooms.isActive, true)));
    return room;
  }

  async createPrivateRoom(data: { ownerId: string; name: string; description?: string; imageUrl?: string }): Promise<PrivateRoom> {
    const [room] = await db.insert(privateRooms).values({
      ownerId: data.ownerId,
      name: data.name,
      description: data.description || null,
      imageUrl: data.imageUrl || null,
      isActive: true,
    }).returning();
    return room;
  }

  async requestPrivateRoomAccess(roomId: string, requesterId: string): Promise<PrivateRoomRequest> {
    const existing = await this.getMyPrivateRoomRequest(roomId, requesterId);
    if (existing) return existing;
    const [request] = await db.insert(privateRoomRequests).values({
      roomId,
      requesterId,
      status: "pending",
    }).returning();
    return request;
  }

  async getPrivateRoomRequests(roomId: string): Promise<(PrivateRoomRequest & { requester: Profile })[]> {
    const requests = await db.select().from(privateRoomRequests)
      .where(eq(privateRoomRequests.roomId, roomId))
      .orderBy(desc(privateRoomRequests.createdAt));
    const result: (PrivateRoomRequest & { requester: Profile })[] = [];
    for (const req of requests) {
      const requester = await this.getProfile(req.requesterId);
      if (requester) {
        result.push({ ...req, requester });
      }
    }
    return result;
  }

  async getMyPrivateRoomRequest(roomId: string, requesterId: string): Promise<PrivateRoomRequest | undefined> {
    const [request] = await db.select().from(privateRoomRequests)
      .where(and(
        eq(privateRoomRequests.roomId, roomId),
        eq(privateRoomRequests.requesterId, requesterId)
      ));
    return request;
  }

  async respondToPrivateRoomRequest(requestId: string, status: "approved" | "rejected"): Promise<PrivateRoomRequest | undefined> {
    const [result] = await db.update(privateRoomRequests)
      .set({ status, respondedAt: new Date() })
      .where(eq(privateRoomRequests.id, requestId))
      .returning();
    return result;
  }

  async getPrivateRoomMembers(roomId: string): Promise<Profile[]> {
    const approvedRequests = await db.select().from(privateRoomRequests)
      .where(and(
        eq(privateRoomRequests.roomId, roomId),
        eq(privateRoomRequests.status, "approved")
      ));
    const members: Profile[] = [];
    for (const req of approvedRequests) {
      const profile = await this.getProfile(req.requesterId);
      if (profile) members.push(profile);
    }
    const room = await this.getPrivateRoom(roomId);
    if (room) {
      const owner = await this.getProfile(room.ownerId);
      if (owner && !members.find(m => m.id === owner.id)) {
        members.unshift(owner);
      }
    }
    return members;
  }

  async getPrivateRoomMessages(roomId: string): Promise<PrivateRoomMessage[]> {
    return db.select().from(privateRoomMessages)
      .where(eq(privateRoomMessages.roomId, roomId))
      .orderBy(privateRoomMessages.createdAt);
  }

  async createPrivateRoomMessage(msg: { roomId: string; senderId: string; senderName: string; senderImage?: string; content: string }): Promise<PrivateRoomMessage> {
    const [result] = await db.insert(privateRoomMessages).values(msg).returning();
    return result;
  }

  async isPrivateRoomMember(roomId: string, profileId: string): Promise<boolean> {
    const room = await this.getPrivateRoom(roomId);
    if (!room) return false;
    if (room.ownerId === profileId) return true;
    const [request] = await db.select().from(privateRoomRequests)
      .where(and(
        eq(privateRoomRequests.roomId, roomId),
        eq(privateRoomRequests.requesterId, profileId),
        eq(privateRoomRequests.status, "approved")
      ));
    return !!request;
  }

  async createChallengeSubmission(submission: { challengeId: string; profileId: string; imageUrl: string }): Promise<ChallengeSubmission> {
    const [result] = await db.insert(challengeSubmissions).values(submission).returning();
    return result;
  }

  async getChallengeSubmissions(profileId: string): Promise<ChallengeSubmission[]> {
    return db.select().from(challengeSubmissions)
      .where(eq(challengeSubmissions.profileId, profileId))
      .orderBy(desc(challengeSubmissions.createdAt));
  }

  async getAllChallengeSubmissions(): Promise<ChallengeSubmission[]> {
    return db.select().from(challengeSubmissions).orderBy(desc(challengeSubmissions.createdAt));
  }

  async updateChallengeSubmissionStatus(id: string, status: string): Promise<ChallengeSubmission | undefined> {
    const [result] = await db.update(challengeSubmissions)
      .set({ status, reviewedAt: new Date() })
      .where(eq(challengeSubmissions.id, id))
      .returning();
    return result;
  }

  async getVirtualGifts(): Promise<VirtualGift[]> {
    return db.select().from(virtualGifts).orderBy(virtualGifts.sortOrder);
  }

  async getVirtualGift(id: string): Promise<VirtualGift | undefined> {
    const [gift] = await db.select().from(virtualGifts).where(eq(virtualGifts.id, id));
    return gift;
  }

  async sendGift(data: { giftId: string; senderId: string; receiverId: string; message?: string }): Promise<SentGift> {
    const [result] = await db.insert(sentGifts).values(data).returning();
    return result;
  }

  async getReceivedGifts(profileId: string): Promise<(SentGift & { gift: VirtualGift; sender: Profile })[]> {
    const gifts = await db.select().from(sentGifts)
      .where(eq(sentGifts.receiverId, profileId))
      .orderBy(desc(sentGifts.createdAt));
    
    const result: (SentGift & { gift: VirtualGift; sender: Profile })[] = [];
    for (const sg of gifts) {
      const gift = await this.getVirtualGift(sg.giftId);
      const sender = await this.getProfile(sg.senderId);
      if (gift && sender) {
        result.push({ ...sg, gift, sender });
      }
    }
    return result;
  }

  async getSentGifts(profileId: string): Promise<(SentGift & { gift: VirtualGift; receiver: Profile })[]> {
    const gifts = await db.select().from(sentGifts)
      .where(eq(sentGifts.senderId, profileId))
      .orderBy(desc(sentGifts.createdAt));
    
    const result: (SentGift & { gift: VirtualGift; receiver: Profile })[] = [];
    for (const sg of gifts) {
      const gift = await this.getVirtualGift(sg.giftId);
      const receiver = await this.getProfile(sg.receiverId);
      if (gift && receiver) {
        result.push({ ...sg, gift, receiver });
      }
    }
    return result;
  }

  async markGiftSeen(giftId: string): Promise<void> {
    await db.update(sentGifts).set({ seen: true }).where(eq(sentGifts.id, giftId));
  }

  async addPoints(profileId: string, points: number): Promise<Profile | undefined> {
    const [profile] = await db.update(profiles)
      .set({ points: sql`COALESCE(${profiles.points}, 0) + ${points}` })
      .where(eq(profiles.id, profileId))
      .returning();
    return profile;
  }

  async deductPoints(profileId: string, points: number): Promise<Profile | undefined> {
    const [profile] = await db.update(profiles)
      .set({ points: sql`GREATEST(COALESCE(${profiles.points}, 0) - ${points}, 0)` })
      .where(eq(profiles.id, profileId))
      .returning();
    return profile;
  }

  async getProfilePoints(profileId: string): Promise<number> {
    const profile = await this.getProfile(profileId);
    return profile?.points ?? 0;
  }
}

export const storage = new DatabaseStorage();

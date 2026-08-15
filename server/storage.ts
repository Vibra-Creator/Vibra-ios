import { 
  type User, type UpsertUser, 
  type Profile, type InsertProfile,
  type Swipe, type InsertSwipe,
  type Match, type InsertMatch,
  type Message, type InsertMessage,
  type Room, type RoomMessage, type PrivateRoom, type PrivateRoomRequest, type PrivateRoomMessage,
  type DailyChallenge, type ChallengeSubmission,
  type VirtualGift, type SentGift,
  type Report, type UserSuspension, type BannedWord,
  type ProfileRating,
  type VibingSession,
  type BlockedUser,
  type LocationShare,
  type ProfileVideo, type InsertProfileVideo,
  type ProfileReaction, type ReactionType,
  type CosmicSignal, type SignalComment,
  type ProfileFavorite,
  type VibrappDm,
  users, profiles, swipes, matches, messages,
  rooms, roomMembers, roomMessages, privateRooms, privateRoomRequests, privateRoomMessages,
  dailyChallenges, challengeSubmissions,
  virtualGifts, sentGifts,
  reports, userSuspensions, bannedWords,
  profileRatings,
  vibingSessions,
  profileFavorites,
  blockedUsers,
  locationShares,
  profileVideos,
  profileReactions,
  coldMessages,
  cosmicSignals,
  signalLikes,
  signalComments,
  deletedBotIds,
  vibrappDms,
  userDna,
  dnaEvents,
  type ColdMessage,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, or, desc, sql, inArray, lt, ne, gt } from "drizzle-orm";
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
  getLikedProfileIds(swiperId: string): Promise<string[]>;
  getRecentDislikedProfileIds(swiperId: string, days?: number): Promise<string[]>;
  resetDislikedSwipes(swiperId: string): Promise<number>;
  resetAllSwipes(swiperId: string): Promise<number>;
  checkMutualLike(userId1: string, userId2: string): Promise<boolean>;
  getReceivedLikes(profileId: string): Promise<Profile[]>;
  
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
  deleteChallengeSubmission(id: string): Promise<void>;
  
  getVirtualGifts(): Promise<VirtualGift[]>;
  getVirtualGift(id: string): Promise<VirtualGift | undefined>;
  sendGift(data: { giftId: string; senderId: string; receiverId: string; message?: string }): Promise<SentGift>;
  getReceivedGifts(profileId: string): Promise<(SentGift & { gift: VirtualGift; sender: Profile })[]>;
  getSentGifts(profileId: string): Promise<(SentGift & { gift: VirtualGift; receiver: Profile })[]>;
  markGiftSeen(giftId: string): Promise<void>;
  addPoints(profileId: string, points: number): Promise<Profile | undefined>;
  deductPoints(profileId: string, points: number): Promise<Profile | undefined>;
  getProfilePoints(profileId: string): Promise<number>;
  
  // Reports
  createReport(data: { reporterId: string; reportedId: string; reason: string; description?: string; coldMessageId?: string; coldMessageContent?: string }): Promise<Report>;
  getReports(): Promise<Report[]>;
  updateReportStatus(id: string, status: string): Promise<Report | undefined>;
  
  // Suspensions
  suspendUser(data: { userId: string; reason: string; expiresAt?: Date; isPermanent?: boolean }): Promise<UserSuspension>;
  getUserSuspensions(): Promise<UserSuspension[]>;
  getActiveSuspension(userId: string): Promise<UserSuspension | undefined>;
  liftSuspension(id: string): Promise<void>;
  
  // Banned words
  getBannedWords(): Promise<BannedWord[]>;
  addBannedWord(word: string): Promise<BannedWord>;
  removeBannedWord(id: string): Promise<void>;
  
  // Message moderation
  deleteMessage(messageId: string): Promise<void>;
  deleteRoomMessage(messageId: string): Promise<void>;
  deletePrivateRoomMessage(messageId: string): Promise<void>;
  getAllRoomMessages(): Promise<RoomMessage[]>;
  
  // Profile Ratings (Prima Impressione)
  createProfileRating(data: { raterId: string; ratedId: string; rating: number }): Promise<ProfileRating>;
  getReceivedRatings(profileId: string): Promise<(ProfileRating & { rater: Profile })[]>;
  getProfileRating(id: string): Promise<ProfileRating | undefined>;
  getExistingRating(raterId: string, ratedId: string): Promise<ProfileRating | undefined>;
  getRatingBetweenProfiles(profileAId: string, profileBId: string): Promise<ProfileRating | undefined>;
  replyToRating(ratingId: string, reply: string): Promise<ProfileRating | undefined>;
  markRatingMatchCreated(ratingId: string): Promise<void>;

  // Vibing Sessions ("Sto vibing ora")
  activateVibing(data: { profileId: string; latitude: number; longitude: number; radiusKm: number }): Promise<VibingSession>;
  deactivateVibing(profileId: string): Promise<void>;
  getActiveVibingSession(profileId: string): Promise<VibingSession | undefined>;
  getNearbyVibers(lat: number, lng: number, radiusKm: number, excludeProfileId: string): Promise<(VibingSession & { profile: Profile })[]>;

  // Blocked users
  blockUser(blockerId: string, blockedId: string): Promise<BlockedUser>;
  unblockUser(blockerId: string, blockedId: string): Promise<void>;
  getBlockedUsers(blockerId: string): Promise<BlockedUser[]>;
  isBlocked(blockerId: string, blockedId: string): Promise<boolean>;
  getBlockedIds(profileId: string): Promise<string[]>;

  // Location sharing
  updateLocationShare(profileId: string, lat: number, lng: number): Promise<LocationShare>;
  deactivateLocationShare(profileId: string): Promise<void>;
  getLocationShare(profileId: string): Promise<LocationShare | undefined>;
  getMatchLocationShares(profileId: string): Promise<(LocationShare & { profile: Profile })[]>;

  // Profile Videos
  getProfileVideos(profileId: string): Promise<ProfileVideo[]>;
  addProfileVideo(data: InsertProfileVideo): Promise<ProfileVideo>;
  deleteProfileVideo(id: string): Promise<void>;
  getProfileVideoById(id: string): Promise<ProfileVideo | undefined>;
  getVideosForInactiveProfiles(cutoffDate: Date): Promise<ProfileVideo[]>;
  getStoriesFeed(limit?: number): Promise<Array<{ profileId: string; profileName: string; profileImage: string | null; videoUrl: string; thumbnailUrl: string | null; createdAt: Date }>>;

  // Cosmic Signals
  getSignalsFeed(myProfileId: string, limit?: number): Promise<Array<CosmicSignal & { profile: Profile; likesCount: number; commentsCount: number; hasLiked: boolean }>>;
  getProfileSignals(profileId: string, limit?: number): Promise<Pick<CosmicSignal, "id" | "content" | "mediaUrl" | "mediaType" | "createdAt">[]>;
  createSignal(data: { profileId: string; content: string; mediaUrl?: string; mediaType?: string; toProfileId?: string; textColor?: string | null; backgroundColor?: string | null }): Promise<CosmicSignal>;
  deleteSignal(id: string, profileId: string): Promise<void>;
  toggleSignalLike(signalId: string, profileId: string): Promise<{ liked: boolean; count: number }>;
  getSignalComments(signalId: string): Promise<Array<SignalComment & { profile: Profile }>>;
  addSignalComment(data: { signalId: string; profileId: string; content: string }): Promise<SignalComment & { profile: Profile }>;
  getReceivedDirectSignals(toProfileId: string): Promise<Array<Pick<CosmicSignal, "id" | "content" | "mediaUrl" | "mediaType" | "createdAt"> & { fromProfile: Pick<Profile, "id" | "name" | "age" | "imageUrl"> }>>;

  // Profile Favorites
  getFavorites(profileId: string): Promise<Array<ProfileFavorite & { profile: Profile }>>;
  addFavorite(profileId: string, favoritedProfileId: string): Promise<ProfileFavorite>;
  removeFavorite(profileId: string, favoritedProfileId: string): Promise<void>;
  isFavorite(profileId: string, favoritedProfileId: string): Promise<boolean>;

  // Vibrapp DMs
  sendVibrappDm(fromProfileId: string, toProfileId: string, content: string): Promise<VibrappDm>;
  getVibrappDmThread(myProfileId: string, otherProfileId: string, limit?: number): Promise<VibrappDm[]>;
  markVibrappDmRead(myProfileId: string, otherProfileId: string): Promise<void>;
  getVibrappDmUnreadCount(myProfileId: string): Promise<number>;
  getVibrappDmConversations(myProfileId: string): Promise<Array<{ otherProfileId: string; lastMessage: VibrappDm; unreadCount: number }>>;

  // Cold Messages
  deleteColdMessage(messageId: string, toProfileId: string): Promise<void>;
  /** Returns true if recipientProfileId has ever reported the sender — checked
   *  both by direct profile UUID and by the sender's underlying auth userId so
   *  recreated accounts (same userId, new profile UUID) are also caught. */
  isSenderReportedByRecipient(senderProfileId: string, recipientProfileId: string): Promise<boolean>;

  // VibraDNA
  trackDnaEvent(profileId: string, eventType: string, value: number): Promise<void>;
  computeAndStoreDna(profileId: string): Promise<Record<string, number>>;
  getDna(profileId: string): Promise<Record<string, number>>;
  getDnaCompatibility(profileId1: string, profileId2: string): Promise<{ score: number; label: string; details: Record<string, { mine: number; theirs: number; diff: number }> }>;

  // VibraGhost
  setGhostMode(profileId: string, hours: number): Promise<Date>;
  deactivateGhostMode(profileId: string): Promise<void>;
  getGhostStatus(profileId: string): Promise<{ active: boolean; expiresAt: Date | null }>;

  // VibraStory
  getStories(roomId?: string): Promise<Story[]>;
  getStory(id: string): Promise<Story | undefined>;
  createStory(data: { roomId?: string; theme: string; description?: string }): Promise<Story>;
  getStoryBriciole(storyId: string, myProfileId?: string): Promise<Array<StoryBriciola & { profileName: string; profileImageUrl: string; myVote?: string }>>;
  addBriciola(data: { storyId: string; profileId: string; content: string; mediaUrl?: string }): Promise<StoryBriciola>;
  voteBriciola(briolaId: string, profileId: string, voteType: string): Promise<void>;
  removeVoteBriciola(briolaId: string, profileId: string): Promise<void>;
  selectBriciola(briolaId: string): Promise<void>;
  completeStory(storyId: string): Promise<void>;

  // VibraVault
  getMyVaultConfessions(profileId: string): Promise<VaultConfession[]>;
  createVaultConfession(data: { profileId: string; content: string; mediaUrl?: string; ttlDays: number }): Promise<VaultConfession>;
  deleteVaultConfession(id: string, profileId: string): Promise<void>;
  cleanExpiredVaultConfessions(): Promise<void>;

  // VibraQuest
  getDailyQuests(profileId: string): Promise<UserQuest[]>;
  trackQuestProgress(profileId: string, questType: string, increment?: number): Promise<void>;
  claimQuestReward(questId: string, profileId: string): Promise<{ points: number }>;

  // VibraLegacy
  getLegacy(profileId: string): Promise<VibraLegacy | undefined>;
  saveLegacy(profileId: string, data: { message: string; mediaUrl?: string; revealAfterDays: number }): Promise<VibraLegacy>;
  deleteLegacy(profileId: string): Promise<void>;

  // VibraMystery
  setMysteryMode(profileId: string, hours: number): Promise<Date>;
  deactivateMysteryMode(profileId: string): Promise<void>;
  getMysteryStatus(profileId: string): Promise<{ active: boolean; expiresAt: Date | null }>;

  // VibraConsent
  getPendingConsents(profileId: string): Promise<ConsentRequest[]>;
  sendConsentRequest(from: string, to: string, contentType: string, message?: string): Promise<ConsentRequest>;
  respondConsentRequest(id: string, profileId: string, status: 'accepted' | 'declined'): Promise<void>;

  // Costellazioni
  getMyConstellation(profileId: string): Promise<{ name: string; color: string; description: string; memberCount: number } | null>;
  assignConstellation(profileId: string): Promise<string>;
  getConstellationMembers(name: string, limit?: number): Promise<Array<{ id: string; name: string; imageUrl: string | null; age: number | null }>>;

  // Eclissi
  activateEclipse(profileId: string, days: number): Promise<Date>;
  deactivateEclipse(profileId: string): Promise<void>;
  getEclipseStatus(profileId: string): Promise<{ active: boolean; until: Date | null }>;

  // VibraTime
  logActivity(profileId: string): Promise<void>;
  getActivityPattern(profileId: string): Promise<Array<{ hour: number; dayOfWeek: number; count: number }>>;
  getActivityLabel(profileId: string): Promise<string>;

  // Pianeti
  trackRoomOrbit(profileId: string, roomId: string): Promise<void>;
  getTopOrbits(profileId: string, limit?: number): Promise<Array<{ roomId: string; roomName: string; visitCount: number; orbitStability: number }>>;
  getSocialGravity(profileId: string): Promise<number>;
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
    return db.select().from(profiles).orderBy(profiles.id);
  }

  async getProfilesByIds(ids: string[]): Promise<Profile[]> {
    if (!ids.length) return [];
    return db.select().from(profiles).where(inArray(profiles.id, ids));
  }

  async getSwipedProfileIds(swiperId: string): Promise<string[]> {
    const result = await db.select({ swipedId: swipes.swipedId }).from(swipes).where(eq(swipes.swiperId, swiperId));
    return result.map(r => r.swipedId);
  }

  async getLikedProfileIds(swiperId: string): Promise<string[]> {
    const result = await db.select({ swipedId: swipes.swipedId }).from(swipes).where(
      and(eq(swipes.swiperId, swiperId), eq(swipes.liked, true))
    );
    return result.map(r => r.swipedId);
  }

  async getRecentDislikedProfileIds(swiperId: string, days: number = 7): Promise<string[]> {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const result = await db.select({ swipedId: swipes.swipedId })
      .from(swipes)
      .where(and(
        eq(swipes.swiperId, swiperId),
        eq(swipes.liked, false),
        gt(swipes.createdAt, cutoff)
      ));
    return result.map(r => r.swipedId);
  }

  async resetDislikedSwipes(swiperId: string): Promise<number> {
    const result = await db.delete(swipes).where(
      and(eq(swipes.swiperId, swiperId), eq(swipes.liked, false))
    ).returning();
    return result.length;
  }

  async resetAllSwipes(swiperId: string): Promise<number> {
    const matchedIds = await db.select({ id: matches.id, p1: matches.profile1Id, p2: matches.profile2Id })
      .from(matches)
      .where(or(eq(matches.profile1Id, swiperId), eq(matches.profile2Id, swiperId)));
    const matchedProfileIds = new Set(matchedIds.map(m => m.p1 === swiperId ? m.p2 : m.p1));

    const allSwipes = await db.select().from(swipes).where(eq(swipes.swiperId, swiperId));
    const toDelete = allSwipes.filter(s => !matchedProfileIds.has(s.swipedId));

    if (toDelete.length === 0) return 0;

    const deleteIds = toDelete.map(s => s.id);
    const result = await db.delete(swipes).where(
      and(eq(swipes.swiperId, swiperId), inArray(swipes.id, deleteIds))
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

  async getReceivedLikes(profileId: string): Promise<Profile[]> {
    // Who liked me (swipedId = me, liked = true)
    const likedMeRows = await db.select({ swiperId: swipes.swiperId })
      .from(swipes)
      .where(and(eq(swipes.swipedId, profileId), eq(swipes.liked, true)));

    if (!likedMeRows.length) return [];

    const likerIds = likedMeRows.map(r => r.swiperId);

    // Only exclude profiles I already LIKED (those create a match, no need to show in received likes)
    // Profiles I disliked should still appear so I can reconsider
    const myLikedRows = await db.select({ swipedId: swipes.swipedId })
      .from(swipes)
      .where(and(eq(swipes.swiperId, profileId), eq(swipes.liked, true)));
    const alreadyLiked = new Set(myLikedRows.map(r => r.swipedId));

    const pending = likerIds.filter(id => !alreadyLiked.has(id));
    if (!pending.length) return [];

    const result = await db.select().from(profiles).where(inArray(profiles.id, pending));
    return result;
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
    return db.select().from(profiles).orderBy(profiles.id);
  }

  async getAllMatches(): Promise<Match[]> {
    return db.select().from(matches).orderBy(desc(matches.createdAt));
  }

  async getAllMessages(): Promise<Message[]> {
    return db.select().from(messages).orderBy(desc(messages.createdAt));
  }

  async deleteProfile(id: string): Promise<void> {
    const [targetProfile] = await db.select({ isBot: profiles.isBot }).from(profiles).where(eq(profiles.id, id));
    await db.delete(sentGifts).where(or(eq(sentGifts.senderId, id), eq(sentGifts.receiverId, id)));
    await db.delete(challengeSubmissions).where(eq(challengeSubmissions.profileId, id));
    await db.delete(roomMembers).where(eq(roomMembers.profileId, id));
    await db.delete(roomMessages).where(eq(roomMessages.senderId, id));
    await db.delete(privateRoomMessages).where(eq(privateRoomMessages.senderId, id));
    await db.delete(privateRoomRequests).where(eq(privateRoomRequests.requesterId, id));
    await db.delete(profileRatings).where(or(eq(profileRatings.raterId, id), eq(profileRatings.ratedId, id)));
    await db.delete(blockedUsers).where(or(eq(blockedUsers.blockerId, id), eq(blockedUsers.blockedId, id)));
    // Keep reports where this profile WAS reported (reportedId = id) so the userId-level
    // filter in getColdMessagesReceived survives account recreation. Only remove reports
    // this profile filed as the reporter — those become meaningless once the profile is gone.
    await db.delete(reports).where(eq(reports.reporterId, id));
    await db.delete(vibingSessions).where(eq(vibingSessions.profileId, id));
    await db.delete(locationShares).where(eq(locationShares.profileId, id));
    await db.delete(profileReactions).where(or(eq(profileReactions.fromProfileId, id), eq(profileReactions.toProfileId, id)));
    const profileMatches = await db.select({ id: matches.id }).from(matches).where(or(eq(matches.profile1Id, id), eq(matches.profile2Id, id)));
    if (profileMatches.length > 0) {
      const matchIds = profileMatches.map(m => m.id);
      await db.delete(messages).where(inArray(messages.matchId, matchIds));
    }
    await db.delete(matches).where(or(eq(matches.profile1Id, id), eq(matches.profile2Id, id)));
    await db.delete(swipes).where(or(eq(swipes.swiperId, id), eq(swipes.swipedId, id)));
    await db.delete(profileFavorites).where(or(eq(profileFavorites.profileId, id), eq(profileFavorites.favoritedProfileId, id)));
    await db.delete(profiles).where(eq(profiles.id, id));
    if (targetProfile?.isBot) {
      await db.insert(deletedBotIds).values({ botId: id }).onConflictDoNothing();
    }
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
    } else {
      await db.update(roomMembers).set({ joinedAt: new Date() })
        .where(and(eq(roomMembers.roomId, roomId), eq(roomMembers.profileId, profileId)));
    }
  }

  async getChallenges(): Promise<DailyChallenge[]> {
    const now = new Date();
    const challenges = await db.select().from(dailyChallenges).where(eq(dailyChallenges.isActive, true));
    return challenges.filter(c => !c.expiresAt || new Date(c.expiresAt) > now);
  }

  async getPrivateRooms(): Promise<PrivateRoom[]> {
    const now = new Date();
    const rooms = await db.select().from(privateRooms).where(eq(privateRooms.isActive, true));
    return rooms.filter(r => !r.expiresAt || new Date(r.expiresAt) > now);
  }

  async getPrivateRoom(id: string): Promise<PrivateRoom | undefined> {
    const [room] = await db.select().from(privateRooms).where(eq(privateRooms.id, id));
    return room;
  }

  async getPrivateRoomByOwner(ownerId: string): Promise<PrivateRoom | undefined> {
    const now = new Date();
    const rooms = await db.select().from(privateRooms)
      .where(and(eq(privateRooms.ownerId, ownerId), eq(privateRooms.isActive, true)));
    return rooms.find(r => !r.expiresAt || new Date(r.expiresAt) > now);
  }

  async createPrivateRoom(data: { ownerId: string; name: string; description?: string; imageUrl?: string }): Promise<PrivateRoom> {
    const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000);
    const [room] = await db.insert(privateRooms).values({
      ownerId: data.ownerId,
      name: data.name,
      description: data.description || null,
      imageUrl: data.imageUrl || null,
      expiresAt,
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

  async deleteChallengeSubmission(id: string): Promise<void> {
    await db.delete(challengeSubmissions).where(eq(challengeSubmissions.id, id));
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

  // Reports
  async createReport(data: { reporterId: string; reportedId: string; reason: string; description?: string; coldMessageId?: string; coldMessageContent?: string }): Promise<Report> {
    // Denormalise the underlying auth-user id of the reported profile so the
    // filter survives if that profile row is later deleted (account recreation gap).
    const [reportedProfile] = await db
      .select({ userId: profiles.userId })
      .from(profiles)
      .where(eq(profiles.id, data.reportedId))
      .limit(1);
    const reportedUserId = reportedProfile?.userId ?? null;

    const [report] = await db
      .insert(reports)
      .values({ ...data, reportedUserId })
      .returning();
    return report;
  }

  async getReports(): Promise<Report[]> {
    return db.select().from(reports).orderBy(desc(reports.createdAt));
  }

  async updateReportStatus(id: string, status: string): Promise<Report | undefined> {
    const [report] = await db.update(reports)
      .set({ status, resolvedAt: status !== "pending" ? new Date() : null })
      .where(eq(reports.id, id))
      .returning();
    return report;
  }

  // Suspensions
  async suspendUser(data: { userId: string; reason: string; expiresAt?: Date; isPermanent?: boolean }): Promise<UserSuspension> {
    const [suspension] = await db.insert(userSuspensions).values(data).returning();
    return suspension;
  }

  async getUserSuspensions(): Promise<UserSuspension[]> {
    return db.select().from(userSuspensions).orderBy(desc(userSuspensions.suspendedAt));
  }

  async getActiveSuspension(userId: string): Promise<UserSuspension | undefined> {
    const [suspension] = await db.select().from(userSuspensions)
      .where(and(eq(userSuspensions.userId, userId), eq(userSuspensions.isActive, true)));
    return suspension;
  }

  async liftSuspension(id: string): Promise<void> {
    await db.update(userSuspensions).set({ isActive: false }).where(eq(userSuspensions.id, id));
  }

  // Banned words
  async getBannedWords(): Promise<BannedWord[]> {
    return db.select().from(bannedWords).orderBy(bannedWords.word);
  }

  async addBannedWord(word: string): Promise<BannedWord> {
    const [bw] = await db.insert(bannedWords).values({ word: word.toLowerCase() }).returning();
    return bw;
  }

  async removeBannedWord(id: string): Promise<void> {
    await db.delete(bannedWords).where(eq(bannedWords.id, id));
  }

  // Message moderation
  async deleteMessage(messageId: string): Promise<void> {
    await db.delete(messages).where(eq(messages.id, messageId));
  }

  async deleteRoomMessage(messageId: string): Promise<void> {
    await db.delete(roomMessages).where(eq(roomMessages.id, messageId));
  }

  async deletePrivateRoomMessage(messageId: string): Promise<void> {
    await db.delete(privateRoomMessages).where(eq(privateRoomMessages.id, messageId));
  }

  async getAllRoomMessages(): Promise<RoomMessage[]> {
    return db.select().from(roomMessages).orderBy(desc(roomMessages.createdAt));
  }

  async createProfileRating(data: { raterId: string; ratedId: string; rating: number }): Promise<ProfileRating> {
    const [rating] = await db.insert(profileRatings).values(data).returning();
    return rating;
  }

  async getReceivedRatings(profileId: string): Promise<(ProfileRating & { rater: Profile })[]> {
    const ratings = await db.select().from(profileRatings)
      .where(eq(profileRatings.ratedId, profileId))
      .orderBy(desc(profileRatings.createdAt));
    
    const result: (ProfileRating & { rater: Profile })[] = [];
    for (const r of ratings) {
      const [rater] = await db.select().from(profiles).where(eq(profiles.id, r.raterId));
      if (rater) {
        result.push({ ...r, rater });
      }
    }
    return result;
  }

  async getProfileRating(id: string): Promise<ProfileRating | undefined> {
    const [rating] = await db.select().from(profileRatings).where(eq(profileRatings.id, id));
    return rating;
  }

  async getExistingRating(raterId: string, ratedId: string): Promise<ProfileRating | undefined> {
    const [rating] = await db.select().from(profileRatings)
      .where(and(eq(profileRatings.raterId, raterId), eq(profileRatings.ratedId, ratedId)));
    return rating;
  }

  async getRatingBetweenProfiles(profileAId: string, profileBId: string): Promise<ProfileRating | undefined> {
    const [rating] = await db.select().from(profileRatings)
      .where(
        or(
          and(eq(profileRatings.raterId, profileAId), eq(profileRatings.ratedId, profileBId)),
          and(eq(profileRatings.raterId, profileBId), eq(profileRatings.ratedId, profileAId))
        )
      );
    return rating;
  }

  async replyToRating(ratingId: string, reply: string): Promise<ProfileRating | undefined> {
    const [updated] = await db.update(profileRatings)
      .set({ ratedReply: reply, repliedAt: new Date() })
      .where(eq(profileRatings.id, ratingId))
      .returning();
    return updated;
  }

  async markRatingMatchCreated(ratingId: string): Promise<void> {
    await db.update(profileRatings)
      .set({ matchCreated: true })
      .where(eq(profileRatings.id, ratingId));
  }

  async activateVibing(data: { profileId: string; latitude: number; longitude: number; radiusKm: number }): Promise<VibingSession> {
    await db.delete(vibingSessions).where(eq(vibingSessions.profileId, data.profileId));
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    const [session] = await db.insert(vibingSessions).values({
      profileId: data.profileId,
      latitude: data.latitude,
      longitude: data.longitude,
      radiusKm: data.radiusKm,
      expiresAt,
      active: true,
    }).returning();
    return session;
  }

  async deactivateVibing(profileId: string): Promise<void> {
    await db.update(vibingSessions)
      .set({ active: false, expiresAt: new Date() })
      .where(and(eq(vibingSessions.profileId, profileId), eq(vibingSessions.active, true)));
  }

  async getActiveVibingSession(profileId: string): Promise<VibingSession | undefined> {
    const [session] = await db.select().from(vibingSessions)
      .where(and(
        eq(vibingSessions.profileId, profileId),
        eq(vibingSessions.active, true),
      ));
    if (session && new Date(session.expiresAt) <= new Date()) {
      await this.deactivateVibing(profileId);
      return undefined;
    }
    return session;
  }

  async getNearbyVibers(lat: number, lng: number, radiusKm: number, excludeProfileId: string): Promise<(VibingSession & { profile: Profile })[]> {
    const now = new Date();
    const activeSessions = await db.select().from(vibingSessions)
      .where(and(
        eq(vibingSessions.active, true),
        sql`${vibingSessions.expiresAt} > ${now}`,
      ));

    const validSessions = activeSessions.filter(s => s.profileId !== excludeProfileId);

    const haversineDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
      const R = 6371;
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLng = (lng2 - lng1) * Math.PI / 180;
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };

    const nearbySessions = validSessions.filter(s => haversineDistance(lat, lng, s.latitude, s.longitude) <= radiusKm);
    if (nearbySessions.length === 0) return [];

    const profileIds = nearbySessions.map(s => s.profileId);
    const nearbyProfiles = await db.select().from(profiles)
      .where(sql`${profiles.id} IN (${sql.join(profileIds.map(id => sql`${id}`), sql`, `)})`);
    const profileMap = new Map(nearbyProfiles.map(p => [p.id, p]));

    return nearbySessions
      .filter(s => profileMap.has(s.profileId))
      .map(s => ({ ...s, profile: profileMap.get(s.profileId)! }));
  }
  async blockUser(blockerId: string, blockedId: string): Promise<BlockedUser> {
    const existing = await db.select().from(blockedUsers)
      .where(and(eq(blockedUsers.blockerId, blockerId), eq(blockedUsers.blockedId, blockedId)));
    if (existing.length > 0) return existing[0];
    const [block] = await db.insert(blockedUsers).values({ blockerId, blockedId }).returning();
    return block;
  }

  async unblockUser(blockerId: string, blockedId: string): Promise<void> {
    await db.delete(blockedUsers)
      .where(and(eq(blockedUsers.blockerId, blockerId), eq(blockedUsers.blockedId, blockedId)));
  }

  async getBlockedUsers(blockerId: string): Promise<BlockedUser[]> {
    return db.select().from(blockedUsers).where(eq(blockedUsers.blockerId, blockerId));
  }

  async isBlocked(blockerId: string, blockedId: string): Promise<boolean> {
    const [block] = await db.select().from(blockedUsers)
      .where(and(eq(blockedUsers.blockerId, blockerId), eq(blockedUsers.blockedId, blockedId)));
    return !!block;
  }

  async getBlockedIds(profileId: string): Promise<string[]> {
    const blocks = await db.select().from(blockedUsers)
      .where(or(eq(blockedUsers.blockerId, profileId), eq(blockedUsers.blockedId, profileId)));
    const ids = new Set<string>();
    blocks.forEach(b => {
      if (b.blockerId === profileId) ids.add(b.blockedId);
      else ids.add(b.blockerId);
    });
    return Array.from(ids);
  }

  async updateLocationShare(profileId: string, lat: number, lng: number): Promise<LocationShare> {
    const existing = await db.select().from(locationShares).where(eq(locationShares.profileId, profileId));
    if (existing.length > 0) {
      const [updated] = await db.update(locationShares)
        .set({ latitude: lat, longitude: lng, active: true, updatedAt: new Date() })
        .where(eq(locationShares.profileId, profileId))
        .returning();
      return updated;
    }
    const [created] = await db.insert(locationShares)
      .values({ profileId, latitude: lat, longitude: lng, active: true })
      .returning();
    return created;
  }

  async deactivateLocationShare(profileId: string): Promise<void> {
    await db.update(locationShares)
      .set({ active: false })
      .where(eq(locationShares.profileId, profileId));
  }

  async getLocationShare(profileId: string): Promise<LocationShare | undefined> {
    const [share] = await db.select().from(locationShares)
      .where(and(eq(locationShares.profileId, profileId), eq(locationShares.active, true)));
    return share;
  }

  async getMatchLocationShares(profileId: string): Promise<(LocationShare & { profile: Profile })[]> {
    const userMatches = await db.select().from(matches)
      .where(or(eq(matches.profile1Id, profileId), eq(matches.profile2Id, profileId)));
    const matchedIds = userMatches.map(m => m.profile1Id === profileId ? m.profile2Id : m.profile1Id);
    if (matchedIds.length === 0) return [];

    const activeShares = await db.select().from(locationShares)
      .where(and(
        eq(locationShares.active, true),
        sql`${locationShares.profileId} IN (${sql.join(matchedIds.map(id => sql`${id}`), sql`, `)})`
      ));

    if (activeShares.length === 0) return [];

    const shareProfileIds = activeShares.map(s => s.profileId);
    const shareProfiles = await db.select().from(profiles)
      .where(sql`${profiles.id} IN (${sql.join(shareProfileIds.map(id => sql`${id}`), sql`, `)})`);

    const profileMap = new Map(shareProfiles.filter(p => p.locationSharingEnabled).map(p => [p.id, p]));

    return activeShares
      .filter(s => profileMap.has(s.profileId))
      .map(s => ({ ...s, profile: profileMap.get(s.profileId)! }));
  }
  async getProfileVideos(profileId: string): Promise<ProfileVideo[]> {
    return db.select().from(profileVideos)
      .where(eq(profileVideos.profileId, profileId))
      .orderBy(desc(profileVideos.createdAt));
  }

  async addProfileVideo(data: InsertProfileVideo): Promise<ProfileVideo> {
    const [video] = await db.insert(profileVideos).values(data).returning();
    return video;
  }

  async deleteProfileVideo(id: string): Promise<void> {
    await db.delete(profileVideos).where(eq(profileVideos.id, id));
  }

  async getProfileVideoById(id: string): Promise<ProfileVideo | undefined> {
    const [video] = await db.select().from(profileVideos).where(eq(profileVideos.id, id));
    return video;
  }

  async getVideosForInactiveProfiles(cutoffDate: Date): Promise<ProfileVideo[]> {
    return db.select()
    .from(profileVideos)
    .innerJoin(profiles, eq(profiles.id, profileVideos.profileId))
    .where(lt(profiles.lastActiveAt, cutoffDate));
  }

  async sendColdMessage(fromProfileId: string, toProfileId: string, content: string, mediaUrl?: string, mediaType?: string): Promise<{ status: "sent" | "already_exists" | "already_replied"; coldMessage?: ColdMessage }> {
    // Silent-drop guard: if the recipient has ever reported this sender (including
    // recreated accounts sharing the same underlying userId), discard the message
    // without persisting it. Return "sent" so the caller gets no information about
    // the filter. This lives here — not only in the HTTP route — so every delivery
    // path (direct call, tests, future integrations) enforces the same rule.
    const reported = await this.isSenderReportedByRecipient(fromProfileId, toProfileId);
    if (reported) {
      return { status: "sent" };
    }

    const existing = await db.select().from(coldMessages)
      .where(and(eq(coldMessages.fromProfileId, fromProfileId), eq(coldMessages.toProfileId, toProfileId)))
      .limit(1);
    if (existing.length > 0) {
      return { status: existing[0].replied ? "already_replied" : "already_exists", coldMessage: existing[0] };
    }
    const [msg] = await db.insert(coldMessages).values({ fromProfileId, toProfileId, content, mediaUrl: mediaUrl || null, mediaType: mediaType || null }).returning();
    return { status: "sent", coldMessage: msg };
  }

  async getColdMessagesReceived(toProfileId: string): Promise<Array<ColdMessage & { fromProfile: { id: string; name: string; imageUrl: string; age: number } }>> {
    // Fetch IDs of profiles that this user has ever reported (soft ignore list).
    // Also capture the underlying userId so we can catch account re-creations:
    // if B deletes their profile and creates a new one (new UUID, same userId),
    // the old report's reportedUserId links to the new profile.
    const reportedRows = await db
      .select({ reportedId: reports.reportedId, reportedUserId: reports.reportedUserId })
      .from(reports)
      .where(eq(reports.reporterId, toProfileId));
    const reportedIds = new Set(reportedRows.map(r => r.reportedId));

    // Collect underlying userIds from reports (non-null only)
    const reportedUserIds = reportedRows
      .map(r => r.reportedUserId)
      .filter((uid): uid is string => !!uid);

    // Find all current profiles that share a reported userId (catches re-created accounts)
    if (reportedUserIds.length > 0) {
      const sibling = await db
        .select({ id: profiles.id })
        .from(profiles)
        .where(inArray(profiles.userId, reportedUserIds));
      sibling.forEach(p => reportedIds.add(p.id));
    }

    const rows = await db.select({
      id: coldMessages.id,
      fromProfileId: coldMessages.fromProfileId,
      toProfileId: coldMessages.toProfileId,
      content: coldMessages.content,
      mediaUrl: coldMessages.mediaUrl,
      mediaType: coldMessages.mediaType,
      replied: coldMessages.replied,
      replyContent: coldMessages.replyContent,
      privateRoomId: coldMessages.privateRoomId,
      createdAt: coldMessages.createdAt,
      fromId: profiles.id,
      fromName: profiles.name,
      fromImage: profiles.imageUrl,
      fromAge: profiles.age,
    })
    .from(coldMessages)
    .innerJoin(profiles, eq(profiles.id, coldMessages.fromProfileId))
    .where(eq(coldMessages.toProfileId, toProfileId))
    .orderBy(desc(coldMessages.createdAt));

    // Filter out messages from reported senders (persistent soft-ignore regardless of block status)
    const filtered = reportedIds.size > 0
      ? rows.filter(r => !reportedIds.has(r.fromProfileId))
      : rows;
    return filtered.map(r => ({
      id: r.id, fromProfileId: r.fromProfileId, toProfileId: r.toProfileId,
      content: r.content, mediaUrl: r.mediaUrl, mediaType: r.mediaType,
      replied: r.replied, replyContent: r.replyContent,
      privateRoomId: r.privateRoomId, createdAt: r.createdAt,
      fromProfile: { id: r.fromId, name: r.fromName, imageUrl: r.fromImage, age: r.fromAge },
    }));
  }

  async getColdMessageBetween(fromProfileId: string, toProfileId: string): Promise<ColdMessage | null> {
    const [msg] = await db.select().from(coldMessages)
      .where(and(eq(coldMessages.fromProfileId, fromProfileId), eq(coldMessages.toProfileId, toProfileId)))
      .orderBy(desc(coldMessages.createdAt))
      .limit(1);
    return msg ?? null;
  }

  async getColdMessageById(id: string): Promise<ColdMessage | null> {
    const [msg] = await db.select().from(coldMessages).where(eq(coldMessages.id, id)).limit(1);
    return msg ?? null;
  }

  async replyColdMessage(messageId: string, replyContent: string): Promise<{ privateRoomId: string }> {
    const [msg] = await db.select().from(coldMessages).where(eq(coldMessages.id, messageId)).limit(1);
    if (!msg) throw new Error("Cold message not found");

    const fromProfile = await db.select().from(profiles).where(eq(profiles.id, msg.fromProfileId)).limit(1);
    const toProfile = await db.select().from(profiles).where(eq(profiles.id, msg.toProfileId)).limit(1);
    if (!fromProfile[0] || !toProfile[0]) throw new Error("Profiles not found");

    const [room] = await db.insert(privateRooms).values({
      ownerId: msg.toProfileId,
      name: `${toProfile[0].name} & ${fromProfile[0].name}`,
      description: "Conversazione privata",
      isActive: true,
    }).returning();

    await db.insert(privateRoomRequests).values({
      roomId: room.id,
      requesterId: msg.fromProfileId,
      status: "approved",
    });

    // Inserisci il messaggio originale dell'utente nella room
    if (msg.content?.trim()) {
      await db.insert(privateRoomMessages).values({
        roomId: room.id,
        senderId: fromProfile[0].id,
        senderName: fromProfile[0].name,
        senderImage: fromProfile[0].imageUrl,
        content: msg.content,
      });
    }

    // Inserisci la risposta nella room
    await db.insert(privateRoomMessages).values({
      roomId: room.id,
      senderId: toProfile[0].id,
      senderName: toProfile[0].name,
      senderImage: toProfile[0].imageUrl,
      content: replyContent,
    });

    await db.update(coldMessages)
      .set({ replied: true, replyContent, privateRoomId: room.id })
      .where(eq(coldMessages.id, messageId));

    return { privateRoomId: room.id };
  }

  async getSentColdMessages(fromProfileId: string): Promise<Array<{
    id: string; toProfileId: string; content: string; mediaUrl: string | null; mediaType: string | null;
    replied: boolean; replyContent: string | null; privateRoomId: string | null; createdAt: Date;
    toProfile: { id: string; name: string; imageUrl: string; age: number };
  }>> {
    const rows = await db
      .select({
        id: coldMessages.id,
        toProfileId: coldMessages.toProfileId,
        content: coldMessages.content,
        mediaUrl: coldMessages.mediaUrl,
        mediaType: coldMessages.mediaType,
        replied: coldMessages.replied,
        replyContent: coldMessages.replyContent,
        privateRoomId: coldMessages.privateRoomId,
        createdAt: coldMessages.createdAt,
        toId: profiles.id,
        toName: profiles.name,
        toImage: profiles.imageUrl,
        toAge: profiles.age,
      })
      .from(coldMessages)
      .innerJoin(profiles, eq(profiles.id, coldMessages.toProfileId))
      .where(eq(coldMessages.fromProfileId, fromProfileId))
      .orderBy(desc(coldMessages.createdAt));

    return rows.map(r => ({
      id: r.id,
      toProfileId: r.toProfileId,
      content: r.content,
      mediaUrl: r.mediaUrl,
      mediaType: r.mediaType,
      replied: r.replied,
      replyContent: r.replyContent,
      privateRoomId: r.privateRoomId,
      createdAt: r.createdAt,
      toProfile: { id: r.toId, name: r.toName, imageUrl: r.toImage ?? "", age: r.toAge ?? 0 },
    }));
  }

  async deleteColdMessage(messageId: string, toProfileId: string): Promise<void> {
    await db.delete(coldMessages).where(
      and(eq(coldMessages.id, messageId), eq(coldMessages.toProfileId, toProfileId))
    );
  }

  async isSenderReportedByRecipient(senderProfileId: string, recipientProfileId: string): Promise<boolean> {
    // Direct UUID match (the usual case: reporter still holds the original report row)
    const [direct] = await db
      .select({ id: reports.id })
      .from(reports)
      .where(and(eq(reports.reporterId, recipientProfileId), eq(reports.reportedId, senderProfileId)))
      .limit(1);
    if (direct) return true;

    // userId-level match: catches recreated accounts (same underlying auth user, new profile UUID).
    // Look up the sender's userId, then check if the recipient has ever reported a profile
    // that carried that same userId (stored in reportedUserId at report-creation time).
    const [senderProfile] = await db
      .select({ userId: profiles.userId })
      .from(profiles)
      .where(eq(profiles.id, senderProfileId))
      .limit(1);
    if (!senderProfile?.userId) return false;

    const [byUserId] = await db
      .select({ id: reports.id })
      .from(reports)
      .where(and(eq(reports.reporterId, recipientProfileId), eq(reports.reportedUserId, senderProfile.userId)))
      .limit(1);
    return !!byUserId;
  }

  async deleteSentColdMessage(fromProfileId: string, toProfileId: string): Promise<void> {
    await db.delete(coldMessages).where(
      and(eq(coldMessages.fromProfileId, fromProfileId), eq(coldMessages.toProfileId, toProfileId))
    );
  }

  async getReceivedReactions(toProfileId: string, limit = 50): Promise<Array<{ id: string; reaction: string; createdAt: Date; fromProfile: { id: string; name: string; imageUrl: string; age: number } }>> {
    const rows = await db
      .select({
        id: profileReactions.id,
        reaction: profileReactions.reaction,
        createdAt: profileReactions.createdAt,
        fromId: profiles.id,
        fromName: profiles.name,
        fromImage: profiles.imageUrl,
        fromAge: profiles.age,
      })
      .from(profileReactions)
      .innerJoin(profiles, eq(profiles.id, profileReactions.fromProfileId))
      .where(eq(profileReactions.toProfileId, toProfileId))
      .orderBy(desc(profileReactions.createdAt))
      .limit(limit);
    return rows.map(r => ({
      id: r.id,
      reaction: r.reaction,
      createdAt: r.createdAt,
      fromProfile: { id: r.fromId, name: r.fromName, imageUrl: r.fromImage, age: r.fromAge },
    }));
  }

  async upsertProfileReaction(fromProfileId: string, toProfileId: string, reaction: ReactionType): Promise<"added" | "changed" | "removed"> {
    const existing = await db.select().from(profileReactions)
      .where(and(eq(profileReactions.fromProfileId, fromProfileId), eq(profileReactions.toProfileId, toProfileId)))
      .limit(1);
    if (existing.length > 0) {
      if (existing[0].reaction === reaction) {
        await db.delete(profileReactions)
          .where(and(eq(profileReactions.fromProfileId, fromProfileId), eq(profileReactions.toProfileId, toProfileId)));
        return "removed";
      } else {
        await db.update(profileReactions).set({ reaction, createdAt: new Date() })
          .where(and(eq(profileReactions.fromProfileId, fromProfileId), eq(profileReactions.toProfileId, toProfileId)));
        return "changed";
      }
    } else {
      await db.insert(profileReactions).values({ fromProfileId, toProfileId, reaction });
      return "added";
    }
  }

  async getReactionCounts(toProfileId: string, viewerProfileId?: string): Promise<{ counts: Record<string, number>; myReaction: string | null }> {
    const rows = await db.select({ reaction: profileReactions.reaction })
      .from(profileReactions)
      .where(eq(profileReactions.toProfileId, toProfileId));
    const counts: Record<string, number> = {};
    for (const row of rows) {
      counts[row.reaction] = (counts[row.reaction] || 0) + 1;
    }
    let myReaction: string | null = null;
    if (viewerProfileId) {
      const mine = await db.select({ reaction: profileReactions.reaction })
        .from(profileReactions)
        .where(and(eq(profileReactions.fromProfileId, viewerProfileId), eq(profileReactions.toProfileId, toProfileId)))
        .limit(1);
      myReaction = mine.length > 0 ? mine[0].reaction : null;
    }
    return { counts, myReaction };
  }

  async getStoriesFeed(limit = 30): Promise<Array<{ profileId: string; profileName: string; profileImage: string | null; videoUrl: string; thumbnailUrl: string | null; createdAt: Date }>> {
    const rows = await db.select({
      profileId: profileVideos.profileId,
      profileName: profiles.name,
      profileImage: profiles.imageUrl,
      videoUrl: profileVideos.videoUrl,
      thumbnailUrl: profileVideos.thumbnailUrl,
      createdAt: profileVideos.createdAt,
    })
    .from(profileVideos)
    .innerJoin(profiles, eq(profiles.id, profileVideos.profileId))
    .orderBy(desc(profileVideos.createdAt))
    .limit(limit * 3);

    const seen = new Set<string>();
    const result: typeof rows = [];
    for (const row of rows) {
      if (!seen.has(row.profileId)) {
        seen.add(row.profileId);
        result.push(row);
        if (result.length >= limit) break;
      }
    }
    return result;
  }

  // ─── Cosmic Signals ────────────────────────────────────────────────────────

  async getProfileSignals(profileId: string, limit = 5): Promise<Pick<CosmicSignal, "id" | "content" | "mediaUrl" | "mediaType" | "createdAt">[]> {
    const rows = await db
      .select({ id: cosmicSignals.id, content: cosmicSignals.content, mediaUrl: cosmicSignals.mediaUrl, mediaType: cosmicSignals.mediaType, createdAt: cosmicSignals.createdAt })
      .from(cosmicSignals)
      .where(eq(cosmicSignals.profileId, profileId))
      .orderBy(desc(cosmicSignals.createdAt))
      .limit(limit);
    return rows;
  }

  async getSignalsFeed(myProfileId: string, limit = 50): Promise<Array<CosmicSignal & { profile: Profile; likesCount: number; commentsCount: number; hasLiked: boolean }>> {
    const signals = await db.select().from(cosmicSignals)
      .where(sql`${cosmicSignals.toProfileId} IS NULL`)
      .orderBy(desc(cosmicSignals.createdAt)).limit(limit);
    if (!signals.length) return [];

    const profileIds = [...new Set(signals.map(s => s.profileId))];
    const profileRows = await db.select().from(profiles).where(inArray(profiles.id, profileIds));
    const profileMap = new Map(profileRows.map(p => [p.id, p]));

    const signalIds = signals.map(s => s.id);
    const likesRows = await db.select().from(signalLikes).where(inArray(signalLikes.signalId, signalIds));
    const likesCountMap = new Map<string, number>();
    const myLikesSet = new Set<string>();
    for (const l of likesRows) {
      likesCountMap.set(l.signalId, (likesCountMap.get(l.signalId) || 0) + 1);
      if (l.profileId === myProfileId) myLikesSet.add(l.signalId);
    }
    const commentsRows = await db.select({ signalId: signalComments.signalId, cnt: sql<number>`count(*)::int` })
      .from(signalComments).where(inArray(signalComments.signalId, signalIds))
      .groupBy(signalComments.signalId);
    const commentsCountMap = new Map(commentsRows.map(r => [r.signalId, Number(r.cnt)]));

    return signals.map(s => ({
      ...s,
      profile: profileMap.get(s.profileId) as Profile,
      likesCount: likesCountMap.get(s.id) || 0,
      commentsCount: commentsCountMap.get(s.id) || 0,
      hasLiked: myLikesSet.has(s.id),
    })).filter(s => s.profile);
  }

  async createSignal(data: { profileId: string; content: string; mediaUrl?: string; mediaType?: string; toProfileId?: string; textColor?: string | null; backgroundColor?: string | null }): Promise<CosmicSignal> {
    const [signal] = await db.insert(cosmicSignals).values({
      profileId: data.profileId,
      toProfileId: data.toProfileId || null,
      content: data.content,
      mediaUrl: data.mediaUrl || null,
      mediaType: data.mediaType || "text",
      textColor: data.textColor || null,
      backgroundColor: data.backgroundColor || null,
    }).returning();
    return signal;
  }

  async getReceivedDirectSignals(toProfileId: string): Promise<Array<Pick<CosmicSignal, "id" | "content" | "mediaUrl" | "mediaType" | "createdAt"> & { fromProfile: Pick<Profile, "id" | "name" | "age" | "imageUrl"> }>> {
    const signals = await db.select({
      id: cosmicSignals.id,
      content: cosmicSignals.content,
      mediaUrl: cosmicSignals.mediaUrl,
      mediaType: cosmicSignals.mediaType,
      createdAt: cosmicSignals.createdAt,
      fromProfileId: cosmicSignals.profileId,
    }).from(cosmicSignals)
      .where(eq(cosmicSignals.toProfileId, toProfileId))
      .orderBy(desc(cosmicSignals.createdAt));
    if (!signals.length) return [];
    const profileIds = [...new Set(signals.map(s => s.fromProfileId))];
    const profileRows = await db.select({ id: profiles.id, name: profiles.name, age: profiles.age, imageUrl: profiles.imageUrl })
      .from(profiles).where(inArray(profiles.id, profileIds));
    const profileMap = new Map(profileRows.map(p => [p.id, p]));
    return signals.map(s => ({
      id: s.id, content: s.content, mediaUrl: s.mediaUrl, mediaType: s.mediaType, createdAt: s.createdAt,
      fromProfile: profileMap.get(s.fromProfileId) as Pick<Profile, "id" | "name" | "age" | "imageUrl">,
    })).filter(s => s.fromProfile);
  }

  async deleteSignal(id: string, profileId: string): Promise<void> {
    await db.delete(cosmicSignals).where(and(eq(cosmicSignals.id, id), eq(cosmicSignals.profileId, profileId)));
  }

  async toggleSignalLike(signalId: string, profileId: string): Promise<{ liked: boolean; count: number }> {
    const [existing] = await db.select().from(signalLikes).where(
      and(eq(signalLikes.signalId, signalId), eq(signalLikes.profileId, profileId))
    );
    if (existing) {
      await db.delete(signalLikes).where(eq(signalLikes.id, existing.id));
    } else {
      await db.insert(signalLikes).values({ signalId, profileId });
    }
    const [row] = await db.select({ cnt: sql<number>`count(*)::int` }).from(signalLikes).where(eq(signalLikes.signalId, signalId));
    return { liked: !existing, count: Number(row?.cnt ?? 0) };
  }

  async getSignalComments(signalId: string): Promise<Array<SignalComment & { profile: Profile }>> {
    const comments = await db.select().from(signalComments).where(eq(signalComments.signalId, signalId)).orderBy(signalComments.createdAt);
    if (!comments.length) return [];
    const profileIds = [...new Set(comments.map(c => c.profileId))];
    const profileRows = await db.select().from(profiles).where(inArray(profiles.id, profileIds));
    const profileMap = new Map(profileRows.map(p => [p.id, p]));
    return comments.map(c => ({ ...c, profile: profileMap.get(c.profileId) as Profile })).filter(c => c.profile);
  }

  async addSignalComment(data: { signalId: string; profileId: string; content: string }): Promise<SignalComment & { profile: Profile }> {
    const [comment] = await db.insert(signalComments).values(data).returning();
    const [profile] = await db.select().from(profiles).where(eq(profiles.id, data.profileId));
    return { ...comment, profile };
  }

  async getFavorites(profileId: string): Promise<Array<ProfileFavorite & { profile: Profile }>> {
    const favs = await db.select().from(profileFavorites).where(eq(profileFavorites.profileId, profileId)).orderBy(desc(profileFavorites.createdAt));
    if (!favs.length) return [];
    const profileIds = favs.map(f => f.favoritedProfileId);
    const profileRows = await db.select().from(profiles).where(inArray(profiles.id, profileIds));
    const profileMap = new Map(profileRows.map(p => [p.id, p]));
    return favs.map(f => ({ ...f, profile: profileMap.get(f.favoritedProfileId) as Profile })).filter(f => f.profile);
  }

  async addFavorite(profileId: string, favoritedProfileId: string): Promise<ProfileFavorite> {
    const existing = await db.select().from(profileFavorites).where(and(eq(profileFavorites.profileId, profileId), eq(profileFavorites.favoritedProfileId, favoritedProfileId)));
    if (existing.length > 0) return existing[0];
    const [fav] = await db.insert(profileFavorites).values({ profileId, favoritedProfileId }).returning();
    return fav;
  }

  async removeFavorite(profileId: string, favoritedProfileId: string): Promise<void> {
    await db.delete(profileFavorites).where(and(eq(profileFavorites.profileId, profileId), eq(profileFavorites.favoritedProfileId, favoritedProfileId)));
  }

  async isFavorite(profileId: string, favoritedProfileId: string): Promise<boolean> {
    const [existing] = await db.select().from(profileFavorites).where(and(eq(profileFavorites.profileId, profileId), eq(profileFavorites.favoritedProfileId, favoritedProfileId)));
    return !!existing;
  }

  async sendVibrappDm(fromProfileId: string, toProfileId: string, content: string): Promise<VibrappDm> {
    const [dm] = await db.insert(vibrappDms).values({ fromProfileId, toProfileId, content }).returning();
    return dm;
  }

  async getVibrappDmThread(myProfileId: string, otherProfileId: string, limit = 100): Promise<VibrappDm[]> {
    return db.select().from(vibrappDms)
      .where(
        or(
          and(eq(vibrappDms.fromProfileId, myProfileId), eq(vibrappDms.toProfileId, otherProfileId)),
          and(eq(vibrappDms.fromProfileId, otherProfileId), eq(vibrappDms.toProfileId, myProfileId))
        )
      )
      .orderBy(vibrappDms.createdAt)
      .limit(limit);
  }

  async markVibrappDmRead(myProfileId: string, otherProfileId: string): Promise<void> {
    await db.update(vibrappDms)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(vibrappDms.fromProfileId, otherProfileId),
          eq(vibrappDms.toProfileId, myProfileId),
          sql`${vibrappDms.readAt} IS NULL`
        )
      );
  }

  async getVibrappDmUnreadCount(myProfileId: string): Promise<number> {
    const result = await db.select({ count: sql<number>`COUNT(*)` })
      .from(vibrappDms)
      .where(and(eq(vibrappDms.toProfileId, myProfileId), sql`${vibrappDms.readAt} IS NULL`));
    return Number(result[0]?.count ?? 0);
  }

  async getVibrappDmConversations(myProfileId: string): Promise<Array<{ otherProfileId: string; lastMessage: VibrappDm; unreadCount: number }>> {
    const rows = await db.execute(sql`
      SELECT DISTINCT ON (other_id) other_id,
        id, from_profile_id, to_profile_id, content, read_at, created_at,
        unread
      FROM (
        SELECT
          CASE WHEN from_profile_id = ${myProfileId} THEN to_profile_id ELSE from_profile_id END AS other_id,
          id, from_profile_id, to_profile_id, content, read_at, created_at,
          (to_profile_id = ${myProfileId} AND read_at IS NULL)::int AS unread
        FROM vibrapp_dms
        WHERE from_profile_id = ${myProfileId} OR to_profile_id = ${myProfileId}
      ) sub
      ORDER BY other_id, created_at DESC
    `);

    const otherIds = (rows.rows as any[]).map(r => r.other_id as string);
    if (!otherIds.length) return [];

    const unreadCounts = await db.execute(sql`
      SELECT from_profile_id AS other_id, COUNT(*) AS cnt
      FROM vibrapp_dms
      WHERE to_profile_id = ${myProfileId} AND read_at IS NULL
      GROUP BY from_profile_id
    `);
    const unreadMap = new Map<string, number>();
    for (const r of (unreadCounts.rows as any[])) {
      unreadMap.set(r.other_id as string, Number(r.cnt));
    }

    return (rows.rows as any[]).map(r => ({
      otherProfileId: r.other_id as string,
      lastMessage: {
        id: r.id, fromProfileId: r.from_profile_id, toProfileId: r.to_profile_id,
        content: r.content, readAt: r.read_at, createdAt: r.created_at,
      } as VibrappDm,
      unreadCount: unreadMap.get(r.other_id as string) ?? 0,
    }));
  }

  // ─── VibraDNA ───────────────────────────────────────────────────────────────
  async trackDnaEvent(profileId: string, eventType: string, value: number): Promise<void> {
    await db.insert(dnaEvents).values({ id: randomUUID(), profileId, eventType, value });
    // Aggiorna DNA asincrono (fire-and-forget) ogni N eventi
    this.computeAndStoreDna(profileId).catch(() => {});
  }

  async computeAndStoreDna(profileId: string): Promise<Record<string, number>> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const events = await db.select().from(dnaEvents)
      .where(and(eq(dnaEvents.profileId, profileId), gt(dnaEvents.createdAt, thirtyDaysAgo)));

    const byType: Record<string, number[]> = {};
    for (const ev of events) {
      if (!byType[ev.eventType]) byType[ev.eventType] = [];
      byType[ev.eventType].push(ev.value);
    }

    const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
    const clamp = (v: number) => Math.min(1, Math.max(0, v));

    const swipes = byType['swipe'] ?? [];
    const likesRatio = swipes.length ? swipes.filter(v => v > 0).length / swipes.length : 0.5;

    const msgs = byType['message'] ?? [];
    const avgMsgLen = avg(msgs);
    const expressiveness = clamp(avgMsgLen / 150);

    const responseMs = byType['response_time'] ?? [];
    const avgResp = avg(responseMs);
    const socialInitiative = avgResp > 0 ? clamp(1 - avgResp / 3600000) : 0.5;

    const roomJoins = byType['room_join'] ?? [];
    const communityEngagement = clamp(roomJoins.length / 10);

    const challenges = byType['challenge_complete'] ?? [];
    const gamificationDrive = clamp(challenges.length / 5);

    const vector: Record<string, number> = {
      engagement_depth: clamp(likesRatio),
      expressiveness: clamp(expressiveness),
      social_initiative: clamp(socialInitiative),
      community_engagement: clamp(communityEngagement),
      gamification_drive: clamp(gamificationDrive),
    };

    await db.insert(userDna).values({ profileId, behaviorVector: JSON.stringify(vector) })
      .onConflictDoUpdate({ target: userDna.profileId, set: { behaviorVector: JSON.stringify(vector), lastUpdated: new Date() } });

    return vector;
  }

  async getDna(profileId: string): Promise<Record<string, number>> {
    const [row] = await db.select().from(userDna).where(eq(userDna.profileId, profileId));
    if (!row) return await this.computeAndStoreDna(profileId);
    try { return JSON.parse(row.behaviorVector); } catch { return {}; }
  }

  async getDnaCompatibility(profileId1: string, profileId2: string) {
    const [dna1, dna2] = await Promise.all([this.getDna(profileId1), this.getDna(profileId2)]);
    const traits = ['engagement_depth', 'expressiveness', 'social_initiative', 'community_engagement', 'gamification_drive'];

    let score = 0;
    const details: Record<string, { mine: number; theirs: number; diff: number }> = {};

    for (const trait of traits) {
      const mine = dna1[trait] ?? 0.5;
      const theirs = dna2[trait] ?? 0.5;
      const diff = Math.abs(mine - theirs);
      details[trait] = { mine, theirs, diff };
      // Complementarità: differenza moderata = buon match
      if (diff >= 0.2 && diff <= 0.6) score += 1.0;
      else if (diff < 0.2) score += 0.5;
      // diff > 0.6 → 0 punti
    }

    const normalizedScore = score / traits.length;
    const percent = Math.round(normalizedScore * 100);

    let label = '';
    if (percent >= 80) label = '🌌 Risonanza cosmica';
    else if (percent >= 60) label = '✨ Alta compatibilità';
    else if (percent >= 40) label = '🛸 Buona vibrazione';
    else label = '🌙 Frequenze diverse';

    return { score: percent, label, details };
  }

  // ─── VibraGhost ─────────────────────────────────────────────────────────────
  async setGhostMode(profileId: string, hours: number): Promise<Date> {
    const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);
    await db.update(profiles).set({ ghostModeExpiresAt: expiresAt }).where(eq(profiles.id, profileId));
    return expiresAt;
  }

  async deactivateGhostMode(profileId: string): Promise<void> {
    await db.update(profiles).set({ ghostModeExpiresAt: null }).where(eq(profiles.id, profileId));
  }

  async getGhostStatus(profileId: string): Promise<{ active: boolean; expiresAt: Date | null }> {
    const [profile] = await db.select({ ghostModeExpiresAt: profiles.ghostModeExpiresAt })
      .from(profiles).where(eq(profiles.id, profileId));
    if (!profile) return { active: false, expiresAt: null };
    const expiresAt = profile.ghostModeExpiresAt;
    const active = !!expiresAt && new Date(expiresAt) > new Date();
    return { active, expiresAt: active ? expiresAt : null };
  }

  // ── VibraStory ────────────────────────────────────────────────────────────

  async getStories(roomId?: string): Promise<Story[]> {
    const rows = await db.execute(sql`
      SELECT * FROM stories
      WHERE status = 'active'
      ${roomId ? sql`AND room_id = ${roomId}` : sql``}
      ORDER BY created_at DESC
      LIMIT 50
    `);
    return (rows.rows as any[]).map(r => ({
      id: r.id, roomId: r.room_id, theme: r.theme, description: r.description,
      status: r.status, createdAt: r.created_at, completedAt: r.completed_at,
    }));
  }

  async getStory(id: string): Promise<Story | undefined> {
    const rows = await db.execute(sql`SELECT * FROM stories WHERE id = ${id}`);
    const r = rows.rows[0] as any;
    if (!r) return undefined;
    return { id: r.id, roomId: r.room_id, theme: r.theme, description: r.description, status: r.status, createdAt: r.created_at, completedAt: r.completed_at };
  }

  async createStory(data: { roomId?: string; theme: string; description?: string }): Promise<Story> {
    const id = randomUUID();
    await db.execute(sql`
      INSERT INTO stories (id, room_id, theme, description, status, created_at)
      VALUES (${id}, ${data.roomId ?? null}, ${data.theme}, ${data.description ?? null}, 'active', NOW())
    `);
    return (await this.getStory(id))!;
  }

  async getStoryBriciole(storyId: string, myProfileId?: string): Promise<Array<StoryBriciola & { profileName: string; profileImageUrl: string; myVote?: string }>> {
    const rows = await db.execute(sql`
      SELECT sb.*, p.name as profile_name, p.image_url as profile_image_url,
        sv.vote_type as my_vote
      FROM story_briciole sb
      JOIN profiles p ON p.id = sb.profile_id
      LEFT JOIN story_votes sv ON sv.briola_id = sb.id AND sv.profile_id = ${myProfileId ?? ''}
      WHERE sb.story_id = ${storyId}
      ORDER BY sb.votes DESC, sb.created_at ASC
    `);
    return (rows.rows as any[]).map(r => ({
      id: r.id, storyId: r.story_id, profileId: r.profile_id, content: r.content,
      mediaUrl: r.media_url, chapter: r.chapter, votes: r.votes, isSelected: r.is_selected,
      createdAt: r.created_at, profileName: r.profile_name, profileImageUrl: r.profile_image_url,
      myVote: r.my_vote ?? undefined,
    }));
  }

  async addBriciola(data: { storyId: string; profileId: string; content: string; mediaUrl?: string }): Promise<StoryBriciola> {
    const id = randomUUID();
    await db.execute(sql`
      INSERT INTO story_briciole (id, story_id, profile_id, content, media_url, chapter, votes, is_selected, created_at)
      VALUES (${id}, ${data.storyId}, ${data.profileId}, ${data.content}, ${data.mediaUrl ?? null}, 0, 0, FALSE, NOW())
    `);
    const rows = await db.execute(sql`SELECT * FROM story_briciole WHERE id = ${id}`);
    const r = rows.rows[0] as any;
    return { id: r.id, storyId: r.story_id, profileId: r.profile_id, content: r.content, mediaUrl: r.media_url, chapter: r.chapter, votes: r.votes, isSelected: r.is_selected, createdAt: r.created_at };
  }

  async voteBriciola(briolaId: string, profileId: string, voteType: string): Promise<void> {
    const voteId = randomUUID();
    await db.execute(sql`
      INSERT INTO story_votes (id, briola_id, profile_id, vote_type, created_at)
      VALUES (${voteId}, ${briolaId}, ${profileId}, ${voteType}, NOW())
      ON CONFLICT (briola_id, profile_id) DO UPDATE SET vote_type = ${voteType}
    `);
    await db.execute(sql`
      UPDATE story_briciole SET votes = (
        SELECT COUNT(*) FROM story_votes WHERE briola_id = ${briolaId} AND vote_type = 'up'
      ) - (
        SELECT COUNT(*) FROM story_votes WHERE briola_id = ${briolaId} AND vote_type = 'down'
      ) WHERE id = ${briolaId}
    `);
  }

  async removeVoteBriciola(briolaId: string, profileId: string): Promise<void> {
    await db.execute(sql`DELETE FROM story_votes WHERE briola_id = ${briolaId} AND profile_id = ${profileId}`);
    await db.execute(sql`
      UPDATE story_briciole SET votes = (
        SELECT COUNT(*) FROM story_votes WHERE briola_id = ${briolaId} AND vote_type = 'up'
      ) - (
        SELECT COUNT(*) FROM story_votes WHERE briola_id = ${briolaId} AND vote_type = 'down'
      ) WHERE id = ${briolaId}
    `);
  }

  async selectBriciola(briolaId: string): Promise<void> {
    await db.execute(sql`UPDATE story_briciole SET is_selected = TRUE WHERE id = ${briolaId}`);
  }

  async completeStory(storyId: string): Promise<void> {
    await db.execute(sql`UPDATE stories SET status = 'completed', completed_at = NOW() WHERE id = ${storyId}`);
  }

  // ── VibraVault ────────────────────────────────────────────────────────────

  async getMyVaultConfessions(profileId: string): Promise<VaultConfession[]> {
    const rows = await db.execute(sql`
      SELECT * FROM vault_confessions WHERE profile_id = ${profileId}
      ORDER BY created_at DESC
    `);
    return (rows.rows as any[]).map(r => ({
      id: r.id, profileId: r.profile_id, content: r.content, mediaUrl: r.media_url,
      expiresAt: r.expires_at, sentimentLegacy: r.sentiment_legacy, deletedAt: r.deleted_at, createdAt: r.created_at,
    }));
  }

  async createVaultConfession(data: { profileId: string; content: string; mediaUrl?: string; ttlDays: number }): Promise<VaultConfession> {
    const id = randomUUID();
    const expiresAt = new Date(Date.now() + data.ttlDays * 24 * 60 * 60 * 1000);
    await db.execute(sql`
      INSERT INTO vault_confessions (id, profile_id, content, media_url, expires_at, created_at)
      VALUES (${id}, ${data.profileId}, ${data.content}, ${data.mediaUrl ?? null}, ${expiresAt}, NOW())
    `);
    const rows = await db.execute(sql`SELECT * FROM vault_confessions WHERE id = ${id}`);
    const r = rows.rows[0] as any;
    return { id: r.id, profileId: r.profile_id, content: r.content, mediaUrl: r.media_url, expiresAt: r.expires_at, sentimentLegacy: r.sentiment_legacy, deletedAt: r.deleted_at, createdAt: r.created_at };
  }

  async deleteVaultConfession(id: string, profileId: string): Promise<void> {
    await db.execute(sql`UPDATE vault_confessions SET deleted_at = NOW() WHERE id = ${id} AND profile_id = ${profileId}`);
  }

  async cleanExpiredVaultConfessions(): Promise<void> {
    await db.execute(sql`
      UPDATE vault_confessions SET deleted_at = NOW()
      WHERE expires_at < NOW() AND deleted_at IS NULL
    `);
  }

  // ── VibraQuest ────────────────────────────────────────────────────────────

  private readonly QUEST_DEFINITIONS = [
    { type: 'swipe_10',     title: 'Gravitazione Cosmica',  desc: 'Esplora 10 profili',          target: 10, points: 10 },
    { type: 'message_5',   title: 'Connessioni Stellari',   desc: 'Invia 5 messaggi',            target: 5,  points: 15 },
    { type: 'room_visit',  title: 'Esplora il Cosmo',       desc: 'Visita una stanza',           target: 1,  points: 10 },
    { type: 'signal_post', title: 'Segnale Cosmico',        desc: 'Pubblica un Cosmic Signal',   target: 1,  points: 15 },
    { type: 'gift_send',   title: 'Regalo Alieno',          desc: 'Invia un regalo virtuale',    target: 1,  points: 15 },
  ] as const;

  async getDailyQuests(profileId: string): Promise<UserQuest[]> {
    const today = new Date().toISOString().slice(0, 10);
    // ensure all quests exist for today
    for (const q of this.QUEST_DEFINITIONS) {
      await db.execute(sql`
        INSERT INTO user_quests (id, profile_id, quest_type, progress, target, completed, claimed, points_reward, date)
        VALUES (${randomUUID()}, ${profileId}, ${q.type}, 0, ${q.target}, FALSE, FALSE, ${q.points}, ${today})
        ON CONFLICT (profile_id, quest_type, date) DO NOTHING
      `);
    }
    const rows = await db.execute(sql`
      SELECT * FROM user_quests WHERE profile_id = ${profileId} AND date = ${today} ORDER BY points_reward DESC
    `);
    return (rows.rows as any[]).map(r => ({
      id: r.id, profileId: r.profile_id, questType: r.quest_type,
      progress: r.progress, target: r.target, completed: r.completed, claimed: r.claimed,
      pointsReward: r.points_reward, date: r.date, completedAt: r.completed_at,
    }));
  }

  async trackQuestProgress(profileId: string, questType: string, increment = 1): Promise<void> {
    const today = new Date().toISOString().slice(0, 10);
    await db.execute(sql`
      UPDATE user_quests
      SET progress = LEAST(progress + ${increment}, target),
          completed = CASE WHEN progress + ${increment} >= target THEN TRUE ELSE completed END,
          completed_at = CASE WHEN progress + ${increment} >= target AND completed = FALSE THEN NOW() ELSE completed_at END
      WHERE profile_id = ${profileId} AND quest_type = ${questType} AND date = ${today} AND completed = FALSE
    `);
  }

  async claimQuestReward(questId: string, profileId: string): Promise<{ points: number }> {
    const rows = await db.execute(sql`
      SELECT * FROM user_quests WHERE id = ${questId} AND profile_id = ${profileId}
    `);
    const q = rows.rows[0] as any;
    if (!q || !q.completed || q.claimed) throw new Error("Quest non disponibile per il claim");
    await db.execute(sql`UPDATE user_quests SET claimed = TRUE WHERE id = ${questId}`);
    await db.execute(sql`UPDATE profiles SET points = COALESCE(points, 0) + ${q.points_reward} WHERE id = ${profileId}`);
    return { points: q.points_reward };
  }

  // ── VibraLegacy ──────────────────────────────────────────────────────────

  async getLegacy(profileId: string): Promise<VibraLegacy | undefined> {
    const rows = await db.execute(sql`SELECT * FROM vibra_legacies WHERE profile_id = ${profileId}`);
    const r = rows.rows[0] as any;
    if (!r) return undefined;
    return { profileId: r.profile_id, message: r.message, mediaUrl: r.media_url, revealAfterDays: r.reveal_after_days, createdAt: r.created_at, updatedAt: r.updated_at };
  }

  async saveLegacy(profileId: string, data: { message: string; mediaUrl?: string; revealAfterDays: number }): Promise<VibraLegacy> {
    await db.execute(sql`
      INSERT INTO vibra_legacies (profile_id, message, media_url, reveal_after_days, created_at, updated_at)
      VALUES (${profileId}, ${data.message}, ${data.mediaUrl ?? null}, ${data.revealAfterDays}, NOW(), NOW())
      ON CONFLICT (profile_id) DO UPDATE SET
        message = ${data.message}, media_url = ${data.mediaUrl ?? null},
        reveal_after_days = ${data.revealAfterDays}, updated_at = NOW()
    `);
    return (await this.getLegacy(profileId))!;
  }

  async deleteLegacy(profileId: string): Promise<void> {
    await db.execute(sql`DELETE FROM vibra_legacies WHERE profile_id = ${profileId}`);
  }

  // ── VibraMystery ──────────────────────────────────────────────────────────

  async setMysteryMode(profileId: string, hours: number): Promise<Date> {
    const expiresAt = new Date(Date.now() + hours * 3_600_000);
    await db.execute(sql`UPDATE profiles SET mystery_mode_expires_at = ${expiresAt} WHERE id = ${profileId}`);
    return expiresAt;
  }

  async deactivateMysteryMode(profileId: string): Promise<void> {
    await db.execute(sql`UPDATE profiles SET mystery_mode_expires_at = NULL WHERE id = ${profileId}`);
  }

  async getMysteryStatus(profileId: string): Promise<{ active: boolean; expiresAt: Date | null }> {
    const rows = await db.execute(sql`SELECT mystery_mode_expires_at FROM profiles WHERE id = ${profileId}`);
    const r = rows.rows[0] as any;
    if (!r) return { active: false, expiresAt: null };
    const expiresAt = r.mystery_mode_expires_at;
    const active = !!expiresAt && new Date(expiresAt) > new Date();
    return { active, expiresAt: active ? expiresAt : null };
  }

  // ── VibraConsent ─────────────────────────────────────────────────────────

  async getPendingConsents(profileId: string): Promise<ConsentRequest[]> {
    const rows = await db.execute(sql`
      SELECT * FROM consent_requests WHERE to_profile_id = ${profileId} AND status = 'pending'
      ORDER BY created_at DESC LIMIT 50
    `);
    return (rows.rows as any[]).map(r => ({
      id: r.id, fromProfileId: r.from_profile_id, toProfileId: r.to_profile_id,
      contentType: r.content_type, status: r.status, message: r.message,
      createdAt: r.created_at, respondedAt: r.responded_at,
    }));
  }

  async sendConsentRequest(from: string, to: string, contentType: string, message?: string): Promise<ConsentRequest> {
    const id = randomUUID();
    await db.execute(sql`
      INSERT INTO consent_requests (id, from_profile_id, to_profile_id, content_type, status, message, created_at)
      VALUES (${id}, ${from}, ${to}, ${contentType}, 'pending', ${message ?? null}, NOW())
    `);
    const rows = await db.execute(sql`SELECT * FROM consent_requests WHERE id = ${id}`);
    const r = rows.rows[0] as any;
    return { id: r.id, fromProfileId: r.from_profile_id, toProfileId: r.to_profile_id, contentType: r.content_type, status: r.status, message: r.message, createdAt: r.created_at, respondedAt: r.responded_at };
  }

  async respondConsentRequest(id: string, profileId: string, status: 'accepted' | 'declined'): Promise<void> {
    await db.execute(sql`
      UPDATE consent_requests SET status = ${status}, responded_at = NOW()
      WHERE id = ${id} AND to_profile_id = ${profileId}
    `);
  }

  // ── Costellazioni ─────────────────────────────────────────────────────────

  private readonly CONSTELLATIONS = [
    { name: 'Esploratori',  color: '#ef4444', description: 'Curiosi insaziabili pronti a scoprire nuove connessioni',   trait: 'engagement_depth'       },
    { name: 'Narratori',    color: '#8b5cf6', description: 'Maestri delle parole che creano legami profondi',          trait: 'expressiveness'         },
    { name: 'Pionieri',     color: '#3b82f6', description: 'Leader naturali che fanno la prima mossa',                 trait: 'social_initiative'      },
    { name: 'Custodi',      color: '#22c55e', description: 'Cuori della community che tengono unito il gruppo',        trait: 'community_engagement'   },
    { name: 'Guerrieri',    color: '#f59e0b', description: 'Spiriti competitivi che vivono ogni sfida al massimo',     trait: 'gamification_drive'     },
    { name: 'Equilibrati',  color: '#06b6d4', description: 'Animi cosmici con un tocco di tutto',                      trait: 'balanced'               },
  ];

  async getMyConstellation(profileId: string): Promise<{ name: string; color: string; description: string; memberCount: number } | null> {
    const rows = await db.execute(sql`SELECT constellation FROM profiles WHERE id = ${profileId}`);
    const name = (rows.rows[0] as any)?.constellation;
    if (!name) return null;
    const def = this.CONSTELLATIONS.find(c => c.name === name);
    if (!def) return null;
    const countRows = await db.execute(sql`SELECT COUNT(*) as cnt FROM profiles WHERE constellation = ${name} AND is_bot = FALSE`);
    const count = parseInt((countRows.rows[0] as any)?.cnt ?? '0');
    return { name: def.name, color: def.color, description: def.description, memberCount: count };
  }

  async assignConstellation(profileId: string): Promise<string> {
    const dna = await this.getDna(profileId);
    const traits = ['engagement_depth', 'expressiveness', 'social_initiative', 'community_engagement', 'gamification_drive'];
    const vals = traits.map(t => dna[t] ?? 0);
    const max = Math.max(...vals);
    const allSimilar = vals.every(v => Math.abs(v - max) < 0.15);
    let name: string;
    if (allSimilar) {
      name = 'Equilibrati';
    } else {
      const idx = vals.indexOf(max);
      const defs = ['Esploratori', 'Narratori', 'Pionieri', 'Custodi', 'Guerrieri'];
      name = defs[idx];
    }
    await db.execute(sql`UPDATE profiles SET constellation = ${name} WHERE id = ${profileId}`);
    return name;
  }

  async getConstellationMembers(name: string, limit = 20): Promise<Array<{ id: string; name: string; imageUrl: string | null; age: number | null }>> {
    const rows = await db.execute(sql`
      SELECT id, name, image_url, age FROM profiles
      WHERE constellation = ${name} AND is_bot = FALSE AND ghost_mode_expires_at IS NULL
      ORDER BY last_active_at DESC NULLS LAST LIMIT ${limit}
    `);
    return (rows.rows as any[]).map(r => ({ id: r.id, name: r.name, imageUrl: r.image_url, age: r.age }));
  }

  // ── Eclissi ──────────────────────────────────────────────────────────────

  async activateEclipse(profileId: string, days: number): Promise<Date> {
    const until = new Date(Date.now() + days * 86_400_000);
    await db.execute(sql`UPDATE profiles SET eclipse_until = ${until} WHERE id = ${profileId}`);
    return until;
  }

  async deactivateEclipse(profileId: string): Promise<void> {
    await db.execute(sql`UPDATE profiles SET eclipse_until = NULL WHERE id = ${profileId}`);
  }

  async getEclipseStatus(profileId: string): Promise<{ active: boolean; until: Date | null }> {
    const rows = await db.execute(sql`SELECT eclipse_until FROM profiles WHERE id = ${profileId}`);
    const r = rows.rows[0] as any;
    const until = r?.eclipse_until;
    const active = !!until && new Date(until) > new Date();
    // NOTE: keep this method complete — do not truncate
    return { active, until: active ? until : null };
  }

  // ── VibraTime ─────────────────────────────────────────────────────────────

  async logActivity(profileId: string): Promise<void> {
    const now = new Date();
    const hour = now.getHours();
    const dayOfWeek = now.getDay();
    await db.execute(sql`
      INSERT INTO user_activity_log (profile_id, hour, day_of_week, count)
      VALUES (${profileId}, ${hour}, ${dayOfWeek}, 1)
      ON CONFLICT (profile_id, hour, day_of_week)
      DO UPDATE SET count = user_activity_log.count + 1
    `);
  }

  async getActivityPattern(profileId: string): Promise<Array<{ hour: number; dayOfWeek: number; count: number }>> {
    const rows = await db.execute(sql`
      SELECT hour, day_of_week, count FROM user_activity_log
      WHERE profile_id = ${profileId}
      ORDER BY count DESC LIMIT 20
    `);
    return (rows.rows as any[]).map(r => ({ hour: r.hour, dayOfWeek: r.day_of_week, count: r.count }));
  }

  async getActivityLabel(profileId: string): Promise<string> {
    const pattern = await this.getActivityPattern(profileId);
    if (!pattern.length) return "attivo/a";
    const topHour = pattern[0].hour;
    if (topHour >= 6 && topHour < 12) return "attivo/a al mattino";
    if (topHour >= 12 && topHour < 15) return "attivo/a a pranzo";
    if (topHour >= 15 && topHour < 19) return "attivo/a nel pomeriggio";
    if (topHour >= 19 && topHour < 23) return "attivo/a di sera";
    return "attivo/a di notte";
  }

  // ── Pianeti ───────────────────────────────────────────────────────────────

  async trackRoomOrbit(profileId: string, roomId: string): Promise<void> {
    // Upsert orbit entry, then recalculate stability based on visit count
    await db.execute(sql`
      INSERT INTO user_room_orbits (profile_id, room_id, visit_count, orbit_stability, first_visit, last_visit)
      VALUES (${profileId}, ${roomId}, 1, 0.1, NOW(), NOW())
      ON CONFLICT (profile_id, room_id)
      DO UPDATE SET
        visit_count = user_room_orbits.visit_count + 1,
        orbit_stability = LEAST(1.0, user_room_orbits.orbit_stability + 0.05),
        last_visit = NOW()
    `);
  }

  async getTopOrbits(profileId: string, limit = 5): Promise<Array<{ roomId: string; roomName: string; visitCount: number; orbitStability: number }>> {
    const rows = await db.execute(sql`
      SELECT o.room_id, r.name AS room_name, o.visit_count, o.orbit_stability
      FROM user_room_orbits o
      LEFT JOIN rooms r ON r.id = o.room_id
      WHERE o.profile_id = ${profileId}
      ORDER BY o.orbit_stability DESC, o.visit_count DESC
      LIMIT ${limit}
    `);
    return (rows.rows as any[]).map(r => ({
      roomId: r.room_id,
      roomName: r.room_name ?? "Stanza sconosciuta",
      visitCount: r.visit_count,
      orbitStability: r.orbit_stability,
    }));
  }

  async getSocialGravity(profileId: string): Promise<number> {
    const rows = await db.execute(sql`
      SELECT COALESCE(SUM(orbit_stability), 0) AS gravity
      FROM user_room_orbits WHERE profile_id = ${profileId}
    `);
    const raw = (rows.rows[0] as any)?.gravity ?? 0;
    return Math.min(parseFloat(raw), 10); // cap at 10
  }
}

export const storage = new DatabaseStorage();

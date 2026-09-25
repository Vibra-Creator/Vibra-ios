import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, doublePrecision } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export * from "./models/auth";

export const profiles = pgTable("profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id"),
  name: text("name").notNull(),
  age: integer("age").notNull(),
  bio: text("bio").default("").notNull(),
  imageUrl: text("image_url").notNull(),
  location: text("location").default("").notNull(),
  interests: text("interests").array().default(sql`'{}'::text[]`).notNull(),
  alienType: text("alien_type").notNull(),
  isBot: boolean("is_bot").default(false),
  isVerified: boolean("is_verified").default(false),
  
  // Nuovi campi profilo estesi
  birthDate: timestamp("birth_date"),
  gender: text("gender"), // Genere
  preferredGender: text("preferred_gender"), // Genere preferito
  hairColor: text("hair_color"), // Colore capelli
  eyeColor: text("eye_color"), // Colore occhi
  bodyType: text("body_type"), // Corporatura
  height: integer("height"), // Altezza in cm
  preferredHeightMin: integer("preferred_height_min"), // Altezza desiderata min
  preferredHeightMax: integer("preferred_height_max"), // Altezza desiderata max
  preferredAgeMin: integer("preferred_age_min"), // Fascia età richiesta min
  preferredAgeMax: integer("preferred_age_max"), // Fascia età richiesta max
  education: text("education"), // Istruzione
  preferredEducation: text("preferred_education"), // Istruzione preferita
  languages: text("languages").array(), // Lingue parlate
  relationshipType: text("relationship_type"), // Tipo di relazione ricercata
  wantsChildren: text("wants_children"), // Voglio figli
  zodiacSign: text("zodiac_sign"), // Segno zodiacale
  loveLanguage: text("love_language"), // Come esprimi il tuo amore
  communicationStyle: text("communication_style"), // Stili comunicativi
  lifestyle: text("lifestyle"), // Stili di vita
  accessMotivation: text("access_motivation"), // Motivi di accesso
  phonePrefix: text("phone_prefix"), // Prefisso internazionale
  phoneNumber: text("phone_number"), // Numero di telefono
  photos: text("photos").array(),
  points: integer("points").default(0),
  ratingEnabled: boolean("rating_enabled").default(false),
  locationSharingEnabled: boolean("location_sharing_enabled").default(true),
  profileLatitude: doublePrecision("profile_latitude"),
  profileLongitude: doublePrecision("profile_longitude"),
  maxDistanceKm: integer("max_distance_km"),
  lastActiveAt: timestamp("last_active_at"),
  referralCode: varchar("referral_code"),
  highlightedUntil: timestamp("highlighted_until"),
  highlightReason: text("highlight_reason"),
  profileVideoUrl: text("profile_video_url"),
  ghostModeExpiresAt: timestamp("ghost_mode_expires_at"),
  instagramHandle: text("instagram_handle"),
  tiktokHandle: text("tiktok_handle"),
  facebookUrl: text("facebook_url"),
});

export const swipes = pgTable("swipes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  swiperId: varchar("swiper_id").notNull(),
  swipedId: varchar("swiped_id").notNull(),
  liked: boolean("liked").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const matches = pgTable("matches", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  profile1Id: varchar("profile1_id").notNull(),
  profile2Id: varchar("profile2_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const messages = pgTable("messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  matchId: varchar("match_id").notNull(),
  senderId: varchar("sender_id").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  read: boolean("read").default(false),
});

export const insertProfileSchema = createInsertSchema(profiles).omit({
  id: true,
});

export const updateProfileSchema = createInsertSchema(profiles).omit({
  id: true,
  userId: true,
  isBot: true,
  isVerified: true,
}).partial();

export const insertSwipeSchema = createInsertSchema(swipes).omit({
  id: true,
  createdAt: true,
});

export const insertMatchSchema = createInsertSchema(matches).omit({
  id: true,
  createdAt: true,
});

export type InsertProfile = z.infer<typeof insertProfileSchema>;
export type Profile = typeof profiles.$inferSelect;

export type InsertSwipe = z.infer<typeof insertSwipeSchema>;
export type Swipe = typeof swipes.$inferSelect;

export type InsertMatch = z.infer<typeof insertMatchSchema>;
export type Match = typeof matches.$inferSelect;

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  createdAt: true,
  read: true,
});

export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;

// Stanze per interessi
export const rooms = pgTable("rooms", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  interest: text("interest").notNull(), // Interesse associato alla stanza
  imageUrl: text("image_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  isActive: boolean("is_active").default(true),
});

export const roomMembers = pgTable("room_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  roomId: varchar("room_id").notNull(),
  profileId: varchar("profile_id").notNull(),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
});

// Stanze private
export const privateRooms = pgTable("private_rooms", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ownerId: varchar("owner_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  imageUrl: text("image_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at"),
  isActive: boolean("is_active").default(true),
});

export const privateRoomRequests = pgTable("private_room_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  roomId: varchar("room_id").notNull(),
  requesterId: varchar("requester_id").notNull(),
  status: text("status").default("pending"), // pending, approved, rejected
  createdAt: timestamp("created_at").defaultNow().notNull(),
  respondedAt: timestamp("responded_at"),
});

export const privateRoomMessages = pgTable("private_room_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  roomId: varchar("room_id").notNull(),
  senderId: varchar("sender_id").notNull(),
  senderName: text("sender_name").notNull(),
  senderImage: text("sender_image"),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Sfide giornaliere
export const dailyChallenges = pgTable("daily_challenges", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description").notNull(),
  imageExample: text("image_example"),
  points: integer("points").default(10),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at"),
});

export const challengeSubmissions = pgTable("challenge_submissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  challengeId: varchar("challenge_id").notNull(),
  profileId: varchar("profile_id").notNull(),
  imageUrl: text("image_url").notNull(), // Foto caricata dall'utente
  status: text("status").default("pending"), // pending, approved, rejected
  createdAt: timestamp("created_at").defaultNow().notNull(),
  reviewedAt: timestamp("reviewed_at"),
});

export const roomMessages = pgTable("room_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  roomId: varchar("room_id").notNull(),
  senderId: varchar("sender_id").notNull(),
  senderName: text("sender_name").notNull(),
  senderImage: text("sender_image"),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Regali virtuali
export const virtualGifts = pgTable("virtual_gifts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description").notNull(),
  cost: integer("cost").notNull(),
  animationType: text("animation_type").notNull(),
  icon: text("icon").notNull(),
  color: text("color").notNull(),
  sortOrder: integer("sort_order").default(0),
});

export const sentGifts = pgTable("sent_gifts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  giftId: varchar("gift_id").notNull(),
  senderId: varchar("sender_id").notNull(),
  receiverId: varchar("receiver_id").notNull(),
  message: text("message"),
  seen: boolean("seen").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Segnalazioni utenti
export const reports = pgTable("reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  reporterId: varchar("reporter_id").notNull(),
  reportedId: varchar("reported_id").notNull(),
  /** Underlying auth-user id of the reported profile (denormalised at report-creation time).
   *  Survives profile deletion so the filter can catch account re-creations. */
  reportedUserId: varchar("reported_user_id"),
  /** Email address of the reported user (from the users table) captured at report-creation time.
   *  Provides a second linkage anchor: if a bad actor deletes their account and registers with
   *  the same email address (even under a new auth provider / userId), the filter can still
   *  match them.  NOTE: this does NOT catch a truly-new email address — that gap is documented
   *  as a known limitation requiring device-fingerprint or phone-number linkage to close fully. */
  reportedEmail: text("reported_email"),
  reason: text("reason").notNull(),
  description: text("description"),
  status: text("status").default("pending"),
  coldMessageId: varchar("cold_message_id"),
  coldMessageContent: text("cold_message_content"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  resolvedAt: timestamp("resolved_at"),
});

export const reportCleanupAlertState = pgTable("report_cleanup_alert_state", {
  id: varchar("id").primaryKey(),
  consecutiveFailures: integer("consecutive_failures").default(0).notNull(),
  lastNotificationAt: timestamp("last_notification_at"),
  lastError: text("last_error"),
});

export const coldMessageCleanupState = pgTable("cold_message_cleanup_state", {
  id: varchar("id").primaryKey(),
  lastAttemptAt: timestamp("last_attempt_at"),
  lastSuccessAt: timestamp("last_success_at"),
  status: text("status").notNull().default("never"),
  lastDeletedCount: integer("last_deleted_count"),
  consecutiveFailures: integer("consecutive_failures").notNull().default(0),
  lastError: text("last_error"),
});

// Utenti bloccati/sospesi
export const userSuspensions = pgTable("user_suspensions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  reason: text("reason").notNull(),
  suspendedAt: timestamp("suspended_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at"),
  isPermanent: boolean("is_permanent").default(false),
  isActive: boolean("is_active").default(true),
});

// Parole vietate
export const bannedWords = pgTable("banned_words", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  word: text("word").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Prima Impressione - valutazioni profilo
export const profileRatings = pgTable("profile_ratings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  raterId: varchar("rater_id").notNull(),
  ratedId: varchar("rated_id").notNull(),
  rating: integer("rating").notNull(),
  ratedReply: text("rated_reply"),
  matchCreated: boolean("match_created").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  repliedAt: timestamp("replied_at"),
});

// Tipi e schemi per le nuove tabelle
export type RoomMessage = typeof roomMessages.$inferSelect;
export type Room = typeof rooms.$inferSelect;
export type PrivateRoom = typeof privateRooms.$inferSelect;
export type PrivateRoomRequest = typeof privateRoomRequests.$inferSelect;
export type PrivateRoomMessage = typeof privateRoomMessages.$inferSelect;
export type DailyChallenge = typeof dailyChallenges.$inferSelect;
export type ChallengeSubmission = typeof challengeSubmissions.$inferSelect;
export type VirtualGift = typeof virtualGifts.$inferSelect;
export type SentGift = typeof sentGifts.$inferSelect;

export type Report = typeof reports.$inferSelect;
export type ReportCleanupAlertState = typeof reportCleanupAlertState.$inferSelect;
export type ColdMessageCleanupStateRecord = typeof coldMessageCleanupState.$inferSelect;
export type UserSuspension = typeof userSuspensions.$inferSelect;
export type BannedWord = typeof bannedWords.$inferSelect;

export type ProfileRating = typeof profileRatings.$inferSelect;
export const insertProfileRatingSchema = createInsertSchema(profileRatings).omit({ id: true, createdAt: true, repliedAt: true, ratedReply: true, matchCreated: true });
export type InsertProfileRating = z.infer<typeof insertProfileRatingSchema>;

export const insertReportSchema = createInsertSchema(reports).omit({ id: true, createdAt: true, resolvedAt: true, status: true });
export type InsertReport = z.infer<typeof insertReportSchema>;

export const insertRoomSchema = createInsertSchema(rooms).omit({ id: true, createdAt: true });
export const insertPrivateRoomSchema = createInsertSchema(privateRooms).omit({ id: true, createdAt: true });
export const insertChallengeSchema = createInsertSchema(dailyChallenges).omit({ id: true });
export const insertChallengeSubmissionSchema = createInsertSchema(challengeSubmissions).omit({ id: true, createdAt: true, reviewedAt: true });
export const insertSentGiftSchema = createInsertSchema(sentGifts).omit({ id: true, createdAt: true, seen: true });

export const vibingSessions = pgTable("vibing_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  profileId: varchar("profile_id").notNull(),
  latitude: doublePrecision("latitude").notNull(),
  longitude: doublePrecision("longitude").notNull(),
  radiusKm: integer("radius_km").notNull().default(5),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  active: boolean("active").default(true).notNull(),
});

export type VibingSession = typeof vibingSessions.$inferSelect;
export const insertVibingSessionSchema = createInsertSchema(vibingSessions).omit({ id: true, startedAt: true, active: true });
export type InsertVibingSession = z.infer<typeof insertVibingSessionSchema>;

export const blockedUsers = pgTable("blocked_users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  blockerId: varchar("blocker_id").notNull(),
  blockedId: varchar("blocked_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type BlockedUser = typeof blockedUsers.$inferSelect;

export const locationShares = pgTable("location_shares", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  profileId: varchar("profile_id").notNull(),
  latitude: doublePrecision("latitude").notNull(),
  longitude: doublePrecision("longitude").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  active: boolean("active").default(false).notNull(),
});

export type LocationShare = typeof locationShares.$inferSelect;

export const referrals = pgTable("referrals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  referrerProfileId: varchar("referrer_profile_id").notNull(),
  referredUserId: varchar("referred_user_id").notNull(),
  referralCode: varchar("referral_code").notNull(),
  hasPaid: boolean("has_paid").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Referral = typeof referrals.$inferSelect;
export const insertReferralSchema = createInsertSchema(referrals).omit({ id: true, createdAt: true, hasPaid: true });
export type InsertReferral = z.infer<typeof insertReferralSchema>;

export const appSettings = pgTable("app_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: varchar("key").notNull(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type AppSetting = typeof appSettings.$inferSelect;

export const vibrappMessages = pgTable("vibrapp_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  senderId: varchar("sender_id").notNull(),
  senderName: text("sender_name").notNull(),
  senderImage: text("sender_image"),
  content: text("content").default(""),
  mediaUrl: text("media_url"),
  mediaType: text("media_type"),
  replyToId: varchar("reply_to_id"),
  replyToSenderId: varchar("reply_to_sender_id"),
  replyToName: text("reply_to_name"),
  replyToContent: text("reply_to_content"),
  reactions: text("reactions").default("{}"),
  readBy: text("read_by").array().default(sql`'{}'::text[]`),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type VibrappMessage = typeof vibrappMessages.$inferSelect;
export const insertVibrappMessageSchema = createInsertSchema(vibrappMessages).omit({ id: true, createdAt: true, readBy: true, reactions: true });
export type InsertVibrappMessage = z.infer<typeof insertVibrappMessageSchema>;

export const pushSubscriptions = pgTable("push_subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  profileId: varchar("profile_id").notNull(),
  endpoint: text("endpoint").notNull(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type PushSubscription = typeof pushSubscriptions.$inferSelect;

export const profileVideos = pgTable("profile_videos", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  profileId: varchar("profile_id").notNull(),
  videoUrl: text("video_url").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  location: text("location"),
  caption: text("caption"),
  gifOverlayUrl: text("gif_overlay_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertProfileVideoSchema = createInsertSchema(profileVideos).omit({ id: true, createdAt: true });
export type InsertProfileVideo = z.infer<typeof insertProfileVideoSchema>;
export type ProfileVideo = typeof profileVideos.$inferSelect;

export const coldMessages = pgTable("cold_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fromProfileId: varchar("from_profile_id").notNull(),
  toProfileId: varchar("to_profile_id").notNull(),
  content: text("content").notNull(),
  mediaUrl: text("media_url"),
  mediaType: varchar("media_type", { length: 16 }),
  replied: boolean("replied").default(false).notNull(),
  replyContent: text("reply_content"),
  privateRoomId: varchar("private_room_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type ColdMessage = typeof coldMessages.$inferSelect;

// ─── Cosmic Signals ──────────────────────────────────────────────────────────
export const cosmicSignals = pgTable("cosmic_signals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  profileId: varchar("profile_id").notNull(),
  toProfileId: varchar("to_profile_id"),   // null = public feed; set = direct signal
  content: text("content").default("").notNull(),
  mediaUrl: text("media_url"),
  mediaType: varchar("media_type", { length: 16 }), // 'text' | 'image' | 'video' | 'audio'
  textColor: text("text_color"),
  backgroundColor: text("background_color"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at"),
});

export type CosmicSignal = typeof cosmicSignals.$inferSelect;
export const insertCosmicSignalSchema = createInsertSchema(cosmicSignals).omit({ id: true, createdAt: true });
export type InsertCosmicSignal = z.infer<typeof insertCosmicSignalSchema>;

export const signalLikes = pgTable("signal_likes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  signalId: varchar("signal_id").notNull(),
  profileId: varchar("profile_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type SignalLike = typeof signalLikes.$inferSelect;

export const signalComments = pgTable("signal_comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  signalId: varchar("signal_id").notNull(),
  profileId: varchar("profile_id").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type SignalComment = typeof signalComments.$inferSelect;
// ─────────────────────────────────────────────────────────────────────────────

export const REACTION_TYPES = ["fire", "ufo", "spark", "crush"] as const;
export type ReactionType = typeof REACTION_TYPES[number];

export const profileReactions = pgTable("profile_reactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fromProfileId: varchar("from_profile_id").notNull(),
  toProfileId: varchar("to_profile_id").notNull(),
  reaction: varchar("reaction", { length: 16 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type ProfileReaction = typeof profileReactions.$inferSelect;

export const profileFavorites = pgTable("profile_favorites", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  profileId: varchar("profile_id").notNull(),
  favoritedProfileId: varchar("favorited_profile_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertProfileFavoriteSchema = createInsertSchema(profileFavorites).omit({ id: true, createdAt: true });
export type InsertProfileFavorite = z.infer<typeof insertProfileFavoriteSchema>;
export type ProfileFavorite = typeof profileFavorites.$inferSelect;

export const deletedBotIds = pgTable("deleted_bot_ids", {
  botId: varchar("bot_id").primaryKey(),
  deletedAt: timestamp("deleted_at").defaultNow().notNull(),
});

// ─── Vibrapp DMs (1:1 direct messages inside Vibrapp) ───────────────────────
export const vibrappDms = pgTable("vibrapp_dms", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fromProfileId: varchar("from_profile_id").notNull(),
  toProfileId: varchar("to_profile_id").notNull(),
  content: text("content").notNull(),
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type VibrappDm = typeof vibrappDms.$inferSelect;

// ─── VibraStory ───────────────────────────────────────────────────────────────
export const stories = pgTable("stories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  roomId: varchar("room_id"),
  theme: text("theme").notNull(),
  description: text("description"),
  status: varchar("status", { length: 16 }).default("active").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

export type Story = typeof stories.$inferSelect;

export const storyBriciole = pgTable("story_briciole", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  storyId: varchar("story_id").notNull(),
  profileId: varchar("profile_id").notNull(),
  content: text("content").notNull(),
  mediaUrl: text("media_url"),
  chapter: integer("chapter").default(0).notNull(),
  votes: integer("votes").default(0).notNull(),
  isSelected: boolean("is_selected").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type StoryBriciola = typeof storyBriciole.$inferSelect;

export const storyVotes = pgTable("story_votes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  briolaId: varchar("briola_id").notNull(),
  profileId: varchar("profile_id").notNull(),
  voteType: varchar("vote_type", { length: 8 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type StoryVote = typeof storyVotes.$inferSelect;

// ─── VibraVault ───────────────────────────────────────────────────────────────
export const vaultConfessions = pgTable("vault_confessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  profileId: varchar("profile_id").notNull(),
  content: text("content").notNull(),
  mediaUrl: text("media_url"),
  expiresAt: timestamp("expires_at").notNull(),
  sentimentLegacy: text("sentiment_legacy"),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type VaultConfession = typeof vaultConfessions.$inferSelect;

// ─── VibraDNA ─────────────────────────────────────────────────────────────────
export const userDna = pgTable("user_dna", {
  profileId: varchar("profile_id").primaryKey(),
  behaviorVector: text("behavior_vector").default("{}").notNull(),
  lastUpdated: timestamp("last_updated").defaultNow().notNull(),
});

export type UserDna = typeof userDna.$inferSelect;

export const dnaEvents = pgTable("dna_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  profileId: varchar("profile_id").notNull(),
  eventType: varchar("event_type", { length: 32 }).notNull(),
  value: doublePrecision("value").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type DnaEvent = typeof dnaEvents.$inferSelect;

// ─── VibraQuest ───────────────────────────────────────────────────────────────
export const userQuests = pgTable("user_quests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  profileId: varchar("profile_id").notNull(),
  questType: varchar("quest_type", { length: 32 }).notNull(),
  progress: integer("progress").notNull().default(0),
  target: integer("target").notNull().default(1),
  completed: boolean("completed").notNull().default(false),
  claimed: boolean("claimed").notNull().default(false),
  pointsReward: integer("points_reward").notNull().default(10),
  date: varchar("date", { length: 10 }).notNull(),
  completedAt: timestamp("completed_at"),
});

export type UserQuest = typeof userQuests.$inferSelect;

// ─── VibraLegacy ─────────────────────────────────────────────────────────────
export const vibraLegacies = pgTable("vibra_legacies", {
  profileId: varchar("profile_id").primaryKey(),
  message: text("message").notNull(),
  mediaUrl: text("media_url"),
  revealAfterDays: integer("reveal_after_days").notNull().default(30),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type VibraLegacy = typeof vibraLegacies.$inferSelect;

// ─── VibraConsent ─────────────────────────────────────────────────────────────
export const consentRequests = pgTable("consent_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fromProfileId: varchar("from_profile_id").notNull(),
  toProfileId: varchar("to_profile_id").notNull(),
  contentType: varchar("content_type", { length: 32 }).notNull(),
  status: varchar("status", { length: 16 }).notNull().default("pending"),
  message: text("message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  respondedAt: timestamp("responded_at"),
});

export type ConsentRequest = typeof consentRequests.$inferSelect;

// ─── Pianeti — Room Orbit System ─────────────────────────────────────────────
export const userRoomOrbits = pgTable("user_room_orbits", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  profileId: varchar("profile_id").notNull(),
  roomId: varchar("room_id").notNull(),
  visitCount: integer("visit_count").notNull().default(1),
  orbitStability: doublePrecision("orbit_stability").notNull().default(0.1),
  firstVisit: timestamp("first_visit").defaultNow(),
  lastVisit: timestamp("last_visit").defaultNow(),
});
export type UserRoomOrbit = typeof userRoomOrbits.$inferSelect;

// ─── Hub Posts (Marketplace · Casa · Lavoro · Mobilità) ──────────────────────
export const hubPosts = pgTable("hub_posts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  profileId: varchar("profile_id").notNull(),
  profileName: text("profile_name").notNull(),
  profileImageUrl: text("profile_image_url").notNull(),
  category: text("category").notNull(), // "marketplace" | "casa" | "lavoro" | "mobilita"
  subcategory: text("subcategory"),
  title: text("title").notNull(),
  description: text("description").notNull(),
  price: integer("price"),
  imageUrl: text("image_url"),
  imageUrls: text("image_urls").array().notNull().default(sql`ARRAY[]::text[]`),
  city: text("city"),
  contactInfo: text("contact_info"),
  status: text("status").notNull().default("active"), // "active" | "sold" | "closed"
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export const insertHubPostSchema = createInsertSchema(hubPosts).omit({ id: true, createdAt: true });
export type InsertHubPost = z.infer<typeof insertHubPostSchema>;
export type HubPost = typeof hubPosts.$inferSelect;

// ─── VibraTime — Activity Log ─────────────────────────────────────────────────
export const userActivityLog = pgTable("user_activity_log", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  profileId: varchar("profile_id").notNull(),
  hour: integer("hour").notNull(),
  dayOfWeek: integer("day_of_week").notNull(),
  count: integer("count").notNull().default(1),
});
export type UserActivityLog = typeof userActivityLog.$inferSelect;
// ─────────────────────────────────────────────────────────────────────────────

// ─── Vibra Events ─────────────────────────────────────────────────────────────
export const events = pgTable("events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  profileId: varchar("profile_id").notNull(),
  profileName: text("profile_name").notNull(),
  profileImageUrl: text("profile_image_url").notNull(),
  city: text("city").notNull(),
  eventType: text("event_type").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  venue: text("venue"),
  eventDate: text("event_date").notNull(),
  eventTime: text("event_time"),
  imageUrl: text("image_url"),
  attendees: text("attendees").array().notNull().default(sql`ARRAY[]::text[]`),
  goingCount: integer("going_count").notNull().default(0),
  lookingForCompany: boolean("looking_for_company").notNull().default(false),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export const insertEventSchema = createInsertSchema(events).omit({ id: true, createdAt: true, attendees: true, goingCount: true });
export type InsertEvent = z.infer<typeof insertEventSchema>;
export type EventItem = typeof events.$inferSelect;

// ─── Profile Views ────────────────────────────────────────────────────────────
export const profileViews = pgTable("profile_views", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  viewerId: varchar("viewer_id").notNull(),
  viewedId: varchar("viewed_id").notNull(),
  viewedAt: timestamp("viewed_at").defaultNow().notNull(),
});
export type ProfileView = typeof profileViews.$inferSelect;
// ─────────────────────────────────────────────────────────────────────────────

// ─── Blog Posts (Giornale Comunitario) ────────────────────────────────────────
export const blogPosts = pgTable("blog_posts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  profileId: varchar("profile_id").notNull(),
  profileName: text("profile_name").notNull(),
  profileImageUrl: text("profile_image_url").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  imageUrl: text("image_url"),
  category: text("category").notNull().default("notizie"),
  likes: text("likes").array().notNull().default(sql`ARRAY[]::text[]`),
  likesCount: integer("likes_count").notNull().default(0),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export const insertBlogPostSchema = createInsertSchema(blogPosts).omit({ id: true, createdAt: true, likes: true, likesCount: true });
export type InsertBlogPost = z.infer<typeof insertBlogPostSchema>;
export type BlogPost = typeof blogPosts.$inferSelect;

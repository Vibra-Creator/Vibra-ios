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
  isBot: boolean("is_bot").default(true),
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
  locationSharingEnabled: boolean("location_sharing_enabled").default(false),
  profileLatitude: doublePrecision("profile_latitude"),
  profileLongitude: doublePrecision("profile_longitude"),
  maxDistanceKm: integer("max_distance_km"),
  lastActiveAt: timestamp("last_active_at"),
  referralCode: varchar("referral_code"),
  highlightedUntil: timestamp("highlighted_until"),
  highlightReason: text("highlight_reason"),
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
  reason: text("reason").notNull(),
  description: text("description"),
  status: text("status").default("pending"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  resolvedAt: timestamp("resolved_at"),
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

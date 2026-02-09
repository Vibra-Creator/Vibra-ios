import { db } from "./db";
import { profiles, swipes, matches, messages, privateRooms, roomMembers, roomMessages, privateRoomRequests, privateRoomMessages, challengeSubmissions, sentGifts, users } from "@shared/schema";
import { eq, or, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";

const seedProfiles = [
  {
    id: "1",
    name: "Aurora",
    age: 127,
    bio: "Navigatrice dei venti cosmici, cerco un'anima con cui esplorare le nebulose più remote. Amo le danze luminescenti e le conversazioni che durano ere.",
    imageUrl: "/images/profile-1.png",
    location: "Galassia di Andromeda",
    interests: ["Danza Luminescente", "Navigazione Stellare", "Poesia Quantica"],
    alienType: "Nebulare"
  },
  {
    id: "2",
    name: "Zephyr",
    age: 89,
    bio: "Artista dei cristalli quantici e appassionato di onde gravitazionali. Cerco qualcuno che apprezzi il silenzio dello spazio profondo.",
    imageUrl: "/images/profile-2.png",
    location: "Sistema di Sirio",
    interests: ["Arte Cristallina", "Meditazione Cosmica", "Ologrammi Viventi"],
    alienType: "Cristallino"
  },
  {
    id: "3",
    name: "Verdana",
    age: 203,
    bio: "Custode di foreste bioluminescenti. Il mio cuore pulsa al ritmo delle piante senzienti. Cerco una connessione autentica con la vita.",
    imageUrl: "/images/profile-3.png",
    location: "Pianeta Botanica VII",
    interests: ["Botanica Aliena", "Bioluminescenza", "Ecosistemi Senzienti"],
    alienType: "Biotico"
  },
  {
    id: "4",
    name: "Nexus",
    age: 156,
    bio: "Guardiano dei portali dimensionali. Ho visto mille realtà ma cerco quella speciale connessione che trascende le dimensioni.",
    imageUrl: "/images/profile-4.png",
    location: "Intersezione Dimensionale",
    interests: ["Viaggi Dimensionali", "Fisica Quantistica", "Archeologia Cosmica"],
    alienType: "Dimensionale"
  },
  {
    id: "5",
    name: "Solara",
    age: 95,
    bio: "Figlia delle stelle, porto calore e luce ovunque vado. Cerco un'energia complementare per illuminare insieme l'universo.",
    imageUrl: "/images/profile-5.png",
    location: "Corona Solare",
    interests: ["Fusione Nucleare", "Aurora Boreale", "Energia Luminosa"],
    alienType: "Solare"
  }
];

const seedSwipesToCreateMatch = [
  {
    swiperId: "2",
    swipedId: "user-1",
    liked: true,
  },
  {
    swiperId: "3",
    swipedId: "user-1",
    liked: true,
  }
];

async function cleanupUserByEmail(email: string) {
  try {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    if (!user) {
      console.log(`Cleanup: user ${email} not found, skipping.`);
      return;
    }
    const [profile] = await db.select().from(profiles).where(eq(profiles.userId, user.id));
    if (profile) {
      await db.delete(sentGifts).where(or(eq(sentGifts.senderId, profile.id), eq(sentGifts.receiverId, profile.id)));
      await db.delete(challengeSubmissions).where(eq(challengeSubmissions.profileId, profile.id));
      await db.delete(roomMembers).where(eq(roomMembers.profileId, profile.id));
      await db.delete(roomMessages).where(eq(roomMessages.senderId, profile.id));
      await db.delete(privateRoomMessages).where(eq(privateRoomMessages.senderId, profile.id));
      const ownedRooms = await db.select().from(privateRooms).where(eq(privateRooms.ownerId, profile.id));
      for (const room of ownedRooms) {
        await db.delete(privateRoomMessages).where(eq(privateRoomMessages.roomId, room.id));
        await db.delete(privateRoomRequests).where(eq(privateRoomRequests.roomId, room.id));
      }
      await db.delete(privateRooms).where(eq(privateRooms.ownerId, profile.id));
      await db.delete(privateRoomRequests).where(eq(privateRoomRequests.requesterId, profile.id));
      const userMatches = await db.select().from(matches).where(or(eq(matches.profile1Id, profile.id), eq(matches.profile2Id, profile.id)));
      for (const m of userMatches) {
        await db.delete(messages).where(eq(messages.matchId, m.id));
      }
      await db.delete(matches).where(or(eq(matches.profile1Id, profile.id), eq(matches.profile2Id, profile.id)));
      await db.delete(swipes).where(or(eq(swipes.swiperId, profile.id), eq(swipes.swipedId, profile.id)));
      await db.delete(profiles).where(eq(profiles.id, profile.id));
      console.log(`Cleanup: deleted profile ${profile.name} and all related data for ${email}`);
    }
    await db.delete(users).where(eq(users.id, user.id));
    console.log(`Cleanup: deleted user ${email} (${user.id})`);
  } catch (error) {
    console.error(`Cleanup error for ${email}:`, error);
  }
}

async function ensureAdminAccount() {
  try {
    const adminEmail = "admin@vibra.app";
    const [existing] = await db.select().from(users).where(eq(users.email, adminEmail));
    if (existing) {
      if (!existing.isAdmin) {
        await db.update(users).set({ isAdmin: true }).where(eq(users.id, existing.id));
        console.log("Admin account updated with admin privileges.");
      }
      console.log("Admin account already exists.");
      return;
    }
    const hashedPassword = await bcrypt.hash("VAdmin2024!", 12);
    await db.insert(users).values({
      id: "admin-vibra-001",
      email: adminEmail,
      password: hashedPassword,
      firstName: "Admin",
      lastName: "Vibra",
      isAdmin: true,
    });
    console.log("Admin account created: admin@vibra.app");
  } catch (error) {
    console.error("Error creating admin account:", error);
  }
}

async function ensureTestAccounts() {
  const testAccounts = [
    {
      userId: "test-luna-001",
      email: "luna@test.com",
      password: "test1234",
      firstName: "Luna",
      lastName: "Stellare",
      profileData: {
        id: "profile-luna-001",
        name: "Luna Stellare",
        age: 28,
        bio: "Esploratrice di galassie lontane, cerco qualcuno con cui condividere tramonti su pianeti sconosciuti.",
        imageUrl: "/images/profile-1.png",
        location: "Nebulosa di Orione",
        interests: ["Astronomia", "Viaggi Spaziali", "Musica Cosmica"],
        alienType: "Nebulare",
      },
    },
    {
      userId: "test-nova-001",
      email: "nova@test.com",
      password: "test1234",
      firstName: "Nova",
      lastName: "Radiante",
      profileData: {
        id: "profile-nova-001",
        name: "Nova Radiante",
        age: 25,
        bio: "Energia pura e passione per le supernove. Il mio sorriso illumina interi sistemi solari.",
        imageUrl: "/images/profile-3.png",
        location: "Ammasso di Pleiadi",
        interests: ["Danza Stellare", "Fotografia Cosmica", "Cucina Galattica"],
        alienType: "Solare",
      },
    },
    {
      userId: "test-orion-001",
      email: "orion@test.com",
      password: "test1234",
      firstName: "Orion",
      lastName: "Celeste",
      profileData: {
        id: "profile-orion-001",
        name: "Orion Celeste",
        age: 32,
        bio: "Cacciatore di stelle cadenti e collezionista di meteoriti. Cerco la mia costellazione perfetta.",
        imageUrl: "/images/profile-4.png",
        location: "Cintura di Orione",
        interests: ["Caccia alle Comete", "Archeologia Spaziale", "Meditazione Quantica"],
        alienType: "Dimensionale",
      },
    },
  ];

  for (const account of testAccounts) {
    try {
      const [existingUser] = await db.select().from(users).where(eq(users.email, account.email));
      if (existingUser) {
        console.log(`Test account ${account.email} already exists.`);
        continue;
      }
      const hashedPassword = await bcrypt.hash(account.password, 12);
      await db.insert(users).values({
        id: account.userId,
        email: account.email,
        password: hashedPassword,
        firstName: account.firstName,
        lastName: account.lastName,
        isAdmin: false,
      });
      const [existingProfile] = await db.select().from(profiles).where(eq(profiles.id, account.profileData.id));
      if (!existingProfile) {
        await db.insert(profiles).values({
          ...account.profileData,
          userId: account.userId,
          isBot: false,
        });
      }
      console.log(`Test account created: ${account.email}`);
    } catch (error) {
      console.error(`Error creating test account ${account.email}:`, error);
    }
  }
}


async function cleanupTestData() {
  try {
    const testEmails = await db.select().from(users).where(
      or(
        sql`${users.email} LIKE '%@test.com'`,
        sql`${users.email} LIKE '%@vibra.test'`,
        sql`${users.email} LIKE '%@example.com'`
      )
    );
    for (const testUser of testEmails) {
      if (testUser.email === "admin@vibra.app") continue;
      await cleanupUserByEmail(testUser.email!);
    }
    if (testEmails.length > 0) {
      console.log(`Cleaned up ${testEmails.length} test accounts.`);
    }
  } catch (error) {
    console.error("Error cleaning up test data:", error);
  }
}

export async function seedDatabase() {
  try {

    const existingProfiles = await db.select().from(profiles);
    
    if (existingProfiles.length === 0) {
      console.log("Seeding database with initial profiles...");
      
      for (const profile of seedProfiles) {
        await db.insert(profiles).values({ ...profile, points: 0 });
      }
      
      for (const swipe of seedSwipesToCreateMatch) {
        await db.insert(swipes).values(swipe);
      }
      
      console.log("Database seeded successfully!");
    } else {
      console.log("Database already has data, skipping seed.");
    }

    const defaultRoomId = "default-room-entra-chi-dico-io";
    const existingDefaultRoom = await db.select().from(privateRooms).where(eq(privateRooms.id, defaultRoomId));
    if (existingDefaultRoom.length === 0) {
      console.log("Seeding default private room 'Entra chi dico io'...");
      await db.insert(privateRooms).values({
        id: defaultRoomId,
        ownerId: "1",
        name: "Entra chi dico io",
        description: "Stanza soggetta ad accettazione",
        imageUrl: "/images/profile-1.png",
        isActive: true,
      });
      console.log("Default private room seeded.");
    }

    await ensureAdminAccount();
    await cleanupTestData();
  } catch (error) {
    console.error("Error seeding database:", error);
  }
}

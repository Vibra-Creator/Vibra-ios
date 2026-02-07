import { db } from "./db";
import { profiles, swipes, privateRooms } from "@shared/schema";
import { eq } from "drizzle-orm";

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

export async function seedDatabase() {
  try {
    const existingProfiles = await db.select().from(profiles);
    
    if (existingProfiles.length === 0) {
      console.log("Seeding database with initial profiles...");
      
      for (const profile of seedProfiles) {
        await db.insert(profiles).values(profile);
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
  } catch (error) {
    console.error("Error seeding database:", error);
  }
}

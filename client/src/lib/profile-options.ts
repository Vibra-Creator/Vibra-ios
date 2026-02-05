export const genderOptions = [
  "Uomo",
  "Donna",
  "Non-binario",
  "Altro",
];

export const hairColorOptions = [
  "Nero",
  "Castano",
  "Biondo",
  "Rosso",
  "Grigio",
  "Bianco",
  "Colorato",
  "Calvo",
];

export const eyeColorOptions = [
  "Marroni",
  "Azzurri",
  "Verdi",
  "Grigi",
  "Nocciola",
  "Neri",
];

export const bodyTypeOptions = [
  "Magro",
  "Atletico",
  "Medio",
  "Robusto",
  "Curvy",
];

export const educationOptions = [
  "Licenza media",
  "Diploma",
  "Laurea triennale",
  "Laurea magistrale",
  "Dottorato",
  "Altro",
];

export const relationshipTypeOptions = [
  "Relazione seria",
  "Amicizia",
  "Qualcosa di casual",
  "Non lo so ancora",
];

export const wantsChildrenOptions = [
  "Sì, voglio figli",
  "No, non voglio figli",
  "Forse in futuro",
  "Ho già figli",
  "Preferisco non dire",
];

export const zodiacSignOptions = [
  "Ariete",
  "Toro",
  "Gemelli",
  "Cancro",
  "Leone",
  "Vergine",
  "Bilancia",
  "Scorpione",
  "Sagittario",
  "Capricorno",
  "Acquario",
  "Pesci",
];

export const loveLanguageOptions = [
  "Parole di affermazione",
  "Tempo di qualità",
  "Ricevere regali",
  "Atti di servizio",
  "Contatto fisico",
];

export const communicationStyleOptions = [
  "Messaggi vocali",
  "Messaggi di testo",
  "Chiamate",
  "Videochiamate",
  "Di persona",
];

export const lifestyleOptions = [
  "Attivo/Sportivo",
  "Casalingo",
  "Sociale/Festaiolo",
  "Avventuroso",
  "Tranquillo",
  "Workaholic",
];

export const accessMotivationOptions = [
  "Cerco l'amore",
  "Nuove amicizie",
  "Divertimento",
  "Curiosità",
  "Uscire dalla routine",
];

export const languageOptions = [
  "Italiano",
  "Inglese",
  "Spagnolo",
  "Francese",
  "Tedesco",
  "Portoghese",
  "Russo",
  "Cinese",
  "Giapponese",
  "Arabo",
  "Altro",
];

export const alienTypes = [
  "Nebulare",
  "Cristallino",
  "Biotico",
  "Dimensionale",
  "Solare",
  "Viaggiatore Stellare",
  "Quantico",
  "Etereo",
];

export const interestsList = [
  "Viaggiare",
  "Cucinare",
  "Sport",
  "Lettura",
  "Cinema",
  "Musica",
  "Ballare",
  "Palestra",
  "Yoga",
  "Meditazione",
  "Fotografia",
  "Arte",
  "Musei",
  "Natura",
  "Mare",
  "Montagna",
  "Camminare",
  "Caffè",
  "Vino",
  "Cibo etnico",
  "Shopping",
  "Moda",
  "Auto",
  "Moto",
  "Tecnologia",
  "Gaming",
  "Serie TV",
  "Animali",
  "Cani",
  "Gatti",
  "Viaggi avventura",
  "Campeggio",
  "Volontariato",
  "Spiritualità",
  "Scrittura",
  "Lingue straniere",
  "Gastronomia",
  "Teatro",
  "Concerti",
  "Ciclismo",
  "Running",
  "Nuoto",
  "Pesca",
  "Fumetti",
  "Astrologia",
  "Scacchi",
  "Mindfulness",
  "Giardinaggio",
  "Pittura",
];

export const suggestedInterests = interestsList;

export function slugify(str: string): string {
  return str.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

export const availableImages = [
  "/images/profile-1.png",
  "/images/profile-2.png",
  "/images/profile-3.png",
  "/images/profile-4.png",
  "/images/profile-5.png",
];

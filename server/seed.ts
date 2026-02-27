import { db } from "./db";
import { profiles, swipes, matches, messages, privateRooms, roomMembers, roomMessages, privateRoomRequests, privateRoomMessages, challengeSubmissions, sentGifts, users, bannedWords, virtualGifts, dailyChallenges, profileRatings, vibingSessions, reports, blockedUsers } from "@shared/schema";
import { eq, or, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";

const cityCoords: Record<string, { lat: number; lng: number }> = {
  Roma: { lat: 41.90, lng: 12.50 }, Milano: { lat: 45.46, lng: 9.19 }, Napoli: { lat: 40.85, lng: 14.27 },
  Firenze: { lat: 43.77, lng: 11.25 }, Torino: { lat: 45.07, lng: 7.69 }, Bologna: { lat: 44.49, lng: 11.34 },
  Palermo: { lat: 38.12, lng: 13.36 }, Genova: { lat: 44.41, lng: 8.93 }, Venezia: { lat: 45.44, lng: 12.32 },
  Verona: { lat: 45.44, lng: 10.99 }, Catania: { lat: 37.50, lng: 15.09 }, Bari: { lat: 41.12, lng: 16.87 },
  Cagliari: { lat: 39.22, lng: 9.12 }, Brescia: { lat: 45.54, lng: 10.21 }, Modena: { lat: 44.65, lng: 10.92 },
  Parma: { lat: 44.80, lng: 10.33 }, Padova: { lat: 45.41, lng: 11.88 }, Perugia: { lat: 43.11, lng: 12.39 },
  Salerno: { lat: 40.68, lng: 14.77 }, Messina: { lat: 38.19, lng: 15.55 },
  Trento: { lat: 46.07, lng: 11.12 }, Treviso: { lat: 45.67, lng: 12.24 }, Amalfi: { lat: 40.63, lng: 14.60 },
  Ancona: { lat: 43.62, lng: 13.52 }, Trieste: { lat: 45.65, lng: 13.78 }, Lecce: { lat: 40.35, lng: 18.17 },
  Livorno: { lat: 43.55, lng: 10.31 }, Siena: { lat: 43.32, lng: 11.33 }, Taranto: { lat: 40.47, lng: 17.24 },
  Arezzo: { lat: 43.46, lng: 11.88 },
};

const seedProfiles = [
  {
    id: "16", name: "Giulia", age: 22,
    bio: "Lavoro come cameriera in un ristorante del centro. Nel tempo libero amo andare al mare e fare lunghe passeggiate. Cerco qualcuno con cui condividere serate tranquille e risate.",
    imageUrl: "/images/bots/bot16_main.jpg", photos: ["/images/bots/bot16_extra1.jpg", "/images/bots/bot16_extra2.jpg"],
    location: "Roma", interests: ["Viaggi", "Cucina", "Mare"], alienType: "Solare",
    gender: "Donna", preferredGender: "Tutti", hairColor: "Castano scuro", eyeColor: "Marrone",
    bodyType: "Snella", height: 165, preferredAgeMin: 18, preferredAgeMax: 99,
    education: "Diploma", languages: ["Italiano", "Inglese"],
    relationshipType: "Relazione seria", wantsChildren: "In futuro", zodiacSign: "Gemelli",
    loveLanguage: "Tempo di qualità", communicationStyle: "Aperto e diretto", lifestyle: "Attivo e sociale"
  },
  {
    id: "17",
    name: "Martina",
    age: 26,
    bio: "Graphic designer di giorno, cuoca appassionata di sera. Credo che la creatività sia il linguaggio dell'anima. Mi piace chi sa farmi ridere e non si prende troppo sul serio.",
    imageUrl: "/images/profile-17.png",
    location: "Milano",
    interests: ["Design", "Cucina", "Arte contemporanea"],
    alienType: "Umanoide",
    gender: "Donna",
    preferredGender: "Tutti",
    hairColor: "Nero",
    eyeColor: "Verde",
    bodyType: "Media",
    height: 170,
    preferredAgeMin: 18,
    preferredAgeMax: 99,
    education: "Laurea",
    languages: ["Italiano", "Inglese", "Francese"],
    relationshipType: "Relazione seria",
    wantsChildren: "Sì",
    zodiacSign: "Bilancia",
    loveLanguage: "Parole di affermazione",
    communicationStyle: "Creativo e spontaneo",
    lifestyle: "Urbano e dinamico"
  },
  {
    id: "18",
    name: "Valentina",
    age: 30,
    bio: "Avvocatessa con il cuore romantico. Amo le cene a lume di candela, i libri gialli e le passeggiate al mare. Cerco complicità e rispetto reciproco.",
    imageUrl: "/images/profile-18.png",
    location: "Napoli",
    interests: ["Letteratura", "Mare", "Cinema"],
    alienType: "Umanoide",
    gender: "Donna",
    preferredGender: "Tutti",
    hairColor: "Nero",
    eyeColor: "Marrone scuro",
    bodyType: "Formosa",
    height: 168,
    preferredAgeMin: 18,
    preferredAgeMax: 99,
    education: "Laurea magistrale",
    languages: ["Italiano", "Inglese"],
    relationshipType: "Relazione seria",
    wantsChildren: "Sì",
    zodiacSign: "Scorpione",
    loveLanguage: "Atti di servizio",
    communicationStyle: "Riflessivo e profondo",
    lifestyle: "Equilibrato"
  },
  {
    id: "19",
    name: "Sofia",
    age: 24,
    bio: "Amante della natura e degli animali. Lavoro come veterinaria e nel tempo libero faccio escursioni in montagna. Cerco una persona genuina con cui costruire qualcosa di vero.",
    imageUrl: "/images/profile-19.png",
    location: "Trento",
    interests: ["Animali", "Montagna", "Yoga"],
    alienType: "Umanoide",
    gender: "Donna",
    preferredGender: "Tutti",
    hairColor: "Biondo",
    eyeColor: "Azzurro",
    bodyType: "Atletica",
    height: 172,
    preferredAgeMin: 18,
    preferredAgeMax: 99,
    education: "Laurea",
    languages: ["Italiano", "Inglese", "Tedesco"],
    relationshipType: "Relazione seria",
    wantsChildren: "In futuro",
    zodiacSign: "Sagittario",
    loveLanguage: "Contatto fisico",
    communicationStyle: "Dolce e premuroso",
    lifestyle: "Sportivo e naturale"
  },
  {
    id: "20",
    name: "Alessia",
    age: 35,
    bio: "Insegnante di musica e pianista. La musica è la mia vita, ma cerco qualcuno con cui scrivere una melodia a due. Amo la cultura, i musei e le serate tranquille.",
    imageUrl: "/images/profile-20.png",
    location: "Firenze",
    interests: ["Musica classica", "Musei", "Vino"],
    alienType: "Umanoide",
    gender: "Donna",
    preferredGender: "Tutti",
    hairColor: "Rosso",
    eyeColor: "Nocciola",
    bodyType: "Snella",
    height: 163,
    preferredAgeMin: 18,
    preferredAgeMax: 99,
    education: "Conservatorio",
    languages: ["Italiano", "Inglese", "Francese"],
    relationshipType: "Relazione seria",
    wantsChildren: "Non sicura",
    zodiacSign: "Pesci",
    loveLanguage: "Tempo di qualità",
    communicationStyle: "Romantico e poetico",
    lifestyle: "Culturale e raffinato"
  },
  {
    id: "21",
    name: "Chiara",
    age: 19,
    bio: "Appena iniziato l'università, studio lingue e amo viaggiare! Energica, curiosa e sempre pronta a scoprire cose nuove. Cerco qualcuno con cui vivere avventure indimenticabili.",
    imageUrl: "/images/profile-21.png",
    location: "Bologna",
    interests: ["Viaggi", "Lingue", "Street food"],
    alienType: "Umanoide",
    gender: "Donna",
    preferredGender: "Tutti",
    hairColor: "Castano chiaro",
    eyeColor: "Verde",
    bodyType: "Snella",
    height: 160,
    preferredAgeMin: 18,
    preferredAgeMax: 99,
    education: "Università in corso",
    languages: ["Italiano", "Inglese", "Giapponese"],
    relationshipType: "Conoscersi prima",
    wantsChildren: "In futuro",
    zodiacSign: "Ariete",
    loveLanguage: "Tempo di qualità",
    communicationStyle: "Energico e entusiasta",
    lifestyle: "Giovane e avventuroso"
  },
  {
    id: "22",
    name: "Francesca",
    age: 28,
    bio: "Marketing manager con una vita sociale piena ma il cuore ancora da riempire. Amo le serate con gli amici, i weekend fuori porta e la buona cucina italiana.",
    imageUrl: "/images/profile-22.png",
    location: "Roma",
    interests: ["Marketing", "Aperitivi", "Weekend getaway"],
    alienType: "Umanoide",
    gender: "Donna",
    preferredGender: "Tutti",
    hairColor: "Castano scuro",
    eyeColor: "Marrone",
    bodyType: "Media",
    height: 167,
    preferredAgeMin: 18,
    preferredAgeMax: 99,
    education: "Laurea magistrale",
    languages: ["Italiano", "Inglese"],
    relationshipType: "Relazione seria",
    wantsChildren: "Sì",
    zodiacSign: "Leone",
    loveLanguage: "Regali e sorprese",
    communicationStyle: "Socievole e caloroso",
    lifestyle: "Mondano e raffinato"
  },
  {
    id: "23",
    name: "Elena",
    age: 32,
    bio: "Fisioterapista e appassionata di benessere. Credo nell'equilibrio tra corpo e mente. Cerco un partner che condivida la passione per uno stile di vita sano e consapevole.",
    imageUrl: "/images/profile-23.png",
    location: "Genova",
    interests: ["Benessere", "Pilates", "Cucina sana"],
    alienType: "Umanoide",
    gender: "Donna",
    preferredGender: "Tutti",
    hairColor: "Biondo miele",
    eyeColor: "Azzurro chiaro",
    bodyType: "Tonica",
    height: 169,
    preferredAgeMin: 18,
    preferredAgeMax: 99,
    education: "Laurea",
    languages: ["Italiano", "Inglese"],
    relationshipType: "Relazione seria",
    wantsChildren: "Sì",
    zodiacSign: "Vergine",
    loveLanguage: "Contatto fisico",
    communicationStyle: "Calmo e rassicurante",
    lifestyle: "Salutare e equilibrato"
  },
  {
    id: "24",
    name: "Aurora R.",
    age: 21,
    bio: "Modella part-time e studentessa di psicologia. Dietro le apparenze c'è molto di più. Amo le conversazioni profonde e chi sa guardare oltre la superficie.",
    imageUrl: "/images/profile-24.png",
    location: "Milano",
    interests: ["Psicologia", "Moda", "Meditazione"],
    alienType: "Umanoide",
    gender: "Donna",
    preferredGender: "Tutti",
    hairColor: "Biondo platino",
    eyeColor: "Grigio azzurro",
    bodyType: "Snella e alta",
    height: 176,
    preferredAgeMin: 18,
    preferredAgeMax: 99,
    education: "Università in corso",
    languages: ["Italiano", "Inglese", "Russo"],
    relationshipType: "Conoscersi prima",
    wantsChildren: "Non ancora",
    zodiacSign: "Acquario",
    loveLanguage: "Parole di affermazione",
    communicationStyle: "Introspettivo e profondo",
    lifestyle: "Fashion e mindful"
  },
  {
    id: "25",
    name: "Serena",
    age: 27,
    bio: "Giornalista freelance e viaggiatrice instancabile. Ho visitato 30 paesi e ogni viaggio mi ha insegnato qualcosa. Cerco un compagno di avventure con mente aperta.",
    imageUrl: "/images/profile-25.png",
    location: "Torino",
    interests: ["Giornalismo", "Viaggi", "Street art"],
    alienType: "Umanoide",
    gender: "Donna",
    preferredGender: "Tutti",
    hairColor: "Nero riccio",
    eyeColor: "Marrone scuro",
    bodyType: "Media",
    height: 164,
    preferredAgeMin: 18,
    preferredAgeMax: 99,
    education: "Laurea",
    languages: ["Italiano", "Inglese", "Portoghese", "Arabo"],
    relationshipType: "Relazione seria",
    wantsChildren: "In futuro",
    zodiacSign: "Capricorno",
    loveLanguage: "Atti di servizio",
    communicationStyle: "Curioso e stimolante",
    lifestyle: "Nomade e cosmopolita"
  },
  {
    id: "31",
    name: "Marco",
    age: 28,
    bio: "Chef in un ristorante stellato. La cucina è la mia arte e il modo in cui esprimo amore. Cerco una persona che apprezzi le cose autentiche e sappia godersi la vita.",
    imageUrl: "/images/profile-31.png",
    location: "Amalfi",
    interests: ["Cucina gourmet", "Vela", "Mercati locali"],
    alienType: "Umanoide",
    gender: "Uomo",
    preferredGender: "Tutti",
    hairColor: "Castano scuro",
    eyeColor: "Marrone",
    bodyType: "Atletico",
    height: 182,
    preferredAgeMin: 18,
    preferredAgeMax: 99,
    education: "Scuola di cucina",
    languages: ["Italiano", "Inglese", "Francese"],
    relationshipType: "Relazione seria",
    wantsChildren: "Sì",
    zodiacSign: "Toro",
    loveLanguage: "Atti di servizio",
    communicationStyle: "Passionale e generoso",
    lifestyle: "Gourmet e mediterraneo"
  },
  {
    id: "32",
    name: "Luca",
    age: 33,
    bio: "Architetto e amante del design. Progetto case di giorno e sogno viaggi la notte. Romantico incurabile che crede ancora nel colpo di fulmine. Buon vino e buona compagnia.",
    imageUrl: "/images/profile-32.png",
    location: "Firenze",
    interests: ["Architettura", "Design", "Viaggi culturali"],
    alienType: "Umanoide",
    gender: "Uomo",
    preferredGender: "Tutti",
    hairColor: "Scuro ondulato",
    eyeColor: "Marrone chiaro",
    bodyType: "Medio atletico",
    height: 180,
    preferredAgeMin: 18,
    preferredAgeMax: 99,
    education: "Laurea magistrale",
    languages: ["Italiano", "Inglese", "Spagnolo"],
    relationshipType: "Relazione seria",
    wantsChildren: "Sì",
    zodiacSign: "Bilancia",
    loveLanguage: "Tempo di qualità",
    communicationStyle: "Romantico e colto",
    lifestyle: "Culturale e raffinato"
  },
  {
    id: "33",
    name: "Alessandro",
    age: 24,
    bio: "Personal trainer e studente di fisioterapia. Lo sport è la mia passione ma so anche rilassarmi davanti a un bel film. Cerco una ragazza solare con cui ridere tanto.",
    imageUrl: "/images/profile-33.png",
    location: "Roma",
    interests: ["Fitness", "Calcio", "Serie TV"],
    alienType: "Umanoide",
    gender: "Uomo",
    preferredGender: "Tutti",
    hairColor: "Nero cortissimo",
    eyeColor: "Marrone scuro",
    bodyType: "Muscoloso",
    height: 185,
    preferredAgeMin: 18,
    preferredAgeMax: 99,
    education: "Università in corso",
    languages: ["Italiano", "Inglese"],
    relationshipType: "Conoscersi prima",
    wantsChildren: "In futuro",
    zodiacSign: "Leone",
    loveLanguage: "Contatto fisico",
    communicationStyle: "Simpatico e diretto",
    lifestyle: "Sportivo e social"
  },
  {
    id: "34",
    name: "Andrea",
    age: 36,
    bio: "Professore di letteratura e scrittore nel tempo libero. Vivo tra libri e caffè. Cerco una persona intelligente con cui condividere pensieri, passeggiate e tramonti.",
    imageUrl: "/images/profile-34.png",
    location: "Bologna",
    interests: ["Letteratura", "Scrittura", "Jazz"],
    alienType: "Umanoide",
    gender: "Uomo",
    preferredGender: "Tutti",
    hairColor: "Castano con grigio alle tempie",
    eyeColor: "Grigio azzurro",
    bodyType: "Medio",
    height: 178,
    preferredAgeMin: 18,
    preferredAgeMax: 99,
    education: "Dottorato",
    languages: ["Italiano", "Inglese", "Francese", "Latino"],
    relationshipType: "Relazione seria",
    wantsChildren: "Sì",
    zodiacSign: "Vergine",
    loveLanguage: "Parole di affermazione",
    communicationStyle: "Intellettuale e premuroso",
    lifestyle: "Culturale e contemplativo"
  },
  {
    id: "35",
    name: "Tommaso",
    age: 22,
    bio: "Musicista e producer. Suono la chitarra e produco beat nel mio piccolo studio. La musica unisce le persone e spero di trovare qualcuno con cui creare armonia.",
    imageUrl: "/images/profile-35.png",
    location: "Torino",
    interests: ["Musica", "Concerti", "Skate"],
    alienType: "Umanoide",
    gender: "Uomo",
    preferredGender: "Tutti",
    hairColor: "Castano riccio",
    eyeColor: "Verde",
    bodyType: "Snello",
    height: 175,
    preferredAgeMin: 18,
    preferredAgeMax: 99,
    education: "Conservatorio in corso",
    languages: ["Italiano", "Inglese"],
    relationshipType: "Conoscersi prima",
    wantsChildren: "Non ancora",
    zodiacSign: "Acquario",
    loveLanguage: "Tempo di qualità",
    communicationStyle: "Creativo e spontaneo",
    lifestyle: "Artistico e alternativo"
  },
  {
    id: "36",
    name: "Davide",
    age: 30,
    bio: "Ingegnere informatico con la passione per la fotografia di strada. Amo catturare momenti autentici e vivere la città di notte. Cerco qualcuno con cui condividere aperitivi e lunghe chiacchierate.",
    imageUrl: "/images/profile-36.png",
    location: "Milano",
    interests: ["Fotografia", "Tecnologia", "Aperitivi"],
    alienType: "Umanoide",
    gender: "Uomo",
    preferredGender: "Tutti",
    hairColor: "Castano scuro",
    eyeColor: "Marrone",
    bodyType: "Atletico",
    height: 183,
    preferredAgeMin: 18,
    preferredAgeMax: 99,
    education: "Laurea magistrale",
    languages: ["Italiano", "Inglese", "Tedesco"],
    relationshipType: "Relazione seria",
    wantsChildren: "In futuro",
    zodiacSign: "Gemelli",
    loveLanguage: "Tempo di qualità",
    communicationStyle: "Analitico e premuroso",
    lifestyle: "Tech e urbano"
  },
  {
    id: "37",
    name: "Federico",
    age: 25,
    bio: "Barista e aspirante sommelier. La vita è troppo corta per bere caffè cattivo. Amo i viaggi spontanei, i tramonti e la buona compagnia. Cerco qualcuno con cui esplorare il mondo.",
    imageUrl: "/images/profile-37.png",
    location: "Verona",
    interests: ["Caffè speciality", "Viaggi", "Enologia"],
    alienType: "Umanoide",
    gender: "Uomo",
    preferredGender: "Tutti",
    hairColor: "Castano chiaro riccio",
    eyeColor: "Verde",
    bodyType: "Snello",
    height: 177,
    preferredAgeMin: 18,
    preferredAgeMax: 99,
    education: "Diploma",
    languages: ["Italiano", "Inglese", "Spagnolo"],
    relationshipType: "Conoscersi prima",
    wantsChildren: "In futuro",
    zodiacSign: "Sagittario",
    loveLanguage: "Atti di servizio",
    communicationStyle: "Solare e avventuroso",
    lifestyle: "Conviviale e viaggiatore"
  },
  {
    id: "38",
    name: "Matteo",
    age: 35,
    bio: "Medico specializzando in cardiologia. Passo le giornate a prendermi cura degli altri, ma cerco qualcuno che si prenda cura di me. Serio quando serve, ironico sempre.",
    imageUrl: "/images/profile-38.png",
    location: "Padova",
    interests: ["Medicina", "Running", "Cinema d'autore"],
    alienType: "Umanoide",
    gender: "Uomo",
    preferredGender: "Tutti",
    hairColor: "Scuro con barba curata",
    eyeColor: "Azzurro",
    bodyType: "Medio atletico",
    height: 181,
    preferredAgeMin: 18,
    preferredAgeMax: 99,
    education: "Specializzazione medica",
    languages: ["Italiano", "Inglese"],
    relationshipType: "Relazione seria",
    wantsChildren: "Sì",
    zodiacSign: "Cancro",
    loveLanguage: "Atti di servizio",
    communicationStyle: "Maturo e ironico",
    lifestyle: "Professionale e equilibrato"
  },
  {
    id: "39",
    name: "Riccardo",
    age: 27,
    bio: "Giocatore di rugby e studente di giurisprudenza. Forte in campo e sensibile fuori. Cerco qualcuno che sappia ridere dei miei scherzi e sopportare le mie cotte post-allenamento.",
    imageUrl: "/images/profile-39.png",
    location: "Treviso",
    interests: ["Rugby", "Diritto", "Barbecue"],
    alienType: "Umanoide",
    gender: "Uomo",
    preferredGender: "Tutti",
    hairColor: "Scuro cortissimo",
    eyeColor: "Nocciola",
    bodyType: "Muscoloso",
    height: 188,
    preferredAgeMin: 18,
    preferredAgeMax: 99,
    education: "Università in corso",
    languages: ["Italiano", "Inglese"],
    relationshipType: "Conoscersi prima",
    wantsChildren: "In futuro",
    zodiacSign: "Ariete",
    loveLanguage: "Contatto fisico",
    communicationStyle: "Simpatico e diretto",
    lifestyle: "Sportivo e goliardico"
  },
  {
    id: "40",
    name: "Stefano",
    age: 32,
    bio: "Art director e illustratore. Creo visual per brand di moda ma la mia vera passione sono i fumetti. Cerco qualcuno con cui condividere mostre, vinili e serate creative.",
    imageUrl: "/images/profile-40.png",
    location: "Roma",
    interests: ["Arte", "Fumetti", "Vinili"],
    alienType: "Umanoide",
    gender: "Uomo",
    preferredGender: "Tutti",
    hairColor: "Scuro medio styled",
    eyeColor: "Marrone scuro",
    bodyType: "Medio",
    height: 179,
    preferredAgeMin: 18,
    preferredAgeMax: 99,
    education: "Accademia di Belle Arti",
    languages: ["Italiano", "Inglese", "Giapponese"],
    relationshipType: "Relazione seria",
    wantsChildren: "Non sicuro",
    zodiacSign: "Scorpione",
    loveLanguage: "Regali creativi",
    communicationStyle: "Creativo e visionario",
    lifestyle: "Artistico e notturno"
  },
  {
    id: "41",
    name: "Roberta",
    age: 34,
    bio: "Amo cucinare per gli amici e fare lunghe passeggiate col mio cane. Non sono una modella ma ho un cuore grande e un sorriso che conquista. Cerco qualcuno che apprezzi le cose semplici della vita.",
    imageUrl: "/images/profile-41.png",
    location: "Bologna",
    interests: ["Cucina", "Passeggiate", "Animali", "Cinema"],
    alienType: "Terrestre",
    gender: "Donna",
    preferredGender: "Tutti",
    hairColor: "Castano scuro",
    eyeColor: "Marrone",
    bodyType: "Robusta",
    height: 162,
    preferredAgeMin: 18,
    preferredAgeMax: 99,
    education: "Diploma",
    languages: ["Italiano"],
    relationshipType: "Relazione seria",
    wantsChildren: "Sì, li desidero",
    zodiacSign: "Cancro",
    loveLanguage: "Atti di servizio",
    communicationStyle: "Casalinga,Socievole",
    lifestyle: "Tranquillo"
  },
  {
    id: "42",
    name: "Salvatore",
    age: 38,
    bio: "Meccanico con le mani d'oro e il cuore tenero. Non sarò il più bello del reame ma so aggiustare qualsiasi cosa, anche un cuore rotto. Amo la birra artigianale e le grigliate domenicali.",
    imageUrl: "/images/profile-42.png",
    location: "Napoli",
    interests: ["Meccanica", "Birra artigianale", "Calcio", "Barbecue"],
    alienType: "Terrestre",
    gender: "Uomo",
    preferredGender: "Tutti",
    hairColor: "Moro",
    eyeColor: "Marrone",
    bodyType: "Robusto",
    height: 174,
    preferredAgeMin: 18,
    preferredAgeMax: 99,
    education: "Diploma",
    languages: ["Italiano"],
    relationshipType: "Relazione seria",
    wantsChildren: "Già ne ho",
    zodiacSign: "Ariete",
    loveLanguage: "Tempo di qualità",
    communicationStyle: "Diretto,Scherzoso",
    lifestyle: "Attivo"
  },
  {
    id: "43",
    name: "Francesca",
    age: 29,
    bio: "Bibliotecaria di giorno, divoratrice di serie TV di notte. Porto qualche chilo in più e zero filtri nelle foto. Se ti piace ridere e parlare di libri, potremmo andare d'accordo!",
    imageUrl: "/images/profile-43.png",
    location: "Roma",
    interests: ["Libri", "Serie TV", "Gatti", "Scrittura"],
    alienType: "Terrestre",
    gender: "Donna",
    preferredGender: "Tutti",
    hairColor: "Nero",
    eyeColor: "Nocciola",
    bodyType: "Curvy",
    height: 158,
    preferredAgeMin: 18,
    preferredAgeMax: 99,
    education: "Laurea",
    languages: ["Italiano", "Inglese", "Francese"],
    relationshipType: "Conoscere gente",
    wantsChildren: "In futuro",
    zodiacSign: "Vergine",
    loveLanguage: "Parole di affermazione",
    communicationStyle: "Introversa,Riflessiva",
    lifestyle: "Tranquillo"
  },
  {
    id: "44",
    name: "Giuseppe",
    age: 41,
    bio: "Chef autodidatta e papà orgoglioso. La pancia è il segno di un uomo che sa cucinare bene! Cerco una compagna per condividere cene, risate e magari qualche avventura nel weekend.",
    imageUrl: "/images/profile-44.png",
    location: "Palermo",
    interests: ["Cucina", "Viaggi", "Pesca", "Vino"],
    alienType: "Terrestre",
    gender: "Uomo",
    preferredGender: "Tutti",
    hairColor: "Calvo",
    eyeColor: "Marrone",
    bodyType: "Robusto",
    height: 178,
    preferredAgeMin: 18,
    preferredAgeMax: 99,
    education: "Diploma",
    languages: ["Italiano"],
    relationshipType: "Relazione seria",
    wantsChildren: "Già ne ho",
    zodiacSign: "Toro",
    loveLanguage: "Contatto fisico",
    communicationStyle: "Diretto,Caloroso",
    lifestyle: "Attivo"
  },
  {
    id: "45",
    name: "Silvia",
    age: 26,
    bio: "Studentessa di informatica un po' nerd. Porto gli occhiali, non so truccarmi e preferisco i videogiochi alle discoteche. Ma sono leale, divertente e so fare battute pessime.",
    imageUrl: "/images/profile-45.png",
    location: "Milano",
    interests: ["Videogiochi", "Manga", "Programmazione", "Pizza"],
    alienType: "Terrestre",
    gender: "Donna",
    preferredGender: "Tutti",
    hairColor: "Castano",
    eyeColor: "Marrone",
    bodyType: "Normale",
    height: 164,
    preferredAgeMin: 18,
    preferredAgeMax: 99,
    education: "Università",
    languages: ["Italiano", "Inglese", "Giapponese"],
    relationshipType: "Conoscere gente",
    wantsChildren: "Non lo so ancora",
    zodiacSign: "Acquario",
    loveLanguage: "Tempo di qualità",
    communicationStyle: "Introversa,Nerd",
    lifestyle: "Tranquillo"
  },
  {
    id: "46",
    name: "Emanuele",
    age: 33,
    bio: "Grafico freelance, magro come un chiodo ma mangio come un lupo. Adoro l'arte, i fumetti e le camminate notturne. Cerco qualcuna che non mi giudichi per il naso grosso ma per l'anima grande.",
    imageUrl: "/images/profile-46.png",
    location: "Firenze",
    interests: ["Arte", "Fumetti", "Design", "Musica indie"],
    alienType: "Terrestre",
    gender: "Uomo",
    preferredGender: "Tutti",
    hairColor: "Castano chiaro",
    eyeColor: "Marrone chiaro",
    bodyType: "Magro",
    height: 183,
    preferredAgeMin: 18,
    preferredAgeMax: 99,
    education: "Laurea",
    languages: ["Italiano", "Inglese"],
    relationshipType: "Relazione seria",
    wantsChildren: "In futuro",
    zodiacSign: "Pesci",
    loveLanguage: "Parole di affermazione",
    communicationStyle: "Creativo,Sensibile",
    lifestyle: "Tranquillo"
  },
  {
    id: "47",
    name: "Monica",
    age: 36,
    bio: "Motociclista, tatuata e con qualche capello grigio. Ho le curve al posto giusto e un carattere forte. Non cerco il principe azzurro ma un compagno di avventure vero.",
    imageUrl: "/images/profile-47.png",
    location: "Torino",
    interests: ["Moto", "Tatuaggi", "Rock", "Viaggi"],
    alienType: "Terrestre",
    gender: "Donna",
    preferredGender: "Tutti",
    hairColor: "Nero corvino",
    eyeColor: "Marrone",
    bodyType: "Curvy",
    height: 168,
    preferredAgeMin: 18,
    preferredAgeMax: 99,
    education: "Diploma",
    languages: ["Italiano", "Inglese", "Tedesco"],
    relationshipType: "Relazione seria",
    wantsChildren: "Non li desidero",
    zodiacSign: "Scorpione",
    loveLanguage: "Contatto fisico",
    communicationStyle: "Diretta,Indipendente",
    lifestyle: "Avventuroso"
  },
  {
    id: "48",
    name: "Lorenzo",
    age: 30,
    bio: "Pasticciere cicciottello col sorriso sempre stampato in faccia. Il mio difetto? Faccio assaggiare tutto a tutti. Se cerchi un ragazzo dolce (in tutti i sensi), scrivimi!",
    imageUrl: "/images/profile-48.png",
    location: "Verona",
    interests: ["Pasticceria", "Cinema", "Fumetti", "Musica"],
    alienType: "Terrestre",
    gender: "Uomo",
    preferredGender: "Tutti",
    hairColor: "Riccio castano",
    eyeColor: "Verde",
    bodyType: "Robusto",
    height: 170,
    preferredAgeMin: 18,
    preferredAgeMax: 99,
    education: "Diploma",
    languages: ["Italiano"],
    relationshipType: "Conoscere gente",
    wantsChildren: "In futuro",
    zodiacSign: "Bilancia",
    loveLanguage: "Regali",
    communicationStyle: "Socievole,Ottimista",
    lifestyle: "Tranquillo"
  },
  {
    id: "49",
    name: "Alessandra",
    age: 27,
    bio: "Personal trainer e amante dello sport. Ho le spalle larghe e i muscoli ma anche un lato dolce che pochi conoscono. Cerco qualcuno che tenga il mio passo, in palestra e nella vita.",
    imageUrl: "/images/profile-49.png",
    location: "Brescia",
    interests: ["Fitness", "Crossfit", "Nutrizione", "Escursionismo"],
    alienType: "Terrestre",
    gender: "Donna",
    preferredGender: "Tutti",
    hairColor: "Nero",
    eyeColor: "Marrone scuro",
    bodyType: "Atletica",
    height: 172,
    preferredAgeMin: 18,
    preferredAgeMax: 99,
    education: "Laurea",
    languages: ["Italiano", "Inglese", "Spagnolo"],
    relationshipType: "Relazione seria",
    wantsChildren: "In futuro",
    zodiacSign: "Leone",
    loveLanguage: "Atti di servizio",
    communicationStyle: "Energica,Motivante",
    lifestyle: "Attivo"
  },
  {
    id: "50",
    name: "Massimo",
    age: 44,
    bio: "Professore di storia con la pancetta e gli occhiali. Le mie rughe raccontano storie interessanti. Cerco una donna intelligente che ami le conversazioni profonde e i weekend fuori porta.",
    imageUrl: "/images/profile-50.png",
    location: "Padova",
    interests: ["Storia", "Letteratura", "Vino", "Escursionismo"],
    alienType: "Terrestre",
    gender: "Uomo",
    preferredGender: "Tutti",
    hairColor: "Sale e pepe",
    eyeColor: "Marrone",
    bodyType: "Normale",
    height: 176,
    preferredAgeMin: 18,
    preferredAgeMax: 99,
    education: "Dottorato",
    languages: ["Italiano", "Inglese", "Latino"],
    relationshipType: "Relazione seria",
    wantsChildren: "Non lo so ancora",
    zodiacSign: "Capricorno",
    loveLanguage: "Parole di affermazione",
    communicationStyle: "Intellettuale,Calmo",
    lifestyle: "Tranquillo"
  },
  {
    id: "51",
    name: "Valentina",
    age: 31,
    bio: "Fioraia con le mani sempre sporche di terra e il cuore pieno di colori. Le mie lentiggini sono la mia mappa del tesoro. Cerco qualcuno che sappia apprezzare un bouquet fatto a mano più di uno comprato online.",
    imageUrl: "/images/profile-51.png",
    location: "Perugia",
    interests: ["Fiori", "Natura", "Fotografia", "Mercatini"],
    alienType: "Terrestre",
    gender: "Donna",
    preferredGender: "Tutti",
    hairColor: "Castano ondulato",
    eyeColor: "Marrone caldo",
    bodyType: "Normale",
    height: 165,
    preferredAgeMin: 18,
    preferredAgeMax: 99,
    education: "Diploma",
    languages: ["Italiano"],
    relationshipType: "Relazione seria",
    wantsChildren: "Sì, li desidero",
    zodiacSign: "Bilancia",
    loveLanguage: "Atti di servizio",
    communicationStyle: "Romantica,Creativa",
    lifestyle: "Tranquillo"
  },
  {
    id: "52",
    name: "Daniele",
    age: 35,
    bio: "Idraulico con la passione per i romanzi gialli. La stempiatura avanza ma il senso dell'umorismo no. Cerco una donna che rida alle mie battute anche quando non sono divertenti.",
    imageUrl: "/images/profile-52.png",
    location: "Ancona",
    interests: ["Lettura", "Calcetto", "Fai da te", "Serie TV"],
    alienType: "Terrestre",
    gender: "Uomo",
    preferredGender: "Tutti",
    hairColor: "Castano corto",
    eyeColor: "Azzurro",
    bodyType: "Medio",
    height: 177,
    preferredAgeMin: 18,
    preferredAgeMax: 99,
    education: "Diploma",
    languages: ["Italiano"],
    relationshipType: "Relazione seria",
    wantsChildren: "In futuro",
    zodiacSign: "Gemelli",
    loveLanguage: "Tempo di qualità",
    communicationStyle: "Ironico,Pratico",
    lifestyle: "Tranquillo"
  },
  {
    id: "53",
    name: "Elisa",
    age: 28,
    bio: "Tatuatrice e illustratrice. I capelli corti li ho scelti io, il naso piercing anche. Sono piccola ma piena di energia. Cerco qualcuno con cui condividere mostre, concerti e pizza alle 2 di notte.",
    imageUrl: "/images/profile-53.png",
    location: "Bologna",
    interests: ["Tatuaggi", "Arte", "Musica live", "Street food"],
    alienType: "Terrestre",
    gender: "Donna",
    preferredGender: "Tutti",
    hairColor: "Pixie nero",
    eyeColor: "Marrone",
    bodyType: "Minuta",
    height: 155,
    preferredAgeMin: 18,
    preferredAgeMax: 99,
    education: "Accademia",
    languages: ["Italiano", "Inglese"],
    relationshipType: "Conoscere gente",
    wantsChildren: "Non lo so ancora",
    zodiacSign: "Sagittario",
    loveLanguage: "Contatto fisico",
    communicationStyle: "Spontanea,Artistica",
    lifestyle: "Avventuroso"
  },
  {
    id: "54",
    name: "Roberto",
    age: 42,
    bio: "Commercialista di professione, cuoco della domenica per passione. Porto qualche chilo in più ma anche tanta allegria. Divorziato con un figlio fantastico, cerco un nuovo capitolo.",
    imageUrl: "/images/profile-54.png",
    location: "Bari",
    interests: ["Cucina", "Vino", "Calcio", "Viaggi"],
    alienType: "Terrestre",
    gender: "Uomo",
    preferredGender: "Tutti",
    hairColor: "Sale e pepe",
    eyeColor: "Marrone",
    bodyType: "Robusto",
    height: 175,
    preferredAgeMin: 18,
    preferredAgeMax: 99,
    education: "Laurea",
    languages: ["Italiano", "Inglese"],
    relationshipType: "Relazione seria",
    wantsChildren: "Già ne ho",
    zodiacSign: "Cancro",
    loveLanguage: "Atti di servizio",
    communicationStyle: "Affidabile,Caloroso",
    lifestyle: "Tranquillo"
  },
  {
    id: "55",
    name: "Amara",
    age: 25,
    bio: "Nata a Lagos, cresciuta a Firenze. Studio medicina e sogno di cambiare il mondo un paziente alla volta. Amo i tramonti, il gelato alla pistacchio e le risate contagiose.",
    imageUrl: "/images/profile-55.png",
    location: "Firenze",
    interests: ["Medicina", "Danza", "Viaggi", "Gelato"],
    alienType: "Terrestre",
    gender: "Donna",
    preferredGender: "Tutti",
    hairColor: "Riccio scuro",
    eyeColor: "Marrone scuro",
    bodyType: "Normale",
    height: 170,
    preferredAgeMin: 18,
    preferredAgeMax: 99,
    education: "Università",
    languages: ["Italiano", "Inglese", "Yoruba"],
    relationshipType: "Conoscere gente",
    wantsChildren: "In futuro",
    zodiacSign: "Acquario",
    loveLanguage: "Parole di affermazione",
    communicationStyle: "Solare,Determinata",
    lifestyle: "Attivo"
  },
  {
    id: "56",
    name: "Valerio",
    age: 39,
    bio: "Ex militare, ora istruttore di arti marziali. Sotto la corazza da duro c'è un uomo che adora i gattini e guarda film romantici di nascosto. Tatuato ma non pericoloso.",
    imageUrl: "/images/profile-56.png",
    location: "Catania",
    interests: ["Arti marziali", "Fitness", "Gatti", "Film"],
    alienType: "Terrestre",
    gender: "Uomo",
    preferredGender: "Tutti",
    hairColor: "Rasato",
    eyeColor: "Marrone",
    bodyType: "Muscoloso",
    height: 182,
    preferredAgeMin: 18,
    preferredAgeMax: 99,
    education: "Diploma",
    languages: ["Italiano", "Inglese"],
    relationshipType: "Relazione seria",
    wantsChildren: "Non lo so ancora",
    zodiacSign: "Ariete",
    loveLanguage: "Contatto fisico",
    communicationStyle: "Protettivo,Dolce dentro",
    lifestyle: "Attivo"
  },
  {
    id: "57",
    name: "Federica",
    age: 32,
    bio: "Insegnante di scuola elementare con i capelli rossi tinti e gli occhiali sempre storti. Adoro i bambini, i gatti e fare torte brutte ma buonissime. Sono genuina, prendere o lasciare!",
    imageUrl: "/images/profile-57.png",
    location: "Trieste",
    interests: ["Bambini", "Dolci", "Lettura", "Yoga"],
    alienType: "Terrestre",
    gender: "Donna",
    preferredGender: "Tutti",
    hairColor: "Rosso tinto",
    eyeColor: "Verde",
    bodyType: "Morbida",
    height: 160,
    preferredAgeMin: 18,
    preferredAgeMax: 99,
    education: "Laurea",
    languages: ["Italiano", "Sloveno", "Inglese"],
    relationshipType: "Relazione seria",
    wantsChildren: "Sì, li desidero",
    zodiacSign: "Pesci",
    loveLanguage: "Regali",
    communicationStyle: "Premurosa,Divertente",
    lifestyle: "Tranquillo"
  },
  {
    id: "58",
    name: "Claudio",
    age: 45,
    bio: "Docente universitario di filosofia. Magro, occhialuto e con troppe domande esistenziali. Se vuoi parlare del senso della vita davanti a un bicchiere di Barolo, sono il tuo uomo.",
    imageUrl: "/images/profile-58.png",
    location: "Torino",
    interests: ["Filosofia", "Vino", "Jazz", "Scacchi"],
    alienType: "Terrestre",
    gender: "Uomo",
    preferredGender: "Tutti",
    hairColor: "Grigio tempio",
    eyeColor: "Grigio",
    bodyType: "Magro",
    height: 180,
    preferredAgeMin: 18,
    preferredAgeMax: 99,
    education: "Dottorato",
    languages: ["Italiano", "Francese", "Tedesco"],
    relationshipType: "Relazione seria",
    wantsChildren: "Non li desidero",
    zodiacSign: "Capricorno",
    loveLanguage: "Parole di affermazione",
    communicationStyle: "Intellettuale,Pacato",
    lifestyle: "Tranquillo"
  },
  {
    id: "59",
    name: "Giada",
    age: 23,
    bio: "Atleta di triathlon, sempre in movimento. Non porto trucco, sudo molto e mangio come un camionista. Ma so anche essere dolce quando serve. Cerco qualcuno che mi tenga il passo.",
    imageUrl: "/images/profile-59.png",
    location: "Trento",
    interests: ["Triathlon", "Nuoto", "Corsa", "Montagna"],
    alienType: "Terrestre",
    gender: "Donna",
    preferredGender: "Tutti",
    hairColor: "Castano coda",
    eyeColor: "Marrone",
    bodyType: "Atletica",
    height: 173,
    preferredAgeMin: 18,
    preferredAgeMax: 99,
    education: "Diploma",
    languages: ["Italiano", "Inglese"],
    relationshipType: "Conoscere gente",
    wantsChildren: "Non lo so ancora",
    zodiacSign: "Leone",
    loveLanguage: "Atti di servizio",
    communicationStyle: "Energica,Competitiva",
    lifestyle: "Attivo"
  },
  {
    id: "60",
    name: "Antonio",
    age: 37,
    bio: "Pizzaiolo napoletano trapiantato a Milano. Faccio la migliore margherita della Lombardia e non accetto critiche. Sono cicciottello, riccioluto e sempre di buon umore.",
    imageUrl: "/images/profile-60.png",
    location: "Milano",
    interests: ["Pizza", "Cucina", "Musica", "Calcio"],
    alienType: "Terrestre",
    gender: "Uomo",
    preferredGender: "Tutti",
    hairColor: "Riccio nero",
    eyeColor: "Marrone",
    bodyType: "Robusto",
    height: 172,
    preferredAgeMin: 18,
    preferredAgeMax: 99,
    education: "Diploma",
    languages: ["Italiano", "Napoletano"],
    relationshipType: "Relazione seria",
    wantsChildren: "Sì, li desidero",
    zodiacSign: "Sagittario",
    loveLanguage: "Contatto fisico",
    communicationStyle: "Espansivo,Generoso",
    lifestyle: "Socievole"
  },
  {
    id: "61",
    name: "Serena",
    age: 30,
    bio: "Veterinaria con un debole per i cani randagi. Ho gli occhi scuri e il cuore grande. Non sono la ragazza perfetta delle riviste ma sono vera, affidabile e amo ridere di gusto.",
    imageUrl: "/images/profile-61.png",
    location: "Lecce",
    interests: ["Animali", "Natura", "Cucina", "Mare"],
    alienType: "Terrestre",
    gender: "Donna",
    preferredGender: "Tutti",
    hairColor: "Nero liscio",
    eyeColor: "Marrone scuro",
    bodyType: "Normale",
    height: 163,
    preferredAgeMin: 18,
    preferredAgeMax: 99,
    education: "Laurea",
    languages: ["Italiano", "Inglese"],
    relationshipType: "Relazione seria",
    wantsChildren: "Sì, li desidero",
    zodiacSign: "Vergine",
    loveLanguage: "Tempo di qualità",
    communicationStyle: "Empatica,Riflessiva",
    lifestyle: "Tranquillo"
  },
  {
    id: "62",
    name: "Simone",
    age: 34,
    bio: "Elettricista e musicista nel tempo libero. Suono la chitarra peggio di quanto aggiusto i circuiti. Ho un sorriso un po' storto ma autentico. Cerco qualcuna con cui fare jam session sul divano.",
    imageUrl: "/images/profile-62.png",
    location: "Livorno",
    interests: ["Musica", "Chitarra", "Mare", "Birra"],
    alienType: "Terrestre",
    gender: "Uomo",
    preferredGender: "Tutti",
    hairColor: "Castano corto",
    eyeColor: "Marrone",
    bodyType: "Magro",
    height: 179,
    preferredAgeMin: 18,
    preferredAgeMax: 99,
    education: "Diploma",
    languages: ["Italiano"],
    relationshipType: "Conoscere gente",
    wantsChildren: "In futuro",
    zodiacSign: "Gemelli",
    loveLanguage: "Tempo di qualità",
    communicationStyle: "Rilassato,Creativo",
    lifestyle: "Tranquillo"
  },
  {
    id: "63",
    name: "Patrizia",
    age: 40,
    bio: "Avvocatessa divorziata con due figli meravigliosi. Ho qualche ruga in più ma anche tanta esperienza. Porto i tacchi al lavoro e le infradito nel weekend. Cerco stabilità e complicità.",
    imageUrl: "/images/profile-63.png",
    location: "Roma",
    interests: ["Diritto", "Teatro", "Viaggi", "Moda"],
    alienType: "Terrestre",
    gender: "Donna",
    preferredGender: "Tutti",
    hairColor: "Biondo cenere",
    eyeColor: "Azzurro",
    bodyType: "Morbida",
    height: 166,
    preferredAgeMin: 18,
    preferredAgeMax: 99,
    education: "Laurea",
    languages: ["Italiano", "Inglese", "Francese"],
    relationshipType: "Relazione seria",
    wantsChildren: "Già ne ho",
    zodiacSign: "Leone",
    loveLanguage: "Parole di affermazione",
    communicationStyle: "Elegante,Determinata",
    lifestyle: "Raffinato"
  },
  {
    id: "64",
    name: "Marco A.",
    age: 29,
    bio: "Barista e aspirante sommelier. Vivo di caffè e sogni. Sono magro, con la barba incolta e gli occhi da cucciolo. Se ti piace il profumo di caffè appena fatto, siamo già compatibili.",
    imageUrl: "/images/profile-64.png",
    location: "Verona",
    interests: ["Caffè", "Vino", "Aperitivi", "Viaggi"],
    alienType: "Terrestre",
    gender: "Uomo",
    preferredGender: "Tutti",
    hairColor: "Scuro mosso",
    eyeColor: "Marrone",
    bodyType: "Atletico",
    height: 176,
    preferredAgeMin: 18,
    preferredAgeMax: 99,
    education: "Diploma",
    languages: ["Italiano", "Spagnolo"],
    relationshipType: "Conoscere gente",
    wantsChildren: "In futuro",
    zodiacSign: "Acquario",
    loveLanguage: "Contatto fisico",
    communicationStyle: "Charmoso,Spontaneo",
    lifestyle: "Socievole"
  },
  {
    id: "65",
    name: "Arianna",
    age: 33,
    bio: "Fotografa freelance con i capelli rossi naturali e troppe lentiggini. Amo catturare la bellezza nei dettagli imperfetti. Cerco un soggetto preferito con cui scattare ricordi.",
    imageUrl: "/images/profile-65.png",
    location: "Siena",
    interests: ["Fotografia", "Viaggi", "Arte", "Vino"],
    alienType: "Terrestre",
    gender: "Donna",
    preferredGender: "Tutti",
    hairColor: "Rosso naturale",
    eyeColor: "Verde",
    bodyType: "Normale",
    height: 167,
    preferredAgeMin: 18,
    preferredAgeMax: 99,
    education: "Laurea",
    languages: ["Italiano", "Inglese", "Spagnolo"],
    relationshipType: "Relazione seria",
    wantsChildren: "In futuro",
    zodiacSign: "Pesci",
    loveLanguage: "Regali",
    communicationStyle: "Sensibile,Osservatrice",
    lifestyle: "Avventuroso"
  },
  {
    id: "66",
    name: "Franco",
    age: 47,
    bio: "Contadino e produttore di olio d'oliva in Puglia. Le mie mani sono ruvide ma il mio abbraccio è forte. Porto i baffi con orgoglio e cucino come nonna mi ha insegnato.",
    imageUrl: "/images/profile-66.png",
    location: "Taranto",
    interests: ["Agricoltura", "Cucina", "Natura", "Vino"],
    alienType: "Terrestre",
    gender: "Uomo",
    preferredGender: "Tutti",
    hairColor: "Scuro con baffi",
    eyeColor: "Marrone",
    bodyType: "Robusto",
    height: 173,
    preferredAgeMin: 18,
    preferredAgeMax: 99,
    education: "Elementare",
    languages: ["Italiano", "Dialetto pugliese"],
    relationshipType: "Relazione seria",
    wantsChildren: "Già ne ho",
    zodiacSign: "Toro",
    loveLanguage: "Atti di servizio",
    communicationStyle: "Tradizionale,Genuino",
    lifestyle: "Rustico"
  },
  {
    id: "67",
    name: "Beatrice",
    age: 24,
    bio: "DJ e studentessa di ingegneria. Capelli cortissimi, un piercing al sopracciglio e zero voglia di conformarmi. Cerco qualcuno che balli con me fino all'alba e studi con me fino a tardi.",
    imageUrl: "/images/profile-67.png",
    location: "Milano",
    interests: ["Musica elettronica", "Ingegneria", "Club", "Skate"],
    alienType: "Terrestre",
    gender: "Donna",
    preferredGender: "Tutti",
    hairColor: "Buzz cut scuro",
    eyeColor: "Marrone",
    bodyType: "Minuta",
    height: 160,
    preferredAgeMin: 18,
    preferredAgeMax: 99,
    education: "Università",
    languages: ["Italiano", "Inglese"],
    relationshipType: "Conoscere gente",
    wantsChildren: "Non li desidero",
    zodiacSign: "Scorpione",
    loveLanguage: "Tempo di qualità",
    communicationStyle: "Ribelle,Intelligente",
    lifestyle: "Notturno"
  },
  {
    id: "68",
    name: "Giacomo",
    age: 36,
    bio: "Falegname artigianale. Costruisco mobili con le mie mani e sogni con la fantasia. Barba lunga, capelli raccolti e mani sempre impegnate. Cerco qualcuna a cui costruire una mensola e una storia.",
    imageUrl: "/images/profile-68.png",
    location: "Arezzo",
    interests: ["Falegnameria", "Natura", "Birra", "Escursionismo"],
    alienType: "Terrestre",
    gender: "Uomo",
    preferredGender: "Tutti",
    hairColor: "Castano man bun",
    eyeColor: "Marrone",
    bodyType: "Grande",
    height: 185,
    preferredAgeMin: 18,
    preferredAgeMax: 99,
    education: "Diploma",
    languages: ["Italiano"],
    relationshipType: "Relazione seria",
    wantsChildren: "Sì, li desidero",
    zodiacSign: "Toro",
    loveLanguage: "Atti di servizio",
    communicationStyle: "Paziente,Creativo",
    lifestyle: "Tranquillo"
  },
  {
    id: "69",
    name: "Giuliana",
    age: 27,
    bio: "Infermiera con le fossette e qualche chilo di troppo. Passo le giornate a prendermi cura degli altri, la sera cerco qualcuno che si prenda cura di me. Amo i dolci e le coccole.",
    imageUrl: "/images/profile-69.png",
    location: "Genova",
    interests: ["Dolci", "Serie TV", "Mare", "Coccole"],
    alienType: "Terrestre",
    gender: "Donna",
    preferredGender: "Tutti",
    hairColor: "Castano trecce",
    eyeColor: "Marrone",
    bodyType: "Morbida",
    height: 161,
    preferredAgeMin: 18,
    preferredAgeMax: 99,
    education: "Laurea",
    languages: ["Italiano"],
    relationshipType: "Relazione seria",
    wantsChildren: "Sì, li desidero",
    zodiacSign: "Cancro",
    loveLanguage: "Contatto fisico",
    communicationStyle: "Premurosa,Dolce",
    lifestyle: "Tranquillo"
  },
  {
    id: "70",
    name: "Piero",
    age: 43,
    bio: "Vigile del fuoco in pensione anticipata. I capelli grigi li ho guadagnati sul campo. Adesso alleno la squadra di calcio del quartiere e cerco qualcuna con cui guardare i tramonti dal balcone.",
    imageUrl: "/images/profile-70.png",
    location: "Napoli",
    interests: ["Calcio", "Volontariato", "Cinema", "Passeggiate"],
    alienType: "Terrestre",
    gender: "Uomo",
    preferredGender: "Tutti",
    hairColor: "Grigio buzz cut",
    eyeColor: "Marrone",
    bodyType: "Medio",
    height: 178,
    preferredAgeMin: 18,
    preferredAgeMax: 99,
    education: "Diploma",
    languages: ["Italiano"],
    relationshipType: "Relazione seria",
    wantsChildren: "Già ne ho",
    zodiacSign: "Sagittario",
    loveLanguage: "Tempo di qualità",
    communicationStyle: "Protettivo,Calmo",
    lifestyle: "Attivo"
  }
];

const seedSwipesToCreateMatch = [
  {
    swiperId: "16",
    swipedId: "user-1",
    liked: true,
  },
  {
    swiperId: "31",
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
    const adminEmail = "admin@vibra.com";
    const adminId = "admin-vibra-001";
    const [existingByEmail] = await db.select().from(users).where(eq(users.email, adminEmail));
    const [existingById] = await db.select().from(users).where(eq(users.id, adminId));
    if (existingByEmail || existingById) {
      const existing = existingByEmail || existingById;
      if (existing && !existing.isAdmin) {
        await db.update(users).set({ isAdmin: true }).where(eq(users.id, existing.id));
        console.log("Admin account updated with admin privileges.");
      }
      console.log("Admin account already exists.");
      return;
    }
    const hashedPassword = await bcrypt.hash("VAdmin2024!", 12);
    await db.insert(users).values({
      id: adminId,
      email: adminEmail,
      password: hashedPassword,
      firstName: "Admin",
      lastName: "Vibra",
      isAdmin: true,
    });
    console.log("Admin account created: admin@vibra.com");
  } catch (error) {
    console.error("Error creating admin account:", error);
  }
}

async function promoteUserToAdmin(email: string) {
  try {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    if (user && !user.isAdmin) {
      await db.update(users).set({ isAdmin: true }).where(eq(users.id, user.id));
      console.log(`User ${email} promoted to admin.`);
    } else if (user && user.isAdmin) {
      console.log(`User ${email} is already admin.`);
    } else {
      console.log(`User ${email} not found yet, will be promoted on next restart after registration.`);
    }
  } catch (error) {
    console.error(`Error promoting ${email} to admin:`, error);
  }
}



const botAccountCredentials = [
  { profileId: "16", email: "giulia@vibra.com", password: "Vibra2024!", firstName: "Giulia", lastName: "Romani" },
  { profileId: "17", email: "martina@vibra.com", password: "Vibra2024!", firstName: "Martina", lastName: "Bianchi" },
  { profileId: "18", email: "valentina@vibra.com", password: "Vibra2024!", firstName: "Valentina", lastName: "Esposito" },
  { profileId: "19", email: "sofia@vibra.com", password: "Vibra2024!", firstName: "Sofia", lastName: "Moretti" },
  { profileId: "20", email: "alessia@vibra.com", password: "Vibra2024!", firstName: "Alessia", lastName: "Colombo" },
  { profileId: "21", email: "chiara@vibra.com", password: "Vibra2024!", firstName: "Chiara", lastName: "Ricci" },
  { profileId: "22", email: "francesca@vibra.com", password: "Vibra2024!", firstName: "Francesca", lastName: "Marino" },
  { profileId: "23", email: "elena@vibra.com", password: "Vibra2024!", firstName: "Elena", lastName: "Greco" },
  { profileId: "24", email: "aurora.r@vibra.com", password: "Vibra2024!", firstName: "Aurora", lastName: "Rossi" },
  { profileId: "25", email: "serena@vibra.com", password: "Vibra2024!", firstName: "Serena", lastName: "Conti" },
  { profileId: "31", email: "marco@vibra.com", password: "Vibra2024!", firstName: "Marco", lastName: "De Luca" },
  { profileId: "32", email: "luca@vibra.com", password: "Vibra2024!", firstName: "Luca", lastName: "Barbieri" },
  { profileId: "33", email: "alessandro@vibra.com", password: "Vibra2024!", firstName: "Alessandro", lastName: "Vitale" },
  { profileId: "34", email: "andrea@vibra.com", password: "Vibra2024!", firstName: "Andrea", lastName: "Marchetti" },
  { profileId: "35", email: "tommaso@vibra.com", password: "Vibra2024!", firstName: "Tommaso", lastName: "Ferrara" },
  { profileId: "36", email: "davide@vibra.com", password: "Vibra2024!", firstName: "Davide", lastName: "Lombardi" },
  { profileId: "37", email: "federico@vibra.com", password: "Vibra2024!", firstName: "Federico", lastName: "Santoro" },
  { profileId: "38", email: "matteo@vibra.com", password: "Vibra2024!", firstName: "Matteo", lastName: "Caruso" },
  { profileId: "39", email: "riccardo@vibra.com", password: "Vibra2024!", firstName: "Riccardo", lastName: "Bruno" },
  { profileId: "40", email: "stefano@vibra.com", password: "Vibra2024!", firstName: "Stefano", lastName: "Rinaldi" },
];

async function createBotUserAccounts() {
  for (const bot of botAccountCredentials) {
    try {
      const userId = `bot-user-${bot.profileId}`;
      const [existingById] = await db.select().from(users).where(eq(users.id, userId));
      if (existingById) {
        const [profile] = await db.select().from(profiles).where(eq(profiles.id, bot.profileId));
        if (profile && !profile.userId) {
          await db.update(profiles).set({ userId }).where(eq(profiles.id, bot.profileId));
        }
        continue;
      }
      const [existingByEmail] = await db.select().from(users).where(eq(users.email, bot.email));
      if (existingByEmail) {
        const [profile] = await db.select().from(profiles).where(eq(profiles.id, bot.profileId));
        if (profile && !profile.userId) {
          await db.update(profiles).set({ userId: existingByEmail.id }).where(eq(profiles.id, bot.profileId));
        }
        continue;
      }
      const hashedPassword = await bcrypt.hash(bot.password, 12);
      await db.insert(users).values({
        id: userId,
        email: bot.email,
        password: hashedPassword,
        firstName: bot.firstName,
        lastName: bot.lastName,
        isAdmin: false,
      });
      await db.update(profiles).set({ userId }).where(eq(profiles.id, bot.profileId));
      console.log(`Bot account created: ${bot.email} (profile ${bot.profileId})`);
    } catch (error) {
      console.error(`Error creating bot account ${bot.email}:`, error);
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
      if (testUser.email === "admin@vibra.com") continue;
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

    const validBotIds = new Set(seedProfiles.map(p => p.id));
    const existingProfiles = await db.select().from(profiles);
    const existingIds = new Set(existingProfiles.map(p => p.id));

    const oldBotProfiles = existingProfiles.filter(p => p.isBot && !validBotIds.has(p.id));
    if (oldBotProfiles.length > 0) {
      console.log(`Removing ${oldBotProfiles.length} outdated bot profiles...`);
      for (const old of oldBotProfiles) {
        await db.delete(reports).where(or(eq(reports.reporterId, old.id), eq(reports.reportedId, old.id)));
        await db.delete(blockedUsers).where(or(eq(blockedUsers.blockerId, old.id), eq(blockedUsers.blockedId, old.id)));
        await db.delete(sentGifts).where(or(eq(sentGifts.senderId, old.id), eq(sentGifts.receiverId, old.id)));
        await db.delete(profileRatings).where(or(eq(profileRatings.raterId, old.id), eq(profileRatings.ratedId, old.id)));
        await db.delete(challengeSubmissions).where(eq(challengeSubmissions.profileId, old.id));
        await db.delete(roomMembers).where(eq(roomMembers.profileId, old.id));
        await db.delete(roomMessages).where(eq(roomMessages.senderId, old.id));
        await db.delete(vibingSessions).where(eq(vibingSessions.profileId, old.id));

        const oldMatches = await db.select().from(matches).where(
          or(eq(matches.profile1Id, old.id), eq(matches.profile2Id, old.id))
        );
        for (const m of oldMatches) {
          await db.delete(messages).where(eq(messages.matchId, m.id));
        }
        await db.delete(matches).where(or(eq(matches.profile1Id, old.id), eq(matches.profile2Id, old.id)));
        await db.delete(swipes).where(or(eq(swipes.swiperId, old.id), eq(swipes.swipedId, old.id)));

        await db.delete(privateRoomRequests).where(eq(privateRoomRequests.requesterId, old.id));
        await db.delete(privateRoomMessages).where(eq(privateRoomMessages.senderId, old.id));
        const oldPrivateRooms = await db.select().from(privateRooms).where(eq(privateRooms.ownerId, old.id));
        for (const pr of oldPrivateRooms) {
          await db.delete(privateRoomRequests).where(eq(privateRoomRequests.roomId, pr.id));
          await db.delete(privateRoomMessages).where(eq(privateRoomMessages.roomId, pr.id));
        }
        await db.delete(privateRooms).where(eq(privateRooms.ownerId, old.id));

        await db.delete(profiles).where(eq(profiles.id, old.id));
        console.log(`  Deleted old bot: ${old.name} (${old.id})`);
      }
    }
    
    const missingProfiles = seedProfiles.filter(p => !existingIds.has(p.id));
    
    if (missingProfiles.length > 0) {
      console.log(`Seeding ${missingProfiles.length} new bot profiles...`);
      for (const profile of missingProfiles) {
        const coords = cityCoords[profile.location] || null;
        await db.insert(profiles).values({ ...profile, isBot: true, points: 0, ratingEnabled: false, profileLatitude: coords?.lat || null, profileLongitude: coords?.lng || null });
      }
      console.log("Bot profiles seeded successfully!");
    } else {
      console.log("All bot profiles already exist, skipping seed.");
    }

    await db.execute(sql`UPDATE profiles SET points = 0 WHERE points != 0`);

    const botProfiles = await db.select({ id: profiles.id }).from(profiles).where(eq(profiles.isBot, true));
    for (let i = 0; i < botProfiles.length; i++) {
      const bot = botProfiles[i];
      let randomMinutesAgo: number;
      if (i < 5) {
        randomMinutesAgo = Math.floor(Math.random() * 3);
      } else if (i < 15) {
        randomMinutesAgo = Math.floor(Math.random() * 30) + 3;
      } else if (i < 30) {
        randomMinutesAgo = Math.floor(Math.random() * 120) + 30;
      } else {
        randomMinutesAgo = Math.floor(Math.random() * 1440) + 120;
      }
      const lastActive = new Date(Date.now() - randomMinutesAgo * 60000);
      await db.update(profiles).set({ lastActiveAt: lastActive }).where(eq(profiles.id, bot.id));
    }
    console.log(`Set lastActiveAt for ${botProfiles.length} bot profiles.`);
    
    if (existingProfiles.length === 0) {
      for (const swipe of seedSwipesToCreateMatch) {
        await db.insert(swipes).values(swipe);
      }
    }


    const existingBannedWords = await db.select().from(bannedWords);
    if (existingBannedWords.length === 0) {
      console.log("Seeding banned words filter...");
      const defaultBannedWords = [
        "cazzo","merda","stronzo","vaffanculo","puttana","troia","minchia","coglione","bastardo","idiota",
        "fuck","shit","bitch","asshole","dick","pussy","whore","nigger","faggot","retard",
        "bullo","bullismo","sfigato","perdente","fallito","nessuno ti vuole","fai schifo","sei inutile",
        "ammazzati","sei un peso","non vali niente","fatti del male","ti odio","sparisci","nessuno ti ama",
        "molestia","ti vengo a prendere","so dove abiti","ti seguo","ti trovo","stalking","ti perseguito",
        "non ti lascio in pace","ti rovino","ti distruggo",
        "negro","frocio","finocchio","handicappato","mongolo","zingaro","terrone","extracomunitario",
        "ritardato","anormale","diverso di merda","lesbicaccia","trans di merda","razza inferiore","tornatene al tuo paese",
        "mandami foto nuda","foto nuda","foto nudo","nudes","sesso orale","scopiamo","ti scopo","pompino",
        "trombata","ti penetro","voglio scoparti","sextape","sexting","inculare","masturbazione",
        "ti ammazzo","ti uccido","ti spacco la faccia","ti meno","ti picchio","ti accoltelto","ti sparo",
        "violenza","ti faccio del male","ti spezzo le ossa","prendi le botte","ti massacro","sangue",
        "ti faccio a pezzi","ti squarto",
        "se mi lasci mi ammazzo","senza di me muori","nessuno ti amerà","sei niente senza di me",
        "mi devi tutto","ti controllo","dammi la password","fammi vedere il telefono","non puoi uscire",
        "non parlare con nessuno","sei solo mia","sei solo mio","ti tengo d'occhio","ti ricatto","ricatto",
        "ti pubblico le foto","revenge porn","diffondo le tue foto","ho i tuoi dati","so il tuo indirizzo",
        "pubblico tutto","ti espongo","doxing","doxxing","ho le tue foto intime","mando tutto ai tuoi amici","ti smaschero",
      ];
      for (const word of defaultBannedWords) {
        await db.insert(bannedWords).values({ word }).onConflictDoNothing();
      }
      console.log(`Seeded ${defaultBannedWords.length} banned words.`);
    }

    const existingGifts = await db.select().from(virtualGifts);
    if (existingGifts.length === 0) {
      console.log("Seeding virtual gifts...");
      const defaultGifts = [
        { name: "Stella Cadente", description: "Una stella luminosa per illuminare la giornata", cost: 10, animationType: "shooting_star", icon: "star", color: "#FFD700", sortOrder: 1 },
        { name: "Rosa Cosmica", description: "Un fiore nato tra le stelle per chi ami", cost: 25, animationType: "cosmic_rose", icon: "flower", color: "#FF69B4", sortOrder: 2 },
        { name: "Cuore Nebulosa", description: "Un cuore che pulsa come una nebulosa", cost: 50, animationType: "nebula_heart", icon: "heart", color: "#FF1493", sortOrder: 3 },
        { name: "Anello di Saturno", description: "Un anello prezioso come quelli di Saturno", cost: 100, animationType: "saturn_ring", icon: "ring", color: "#9370DB", sortOrder: 4 },
        { name: "Supernova", description: "Un'esplosione di energia e passione", cost: 200, animationType: "supernova", icon: "explosion", color: "#FF4500", sortOrder: 5 },
        { name: "Galassia d'Amore", description: "Un'intera galassia dedicata a te", cost: 500, animationType: "galaxy_love", icon: "galaxy", color: "#8A2BE2", sortOrder: 6 },
      ];
      for (const gift of defaultGifts) {
        await db.insert(virtualGifts).values(gift);
      }
      console.log(`Seeded ${defaultGifts.length} virtual gifts.`);
    }

    const existingChallenges = await db.select().from(dailyChallenges).where(eq(dailyChallenges.isActive, true));
    const nonExpiredChallenges = existingChallenges.filter(c => !c.expiresAt || new Date(c.expiresAt) > new Date());
    if (nonExpiredChallenges.length === 0) {
      console.log("Seeding daily challenges with 12h expiration...");
      const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000);
      const defaultChallenges = [
        { title: "Truccato/a da Donna", description: "Scatta una foto di te stesso truccato da donna - mostra il tuo lato divertente!", points: 20 },
        { title: "Pulizia Bagno", description: "Fotografati mentre pulisci il bagno - dimostra che sai essere responsabile!", points: 15 },
        { title: "Chef per un Giorno", description: "Prepara un piatto e fotografalo - mostra le tue abilita' culinarie!", points: 15 },
        { title: "Animale Domestico", description: "Scatta un selfie con un animale - mostra il tuo lato dolce!", points: 10 },
        { title: "Tramonto Romantico", description: "Fotografa un tramonto dalla tua posizione - condividi la bellezza!", points: 10 },
        { title: "Talento Nascosto", description: "Mostra un tuo talento nascosto in foto - sorprendici!", points: 25 },
        { title: "Look del Mattino", description: "Selfie appena sveglio/a senza filtri - sii autentico/a!", points: 20 },
        { title: "Outfit Creativo", description: "Indossa qualcosa di creativo o divertente e fotografati!", points: 15 },
        { title: "Angolo Relax", description: "Quale e' il posto dove ti senti a casa? Mostraci il tuo angolo di pace!", points: 15 },
        { title: "Outfit del \"Ma Anche No\"", description: "Indossa l'abbinamento piu' assurdo che hai e sfoggialo con orgoglio!", points: 20 },
        { title: "Healthy Snack", description: "Mostraci il tuo spuntino o colazione salutare di oggi!", points: 10 },
        { title: "Caffeina Check", description: "Mostraci la tua tazza piu' originale dove bevi il caffe'!", points: 10 },
      ];
      for (const c of defaultChallenges) {
        await db.insert(dailyChallenges).values({ ...c, isActive: true, expiresAt });
      }
      console.log(`Seeded ${defaultChallenges.length} challenges (expire in 12h).`);
    }

    

    const botIds = (await db.select({ id: profiles.id }).from(profiles).where(eq(profiles.isBot, true))).map(p => p.id);
    if (botIds.length > 0) {
      const botRatings = await db.delete(profileRatings).where(
        or(
          sql`${profileRatings.raterId} IN (${sql.join(botIds.map(id => sql`${id}`), sql`, `)})`,
          sql`${profileRatings.ratedId} IN (${sql.join(botIds.map(id => sql`${id}`), sql`, `)})`
        )
      ).returning();
      if (botRatings.length > 0) {
        console.log(`Cleaned up ${botRatings.length} bot-related ratings.`);
      }
      await db.update(profiles).set({ ratingEnabled: false }).where(eq(profiles.isBot, true));
    }

    await createBotUserAccounts();
    await ensureAdminAccount();
    await promoteUserToAdmin("famax61@yahoo.com");
    await promoteUserToAdmin("famax61@gmail.com");
    await cleanupTestData();
    try {
      const oldRoom = await db.select().from(privateRooms).where(eq(privateRooms.id, "entra-chi-dico-io"));
      if (oldRoom.length > 0) {
        await db.delete(privateRoomMessages).where(eq(privateRoomMessages.roomId, "entra-chi-dico-io"));
        await db.delete(privateRoomRequests).where(eq(privateRoomRequests.roomId, "entra-chi-dico-io"));
        await db.delete(privateRooms).where(eq(privateRooms.id, "entra-chi-dico-io"));
        console.log("Removed legacy 'Entra chi dico io' room.");
      }
    } catch (e) {}

    try {
      const oldFeatured = await db.select().from(privateRooms).where(eq(privateRooms.id, "vuoi-conversare-con-me"));
      if (oldFeatured.length > 0) {
        await db.delete(privateRoomMessages).where(eq(privateRoomMessages.roomId, "vuoi-conversare-con-me"));
        await db.delete(privateRoomRequests).where(eq(privateRoomRequests.roomId, "vuoi-conversare-con-me"));
        await db.delete(privateRooms).where(eq(privateRooms.id, "vuoi-conversare-con-me"));
        console.log("Removed legacy 'Vuoi conversare con me?' room.");
      }
    } catch (e) {}

  } catch (error) {
    console.error("Error seeding database:", error);
  }
}

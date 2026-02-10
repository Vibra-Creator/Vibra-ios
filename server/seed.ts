import { db } from "./db";
import { profiles, swipes, matches, messages, privateRooms, roomMembers, roomMessages, privateRoomRequests, privateRoomMessages, challengeSubmissions, sentGifts, users, bannedWords } from "@shared/schema";
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
  },
  {
    id: "6",
    name: "Lyria",
    age: 112,
    bio: "Cantante delle frequenze cosmiche. La mia voce può far vibrare le stelle. Cerco qualcuno che sappia ascoltare il silenzio tra le note.",
    imageUrl: "/images/profile-6.png",
    location: "Nebulosa del Cigno",
    interests: ["Musica Cosmica", "Frequenze Vibrazionali", "Telepatia Emotiva"],
    alienType: "Sonico"
  },
  {
    id: "7",
    name: "Orion",
    age: 145,
    bio: "Esploratore di galassie sconosciute. Ho mappato più di mille sistemi stellari, ma il territorio più affascinante resta il cuore.",
    imageUrl: "/images/profile-7.png",
    location: "Cintura di Orione",
    interests: ["Cartografia Stellare", "Avventura Spaziale", "Cucina Interplanetaria"],
    alienType: "Esploratore"
  },
  {
    id: "8",
    name: "Celeste",
    age: 78,
    bio: "Artista olografica e sognatrice quantica. Creo mondi con il pensiero e cerco qualcuno con cui condividere i miei sogni più luminosi.",
    imageUrl: "/images/profile-8.png",
    location: "Stazione Orbitale Artemis",
    interests: ["Arte Olografica", "Sogni Quantici", "Design Dimensionale"],
    alienType: "Onirico"
  },
  {
    id: "9",
    name: "Draco",
    age: 189,
    bio: "Guardiano delle correnti gravitazionali. Forte e silenzioso, ma con un cuore che batte alla velocità della luce per chi sa vederlo.",
    imageUrl: "/images/profile-9.png",
    location: "Vortice di Magellan",
    interests: ["Gravità Quantistica", "Arti Marziali Cosmiche", "Filosofia Stellare"],
    alienType: "Gravitazionale"
  },
  {
    id: "10",
    name: "Rosalia",
    age: 67,
    bio: "Biologa delle emozioni cosmiche. Studio come l'amore si propaga attraverso le galassie. Cerco il mio esperimento più bello.",
    imageUrl: "/images/profile-10.png",
    location: "Pianeta Empatia",
    interests: ["Biologia Emozionale", "Empatia Cosmica", "Giardinaggio Astrale"],
    alienType: "Empatico"
  },
  {
    id: "11",
    name: "Obsidian",
    age: 234,
    bio: "Antico viaggiatore dell'oscurità cosmica. Non temere le ombre - sono loro che rivelano la vera luce. Mistero è la mia seconda natura.",
    imageUrl: "/images/profile-11.png",
    location: "Buco Nero di Cygnus",
    interests: ["Materia Oscura", "Misteri Cosmici", "Poesia delle Ombre"],
    alienType: "Oscuro"
  },
  {
    id: "12",
    name: "Perla",
    age: 56,
    bio: "Tessitrice di sogni iridescenti. Ogni incontro è un arcobaleno da scoprire. Cerco anime pure che brillino della propria luce.",
    imageUrl: "/images/profile-12.png",
    location: "Anelli di Saturno",
    interests: ["Tessiture Cosmiche", "Cristalloterapia", "Danza Astrale"],
    alienType: "Iridescente"
  },
  {
    id: "13",
    name: "Vulcan",
    age: 168,
    bio: "Forgiatore di metalli stellari e cuori ardenti. Le mie mani plasmano asteroidi, ma il tocco più delicato lo riservo a chi amo.",
    imageUrl: "/images/profile-13.png",
    location: "Fornace di Antares",
    interests: ["Metallurgia Stellare", "Scultura Cosmica", "Cucina con il Plasma"],
    alienType: "Igneo"
  },
  {
    id: "14",
    name: "Luna",
    age: 91,
    bio: "Custode dei segreti lunari. Silenziosa come la notte stellata, ma piena di storie da sussurrare a chi sa ascoltare con il cuore.",
    imageUrl: "/images/profile-14.png",
    location: "Faccia Nascosta della Luna",
    interests: ["Astronomia Lunare", "Meditazione Notturna", "Scrittura Cosmica"],
    alienType: "Lunare"
  },
  {
    id: "15",
    name: "Jade",
    age: 83,
    bio: "Guaritore con il pollice verde cosmico. Le mie piante crescono con la musica delle stelle. Cerco qualcuno con cui coltivare amore.",
    imageUrl: "/images/profile-15.png",
    location: "Serra Galattica Zen",
    interests: ["Botanica Spaziale", "Guarigione Naturale", "Yoga Interstellare"],
    alienType: "Vegetale"
  },
  {
    id: "16",
    name: "Giulia",
    age: 22,
    bio: "Studentessa di architettura con la passione per i viaggi. Amo perdermi tra i vicoli delle città italiane e scoprire angoli nascosti. Cerco qualcuno con cui condividere tramonti e caffè.",
    imageUrl: "/images/profile-16.png",
    location: "Roma",
    interests: ["Architettura", "Viaggi", "Fotografia"],
    alienType: "Umanoide",
    gender: "Donna",
    preferredGender: "Uomo",
    hairColor: "Castano scuro",
    eyeColor: "Marrone",
    bodyType: "Snella",
    height: 165,
    preferredAgeMin: 22,
    preferredAgeMax: 35,
    education: "Università",
    languages: ["Italiano", "Inglese", "Spagnolo"],
    relationshipType: "Relazione seria",
    wantsChildren: "In futuro",
    zodiacSign: "Gemelli",
    loveLanguage: "Tempo di qualità",
    communicationStyle: "Aperto e diretto",
    lifestyle: "Attivo e sociale"
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
    preferredGender: "Uomo",
    hairColor: "Nero",
    eyeColor: "Verde",
    bodyType: "Media",
    height: 170,
    preferredAgeMin: 25,
    preferredAgeMax: 38,
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
    preferredGender: "Uomo",
    hairColor: "Nero",
    eyeColor: "Marrone scuro",
    bodyType: "Formosa",
    height: 168,
    preferredAgeMin: 28,
    preferredAgeMax: 42,
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
    preferredGender: "Uomo",
    hairColor: "Biondo",
    eyeColor: "Azzurro",
    bodyType: "Atletica",
    height: 172,
    preferredAgeMin: 23,
    preferredAgeMax: 34,
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
    preferredGender: "Uomo",
    hairColor: "Rosso",
    eyeColor: "Nocciola",
    bodyType: "Snella",
    height: 163,
    preferredAgeMin: 30,
    preferredAgeMax: 45,
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
    preferredGender: "Uomo",
    hairColor: "Castano chiaro",
    eyeColor: "Verde",
    bodyType: "Snella",
    height: 160,
    preferredAgeMin: 19,
    preferredAgeMax: 28,
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
    preferredGender: "Uomo",
    hairColor: "Castano scuro",
    eyeColor: "Marrone",
    bodyType: "Media",
    height: 167,
    preferredAgeMin: 26,
    preferredAgeMax: 38,
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
    preferredGender: "Uomo",
    hairColor: "Biondo miele",
    eyeColor: "Azzurro chiaro",
    bodyType: "Tonica",
    height: 169,
    preferredAgeMin: 28,
    preferredAgeMax: 42,
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
    preferredGender: "Uomo",
    hairColor: "Biondo platino",
    eyeColor: "Grigio azzurro",
    bodyType: "Snella e alta",
    height: 176,
    preferredAgeMin: 21,
    preferredAgeMax: 32,
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
    preferredGender: "Uomo",
    hairColor: "Nero riccio",
    eyeColor: "Marrone scuro",
    bodyType: "Media",
    height: 164,
    preferredAgeMin: 25,
    preferredAgeMax: 37,
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
    id: "26",
    name: "Isabella",
    age: 23,
    bio: "Sommelier in formazione e amante della vita toscana. Ogni bottiglia racconta una storia. Cerco qualcuno con cui brindare ai momenti belli e a quelli ancora da vivere.",
    imageUrl: "/images/profile-26.png",
    location: "Siena",
    interests: ["Enologia", "Gastronomia", "Arte rinascimentale"],
    alienType: "Umanoide",
    gender: "Donna",
    preferredGender: "Uomo",
    hairColor: "Castano con riflessi dorati",
    eyeColor: "Marrone caldo",
    bodyType: "Media",
    height: 166,
    preferredAgeMin: 22,
    preferredAgeMax: 34,
    education: "Diploma sommelier",
    languages: ["Italiano", "Francese", "Inglese"],
    relationshipType: "Relazione seria",
    wantsChildren: "In futuro",
    zodiacSign: "Toro",
    loveLanguage: "Tempo di qualità",
    communicationStyle: "Sensuale e raffinato",
    lifestyle: "Gourmet e conviviale"
  },
  {
    id: "27",
    name: "Daniela",
    age: 38,
    bio: "Imprenditrice nel settore moda. Ho costruito la mia carriera con determinazione ma ora voglio dedicare più tempo all'amore. Matura, indipendente, con tanto da offrire.",
    imageUrl: "/images/profile-27.png",
    location: "Milano",
    interests: ["Moda", "Business", "Ristoranti stellati"],
    alienType: "Umanoide",
    gender: "Donna",
    preferredGender: "Uomo",
    hairColor: "Biondo scuro",
    eyeColor: "Marrone",
    bodyType: "Elegante",
    height: 171,
    preferredAgeMin: 33,
    preferredAgeMax: 50,
    education: "Master",
    languages: ["Italiano", "Inglese", "Francese"],
    relationshipType: "Relazione seria",
    wantsChildren: "Non sicura",
    zodiacSign: "Capricorno",
    loveLanguage: "Atti di servizio",
    communicationStyle: "Diretto e maturo",
    lifestyle: "Lusso ed eleganza"
  },
  {
    id: "28",
    name: "Sara",
    age: 20,
    bio: "Studio scienze marine e sono innamorata del mare. Surfista, sub e amante del sole. Cerco qualcuno che ami la vita all'aria aperta e non abbia paura di bagnarsi!",
    imageUrl: "/images/profile-28.png",
    location: "Sardegna",
    interests: ["Surf", "Immersioni", "Biologia marina"],
    alienType: "Umanoide",
    gender: "Donna",
    preferredGender: "Uomo",
    hairColor: "Castano chiaro",
    eyeColor: "Nocciola",
    bodyType: "Atletica",
    height: 168,
    preferredAgeMin: 19,
    preferredAgeMax: 29,
    education: "Università in corso",
    languages: ["Italiano", "Inglese"],
    relationshipType: "Conoscersi prima",
    wantsChildren: "In futuro",
    zodiacSign: "Cancro",
    loveLanguage: "Contatto fisico",
    communicationStyle: "Solare e spontaneo",
    lifestyle: "Sportivo e naturale"
  },
  {
    id: "29",
    name: "Federica",
    age: 29,
    bio: "Personal trainer e istruttrice di crossfit. La disciplina mi ha insegnato che i risultati arrivano con costanza. Lo stesso vale per l'amore. Forte fuori, dolce dentro.",
    imageUrl: "/images/profile-29.png",
    location: "Verona",
    interests: ["Fitness", "Nutrizione", "Trekking"],
    alienType: "Umanoide",
    gender: "Donna",
    preferredGender: "Uomo",
    hairColor: "Rosso scuro",
    eyeColor: "Verde",
    bodyType: "Atletica e tonica",
    height: 174,
    preferredAgeMin: 26,
    preferredAgeMax: 38,
    education: "Laurea in Scienze motorie",
    languages: ["Italiano", "Inglese"],
    relationshipType: "Relazione seria",
    wantsChildren: "Sì",
    zodiacSign: "Ariete",
    loveLanguage: "Contatto fisico",
    communicationStyle: "Motivante e energico",
    lifestyle: "Sportivo e disciplinato"
  },
  {
    id: "30",
    name: "Beatrice",
    age: 25,
    bio: "Illustratrice e sognatrice a tempo pieno. Vivo tra matite colorate e tazze di tè. Cerco qualcuno che sappia apprezzare le piccole cose e i silenzi comodi.",
    imageUrl: "/images/profile-30.png",
    location: "Perugia",
    interests: ["Illustrazione", "Gatti", "Mercatini vintage"],
    alienType: "Umanoide",
    gender: "Donna",
    preferredGender: "Uomo",
    hairColor: "Castano scuro riccio",
    eyeColor: "Marrone scuro",
    bodyType: "Minuta",
    height: 158,
    preferredAgeMin: 23,
    preferredAgeMax: 35,
    education: "Accademia di Belle Arti",
    languages: ["Italiano", "Inglese"],
    relationshipType: "Relazione seria",
    wantsChildren: "In futuro",
    zodiacSign: "Pesci",
    loveLanguage: "Regali fatti a mano",
    communicationStyle: "Dolce e poetico",
    lifestyle: "Creativo e tranquillo"
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
    preferredGender: "Donna",
    hairColor: "Castano scuro",
    eyeColor: "Marrone",
    bodyType: "Atletico",
    height: 182,
    preferredAgeMin: 22,
    preferredAgeMax: 34,
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
    preferredGender: "Donna",
    hairColor: "Scuro ondulato",
    eyeColor: "Marrone chiaro",
    bodyType: "Medio atletico",
    height: 180,
    preferredAgeMin: 25,
    preferredAgeMax: 38,
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
    preferredGender: "Donna",
    hairColor: "Nero cortissimo",
    eyeColor: "Marrone scuro",
    bodyType: "Muscoloso",
    height: 185,
    preferredAgeMin: 20,
    preferredAgeMax: 30,
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
    bio: "Professore di letteratura e scrittore nel tempo libero. Vivo tra libri e caffè. Cerco una donna intelligente con cui condividere pensieri, passeggiate e tramonti.",
    imageUrl: "/images/profile-34.png",
    location: "Bologna",
    interests: ["Letteratura", "Scrittura", "Jazz"],
    alienType: "Umanoide",
    gender: "Uomo",
    preferredGender: "Donna",
    hairColor: "Castano con grigio alle tempie",
    eyeColor: "Grigio azzurro",
    bodyType: "Medio",
    height: 178,
    preferredAgeMin: 27,
    preferredAgeMax: 40,
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
    bio: "Musicista e producer. Suono la chitarra e produco beat nel mio piccolo studio. La musica unisce le persone e spero di trovare qualcuna con cui creare armonia.",
    imageUrl: "/images/profile-35.png",
    location: "Torino",
    interests: ["Musica", "Concerti", "Skate"],
    alienType: "Umanoide",
    gender: "Uomo",
    preferredGender: "Donna",
    hairColor: "Castano riccio",
    eyeColor: "Verde",
    bodyType: "Snello",
    height: 175,
    preferredAgeMin: 19,
    preferredAgeMax: 28,
    education: "Conservatorio in corso",
    languages: ["Italiano", "Inglese"],
    relationshipType: "Conoscersi prima",
    wantsChildren: "Non ancora",
    zodiacSign: "Acquario",
    loveLanguage: "Tempo di qualità",
    communicationStyle: "Creativo e spontaneo",
    lifestyle: "Artistico e alternativo"
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


const botAccountCredentials = [
  { profileId: "16", email: "giulia@vibra.app", password: "Vibra2024!", firstName: "Giulia", lastName: "Romani" },
  { profileId: "17", email: "martina@vibra.app", password: "Vibra2024!", firstName: "Martina", lastName: "Bianchi" },
  { profileId: "18", email: "valentina@vibra.app", password: "Vibra2024!", firstName: "Valentina", lastName: "Esposito" },
  { profileId: "19", email: "sofia@vibra.app", password: "Vibra2024!", firstName: "Sofia", lastName: "Moretti" },
  { profileId: "20", email: "alessia@vibra.app", password: "Vibra2024!", firstName: "Alessia", lastName: "Colombo" },
  { profileId: "21", email: "chiara@vibra.app", password: "Vibra2024!", firstName: "Chiara", lastName: "Ricci" },
  { profileId: "22", email: "francesca@vibra.app", password: "Vibra2024!", firstName: "Francesca", lastName: "Marino" },
  { profileId: "23", email: "elena@vibra.app", password: "Vibra2024!", firstName: "Elena", lastName: "Greco" },
  { profileId: "24", email: "aurora.r@vibra.app", password: "Vibra2024!", firstName: "Aurora", lastName: "Rossi" },
  { profileId: "25", email: "serena@vibra.app", password: "Vibra2024!", firstName: "Serena", lastName: "Conti" },
  { profileId: "26", email: "isabella@vibra.app", password: "Vibra2024!", firstName: "Isabella", lastName: "Galli" },
  { profileId: "27", email: "daniela@vibra.app", password: "Vibra2024!", firstName: "Daniela", lastName: "Ferrari" },
  { profileId: "28", email: "sara@vibra.app", password: "Vibra2024!", firstName: "Sara", lastName: "Mura" },
  { profileId: "29", email: "federica@vibra.app", password: "Vibra2024!", firstName: "Federica", lastName: "Zanetti" },
  { profileId: "30", email: "beatrice@vibra.app", password: "Vibra2024!", firstName: "Beatrice", lastName: "Pellegrini" },
  { profileId: "31", email: "marco@vibra.app", password: "Vibra2024!", firstName: "Marco", lastName: "De Luca" },
  { profileId: "32", email: "luca@vibra.app", password: "Vibra2024!", firstName: "Luca", lastName: "Barbieri" },
  { profileId: "33", email: "alessandro@vibra.app", password: "Vibra2024!", firstName: "Alessandro", lastName: "Vitale" },
  { profileId: "34", email: "andrea@vibra.app", password: "Vibra2024!", firstName: "Andrea", lastName: "Marchetti" },
  { profileId: "35", email: "tommaso@vibra.app", password: "Vibra2024!", firstName: "Tommaso", lastName: "Ferrara" },
];

async function createBotUserAccounts() {
  for (const bot of botAccountCredentials) {
    try {
      const [existingUser] = await db.select().from(users).where(eq(users.email, bot.email));
      if (existingUser) {
        const [profile] = await db.select().from(profiles).where(eq(profiles.id, bot.profileId));
        if (profile && !profile.userId) {
          await db.update(profiles).set({ userId: existingUser.id }).where(eq(profiles.id, bot.profileId));
        }
        continue;
      }
      const userId = `bot-user-${bot.profileId}`;
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
    const existingIds = new Set(existingProfiles.map(p => p.id));
    
    const missingProfiles = seedProfiles.filter(p => !existingIds.has(p.id));
    
    if (missingProfiles.length > 0) {
      console.log(`Seeding ${missingProfiles.length} new bot profiles...`);
      for (const profile of missingProfiles) {
        await db.insert(profiles).values({ ...profile, isBot: true, points: 50 });
      }
      console.log("Bot profiles seeded successfully!");
    } else {
      console.log("All bot profiles already exist, skipping seed.");
    }
    
    if (existingProfiles.length === 0) {
      for (const swipe of seedSwipesToCreateMatch) {
        await db.insert(swipes).values(swipe);
      }
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

    await createBotUserAccounts();
    await ensureAdminAccount();
    await promoteUserToAdmin("famax61@yahoo.com");
    await cleanupTestData();
  } catch (error) {
    console.error("Error seeding database:", error);
  }
}

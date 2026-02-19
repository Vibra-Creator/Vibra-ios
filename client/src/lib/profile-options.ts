export const genderOptions = [
  "Uomo",
  "Donna",
  "Non-binario",
  "Altro",
  "Preferisco non rispondere",
];

export const preferredGenderOptions = [
  "Uomo",
  "Donna",
  "Non-binario",
  "Entrambi",
  "Indifferente",
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
  "Preferisco non rispondere",
];

export const eyeColorOptions = [
  "Marroni",
  "Azzurri",
  "Verdi",
  "Grigi",
  "Nocciola",
  "Neri",
  "Preferisco non rispondere",
];

export const bodyTypeOptions = [
  "Magro",
  "Atletico",
  "Medio",
  "Robusto",
  "Curvy",
  "Preferisco non rispondere",
];

export const educationOptions = [
  "Licenza media",
  "Diploma",
  "Laurea triennale",
  "Laurea magistrale",
  "Dottorato",
  "Altro",
  "Preferisco non rispondere",
];

export const preferredEducationOptions = [
  "Licenza media",
  "Diploma",
  "Laurea triennale",
  "Laurea magistrale",
  "Dottorato",
  "Indifferente",
];

export const relationshipTypeOptions = [
  "Relazione seria",
  "Amicizia",
  "Qualcosa di casual",
  "Non lo so ancora",
  "Preferisco non rispondere",
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
  "Preferisco non rispondere",
];

export const loveLanguageOptions = [
  "Parole di affermazione",
  "Tempo di qualità",
  "Ricevere regali",
  "Atti di servizio",
  "Contatto fisico",
  "Preferisco non rispondere",
];

export const communicationStyleOptions = [
  "Messaggi vocali",
  "Messaggi di testo",
  "Chiamate",
  "Videochiamate",
  "Di persona",
  "Preferisco non rispondere",
];

export const lifestyleOptions = [
  "Attivo/Sportivo",
  "Casalingo",
  "Sociale/Festaiolo",
  "Avventuroso",
  "Tranquillo",
  "Workaholic",
  "Preferisco non rispondere",
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
  "/images/avatar-1.png",
  "/images/avatar-2.png",
  "/images/avatar-3.png",
  "/images/avatar-4.png",
  "/images/avatar-5.png",
];

export interface CityOption {
  nome: string;
  provincia: string;
  regione: string;
  lat: number;
  lng: number;
}

export const italianCities: CityOption[] = [
  { nome: "Agrigento", provincia: "AG", regione: "Sicilia", lat: 37.31, lng: 13.58 },
  { nome: "Alessandria", provincia: "AL", regione: "Piemonte", lat: 44.91, lng: 8.62 },
  { nome: "Ancona", provincia: "AN", regione: "Marche", lat: 43.62, lng: 13.51 },
  { nome: "Aosta", provincia: "AO", regione: "Valle d'Aosta", lat: 45.74, lng: 7.32 },
  { nome: "Arezzo", provincia: "AR", regione: "Toscana", lat: 43.46, lng: 11.88 },
  { nome: "Ascoli Piceno", provincia: "AP", regione: "Marche", lat: 42.85, lng: 13.57 },
  { nome: "Asti", provincia: "AT", regione: "Piemonte", lat: 44.90, lng: 8.21 },
  { nome: "Avellino", provincia: "AV", regione: "Campania", lat: 40.91, lng: 14.79 },
  { nome: "Bari", provincia: "BA", regione: "Puglia", lat: 41.12, lng: 16.87 },
  { nome: "Barletta-Andria-Trani", provincia: "BT", regione: "Puglia", lat: 41.32, lng: 16.28 },
  { nome: "Belluno", provincia: "BL", regione: "Veneto", lat: 46.14, lng: 12.22 },
  { nome: "Benevento", provincia: "BN", regione: "Campania", lat: 41.13, lng: 14.78 },
  { nome: "Bergamo", provincia: "BG", regione: "Lombardia", lat: 45.70, lng: 9.67 },
  { nome: "Biella", provincia: "BI", regione: "Piemonte", lat: 45.56, lng: 8.05 },
  { nome: "Bologna", provincia: "BO", regione: "Emilia-Romagna", lat: 44.49, lng: 11.34 },
  { nome: "Bolzano", provincia: "BZ", regione: "Trentino-Alto Adige", lat: 46.50, lng: 11.35 },
  { nome: "Brescia", provincia: "BS", regione: "Lombardia", lat: 45.54, lng: 10.21 },
  { nome: "Brindisi", provincia: "BR", regione: "Puglia", lat: 40.63, lng: 17.94 },
  { nome: "Cagliari", provincia: "CA", regione: "Sardegna", lat: 39.22, lng: 9.12 },
  { nome: "Caltanissetta", provincia: "CL", regione: "Sicilia", lat: 37.49, lng: 14.06 },
  { nome: "Campobasso", provincia: "CB", regione: "Molise", lat: 41.56, lng: 14.66 },
  { nome: "Caserta", provincia: "CE", regione: "Campania", lat: 41.08, lng: 14.33 },
  { nome: "Catania", provincia: "CT", regione: "Sicilia", lat: 37.50, lng: 15.09 },
  { nome: "Catanzaro", provincia: "CZ", regione: "Calabria", lat: 38.91, lng: 16.59 },
  { nome: "Chieti", provincia: "CH", regione: "Abruzzo", lat: 42.35, lng: 14.17 },
  { nome: "Como", provincia: "CO", regione: "Lombardia", lat: 45.81, lng: 9.08 },
  { nome: "Cosenza", provincia: "CS", regione: "Calabria", lat: 39.30, lng: 16.25 },
  { nome: "Cremona", provincia: "CR", regione: "Lombardia", lat: 45.13, lng: 10.02 },
  { nome: "Crotone", provincia: "KR", regione: "Calabria", lat: 39.08, lng: 17.12 },
  { nome: "Cuneo", provincia: "CN", regione: "Piemonte", lat: 44.39, lng: 7.55 },
  { nome: "Enna", provincia: "EN", regione: "Sicilia", lat: 37.57, lng: 14.28 },
  { nome: "Fermo", provincia: "FM", regione: "Marche", lat: 43.16, lng: 13.72 },
  { nome: "Ferrara", provincia: "FE", regione: "Emilia-Romagna", lat: 44.84, lng: 11.62 },
  { nome: "Firenze", provincia: "FI", regione: "Toscana", lat: 43.77, lng: 11.25 },
  { nome: "Foggia", provincia: "FG", regione: "Puglia", lat: 41.46, lng: 15.54 },
  { nome: "Forli-Cesena", provincia: "FC", regione: "Emilia-Romagna", lat: 44.22, lng: 12.04 },
  { nome: "Frosinone", provincia: "FR", regione: "Lazio", lat: 41.64, lng: 13.35 },
  { nome: "Genova", provincia: "GE", regione: "Liguria", lat: 44.41, lng: 8.93 },
  { nome: "Gorizia", provincia: "GO", regione: "Friuli-Venezia Giulia", lat: 45.94, lng: 13.62 },
  { nome: "Grosseto", provincia: "GR", regione: "Toscana", lat: 42.76, lng: 11.11 },
  { nome: "Imperia", provincia: "IM", regione: "Liguria", lat: 43.89, lng: 8.03 },
  { nome: "Isernia", provincia: "IS", regione: "Molise", lat: 41.59, lng: 14.23 },
  { nome: "L'Aquila", provincia: "AQ", regione: "Abruzzo", lat: 42.35, lng: 13.40 },
  { nome: "La Spezia", provincia: "SP", regione: "Liguria", lat: 44.10, lng: 9.82 },
  { nome: "Latina", provincia: "LT", regione: "Lazio", lat: 41.47, lng: 12.90 },
  { nome: "Lecce", provincia: "LE", regione: "Puglia", lat: 40.35, lng: 18.17 },
  { nome: "Lecco", provincia: "LC", regione: "Lombardia", lat: 45.86, lng: 9.39 },
  { nome: "Livorno", provincia: "LI", regione: "Toscana", lat: 43.55, lng: 10.31 },
  { nome: "Lodi", provincia: "LO", regione: "Lombardia", lat: 45.31, lng: 9.50 },
  { nome: "Lucca", provincia: "LU", regione: "Toscana", lat: 43.84, lng: 10.51 },
  { nome: "Macerata", provincia: "MC", regione: "Marche", lat: 43.30, lng: 13.45 },
  { nome: "Mantova", provincia: "MN", regione: "Lombardia", lat: 45.16, lng: 10.79 },
  { nome: "Massa-Carrara", provincia: "MS", regione: "Toscana", lat: 44.04, lng: 10.14 },
  { nome: "Matera", provincia: "MT", regione: "Basilicata", lat: 40.67, lng: 16.60 },
  { nome: "Messina", provincia: "ME", regione: "Sicilia", lat: 38.19, lng: 15.55 },
  { nome: "Milano", provincia: "MI", regione: "Lombardia", lat: 45.46, lng: 9.19 },
  { nome: "Modena", provincia: "MO", regione: "Emilia-Romagna", lat: 44.65, lng: 10.92 },
  { nome: "Monza e Brianza", provincia: "MB", regione: "Lombardia", lat: 45.58, lng: 9.27 },
  { nome: "Napoli", provincia: "NA", regione: "Campania", lat: 40.85, lng: 14.27 },
  { nome: "Novara", provincia: "NO", regione: "Piemonte", lat: 45.45, lng: 8.62 },
  { nome: "Nuoro", provincia: "NU", regione: "Sardegna", lat: 40.32, lng: 9.33 },
  { nome: "Oristano", provincia: "OR", regione: "Sardegna", lat: 39.91, lng: 8.59 },
  { nome: "Padova", provincia: "PD", regione: "Veneto", lat: 45.41, lng: 11.88 },
  { nome: "Palermo", provincia: "PA", regione: "Sicilia", lat: 38.12, lng: 13.36 },
  { nome: "Parma", provincia: "PR", regione: "Emilia-Romagna", lat: 44.80, lng: 10.33 },
  { nome: "Pavia", provincia: "PV", regione: "Lombardia", lat: 45.18, lng: 9.16 },
  { nome: "Perugia", provincia: "PG", regione: "Umbria", lat: 43.11, lng: 12.39 },
  { nome: "Pesaro-Urbino", provincia: "PU", regione: "Marche", lat: 43.91, lng: 12.91 },
  { nome: "Pescara", provincia: "PE", regione: "Abruzzo", lat: 42.46, lng: 14.21 },
  { nome: "Piacenza", provincia: "PC", regione: "Emilia-Romagna", lat: 45.05, lng: 9.69 },
  { nome: "Pisa", provincia: "PI", regione: "Toscana", lat: 43.72, lng: 10.40 },
  { nome: "Pistoia", provincia: "PT", regione: "Toscana", lat: 43.93, lng: 10.92 },
  { nome: "Pordenone", provincia: "PN", regione: "Friuli-Venezia Giulia", lat: 45.96, lng: 12.66 },
  { nome: "Potenza", provincia: "PZ", regione: "Basilicata", lat: 40.64, lng: 15.80 },
  { nome: "Prato", provincia: "PO", regione: "Toscana", lat: 43.88, lng: 11.10 },
  { nome: "Ragusa", provincia: "RG", regione: "Sicilia", lat: 36.93, lng: 14.73 },
  { nome: "Ravenna", provincia: "RA", regione: "Emilia-Romagna", lat: 44.42, lng: 12.20 },
  { nome: "Reggio Calabria", provincia: "RC", regione: "Calabria", lat: 38.11, lng: 15.65 },
  { nome: "Reggio Emilia", provincia: "RE", regione: "Emilia-Romagna", lat: 44.70, lng: 10.63 },
  { nome: "Rieti", provincia: "RI", regione: "Lazio", lat: 42.40, lng: 12.86 },
  { nome: "Rimini", provincia: "RN", regione: "Emilia-Romagna", lat: 44.06, lng: 12.57 },
  { nome: "Roma", provincia: "RM", regione: "Lazio", lat: 41.90, lng: 12.50 },
  { nome: "Rovigo", provincia: "RO", regione: "Veneto", lat: 45.07, lng: 11.79 },
  { nome: "Salerno", provincia: "SA", regione: "Campania", lat: 40.68, lng: 14.77 },
  { nome: "Sassari", provincia: "SS", regione: "Sardegna", lat: 40.73, lng: 8.56 },
  { nome: "Savona", provincia: "SV", regione: "Liguria", lat: 44.31, lng: 8.48 },
  { nome: "Siena", provincia: "SI", regione: "Toscana", lat: 43.32, lng: 11.33 },
  { nome: "Siracusa", provincia: "SR", regione: "Sicilia", lat: 37.07, lng: 15.29 },
  { nome: "Sondrio", provincia: "SO", regione: "Lombardia", lat: 46.17, lng: 9.87 },
  { nome: "Sud Sardegna", provincia: "SU", regione: "Sardegna", lat: 39.37, lng: 8.53 },
  { nome: "Taranto", provincia: "TA", regione: "Puglia", lat: 40.47, lng: 17.24 },
  { nome: "Teramo", provincia: "TE", regione: "Abruzzo", lat: 42.66, lng: 13.70 },
  { nome: "Terni", provincia: "TR", regione: "Umbria", lat: 42.56, lng: 12.64 },
  { nome: "Torino", provincia: "TO", regione: "Piemonte", lat: 45.07, lng: 7.69 },
  { nome: "Trapani", provincia: "TP", regione: "Sicilia", lat: 38.02, lng: 12.51 },
  { nome: "Trento", provincia: "TN", regione: "Trentino-Alto Adige", lat: 46.07, lng: 11.12 },
  { nome: "Treviso", provincia: "TV", regione: "Veneto", lat: 45.67, lng: 12.24 },
  { nome: "Trieste", provincia: "TS", regione: "Friuli-Venezia Giulia", lat: 45.65, lng: 13.78 },
  { nome: "Udine", provincia: "UD", regione: "Friuli-Venezia Giulia", lat: 46.06, lng: 13.24 },
  { nome: "Varese", provincia: "VA", regione: "Lombardia", lat: 45.82, lng: 8.83 },
  { nome: "Venezia", provincia: "VE", regione: "Veneto", lat: 45.44, lng: 12.32 },
  { nome: "Verbano-Cusio-Ossola", provincia: "VB", regione: "Piemonte", lat: 45.92, lng: 8.55 },
  { nome: "Vercelli", provincia: "VC", regione: "Piemonte", lat: 45.32, lng: 8.42 },
  { nome: "Verona", provincia: "VR", regione: "Veneto", lat: 45.44, lng: 10.99 },
  { nome: "Vibo Valentia", provincia: "VV", regione: "Calabria", lat: 38.68, lng: 16.10 },
  { nome: "Vicenza", provincia: "VI", regione: "Veneto", lat: 45.55, lng: 11.55 },
  { nome: "Viterbo", provincia: "VT", regione: "Lazio", lat: 42.42, lng: 12.11 },
];

export interface PhonePrefixOption {
  codice: string;
  paese: string;
}

export const phonePrefixes: PhonePrefixOption[] = [
  { codice: "+39", paese: "Italia" },
  { codice: "+33", paese: "Francia" },
  { codice: "+49", paese: "Germania" },
  { codice: "+44", paese: "Regno Unito" },
  { codice: "+34", paese: "Spagna" },
  { codice: "+1", paese: "Stati Uniti / Canada" },
  { codice: "+41", paese: "Svizzera" },
  { codice: "+43", paese: "Austria" },
  { codice: "+351", paese: "Portogallo" },
  { codice: "+40", paese: "Romania" },
  { codice: "+36", paese: "Ungheria" },
  { codice: "+90", paese: "Turchia" },
  { codice: "+7", paese: "Russia" },
  { codice: "+81", paese: "Giappone" },
  { codice: "+82", paese: "Corea del Sud" },
  { codice: "+86", paese: "Cina" },
  { codice: "+91", paese: "India" },
  { codice: "+61", paese: "Australia" },
  { codice: "+64", paese: "Nuova Zelanda" },
  { codice: "+55", paese: "Brasile" },
  { codice: "+52", paese: "Messico" },
  { codice: "+27", paese: "Sudafrica" },
];

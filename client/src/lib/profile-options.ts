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
  "/images/profile-1.png",
  "/images/profile-2.png",
  "/images/profile-3.png",
  "/images/profile-4.png",
  "/images/profile-5.png",
];

export interface CityOption {
  nome: string;
  provincia: string;
  regione: string;
}

export const italianCities: CityOption[] = [
  { nome: "Agrigento", provincia: "AG", regione: "Sicilia" },
  { nome: "Alessandria", provincia: "AL", regione: "Piemonte" },
  { nome: "Ancona", provincia: "AN", regione: "Marche" },
  { nome: "Aosta", provincia: "AO", regione: "Valle d'Aosta" },
  { nome: "Arezzo", provincia: "AR", regione: "Toscana" },
  { nome: "Ascoli Piceno", provincia: "AP", regione: "Marche" },
  { nome: "Asti", provincia: "AT", regione: "Piemonte" },
  { nome: "Avellino", provincia: "AV", regione: "Campania" },
  { nome: "Bari", provincia: "BA", regione: "Puglia" },
  { nome: "Barletta-Andria-Trani", provincia: "BT", regione: "Puglia" },
  { nome: "Belluno", provincia: "BL", regione: "Veneto" },
  { nome: "Benevento", provincia: "BN", regione: "Campania" },
  { nome: "Bergamo", provincia: "BG", regione: "Lombardia" },
  { nome: "Biella", provincia: "BI", regione: "Piemonte" },
  { nome: "Bologna", provincia: "BO", regione: "Emilia-Romagna" },
  { nome: "Bolzano", provincia: "BZ", regione: "Trentino-Alto Adige" },
  { nome: "Brescia", provincia: "BS", regione: "Lombardia" },
  { nome: "Brindisi", provincia: "BR", regione: "Puglia" },
  { nome: "Cagliari", provincia: "CA", regione: "Sardegna" },
  { nome: "Caltanissetta", provincia: "CL", regione: "Sicilia" },
  { nome: "Campobasso", provincia: "CB", regione: "Molise" },
  { nome: "Caserta", provincia: "CE", regione: "Campania" },
  { nome: "Catania", provincia: "CT", regione: "Sicilia" },
  { nome: "Catanzaro", provincia: "CZ", regione: "Calabria" },
  { nome: "Chieti", provincia: "CH", regione: "Abruzzo" },
  { nome: "Como", provincia: "CO", regione: "Lombardia" },
  { nome: "Cosenza", provincia: "CS", regione: "Calabria" },
  { nome: "Cremona", provincia: "CR", regione: "Lombardia" },
  { nome: "Crotone", provincia: "KR", regione: "Calabria" },
  { nome: "Cuneo", provincia: "CN", regione: "Piemonte" },
  { nome: "Enna", provincia: "EN", regione: "Sicilia" },
  { nome: "Fermo", provincia: "FM", regione: "Marche" },
  { nome: "Ferrara", provincia: "FE", regione: "Emilia-Romagna" },
  { nome: "Firenze", provincia: "FI", regione: "Toscana" },
  { nome: "Foggia", provincia: "FG", regione: "Puglia" },
  { nome: "Forli-Cesena", provincia: "FC", regione: "Emilia-Romagna" },
  { nome: "Frosinone", provincia: "FR", regione: "Lazio" },
  { nome: "Genova", provincia: "GE", regione: "Liguria" },
  { nome: "Gorizia", provincia: "GO", regione: "Friuli-Venezia Giulia" },
  { nome: "Grosseto", provincia: "GR", regione: "Toscana" },
  { nome: "Imperia", provincia: "IM", regione: "Liguria" },
  { nome: "Isernia", provincia: "IS", regione: "Molise" },
  { nome: "L'Aquila", provincia: "AQ", regione: "Abruzzo" },
  { nome: "La Spezia", provincia: "SP", regione: "Liguria" },
  { nome: "Latina", provincia: "LT", regione: "Lazio" },
  { nome: "Lecce", provincia: "LE", regione: "Puglia" },
  { nome: "Lecco", provincia: "LC", regione: "Lombardia" },
  { nome: "Livorno", provincia: "LI", regione: "Toscana" },
  { nome: "Lodi", provincia: "LO", regione: "Lombardia" },
  { nome: "Lucca", provincia: "LU", regione: "Toscana" },
  { nome: "Macerata", provincia: "MC", regione: "Marche" },
  { nome: "Mantova", provincia: "MN", regione: "Lombardia" },
  { nome: "Massa-Carrara", provincia: "MS", regione: "Toscana" },
  { nome: "Matera", provincia: "MT", regione: "Basilicata" },
  { nome: "Messina", provincia: "ME", regione: "Sicilia" },
  { nome: "Milano", provincia: "MI", regione: "Lombardia" },
  { nome: "Modena", provincia: "MO", regione: "Emilia-Romagna" },
  { nome: "Monza", provincia: "MB", regione: "Lombardia" },
  { nome: "Napoli", provincia: "NA", regione: "Campania" },
  { nome: "Novara", provincia: "NO", regione: "Piemonte" },
  { nome: "Nuoro", provincia: "NU", regione: "Sardegna" },
  { nome: "Oristano", provincia: "OR", regione: "Sardegna" },
  { nome: "Padova", provincia: "PD", regione: "Veneto" },
  { nome: "Palermo", provincia: "PA", regione: "Sicilia" },
  { nome: "Parma", provincia: "PR", regione: "Emilia-Romagna" },
  { nome: "Pavia", provincia: "PV", regione: "Lombardia" },
  { nome: "Perugia", provincia: "PG", regione: "Umbria" },
  { nome: "Pesaro-Urbino", provincia: "PU", regione: "Marche" },
  { nome: "Pescara", provincia: "PE", regione: "Abruzzo" },
  { nome: "Piacenza", provincia: "PC", regione: "Emilia-Romagna" },
  { nome: "Pisa", provincia: "PI", regione: "Toscana" },
  { nome: "Pistoia", provincia: "PT", regione: "Toscana" },
  { nome: "Pordenone", provincia: "PN", regione: "Friuli-Venezia Giulia" },
  { nome: "Potenza", provincia: "PZ", regione: "Basilicata" },
  { nome: "Prato", provincia: "PO", regione: "Toscana" },
  { nome: "Ragusa", provincia: "RG", regione: "Sicilia" },
  { nome: "Ravenna", provincia: "RA", regione: "Emilia-Romagna" },
  { nome: "Reggio Calabria", provincia: "RC", regione: "Calabria" },
  { nome: "Reggio Emilia", provincia: "RE", regione: "Emilia-Romagna" },
  { nome: "Rieti", provincia: "RI", regione: "Lazio" },
  { nome: "Rimini", provincia: "RN", regione: "Emilia-Romagna" },
  { nome: "Roma", provincia: "RM", regione: "Lazio" },
  { nome: "Rovigo", provincia: "RO", regione: "Veneto" },
  { nome: "Salerno", provincia: "SA", regione: "Campania" },
  { nome: "Sassari", provincia: "SS", regione: "Sardegna" },
  { nome: "Savona", provincia: "SV", regione: "Liguria" },
  { nome: "Siena", provincia: "SI", regione: "Toscana" },
  { nome: "Siracusa", provincia: "SR", regione: "Sicilia" },
  { nome: "Sondrio", provincia: "SO", regione: "Lombardia" },
  { nome: "Taranto", provincia: "TA", regione: "Puglia" },
  { nome: "Teramo", provincia: "TE", regione: "Abruzzo" },
  { nome: "Terni", provincia: "TR", regione: "Umbria" },
  { nome: "Torino", provincia: "TO", regione: "Piemonte" },
  { nome: "Trapani", provincia: "TP", regione: "Sicilia" },
  { nome: "Trento", provincia: "TN", regione: "Trentino-Alto Adige" },
  { nome: "Treviso", provincia: "TV", regione: "Veneto" },
  { nome: "Trieste", provincia: "TS", regione: "Friuli-Venezia Giulia" },
  { nome: "Udine", provincia: "UD", regione: "Friuli-Venezia Giulia" },
  { nome: "Varese", provincia: "VA", regione: "Lombardia" },
  { nome: "Venezia", provincia: "VE", regione: "Veneto" },
  { nome: "Verbania", provincia: "VB", regione: "Piemonte" },
  { nome: "Vercelli", provincia: "VC", regione: "Piemonte" },
  { nome: "Verona", provincia: "VR", regione: "Veneto" },
  { nome: "Vibo Valentia", provincia: "VV", regione: "Calabria" },
  { nome: "Vicenza", provincia: "VI", regione: "Veneto" },
  { nome: "Viterbo", provincia: "VT", regione: "Lazio" },
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

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
    id: "17", name: "Martina", age: 26,
    bio: "Commessa in un negozio di abbigliamento a Milano. Adoro la moda ma anche cucinare per gli amici il sabato sera. Cerco qualcuno che sappia farmi ridere.",
    imageUrl: "/images/bots/bot17_main.jpg", photos: ["/images/bots/bot17_extra1.jpg", "/images/bots/bot17_extra2.jpg"],
    location: "Milano", interests: ["Moda", "Cucina", "Shopping"], alienType: "Cristallino",
    gender: "Donna", preferredGender: "Tutti", hairColor: "Nero", eyeColor: "Verde",
    bodyType: "Media", height: 170, preferredAgeMin: 18, preferredAgeMax: 99,
    education: "Diploma", languages: ["Italiano", "Inglese"],
    relationshipType: "Relazione seria", wantsChildren: "Sì", zodiacSign: "Bilancia",
    loveLanguage: "Parole di affermazione", communicationStyle: "Creativo e spontaneo", lifestyle: "Urbano e dinamico"
  },
  {
    id: "18", name: "Valentina", age: 30,
    bio: "Barista in una caffetteria artigianale. Amo preparare cappuccini con disegni e chiacchierare con i clienti. Cerco una persona sincera e con i piedi per terra.",
    imageUrl: "/images/bots/bot18_main.jpg", photos: ["/images/bots/bot18_extra1.jpg", "/images/bots/bot18_extra2.jpg"],
    location: "Napoli", interests: ["Caffè", "Mare", "Cinema"], alienType: "Nebulare",
    gender: "Donna", preferredGender: "Tutti", hairColor: "Nero", eyeColor: "Marrone scuro",
    bodyType: "Formosa", height: 168, preferredAgeMin: 18, preferredAgeMax: 99,
    education: "Diploma", languages: ["Italiano"],
    relationshipType: "Relazione seria", wantsChildren: "Sì", zodiacSign: "Scorpione",
    loveLanguage: "Atti di servizio", communicationStyle: "Riflessivo e profondo", lifestyle: "Equilibrato"
  },
  {
    id: "19", name: "Matteo", age: 26,
    bio: "Studente di infermieristica. Amo gli animali e fare trekking nel weekend. Cerco una persona genuina con cui costruire qualcosa di bello.",
    imageUrl: "/images/bots/bot19_main.jpg", photos: ["/images/bots/bot19_extra1.jpg", "/images/bots/bot19_extra2.jpg"],
    location: "Trento", interests: ["Animali", "Montagna", "Yoga"], alienType: "Biotico",
    gender: "Uomo", preferredGender: "Tutti", hairColor: "Castano", eyeColor: "Azzurro",
    bodyType: "Atletico", height: 180, preferredAgeMin: 18, preferredAgeMax: 99,
    education: "Università", languages: ["Italiano", "Inglese"],
    relationshipType: "Relazione seria", wantsChildren: "In futuro", zodiacSign: "Cancro",
    loveLanguage: "Tempo di qualità", communicationStyle: "Aperto e diretto", lifestyle: "Attivo e sociale"
  },
  {
    id: "20", name: "Alessia", age: 28,
    bio: "Lavoro come parrucchiera e adoro il mio lavoro. Mi piace trasformare le persone e farle sentire belle. Nel weekend amo andare a ballare.",
    imageUrl: "/images/bots/bot20_main.jpg", photos: ["/images/bots/bot20_extra1.jpg", "/images/bots/bot20_extra2.jpg"],
    location: "Firenze", interests: ["Ballo", "Musica", "Benessere"], alienType: "Dimensionale",
    gender: "Donna", preferredGender: "Tutti", hairColor: "Rosso", eyeColor: "Nocciola",
    bodyType: "Media", height: 163, preferredAgeMin: 18, preferredAgeMax: 99,
    education: "Diploma professionale", languages: ["Italiano"],
    relationshipType: "Conoscersi prima", wantsChildren: "In futuro", zodiacSign: "Leone",
    loveLanguage: "Contatto fisico", communicationStyle: "Creativo e spontaneo", lifestyle: "Attivo e sociale"
  },
  {
    id: "21", name: "Chiara", age: 25,
    bio: "Impiegata in uno studio commercialista. Sembro seria ma in realtà sono una che ride sempre. Amo cucinare la domenica e guardare serie TV la sera.",
    imageUrl: "/images/bots/bot21_main.jpg", photos: ["/images/bots/bot21_extra1.jpg", "/images/bots/bot21_extra2.jpg"],
    location: "Bologna", interests: ["Serie TV", "Cucina", "Pilates"], alienType: "Solare",
    gender: "Donna", preferredGender: "Tutti", hairColor: "Castano", eyeColor: "Marrone",
    bodyType: "Snella", height: 160, preferredAgeMin: 18, preferredAgeMax: 99,
    education: "Laurea", languages: ["Italiano", "Inglese"],
    relationshipType: "Relazione seria", wantsChildren: "Sì", zodiacSign: "Vergine",
    loveLanguage: "Atti di servizio", communicationStyle: "Aperto e diretto", lifestyle: "Equilibrato"
  },
  {
    id: "22", name: "Francesca", age: 31,
    bio: "Cassiera al supermercato, mamma di un bimbo di 3 anni. Cerco una persona matura e comprensiva. Mi piace la semplicità e le cose genuine.",
    imageUrl: "/images/bots/bot22_main.jpg", photos: ["/images/bots/bot22_extra1.jpg", "/images/bots/bot22_extra2.jpg"],
    location: "Torino", interests: ["Famiglia", "Cucina", "Giardinaggio"], alienType: "Etereo",
    gender: "Donna", preferredGender: "Tutti", hairColor: "Biondo scuro", eyeColor: "Grigio",
    bodyType: "Media", height: 167, preferredAgeMin: 18, preferredAgeMax: 99,
    education: "Diploma", languages: ["Italiano"],
    relationshipType: "Relazione seria", wantsChildren: "Ho già figli", zodiacSign: "Toro",
    loveLanguage: "Atti di servizio", communicationStyle: "Riflessivo e profondo", lifestyle: "Tranquillo e casalingo"
  },
  {
    id: "23", name: "Elena", age: 27,
    bio: "Cuoca in una trattoria. La mia passione è sperimentare ricette nuove. Amo viaggiare per scoprire sapori diversi. Cerco un compagno di avventure gastronomiche!",
    imageUrl: "/images/bots/bot23_main.jpg", photos: ["/images/bots/bot23_extra1.jpg", "/images/bots/bot23_extra2.jpg"],
    location: "Genova", interests: ["Cucina", "Viaggi", "Fotografia"], alienType: "Cristallino",
    gender: "Donna", preferredGender: "Tutti", hairColor: "Castano chiaro", eyeColor: "Verde",
    bodyType: "Media", height: 164, preferredAgeMin: 18, preferredAgeMax: 99,
    education: "Scuola alberghiera", languages: ["Italiano", "Spagnolo"],
    relationshipType: "Conoscersi prima", wantsChildren: "In futuro", zodiacSign: "Sagittario",
    loveLanguage: "Regali", communicationStyle: "Creativo e spontaneo", lifestyle: "Attivo e sociale"
  },
  {
    id: "24", name: "Aurora", age: 23,
    bio: "Receptionist in un hotel. Mi piace conoscere persone nuove ogni giorno. Amo la spiaggia, i cocktail e le serate con le amiche.",
    imageUrl: "/images/bots/bot24_main.jpg", photos: ["/images/bots/bot24_extra1.jpg", "/images/bots/bot24_extra2.jpg"],
    location: "Palermo", interests: ["Viaggi", "Mare", "Aperitivo"], alienType: "Solare",
    gender: "Donna", preferredGender: "Tutti", hairColor: "Nero", eyeColor: "Marrone",
    bodyType: "Snella", height: 169, preferredAgeMin: 18, preferredAgeMax: 99,
    education: "Diploma", languages: ["Italiano", "Inglese", "Francese"],
    relationshipType: "Conoscersi prima", wantsChildren: "Non lo so", zodiacSign: "Acquario",
    loveLanguage: "Tempo di qualità", communicationStyle: "Aperto e diretto", lifestyle: "Attivo e sociale"
  },
  {
    id: "25", name: "Serena", age: 29,
    bio: "Estetista con il proprio studio. Adoro prendermi cura degli altri. Nel tempo libero faccio palestra e leggo romanzi rosa. Cerco dolcezza.",
    imageUrl: "/images/bots/bot25_main.jpg", photos: ["/images/bots/bot25_extra1.jpg", "/images/bots/bot25_extra2.jpg"],
    location: "Venezia", interests: ["Benessere", "Fitness", "Lettura"], alienType: "Nebulare",
    gender: "Donna", preferredGender: "Tutti", hairColor: "Castano", eyeColor: "Nocciola",
    bodyType: "Atletica", height: 166, preferredAgeMin: 18, preferredAgeMax: 99,
    education: "Diploma professionale", languages: ["Italiano"],
    relationshipType: "Relazione seria", wantsChildren: "Sì", zodiacSign: "Pesci",
    loveLanguage: "Contatto fisico", communicationStyle: "Aperto e diretto", lifestyle: "Attivo e sociale"
  },
  {
    id: "31", name: "Marco", age: 28,
    bio: "Meccanico in un'officina. Le mani sporche di grasso ma il cuore pulito. Mi piace il calcetto con gli amici e la birra al pub il venerdì.",
    imageUrl: "/images/bots/bot31_main.jpg", photos: ["/images/bots/bot31_extra1.jpg", "/images/bots/bot31_extra2.jpg"],
    location: "Roma", interests: ["Calcio", "Motori", "Birra artigianale"], alienType: "Solare",
    gender: "Uomo", preferredGender: "Tutti", hairColor: "Castano scuro", eyeColor: "Marrone",
    bodyType: "Atletico", height: 180, preferredAgeMin: 18, preferredAgeMax: 99,
    education: "Diploma", languages: ["Italiano"],
    relationshipType: "Relazione seria", wantsChildren: "In futuro", zodiacSign: "Ariete",
    loveLanguage: "Contatto fisico", communicationStyle: "Aperto e diretto", lifestyle: "Attivo e sociale"
  },
  {
    id: "32", name: "Luca", age: 25,
    bio: "Barman in un cocktail bar del centro. Lavoro di notte e vivo di giorno. Amo la musica e suonare la chitarra. Cerco qualcuna che ami la vita.",
    imageUrl: "/images/bots/bot32_main.jpg", photos: ["/images/bots/bot32_extra1.jpg", "/images/bots/bot32_extra2.jpg"],
    location: "Milano", interests: ["Musica", "Cocktail", "Chitarra"], alienType: "Dimensionale",
    gender: "Uomo", preferredGender: "Tutti", hairColor: "Nero", eyeColor: "Verde",
    bodyType: "Slanciato", height: 183, preferredAgeMin: 18, preferredAgeMax: 99,
    education: "Diploma", languages: ["Italiano", "Inglese"],
    relationshipType: "Conoscersi prima", wantsChildren: "In futuro", zodiacSign: "Gemelli",
    loveLanguage: "Tempo di qualità", communicationStyle: "Creativo e spontaneo", lifestyle: "Nottambulo"
  },
  {
    id: "33", name: "Alessandro", age: 32,
    bio: "Cuoco in una pizzeria napoletana. La pizza è la mia vita ma cerco qualcosa di più. Amo il mare e le domeniche in famiglia.",
    imageUrl: "/images/bots/bot33_main.jpg", photos: ["/images/bots/bot33_extra1.jpg", "/images/bots/bot33_extra2.jpg"],
    location: "Napoli", interests: ["Cucina", "Mare", "Famiglia"], alienType: "Biotico",
    gender: "Uomo", preferredGender: "Tutti", hairColor: "Nero", eyeColor: "Marrone scuro",
    bodyType: "Robusto", height: 176, preferredAgeMin: 18, preferredAgeMax: 99,
    education: "Scuola alberghiera", languages: ["Italiano"],
    relationshipType: "Relazione seria", wantsChildren: "Sì", zodiacSign: "Cancro",
    loveLanguage: "Atti di servizio", communicationStyle: "Aperto e diretto", lifestyle: "Equilibrato"
  },
  {
    id: "34", name: "Andrea", age: 27,
    bio: "Corriere per consegne a domicilio. Conosco ogni angolo della città! Mi piace la palestra e giocare alla PlayStation la sera. Semplice e diretto.",
    imageUrl: "/images/bots/bot34_main.jpg", photos: ["/images/bots/bot34_extra1.jpg", "/images/bots/bot34_extra2.jpg"],
    location: "Firenze", interests: ["Fitness", "Gaming", "Motori"], alienType: "Quantico",
    gender: "Uomo", preferredGender: "Tutti", hairColor: "Castano", eyeColor: "Azzurro",
    bodyType: "Atletico", height: 178, preferredAgeMin: 18, preferredAgeMax: 99,
    education: "Diploma", languages: ["Italiano"],
    relationshipType: "Conoscersi prima", wantsChildren: "Non lo so", zodiacSign: "Leone",
    loveLanguage: "Contatto fisico", communicationStyle: "Aperto e diretto", lifestyle: "Attivo e sociale"
  },
  {
    id: "35", name: "Tommaso", age: 30,
    bio: "Magazziniere in un centro logistico. Lavoro duro ma nel weekend mi diverto. Amo le grigliate con gli amici e le partite di calcetto.",
    imageUrl: "/images/bots/bot35_main.jpg", photos: ["/images/bots/bot35_extra1.jpg", "/images/bots/bot35_extra2.jpg"],
    location: "Torino", interests: ["Calcio", "BBQ", "Film d'azione"], alienType: "Solare",
    gender: "Uomo", preferredGender: "Tutti", hairColor: "Biondo", eyeColor: "Grigio",
    bodyType: "Robusto", height: 182, preferredAgeMin: 18, preferredAgeMax: 99,
    education: "Diploma", languages: ["Italiano"],
    relationshipType: "Relazione seria", wantsChildren: "In futuro", zodiacSign: "Toro",
    loveLanguage: "Atti di servizio", communicationStyle: "Aperto e diretto", lifestyle: "Equilibrato"
  },
  {
    id: "36", name: "Davide", age: 24,
    bio: "Cameriere e studente part-time. Sogno di aprire un ristorante tutto mio un giorno. Per ora mi godo la vita con semplicità e buon umore.",
    imageUrl: "/images/bots/bot36_main.jpg", photos: ["/images/bots/bot36_extra1.jpg", "/images/bots/bot36_extra2.jpg"],
    location: "Bologna", interests: ["Cucina", "Studio", "Musica"], alienType: "Viaggiatore Stellare",
    gender: "Uomo", preferredGender: "Tutti", hairColor: "Castano chiaro", eyeColor: "Marrone",
    bodyType: "Slanciato", height: 185, preferredAgeMin: 18, preferredAgeMax: 99,
    education: "Università", languages: ["Italiano", "Inglese"],
    relationshipType: "Conoscersi prima", wantsChildren: "In futuro", zodiacSign: "Sagittario",
    loveLanguage: "Parole di affermazione", communicationStyle: "Creativo e spontaneo", lifestyle: "Attivo e sociale"
  },
  {
    id: "37", name: "Federico", age: 29,
    bio: "Idraulico di professione. Risolvo problemi tutti i giorni! Amo le escursioni in montagna e il buon vino. Cerco una ragazza solare e positiva.",
    imageUrl: "/images/bots/bot37_main.jpg", photos: ["/images/bots/bot37_extra1.jpg", "/images/bots/bot37_extra2.jpg"],
    location: "Verona", interests: ["Montagna", "Vino", "Natura"], alienType: "Cristallino",
    gender: "Uomo", preferredGender: "Tutti", hairColor: "Nero", eyeColor: "Nocciola",
    bodyType: "Atletico", height: 179, preferredAgeMin: 18, preferredAgeMax: 99,
    education: "Diploma professionale", languages: ["Italiano"],
    relationshipType: "Relazione seria", wantsChildren: "Sì", zodiacSign: "Vergine",
    loveLanguage: "Atti di servizio", communicationStyle: "Aperto e diretto", lifestyle: "Attivo e sociale"
  },
  {
    id: "38", name: "Matteo", age: 26,
    bio: "Commesso in un negozio di elettronica. Appassionato di tecnologia e videogiochi. Il sabato sera esco con gli amici, la domenica riposo totale.",
    imageUrl: "/images/bots/bot38_main.jpg", photos: ["/images/bots/bot38_extra1.jpg", "/images/bots/bot38_extra2.jpg"],
    location: "Padova", interests: ["Tecnologia", "Gaming", "Cinema"], alienType: "Quantico",
    gender: "Uomo", preferredGender: "Tutti", hairColor: "Castano", eyeColor: "Verde",
    bodyType: "Media", height: 177, preferredAgeMin: 18, preferredAgeMax: 99,
    education: "Diploma", languages: ["Italiano", "Inglese"],
    relationshipType: "Conoscersi prima", wantsChildren: "Non lo so", zodiacSign: "Acquario",
    loveLanguage: "Tempo di qualità", communicationStyle: "Creativo e spontaneo", lifestyle: "Tranquillo e casalingo"
  },
  {
    id: "39", name: "Riccardo", age: 33,
    bio: "Muratore. Costruisco case di giorno e sogni di notte. Amo la cucina della nonna e le partite di carte con gli amici. Cerco qualcosa di serio.",
    imageUrl: "/images/bots/bot39_main.jpg", photos: ["/images/bots/bot39_extra1.jpg", "/images/bots/bot39_extra2.jpg"],
    location: "Catania", interests: ["Calcio", "Carte", "Mare"], alienType: "Solare",
    gender: "Uomo", preferredGender: "Tutti", hairColor: "Nero", eyeColor: "Marrone scuro",
    bodyType: "Robusto", height: 175, preferredAgeMin: 18, preferredAgeMax: 99,
    education: "Licenza media", languages: ["Italiano"],
    relationshipType: "Relazione seria", wantsChildren: "Sì", zodiacSign: "Scorpione",
    loveLanguage: "Contatto fisico", communicationStyle: "Aperto e diretto", lifestyle: "Equilibrato"
  },
  {
    id: "40", name: "Stefano", age: 35,
    bio: "Autista di autobus. Vedo tutta la città ogni giorno dal mio finestrino. Amo pescare il weekend e fare passeggiate con il mio cane.",
    imageUrl: "/images/bots/bot40_main.jpg", photos: ["/images/bots/bot40_extra1.jpg", "/images/bots/bot40_extra2.jpg"],
    location: "Bari", interests: ["Pesca", "Cani", "Natura"], alienType: "Etereo",
    gender: "Uomo", preferredGender: "Tutti", hairColor: "Castano scuro", eyeColor: "Marrone",
    bodyType: "Media", height: 174, preferredAgeMin: 18, preferredAgeMax: 99,
    education: "Diploma", languages: ["Italiano"],
    relationshipType: "Relazione seria", wantsChildren: "Ho già figli", zodiacSign: "Capricorno",
    loveLanguage: "Atti di servizio", communicationStyle: "Riflessivo e profondo", lifestyle: "Tranquillo e casalingo"
  },
  {
    id: "41", name: "Giorgia", age: 21,
    bio: "Studentessa universitaria e lavoro part-time come babysitter. Amo la musica pop e ballare. Cerco qualcuno con cui divertirmi e crescere insieme.",
    imageUrl: "/images/bots/bot41_main.jpg", photos: ["/images/bots/bot41_extra1.jpg", "/images/bots/bot41_extra2.jpg"],
    location: "Perugia", interests: ["Musica", "Ballo", "Social Media"], alienType: "Solare",
    gender: "Donna", preferredGender: "Tutti", hairColor: "Castano chiaro", eyeColor: "Verde",
    bodyType: "Snella", height: 162, preferredAgeMin: 18, preferredAgeMax: 99,
    education: "Università", languages: ["Italiano", "Inglese"],
    relationshipType: "Conoscersi prima", wantsChildren: "Non lo so", zodiacSign: "Ariete",
    loveLanguage: "Parole di affermazione", communicationStyle: "Creativo e spontaneo", lifestyle: "Attivo e sociale"
  },
  {
    id: "42", name: "Lorenzo", age: 31,
    bio: "Giardiniere professionista. Lavoro all'aria aperta e ne sono felice. Amo la natura, le piante e gli animali. Cerco una persona tranquilla e genuina.",
    imageUrl: "/images/bots/bot42_main.jpg", photos: ["/images/bots/bot42_extra1.jpg", "/images/bots/bot42_extra2.jpg"],
    location: "Salerno", interests: ["Giardinaggio", "Natura", "Animali"], alienType: "Biotico",
    gender: "Uomo", preferredGender: "Tutti", hairColor: "Biondo", eyeColor: "Azzurro",
    bodyType: "Atletico", height: 181, preferredAgeMin: 18, preferredAgeMax: 99,
    education: "Diploma", languages: ["Italiano"],
    relationshipType: "Relazione seria", wantsChildren: "Sì", zodiacSign: "Toro",
    loveLanguage: "Tempo di qualità", communicationStyle: "Riflessivo e profondo", lifestyle: "Tranquillo e casalingo"
  },
  {
    id: "43", name: "Elisa", age: 26,
    bio: "Segretaria in uno studio dentistico. Amo i gatti, le candele profumate e le serate film con il plaid. Cerco un ragazzo dolce e premuroso.",
    imageUrl: "/images/bots/bot43_main.jpg", photos: ["/images/bots/bot43_extra1.jpg", "/images/bots/bot43_extra2.jpg"],
    location: "Modena", interests: ["Gatti", "Film", "Yoga"], alienType: "Etereo",
    gender: "Donna", preferredGender: "Tutti", hairColor: "Rosso", eyeColor: "Nocciola",
    bodyType: "Media", height: 161, preferredAgeMin: 18, preferredAgeMax: 99,
    education: "Diploma", languages: ["Italiano"],
    relationshipType: "Relazione seria", wantsChildren: "In futuro", zodiacSign: "Pesci",
    loveLanguage: "Regali", communicationStyle: "Riflessivo e profondo", lifestyle: "Tranquillo e casalingo"
  },
  {
    id: "44", name: "Simone M.", age: 27,
    bio: "Operaio in fabbrica. Lavoro sodo durante la settimana, ma il weekend è tutto per me. Palestra, aperitivo e qualche partita di basket.",
    imageUrl: "/images/bots/bot44_main.jpg", photos: ["/images/bots/bot44_extra1.jpg", "/images/bots/bot44_extra2.jpg"],
    location: "Brescia", interests: ["Basket", "Fitness", "Aperitivo"], alienType: "Dimensionale",
    gender: "Uomo", preferredGender: "Tutti", hairColor: "Nero", eyeColor: "Marrone",
    bodyType: "Atletico", height: 184, preferredAgeMin: 18, preferredAgeMax: 99,
    education: "Diploma", languages: ["Italiano"],
    relationshipType: "Conoscersi prima", wantsChildren: "In futuro", zodiacSign: "Leone",
    loveLanguage: "Contatto fisico", communicationStyle: "Aperto e diretto", lifestyle: "Attivo e sociale"
  },
  {
    id: "45", name: "Roberta", age: 34,
    bio: "Infermiera in ospedale. Il mio lavoro è duro ma lo amo. Cerco un uomo che capisca i turni e che mi faccia ridere dopo una giornata pesante.",
    imageUrl: "/images/bots/bot45_main.jpg", photos: ["/images/bots/bot45_extra1.jpg", "/images/bots/bot45_extra2.jpg"],
    location: "Messina", interests: ["Lettura", "Cucina", "Mare"], alienType: "Nebulare",
    gender: "Donna", preferredGender: "Tutti", hairColor: "Castano", eyeColor: "Marrone",
    bodyType: "Media", height: 165, preferredAgeMin: 18, preferredAgeMax: 99,
    education: "Laurea", languages: ["Italiano", "Inglese"],
    relationshipType: "Relazione seria", wantsChildren: "Sì", zodiacSign: "Vergine",
    loveLanguage: "Tempo di qualità", communicationStyle: "Aperto e diretto", lifestyle: "Equilibrato"
  },
  {
    id: "46", name: "Fabio", age: 29,
    bio: "Pizzaiolo. Le mie pizze sono famose in tutto il quartiere! Amo il calcio, la moto e le serate in compagnia. Cerco una ragazza che ami mangiare bene.",
    imageUrl: "/images/bots/bot46_main.jpg", photos: ["/images/bots/bot46_extra1.jpg", "/images/bots/bot46_extra2.jpg"],
    location: "Cagliari", interests: ["Cucina", "Calcio", "Moto"], alienType: "Solare",
    gender: "Uomo", preferredGender: "Tutti", hairColor: "Nero", eyeColor: "Marrone scuro",
    bodyType: "Robusto", height: 176, preferredAgeMin: 18, preferredAgeMax: 99,
    education: "Scuola alberghiera", languages: ["Italiano"],
    relationshipType: "Relazione seria", wantsChildren: "In futuro", zodiacSign: "Ariete",
    loveLanguage: "Atti di servizio", communicationStyle: "Aperto e diretto", lifestyle: "Attivo e sociale"
  },
  {
    id: "47", name: "Anna", age: 23,
    bio: "Lavoro in un call center ma sogno di diventare make-up artist. Amo truccarmi, fare video su TikTok e uscire con le amiche. Positiva e solare!",
    imageUrl: "/images/bots/bot47_main.jpg", photos: ["/images/bots/bot47_extra1.jpg", "/images/bots/bot47_extra2.jpg"],
    location: "Lecce", interests: ["Make-up", "Social Media", "Moda"], alienType: "Cristallino",
    gender: "Donna", preferredGender: "Tutti", hairColor: "Biondo platino", eyeColor: "Azzurro",
    bodyType: "Snella", height: 158, preferredAgeMin: 18, preferredAgeMax: 99,
    education: "Diploma", languages: ["Italiano"],
    relationshipType: "Conoscersi prima", wantsChildren: "Non lo so", zodiacSign: "Bilancia",
    loveLanguage: "Regali", communicationStyle: "Creativo e spontaneo", lifestyle: "Attivo e sociale"
  },
  {
    id: "48", name: "Giuseppe", age: 36,
    bio: "Camionista. Viaggio per lavoro ma il mio cuore è sempre a casa. Amo cucinare, guardare il calcio e passare tempo con la famiglia.",
    imageUrl: "/images/bots/bot48_main.jpg", photos: ["/images/bots/bot48_extra1.jpg", "/images/bots/bot48_extra2.jpg"],
    location: "Taranto", interests: ["Cucina", "Calcio", "Viaggi"], alienType: "Solare",
    gender: "Uomo", preferredGender: "Tutti", hairColor: "Castano scuro", eyeColor: "Marrone",
    bodyType: "Robusto", height: 180, preferredAgeMin: 18, preferredAgeMax: 99,
    education: "Licenza media", languages: ["Italiano"],
    relationshipType: "Relazione seria", wantsChildren: "Ho già figli", zodiacSign: "Capricorno",
    loveLanguage: "Atti di servizio", communicationStyle: "Aperto e diretto", lifestyle: "Equilibrato"
  },
  {
    id: "49", name: "Lucia", age: 28,
    bio: "Commessa in una profumeria. Amo i profumi, la cura del corpo e le passeggiate al tramonto. Cerco un ragazzo romantico che ami le piccole cose.",
    imageUrl: "/images/bots/bot49_main.jpg", photos: ["/images/bots/bot49_extra1.jpg", "/images/bots/bot49_extra2.jpg"],
    location: "Ancona", interests: ["Benessere", "Profumi", "Passeggiate"], alienType: "Nebulare",
    gender: "Donna", preferredGender: "Tutti", hairColor: "Castano", eyeColor: "Verde",
    bodyType: "Media", height: 163, preferredAgeMin: 18, preferredAgeMax: 99,
    education: "Diploma", languages: ["Italiano", "Francese"],
    relationshipType: "Relazione seria", wantsChildren: "In futuro", zodiacSign: "Cancro",
    loveLanguage: "Contatto fisico", communicationStyle: "Riflessivo e profondo", lifestyle: "Equilibrato"
  },
  {
    id: "50", name: "Daniele", age: 25,
    bio: "Personal trainer in palestra. La salute viene prima di tutto! Amo correre, nuotare e mangiare sano. Cerco una ragazza sportiva e motivata.",
    imageUrl: "/images/bots/bot50_main.jpg", photos: ["/images/bots/bot50_extra1.jpg", "/images/bots/bot50_extra2.jpg"],
    location: "Trieste", interests: ["Fitness", "Running", "Nutrizione"], alienType: "Biotico",
    gender: "Uomo", preferredGender: "Tutti", hairColor: "Biondo", eyeColor: "Azzurro",
    bodyType: "Atletico", height: 186, preferredAgeMin: 18, preferredAgeMax: 99,
    education: "Laurea", languages: ["Italiano", "Inglese"],
    relationshipType: "Conoscersi prima", wantsChildren: "In futuro", zodiacSign: "Gemelli",
    loveLanguage: "Contatto fisico", communicationStyle: "Aperto e diretto", lifestyle: "Attivo e sociale"
  },
  {
    id: "51", name: "Ilaria", age: 25,
    bio: "Fiorista. Passo le giornate tra rose e girasoli. Amo la natura, i mercatini e le colazioni lunghe la domenica. Cerco gentilezza e semplicità.",
    imageUrl: "/images/bots/bot51_main.jpg", photos: ["/images/bots/bot51_extra1.jpg", "/images/bots/bot51_extra2.jpg"],
    location: "Siena", interests: ["Fiori", "Natura", "Mercatini"], alienType: "Biotico",
    gender: "Donna", preferredGender: "Tutti", hairColor: "Rosso rame", eyeColor: "Verde",
    bodyType: "Snella", height: 160, preferredAgeMin: 18, preferredAgeMax: 99,
    education: "Diploma", languages: ["Italiano"],
    relationshipType: "Relazione seria", wantsChildren: "Sì", zodiacSign: "Toro",
    loveLanguage: "Regali", communicationStyle: "Riflessivo e profondo", lifestyle: "Tranquillo e casalingo"
  },
  {
    id: "52", name: "Nicola", age: 30,
    bio: "Elettricista. Lavoro in cantiere ma la sera mi trasformo: cucino, guardo film e gioco online. Cerco una ragazza simpatica e senza troppe pretese.",
    imageUrl: "/images/bots/bot52_main.jpg", photos: ["/images/bots/bot52_extra1.jpg", "/images/bots/bot52_extra2.jpg"],
    location: "Arezzo", interests: ["Gaming", "Film", "Cucina"], alienType: "Quantico",
    gender: "Uomo", preferredGender: "Tutti", hairColor: "Castano", eyeColor: "Nocciola",
    bodyType: "Media", height: 178, preferredAgeMin: 18, preferredAgeMax: 99,
    education: "Diploma professionale", languages: ["Italiano"],
    relationshipType: "Conoscersi prima", wantsChildren: "Non lo so", zodiacSign: "Acquario",
    loveLanguage: "Tempo di qualità", communicationStyle: "Aperto e diretto", lifestyle: "Equilibrato"
  },
  {
    id: "53", name: "Claudia", age: 33,
    bio: "Impiegata delle poste. Vita regolare e tranquilla. Amo leggere, cucinare dolci e passeggiare con il cane. Cerco stabilità e affetto vero.",
    imageUrl: "/images/bots/bot53_main.jpg", photos: ["/images/bots/bot53_extra1.jpg", "/images/bots/bot53_extra2.jpg"],
    location: "Livorno", interests: ["Lettura", "Dolci", "Cani"], alienType: "Etereo",
    gender: "Donna", preferredGender: "Tutti", hairColor: "Nero", eyeColor: "Marrone",
    bodyType: "Formosa", height: 164, preferredAgeMin: 18, preferredAgeMax: 99,
    education: "Diploma", languages: ["Italiano"],
    relationshipType: "Relazione seria", wantsChildren: "Sì", zodiacSign: "Pesci",
    loveLanguage: "Atti di servizio", communicationStyle: "Riflessivo e profondo", lifestyle: "Tranquillo e casalingo"
  },
  {
    id: "54", name: "Paolo", age: 28,
    bio: "Panettiere. Mi sveglio alle 4 del mattino ma faccio il pane più buono della zona! Amo la semplicità, la buona tavola e le risate genuine.",
    imageUrl: "/images/bots/bot54_main.jpg", photos: ["/images/bots/bot54_extra1.jpg", "/images/bots/bot54_extra2.jpg"],
    location: "Parma", interests: ["Cucina", "Calcio", "Famiglia"], alienType: "Solare",
    gender: "Uomo", preferredGender: "Tutti", hairColor: "Castano chiaro", eyeColor: "Azzurro",
    bodyType: "Robusto", height: 175, preferredAgeMin: 18, preferredAgeMax: 99,
    education: "Diploma professionale", languages: ["Italiano"],
    relationshipType: "Relazione seria", wantsChildren: "Sì", zodiacSign: "Cancro",
    loveLanguage: "Atti di servizio", communicationStyle: "Aperto e diretto", lifestyle: "Equilibrato"
  },
  {
    id: "55", name: "Michela", age: 24,
    bio: "Lavoro come dog sitter e adoro gli animali. Amo stare all'aria aperta, andare in bici e mangiare gelato. Cerco qualcuno con cui ridere tanto.",
    imageUrl: "/images/bots/bot55_main.jpg", photos: ["/images/bots/bot55_extra1.jpg", "/images/bots/bot55_extra2.jpg"],
    location: "Treviso", interests: ["Animali", "Bici", "Gelato"], alienType: "Solare",
    gender: "Donna", preferredGender: "Tutti", hairColor: "Biondo", eyeColor: "Azzurro",
    bodyType: "Snella", height: 166, preferredAgeMin: 18, preferredAgeMax: 99,
    education: "Diploma", languages: ["Italiano", "Inglese"],
    relationshipType: "Conoscersi prima", wantsChildren: "In futuro", zodiacSign: "Sagittario",
    loveLanguage: "Tempo di qualità", communicationStyle: "Creativo e spontaneo", lifestyle: "Attivo e sociale"
  },
  {
    id: "56", name: "Emanuele", age: 34,
    bio: "Taxista a Roma. Conosco ogni strada e ogni scorciatoia! La sera mi piace guardare partite e mangiare la carbonara. Uomo semplice, cuore grande.",
    imageUrl: "/images/bots/bot56_main.jpg", photos: ["/images/bots/bot56_extra1.jpg", "/images/bots/bot56_extra2.jpg"],
    location: "Roma", interests: ["Calcio", "Cucina romana", "Film"], alienType: "Dimensionale",
    gender: "Uomo", preferredGender: "Tutti", hairColor: "Nero", eyeColor: "Marrone scuro",
    bodyType: "Media", height: 173, preferredAgeMin: 18, preferredAgeMax: 99,
    education: "Diploma", languages: ["Italiano"],
    relationshipType: "Relazione seria", wantsChildren: "Ho già figli", zodiacSign: "Scorpione",
    loveLanguage: "Contatto fisico", communicationStyle: "Aperto e diretto", lifestyle: "Equilibrato"
  },
  {
    id: "57", name: "Sara", age: 22,
    bio: "Lavoro in gelateria e studio lingue all'università. Amo viaggiare, la musica latina e le feste in spiaggia. Energia positiva sempre!",
    imageUrl: "/images/bots/bot57_main.jpg", photos: ["/images/bots/bot57_extra1.jpg", "/images/bots/bot57_extra2.jpg"],
    location: "Amalfi", interests: ["Lingue", "Musica latina", "Spiaggia"], alienType: "Viaggiatore Stellare",
    gender: "Donna", preferredGender: "Tutti", hairColor: "Castano scuro", eyeColor: "Marrone",
    bodyType: "Snella", height: 159, preferredAgeMin: 18, preferredAgeMax: 99,
    education: "Università", languages: ["Italiano", "Inglese", "Spagnolo"],
    relationshipType: "Conoscersi prima", wantsChildren: "Non lo so", zodiacSign: "Leone",
    loveLanguage: "Parole di affermazione", communicationStyle: "Creativo e spontaneo", lifestyle: "Attivo e sociale"
  },
  {
    id: "58", name: "Antonio", age: 32,
    bio: "Falegname. Creo mobili con le mie mani e ne vado fiero. Amo il profumo del legno, le passeggiate in campagna e una buona cena in trattoria.",
    imageUrl: "/images/bots/bot58_main.jpg", photos: ["/images/bots/bot58_extra1.jpg", "/images/bots/bot58_extra2.jpg"],
    location: "Salerno", interests: ["Artigianato", "Natura", "Cucina"], alienType: "Biotico",
    gender: "Uomo", preferredGender: "Tutti", hairColor: "Castano scuro", eyeColor: "Verde",
    bodyType: "Atletico", height: 179, preferredAgeMin: 18, preferredAgeMax: 99,
    education: "Diploma professionale", languages: ["Italiano"],
    relationshipType: "Relazione seria", wantsChildren: "Sì", zodiacSign: "Vergine",
    loveLanguage: "Atti di servizio", communicationStyle: "Riflessivo e profondo", lifestyle: "Tranquillo e casalingo"
  },
  {
    id: "59", name: "Valentina B.", age: 27,
    bio: "Lavoro come receptionist in un centro benessere. Mi piace prendermi cura di me stessa e degli altri. Cerco un uomo galante e con senso dell'umorismo.",
    imageUrl: "/images/bots/bot59_main.jpg", photos: ["/images/bots/bot59_extra1.jpg", "/images/bots/bot59_extra2.jpg"],
    location: "Milano", interests: ["Benessere", "Spa", "Shopping"], alienType: "Nebulare",
    gender: "Donna", preferredGender: "Tutti", hairColor: "Biondo", eyeColor: "Azzurro",
    bodyType: "Snella", height: 170, preferredAgeMin: 18, preferredAgeMax: 99,
    education: "Diploma", languages: ["Italiano", "Inglese"],
    relationshipType: "Relazione seria", wantsChildren: "In futuro", zodiacSign: "Bilancia",
    loveLanguage: "Regali", communicationStyle: "Aperto e diretto", lifestyle: "Urbano e dinamico"
  },
  {
    id: "60", name: "Giovanni", age: 38,
    bio: "Guardia giurata. Lavoro serio ma persona allegra. Amo il karaoke, la cucina siciliana e le domeniche al mare. Padre di due bambini.",
    imageUrl: "/images/bots/bot60_main.jpg", photos: ["/images/bots/bot60_extra1.jpg", "/images/bots/bot60_extra2.jpg"],
    location: "Palermo", interests: ["Karaoke", "Mare", "Famiglia"], alienType: "Solare",
    gender: "Uomo", preferredGender: "Tutti", hairColor: "Nero", eyeColor: "Marrone scuro",
    bodyType: "Robusto", height: 177, preferredAgeMin: 18, preferredAgeMax: 99,
    education: "Diploma", languages: ["Italiano"],
    relationshipType: "Relazione seria", wantsChildren: "Ho già figli", zodiacSign: "Capricorno",
    loveLanguage: "Tempo di qualità", communicationStyle: "Aperto e diretto", lifestyle: "Equilibrato"
  },
  {
    id: "61", name: "Serena", age: 26,
    bio: "Istruttrice di fitness in palestra. Amo lo yoga, le passeggiate in natura e i frullati proteici. Cerco una persona attiva e positiva.",
    imageUrl: "/images/bots/bot61_main.jpg", photos: ["/images/bots/bot61_extra1.jpg", "/images/bots/bot61_extra2.jpg"],
    location: "Genova", interests: ["Fitness", "Yoga", "Natura"], alienType: "Biotico",
    gender: "Donna", preferredGender: "Tutti", hairColor: "Castano", eyeColor: "Verde",
    bodyType: "Atletica", height: 171, preferredAgeMin: 18, preferredAgeMax: 99,
    education: "Laurea", languages: ["Italiano", "Inglese"],
    relationshipType: "Conoscersi prima", wantsChildren: "In futuro", zodiacSign: "Ariete",
    loveLanguage: "Contatto fisico", communicationStyle: "Aperto e diretto", lifestyle: "Attivo e sociale"
  },
  {
    id: "62", name: "Simone", age: 24,
    bio: "Lavoro come rider per le consegne. Amo lo skateboard, i graffiti e la musica hip-hop. Spirito libero ma con il cuore aperto.",
    imageUrl: "/images/bots/bot62_main.jpg", photos: ["/images/bots/bot62_extra1.jpg", "/images/bots/bot62_extra2.jpg"],
    location: "Bologna", interests: ["Skateboard", "Musica", "Street art"], alienType: "Viaggiatore Stellare",
    gender: "Uomo", preferredGender: "Tutti", hairColor: "Biondo", eyeColor: "Azzurro",
    bodyType: "Slanciato", height: 180, preferredAgeMin: 18, preferredAgeMax: 99,
    education: "Diploma", languages: ["Italiano", "Inglese"],
    relationshipType: "Conoscersi prima", wantsChildren: "Non lo so", zodiacSign: "Gemelli",
    loveLanguage: "Tempo di qualità", communicationStyle: "Creativo e spontaneo", lifestyle: "Attivo e sociale"
  },
  {
    id: "63", name: "Patrizia", age: 35,
    bio: "Maestra elementare. I bambini mi danno energia ogni giorno. Amo leggere, il cinema e i gatti. Cerco un compagno maturo e affidabile.",
    imageUrl: "/images/bots/bot63_main.jpg", photos: ["/images/bots/bot63_extra1.jpg", "/images/bots/bot63_extra2.jpg"],
    location: "Perugia", interests: ["Lettura", "Cinema", "Gatti"], alienType: "Etereo",
    gender: "Donna", preferredGender: "Tutti", hairColor: "Castano scuro", eyeColor: "Marrone",
    bodyType: "Media", height: 163, preferredAgeMin: 18, preferredAgeMax: 99,
    education: "Laurea", languages: ["Italiano", "Inglese"],
    relationshipType: "Relazione seria", wantsChildren: "In futuro", zodiacSign: "Cancro",
    loveLanguage: "Atti di servizio", communicationStyle: "Riflessivo e profondo", lifestyle: "Equilibrato"
  },
  {
    id: "64", name: "Marco A.", age: 30,
    bio: "Corriere espresso. Sempre in movimento ma cerco qualcuno per cui fermarmi. Amo le grigliate, il calcetto e le serate pizza con gli amici.",
    imageUrl: "/images/bots/bot64_main.jpg", photos: ["/images/bots/bot64_extra1.jpg", "/images/bots/bot64_extra2.jpg"],
    location: "Verona", interests: ["BBQ", "Calcio", "Pizza"], alienType: "Solare",
    gender: "Uomo", preferredGender: "Tutti", hairColor: "Nero", eyeColor: "Marrone",
    bodyType: "Atletico", height: 182, preferredAgeMin: 18, preferredAgeMax: 99,
    education: "Diploma", languages: ["Italiano"],
    relationshipType: "Relazione seria", wantsChildren: "Sì", zodiacSign: "Toro",
    loveLanguage: "Contatto fisico", communicationStyle: "Aperto e diretto", lifestyle: "Attivo e sociale"
  },
  {
    id: "65", name: "Arianna", age: 23,
    bio: "Fiorista part-time e studentessa di belle arti. Amo dipingere, i picnic al parco e i tramonti. Anima creativa in cerca di ispirazione.",
    imageUrl: "/images/bots/bot65_main.jpg", photos: ["/images/bots/bot65_extra1.jpg", "/images/bots/bot65_extra2.jpg"],
    location: "Firenze", interests: ["Arte", "Fiori", "Pittura"], alienType: "Cristallino",
    gender: "Donna", preferredGender: "Tutti", hairColor: "Rosso rame", eyeColor: "Verde",
    bodyType: "Snella", height: 165, preferredAgeMin: 18, preferredAgeMax: 99,
    education: "Università", languages: ["Italiano", "Inglese"],
    relationshipType: "Conoscersi prima", wantsChildren: "Non lo so", zodiacSign: "Pesci",
    loveLanguage: "Regali", communicationStyle: "Creativo e spontaneo", lifestyle: "Attivo e sociale"
  },
  {
    id: "66", name: "Franco", age: 42,
    bio: "Cameriere in un ristorante di pesce. Ho esperienza di vita e so cosa voglio. Amo pescare, portare il cane a passeggio e guardare il tramonto.",
    imageUrl: "/images/bots/bot66_main.jpg", photos: ["/images/bots/bot66_extra1.jpg", "/images/bots/bot66_extra2.jpg"],
    location: "Bari", interests: ["Pesca", "Cani", "Mare"], alienType: "Etereo",
    gender: "Uomo", preferredGender: "Tutti", hairColor: "Sale e pepe", eyeColor: "Marrone",
    bodyType: "Media", height: 174, preferredAgeMin: 18, preferredAgeMax: 99,
    education: "Licenza media", languages: ["Italiano"],
    relationshipType: "Relazione seria", wantsChildren: "Ho già figli", zodiacSign: "Scorpione",
    loveLanguage: "Atti di servizio", communicationStyle: "Riflessivo e profondo", lifestyle: "Tranquillo e casalingo"
  },
  {
    id: "67", name: "Riccardo", age: 29,
    bio: "Pasticcere in una pasticceria artigianale. La mia specialità sono le crostate! Amo il mercato del sabato e le cene con gli amici.",
    imageUrl: "/images/bots/bot67_main.jpg", photos: ["/images/bots/bot67_extra1.jpg", "/images/bots/bot67_extra2.jpg"],
    location: "Modena", interests: ["Dolci", "Cucina", "Mercatini"], alienType: "Cristallino",
    gender: "Uomo", preferredGender: "Tutti", hairColor: "Castano chiaro", eyeColor: "Nocciola",
    bodyType: "Medio", height: 178, preferredAgeMin: 18, preferredAgeMax: 99,
    education: "Scuola alberghiera", languages: ["Italiano"],
    relationshipType: "Relazione seria", wantsChildren: "Sì", zodiacSign: "Toro",
    loveLanguage: "Atti di servizio", communicationStyle: "Aperto e diretto", lifestyle: "Equilibrato"
  },
  {
    id: "68", name: "Giacomo", age: 27,
    bio: "Elettricista. Mi piace risolvere problemi e aggiustare le cose. Nel tempo libero nuoto e guardo tramonti dal molo. Ragazzo tranquillo e affidabile.",
    imageUrl: "/images/bots/bot68_main.jpg", photos: ["/images/bots/bot68_extra1.jpg", "/images/bots/bot68_extra2.jpg"],
    location: "Livorno", interests: ["Nuoto", "Film", "Natura"], alienType: "Quantico",
    gender: "Uomo", preferredGender: "Tutti", hairColor: "Castano", eyeColor: "Azzurro",
    bodyType: "Atletico", height: 181, preferredAgeMin: 18, preferredAgeMax: 99,
    education: "Diploma professionale", languages: ["Italiano"],
    relationshipType: "Relazione seria", wantsChildren: "In futuro", zodiacSign: "Vergine",
    loveLanguage: "Tempo di qualità", communicationStyle: "Riflessivo e profondo", lifestyle: "Equilibrato"
  },
  {
    id: "69", name: "Giuliana", age: 31,
    bio: "Parrucchiera con il mio piccolo salone. Amo ballare la salsa, andare in palestra e le serate karaoke. Energia e sorriso sempre!",
    imageUrl: "/images/bots/bot69_main.jpg", photos: ["/images/bots/bot69_extra1.jpg", "/images/bots/bot69_extra2.jpg"],
    location: "Catania", interests: ["Ballo", "Fitness", "Karaoke"], alienType: "Solare",
    gender: "Donna", preferredGender: "Tutti", hairColor: "Nero", eyeColor: "Marrone scuro",
    bodyType: "Atletica", height: 168, preferredAgeMin: 18, preferredAgeMax: 99,
    education: "Diploma professionale", languages: ["Italiano"],
    relationshipType: "Conoscersi prima", wantsChildren: "In futuro", zodiacSign: "Leone",
    loveLanguage: "Contatto fisico", communicationStyle: "Creativo e spontaneo", lifestyle: "Attivo e sociale"
  },
  {
    id: "70", name: "Piero", age: 45,
    bio: "Tassista da 20 anni. Conosco la città come le mie tasche. Amo le bocce, le passeggiate e stare con i nipotini. Cerco compagnia sincera.",
    imageUrl: "/images/bots/bot70_main.jpg", photos: ["/images/bots/bot70_extra1.jpg", "/images/bots/bot70_extra2.jpg"],
    location: "Roma", interests: ["Bocce", "Famiglia", "Passeggiate"], alienType: "Etereo",
    gender: "Uomo", preferredGender: "Tutti", hairColor: "Sale e pepe", eyeColor: "Marrone",
    bodyType: "Media", height: 172, preferredAgeMin: 18, preferredAgeMax: 99,
    education: "Licenza media", languages: ["Italiano"],
    relationshipType: "Relazione seria", wantsChildren: "Ho già figli", zodiacSign: "Capricorno",
    loveLanguage: "Tempo di qualità", communicationStyle: "Aperto e diretto", lifestyle: "Tranquillo e casalingo"
  },
  // === English-speaking bots (US/UK) - Women ===
  {
    id: "71", name: "Emily", age: 26,
    bio: "Primary school teacher in Manchester. I spend my weekends at farmers' markets and trying new brunch spots. Big fan of rainy afternoons with a good book.",
    imageUrl: "/images/bots/bot71_main.png", photos: [],
    location: "Manchester", interests: ["Reading", "Cooking", "Nature"], alienType: "Nebulare",
    gender: "Donna", preferredGender: "Tutti", hairColor: "Castano chiaro", eyeColor: "Nocciola",
    bodyType: "Media", height: 165, preferredAgeMin: 18, preferredAgeMax: 99,
    education: "Laurea", languages: ["English"],
    relationshipType: "Relazione seria", wantsChildren: "In futuro", zodiacSign: "Cancro",
    loveLanguage: "Parole di affermazione", communicationStyle: "Aperto e diretto", lifestyle: "Equilibrato"
  },
  {
    id: "72", name: "Sarah", age: 29,
    bio: "Graphic designer working freelance from my flat in Brooklyn. Love hiking on weekends, trying street food, and adopting too many houseplants.",
    imageUrl: "/images/bots/bot72_main.png", photos: [],
    location: "New York", interests: ["Design", "Hiking", "Photography"], alienType: "Cristallino",
    gender: "Donna", preferredGender: "Tutti", hairColor: "Biondo scuro", eyeColor: "Azzurro",
    bodyType: "Magra", height: 170, preferredAgeMin: 18, preferredAgeMax: 99,
    education: "Laurea", languages: ["English"],
    relationshipType: "Conoscersi prima", wantsChildren: "In futuro", zodiacSign: "Bilancia",
    loveLanguage: "Tempo di qualità", communicationStyle: "Creativo e spontaneo", lifestyle: "Attivo e sociale"
  },
  {
    id: "73", name: "Jessica", age: 24,
    bio: "Veterinary assistant in Austin. If I'm not at the clinic, I'm probably at a dog park or trying a new taco truck. Life's too short for bad coffee.",
    imageUrl: "/images/bots/bot73_main.png", photos: [],
    location: "Austin", interests: ["Animals", "Food", "Music"], alienType: "Biotico",
    gender: "Donna", preferredGender: "Tutti", hairColor: "Rosso", eyeColor: "Verde",
    bodyType: "Media", height: 163, preferredAgeMin: 18, preferredAgeMax: 99,
    education: "Diploma", languages: ["English"],
    relationshipType: "Conoscersi prima", wantsChildren: "Non lo so", zodiacSign: "Sagittario",
    loveLanguage: "Atti di servizio", communicationStyle: "Creativo e spontaneo", lifestyle: "Attivo e sociale"
  },
  {
    id: "74", name: "Hannah", age: 27,
    bio: "Barista and part-time pottery student in Portland. I make a killer flat white and an okay-ish mug. Looking for someone to split a pizza with.",
    imageUrl: "/images/bots/bot74_main.png", photos: [],
    location: "Portland", interests: ["Coffee", "Art", "Ceramics"], alienType: "Dimensionale",
    gender: "Donna", preferredGender: "Tutti", hairColor: "Nero", eyeColor: "Marrone",
    bodyType: "Media", height: 160, preferredAgeMin: 18, preferredAgeMax: 99,
    education: "Diploma", languages: ["English"],
    relationshipType: "Conoscersi prima", wantsChildren: "Non lo so", zodiacSign: "Pesci",
    loveLanguage: "Tempo di qualità", communicationStyle: "Riflessivo e profondo", lifestyle: "Equilibrato"
  },
  {
    id: "75", name: "Olivia", age: 31,
    bio: "HR manager at a tech company in San Francisco. On weekends I run along the Embarcadero and binge true crime podcasts. Fluent in spreadsheets and sarcasm.",
    imageUrl: "/images/bots/bot75_main.png", photos: [],
    location: "San Francisco", interests: ["Running", "Podcasts", "Travel"], alienType: "Solare",
    gender: "Donna", preferredGender: "Tutti", hairColor: "Nero", eyeColor: "Marrone scuro",
    bodyType: "Atletica", height: 168, preferredAgeMin: 18, preferredAgeMax: 99,
    education: "Master", languages: ["English"],
    relationshipType: "Relazione seria", wantsChildren: "In futuro", zodiacSign: "Ariete",
    loveLanguage: "Parole di affermazione", communicationStyle: "Aperto e diretto", lifestyle: "Attivo e sociale"
  },
  {
    id: "76", name: "Chloe", age: 23,
    bio: "Studying marine biology at uni in Brighton. Obsessed with the ocean, secondhand bookshops, and making playlists nobody asks for.",
    imageUrl: "/images/bots/bot76_main.png", photos: [],
    location: "Brighton", interests: ["Science", "Music", "Beach"], alienType: "Viaggiatore Stellare",
    gender: "Donna", preferredGender: "Tutti", hairColor: "Biondo fragola", eyeColor: "Azzurro-verde",
    bodyType: "Magra", height: 162, preferredAgeMin: 18, preferredAgeMax: 99,
    education: "Università in corso", languages: ["English"],
    relationshipType: "Conoscersi prima", wantsChildren: "Non lo so", zodiacSign: "Acquario",
    loveLanguage: "Tempo di qualità", communicationStyle: "Creativo e spontaneo", lifestyle: "Equilibrato"
  },
  {
    id: "77", name: "Megan", age: 28,
    bio: "Nurse working night shifts in Chicago. My days off are for sleeping in, baking sourdough, and exploring the city by bike. Low-key and easygoing.",
    imageUrl: "/images/bots/bot77_main.png", photos: [],
    location: "Chicago", interests: ["Cycling", "Baking", "Films"], alienType: "Quantico",
    gender: "Donna", preferredGender: "Tutti", hairColor: "Castano", eyeColor: "Marrone",
    bodyType: "Media", height: 167, preferredAgeMin: 18, preferredAgeMax: 99,
    education: "Laurea", languages: ["English"],
    relationshipType: "Relazione seria", wantsChildren: "In futuro", zodiacSign: "Toro",
    loveLanguage: "Atti di servizio", communicationStyle: "Riflessivo e profondo", lifestyle: "Tranquillo e casalingo"
  },
  {
    id: "78", name: "Lauren", age: 25,
    bio: "Social media coordinator in Denver. Snowboarding in winter, camping in summer. I bring homemade trail mix everywhere. Don't judge.",
    imageUrl: "/images/bots/bot78_main.png", photos: [],
    location: "Denver", interests: ["Snowboard", "Camping", "Social Media"], alienType: "Etereo",
    gender: "Donna", preferredGender: "Tutti", hairColor: "Biondo scuro", eyeColor: "Grigio",
    bodyType: "Atletica", height: 171, preferredAgeMin: 18, preferredAgeMax: 99,
    education: "Laurea", languages: ["English"],
    relationshipType: "Conoscersi prima", wantsChildren: "Non lo so", zodiacSign: "Gemelli",
    loveLanguage: "Tempo di qualità", communicationStyle: "Creativo e spontaneo", lifestyle: "Attivo e sociale"
  },
  {
    id: "79", name: "Sophie", age: 30,
    bio: "Solicitor in London, but I promise I'm more fun than that sounds. Theatre nerd, weekend cook, and firm believer that a Sunday roast fixes everything.",
    imageUrl: "/images/bots/bot79_main.png", photos: [],
    location: "London", interests: ["Theatre", "Cooking", "Wine"], alienType: "Nebulare",
    gender: "Donna", preferredGender: "Tutti", hairColor: "Castano scuro riccio", eyeColor: "Nocciola",
    bodyType: "Media", height: 166, preferredAgeMin: 18, preferredAgeMax: 99,
    education: "Master", languages: ["English"],
    relationshipType: "Relazione seria", wantsChildren: "In futuro", zodiacSign: "Vergine",
    loveLanguage: "Parole di affermazione", communicationStyle: "Aperto e diretto", lifestyle: "Equilibrato"
  },
  {
    id: "80", name: "Rachel", age: 26,
    bio: "Yoga instructor in Seattle. Quiet mornings, green tea, and long walks in the rain are my thing. Looking for genuine connection, not games.",
    imageUrl: "/images/bots/bot80_main.png", photos: [],
    location: "Seattle", interests: ["Yoga", "Meditation", "Nature"], alienType: "Cristallino",
    gender: "Donna", preferredGender: "Tutti", hairColor: "Nero liscio", eyeColor: "Marrone",
    bodyType: "Magra", height: 164, preferredAgeMin: 18, preferredAgeMax: 99,
    education: "Certificazione professionale", languages: ["English"],
    relationshipType: "Relazione seria", wantsChildren: "Non lo so", zodiacSign: "Pesci",
    loveLanguage: "Contatto fisico", communicationStyle: "Riflessivo e profondo", lifestyle: "Tranquillo e casalingo"
  },
  // === English-speaking bots (US/UK) - Men ===
  {
    id: "81", name: "James", age: 30,
    bio: "Civil engineer in Birmingham. I build bridges by day and questionable IKEA furniture by night. Big into football, pub quizzes, and a proper Sunday fry-up.",
    imageUrl: "/images/bots/bot81_main.png", photos: [],
    location: "Birmingham", interests: ["Football", "DIY", "Pub"], alienType: "Dimensionale",
    gender: "Uomo", preferredGender: "Tutti", hairColor: "Castano scuro", eyeColor: "Azzurro",
    bodyType: "Medio", height: 183, preferredAgeMin: 18, preferredAgeMax: 99,
    education: "Laurea", languages: ["English"],
    relationshipType: "Relazione seria", wantsChildren: "In futuro", zodiacSign: "Scorpione",
    loveLanguage: "Atti di servizio", communicationStyle: "Aperto e diretto", lifestyle: "Equilibrato"
  },
  {
    id: "82", name: "William", age: 28,
    bio: "High school history teacher in Edinburgh. I collect vinyl records, play five-a-side on Wednesdays, and make a decent carbonara. Bit of a nerd, not sorry.",
    imageUrl: "/images/bots/bot82_main.png", photos: [],
    location: "Edinburgh", interests: ["History", "Music", "Football"], alienType: "Solare",
    gender: "Uomo", preferredGender: "Tutti", hairColor: "Biondo sabbia", eyeColor: "Verde",
    bodyType: "Medio", height: 180, preferredAgeMin: 18, preferredAgeMax: 99,
    education: "Laurea", languages: ["English"],
    relationshipType: "Conoscersi prima", wantsChildren: "Non lo so", zodiacSign: "Cancro",
    loveLanguage: "Tempo di qualità", communicationStyle: "Riflessivo e profondo", lifestyle: "Equilibrato"
  },
  {
    id: "83", name: "Daniel", age: 32,
    bio: "Software developer in Boston, originally from London. I run a lot, read a lot, and talk about both more than I should. Looking for someone real.",
    imageUrl: "/images/bots/bot83_main.png", photos: [],
    location: "Boston", interests: ["Running", "Tech", "Reading"], alienType: "Quantico",
    gender: "Uomo", preferredGender: "Tutti", hairColor: "Nero riccio", eyeColor: "Marrone",
    bodyType: "Atletico", height: 178, preferredAgeMin: 18, preferredAgeMax: 99,
    education: "Master", languages: ["English"],
    relationshipType: "Relazione seria", wantsChildren: "In futuro", zodiacSign: "Capricorno",
    loveLanguage: "Parole di affermazione", communicationStyle: "Aperto e diretto", lifestyle: "Attivo e sociale"
  },
  {
    id: "84", name: "Ryan", age: 26,
    bio: "Bartender and aspiring screenwriter in LA. I surf before work, write after, and eat tacos somewhere in between. Not as LA as I sound, I promise.",
    imageUrl: "/images/bots/bot84_main.png", photos: [],
    location: "Los Angeles", interests: ["Surf", "Writing", "Cinema"], alienType: "Viaggiatore Stellare",
    gender: "Uomo", preferredGender: "Tutti", hairColor: "Castano chiaro", eyeColor: "Nocciola",
    bodyType: "Atletico", height: 181, preferredAgeMin: 18, preferredAgeMax: 99,
    education: "Laurea", languages: ["English"],
    relationshipType: "Conoscersi prima", wantsChildren: "Non lo so", zodiacSign: "Leone",
    loveLanguage: "Tempo di qualità", communicationStyle: "Creativo e spontaneo", lifestyle: "Attivo e sociale"
  },
  {
    id: "85", name: "Thomas", age: 34,
    bio: "Architect in London. I spend too much time in museums and not enough time cleaning my flat. Good at recommending restaurants, terrible at picking films.",
    imageUrl: "/images/bots/bot85_main.png", photos: [],
    location: "London", interests: ["Architecture", "Art", "Restaurants"], alienType: "Etereo",
    gender: "Uomo", preferredGender: "Tutti", hairColor: "Nero con grigio", eyeColor: "Marrone",
    bodyType: "Medio", height: 185, preferredAgeMin: 18, preferredAgeMax: 99,
    education: "Master", languages: ["English"],
    relationshipType: "Relazione seria", wantsChildren: "In futuro", zodiacSign: "Vergine",
    loveLanguage: "Atti di servizio", communicationStyle: "Riflessivo e profondo", lifestyle: "Equilibrato"
  },
  {
    id: "86", name: "Nathan", age: 27,
    bio: "Farm manager in the Cotswolds. Early mornings, muddy boots, and border collies are my whole life. Looking for someone who doesn't mind a bit of countryside quiet.",
    imageUrl: "/images/bots/bot86_main.png", photos: [],
    location: "Cotswolds", interests: ["Farming", "Dogs", "Nature"], alienType: "Biotico",
    gender: "Uomo", preferredGender: "Tutti", hairColor: "Rosso-castano", eyeColor: "Azzurro",
    bodyType: "Robusto", height: 179, preferredAgeMin: 18, preferredAgeMax: 99,
    education: "Diploma", languages: ["English"],
    relationshipType: "Relazione seria", wantsChildren: "Sì", zodiacSign: "Toro",
    loveLanguage: "Atti di servizio", communicationStyle: "Aperto e diretto", lifestyle: "Tranquillo e casalingo"
  },
  {
    id: "87", name: "Alex", age: 25,
    bio: "Surf instructor in Cornwall. Part-time photographer. Full-time sandwich enthusiast. I believe every problem can be solved with a walk along the coast.",
    imageUrl: "/images/bots/bot87_main.png", photos: [],
    location: "Cornwall", interests: ["Surf", "Photography", "Outdoors"], alienType: "Nebulare",
    gender: "Uomo", preferredGender: "Tutti", hairColor: "Castano ondulato", eyeColor: "Grigio-verde",
    bodyType: "Atletico", height: 177, preferredAgeMin: 18, preferredAgeMax: 99,
    education: "Diploma", languages: ["English"],
    relationshipType: "Conoscersi prima", wantsChildren: "Non lo so", zodiacSign: "Acquario",
    loveLanguage: "Tempo di qualità", communicationStyle: "Creativo e spontaneo", lifestyle: "Attivo e sociale"
  },
  {
    id: "88", name: "Charlie", age: 29,
    bio: "Librarian in Oxford. Yes, it's as quiet as you'd imagine. I play guitar badly, cook Thai food decently, and can recommend you a book for any mood.",
    imageUrl: "/images/bots/bot88_main.png", photos: [],
    location: "Oxford", interests: ["Books", "Guitar", "Cooking"], alienType: "Cristallino",
    gender: "Uomo", preferredGender: "Tutti", hairColor: "Biondo scuro", eyeColor: "Azzurro",
    bodyType: "Magro", height: 176, preferredAgeMin: 18, preferredAgeMax: 99,
    education: "Laurea", languages: ["English"],
    relationshipType: "Conoscersi prima", wantsChildren: "In futuro", zodiacSign: "Bilancia",
    loveLanguage: "Parole di affermazione", communicationStyle: "Riflessivo e profondo", lifestyle: "Tranquillo e casalingo"
  },
  {
    id: "89", name: "Ben", age: 31,
    bio: "Physical therapist in Philadelphia. I played college basketball, now I just coach kids on Saturdays. Low-key guy who's happiest grilling with friends.",
    imageUrl: "/images/bots/bot89_main.png", photos: [],
    location: "Philadelphia", interests: ["Basketball", "BBQ", "Fitness"], alienType: "Solare",
    gender: "Uomo", preferredGender: "Tutti", hairColor: "Nero corto", eyeColor: "Marrone scuro",
    bodyType: "Atletico", height: 188, preferredAgeMin: 18, preferredAgeMax: 99,
    education: "Master", languages: ["English"],
    relationshipType: "Relazione seria", wantsChildren: "Sì", zodiacSign: "Ariete",
    loveLanguage: "Contatto fisico", communicationStyle: "Aperto e diretto", lifestyle: "Attivo e sociale"
  },
  {
    id: "90", name: "Jack", age: 24,
    bio: "Film student in Bristol. I work part-time at a cinema and spend my tips on vinyl records. Looking for someone to watch weird indie films with at 2am.",
    imageUrl: "/images/bots/bot90_main.png", photos: [],
    location: "Bristol", interests: ["Cinema", "Music", "Skateboard"], alienType: "Dimensionale",
    gender: "Uomo", preferredGender: "Tutti", hairColor: "Castano chiaro disordinato", eyeColor: "Verde",
    bodyType: "Magro", height: 175, preferredAgeMin: 18, preferredAgeMax: 99,
    education: "Università in corso", languages: ["English"],
    relationshipType: "Conoscersi prima", wantsChildren: "Non lo so", zodiacSign: "Gemelli",
    loveLanguage: "Tempo di qualità", communicationStyle: "Creativo e spontaneo", lifestyle: "Equilibrato"
  },
  // === Spanish-speaking bots - Women ===
  {
    id: "91", name: "María", age: 27,
    bio: "Maestra de primaria en Ciudad de México. Me encanta cocinar los domingos, ir al mercado y pasear con mi perro por Coyoacán. Sencilla y cariñosa.",
    imageUrl: "/images/bots/bot91_main.png", photos: [],
    location: "Ciudad de México", interests: ["Cooking", "Dogs", "Markets"], alienType: "Nebulare",
    gender: "Donna", preferredGender: "Tutti", hairColor: "Nero ondulato", eyeColor: "Marrone scuro",
    bodyType: "Media", height: 160, preferredAgeMin: 18, preferredAgeMax: 99,
    education: "Laurea", languages: ["Español"],
    relationshipType: "Relazione seria", wantsChildren: "In futuro", zodiacSign: "Cancro",
    loveLanguage: "Atti di servizio", communicationStyle: "Aperto e diretto", lifestyle: "Equilibrato"
  },
  {
    id: "92", name: "Carmen", age: 30,
    bio: "Diseñadora de interiores en Barcelona. Amo los fines de semana en la playa, el vermut del domingo y las cenas largas con amigos. Buscando buena conversación.",
    imageUrl: "/images/bots/bot92_main.png", photos: [],
    location: "Barcelona", interests: ["Design", "Beach", "Wine"], alienType: "Cristallino",
    gender: "Donna", preferredGender: "Tutti", hairColor: "Nero liscio", eyeColor: "Marrone",
    bodyType: "Media", height: 166, preferredAgeMin: 18, preferredAgeMax: 99,
    education: "Laurea", languages: ["Español", "English"],
    relationshipType: "Conoscersi prima", wantsChildren: "In futuro", zodiacSign: "Bilancia",
    loveLanguage: "Tempo di qualità", communicationStyle: "Aperto e diretto", lifestyle: "Attivo e sociale"
  },
  {
    id: "93", name: "Lucía", age: 25,
    bio: "Estudiante de psicología en Buenos Aires. Tomo mucho mate, voy a recitales y adopto gatos sin planificarlo. Busco alguien genuino y con humor.",
    imageUrl: "/images/bots/bot93_main.png", photos: [],
    location: "Buenos Aires", interests: ["Psychology", "Music", "Cats"], alienType: "Biotico",
    gender: "Donna", preferredGender: "Tutti", hairColor: "Castano riccio", eyeColor: "Marrone chiaro",
    bodyType: "Magra", height: 163, preferredAgeMin: 18, preferredAgeMax: 99,
    education: "Università in corso", languages: ["Español"],
    relationshipType: "Conoscersi prima", wantsChildren: "Non lo so", zodiacSign: "Acquario",
    loveLanguage: "Parole di affermazione", communicationStyle: "Creativo e spontaneo", lifestyle: "Equilibrato"
  },
  {
    id: "94", name: "Isabel", age: 32,
    bio: "Abogada en Madrid. Después del trabajo me encontrarás en clase de pilates o cenando tapas por Malasaña. Valoro la honestidad y las buenas charlas.",
    imageUrl: "/images/bots/bot94_main.png", photos: [],
    location: "Madrid", interests: ["Pilates", "Food", "Travel"], alienType: "Dimensionale",
    gender: "Donna", preferredGender: "Tutti", hairColor: "Castano scuro liscio", eyeColor: "Nocciola",
    bodyType: "Atletica", height: 169, preferredAgeMin: 18, preferredAgeMax: 99,
    education: "Master", languages: ["Español", "English"],
    relationshipType: "Relazione seria", wantsChildren: "In futuro", zodiacSign: "Capricorno",
    loveLanguage: "Tempo di qualità", communicationStyle: "Aperto e diretto", lifestyle: "Attivo e sociale"
  },
  {
    id: "95", name: "Paula", age: 24,
    bio: "Fotógrafa freelance en Bogotá. Me la paso en cafés editando fotos y descubriendo barrios nuevos. Amo las tardes de lluvia y los mercados de pulgas.",
    imageUrl: "/images/bots/bot95_main.png", photos: [],
    location: "Bogotá", interests: ["Photography", "Coffee", "Exploring"], alienType: "Solare",
    gender: "Donna", preferredGender: "Tutti", hairColor: "Nero lungo", eyeColor: "Marrone scuro",
    bodyType: "Magra", height: 161, preferredAgeMin: 18, preferredAgeMax: 99,
    education: "Laurea", languages: ["Español"],
    relationshipType: "Conoscersi prima", wantsChildren: "Non lo so", zodiacSign: "Pesci",
    loveLanguage: "Regali significativi", communicationStyle: "Creativo e spontaneo", lifestyle: "Equilibrato"
  },
  {
    id: "96", name: "Ana", age: 28,
    bio: "Enfermera en Santiago de Chile. Cuando no estoy en el hospital, estoy haciendo senderismo en los cerros o cocinando para mi familia. Tranquila pero alegre.",
    imageUrl: "/images/bots/bot96_main.png", photos: [],
    location: "Santiago", interests: ["Hiking", "Cooking", "Family"], alienType: "Viaggiatore Stellare",
    gender: "Donna", preferredGender: "Tutti", hairColor: "Castano medio", eyeColor: "Marrone",
    bodyType: "Media", height: 164, preferredAgeMin: 18, preferredAgeMax: 99,
    education: "Laurea", languages: ["Español"],
    relationshipType: "Relazione seria", wantsChildren: "Sì", zodiacSign: "Toro",
    loveLanguage: "Atti di servizio", communicationStyle: "Riflessivo e profondo", lifestyle: "Equilibrato"
  },
  {
    id: "97", name: "Valentina", age: 26,
    bio: "Barista en una cafetería artesanal en Lima. Soy fanática del café de especialidad, la lectura y las noches de juegos de mesa. Simple y auténtica.",
    imageUrl: "/images/bots/bot97_main.png", photos: [],
    location: "Lima", interests: ["Coffee", "Reading", "Board Games"], alienType: "Quantico",
    gender: "Donna", preferredGender: "Tutti", hairColor: "Castano scuro ondulato", eyeColor: "Marrone scuro",
    bodyType: "Media", height: 158, preferredAgeMin: 18, preferredAgeMax: 99,
    education: "Diploma", languages: ["Español"],
    relationshipType: "Conoscersi prima", wantsChildren: "Non lo so", zodiacSign: "Vergine",
    loveLanguage: "Tempo di qualità", communicationStyle: "Riflessivo e profondo", lifestyle: "Tranquillo e casalingo"
  },
  {
    id: "98", name: "Camila", age: 23,
    bio: "Estudiante de medicina en Guadalajara. Entre clases y hospitales, me escapo al gimnasio o a una taquería. Busco algo real, sin dramas.",
    imageUrl: "/images/bots/bot98_main.png", photos: [],
    location: "Guadalajara", interests: ["Fitness", "Medicine", "Food"], alienType: "Etereo",
    gender: "Donna", preferredGender: "Tutti", hairColor: "Nero liscio lungo", eyeColor: "Marrone",
    bodyType: "Atletica", height: 165, preferredAgeMin: 18, preferredAgeMax: 99,
    education: "Università in corso", languages: ["Español"],
    relationshipType: "Conoscersi prima", wantsChildren: "In futuro", zodiacSign: "Ariete",
    loveLanguage: "Contatto fisico", communicationStyle: "Aperto e diretto", lifestyle: "Attivo e sociale"
  },
  {
    id: "99", name: "Sofía", age: 29,
    bio: "Community manager en Montevideo. Los fines de semana me encontrás en la rambla con mate, auriculares y algún libro pendiente. Tranquila pero apasionada.",
    imageUrl: "/images/bots/bot99_main.png", photos: [],
    location: "Montevideo", interests: ["Writing", "Music", "Beach"], alienType: "Nebulare",
    gender: "Donna", preferredGender: "Tutti", hairColor: "Castano scuro", eyeColor: "Marrone chiaro",
    bodyType: "Media", height: 167, preferredAgeMin: 18, preferredAgeMax: 99,
    education: "Laurea", languages: ["Español"],
    relationshipType: "Relazione seria", wantsChildren: "In futuro", zodiacSign: "Scorpione",
    loveLanguage: "Parole di affermazione", communicationStyle: "Riflessivo e profondo", lifestyle: "Equilibrato"
  },
  {
    id: "100", name: "Daniela", age: 31,
    bio: "Sommelier en Mendoza. Vivo rodeada de viñedos y montañas. Amo los asados, las caminatas y las charlas largas con una copa de malbec.",
    imageUrl: "/images/bots/bot100_main.png", photos: [],
    location: "Mendoza", interests: ["Wine", "Hiking", "Gastronomy"], alienType: "Cristallino",
    gender: "Donna", preferredGender: "Tutti", hairColor: "Castano riccio scuro", eyeColor: "Marrone",
    bodyType: "Media", height: 170, preferredAgeMin: 18, preferredAgeMax: 99,
    education: "Certificazione professionale", languages: ["Español", "English"],
    relationshipType: "Relazione seria", wantsChildren: "Non lo so", zodiacSign: "Sagittario",
    loveLanguage: "Tempo di qualità", communicationStyle: "Aperto e diretto", lifestyle: "Equilibrato"
  },
  // === Spanish-speaking bots - Men ===
  {
    id: "101", name: "Carlos", age: 30,
    bio: "Chef en un restaurante en Ciudad de México. La cocina es mi pasión, pero también disfruto el fútbol dominguero y las películas de Almodóvar. Soy sencillo.",
    imageUrl: "/images/bots/bot101_main.png", photos: [],
    location: "Ciudad de México", interests: ["Cooking", "Football", "Cinema"], alienType: "Dimensionale",
    gender: "Uomo", preferredGender: "Tutti", hairColor: "Nero corto", eyeColor: "Marrone",
    bodyType: "Medio", height: 176, preferredAgeMin: 18, preferredAgeMax: 99,
    education: "Scuola alberghiera", languages: ["Español"],
    relationshipType: "Relazione seria", wantsChildren: "In futuro", zodiacSign: "Toro",
    loveLanguage: "Atti di servizio", communicationStyle: "Aperto e diretto", lifestyle: "Equilibrato"
  },
  {
    id: "102", name: "Alejandro", age: 28,
    bio: "Ingeniero civil en Medellín. Después del trabajo me gusta salir a correr por el parque o tomarme un café tranquilo. Fácil de tratar y buen oyente.",
    imageUrl: "/images/bots/bot102_main.png", photos: [],
    location: "Medellín", interests: ["Running", "Engineering", "Coffee"], alienType: "Solare",
    gender: "Uomo", preferredGender: "Tutti", hairColor: "Castano scuro ondulato", eyeColor: "Marrone scuro",
    bodyType: "Atletico", height: 180, preferredAgeMin: 18, preferredAgeMax: 99,
    education: "Laurea", languages: ["Español"],
    relationshipType: "Conoscersi prima", wantsChildren: "In futuro", zodiacSign: "Bilancia",
    loveLanguage: "Tempo di qualità", communicationStyle: "Riflessivo e profondo", lifestyle: "Attivo e sociale"
  },
  {
    id: "103", name: "Diego", age: 33,
    bio: "Profesor de historia en Sevilla. Me apasionan los libros viejos, las rutas de tapas y caminar por el barrio de Santa Cruz al atardecer. Tranquilo y curioso.",
    imageUrl: "/images/bots/bot103_main.png", photos: [],
    location: "Sevilla", interests: ["History", "Food", "Walking"], alienType: "Quantico",
    gender: "Uomo", preferredGender: "Tutti", hairColor: "Nero con barba", eyeColor: "Marrone",
    bodyType: "Medio", height: 178, preferredAgeMin: 18, preferredAgeMax: 99,
    education: "Master", languages: ["Español", "English"],
    relationshipType: "Relazione seria", wantsChildren: "Sì", zodiacSign: "Cancro",
    loveLanguage: "Parole di affermazione", communicationStyle: "Riflessivo e profondo", lifestyle: "Tranquillo e casalingo"
  },
  {
    id: "104", name: "Miguel", age: 26,
    bio: "Estudiante de arquitectura en Buenos Aires. Dibujo, tomo café negro y me pierdo en las librerías de Corrientes. Busco alguien con quien compartir un buen disco.",
    imageUrl: "/images/bots/bot104_main.png", photos: [],
    location: "Buenos Aires", interests: ["Architecture", "Music", "Books"], alienType: "Viaggiatore Stellare",
    gender: "Uomo", preferredGender: "Tutti", hairColor: "Castano riccio", eyeColor: "Marrone chiaro",
    bodyType: "Magro", height: 182, preferredAgeMin: 18, preferredAgeMax: 99,
    education: "Università in corso", languages: ["Español"],
    relationshipType: "Conoscersi prima", wantsChildren: "Non lo so", zodiacSign: "Acquario",
    loveLanguage: "Tempo di qualità", communicationStyle: "Creativo e spontaneo", lifestyle: "Equilibrato"
  },
  {
    id: "105", name: "Pablo", age: 31,
    bio: "Veterinario en Valencia. Paso las tardes entre perros y gatos, y los fines de semana en la huerta o en la playa. Me gustan las cosas simples de la vida.",
    imageUrl: "/images/bots/bot105_main.png", photos: [],
    location: "Valencia", interests: ["Animals", "Beach", "Gardening"], alienType: "Biotico",
    gender: "Uomo", preferredGender: "Tutti", hairColor: "Castano corto", eyeColor: "Nocciola",
    bodyType: "Medio", height: 177, preferredAgeMin: 18, preferredAgeMax: 99,
    education: "Laurea", languages: ["Español"],
    relationshipType: "Relazione seria", wantsChildren: "In futuro", zodiacSign: "Vergine",
    loveLanguage: "Atti di servizio", communicationStyle: "Aperto e diretto", lifestyle: "Equilibrato"
  },
  {
    id: "106", name: "Andrés", age: 27,
    bio: "Diseñador gráfico freelance en Quito. Trabajo desde casa con mi gato, salgo a trotar por las mañanas y cocino para relajarme. Creativo pero con los pies en la tierra.",
    imageUrl: "/images/bots/bot106_main.png", photos: [],
    location: "Quito", interests: ["Design", "Running", "Cooking"], alienType: "Etereo",
    gender: "Uomo", preferredGender: "Tutti", hairColor: "Nero", eyeColor: "Marrone",
    bodyType: "Magro", height: 174, preferredAgeMin: 18, preferredAgeMax: 99,
    education: "Laurea", languages: ["Español"],
    relationshipType: "Conoscersi prima", wantsChildren: "Non lo so", zodiacSign: "Gemelli",
    loveLanguage: "Tempo di qualità", communicationStyle: "Creativo e spontaneo", lifestyle: "Tranquillo e casalingo"
  },
  {
    id: "107", name: "Santiago", age: 29,
    bio: "Surfista e instructor de buceo en Punta del Este. Vivo cerca del mar y no me imagino otro estilo de vida. Busco alguien que disfrute de la naturaleza.",
    imageUrl: "/images/bots/bot107_main.png", photos: [],
    location: "Punta del Este", interests: ["Surf", "Diving", "Nature"], alienType: "Nebulare",
    gender: "Uomo", preferredGender: "Tutti", hairColor: "Castano medio", eyeColor: "Marrone scuro",
    bodyType: "Atletico", height: 181, preferredAgeMin: 18, preferredAgeMax: 99,
    education: "Certificazione professionale", languages: ["Español"],
    relationshipType: "Conoscersi prima", wantsChildren: "In futuro", zodiacSign: "Sagittario",
    loveLanguage: "Contatto fisico", communicationStyle: "Aperto e diretto", lifestyle: "Attivo e sociale"
  },
  {
    id: "108", name: "Mateo", age: 25,
    bio: "Barista en una cafetería de especialidad en San José. Me gusta la montaña, tocar guitarra y las tardes de juegos con amigos. Relajado y de buen humor.",
    imageUrl: "/images/bots/bot108_main.png", photos: [],
    location: "San José", interests: ["Coffee", "Guitar", "Hiking"], alienType: "Cristallino",
    gender: "Uomo", preferredGender: "Tutti", hairColor: "Nero corto", eyeColor: "Marrone",
    bodyType: "Medio", height: 175, preferredAgeMin: 18, preferredAgeMax: 99,
    education: "Diploma", languages: ["Español"],
    relationshipType: "Conoscersi prima", wantsChildren: "Non lo so", zodiacSign: "Pesci",
    loveLanguage: "Tempo di qualità", communicationStyle: "Creativo e spontaneo", lifestyle: "Equilibrato"
  },
  {
    id: "109", name: "Javier", age: 35,
    bio: "Enólogo en Rioja. Llevo años entre viñedos y bodegas. Me relajo con un buen libro, una caminata o cocinando algo nuevo. Busco compañía sincera.",
    imageUrl: "/images/bots/bot109_main.png", photos: [],
    location: "Logroño", interests: ["Wine", "Cooking", "Reading"], alienType: "Dimensionale",
    gender: "Uomo", preferredGender: "Tutti", hairColor: "Castano con grigio", eyeColor: "Marrone",
    bodyType: "Medio", height: 179, preferredAgeMin: 18, preferredAgeMax: 99,
    education: "Laurea", languages: ["Español", "English"],
    relationshipType: "Relazione seria", wantsChildren: "Ho già figli", zodiacSign: "Scorpione",
    loveLanguage: "Atti di servizio", communicationStyle: "Riflessivo e profondo", lifestyle: "Tranquillo e casalingo"
  },
  {
    id: "110", name: "Fernando", age: 32,
    bio: "Fisioterapeuta en Lima. Trabajo con deportistas y los fines de semana juego fútbol con amigos. Me gusta la buena comida y las conversaciones honestas.",
    imageUrl: "/images/bots/bot110_main.png", photos: [],
    location: "Lima", interests: ["Football", "Fitness", "Food"], alienType: "Solare",
    gender: "Uomo", preferredGender: "Tutti", hairColor: "Castano ondulato", eyeColor: "Marrone scuro",
    bodyType: "Atletico", height: 183, preferredAgeMin: 18, preferredAgeMax: 99,
    education: "Laurea", languages: ["Español"],
    relationshipType: "Relazione seria", wantsChildren: "Sì", zodiacSign: "Leone",
    loveLanguage: "Contatto fisico", communicationStyle: "Aperto e diretto", lifestyle: "Attivo e sociale"
  },
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
  { profileId: "19", email: "matteo.t@vibra.com", password: "Vibra2024!", firstName: "Matteo", lastName: "Moretti" },
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
  { profileId: "41", email: "giorgia@vibra.com", password: "Vibra2024!", firstName: "Giorgia", lastName: "Ferretti" },
  { profileId: "42", email: "lorenzo@vibra.com", password: "Vibra2024!", firstName: "Lorenzo", lastName: "Gallo" },
  { profileId: "43", email: "elisa@vibra.com", password: "Vibra2024!", firstName: "Elisa", lastName: "Pellegrini" },
  { profileId: "44", email: "simonem@vibra.com", password: "Vibra2024!", firstName: "Simone", lastName: "Mazza" },
  { profileId: "45", email: "roberta@vibra.com", password: "Vibra2024!", firstName: "Roberta", lastName: "Palumbo" },
  { profileId: "46", email: "fabio@vibra.com", password: "Vibra2024!", firstName: "Fabio", lastName: "Serra" },
  { profileId: "47", email: "anna@vibra.com", password: "Vibra2024!", firstName: "Anna", lastName: "Costa" },
  { profileId: "48", email: "giuseppe@vibra.com", password: "Vibra2024!", firstName: "Giuseppe", lastName: "Amato" },
  { profileId: "49", email: "lucia@vibra.com", password: "Vibra2024!", firstName: "Lucia", lastName: "Rizzi" },
  { profileId: "50", email: "daniele@vibra.com", password: "Vibra2024!", firstName: "Daniele", lastName: "Morandi" },
  { profileId: "51", email: "ilaria@vibra.com", password: "Vibra2024!", firstName: "Ilaria", lastName: "Silvestri" },
  { profileId: "52", email: "nicola@vibra.com", password: "Vibra2024!", firstName: "Nicola", lastName: "Fabbri" },
  { profileId: "53", email: "claudia@vibra.com", password: "Vibra2024!", firstName: "Claudia", lastName: "Marini" },
  { profileId: "54", email: "paolo@vibra.com", password: "Vibra2024!", firstName: "Paolo", lastName: "Gentile" },
  { profileId: "55", email: "michela@vibra.com", password: "Vibra2024!", firstName: "Michela", lastName: "Barone" },
  { profileId: "56", email: "emanuele@vibra.com", password: "Vibra2024!", firstName: "Emanuele", lastName: "Leone" },
  { profileId: "57", email: "sara@vibra.com", password: "Vibra2024!", firstName: "Sara", lastName: "Fontana" },
  { profileId: "58", email: "antonio@vibra.com", password: "Vibra2024!", firstName: "Antonio", lastName: "Ruggiero" },
  { profileId: "59", email: "valentinab@vibra.com", password: "Vibra2024!", firstName: "Valentina", lastName: "Bernardi" },
  { profileId: "60", email: "giovanni@vibra.com", password: "Vibra2024!", firstName: "Giovanni", lastName: "Messina" },
  { profileId: "61", email: "serenag@vibra.com", password: "Vibra2024!", firstName: "Serena", lastName: "Grasso" },
  { profileId: "62", email: "simone@vibra.com", password: "Vibra2024!", firstName: "Simone", lastName: "Monti" },
  { profileId: "63", email: "patrizia@vibra.com", password: "Vibra2024!", firstName: "Patrizia", lastName: "Benedetti" },
  { profileId: "64", email: "marcoa@vibra.com", password: "Vibra2024!", firstName: "Marco", lastName: "Riva" },
  { profileId: "65", email: "arianna@vibra.com", password: "Vibra2024!", firstName: "Arianna", lastName: "Longo" },
  { profileId: "66", email: "franco@vibra.com", password: "Vibra2024!", firstName: "Franco", lastName: "Donati" },
  { profileId: "67", email: "riccardo@vibra.com", password: "Vibra2024!", firstName: "Riccardo", lastName: "Sala" },
  { profileId: "68", email: "giacomo@vibra.com", password: "Vibra2024!", firstName: "Giacomo", lastName: "Testa" },
  { profileId: "69", email: "giuliana@vibra.com", password: "Vibra2024!", firstName: "Giuliana", lastName: "D'Angelo" },
  { profileId: "70", email: "piero@vibra.com", password: "Vibra2024!", firstName: "Piero", lastName: "Sartori" },
  // English-speaking bots
  { profileId: "71", email: "emily@vibra.com", password: "Vibra2024!", firstName: "Emily", lastName: "Clarke" },
  { profileId: "72", email: "sarah@vibra.com", password: "Vibra2024!", firstName: "Sarah", lastName: "Mitchell" },
  { profileId: "73", email: "jessica@vibra.com", password: "Vibra2024!", firstName: "Jessica", lastName: "Brooks" },
  { profileId: "74", email: "hannah@vibra.com", password: "Vibra2024!", firstName: "Hannah", lastName: "Chen" },
  { profileId: "75", email: "olivia@vibra.com", password: "Vibra2024!", firstName: "Olivia", lastName: "Patel" },
  { profileId: "76", email: "chloe@vibra.com", password: "Vibra2024!", firstName: "Chloe", lastName: "Taylor" },
  { profileId: "77", email: "megan@vibra.com", password: "Vibra2024!", firstName: "Megan", lastName: "Sullivan" },
  { profileId: "78", email: "lauren@vibra.com", password: "Vibra2024!", firstName: "Lauren", lastName: "Harper" },
  { profileId: "79", email: "sophie@vibra.com", password: "Vibra2024!", firstName: "Sophie", lastName: "Williams" },
  { profileId: "80", email: "rachel@vibra.com", password: "Vibra2024!", firstName: "Rachel", lastName: "Kim" },
  { profileId: "81", email: "james@vibra.com", password: "Vibra2024!", firstName: "James", lastName: "Wright" },
  { profileId: "82", email: "william@vibra.com", password: "Vibra2024!", firstName: "William", lastName: "Scott" },
  { profileId: "83", email: "daniel@vibra.com", password: "Vibra2024!", firstName: "Daniel", lastName: "Okonkwo" },
  { profileId: "84", email: "ryan@vibra.com", password: "Vibra2024!", firstName: "Ryan", lastName: "Cooper" },
  { profileId: "85", email: "thomas@vibra.com", password: "Vibra2024!", firstName: "Thomas", lastName: "Bennett" },
  { profileId: "86", email: "nathan@vibra.com", password: "Vibra2024!", firstName: "Nathan", lastName: "Moore" },
  { profileId: "87", email: "alex@vibra.com", password: "Vibra2024!", firstName: "Alex", lastName: "Davies" },
  { profileId: "88", email: "charlie@vibra.com", password: "Vibra2024!", firstName: "Charlie", lastName: "Price" },
  { profileId: "89", email: "ben@vibra.com", password: "Vibra2024!", firstName: "Ben", lastName: "Carter" },
  { profileId: "90", email: "jack@vibra.com", password: "Vibra2024!", firstName: "Jack", lastName: "Hughes" },
  // Spanish-speaking bots
  { profileId: "91", email: "maria@vibra.com", password: "Vibra2024!", firstName: "María", lastName: "López" },
  { profileId: "92", email: "carmen@vibra.com", password: "Vibra2024!", firstName: "Carmen", lastName: "Fernández" },
  { profileId: "93", email: "lucia@vibra.com", password: "Vibra2024!", firstName: "Lucía", lastName: "Ramírez" },
  { profileId: "94", email: "isabel@vibra.com", password: "Vibra2024!", firstName: "Isabel", lastName: "Martínez" },
  { profileId: "95", email: "paula@vibra.com", password: "Vibra2024!", firstName: "Paula", lastName: "Gutiérrez" },
  { profileId: "96", email: "ana@vibra.com", password: "Vibra2024!", firstName: "Ana", lastName: "Morales" },
  { profileId: "97", email: "valentina@vibra.com", password: "Vibra2024!", firstName: "Valentina", lastName: "Torres" },
  { profileId: "98", email: "camila@vibra.com", password: "Vibra2024!", firstName: "Camila", lastName: "Herrera" },
  { profileId: "99", email: "sofia@vibra.com", password: "Vibra2024!", firstName: "Sofía", lastName: "Vargas" },
  { profileId: "100", email: "daniela@vibra.com", password: "Vibra2024!", firstName: "Daniela", lastName: "Mendoza" },
  { profileId: "101", email: "carlos@vibra.com", password: "Vibra2024!", firstName: "Carlos", lastName: "García" },
  { profileId: "102", email: "alejandro@vibra.com", password: "Vibra2024!", firstName: "Alejandro", lastName: "Ríos" },
  { profileId: "103", email: "diego@vibra.com", password: "Vibra2024!", firstName: "Diego", lastName: "Sánchez" },
  { profileId: "104", email: "miguel@vibra.com", password: "Vibra2024!", firstName: "Miguel", lastName: "Romero" },
  { profileId: "105", email: "pablo@vibra.com", password: "Vibra2024!", firstName: "Pablo", lastName: "Navarro" },
  { profileId: "106", email: "andres@vibra.com", password: "Vibra2024!", firstName: "Andrés", lastName: "Castillo" },
  { profileId: "107", email: "santiago@vibra.com", password: "Vibra2024!", firstName: "Santiago", lastName: "Díaz" },
  { profileId: "108", email: "mateos@vibra.com", password: "Vibra2024!", firstName: "Mateo", lastName: "Peña" },
  { profileId: "109", email: "javier@vibra.com", password: "Vibra2024!", firstName: "Javier", lastName: "Ruiz" },
  { profileId: "110", email: "fernando@vibra.com", password: "Vibra2024!", firstName: "Fernando", lastName: "Vega" },
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
    const existingBotProfiles = seedProfiles.filter(p => existingIds.has(p.id));
    
    if (missingProfiles.length > 0) {
      console.log(`Seeding ${missingProfiles.length} new bot profiles...`);
      for (const profile of missingProfiles) {
        const coords = cityCoords[profile.location] || null;
        await db.insert(profiles).values({ ...profile, isBot: true, points: 0, ratingEnabled: false, profileLatitude: coords?.lat || null, profileLongitude: coords?.lng || null });
      }
      console.log("Bot profiles seeded successfully!");
    }

    if (existingBotProfiles.length > 0) {
      console.log(`Updating ${existingBotProfiles.length} existing bot profiles with new data...`);
      for (const profile of existingBotProfiles) {
        const coords = cityCoords[profile.location] || null;
        const { id, ...updateData } = profile;
        await db.update(profiles).set({
          ...updateData,
          isBot: true,
          profileLatitude: coords?.lat || null,
          profileLongitude: coords?.lng || null,
        }).where(eq(profiles.id, id));
      }
      console.log("Bot profiles updated successfully!");
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

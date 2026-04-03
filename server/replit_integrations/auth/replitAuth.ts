import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import bcrypt from "bcryptjs";
import { authStorage } from "./storage";
import { OAuth2Client } from "google-auth-library";
import jwt from "jsonwebtoken";
import jwksClient from "jwks-rsa";

let _sessionMiddleware: ReturnType<typeof session> | null = null;

export function getSession() {
  if (_sessionMiddleware) return _sessionMiddleware;
  const sessionTtl = 7 * 24 * 60 * 60 * 1000;
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  _sessionMiddleware = session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    proxy: true,
    cookie: {
      httpOnly: true,
      secure: "auto",
      sameSite: "lax",
      maxAge: sessionTtl,
    },
  });
  return _sessionMiddleware;
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());

  app.post("/api/auth/register", async (req, res) => {
    try {
      const { email, password, name, lastName: reqLastName, gender, age } = req.body;

      if (!email || !password || !name) {
        return res.status(400).json({ message: "Email, password e nome sono obbligatori" });
      }

      if (password.length < 8) {
        return res.status(400).json({ message: "La password deve avere almeno 8 caratteri" });
      }

      const existingUser = await authStorage.getUserByEmail(email);
      if (existingUser && existingUser.password) {
        return res.status(409).json({ message: "Un account con questa email esiste già" });
      }

      if (age !== undefined && (isNaN(Number(age)) || Number(age) < 18 || Number(age) > 120)) {
        return res.status(400).json({ message: "L'età deve essere tra 18 e 120 anni" });
      }

      const hashedPassword = await bcrypt.hash(password, 12);
      const firstName = name.trim();
      const lastName = reqLastName ? reqLastName.trim() : "";

      let user;
      if (existingUser) {
        const updated = await authStorage.updateUserPassword(existingUser.id, hashedPassword);
        if (!updated) {
          return res.status(500).json({ message: "Errore durante l'aggiornamento dell'account" });
        }
        user = updated;
      } else {
        user = await authStorage.upsertUser({
          email,
          password: hashedPassword,
          firstName,
          lastName,
        });
      }

      (req.session as any).userId = user.id;

      try {
        const { db } = await import("../../db");
        const { profiles } = await import("../../../shared/schema");
        const { eq, sql } = await import("drizzle-orm");
        const existingProfile = await db.select().from(profiles).where(eq(profiles.userId, String(user.id))).limit(1);
        if (!existingProfile.length) {
          const alienTypes = ["Nebulare", "Cristallino", "Biotico", "Dimensionale", "Solare", "Viaggiatore Stellare", "Quantico", "Etereo"];
          const randomAlienType = alienTypes[Math.floor(Math.random() * alienTypes.length)];
          let refCode = "";
          for (let i = 0; i < 10; i++) {
            const candidate = "VBR-" + Math.random().toString(36).substring(2, 8).toUpperCase();
            const [existing] = await db.select().from(profiles).where(eq(profiles.referralCode, candidate));
            if (!existing) { refCode = candidate; break; }
          }
          if (!refCode) refCode = "VBR-" + Date.now().toString(36).toUpperCase();

          await db.insert(profiles).values({
            id: sql`gen_random_uuid()`,
            userId: String(user.id),
            name: firstName,
            age: age ? Number(age) : 25,
            bio: "",
            imageUrl: "/images/avatar-1.png",
            location: "",
            interests: [],
            alienType: randomAlienType,
            isBot: false,
            isVerified: false,
            gender: gender || null,
            points: 0,
            referralCode: refCode,
          });
        }
      } catch (profileErr) {
        console.error("Auto-create profile error (non-fatal):", profileErr);
      }

      try {
        const { sendWelcomeEmail } = await import("../../gmail");
        sendWelcomeEmail(email, firstName).catch((err: any) =>
          console.error("[welcome-email] async send error:", err.message)
        );
      } catch (emailErr) {
        console.error("Welcome email error (non-fatal):", emailErr);
      }

      res.status(201).json({ id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ message: "Errore durante la registrazione" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ message: "Email e password sono obbligatori" });
      }

      const trimmedEmail = email.trim().toLowerCase();
      const user = await authStorage.getUserByEmail(trimmedEmail);
      
      if (!user) {
        return res.status(401).json({ message: "Email o password non corretti" });
      }
      
      if (!user.password) {
        return res.status(401).json({ message: "Email o password non corretti" });
      }

      const isValid = await bcrypt.compare(password, user.password);
      if (!isValid) {
        return res.status(401).json({ message: "Email o password non corretti" });
      }

      (req.session as any).userId = user.id;
      res.json({ user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, isAdmin: user.isAdmin } });
    } catch (error: any) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Errore server durante l'accesso" });
    }
  });

  app.post("/api/auth/change-password", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Non autenticato" });
      }

      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: "Password attuale e nuova password sono obbligatorie" });
      }

      if (newPassword.length < 8) {
        return res.status(400).json({ message: "La nuova password deve avere almeno 8 caratteri" });
      }

      const user = await authStorage.getUser(userId);
      if (!user || !user.password) {
        return res.status(400).json({ message: "Account non trovato o senza password" });
      }

      const isValid = await bcrypt.compare(currentPassword, user.password);
      if (!isValid) {
        return res.status(401).json({ message: "La password attuale non è corretta" });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 12);
      await authStorage.updateUserPassword(userId, hashedPassword);

      res.json({ message: "Password aggiornata con successo" });
    } catch (error) {
      console.error("Change password error:", error);
      res.status(500).json({ message: "Errore durante il cambio password" });
    }
  });

  app.post("/api/auth/google", async (req, res) => {
    try {
      const { credential } = req.body;
      if (!credential) {
        return res.status(400).json({ message: "Token mancante" });
      }

      const googleClientId = process.env.GOOGLE_CLIENT_ID;
      if (!googleClientId) {
        return res.status(500).json({ message: "Google Sign-In non configurato" });
      }

      const client = new OAuth2Client(googleClientId);
      const ticket = await client.verifyIdToken({
        idToken: credential,
        audience: googleClientId,
      });
      const payload = ticket.getPayload();
      if (!payload || !payload.email) {
        return res.status(400).json({ message: "Token non valido" });
      }

      const email = payload.email.toLowerCase().trim();
      const firstName = payload.given_name || "";
      const lastName = payload.family_name || "";
      const profileImageUrl = payload.picture || null;

      let user = await authStorage.getUserByEmail(email);
      if (!user) {
        user = await authStorage.upsertUser({
          email,
          firstName,
          lastName,
          profileImageUrl,
        });
      }

      (req.session as any).userId = user.id;
      res.json({ user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, isAdmin: user.isAdmin } });
    } catch (error: any) {
      console.error("Google auth error:", error);
      res.status(401).json({ message: "Autenticazione Google fallita" });
    }
  });

  const appleJwksClient = jwksClient({
    jwksUri: "https://appleid.apple.com/auth/keys",
    cache: true,
    rateLimit: true,
  });

  function getAppleSigningKey(header: jwt.JwtHeader): Promise<string> {
    return new Promise((resolve, reject) => {
      appleJwksClient.getSigningKey(header.kid, (err, key) => {
        if (err) return reject(err);
        resolve(key!.getPublicKey());
      });
    });
  }

  app.post("/api/auth/apple", async (req, res) => {
    try {
      const { id_token, user: appleUser } = req.body;
      if (!id_token) {
        return res.status(400).json({ message: "Token mancante" });
      }

      const appleClientId = process.env.APPLE_CLIENT_ID;
      if (!appleClientId) {
        return res.status(500).json({ message: "Apple Sign-In non configurato" });
      }

      const decoded = jwt.decode(id_token, { complete: true });
      if (!decoded || !decoded.header) {
        return res.status(400).json({ message: "Token non valido" });
      }

      const signingKey = await getAppleSigningKey(decoded.header);
      const verified = jwt.verify(id_token, signingKey, {
        algorithms: ["RS256"],
        issuer: "https://appleid.apple.com",
        audience: appleClientId,
      }) as any;

      if (!verified.email) {
        return res.status(400).json({ message: "Email non disponibile dal token Apple" });
      }

      if (verified.email_verified === false) {
        return res.status(400).json({ message: "Email Apple non verificata" });
      }

      const email = verified.email.toLowerCase().trim();
      let firstName = "";
      let lastName = "";

      if (appleUser && appleUser.name) {
        firstName = appleUser.name.firstName || "";
        lastName = appleUser.name.lastName || "";
      }

      let user = await authStorage.getUserByEmail(email);
      if (!user) {
        user = await authStorage.upsertUser({
          email,
          firstName: firstName || "Utente",
          lastName: lastName || "",
        });
      }

      (req.session as any).userId = user.id;
      res.json({ user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, isAdmin: user.isAdmin } });
    } catch (error: any) {
      console.error("Apple auth error:", error);
      res.status(401).json({ message: "Autenticazione Apple fallita" });
    }
  });

  const forgotPasswordAttempts = new Map<string, { count: number; lastAttempt: number }>();
  const FORGOT_PASSWORD_MAX_ATTEMPTS = 5;
  const FORGOT_PASSWORD_WINDOW_MS = 15 * 60 * 1000;

  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const { email, firstName, lastName, newPassword } = req.body;

      if (!email || !firstName || !newPassword) {
        return res.status(400).json({ message: "Tutti i campi sono obbligatori" });
      }

      if (newPassword.length < 8) {
        return res.status(400).json({ message: "La nuova password deve avere almeno 8 caratteri" });
      }

      const trimmedEmail = email.trim().toLowerCase();
      const clientIp = req.ip || req.socket.remoteAddress || "unknown";
      const rateLimitKey = `${clientIp}:${trimmedEmail}`;
      const now = Date.now();
      const attempts = forgotPasswordAttempts.get(rateLimitKey);

      if (attempts) {
        if (now - attempts.lastAttempt < FORGOT_PASSWORD_WINDOW_MS) {
          if (attempts.count >= FORGOT_PASSWORD_MAX_ATTEMPTS) {
            return res.status(429).json({ message: "Troppi tentativi. Riprova tra 15 minuti." });
          }
          attempts.count++;
          attempts.lastAttempt = now;
        } else {
          forgotPasswordAttempts.set(rateLimitKey, { count: 1, lastAttempt: now });
        }
      } else {
        forgotPasswordAttempts.set(rateLimitKey, { count: 1, lastAttempt: now });
      }

      const genericError = "I dati inseriti non corrispondono. Verifica email, nome e cognome.";

      const user = await authStorage.getUserByEmail(trimmedEmail);

      if (!user) {
        return res.status(400).json({ message: genericError });
      }

      const nameMatch = user.firstName?.toLowerCase().trim() === firstName.toLowerCase().trim();
      const lastNameMatch = !user.lastName || user.lastName.trim() === "" || user.lastName?.toLowerCase().trim() === (lastName || "").toLowerCase().trim();

      if (!nameMatch || !lastNameMatch) {
        return res.status(400).json({ message: genericError });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 12);
      await authStorage.updateUserPassword(user.id, hashedPassword);

      const successAttempts = forgotPasswordAttempts.get(rateLimitKey);
      if (successAttempts) forgotPasswordAttempts.delete(rateLimitKey);

      res.json({ message: "Password aggiornata con successo! Ora puoi accedere." });
    } catch (error) {
      console.error("Forgot password error:", error);
      res.status(500).json({ message: "Errore durante il ripristino della password" });
    }
  });

  app.get("/api/logout", (req, res) => {
    req.session.destroy(() => {
      res.redirect("/");
    });
  });

  app.post("/api/logout", (req, res) => {
    req.session.destroy(() => {
      res.json({ ok: true });
    });
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const userId = (req.session as any)?.userId;
  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  (req as any).user = { claims: { sub: userId } };
  return next();
};

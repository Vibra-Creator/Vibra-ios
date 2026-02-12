import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import bcrypt from "bcryptjs";
import { authStorage } from "./storage";

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000;
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
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
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());

  app.post("/api/auth/register", async (req, res) => {
    try {
      const { email, password, name } = req.body;

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

      const hashedPassword = await bcrypt.hash(password, 12);
      const nameParts = name.trim().split(" ");
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(" ") || "";

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

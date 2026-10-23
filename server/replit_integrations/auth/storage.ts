import { users, type User, type UpsertUser } from "@shared/models/auth";
import { db } from "../../db";
import { eq, sql } from "drizzle-orm";

export interface IAuthStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUserPassword(id: string, hashedPassword: string): Promise<User>;
  promoteUserToAdmin(id: string): Promise<User>;
  setEmailVerificationToken(id: string, token: string): Promise<void>;
  verifyEmailByToken(token: string): Promise<User | undefined>;
  getUserByVerificationToken(token: string): Promise<User | undefined>;
  markEmailVerified(id: string): Promise<void>;
}

class AuthStorage implements IAuthStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(sql`lower(trim(${users.email}))`, email.trim().toLowerCase()));
    return user;
  }

  async updateUserPassword(id: string, hashedPassword: string): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ password: hashedPassword, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async promoteUserToAdmin(id: string): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ isAdmin: true, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async setEmailVerificationToken(id: string, token: string): Promise<void> {
    await db.update(users)
      .set({ emailVerificationToken: token, emailVerified: false, updatedAt: new Date() })
      .where(eq(users.id, id));
  }

  async getUserByVerificationToken(token: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.emailVerificationToken, token));
    return user;
  }

  async verifyEmailByToken(token: string): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ emailVerified: true, emailVerificationToken: null, updatedAt: new Date() })
      .where(eq(users.emailVerificationToken, token))
      .returning();
    return user;
  }

  async markEmailVerified(id: string): Promise<void> {
    await db.update(users)
      .set({ emailVerified: true, emailVerificationToken: null, updatedAt: new Date() })
      .where(eq(users.id, id));
  }
}

export const authStorage = new AuthStorage();

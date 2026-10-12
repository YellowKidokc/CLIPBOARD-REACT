import { db } from "./db";
import { eq, desc, like, or } from "drizzle-orm";
import {
  clips, type Clip, type InsertClip,
  tags, type Tag, type InsertTag,
  bookmarks, type Bookmark, type InsertBookmark,
  prompts, type Prompt, type InsertPrompt,
  uploads, type Upload, type InsertUpload,
  users, type User, type InsertUser,
} from "@shared/schema";

export interface ClipListOptions {
  limit?: number;
  q?: string;
}

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  getClips(opts?: ClipListOptions): Promise<Clip[]>;
  getClip(id: string): Promise<Clip | undefined>;
  createClip(clip: InsertClip): Promise<Clip>;
  updateClip(id: string, data: Partial<InsertClip>): Promise<Clip | undefined>;
  deleteClip(id: string): Promise<void>;

  getTags(): Promise<Tag[]>;
  createTag(tag: InsertTag): Promise<Tag>;
  deleteTag(id: string): Promise<void>;

  getBookmarks(): Promise<Bookmark[]>;
  getBookmark(id: string): Promise<Bookmark | undefined>;
  createBookmark(bookmark: InsertBookmark): Promise<Bookmark>;
  updateBookmark(id: string, data: Partial<InsertBookmark>): Promise<Bookmark | undefined>;
  deleteBookmark(id: string): Promise<void>;

  getPrompts(): Promise<Prompt[]>;
  getPrompt(id: string): Promise<Prompt | undefined>;
  createPrompt(prompt: InsertPrompt): Promise<Prompt>;
  updatePrompt(id: string, data: Partial<InsertPrompt>): Promise<Prompt | undefined>;
  deletePrompt(id: string): Promise<void>;

  getUploads(): Promise<Upload[]>;
  createUpload(upload: InsertUpload): Promise<Upload>;
  deleteUpload(id: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }
  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }
  async createUser(user: InsertUser): Promise<User> {
    const [created] = await db.insert(users).values(user).returning();
    return created;
  }

  async getClips(opts: ClipListOptions = {}): Promise<Clip[]> {
    const q = opts.q?.trim();
    const where = q ? or(like(clips.title, `%${q}%`), like(clips.content, `%${q}%`)) : undefined;
    const query = db.select().from(clips).where(where).orderBy(desc(clips.updatedAt));
    return opts.limit ? query.limit(opts.limit) : query;
  }
  async getClip(id: string): Promise<Clip | undefined> {
    const [clip] = await db.select().from(clips).where(eq(clips.id, id));
    return clip;
  }
  async createClip(clip: InsertClip): Promise<Clip> {
    const values = {
      ...clip,
      fields: typeof clip.fields === "string" ? clip.fields : JSON.stringify(clip.fields || []),
      tags: typeof clip.tags === "string" ? clip.tags : JSON.stringify(clip.tags || []),
    };
    const [created] = await db.insert(clips).values(values).returning();
    return created;
  }
  async updateClip(id: string, data: Partial<InsertClip>): Promise<Clip | undefined> {
    const values: any = { ...data, updatedAt: new Date().toISOString() };
    if (data.fields !== undefined) {
      values.fields = typeof data.fields === "string" ? data.fields : JSON.stringify(data.fields);
    }
    if (data.tags !== undefined) {
      values.tags = typeof data.tags === "string" ? data.tags : JSON.stringify(data.tags);
    }
    const [updated] = await db.update(clips)
      .set(values)
      .where(eq(clips.id, id))
      .returning();
    return updated;
  }
  async deleteClip(id: string): Promise<void> {
    await db.delete(clips).where(eq(clips.id, id));
  }

  async getTags(): Promise<Tag[]> {
    return db.select().from(tags);
  }
  async createTag(tag: InsertTag): Promise<Tag> {
    const [created] = await db.insert(tags).values(tag).returning();
    return created;
  }
  async deleteTag(id: string): Promise<void> {
    await db.delete(tags).where(eq(tags.id, id));
  }

  async getBookmarks(): Promise<Bookmark[]> {
    return db.select().from(bookmarks).orderBy(desc(bookmarks.createdAt));
  }
  async getBookmark(id: string): Promise<Bookmark | undefined> {
    const [bookmark] = await db.select().from(bookmarks).where(eq(bookmarks.id, id));
    return bookmark;
  }
  async createBookmark(bookmark: InsertBookmark): Promise<Bookmark> {
    const values = {
      ...bookmark,
      bookmarkTags: typeof bookmark.bookmarkTags === "string" ? bookmark.bookmarkTags : JSON.stringify(bookmark.bookmarkTags || []),
    };
    const [created] = await db.insert(bookmarks).values(values).returning();
    return created;
  }
  async updateBookmark(id: string, data: Partial<InsertBookmark>): Promise<Bookmark | undefined> {
    const values: any = { ...data };
    if (data.bookmarkTags !== undefined) {
      values.bookmarkTags = typeof data.bookmarkTags === "string" ? data.bookmarkTags : JSON.stringify(data.bookmarkTags);
    }
    const [updated] = await db.update(bookmarks)
      .set(values)
      .where(eq(bookmarks.id, id))
      .returning();
    return updated;
  }
  async deleteBookmark(id: string): Promise<void> {
    await db.delete(bookmarks).where(eq(bookmarks.id, id));
  }

  async getPrompts(): Promise<Prompt[]> {
    return db.select().from(prompts).orderBy(desc(prompts.createdAt));
  }
  async getPrompt(id: string): Promise<Prompt | undefined> {
    const [prompt] = await db.select().from(prompts).where(eq(prompts.id, id));
    return prompt;
  }
  async createPrompt(prompt: InsertPrompt): Promise<Prompt> {
    const [created] = await db.insert(prompts).values(prompt).returning();
    return created;
  }
  async updatePrompt(id: string, data: Partial<InsertPrompt>): Promise<Prompt | undefined> {
    const [updated] = await db.update(prompts)
      .set(data)
      .where(eq(prompts.id, id))
      .returning();
    return updated;
  }
  async deletePrompt(id: string): Promise<void> {
    await db.delete(prompts).where(eq(prompts.id, id));
  }

  async getUploads(): Promise<Upload[]> {
    return db.select().from(uploads).orderBy(desc(uploads.createdAt));
  }
  async createUpload(upload: InsertUpload): Promise<Upload> {
    const [created] = await db.insert(uploads).values(upload).returning();
    return created;
  }
  async deleteUpload(id: string): Promise<void> {
    await db.delete(uploads).where(eq(uploads.id, id));
  }
}

export const storage = new DatabaseStorage();

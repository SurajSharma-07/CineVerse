import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import * as schema from './schema';
import dotenv from 'dotenv';
import { eq } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

dotenv.config();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export let db: any = null;
export let isDatabaseConnected = false;

// Mock database store for safe fallback
export interface MockMovie {
  id: string;
  userId: string;
  title: string;
  thumbnailUrl: string;
  thumbnailKey: string | null;
  aspectRatio: '16:9' | '9:16';
  collection: 'watched' | 'watchLater';
  createdAt: Date;
  updatedAt: Date;
}

export interface MockUser {
  id: string;
  name: string;
  email: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface MockRecommendation {
  id: string;
  title: string;
  thumbnailUrl: string;
  thumbnailKey: string | null;
  rank: number;
  recommendedBy: string;
  createdAt: Date;
}

export const mockUsers: MockUser[] = [
  {
    id: 'manus-user',
    name: 'Cinematic Explorer',
    email: 'explorer@cinematic.com',
    createdAt: new Date(),
    updatedAt: new Date(),
  }
];

// JSON Local persistence files
const MOVIES_FILE = path.join(process.cwd(), 'movies.json');
const RECS_FILE = path.join(process.cwd(), 'recommendations.json');

const defaultMovies: MockMovie[] = [
  {
    id: '1',
    userId: 'manus-user',
    title: 'Inception (Cinematic Re-release)',
    thumbnailUrl: '/thumbnails/inception.png',
    thumbnailKey: null,
    aspectRatio: '16:9',
    collection: 'watchLater',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: '2',
    userId: 'manus-user',
    title: 'The Dark Knight',
    thumbnailUrl: '/thumbnails/dark_knight.png',
    thumbnailKey: null,
    aspectRatio: '16:9',
    collection: 'watched',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: '3',
    userId: 'manus-user',
    title: 'Interstellar - 10th Anniversary',
    thumbnailUrl: '/thumbnails/interstellar.png',
    thumbnailKey: null,
    aspectRatio: '9:16',
    collection: 'watchLater',
    createdAt: new Date(),
    updatedAt: new Date(),
  }
];

const defaultRecommendations: MockRecommendation[] = [
  {
    id: 'rec-1',
    title: 'The Shawshank Redemption',
    thumbnailUrl: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=500&auto=format&fit=crop&q=80',
    thumbnailKey: null,
    rank: 1,
    recommendedBy: 'Nolan Fan',
    createdAt: new Date(),
  },
  {
    id: 'rec-2',
    title: 'Pulp Fiction',
    thumbnailUrl: 'https://images.unsplash.com/photo-1594909122845-11baa439b7bf?w=500&auto=format&fit=crop&q=80',
    thumbnailKey: null,
    rank: 2,
    recommendedBy: 'Quentin Guy',
    createdAt: new Date(),
  }
];

interface JSONMovie {
  id: string;
  userId: string;
  title: string;
  thumbnailUrl: string;
  thumbnailKey: string | null;
  aspectRatio: '16:9' | '9:16';
  collection: 'watched' | 'watchLater';
  createdAt: string;
  updatedAt: string;
}

interface JSONRecommendation {
  id: string;
  title: string;
  thumbnailUrl: string;
  thumbnailKey: string | null;
  rank: number;
  recommendedBy: string;
  createdAt: string;
}

// Persistent Load Helpers
export function loadMockMovies(): MockMovie[] {
  try {
    if (fs.existsSync(MOVIES_FILE)) {
      const data = fs.readFileSync(MOVIES_FILE, 'utf8');
      const parsed = JSON.parse(data) as JSONMovie[];
      return parsed.map((m: JSONMovie) => ({
        ...m,
        createdAt: new Date(m.createdAt),
        updatedAt: new Date(m.updatedAt),
      }));
    }
  } catch (err) {
    console.error('Failed to load local movies.json, using defaults:', err);
  }
  saveMockMovies(defaultMovies);
  return [...defaultMovies];
}

export function saveMockMovies(movies: MockMovie[]) {
  try {
    fs.writeFileSync(MOVIES_FILE, JSON.stringify(movies, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to save local movies.json:', err);
  }
}

export function loadMockRecommendations(): MockRecommendation[] {
  try {
    if (fs.existsSync(RECS_FILE)) {
      const data = fs.readFileSync(RECS_FILE, 'utf8');
      const parsed = JSON.parse(data) as JSONRecommendation[];
      return parsed.map((r: JSONRecommendation) => ({
        ...r,
        createdAt: new Date(r.createdAt),
      }));
    }
  } catch (err) {
    console.error('Failed to load local recommendations.json, using defaults:', err);
  }
  saveMockRecommendations(defaultRecommendations);
  return [...defaultRecommendations];
}

export function saveMockRecommendations(recs: MockRecommendation[]) {
  try {
    fs.writeFileSync(RECS_FILE, JSON.stringify(recs, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to save local recommendations.json:', err);
  }
}

// Instantiate active mock data loaded from JSON
export const mockMovies: MockMovie[] = loadMockMovies();
export const mockRecommendations: MockRecommendation[] = loadMockRecommendations();

export async function initDatabase() {
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl) {
    try {
      console.log('Connecting to MySQL/TiDB database...');
      const pool = mysql.createPool(databaseUrl);
      db = drizzle(pool, { schema, mode: 'default' });
      isDatabaseConnected = true;
      console.log('Successfully connected to MySQL/TiDB database via Drizzle ORM!');
      
      // Ensure seed user exists
      try {
        const existingUser = await db!.query.users.findFirst({
          where: eq(schema.users.id, 'manus-user'),
        });
        if (!existingUser) {
          await db!.insert(schema.users).values({
            id: 'manus-user',
            name: 'Cinematic Explorer',
            email: 'explorer@cinematic.com',
          });
          console.log('Seeded default user in MySQL/TiDB database.');
        }
      } catch (seedErr) {
        console.error('Error seeding default user:', seedErr);
      }
      return;
    } catch (err) {
      console.error('Failed to connect to MySQL/TiDB database:', err);
      console.warn('Falling back to local persistent JSON fallback database.');
    }
  } else {
    console.warn('DATABASE_URL is missing. Running local persistent JSON database.');
  }
  
  isDatabaseConnected = false;
  db = null;
}

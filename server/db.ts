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
  recommendedBy?: string | null;
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

export interface MockAbsoluteCinema {
  id: string;
  userId: string;
  title: string;
  thumbnailUrl: string;
  thumbnailKey: string | null;
  rank: number;
  createdAt: Date;
  updatedAt: Date;
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
const ABSOLUTE_CINEMA_FILE = path.join(process.cwd(), 'absolute_cinema.json');

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

const defaultAbsoluteCinema: MockAbsoluteCinema[] = [
  {
    id: 'abs-1',
    userId: 'manus-user',
    title: 'Interstellar',
    thumbnailUrl: '/thumbnails/interstellar.png',
    thumbnailKey: null,
    rank: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'abs-2',
    userId: 'manus-user',
    title: 'The Dark Knight',
    thumbnailUrl: '/thumbnails/dark_knight.png',
    thumbnailKey: null,
    rank: 2,
    createdAt: new Date(),
    updatedAt: new Date(),
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
  recommendedBy?: string | null;
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

interface JSONAbsoluteCinema {
  id: string;
  userId: string;
  title: string;
  thumbnailUrl: string;
  thumbnailKey: string | null;
  rank: number;
  createdAt: string;
  updatedAt: string;
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

export function loadMockAbsoluteCinema(): MockAbsoluteCinema[] {
  try {
    if (fs.existsSync(ABSOLUTE_CINEMA_FILE)) {
      const data = fs.readFileSync(ABSOLUTE_CINEMA_FILE, 'utf8');
      const parsed = JSON.parse(data) as JSONAbsoluteCinema[];
      return parsed.map((a: JSONAbsoluteCinema) => ({
        ...a,
        createdAt: new Date(a.createdAt),
        updatedAt: new Date(a.updatedAt),
      }));
    }
  } catch (err) {
    console.error('Failed to load local absolute_cinema.json, using defaults:', err);
  }
  saveMockAbsoluteCinema(defaultAbsoluteCinema);
  return [...defaultAbsoluteCinema];
}

export function saveMockAbsoluteCinema(abs: MockAbsoluteCinema[]) {
  try {
    fs.writeFileSync(ABSOLUTE_CINEMA_FILE, JSON.stringify(abs, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to save local absolute_cinema.json:', err);
  }
}

// Instantiate active mock data loaded from JSON
export const mockMovies: MockMovie[] = loadMockMovies();
export const mockRecommendations: MockRecommendation[] = loadMockRecommendations();
export const mockAbsoluteCinema: MockAbsoluteCinema[] = loadMockAbsoluteCinema();

export async function initDatabase() {
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl) {
    try {
      console.log('Connecting to MySQL/TiDB database...');
      const pool = mysql.createPool(databaseUrl);
      
      // Perform database self-healing checks
      try {
        console.log('Running self-healing checks on schema...');
        // 1. Ensure recommended_by column exists in movies
        try {
          await pool.query("ALTER TABLE `movies` ADD COLUMN `recommended_by` VARCHAR(255) NULL;");
          console.log('[Self-healing] Successfully added recommended_by column to movies table.');
        } catch (colErr: unknown) {
          const err = colErr as { errno?: number; sqlState?: string };
          // Ignore if column already exists (errno 1060 or sqlState 42S21)
          if (err.errno !== 1060 && err.sqlState !== '42S21') {
            console.error('[Self-healing] Error ensuring recommended_by column:', colErr);
          } else {
            console.log('[Self-healing] Column recommended_by already exists on movies.');
          }
        }

        // 2. Ensure absolute_cinema table exists
        try {
          await pool.query(`
            CREATE TABLE IF NOT EXISTS \`absolute_cinema\` (
              \`id\` VARCHAR(255) PRIMARY KEY,
              \`user_id\` VARCHAR(255) NOT NULL,
              \`title\` VARCHAR(255) NOT NULL,
              \`thumbnail_url\` TEXT NOT NULL,
              \`thumbnail_key\` VARCHAR(255) NULL,
              \`rank\` INT NOT NULL,
              \`created_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
              \`updated_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
              FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE
            );
          `);
          console.log('[Self-healing] Successfully ensured absolute_cinema table exists.');
        } catch (tblErr) {
          console.error('[Self-healing] Error ensuring absolute_cinema table exists:', tblErr);
        }
      } catch (selfHealErr) {
        console.error('Self-healing failed:', selfHealErr);
      }

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

import express from 'express';
import cors from 'cors';
import path from 'path';
import multer from 'multer';
import * as trpcExpress from '@trpc/server/adapters/express';
import { createContext } from './trpc';
import { appRouter } from './router';
import { initDatabase } from './db';
import { uploadToS3 } from './s3';
import dotenv from 'dotenv';
import fs from 'fs';
import { authController } from './auth';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Set up directory for public uploads fallback if it doesn't exist
const uploadDir = path.join(process.cwd(), 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Enable CORS with support for frontend dev servers and Vercel cloud domains
app.use(cors({
  origin: true, // Dynamically mirrors request origin (localhost & Vercel)
  credentials: true,
}));

app.use(express.json());

// Serve local upload files fallback (static files)
app.use('/uploads', express.static(path.join(process.cwd(), 'public', 'uploads')));

// Configure Multer for in-memory file storage
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Only accept image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  },
});

// Binary File Upload Endpoint
app.post('/api/upload', (req, res, next) => {
  upload.single('thumbnail')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      // A Multer error occurred when uploading (e.g. file size exceeded)
      return res.status(400).json({ error: `Upload error: ${err.message}` });
    } else if (err) {
      // An unknown error occurred when uploading
      return res.status(400).json({ error: err.message || 'Invalid file upload' });
    }
    next();
  });
}, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No thumbnail file uploaded' });
    }
    
    // Upload file to S3 (automatically falls back to disk if needed)
    const result = await uploadToS3(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype
    );
    
    return res.json({
      success: true,
      url: result.url,
      key: result.key,
    });
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    console.error('File upload route error:', error);
    return res.status(500).json({ error: error.message || 'File upload failed' });
  }
});

// Simulated Manus OAuth Endpoints
app.post('/api/auth/login', authController.login);
app.get('/api/auth/callback', authController.callback);
app.get('/api/auth/me', authController.me);

// tRPC Express Middleware
app.use(
  '/trpc',
  trpcExpress.createExpressMiddleware({
    router: appRouter,
    createContext,
  })
);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// Start server after database initialization
async function start() {
  await initDatabase();
  app.listen(PORT, () => {
    console.log(`[Server] Cinematic Movie Collection server running on port ${PORT}`);
    console.log(`[Server] tRPC endpoint active at http://localhost:${PORT}/trpc`);
  });
}

start().catch((err) => {
  console.error('[Server] Failed to start server:', err);
});

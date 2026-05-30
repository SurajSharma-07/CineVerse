import type { Request, Response } from 'express';

export interface UserSession {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
  role: 'user' | 'admin';
}

// Default pre-configured user session for Manus OAuth
export const DEFAULT_USER: UserSession = {
  id: 'manus-user',
  name: 'Cinematic Explorer',
  email: 'explorer@cinematic.com',
  avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
  role: 'admin',
};

// Simulated sessions database
const activeSessions: Record<string, UserSession> = {
  'manus-session-token-xyz123': DEFAULT_USER,
};

export function getSessionFromRequest(req: Request): UserSession | null {
  // Check Authorization header or cookies
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    return activeSessions[token] || DEFAULT_USER; // Fallback to DEFAULT_USER to make it pre-configured!
  }
  
  // Return the default pre-configured session as standard for "pre-configured" Manus OAuth
  return DEFAULT_USER;
}

// Controller for simulated Manus OAuth redirection and callback
export const authController = {
  login: (_req: Request, res: Response) => {
    // Mimics Manus OAuth authentication
    const token = 'manus-session-token-xyz123';
    res.json({
      success: true,
      token,
      user: DEFAULT_USER,
    });
  },
  
  callback: (_req: Request, res: Response) => {
    // In a real Manus OAuth flow, this handles the redirect, exchange code for tokens, and redirect to client
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    res.redirect(`${clientUrl}?token=manus-session-token-xyz123`);
  },
  
  me: (req: Request, res: Response) => {
    const session = getSessionFromRequest(req);
    if (!session) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    res.json({ user: session });
  }
};

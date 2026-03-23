import crypto from 'crypto';
import type { MixpanelProject } from '../types';

interface MixpanelSession {
  username: string;
  secret: string;
  projects: MixpanelProject[];
  createdAt: number;
}

const SESSION_TTL_MS = 1000 * 60 * 60 * 8; // 8시간
const sessions = new Map<string, MixpanelSession>();

function cleanupExpiredSessions() {
  const now = Date.now();
  for (const [token, session] of sessions.entries()) {
    if (now - session.createdAt > SESSION_TTL_MS) {
      sessions.delete(token);
    }
  }
}

export function createMixpanelSession(payload: Omit<MixpanelSession, 'createdAt'>) {
  cleanupExpiredSessions();
  const token = crypto.randomUUID();
  sessions.set(token, { ...payload, createdAt: Date.now() });
  return token;
}

export function getMixpanelSession(token: string) {
  cleanupExpiredSessions();
  return sessions.get(token) ?? null;
}

export function deleteMixpanelSession(token: string) {
  sessions.delete(token);
}

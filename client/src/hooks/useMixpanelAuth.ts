import { useCallback, useEffect, useMemo, useState } from 'react';
import type { MixpanelAuthRequest, MixpanelAuthResponse, MixpanelProject } from '../types';
import { API_BASE } from '../config';

const STORAGE_KEY = 'mixpanel-auth';

interface StoredAuthState {
  sessionToken: string;
  selectedProjectId: string;
  projects: MixpanelProject[];
}

export function useMixpanelAuth() {
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [projects, setProjects] = useState<MixpanelProject[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [availableEvents, setAvailableEvents] = useState<string[]>([]);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as StoredAuthState;
      setSessionToken(parsed.sessionToken);
      setProjects(parsed.projects ?? []);
      setSelectedProjectId(parsed.selectedProjectId ?? '');
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const persist = useCallback((next: StoredAuthState | null) => {
    if (!next) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  const fetchEvents = useCallback(async (token: string, projectId: string) => {
    try {
      const response = await fetch(
        `${API_BASE}/api/mixpanel/events?sessionToken=${encodeURIComponent(token)}&projectId=${encodeURIComponent(projectId)}`
      );
      if (!response.ok) return;
      const data = await response.json();
      const events = Array.isArray(data.events) ? data.events : [];
      setAvailableEvents(events);
    } catch {
      setAvailableEvents([]);
    }
  }, []);

  const connect = useCallback(async (payload: MixpanelAuthRequest) => {
    setIsAuthenticating(true);
    setAuthError(null);

    try {
      const response = await fetch(`${API_BASE}/api/mixpanel/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as MixpanelAuthResponse | { message?: string };

      if (!response.ok) {
        throw new Error((data as any).message || 'Mixpanel 인증에 실패했습니다.');
      }

      const authData = data as MixpanelAuthResponse;
      const firstProjectId = authData.projects[0]?.id ?? '';

      setSessionToken(authData.sessionToken);
      setProjects(authData.projects);
      setSelectedProjectId(firstProjectId);

      persist({
        sessionToken: authData.sessionToken,
        projects: authData.projects,
        selectedProjectId: firstProjectId,
      });

      if (firstProjectId) {
        fetchEvents(authData.sessionToken, firstProjectId);
      }

      return authData;
    } catch (err: any) {
      setAuthError(err.message || 'Mixpanel 인증에 실패했습니다.');
      return null;
    } finally {
      setIsAuthenticating(false);
    }
  }, [persist, fetchEvents]);

  const selectProject = useCallback((projectId: string) => {
    setSelectedProjectId(projectId);
    setAvailableEvents([]);
    if (!sessionToken) return;
    persist({ sessionToken, projects, selectedProjectId: projectId });
    if (projectId) {
      fetchEvents(sessionToken, projectId);
    }
  }, [persist, projects, sessionToken, fetchEvents]);

  const logout = useCallback(async () => {
    try {
      if (sessionToken) {
        await fetch(`${API_BASE}/api/mixpanel/logout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionToken }),
        });
      }
    } catch { /* ignore */ }

    setSessionToken(null);
    setProjects([]);
    setSelectedProjectId('');
    setAuthError(null);
    setAvailableEvents([]);
    persist(null);
  }, [persist, sessionToken]);

  const isAuthenticated = useMemo(() => !!sessionToken, [sessionToken]);

  return {
    sessionToken,
    projects,
    selectedProjectId,
    isAuthenticated,
    isAuthenticating,
    authError,
    availableEvents,
    connect,
    logout,
    selectProject,
  };
}

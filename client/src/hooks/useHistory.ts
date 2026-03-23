import { useState, useCallback } from 'react';
import type { QueryResponse } from '../types';

export interface HistoryEntry {
  id: number;
  question: string;
  response: QueryResponse;
  timestamp: Date;
}

export function useHistory() {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const addEntry = useCallback((question: string, response: QueryResponse) => {
    const entry: HistoryEntry = {
      id: Date.now(),
      question,
      response,
      timestamp: new Date(),
    };
    setEntries(prev => [entry, ...prev]);
    setSelectedId(entry.id);
  }, []);

  const selectedEntry = entries.find(e => e.id === selectedId) ?? null;

  return { entries, selectedId, selectedEntry, setSelectedId, addEntry };
}

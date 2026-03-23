import { useState, useCallback } from 'react';
import type { QueryResponse, QueryErrorResponse } from '../types';

interface UseQueryReturn {
  isLoading: boolean;
  result: QueryResponse | null;
  error: string | null;
  submitQuery: (question: string, provider?: 'anthropic' | 'openai') => Promise<QueryResponse | null>;
}

export function useQuery(): UseQueryReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<QueryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submitQuery = useCallback(async (
    question: string,
    provider?: 'anthropic' | 'openai'
  ): Promise<QueryResponse | null> => {
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, provider }),
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        const errData = data as QueryErrorResponse;
        setError(errData.message);
        return null;
      }

      const queryResult = data as QueryResponse;
      setResult(queryResult);
      return queryResult;
    } catch (err: any) {
      setError('서버에 연결할 수 없습니다.');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { isLoading, result, error, submitQuery };
}

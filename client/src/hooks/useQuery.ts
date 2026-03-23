import { useState, useCallback } from 'react';
import type { QueryResponse, QueryErrorResponse } from '../types';
import { API_BASE } from '../config';

interface UseQueryReturn {
  isLoading: boolean;
  result: QueryResponse | null;
  error: string | null;
  statusMessage: string | null;
  submitQuery: (
    question: string,
    provider: 'anthropic' | 'openai',
    projectId: string,
    sessionToken: string,
    activeEvent?: string
  ) => Promise<QueryResponse | null>;
}

export function useQuery(): UseQueryReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<QueryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const submitQuery = useCallback(async (
    question: string,
    provider: 'anthropic' | 'openai',
    projectId: string,
    sessionToken: string,
    activeEvent?: string
  ): Promise<QueryResponse | null> => {
    setIsLoading(true);
    setError(null);
    setResult(null);
    setStatusMessage('요청 전송 중...');

    const body = JSON.stringify({ question, provider, projectId, sessionToken, activeEvent: activeEvent || undefined });

    try {
      const apiBase = API_BASE;
      const response = await fetch(`${apiBase}/api/query/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });

      if (!response.ok || !response.body) {
        // SSE 실패 시 기존 엔드포인트로 폴백
        const fallback = await fetch(`${apiBase}/api/query`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
        });
        const data = await fallback.json();
        if (!fallback.ok || data.error) {
          setError((data as QueryErrorResponse).message);
          return null;
        }
        const queryResult = data as QueryResponse;
        setResult(queryResult);
        return queryResult;
      }

      // SSE 스트리밍 파싱
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let finalResult: QueryResponse | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        let currentEvent = '';
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7);
          } else if (line.startsWith('data: ') && currentEvent) {
            try {
              const data = JSON.parse(line.slice(6));
              if (currentEvent === 'status') {
                setStatusMessage(data.message);
              } else if (currentEvent === 'result') {
                finalResult = data as QueryResponse;
                setResult(finalResult);
                setStatusMessage(null);
              } else if (currentEvent === 'error') {
                setError(data.message);
                setStatusMessage(null);
              }
            } catch { /* ignore */ }
            currentEvent = '';
          }
        }
      }

      return finalResult;
    } catch (err: any) {
      setError('서버에 연결할 수 없습니다.');
      setStatusMessage(null);
      return null;
    } finally {
      setIsLoading(false);
      setStatusMessage(null);
    }
  }, []);

  return { isLoading, result, error, statusMessage, submitQuery };
}

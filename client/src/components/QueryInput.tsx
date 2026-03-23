import { useState } from 'react';
import type { KeyboardEvent } from 'react';

interface QueryInputProps {
  onSubmit: (question: string) => void;
  isLoading: boolean;
}

export default function QueryInput({ onSubmit, isLoading }: QueryInputProps) {
  const [question, setQuestion] = useState('');

  const handleSubmit = () => {
    const trimmed = question.trim();
    if (trimmed && !isLoading) {
      onSubmit(trimmed);
      setQuestion('');
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div style={{
      display: 'flex',
      gap: 'var(--space-sm)',
      padding: 'var(--space-md)',
      background: 'var(--white)',
      borderBottom: '1px solid var(--border)',
    }}>
      <textarea
        value={question}
        onChange={e => setQuestion(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Mixpanel 데이터에 대해 질문하세요..."
        disabled={isLoading}
        rows={2}
        style={{
          flex: 1,
          padding: 'var(--space-sm) var(--space-md)',
          border: '1px solid var(--border)',
          borderRadius: 0,
          fontSize: '14px',
          resize: 'none',
          outline: 'none',
          fontFamily: 'var(--font-body)',
        }}
      />
      <button
        onClick={handleSubmit}
        disabled={isLoading || !question.trim()}
        style={{
          padding: 'var(--space-sm) var(--space-lg)',
          background: question.trim() && !isLoading ? 'var(--text-primary)' : 'var(--border)',
          color: 'var(--white)',
          border: 'none',
          fontSize: '14px',
          fontWeight: 700,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
        }}
      >
        {isLoading ? '분석 중...' : '전송'}
      </button>
    </div>
  );
}

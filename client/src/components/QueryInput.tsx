import { useState } from 'react';
import type { KeyboardEvent } from 'react';

interface QueryInputProps {
  onSubmit: (question: string) => void;
  isLoading: boolean;
  disabled?: boolean;
  placeholder?: string;
}

const EXAMPLE_QUERIES = [
  '지난 7일간 DAU 추이를 보여줘',
  '이번 달 가장 많이 발생한 이벤트 Top 10',
  '어떤 이벤트들이 있어?',
  '지난 30일간 페이지뷰 트렌드',
  'signup 이벤트의 속성(property) 목록',
];

export default function QueryInput({
  onSubmit,
  isLoading,
  disabled = false,
  placeholder = 'Mixpanel 데이터에 대해 질문하세요...',
}: QueryInputProps) {
  const [question, setQuestion] = useState('');

  const handleSubmit = () => {
    const trimmed = question.trim();
    if (trimmed && !isLoading && !disabled) {
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

  const handleExampleClick = (q: string) => {
    if (!disabled && !isLoading) {
      setQuestion(q);
    }
  };

  const isDisabled = isLoading || disabled;

  return (
    <div style={{
      padding: '16px 20px',
      background: 'var(--white)',
      borderBottom: '1px solid var(--border)',
    }}>
      {/* 설명 */}
      <div style={{ marginBottom: 10, fontSize: 12, color: '#888', lineHeight: 1.6 }}>
        자연어로 질문하면 Mixpanel 쿼리로 변환하여 데이터를 조회하고, 결과를 다시 자연어로 요약합니다.
      </div>

      {/* 입력 영역 */}
      <div style={{ display: 'flex', gap: 8 }}>
        <textarea
          value={question}
          onChange={e => setQuestion(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={isDisabled}
          rows={2}
          style={{
            flex: 1,
            padding: '10px 14px',
            border: '2px solid #ddd',
            borderRadius: 6,
            fontSize: '14px',
            resize: 'none',
            outline: 'none',
            fontFamily: 'var(--font-body)',
            background: isDisabled ? '#fafafa' : '#fff',
            transition: 'border-color 0.2s',
          }}
          onFocus={e => { e.target.style.borderColor = '#7856FF'; }}
          onBlur={e => { e.target.style.borderColor = '#ddd'; }}
        />
        <button
          onClick={handleSubmit}
          disabled={isDisabled || !question.trim()}
          style={{
            padding: '0 24px',
            background: question.trim() && !isDisabled ? '#7856FF' : '#ddd',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            fontSize: '14px',
            fontWeight: 700,
            cursor: question.trim() && !isDisabled ? 'pointer' : 'default',
            transition: 'background 0.2s',
            whiteSpace: 'nowrap',
          }}
        >
          {isLoading ? '분석 중...' : '전송'}
        </button>
      </div>

      {/* 예시 질의 */}
      {!isDisabled && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
          {EXAMPLE_QUERIES.map((q) => (
            <button
              key={q}
              onClick={() => handleExampleClick(q)}
              style={{
                padding: '4px 10px',
                fontSize: 11,
                color: '#7856FF',
                background: '#f3f0ff',
                border: '1px solid #e8e0ff',
                borderRadius: 12,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {q}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

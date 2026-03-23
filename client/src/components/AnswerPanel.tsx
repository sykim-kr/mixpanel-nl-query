interface AnswerPanelProps {
  answer: string;
}

export default function AnswerPanel({ answer }: AnswerPanelProps) {
  return (
    <div style={{
      padding: 'var(--space-lg)',
      background: 'var(--white)',
      marginBottom: 'var(--space-md)',
    }}>
      <h3 style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-secondary)', marginBottom: 'var(--space-sm)' }}>
        분석 결과
      </h3>
      <p style={{ fontSize: '15px', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{answer}</p>
    </div>
  );
}

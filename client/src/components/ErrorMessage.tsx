interface ErrorMessageProps {
  message: string;
}

export default function ErrorMessage({ message }: ErrorMessageProps) {
  return (
    <div style={{
      padding: 'var(--space-lg)',
      background: 'var(--white)',
      borderLeft: '3px solid var(--accent)',
      marginBottom: 'var(--space-md)',
    }}>
      <h3 style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--accent)', marginBottom: 'var(--space-sm)' }}>
        오류
      </h3>
      <p style={{ fontSize: '14px' }}>{message}</p>
    </div>
  );
}

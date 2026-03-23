export default function LoadingSpinner() {
  return (
    <div style={{
      padding: 'var(--space-2xl)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 'var(--space-md)',
    }}>
      <div style={{
        width: '24px',
        height: '24px',
        border: '2px solid var(--border)',
        borderTop: '2px solid var(--text-primary)',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }} />
      <span style={{ fontSize: '13px', color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>
        Mixpanel 데이터 분석 중...
      </span>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

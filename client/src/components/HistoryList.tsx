import type { HistoryEntry } from '../hooks/useHistory';

interface HistoryListProps {
  entries: HistoryEntry[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}

export default function HistoryList({ entries, selectedId, onSelect }: HistoryListProps) {
  return (
    <div style={{
      width: '220px',
      borderRight: '1px solid var(--border)',
      background: 'var(--white)',
      overflowY: 'auto',
      flexShrink: 0,
    }}>
      <h3 style={{
        fontSize: '11px',
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        color: 'var(--text-secondary)',
        padding: 'var(--space-md)',
        borderBottom: '1px solid var(--border)',
      }}>
        히스토리
      </h3>
      {entries.length === 0 && (
        <p style={{ padding: 'var(--space-md)', fontSize: '13px', color: 'var(--text-secondary)' }}>
          질의 내역이 없습니다
        </p>
      )}
      {entries.map(entry => (
        <button
          key={entry.id}
          onClick={() => onSelect(entry.id)}
          style={{
            display: 'block',
            width: '100%',
            textAlign: 'left',
            padding: 'var(--space-sm) var(--space-md)',
            border: 'none',
            borderBottom: '1px solid var(--border)',
            background: entry.id === selectedId ? 'var(--bg-primary)' : 'transparent',
            borderLeft: entry.id === selectedId ? '3px solid var(--accent)' : '3px solid transparent',
            fontSize: '13px',
            lineHeight: 1.4,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {entry.question}
        </button>
      ))}
    </div>
  );
}

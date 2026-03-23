import { Fragment } from 'react';
import type { QueryMetadata } from '../types';

interface MetadataPanelProps {
  metadata: QueryMetadata;
}

export default function MetadataPanel({ metadata }: MetadataPanelProps) {
  const items = [
    { label: '도구 호출', value: metadata.toolCalls.join(', ') },
    { label: '기간', value: metadata.dateRange },
    { label: '차원', value: metadata.dimensions.join(', ') },
    { label: '지표', value: metadata.metrics.join(', ') },
    ...(metadata.cohortDefinition
      ? [{ label: '코호트', value: metadata.cohortDefinition }]
      : []),
  ].filter(item => item.value);

  if (items.length === 0) return null;

  return (
    <div style={{
      padding: 'var(--space-lg)',
      background: 'var(--white)',
      marginBottom: 'var(--space-md)',
    }}>
      <h3 style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-secondary)', marginBottom: 'var(--space-md)' }}>
        쿼리 메타데이터
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: 'var(--space-xs) var(--space-md)', fontSize: '13px' }}>
        {items.map(item => (
          <Fragment key={item.label}>
            <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{item.label}</span>
            <span style={{ fontFamily: 'monospace', fontSize: '12px', wordBreak: 'break-all' }}>{item.value}</span>
          </Fragment>
        ))}
      </div>
    </div>
  );
}

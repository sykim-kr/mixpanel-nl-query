import { useState } from 'react';
import type { TableData } from '../types';

interface DataTableProps {
  table: TableData;
}

const PAGE_SIZE = 10;

export default function DataTable({ table }: DataTableProps) {
  const [page, setPage] = useState(0);

  if (table.columns.length === 0 || table.rows.length === 0) return null;

  const totalPages = Math.ceil(table.rows.length / PAGE_SIZE);
  const start = page * PAGE_SIZE;
  const pageRows = table.rows.slice(start, start + PAGE_SIZE);

  return (
    <div style={{
      padding: 'var(--space-lg)',
      background: 'var(--white)',
      marginBottom: 'var(--space-md)',
    }}>
      <h3 style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-secondary)', marginBottom: 'var(--space-md)' }}>
        데이터 ({table.totalRows}행)
      </h3>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr>
              {table.columns.map(col => (
                <th key={col} style={{
                  textAlign: 'left',
                  padding: 'var(--space-sm) var(--space-md)',
                  borderBottom: '2px solid var(--text-primary)',
                  fontSize: '11px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  fontWeight: 700,
                }}>
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => (
                  <td key={j} style={{
                    padding: 'var(--space-sm) var(--space-md)',
                    borderBottom: '1px solid var(--border)',
                    fontVariantNumeric: typeof cell === 'number' ? 'tabular-nums' : undefined,
                  }}>
                    {cell === null ? '—' : typeof cell === 'number' ? cell.toLocaleString() : cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: 'var(--space-md)',
          fontSize: '13px',
        }}>
          <button
            onClick={() => setPage(p => p - 1)}
            disabled={page === 0}
            style={{
              padding: 'var(--space-xs) var(--space-md)',
              border: '1px solid var(--border)',
              background: page === 0 ? 'var(--bg-primary)' : 'var(--white)',
              color: page === 0 ? 'var(--border)' : 'var(--text-primary)',
              fontWeight: 600,
            }}
          >
            &lt; 이전
          </button>
          <span style={{ color: 'var(--text-secondary)' }}>
            {page + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={page >= totalPages - 1}
            style={{
              padding: 'var(--space-xs) var(--space-md)',
              border: '1px solid var(--border)',
              background: page >= totalPages - 1 ? 'var(--bg-primary)' : 'var(--white)',
              color: page >= totalPages - 1 ? 'var(--border)' : 'var(--text-primary)',
              fontWeight: 600,
            }}
          >
            다음 &gt;
          </button>
        </div>
      )}
    </div>
  );
}

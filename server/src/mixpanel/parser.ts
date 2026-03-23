import { TableData, ChartData } from '../types';

export function parseToTable(rawData: unknown): TableData {
  // Case 1: 배열 형태 (JQL 결과 등)
  if (Array.isArray(rawData)) {
    if (rawData.length === 0) {
      return { columns: [], rows: [], totalRows: 0 };
    }
    const columns = Object.keys(rawData[0]);
    const rows = rawData.map(item =>
      columns.map(col => {
        const val = (item as Record<string, unknown>)[col];
        return val === undefined ? null : (val as string | number | null);
      })
    );
    return { columns, rows, totalRows: rows.length };
  }

  // Case 2: Insights 응답 형태 { series: [...], data: { values: { ... } } }
  if (typeof rawData === 'object' && rawData !== null) {
    const obj = rawData as Record<string, unknown>;

    // Insights 형식: { data: { values: { "event": { "date": count } } } }
    if (obj.data && typeof obj.data === 'object') {
      const data = obj.data as Record<string, unknown>;
      if (data.values && typeof data.values === 'object') {
        const values = data.values as Record<string, Record<string, number>>;
        const events = Object.keys(values);
        if (events.length === 0) {
          return { columns: [], rows: [], totalRows: 0 };
        }
        const dates = Object.keys(values[events[0]]).sort();
        const columns = ['날짜', ...events];
        const rows: (string | number | null)[][] = dates.map(date => [
          date,
          ...events.map(event => values[event][date] ?? null),
        ]);
        return { columns, rows, totalRows: rows.length };
      }
    }

    // 단일 객체 → 1행 테이블
    const columns = Object.keys(obj);
    const rows = [columns.map(col => {
      const val = obj[col];
      if (typeof val === 'string' || typeof val === 'number') return val;
      if (val === null) return null;
      return JSON.stringify(val);
    })];
    return { columns, rows, totalRows: 1 };
  }

  return { columns: [], rows: [], totalRows: 0 };
}

export function parseToChart(table: TableData): ChartData | undefined {
  if (table.columns.length < 2 || table.rows.length === 0) {
    return undefined;
  }

  const labels = table.rows.map(row => String(row[0] ?? ''));
  const datasets = table.columns.slice(1).map(col => {
    const colIndex = table.columns.indexOf(col);
    const data = table.rows.map(row => {
      const val = row[colIndex];
      return typeof val === 'number' ? val : 0;
    });
    return { label: col, data };
  });

  // 시계열(날짜 라벨) → line, 그 외 → bar
  const isTimeSeries = labels.length > 1 && /^\d{4}-\d{2}-\d{2}/.test(labels[0]);
  const type: 'line' | 'bar' = isTimeSeries ? 'line' : 'bar';

  return { type, labels, datasets };
}

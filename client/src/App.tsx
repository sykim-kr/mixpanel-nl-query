import { useState } from 'react';
import QueryInput from './components/QueryInput';
import AnswerPanel from './components/AnswerPanel';
import MetadataPanel from './components/MetadataPanel';
import DataTable from './components/DataTable';
import ChartPanel from './components/ChartPanel';
import HistoryList from './components/HistoryList';
import ErrorMessage from './components/ErrorMessage';
import LoadingSpinner from './components/LoadingSpinner';
import { useQuery } from './hooks/useQuery';
import { useHistory } from './hooks/useHistory';

type Provider = 'anthropic' | 'openai';

export default function App() {
  const [provider, setProvider] = useState<Provider>('anthropic');
  const { isLoading, error, submitQuery } = useQuery();
  const { entries, selectedId, selectedEntry, setSelectedId, addEntry } = useHistory();

  const handleSubmit = async (question: string) => {
    const result = await submitQuery(question, provider);
    if (result) {
      addEntry(question, result);
    }
  };

  const displayResult = selectedEntry?.response ?? null;

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 'var(--space-md) var(--space-lg)',
        borderBottom: '1px solid var(--border)',
        background: 'var(--white)',
      }}>
        <h1 style={{ fontSize: '18px', fontWeight: 700 }}>
          Mixpanel <span style={{ color: 'var(--accent)' }}>Query</span>
        </h1>
        <select
          value={provider}
          onChange={e => setProvider(e.target.value as Provider)}
          style={{
            padding: 'var(--space-xs) var(--space-md)',
            border: '1px solid var(--border)',
            background: 'var(--white)',
            fontSize: '13px',
            fontWeight: 600,
          }}
        >
          <option value="anthropic">Claude</option>
          <option value="openai">GPT</option>
        </select>
      </header>

      {/* Body */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Sidebar */}
        <HistoryList
          entries={entries}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />

        {/* Main */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <QueryInput onSubmit={handleSubmit} isLoading={isLoading} />

          <div style={{ flex: 1, overflow: 'auto', padding: 'var(--space-md)' }}>
            {isLoading && <LoadingSpinner />}
            {error && <ErrorMessage message={error} />}
            {displayResult && (
              <>
                <AnswerPanel answer={displayResult.answer} />
                <MetadataPanel metadata={displayResult.metadata} />
                {displayResult.chart && <ChartPanel chart={displayResult.chart} />}
                <DataTable table={displayResult.table} />
              </>
            )}
            {!isLoading && !error && !displayResult && (
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '100%',
                color: 'var(--text-secondary)',
                fontSize: '14px',
              }}>
                Mixpanel 데이터에 대해 자연어로 질문하세요
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

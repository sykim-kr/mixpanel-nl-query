import { useState } from 'react';
import QueryInput from './components/QueryInput';
import AnswerPanel from './components/AnswerPanel';
import MetadataPanel from './components/MetadataPanel';
import DataTable from './components/DataTable';
import ChartPanel from './components/ChartPanel';
import HistoryList from './components/HistoryList';
import ErrorMessage from './components/ErrorMessage';
import LoadingSpinner from './components/LoadingSpinner';
import ProjectSelector from './components/ProjectSelector';
import MixpanelAuthModal from './components/MixpanelAuthModal';
import { useQuery } from './hooks/useQuery';
import { useHistory } from './hooks/useHistory';
import { useMixpanelAuth } from './hooks/useMixpanelAuth';

type Provider = 'anthropic' | 'openai';

export default function App() {
  const [provider, setProvider] = useState<Provider>('anthropic');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  const { isLoading, error, statusMessage, submitQuery } = useQuery();
  const { entries, selectedId, selectedEntry, setSelectedId, addEntry } = useHistory();
  const {
    sessionToken,
    projects,
    selectedProjectId,
    isAuthenticated,
    isAuthenticating,
    authError,
    connect,
    logout,
    selectProject,
  } = useMixpanelAuth();

  const handleSubmit = async (question: string) => {
    if (!sessionToken || !selectedProjectId) return;
    const result = await submitQuery(question, provider, selectedProjectId, sessionToken);
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
        <h1 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>
          Mixpanel <span style={{ color: 'var(--accent)' }}>Query</span>
        </h1>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
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

          <ProjectSelector
            projects={projects}
            selectedProjectId={selectedProjectId}
            onChange={selectProject}
            disabled={!isAuthenticated}
          />

          <button
            onClick={() => setIsAuthModalOpen(true)}
            style={{
              padding: '8px 16px',
              border: 'none',
              borderRadius: 6,
              background: isAuthenticated ? '#7856FF' : '#7856FF',
              color: '#fff',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'opacity 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.opacity = '0.85'; }}
            onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
          >
            {isAuthenticated ? 'Reconnect' : 'Connect Mixpanel'}
          </button>

          {isAuthenticated && (
            <button
              onClick={logout}
              style={{
                padding: '8px 16px',
                border: '2px solid #b8a9e8',
                borderRadius: 6,
                background: '#fff',
                color: '#6b5ca5',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#6b5ca5'; e.currentTarget.style.color = '#fff'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = '#6b5ca5'; }}
            >
              Disconnect
            </button>
          )}
        </div>
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
          <QueryInput
            onSubmit={handleSubmit}
            isLoading={isLoading}
            disabled={!isAuthenticated || !selectedProjectId}
            placeholder={
              !isAuthenticated
                ? '먼저 Mixpanel 연결을 완료하세요'
                : !selectedProjectId
                ? '프로젝트를 선택하세요'
                : 'Mixpanel 데이터에 대해 질문하세요...'
            }
          />

          <div style={{ flex: 1, overflow: 'auto', padding: 'var(--space-md)' }}>
            {isLoading && <LoadingSpinner message={statusMessage} />}
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
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                height: '100%',
                gap: 24,
                color: 'var(--text-secondary)',
                fontSize: '14px',
              }}>
                {!isAuthenticated ? (
                  <>
                    <div style={{ marginTop: 60 }}>Mixpanel 서비스 계정으로 연결하세요</div>
                    <button
                      onClick={() => setIsAuthModalOpen(true)}
                      style={{
                        padding: '14px 36px',
                        background: '#7856FF',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 6,
                        fontSize: '16px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        letterSpacing: '0.02em',
                      }}
                    >
                      Connect Mixpanel
                    </button>
                  </>
                ) : (
                  'Mixpanel 데이터에 대해 자연어로 질문하세요'
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <MixpanelAuthModal
        open={isAuthModalOpen}
        isLoading={isAuthenticating}
        error={authError}
        onClose={() => setIsAuthModalOpen(false)}
        onConnect={connect}
      />
    </div>
  );
}

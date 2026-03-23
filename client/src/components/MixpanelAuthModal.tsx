import { useState } from 'react';

interface MixpanelAuthModalProps {
  open: boolean;
  isLoading: boolean;
  error: string | null;
  onClose: () => void;
  onConnect: (payload: { username: string; secret: string }) => Promise<unknown>;
}

const SERVICE_ACCOUNT_GUIDE_URL =
  'https://developer.mixpanel.com/reference/service-accounts';

export default function MixpanelAuthModal({
  open,
  isLoading,
  error,
  onClose,
  onConnect,
}: MixpanelAuthModalProps) {
  const [username, setUsername] = useState('');
  const [secret, setSecret] = useState('');

  if (!open) return null;

  const handleSubmit = async () => {
    if (!username.trim() || !secret.trim()) return;
    const result = await onConnect({
      username: username.trim(),
      secret: secret.trim(),
    });
    if (result) onClose();
  };

  return (
    <div style={backdropStyle}>
      <div style={modalStyle}>
        <h3 style={{ marginTop: 0, marginBottom: 4 }}>Connect Mixpanel</h3>
        <p style={{ margin: '0 0 16px', fontSize: 13, color: '#666', lineHeight: 1.5 }}>
          Mixpanel Service Account 정보를 입력하세요.
          <br />
          Organization Settings &gt; Service Accounts에서 확인할 수 있습니다.
        </p>

        <label style={labelStyle}>Service Account Username</label>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="예: my-project.abc123.mp-service-account"
          style={inputStyle}
        />

        <label style={labelStyle}>Service Account Secret</label>
        <input
          type="password"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          placeholder="Service Account 생성 시 발급된 Secret"
          style={inputStyle}
        />

        {error && <div style={{ color: 'crimson', fontSize: 13, marginBottom: 8 }}>{error}</div>}

        <a
          href={SERVICE_ACCOUNT_GUIDE_URL}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-block',
            fontSize: 12,
            color: '#7856FF',
            textDecoration: 'none',
            marginBottom: 16,
          }}
        >
          Service Account가 없으신가요? 생성 가이드 보기 &rarr;
        </a>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} disabled={isLoading} style={btnSecondaryStyle}>
            취소
          </button>
          <button
            onClick={handleSubmit}
            disabled={isLoading || !username.trim() || !secret.trim()}
            style={{
              ...btnPrimaryStyle,
              opacity: isLoading || !username.trim() || !secret.trim() ? 0.5 : 1,
            }}
          >
            {isLoading ? '연결 중...' : '연결'}
          </button>
        </div>
      </div>
    </div>
  );
}

const backdropStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.35)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 999,
};

const modalStyle: React.CSSProperties = {
  width: 440,
  background: '#fff',
  borderRadius: 8,
  padding: '24px 28px',
  boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 600,
  color: '#333',
  marginBottom: 4,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  marginBottom: 12,
  border: '1px solid #ddd',
  borderRadius: 4,
  boxSizing: 'border-box',
  fontSize: 14,
};

const btnPrimaryStyle: React.CSSProperties = {
  padding: '8px 20px',
  background: '#7856FF',
  color: '#fff',
  border: 'none',
  borderRadius: 4,
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
};

const btnSecondaryStyle: React.CSSProperties = {
  padding: '8px 20px',
  background: '#fff',
  color: '#333',
  border: '1px solid #ddd',
  borderRadius: 4,
  fontSize: 14,
  cursor: 'pointer',
};

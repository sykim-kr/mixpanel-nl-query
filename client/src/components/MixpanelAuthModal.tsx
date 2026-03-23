import { useState } from 'react';

interface MixpanelAuthModalProps {
  open: boolean;
  isLoading: boolean;
  error: string | null;
  onClose: () => void;
  onConnect: (payload: { username: string; secret: string }) => Promise<unknown>;
}

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
        <h3 style={{ marginTop: 0 }}>Connect Mixpanel</h3>

        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Service Account Username"
          style={inputStyle}
        />

        <input
          type="password"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          placeholder="Service Account Secret"
          style={inputStyle}
        />

        {error && <div style={{ color: 'crimson', fontSize: 13 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button onClick={onClose} disabled={isLoading}>취소</button>
          <button onClick={handleSubmit} disabled={isLoading}>
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
  width: 420,
  background: '#fff',
  border: '1px solid #ddd',
  padding: 20,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: 10,
  marginBottom: 10,
  border: '1px solid #ddd',
  boxSizing: 'border-box',
};

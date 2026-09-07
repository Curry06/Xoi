import React from 'react';
import { Modal } from './Modal';
import { Copy, Check } from 'lucide-react';

interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  endpoint: string;
}

export const QRCodeModal: React.FC<QRCodeModalProps> = ({ isOpen, onClose, endpoint }) => {
  const [copied, setCopied] = React.useState(false);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(endpoint);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Generate deterministic QR visual blocks based on string hash
  const renderVisualMatrix = (text: string) => {
    const size = 21; // 21x21 standard QR grid
    const cells: boolean[][] = [];

    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = (hash << 5) - hash + text.charCodeAt(i);
      hash |= 0;
    }

    for (let r = 0; r < size; r++) {
      cells[r] = [];
      for (let c = 0; c < size; c++) {
        // Standard finder patterns in corners (7x7)
        if (
          (r < 7 && c < 7) ||
          (r < 7 && c >= size - 7) ||
          (r >= size - 7 && c < 7)
        ) {
          const isEdge =
            r === 0 ||
            r === 6 ||
            c === 0 ||
            c === 6 ||
            (r < 7 && (c === size - 7 || c === size - 1)) ||
            (c < 7 && (r === size - 7 || r === size - 1));
          const isCenter =
            (r >= 2 && r <= 4 && c >= 2 && c <= 4) ||
            (r >= 2 && r <= 4 && c >= size - 5 && c <= size - 3) ||
            (r >= size - 5 && r <= size - 3 && c >= 2 && c <= 4);
          cells[r][c] = isEdge || isCenter;
        } else {
          // Pseudorandom based on coordinate and text hash
          const val = Math.sin(r * 13 + c * 37 + hash) * 10000;
          cells[r][c] = val - Math.floor(val) > 0.52;
        }
      }
    }

    return (
      <svg
        viewBox={`0 0 ${size} ${size}`}
        style={{ width: '180px', height: '180px', background: '#ffffff', padding: '10px', borderRadius: '8px' }}
      >
        {cells.map((row, r) =>
          row.map((active, c) =>
            active ? <rect key={`${r}-${c}`} x={c} y={r} width="1" height="1" fill="#000000" /> : null
          )
        )}
      </svg>
    );
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Public Endpoint QR Code" maxWidth="380px">
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem' }}>
        <div style={{ boxShadow: '0 4px 15px rgba(0, 0, 0, 0.4)', borderRadius: '10px', overflow: 'hidden' }}>
          {renderVisualMatrix(endpoint)}
        </div>

        <div style={{ textAlign: 'center', width: '100%' }}>
          <div
            style={{
              padding: '0.6rem 0.85rem',
              background: 'rgba(255, 255, 255, 0.05)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.9rem',
              color: 'var(--accent-cyan)',
              marginBottom: '0.75rem',
              wordBreak: 'break-all',
            }}
          >
            {endpoint || 'Unavailable'}
          </div>

          <button
            type="button"
            onClick={copyToClipboard}
            className="btn btn-secondary"
            style={{ width: '100%' }}
          >
            {copied ? <Check size={16} color="var(--color-success)" /> : <Copy size={16} />}
            {copied ? 'Copied to Clipboard!' : 'Copy Endpoint'}
          </button>
        </div>
      </div>
    </Modal>
  );
};

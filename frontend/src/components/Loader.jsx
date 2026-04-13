import { Loader2, Zap } from 'lucide-react';

const GlobalLoader = ({ show, message = 'Processing...' }) => {
  if (!show) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(10, 15, 25, 0.85)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        marginBottom: '1.5rem',
      }}>
        <div style={{
          position: 'relative',
          width: 64,
          height: 64,
        }}>
          <div style={{
            position: 'absolute',
            inset: 0,
            border: '3px solid rgba(34, 211, 238, 0.15)',
            borderRadius: '50%',
          }} />
          <div style={{
            position: 'absolute',
            inset: 0,
            border: '3px solid transparent',
            borderTopColor: '#22d3ee',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }} />
          <div style={{
            position: 'absolute',
            inset: '8px',
            border: '2px solid transparent',
            borderTopColor: '#f7921e',
            borderRadius: '50%',
            animation: 'spin 0.6s linear infinite reverse',
          }} />
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 12,
            height: 12,
            background: 'linear-gradient(135deg, #22d3ee, #f7921e)',
            borderRadius: '50%',
            boxShadow: '0 0 20px rgba(34, 211, 238, 0.6)',
          }} />
        </div>
      </div>
      <div style={{
        fontSize: '1rem',
        fontWeight: 500,
        color: '#e2e8f0',
        letterSpacing: '0.05em',
        marginBottom: '0.5rem',
      }}>
        {message}
      </div>
      <div style={{
        fontSize: '0.75rem',
        color: 'rgba(226, 232, 240, 0.5)',
        letterSpacing: '0.15em',
        textTransform: 'uppercase',
      }}>
        Please wait
      </div>
      <div style={{
        marginTop: '2rem',
        display: 'flex',
        gap: '0.5rem',
      }}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: i === 1 ? '#22d3ee' : 'rgba(34, 211, 238, 0.3)',
              animation: `pulse 1.4s ease-in-out ${i * 0.2}s infinite`,
            }}
          />
        ))}
      </div>
    </div>
  );
};

const CardLoader = ({ show, message = 'Loading...' }) => {
  if (!show) return null;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '1rem',
      width: '100%',
      height: '100%',
      minHeight: '400px',
      background: '#fff',
    }}>
      <div style={{
        position: 'relative',
        width: 48,
        height: 48,
      }}>
        <div style={{
          position: 'absolute',
          inset: 0,
          border: '2px solid rgba(34, 211, 238, 0.15)',
          borderRadius: '50%',
        }} />
        <div style={{
          position: 'absolute',
          inset: 0,
          border: '2px solid transparent',
          borderTopColor: '#22d3ee',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }} />
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 8,
          height: 8,
          background: '#22d3ee',
          borderRadius: '50%',
        }} />
      </div>
      {message && (
        <span style={{
          fontSize: '0.85rem',
          color: 'rgba(30, 41, 59, 0.6)',
          fontWeight: 500,
        }}>
          {message}
        </span>
      )}
    </div>
  );
};

const InlineLoader = ({ show, size = 16, message }) => {
  if (!show) return null;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      color: 'rgba(30, 41, 59, 0.6)',
    }}>
      <Loader2 size={size} className="animate-spin" style={{ color: '#22d3ee' }} />
      {message && (
        <span style={{ fontSize: '0.85rem' }}>{message}</span>
      )}
    </div>
  );
};

export { GlobalLoader, CardLoader, InlineLoader };

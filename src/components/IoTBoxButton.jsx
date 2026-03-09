import { useState, useRef, useEffect } from 'react';
import { Wifi, Loader2, Unlink, AlertCircle, ChevronDown, X } from 'lucide-react';

export default function IoTBoxButton({ 
  isConnected, 
  isScanning, 
  error,
  onConnect, 
  onDisconnect 
}) {
  const [showMenu, setShowMenu] = useState(false);
  const [connectionLog, setConnectionLog] = useState([]);
  const menuRef = useRef(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleClick = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (isScanning) return;
    
    if (isConnected) {
      setShowMenu(!showMenu);
    } else {
      await attemptConnection();
    }
  };

  const attemptConnection = async () => {
    const timestamp = new Date().toLocaleTimeString();
    addToLog(`[${timestamp}] Starting connection...`);
    
    try {
      const result = await onConnect();
      const successTime = new Date().toLocaleTimeString();
      addToLog(`[${successTime}] Connected successfully`);
      setShowMenu(false);
    } catch (err) {
      const errorTime = new Date().toLocaleTimeString();
      addToLog(`[${errorTime}] Failed: ${err.message}`);
      setShowMenu(true);
    }
  };

  const handleDisconnect = () => {
    const timestamp = new Date().toLocaleTimeString();
    addToLog(`[${timestamp}] Disconnected`);
    onDisconnect();
    setShowMenu(false);
  };

  const addToLog = (message) => {
    setConnectionLog(prev => [message, ...prev].slice(0, 5));
  };

  const clearLog = () => setConnectionLog([]);

  const getStatusColor = () => {
    if (isScanning) return { bg: '#FEF3C7', border: '#F59E0B', icon: '#F59E0B' };
    if (error) return { bg: '#FEE2E2', border: '#EF4444', icon: '#EF4444' };
    if (isConnected) return { bg: '#D1FAE5', border: '#10B981', icon: '#10B981' };
    return { bg: '#F3F4F6', border: '#9CA3AF', icon: '#6B7280' };
  };

  const colors = getStatusColor();

  return (
    <div ref={menuRef} style={{ position: 'relative' }}>
      {/* Main Button */}
      <button
        onClick={handleClick}
        disabled={isScanning}
        style={{
          padding: '8px 12px',
          borderRadius: '10px',
          cursor: isScanning ? 'wait' : 'pointer',
          backgroundColor: colors.bg,
          border: `2px solid ${colors.border}`,
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          minWidth: '40px',
          minHeight: '40px',
          transition: 'all 0.2s',
          opacity: isScanning ? 0.8 : 1,
        }}
      >
        {isScanning ? (
          <Loader2 className="w-5 h-5 animate-spin" style={{ color: colors.icon }} />
        ) : isConnected ? (
          <Wifi className="w-5 h-5" style={{ color: colors.icon }} />
        ) : error ? (
          <AlertCircle className="w-5 h-5" style={{ color: colors.icon }} />
        ) : (
          <Unlink className="w-5 h-5" style={{ color: colors.icon }} />
        )}
        
        {isConnected && (
          <span style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: '#10B981',
            animation: 'pulse 2s infinite'
          }} />
        )}
        
        {isConnected && <ChevronDown className="w-4 h-4" style={{ color: colors.icon }} />}
      </button>

      {/* Dropdown Menu */}
      {showMenu && (
        <div style={{
          position: 'absolute',
          top: '50px',
          right: '0',
          width: '280px',
          backgroundColor: 'white',
          borderRadius: '12px',
          boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
          border: '1px solid #E5E7EB',
          zIndex: 100,
          overflow: 'hidden'
        }}>
          {/* Header */}
          <div style={{
            padding: '12px 16px',
            borderBottom: '1px solid #E5E7EB',
            backgroundColor: '#F9FAFB',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {isConnected ? (
                <Wifi className="w-5 h-5" style={{ color: '#10B981' }} />
              ) : (
                <Unlink className="w-5 h-5" style={{ color: '#6B7280' }} />
              )}
              <span style={{ fontWeight: 600, fontSize: '14px', color: '#111827' }}>
                {isConnected ? 'IoT Box Connected' : 'IoT Box Disconnected'}
              </span>
            </div>
            <button 
              onClick={() => setShowMenu(false)}
              style={{ 
                padding: '4px', 
                borderRadius: '4px',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer'
              }}
            >
              <X className="w-4 h-4" style={{ color: '#6B7280' }} />
            </button>
          </div>

          {/* Connection Log */}
          {connectionLog.length > 0 && (
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #E5E7EB' }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                marginBottom: '8px' 
              }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#6B7280' }}>Connection Log</span>
                <button 
                  onClick={clearLog}
                  style={{ 
                    fontSize: '11px', 
                    color: '#EF4444', 
                    cursor: 'pointer',
                    border: 'none',
                    background: 'transparent'
                  }}
                >
                  Clear
                </button>
              </div>
              <div style={{ 
                maxHeight: '100px', 
                overflowY: 'auto',
                fontSize: '11px',
                fontFamily: 'monospace',
                backgroundColor: '#F3F4F6',
                padding: '8px',
                borderRadius: '6px'
              }}>
                {connectionLog.map((log, idx) => (
                  <div key={idx} style={{ marginBottom: '4px', color: '#374151' }}>
                    {log}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div style={{
              padding: '12px 16px',
              backgroundColor: '#FEE2E2',
              borderBottom: '1px solid #E5E7EB'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertCircle className="w-4 h-4" style={{ color: '#EF4444' }} />
                <span style={{ fontSize: '12px', color: '#DC2626', fontWeight: 500 }}>
                  {error}
                </span>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ padding: '12px 16px' }}>
            {isConnected ? (
              <button
                onClick={handleDisconnect}
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '8px',
                  border: '1px solid #EF4444',
                  backgroundColor: 'white',
                  color: '#EF4444',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                <Unlink className="w-4 h-4" />
                Disconnect
              </button>
            ) : (
              <button
                onClick={attemptConnection}
                disabled={isScanning}
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: '#10B981',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: isScanning ? 'wait' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  opacity: isScanning ? 0.7 : 1
                }}
              >
                {isScanning ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Wifi className="w-4 h-4" />
                )}
                {isScanning ? 'Connecting...' : 'Connect Now'}
              </button>
            )}
          </div>

          {/* Status Footer */}
          <div style={{
            padding: '8px 16px',
            backgroundColor: '#F9FAFB',
            borderTop: '1px solid #E5E7EB',
            fontSize: '11px',
            color: '#6B7280',
            textAlign: 'center'
          }}>
            {isConnected 
              ? 'Connected to IoT Box' 
              : 'Tap Connect to find nearby IoT Box'}
          </div>
        </div>
      )}
    </div>
  );
}
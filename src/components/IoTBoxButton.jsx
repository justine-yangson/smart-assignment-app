import { Wifi, Loader2, Unlink } from 'lucide-react';

export default function IoTBoxButton({ 
  isConnected, 
  isScanning, 
  error,
  onConnect, 
  onDisconnect 
}) {
  const handleClick = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    console.log('Button clicked, connected:', isConnected);
    
    if (isConnected) {
      onDisconnect();
    } else {
      await onConnect();
    }
  };

  return (
    <button
      onClick={handleClick}
      className={`p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${
        isScanning ? 'text-yellow-500' : 
        error ? 'text-red-500' : 
        isConnected ? 'text-green-500' : 'text-gray-400'
      }`}
      title={isConnected ? 'Connected via WiFi' : 'Connect to ESP32 WiFi'}
      disabled={isScanning}
    >
      {isScanning ? (
        <Loader2 className="w-5 h-5 animate-spin" />
      ) : isConnected ? (
        <Wifi className="w-5 h-5" />
      ) : (
        <Unlink className="w-5 h-5" />
      )}
    </button>
  );
}
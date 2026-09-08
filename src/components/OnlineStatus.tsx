import { useState, useEffect } from 'react';

export function OnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showStatus, setShowStatus] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowStatus(true);
      setTimeout(() => setShowStatus(false), 3000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowStatus(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!showStatus && isOnline) return null;

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-50 flex items-center justify-center py-2 px-4 transition-all duration-300 ${
        isOnline
          ? 'bg-green-600 text-white'
          : 'bg-amber-500 text-white'
      }`}
      style={{
        transform: showStatus ? 'translateY(0)' : 'translateY(-100%)',
      }}
    >
      <div className="flex items-center gap-2">
        <div
          className={`w-2 h-2 rounded-full ${
            isOnline ? 'bg-green-200' : 'bg-amber-200 animate-pulse'
          }`}
        />
        <span className="font-medium text-sm">
          {isOnline ? 'Back Online' : 'Offline Mode - Orders will sync when connected'}
        </span>
      </div>
    </div>
  );
}

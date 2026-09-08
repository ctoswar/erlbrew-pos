import { useState, useEffect } from 'react';

export function OnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowBanner(true);
      setTimeout(() => setShowBanner(false), 3000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowBanner(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <>
      {/* Persistent status indicator - always visible */}
      <div className="fixed top-2 right-2 z-50 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm rounded-full px-2 py-1">
        <div
          className={`w-2 h-2 rounded-full transition-colors ${
            isOnline ? 'bg-green-400' : 'bg-amber-400 animate-pulse'
          }`}
        />
        <span className="text-xs text-white/80">
          {isOnline ? 'Online' : 'Offline'}
        </span>
      </div>

      {/* Banner when status changes */}
      {showBanner && (
        <div
          className={`fixed top-0 left-0 right-0 z-50 flex items-center justify-center py-2 px-4 transition-all duration-300 ${
            isOnline
              ? 'bg-green-600 text-white'
              : 'bg-amber-500 text-white'
          }`}
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
      )}
    </>
  );
}

// src/App.jsx
import { useState, useEffect, useCallback } from "react";
import Home from "./pages/Home";
import Deadlines from "./pages/Deadlines";
import AddAssignment from "./pages/AddAssignment";
import SettingsDrawer from "./components/SettingsDrawer";
import NotificationBell from "./components/NotificationBell";
import IoTBoxButton from "./components/IoTBoxButton";
import { useIoTBox } from "./hooks/useIoTBox";
import "./index.css";

// Local storage helpers
const STORAGE_KEY = 'assignments_offline';

const saveToLocal = (data) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
};

const loadFromLocal = () => {
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved ? JSON.parse(saved) : [];
};

function AppContent() {
  const [list, setList] = useState([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [currentTab, setCurrentTab] = useState("home");
  const [loading, setLoading] = useState(true);
  const [lastSync, setLastSync] = useState(null);

  // IoT Box (WiFi + Bluetooth)
  const { 
    isConnected, 
    isScanning,
    activeConnection,
    error,
    availableNetworks,
    connect, 
    disconnect, 
    sendNotification,
    scanNetworks,
    connectToNetwork
  } = useIoTBox();

  // Alert system - for IoT Box notifications
  const [alertsEnabled, setAlertsEnabled] = useState(true);

  // ----------------------- Theme System -----------------------
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem("theme");
    if (saved) return saved === "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  const [autoDark, setAutoDark] = useState(() => {
    return localStorage.getItem("autoDark") === "true";
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
    localStorage.setItem("theme", isDark ? "dark" : "light");
  }, [isDark]);

  useEffect(() => {
    if (!autoDark) return;
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (e) => setIsDark(e.matches);
    setIsDark(mediaQuery.matches);
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [autoDark]);

  const toggleTheme = () => {
    if (autoDark) {
      setAutoDark(false);
      localStorage.setItem("autoDark", "false");
    }
    setIsDark(prev => !prev);
  };

  const enableAutoDark = () => {
    setAutoDark(true);
    localStorage.setItem("autoDark", "true");
    setIsDark(window.matchMedia("(prefers-color-scheme: dark)").matches);
  };

  const disableAutoDark = () => {
    setAutoDark(false);
    localStorage.setItem("autoDark", "false");
  };

  // ----------------------- Load from LocalStorage -----------------------
  useEffect(() => {
    const data = loadFromLocal();
    setList(data);
    setLastSync(new Date());
    setLoading(false);
  }, []);

  // Save to LocalStorage whenever list changes
  useEffect(() => {
    if (!loading) {
      saveToLocal(list);
      setLastSync(new Date());
    }
  }, [list, loading]);

  // ----------------------- IoT Box Notifications -----------------------
  useEffect(() => {
    if (!alertsEnabled || !isConnected) return;

    const checkAlerts = () => {
      const now = new Date();
      
      list.forEach(item => {
        if (item.status === "completed") return;
        
        const deadlines = item.deadlines || { red: item.deadline };
        const redDate = new Date(deadlines.red);
        const yellowDate = new Date(deadlines.yellow || deadlines.red);
        const timeUntilRed = redDate - now;
        const timeUntilYellow = yellowDate - now;
        
        let shouldAlert = false;
        let phase = '';
        let urgency = '';

        if (timeUntilRed <= 0) {
          shouldAlert = true;
          phase = 'red';
          urgency = 'URGENT';
        } else if (timeUntilYellow <= 3600000 && timeUntilYellow > 0) {
          shouldAlert = true;
          phase = 'yellow';
          urgency = 'WARNING';
        } else if (timeUntilRed <= 172800000 && timeUntilRed > 86400000) {
          shouldAlert = true;
          phase = 'green';
          urgency = 'INFO';
        }

        if (shouldAlert) {
          sendNotification({
            type: 'deadline',
            subject: item.subject,
            task: item.task,
            phase: phase,
            urgency: urgency,
            timestamp: new Date().toISOString()
          });
        }
      });
    };

    checkAlerts();
    const interval = setInterval(checkAlerts, 30000);
    return () => clearInterval(interval);
  }, [list, alertsEnabled, isConnected, sendNotification]);

  // ----------------------- Actions -----------------------
  const clearCompleted = () => {
    if (!confirm("Delete all completed assignments?")) return;
    setList(prev => prev.filter(item => item.status !== "completed"));
  };

  const clearAll = () => {
    if (!confirm("⚠️ WARNING: This will permanently delete ALL assignments! Are you sure?")) return;
    setList([]);
  };

  const toggleAlerts = () => setAlertsEnabled(prev => !prev);

  // ----------------------- Main App Render -----------------------
  return (
    <div className={`min-h-screen transition-colors duration-300 ${isDark ? 'dark bg-gray-900' : 'bg-gray-50'}`}>
      <div className={`app-container ${drawerOpen ? 'drawer-open' : ''} ${isDark ? 'dark' : ''}`}>
        
        {/* Header */}
        <header className="sticky top-0 z-40 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="max-w-4xl mx-auto px-2 sm:px-4 h-14 sm:h-16 flex items-center justify-between">
            {/* Left: Menu + Title */}
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
              <button 
                onClick={() => setDrawerOpen(true)}
                className="p-1.5 sm:p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex-shrink-0"
              >
                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-gray-700 dark:text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <h1 className="text-base sm:text-lg md:text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent truncate">
                <span className="hidden sm:inline">Smart Assignment Reminder</span>
                <span className="sm:hidden">Assignments</span>
              </h1>
            </div>
            
            {/* Right: Actions */}
            <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
              {/* IoT Box Button (WiFi + Bluetooth) */}
              <IoTBoxButton 
                isConnected={isConnected}
                isScanning={isScanning}
                error={error}
                availableNetworks={availableNetworks}
                onConnect={connect}
                onDisconnect={disconnect}
                onScanNetworks={scanNetworks}
                onConnectToNetwork={connectToNetwork}
              />
              
              {/* Notification Bell */}
              <NotificationBell assignments={list} isConnected={isConnected} />
              
              {/* Alert Toggle */}
              <button
                onClick={toggleAlerts}
                className={`p-1.5 sm:p-2 rounded-lg transition-colors ${
                  alertsEnabled 
                    ? 'text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20' 
                    : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
                title={alertsEnabled ? "Alerts enabled" : "Alerts muted"}
              >
                {alertsEnabled ? (
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-4xl mx-auto px-2 sm:px-4 py-4 sm:py-6 pb-24">
          {currentTab === "home" && (
            <Home 
              list={list} 
              setList={setList} 
              loading={loading}
              lastSync={lastSync}
            />
          )}
          {currentTab === "add" && (
            <AddAssignment 
              list={list} 
              setList={setList} 
              setCurrentTab={setCurrentTab}
            />
          )}
          {currentTab === "deadlines" && (
            <Deadlines 
              list={list} 
              setList={setList} 
            />
          )}
        </main>

        {/* Bottom Navigation */}
        <nav className="fixed bottom-0 left-0 right-0 bg-white/90 dark:bg-gray-800/90 backdrop-blur-lg border-t border-gray-200 dark:border-gray-700 shadow-lg z-30">
          <div className="max-w-4xl mx-auto px-4">
            <div className="flex justify-around items-center h-16">
              <NavButton 
                active={currentTab === "home"}
                onClick={() => setCurrentTab("home")}
                icon="home"
                label="Home"
              />
              <NavButton 
                active={currentTab === "add"}
                onClick={() => setCurrentTab("add")}
                icon="add"
                label="Add"
                isPrimary
              />
              <NavButton 
                active={currentTab === "deadlines"}
                onClick={() => setCurrentTab("deadlines")}
                icon="list"
                label="Deadlines"
                badge={Array.isArray(list) ? list.filter(i => i?.status !== "completed").length : 0}
              />
            </div>
          </div>
        </nav>

        {/* Settings Drawer */}
        <SettingsDrawer
          isOpen={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          isDark={isDark}
          toggleTheme={toggleTheme}
          clearCompleted={clearCompleted}
          clearAll={clearAll}
          enableAutoDark={enableAutoDark}
          disableAutoDark={disableAutoDark}
          alertsEnabled={alertsEnabled}
          toggleAlerts={toggleAlerts}
        />
      </div>
    </div>
  );
}

// Navigation Button Component
function NavButton({ active, onClick, icon, label, isPrimary, badge }) {
  const icons = {
    home: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />,
    add: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />,
    list: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
  };

  return (
    <button
      onClick={onClick}
      className={`relative flex flex-col items-center justify-center w-20 h-full transition-all duration-200 ${
        active 
          ? 'text-blue-600 dark:text-blue-400' 
          : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
      }`}
    >
      <div className={`relative p-2 rounded-xl transition-all ${
        isPrimary 
          ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-500/30 -mt-6 border-4 border-white dark:border-gray-800' 
          : active 
            ? 'bg-blue-50 dark:bg-blue-900/30' 
            : 'hover:bg-gray-100 dark:hover:bg-gray-700'
      }`}>
        <svg className={`w-6 h-6 ${isPrimary ? 'w-7 h-7' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {icons[icon]}
        </svg>
        {badge > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center border-2 border-white dark:border-gray-800">
            {badge > 99 ? '99+' : badge}
          </span>
        )}
      </div>
      <span className={`text-xs mt-1 font-medium ${active ? 'opacity-100' : 'opacity-70'}`}>
        {label}
      </span>
    </button>
  );
}

export default function App() {
  return <AppContent />;
}
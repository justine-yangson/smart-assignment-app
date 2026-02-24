// src/App.jsx
import { useState, useEffect, useRef, useCallback } from "react";
import { GoogleLogin, googleLogout, useGoogleLogin } from "@react-oauth/google";
import { jwtDecode } from "jwt-decode";
import Home from "./pages/Home";
import Deadlines from "./pages/Deadlines";
import AddAssignment from "./pages/AddAssignment";
import SettingsDrawer from "./components/SettingsDrawer";
import NotificationBell from "./components/NotificationBell";
import { NotificationProvider } from "./context/NotificationContext";
import alertFile from "./assets/alert.wav";
import "./index.css";

function AppContent() {
  const [list, setList] = useState([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [currentTab, setCurrentTab] = useState("home");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastSync, setLastSync] = useState(null);

  // User authentication state
  const [user, setUser] = useState(null);
  const [credential, setCredential] = useState(null);

  // Alert system
  const alertAudio = useRef(new Audio(alertFile));
  const playedIds = useRef(new Set());
  const [userInteracted, setUserInteracted] = useState(false);
  const [alertsEnabled, setAlertsEnabled] = useState(true);

  // ----------------------- Theme System -----------------------
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem("theme");
    if (saved) return saved === "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  // Auto dark mode state
  const [autoDark, setAutoDark] = useState(() => {
    return localStorage.getItem("autoDark") === "true";
  });

  // Apply theme effect
  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
    localStorage.setItem("theme", isDark ? "dark" : "light");
  }, [isDark]);

  // Auto dark mode effect - listen to system changes
  useEffect(() => {
    if (!autoDark) return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    
    const handleChange = (e) => {
      setIsDark(e.matches);
    };

    // Set initial value based on system
    setIsDark(mediaQuery.matches);

    // Listen for changes
    mediaQuery.addEventListener("change", handleChange);
    
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [autoDark]);

  const toggleTheme = () => {
    // Disable auto dark when manually toggling
    if (autoDark) {
      setAutoDark(false);
      localStorage.setItem("autoDark", "false");
    }
    setIsDark(prev => !prev);
  };

  const enableAutoDark = () => {
    setAutoDark(true);
    localStorage.setItem("autoDark", "true");
    // Immediately apply system preference
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    setIsDark(prefersDark);
  };

  const disableAutoDark = () => {
    setAutoDark(false);
    localStorage.setItem("autoDark", "false");
  };

  // ----------------------- Google OAuth Handlers -----------------------
  const handleLoginSuccess = (credentialResponse) => {
    const decoded = jwtDecode(credentialResponse.credential);
    setUser(decoded);
    setCredential(credentialResponse.credential);
    localStorage.setItem("googleCredential", credentialResponse.credential);
  };

  const handleLogout = () => {
    googleLogout();
    setUser(null);
    setCredential(null);
    localStorage.removeItem("googleCredential");
    setList([]); // Clear assignments on logout
  };

  // Restore session on mount
  useEffect(() => {
    const savedCredential = localStorage.getItem("googleCredential");
    if (savedCredential) {
      try {
        const decoded = jwtDecode(savedCredential);
        // Check if token is expired
        if (decoded.exp * 1000 > Date.now()) {
          setUser(decoded);
          setCredential(savedCredential);
        } else {
          localStorage.removeItem("googleCredential");
        }
      } catch (err) {
        localStorage.removeItem("googleCredential");
      }
    }
  }, []);

  // ----------------------- Backend API -----------------------
  const fetchAssignments = useCallback(async () => {
    if (!credential) {
      setList([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const res = await fetch("https://smart-assignment-app.onrender.com/api/assignments", {
        headers: {
          "Authorization": `Bearer ${credential}`
        }
      });
      
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      const result = await res.json();
      
      // FIX: Handle both {data: [...]} and [...] formats
      const data = Array.isArray(result) ? result : result.data || [];
      setList(data);
      setLastSync(new Date());
      setError(null);
    } catch (err) {
      setError(err.message);
      console.error("Fetch error:", err);
      setList([]); // Ensure list is always an array
    } finally {
      setLoading(false);
    }
  }, [credential]);

  useEffect(() => {
    fetchAssignments();
    // Auto-refresh every 5 minutes
    const interval = setInterval(fetchAssignments, 300000);
    return () => clearInterval(interval);
  }, [fetchAssignments]);

  // ----------------------- Audio & Notification Setup -----------------------
  useEffect(() => {
    const unlockMedia = async () => {
      try {
        await alertAudio.current.play();
        alertAudio.current.pause();
        alertAudio.current.currentTime = 0;
      } catch (e) {
        // Autoplay blocked, will retry on interaction
      }

      if (Notification.permission === "default") {
        Notification.requestPermission();
      }
      
      setUserInteracted(true);
    };

    const events = ['click', 'keydown', 'touchstart'];
    events.forEach(event => window.addEventListener(event, unlockMedia, { once: true }));
    
    return () => events.forEach(event => window.removeEventListener(event, unlockMedia));
  }, []);

  // ----------------------- Smart Alert System -----------------------
  useEffect(() => {
    if (!userInteracted || !alertsEnabled) return;

    const checkAlerts = () => {
      const now = new Date();
      
      list.forEach(item => {
        if (item.status === "completed" || playedIds.current.has(item._id)) return;
        
        const deadline = new Date(item.deadline);
        const timeUntilDeadline = deadline - now;
        
        // Alert 1 hour before and at deadline
        const shouldAlert = timeUntilDeadline <= 0 || (timeUntilDeadline <= 3600000 && timeUntilDeadline > 0);
        
        if (shouldAlert) {
          // Play sound
          alertAudio.current.play().catch(() => {});
          
          // Browser notification
          if (Notification.permission === "granted") {
            new Notification(`⏰ ${timeUntilDeadline <= 0 ? 'OVERDUE' : 'Due Soon'}: ${item.subject}`, {
              body: `${item.task}\nDeadline: ${deadline.toLocaleString()}`,
              icon: "/alert-icon.png",
              badge: "/alert-icon.png",
              tag: item._id,
              requireInteraction: timeUntilDeadline <= 0
            });
          }
          
          playedIds.current.add(item._id);
        }
      });
    };

    checkAlerts(); // Check immediately
    const interval = setInterval(checkAlerts, 30000); // Then every 30s
    
    return () => clearInterval(interval);
  }, [list, userInteracted, alertsEnabled]);

  // ----------------------- Actions -----------------------
  const clearCompleted = () => {
    if (!confirm("Delete all completed assignments?")) return;
    setList(prev => prev.filter(item => item.status !== "completed"));
  };

  // NEW: Clear all tasks from database
  const clearAll = async () => {
    if (!confirm("⚠️ WARNING: This will permanently delete ALL assignments! Are you sure?")) return;
    
    try {
      // Get all assignment IDs
      const ids = list.map(item => item._id);
      
      if (ids.length === 0) {
        alert("No assignments to delete");
        return;
      }

      // Use bulk delete endpoint
      const res = await fetch("https://smart-assignment-app.onrender.com/api/assignments/bulk/delete", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${credential}`
        },
        body: JSON.stringify({ ids }),
      });

      if (!res.ok) throw new Error("Failed to delete assignments");

      const result = await res.json();
      setList([]); // Clear local state
      alert(`✅ Deleted ${result.deleted} assignments`);
    } catch (err) {
      console.error("Clear all error:", err);
      alert("❌ Failed to delete all assignments");
    }
  };

  const dismissError = () => setError(null);

  const toggleAlerts = () => setAlertsEnabled(prev => !prev);

  // ----------------------- Login Screen -----------------------
  if (!user) {
    return (
      <div className={`min-h-screen flex items-center justify-center transition-colors duration-300 ${isDark ? 'dark bg-gray-900' : 'bg-gray-50'}`}>
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 max-w-md w-full mx-4 text-center">
          <div className="mb-6">
            <div className="w-16 h-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl mx-auto flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Smart Assignment Reminder
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Sign in to manage your assignments and never miss a deadline
            </p>
          </div>
          
          <div className="flex justify-center">
            <GoogleLogin
              onSuccess={handleLoginSuccess}
              onError={() => console.log("Login Failed")}
              theme={isDark ? "filled_black" : "outline"}
              size="large"
              text="signin_with"
              shape="pill"
            />
          </div>

          <div className="mt-6 flex justify-center">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              title="Toggle theme"
            >
              {isDark ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 24.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ----------------------- Main App Render -----------------------
  return (
    <div className={`min-h-screen transition-colors duration-300 ${isDark ? 'dark bg-gray-900' : 'bg-gray-50'}`}>
      {/* Main App Container */}
      <div className={`app-container ${drawerOpen ? 'drawer-open' : ''} ${isDark ? 'dark' : ''}`}>
        
        {/* FIXED: Mobile-Responsive Top Bar */}
        <header className="sticky top-0 z-40 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="max-w-4xl mx-auto px-2 sm:px-4 h-14 sm:h-16 flex items-center justify-between">
            {/* Left: Menu + Title */}
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
              <button 
                onClick={() => setDrawerOpen(true)}
                className="p-1.5 sm:p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex-shrink-0"
                aria-label="Open settings"
              >
                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-gray-700 dark:text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              {/* FIXED: Responsive title - smaller on mobile, truncated */}
              <h1 className="text-base sm:text-lg md:text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent truncate">
                <span className="hidden sm:inline">Smart Assignment Reminder</span>
                <span className="sm:hidden">Assignments</span>
              </h1>
            </div>
            
            {/* Right: Actions - more compact on mobile */}
            <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
              {/* User Profile - hidden name on small mobile */}
              <div className="flex items-center gap-1 sm:gap-2">
                <img 
                  src={user.picture} 
                  alt={user.name}
                  className="w-7 h-7 sm:w-8 sm:h-8 rounded-full border-2 border-gray-200 dark:border-gray-600"
                />
                <span className="hidden sm:block text-sm font-medium text-gray-700 dark:text-gray-300 truncate max-w-[80px] md:max-w-[120px]">
                  {user.name}
                </span>
              </div>

              {/* Notification Bell */}
              <NotificationBell assignments={list} />
              
              {/* Alert Toggle - smaller on mobile */}
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

              {/* Logout Button */}
              <button
                onClick={handleLogout}
                className="p-1.5 sm:p-2 rounded-lg text-gray-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400 transition-colors"
                title="Logout"
              >
                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          </div>
        </header>

        {/* Error Banner */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800 px-2 sm:px-4 py-2 sm:py-3">
            <div className="max-w-4xl mx-auto flex items-center justify-between">
              <div className="flex items-center gap-2 text-red-700 dark:text-red-400 min-w-0 flex-1">
                <svg className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-xs sm:text-sm font-medium truncate">{error}</span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                <button 
                  onClick={fetchAssignments}
                  className="text-xs sm:text-sm text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 font-medium"
                >
                  Retry
                </button>
                <button 
                  onClick={dismissError}
                  className="text-red-400 hover:text-red-600 p-1"
                >
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && list.length === 0 && (
          <div className="flex items-center justify-center h-64">
            <div className="flex flex-col items-center gap-3 text-gray-500 dark:text-gray-400">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm">Loading assignments...</span>
            </div>
          </div>
        )}

        {/* Main Content - adjusted padding for mobile */}
        <main className="max-w-4xl mx-auto px-2 sm:px-4 py-4 sm:py-6 pb-24">
          {currentTab === "home" && (
            <Home 
              list={list} 
              setList={setList} 
              alertAudio={alertAudio.current}
              loading={loading}
              lastSync={lastSync}
              credential={credential}
            />
          )}
          {currentTab === "add" && (
            <AddAssignment 
              list={list} 
              setList={setList} 
              setCurrentTab={setCurrentTab}
              onAssignmentAdded={fetchAssignments}
              credential={credential}
            />
          )}
          {currentTab === "deadlines" && (
            <Deadlines 
              list={list} 
              setList={setList} 
              alertAudio={alertAudio.current}
              credential={credential}
            />
          )}
        </main>

        {/* Modern Bottom Navigation */}
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
          user={user}
          onLogout={handleLogout}
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

// Main App with Notification Provider
export default function App() {
  return (
    <NotificationProvider>
      <AppContent />
    </NotificationProvider>
  );
}
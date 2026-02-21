import { 
  X, 
  Moon, 
  Sun, 
  Monitor, 
  Trash2, 
  AlertTriangle, 
  CheckCircle2,
  Bell,
  BellOff,
  ChevronRight,
  Info
} from "lucide-react";

export default function SettingsDrawer({
  isOpen,
  onClose,
  isDark,
  toggleTheme,
  clearCompleted,
  clearAll,
  enableAutoDark,
  disableAutoDark,
  alertsEnabled,
  toggleAlerts,
}) {
  // Get auto dark status from localStorage
  const autoDark = localStorage.getItem("autoDark") === "true";

  const handleAutoDarkToggle = () => {
    if (autoDark) {
      disableAutoDark();
    } else {
      enableAutoDark();
    }
  };

  const handleClearAll = async () => {
    await clearAll();
    onClose(); // Close drawer after clearing
  };

  const handleClearCompleted = () => {
    clearCompleted();
    onClose(); // Close drawer after clearing
  };

  const menuItems = [
    {
      section: "Appearance",
      items: [
        {
          icon: isDark ? Sun : Moon,
          label: isDark ? "Switch to Light Mode" : "Switch to Dark Mode",
          description: `Currently ${isDark ? "dark" : "light"} mode`,
          onClick: toggleTheme,
          color: isDark ? "text-amber-500" : "text-indigo-500"
        },
        {
          icon: Monitor,
          label: autoDark ? "Disable Auto Dark Mode" : "Enable Auto Dark Mode",
          description: autoDark ? "Following system preference" : "Follow system preference",
          onClick: handleAutoDarkToggle,
          active: autoDark,
          color: "text-blue-500"
        }
      ]
    },
    {
      section: "Notifications",
      items: [
        {
          icon: alertsEnabled ? Bell : BellOff,
          label: alertsEnabled ? "Mute Notifications" : "Enable Notifications",
          description: alertsEnabled ? "Alerts are active" : "Alerts are muted",
          onClick: toggleAlerts,
          active: alertsEnabled,
          color: alertsEnabled ? "text-green-500" : "text-gray-400"
        }
      ]
    },
    {
      section: "Data Management",
      items: [
        {
          icon: CheckCircle2,
          label: "Clear Completed Tasks",
          description: "Remove finished assignments",
          onClick: handleClearCompleted,
          color: "text-emerald-500",
          danger: false
        },
        {
          icon: Trash2,
          label: "Clear All Tasks",
          description: "Delete all assignments permanently",
          onClick: handleClearAll,
          color: "text-red-500",
          danger: true
        }
      ]
    }
  ];

  return (
    <>
      {/* Drawer */}
      <div 
        className={`fixed top-0 left-0 h-full w-80 bg-white dark:bg-gray-900 shadow-2xl transform transition-transform duration-300 ease-in-out z-50 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-800">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Settings</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Customize your experience</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Menu Content */}
        <div className="p-4 space-y-6 overflow-y-auto h-[calc(100vh-100px)]">
          {menuItems.map((section, idx) => (
            <div key={section.section}>
              <h3 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3 px-2">
                {section.section}
              </h3>
              <div className="space-y-1">
                {section.items.map((item) => (
                  <button
                    key={item.label}
                    onClick={item.onClick}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all group ${
                      item.danger 
                        ? "hover:bg-red-50 dark:hover:bg-red-900/20" 
                        : "hover:bg-gray-100 dark:hover:bg-gray-800"
                    }`}
                  >
                    <div className={`p-2 rounded-lg bg-gray-100 dark:bg-gray-800 group-hover:bg-white dark:group-hover:bg-gray-700 transition-colors`}>
                      <item.icon className={`w-5 h-5 ${item.color}`} />
                    </div>
                    <div className="flex-1 text-left">
                      <div className={`font-medium ${item.danger ? "text-red-600 dark:text-red-400" : "text-gray-900 dark:text-white"}`}>
                        {item.label}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {item.description}
                      </div>
                    </div>
                    {item.active !== undefined && (
                      <div className={`w-10 h-6 rounded-full p-1 transition-colors ${item.active ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
                        <div className={`w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform ${item.active ? 'translate-x-4' : 'translate-x-0'}`} />
                      </div>
                    )}
                    {!item.active !== undefined && (
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    )}
                  </button>
                ))}
              </div>
              {idx < menuItems.length - 1 && (
                <div className="mt-6 border-b border-gray-200 dark:border-gray-800" />
              )}
            </div>
          ))}

          {/* Footer Info */}
          <div className="mt-8 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <Info className="w-4 h-4" />
              <span>Smart Assignment Reminder v1.0</span>
            </div>
          </div>
        </div>
      </div>

      {/* Overlay */}
      <div 
        className={`fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300 z-40 ${
          isOpen ? "opacity-100 visible" : "opacity-0 invisible"
        }`}
        onClick={onClose}
      />
    </>
  );
}
import React, { useState, useEffect, useRef, useMemo } from "react";
import { 
  CheckCircle2, 
  Trash2, 
  Clock, 
  AlertTriangle, 
  Calendar, 
  BookOpen,
  Loader2,
  MoreVertical,
  Bell
} from "lucide-react";

export default function Home({ list, setList, alertAudio, loading, lastSync }) {
  const [updatingIds, setUpdatingIds] = useState([]);
  const [filter, setFilter] = useState("all"); // all, urgent, upcoming
  const playedIds = useRef(new Set());

  // Memoized filtered and sorted assignments
  const assignments = useMemo(() => {
    const now = new Date();
    
    return list
      .filter(item => item.status !== "completed")
      .filter(item => {
        if (filter === "all") return true;
        const deadlines = item.deadlines || { green: item.deadline, yellow: item.deadline, red: item.deadline };
        const redDate = new Date(deadlines.red);
        const yellowDate = new Date(deadlines.yellow);
        
        if (filter === "urgent") return now >= redDate || (now >= yellowDate && now < redDate);
        if (filter === "upcoming") return now < yellowDate;
        return true;
      })
      .sort((a, b) => {
        const aRed = new Date(a.deadlines?.red || a.deadline);
        const bRed = new Date(b.deadlines?.red || b.deadline);
        return aRed - bRed; // Sort by urgency (closest deadline first)
      });
  }, [list, filter]);

  const completedCount = list.filter(i => i.status === "completed").length;
  const pendingCount = list.filter(i => i.status !== "completed").length;

  // Mark as completed - FIXED: Changed from PUT to PATCH
  const markCompleted = async (item) => {
    setUpdatingIds(prev => [...prev, item._id]);
    try {
      const res = await fetch(`https://smart-assignment-app.onrender.com/api/assignments/${item._id}`, {
        method: "PATCH",  // <-- FIXED: Changed from PUT to PATCH
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed" }),
      });
      if (!res.ok) throw new Error("Failed to update");
      
      setList(prev => prev.map(a => a._id === item._id ? { ...a, status: "completed" } : a));
    } catch (err) {
      console.error(err);
      alert("Failed to update assignment");
    } finally {
      setUpdatingIds(prev => prev.filter(id => id !== item._id));
    }
  };

  // Delete task
  const deleteTask = async (item) => {
    if (!confirm(`Delete "${item.task}"?`)) return;
    try {
      const res = await fetch(`https://smart-assignment-app.onrender.com/api/assignments/${item._id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      setList(prev => prev.filter(a => a._id !== item._id));
    } catch (err) {
      console.error(err);
      alert("Failed to delete assignment");
    }
  };

  // Get deadline status and styling
  const getDeadlineStatus = (item) => {
    const now = new Date();
    const deadlines = item.deadlines || { green: item.deadline, yellow: item.deadline, red: item.deadline };
    const { green, yellow, red } = deadlines;
    
    const greenDate = new Date(green);
    const yellowDate = new Date(yellow);
    const redDate = new Date(red);

    if (now >= redDate) return { 
      level: "critical", 
      label: "Overdue", 
      color: "bg-red-500",
      bgColor: "bg-red-50 dark:bg-red-900/20",
      borderColor: "border-red-200 dark:border-red-800",
      textColor: "text-red-700 dark:text-red-400",
      icon: AlertTriangle
    };
    if (now >= yellowDate) return { 
      level: "warning", 
      label: "Due Soon", 
      color: "bg-amber-500",
      bgColor: "bg-amber-50 dark:bg-amber-900/20",
      borderColor: "border-amber-200 dark:border-amber-800",
      textColor: "text-amber-700 dark:text-amber-400",
      icon: Clock
    };
    if (now >= greenDate) return { 
      level: "notice", 
      label: "Start Now", 
      color: "bg-blue-500",
      bgColor: "bg-blue-50 dark:bg-blue-900/20",
      borderColor: "border-blue-200 dark:border-blue-800",
      textColor: "text-blue-700 dark:text-blue-400",
      icon: Bell
    };
    return { 
      level: "safe", 
      label: "Upcoming", 
      color: "bg-emerald-500",
      bgColor: "bg-emerald-50 dark:bg-emerald-900/20",
      borderColor: "border-emerald-200 dark:border-emerald-800",
      textColor: "text-emerald-700 dark:text-emerald-400",
      icon: Calendar
    };
  };

  // Format relative time
  const getRelativeTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = date - now;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (diff < 0) return `${Math.abs(hours)}h overdue`;
    if (hours < 1) return "Due now";
    if (hours < 24) return `${hours}h left`;
    if (days === 1) return "Tomorrow";
    return `${days} days`;
  };

  // Real-time alerts
  useEffect(() => {
    const checkAlerts = () => {
      const now = new Date();
      list.forEach(item => {
        if (item.status === "completed") return;
        
        const deadlines = item.deadlines || { green: item.deadline, yellow: item.deadline, red: item.deadline };
        const { green, yellow, red } = deadlines;
        
        let color = "";
        if (now >= new Date(red)) color = "red";
        else if (now >= new Date(yellow)) color = "yellow";
        else if (now >= new Date(green)) color = "green";
        
        if (color && !playedIds.current.has(`${item._id}-${color}`)) {
          alertAudio?.play().catch(() => {});
          playedIds.current.add(`${item._id}-${color}`);
          
          if (Notification.permission === "granted") {
            new Notification(`⏰ ${color.toUpperCase()} Alert: ${item.subject}`, {
              body: `${item.task}\nDeadline: ${new Date(red).toLocaleString()}`,
              icon: "/alert-icon.png",
            });
          }
        }
      });
    };

    checkAlerts();
    const interval = setInterval(checkAlerts, 60000);
    return () => clearInterval(interval);
  }, [list, alertAudio]);

  if (loading && list.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-4 text-white shadow-lg shadow-blue-500/25">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm font-medium">Pending</p>
              <p className="text-3xl font-bold">{pendingCount}</p>
            </div>
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <BookOpen className="w-6 h-6" />
            </div>
          </div>
        </div>
        
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-4 text-white shadow-lg shadow-emerald-500/25">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-emerald-100 text-sm font-medium">Completed</p>
              <p className="text-3xl font-bold">{completedCount}</p>
            </div>
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl">
        {[
          { key: "all", label: "All", count: list.filter(i => i.status !== "completed").length },
          { key: "urgent", label: "Urgent", count: list.filter(i => {
            const deadlines = i.deadlines || { red: i.deadline };
            return i.status !== "completed" && new Date() >= new Date(deadlines.red);
          }).length },
          { key: "upcoming", label: "Upcoming", count: list.filter(i => {
            const deadlines = i.deadlines || { yellow: i.deadline };
            return i.status !== "completed" && new Date() < new Date(deadlines.yellow);
          }).length }
        ].map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              filter === key
                ? "bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm"
                : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
            }`}
          >
            {label}
            <span className={`px-2 py-0.5 rounded-full text-xs ${
              filter === key ? "bg-blue-100 dark:bg-blue-900/30" : "bg-gray-200 dark:bg-gray-700"
            }`}>
              {count}
            </span>
          </button>
        ))}
      </div>

      {/* Last Sync Info */}
      {lastSync && (
        <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
          Last updated: {lastSync.toLocaleTimeString()}
        </p>
      )}

      {/* Assignments List */}
      <div className="space-y-3">
        {assignments.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">
              {filter === "all" ? "All caught up!" : "No assignments found"}
            </h3>
            <p className="text-gray-500 dark:text-gray-400">
              {filter === "all" ? "You have no pending assignments." : `No ${filter} assignments.`}
            </p>
          </div>
        ) : (
          assignments.map(item => {
            const status = getDeadlineStatus(item);
            const deadlines = item.deadlines || { green: item.deadline, yellow: item.deadline, red: item.deadline };
            const StatusIcon = status.icon;

            return (
              <div
                key={item._id}
                className={`group relative rounded-2xl border-2 p-4 transition-all hover:shadow-lg ${
                  status.bgColor
                } ${status.borderColor}`}
              >
                {/* Status Badge */}
                <div className="absolute top-4 right-4">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${status.color} text-white`}>
                    <StatusIcon className="w-3.5 h-3.5" />
                    {status.label}
                  </span>
                </div>

                {/* Content */}
                <div className="pr-24">
                  <div className="flex items-center gap-2 mb-2">
                    <BookOpen className={`w-4 h-4 ${status.textColor}`} />
                    <h3 className="font-bold text-lg text-gray-900 dark:text-white">
                      {item.subject}
                    </h3>
                  </div>
                  
                  <p className="text-gray-700 dark:text-gray-300 mb-3 font-medium">
                    {item.task}
                  </p>

                  {/* Deadline Timeline */}
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white/50 dark:bg-black/20 ${status.textColor}`}>
                      <Calendar className="w-3 h-3" />
                      {getRelativeTime(deadlines.red)}
                    </span>
                    
                    {status.level !== "safe" && (
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white/50 dark:bg-black/20 ${status.textColor}`}>
                        <Clock className="w-3 h-3" />
                        Due: {new Date(deadlines.red).toLocaleDateString()}
                      </span>
                    )}
                  </div>

                  {/* Progress Bar for multi-stage deadlines */}
                  {item.deadlines && (
                    <div className="mt-3 flex gap-1">
                      <div className="h-1.5 flex-1 rounded-full bg-emerald-200 dark:bg-emerald-900/50" title="Green phase" />
                      <div className="h-1.5 flex-1 rounded-full bg-amber-200 dark:bg-amber-900/50" title="Yellow phase" />
                      <div className={`h-1.5 flex-1 rounded-full ${
                        status.level === "critical" ? "bg-red-500" : "bg-red-200 dark:bg-red-900/50"
                      }`} title="Red phase" />
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2 mt-4 pt-4 border-t border-black/5 dark:border-white/5">
                  <button
                    onClick={() => markCompleted(item)}
                    disabled={updatingIds.includes(item._id)}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-300 text-white rounded-xl font-medium transition-all transform active:scale-95"
                  >
                    {updatingIds.includes(item._id) ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                    {updatingIds.includes(item._id) ? "Updating..." : "Complete"}
                  </button>
                  
                  <button
                    onClick={() => deleteTask(item)}
                    className="px-4 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl font-medium transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
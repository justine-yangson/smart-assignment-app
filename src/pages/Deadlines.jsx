import { useState, useEffect, useRef, useMemo } from "react";
import { 
  Calendar, 
  CheckCircle2, 
  Circle, 
  Clock, 
  Trash2, 
  Edit2, 
  Save, 
  X, 
  AlertTriangle,
  Filter,
  Search,
  MoreVertical,
  ChevronDown,
  Loader2
} from "lucide-react";

export default function Deadlines({ list, setList, alertAudio }) {
  const [filter, setFilter] = useState("today");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({ 
    subject: "", 
    task: "", 
    deadlines: { green: "", yellow: "", red: "" } 
  });
  const [updatingIds, setUpdatingIds] = useState([]);
  const playedIds = useRef(new Set());

  // Update loading state
  useEffect(() => {
    if (Array.isArray(list)) setLoading(false);
  }, [list]);

  // Get deadline status
  const getStatus = (item) => {
    if (item.status === "completed") return { type: "completed", label: "Completed", color: "emerald" };
    
    const now = new Date();
    const deadlines = item.deadlines || { green: item.deadline, yellow: item.deadline, red: item.deadline };
    
    if (now >= new Date(deadlines.red)) return { type: "overdue", label: "Overdue", color: "red" };
    if (now >= new Date(deadlines.yellow)) return { type: "warning", label: "Due Soon", color: "amber" };
    if (now >= new Date(deadlines.green)) return { type: "active", label: "In Progress", color: "blue" };
    return { type: "upcoming", label: "Upcoming", color: "gray" };
  };

  // Filter and search assignments
  const filteredList = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return (list || [])
      .filter((item) => {
        const deadlines = item.deadlines || { green: item.deadline, yellow: item.deadline, red: item.deadline };
        const greenDate = new Date(deadlines.green);
        const redDate = new Date(deadlines.red);
        
        // Search filter
        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          const matchesSearch = 
            item.subject.toLowerCase().includes(query) ||
            item.task.toLowerCase().includes(query);
          if (!matchesSearch) return false;
        }

        // Status filter
        if (filter === "today") {
          return item.status !== "completed" && redDate >= today && greenDate <= new Date(today.getTime() + 24 * 60 * 60 * 1000);
        }
        if (filter === "upcoming") return item.status !== "completed";
        if (filter === "completed") return item.status === "completed";
        if (filter === "overdue") return item.status !== "completed" && redDate < today;
        return true;
      })
      .sort((a, b) => {
        // Sort by urgency
        const aRed = new Date(a.deadlines?.red || a.deadline);
        const bRed = new Date(b.deadlines?.red || b.deadline);
        if (a.status === "completed" && b.status !== "completed") return 1;
        if (b.status === "completed" && a.status !== "completed") return -1;
        return aRed - bRed;
      });
  }, [list, filter, searchQuery]);

  // Stats
  const stats = useMemo(() => ({
    total: list?.length || 0,
    completed: list?.filter(i => i.status === "completed").length || 0,
    pending: list?.filter(i => i.status !== "completed").length || 0,
    overdue: list?.filter(i => {
      const deadlines = i.deadlines || { red: i.deadline };
      return i.status !== "completed" && new Date(deadlines.red) < new Date();
    }).length || 0
  }), [list]);

  // Toggle completion - FIXED: Changed from PUT to PATCH
  const toggleDone = async (item) => {
    setUpdatingIds(prev => [...prev, item._id]);
    const newStatus = item.status === "completed" ? "upcoming" : "completed";
    
    // Optimistic update
    setList(prev => prev.map(i => i._id === item._id ? { ...i, status: newStatus } : i));

    try {
      const res = await fetch(`/api/assignments/${item._id}`, {
        method: "PATCH",  // <-- FIXED: Changed from PUT to PATCH
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("Failed to update");
    } catch (err) {
      // Revert on error
      setList(prev => prev.map(i => i._id === item._id ? { ...i, status: item.status } : i));
      alert("Failed to update status");
    } finally {
      setUpdatingIds(prev => prev.filter(id => id !== item._id));
    }
  };

  // Delete task
  const deleteTask = async (item) => {
    if (!confirm(`Delete "${item.task}"?`)) return;
    
    setUpdatingIds(prev => [...prev, item._id]);
    
    try {
      const res = await fetch(`/api/assignments/${item._id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      setList(prev => prev.filter(i => i._id !== item._id));
    } catch (err) {
      alert("Failed to delete assignment");
    } finally {
      setUpdatingIds(prev => prev.filter(id => id !== item._id));
    }
  };

  // Edit functions
  const startEdit = (item) => {
    setEditingId(item._id);
    setEditData({
      subject: item.subject,
      task: item.task,
      deadlines: item.deadlines || { 
        green: item.deadline, 
        yellow: item.deadline, 
        red: item.deadline 
      },
    });
  };

  // Save edit - FIXED: Changed from PUT to PATCH and handle response properly
  const saveEdit = async (id) => {
    setUpdatingIds(prev => [...prev, id]);
    
    try {
      const res = await fetch(`/api/assignments/${id}`, {
        method: "PATCH",  // <-- FIXED: Changed from PUT to PATCH
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editData),
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(errorData.error || "Failed to save");
      }
      
      const result = await res.json();
      // Handle both {data: item} and direct item response
      const updatedItem = result.data || result;
      setList(prev => prev.map(item => item._id === id ? updatedItem : item));
      setEditingId(null);
    } catch (err) {
      alert("Failed to save edits: " + err.message);
    } finally {
      setUpdatingIds(prev => prev.filter(i => i !== id));
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditData({ subject: "", task: "", deadlines: { green: "", yellow: "", red: "" } });
  };

  // Format relative time
  const getRelativeTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = date - now;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (diff < 0) return `${Math.abs(days)}d overdue`;
    if (hours < 24) return `${hours}h left`;
    if (days === 1) return "Tomorrow";
    return `${days} days`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Total", value: stats.total, color: "blue" },
          { label: "Pending", value: stats.pending, color: "amber" },
          { label: "Overdue", value: stats.overdue, color: "red" },
          { label: "Done", value: stats.completed, color: "emerald" },
        ].map(({ label, value, color }) => (
          <div key={label} className={`bg-${color}-50 dark:bg-${color}-900/20 rounded-xl p-3 text-center border border-${color}-200 dark:border-${color}-800`}>
            <div className={`text-2xl font-bold text-${color}-600 dark:text-${color}-400`}>{value}</div>
            <div className="text-xs text-gray-600 dark:text-gray-400">{label}</div>
          </div>
        ))}
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search assignments..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
        </div>
        
        <div className="flex gap-2 overflow-x-auto pb-1">
          {[
            { key: "today", label: "Today", icon: Calendar },
            { key: "upcoming", label: "All Pending", icon: Clock },
            { key: "overdue", label: "Overdue", icon: AlertTriangle },
            { key: "completed", label: "Completed", icon: CheckCircle2 },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium whitespace-nowrap transition-all ${
                filter === key
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-500/25"
                  : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Results Count */}
      <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
        <span>{filteredList.length} assignment{filteredList.length !== 1 ? 's' : ''}</span>
        {searchQuery && (
          <button onClick={() => setSearchQuery("")} className="text-blue-600 hover:underline">
            Clear search
          </button>
        )}
      </div>

      {/* Assignments List */}
      <div className="space-y-3">
        {filteredList.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-2xl">
            <div className="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <Calendar className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">No assignments found</h3>
            <p className="text-gray-500 dark:text-gray-400">
              {searchQuery ? "Try a different search term" : `No ${filter} assignments`}
            </p>
          </div>
        ) : (
          filteredList.map((item) => {
            const status = getStatus(item);
            const deadlines = item.deadlines || { green: item.deadline, yellow: item.deadline, red: item.deadline };
            const isEditing = item._id === editingId;
            const isUpdating = updatingIds.includes(item._id);

            return (
              <div
                key={item._id}
                className={`group bg-white dark:bg-gray-800 rounded-2xl border-2 p-4 transition-all hover:shadow-lg ${
                  status.type === "overdue" ? "border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/10" :
                  status.type === "warning" ? "border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10" :
                  status.type === "completed" ? "border-emerald-200 dark:border-emerald-800 bg-emerald-50/30 dark:bg-emerald-900/10 opacity-75" :
                  "border-gray-200 dark:border-gray-700"
                }`}
              >
                {isEditing ? (
                  // Edit Mode
                  <div className="space-y-4">
                    <input
                      type="text"
                      value={editData.subject}
                      onChange={(e) => setEditData({ ...editData, subject: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 font-semibold"
                      placeholder="Subject"
                    />
                    
                    <textarea
                      value={editData.task}
                      onChange={(e) => setEditData({ ...editData, task: e.target.value })}
                      rows={3}
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 resize-none"
                      placeholder="Task description"
                    />
                    
                    <div className="grid grid-cols-3 gap-2">
                      {["green", "yellow", "red"].map((phase) => (
                        <div key={phase}>
                          <label className={`block text-xs font-medium mb-1 capitalize text-${phase === 'green' ? 'emerald' : phase === 'yellow' ? 'amber' : 'red'}-600`}>
                            {phase}
                          </label>
                          <input
                            type="datetime-local"
                            value={editData.deadlines[phase]}
                            onChange={(e) => setEditData({
                              ...editData,
                              deadlines: { ...editData.deadlines, [phase]: e.target.value }
                            })}
                            className="w-full px-2 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900"
                          />
                        </div>
                      ))}
                    </div>
                    
                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={() => saveEdit(item._id)}
                        disabled={isUpdating}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-medium transition-colors"
                      >
                        {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Save
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  // View Mode
                  <>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-${status.color}-100 dark:bg-${status.color}-900/30 text-${status.color}-700 dark:text-${status.color}-400`}>
                            {status.type === "overdue" && <AlertTriangle className="w-3 h-3" />}
                            {status.label}
                          </span>
                          {status.type !== "completed" && (
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {getRelativeTime(deadlines.red)}
                            </span>
                          )}
                        </div>
                        
                        <h3 className={`font-bold text-lg mb-1 ${status.type === "completed" ? "line-through text-gray-500" : "text-gray-900 dark:text-white"}`}>
                          {item.subject}
                        </h3>
                        
                        <p className={`text-sm mb-3 ${status.type === "completed" ? "text-gray-400" : "text-gray-600 dark:text-gray-300"}`}>
                          {item.task}
                        </p>

                        {/* Timeline */}
                        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                          <div className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-emerald-500" />
                            {new Date(deadlines.green).toLocaleDateString()}
                          </div>
                          <span>→</span>
                          <div className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-amber-500" />
                            {new Date(deadlines.yellow).toLocaleDateString()}
                          </div>
                          <span>→</span>
                          <div className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-red-500" />
                            {new Date(deadlines.red).toLocaleDateString()}
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-col gap-2">
                        <button
                          onClick={() => toggleDone(item)}
                          disabled={isUpdating}
                          className={`p-2 rounded-lg transition-colors ${
                            item.status === "completed"
                              ? "text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                              : "text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                          }`}
                          title={item.status === "completed" ? "Mark incomplete" : "Mark complete"}
                        >
                          {isUpdating ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                          ) : item.status === "completed" ? (
                            <CheckCircle2 className="w-5 h-5" />
                          ) : (
                            <Circle className="w-5 h-5" />
                          )}
                        </button>
                        
                        <button
                          onClick={() => startEdit(item)}
                          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-5 h-5" />
                        </button>
                        
                        <button
                          onClick={() => deleteTask(item)}
                          disabled={isUpdating}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
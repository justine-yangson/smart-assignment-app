import { useState, useEffect } from "react";
import { 
  Plus, 
  BookOpen, 
  FileText, 
  Calendar, 
  AlertTriangle, 
  CheckCircle2, 
  Loader2,
  ArrowLeft,
  Clock
} from "lucide-react";

export default function AddAssignment({ list, setList, setCurrentTab, onAssignmentAdded, credential }) {
  const [formData, setFormData] = useState({
    subject: "",
    task: "",
    green: "",
    yellow: "",
    red: ""
  });
  
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState({});

  // Get today's datetime-local format
  const getMinDateTime = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  };

  // Auto-calculate yellow and red if green is set
  useEffect(() => {
    if (formData.green && !formData.yellow && !formData.red) {
      const greenDate = new Date(formData.green);
      const yellowDate = new Date(greenDate.getTime() + 2 * 24 * 60 * 60 * 1000); // +2 days
      const redDate = new Date(greenDate.getTime() + 4 * 24 * 60 * 60 * 1000); // +4 days
      
      setFormData(prev => ({
        ...prev,
        yellow: yellowDate.toISOString().slice(0, 16),
        red: redDate.toISOString().slice(0, 16)
      }));
    }
  }, [formData.green]);

  // Validation
  const validate = () => {
    const newErrors = {};
    
    if (!formData.subject.trim()) newErrors.subject = "Subject is required";
    if (!formData.task.trim()) newErrors.task = "Task description is required";
    
    const greenDate = new Date(formData.green);
    const yellowDate = new Date(formData.yellow);
    const redDate = new Date(formData.red);
    
    if (!formData.green) newErrors.green = "Green deadline is required";
    if (!formData.yellow) newErrors.yellow = "Yellow deadline is required";
    if (!formData.red) newErrors.red = "Red deadline is required";
    
    if (formData.green && formData.yellow && formData.red) {
      if (isNaN(greenDate) || isNaN(yellowDate) || isNaN(redDate)) {
        newErrors.dates = "Please enter valid dates";
      } else if (greenDate >= yellowDate) {
        newErrors.yellow = "Yellow must be after Green";
      } else if (yellowDate >= redDate) {
        newErrors.red = "Red must be after Yellow";
      } else if (redDate <= new Date()) {
        newErrors.red = "Red deadline must be in the future";
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setTouched(prev => ({ ...prev, [field]: true }));
    // Clear error when user types
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    setTouched({ subject: true, task: true, green: true, yellow: true, red: true });
    
    if (!validate()) return;

    setLoading(true);

    const newTask = {
      subject: formData.subject.trim(),
      task: formData.task.trim(),
      deadlines: {
        green: new Date(formData.green).toISOString(),
        yellow: new Date(formData.yellow).toISOString(),
        red: new Date(formData.red).toISOString(),
      },
      status: "upcoming",
      createdAt: new Date().toISOString()
    };

    try {
      const res = await fetch("https://smart-assignment-app.onrender.com/api/assignments", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${credential}`
        },
        body: JSON.stringify(newTask),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to add assignment");
      }

      // Refresh from server to get consistent data
      if (onAssignmentAdded) {
        await onAssignmentAdded();
      }

      // Reset form
      setFormData({ subject: "", task: "", green: "", yellow: "", red: "" });
      setTouched({});
      setErrors({});

      // Show success and switch tab
      setCurrentTab("deadlines");
      
    } catch (err) {
      console.error("Error adding assignment:", err);
      setErrors(prev => ({ ...prev, submit: err.message }));
    } finally {
      setLoading(false);
    }
  };

  // Quick preset buttons
  const applyPreset = (days) => {
    const now = new Date();
    const green = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    const yellow = new Date(green.getTime() + 2 * 24 * 60 * 60 * 1000);
    const red = new Date(green.getTime() + 4 * 24 * 60 * 60 * 1000);
    
    setFormData({
      ...formData,
      green: green.toISOString().slice(0, 16),
      yellow: yellow.toISOString().slice(0, 16),
      red: red.toISOString().slice(0, 16)
    });
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => setCurrentTab("home")}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-6 h-6 text-gray-600 dark:text-gray-400" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Add Assignment</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Create a new assignment with deadlines</p>
        </div>
      </div>

      {/* Form Card */}
      <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* Progress Indicator */}
        <div className="flex h-1">
          <div className={`flex-1 transition-colors ${formData.subject ? 'bg-blue-500' : 'bg-gray-200 dark:bg-gray-700'}`} />
          <div className={`flex-1 transition-colors ${formData.task ? 'bg-blue-500' : 'bg-gray-200 dark:bg-gray-700'}`} />
          <div className={`flex-1 transition-colors ${formData.green ? 'bg-blue-500' : 'bg-gray-200 dark:bg-gray-700'}`} />
          <div className={`flex-1 transition-colors ${formData.yellow ? 'bg-blue-500' : 'bg-gray-200 dark:bg-gray-700'}`} />
          <div className={`flex-1 transition-colors ${formData.red ? 'bg-blue-500' : 'bg-gray-200 dark:bg-gray-700'}`} />
        </div>

        <div className="p-6 space-y-6">
          {/* Subject */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              <BookOpen className="w-4 h-4 text-blue-500" />
              Subject
            </label>
            <input
              type="text"
              placeholder="e.g., Mathematics, Computer Science"
              value={formData.subject}
              onChange={(e) => handleChange("subject", e.target.value)}
              className={`w-full px-4 py-3 rounded-xl border-2 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${
                errors.subject && touched.subject
                  ? "border-red-500 focus:border-red-500"
                  : "border-gray-200 dark:border-gray-700 focus:border-blue-500"
              }`}
            />
            {errors.subject && touched.subject && (
              <p className="text-sm text-red-500 flex items-center gap-1">
                <AlertTriangle className="w-4 h-4" />
                {errors.subject}
              </p>
            )}
          </div>

          {/* Task Description */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              <FileText className="w-4 h-4 text-purple-500" />
              Assignment Details
            </label>
            <textarea
              placeholder="Describe what needs to be done..."
              rows={4}
              value={formData.task}
              onChange={(e) => handleChange("task", e.target.value)}
              className={`w-full px-4 py-3 rounded-xl border-2 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 transition-all focus:outline-none focus:ring-2 focus:ring-purple-500/20 resize-none ${
                errors.task && touched.task
                  ? "border-red-500 focus:border-red-500"
                  : "border-gray-200 dark:border-gray-700 focus:border-purple-500"
              }`}
            />
            {errors.task && touched.task && (
              <p className="text-sm text-red-500 flex items-center gap-1">
                <AlertTriangle className="w-4 h-4" />
                {errors.task}
              </p>
            )}
          </div>

          {/* Quick Presets */}
          <div className="flex flex-wrap gap-2">
            <span className="text-sm text-gray-500 dark:text-gray-400 mr-2">Quick start:</span>
            {[3, 7, 14, 30].map(days => (
              <button
                key={days}
                type="button"
                onClick={() => applyPreset(days)}
                className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-blue-100 dark:hover:bg-blue-900/30 text-gray-700 dark:text-gray-300 hover:text-blue-700 dark:hover:text-blue-400 rounded-lg transition-colors"
              >
                {days} days
              </button>
            ))}
          </div>

          {/* Deadline Timeline */}
          <div className="space-y-4">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              <Clock className="w-4 h-4 text-amber-500" />
              Deadline Timeline
            </label>
            
            {/* Visual Timeline */}
            <div className="flex items-center gap-2 mb-4">
              <div className={`flex-1 h-2 rounded-full transition-colors ${formData.green ? 'bg-emerald-500' : 'bg-gray-200 dark:bg-gray-700'}`} />
              <div className="w-8 h-0.5 bg-gray-300 dark:bg-gray-600" />
              <div className={`flex-1 h-2 rounded-full transition-colors ${formData.yellow ? 'bg-amber-500' : 'bg-gray-200 dark:bg-gray-700'}`} />
              <div className="w-8 h-0.5 bg-gray-300 dark:bg-gray-600" />
              <div className={`flex-1 h-2 rounded-full transition-colors ${formData.red ? 'bg-red-500' : 'bg-gray-200 dark:bg-gray-700'}`} />
            </div>

            {/* Green Deadline */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                <span className="w-3 h-3 rounded-full bg-emerald-500" />
                Green Phase (Start Working)
              </label>
              <input
                type="datetime-local"
                min={getMinDateTime()}
                value={formData.green}
                onChange={(e) => handleChange("green", e.target.value)}
                className={`w-full px-4 py-3 rounded-xl border-2 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500/20 ${
                  errors.green && touched.green
                    ? "border-red-500 focus:border-red-500"
                    : "border-gray-200 dark:border-gray-700 focus:border-emerald-500"
                }`}
              />
              {errors.green && touched.green && (
                <p className="text-sm text-red-500">{errors.green}</p>
              )}
            </div>

            {/* Yellow Deadline */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-amber-600 dark:text-amber-400">
                <span className="w-3 h-3 rounded-full bg-amber-500" />
                Yellow Phase (Warning)
              </label>
              <input
                type="datetime-local"
                min={formData.green || getMinDateTime()}
                value={formData.yellow}
                onChange={(e) => handleChange("yellow", e.target.value)}
                className={`w-full px-4 py-3 rounded-xl border-2 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white transition-all focus:outline-none focus:ring-2 focus:ring-amber-500/20 ${
                  errors.yellow && touched.yellow
                    ? "border-red-500 focus:border-red-500"
                    : "border-gray-200 dark:border-gray-700 focus:border-amber-500"
                }`}
              />
              {errors.yellow && touched.yellow && (
                <p className="text-sm text-red-500">{errors.yellow}</p>
              )}
            </div>

            {/* Red Deadline */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-red-600 dark:text-red-400">
                <span className="w-3 h-3 rounded-full bg-red-500" />
                Red Phase (Final Deadline)
              </label>
              <input
                type="datetime-local"
                min={formData.yellow || getMinDateTime()}
                value={formData.red}
                onChange={(e) => handleChange("red", e.target.value)}
                className={`w-full px-4 py-3 rounded-xl border-2 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white transition-all focus:outline-none focus:ring-2 focus:ring-red-500/20 ${
                  errors.red && touched.red
                    ? "border-red-500 focus:border-red-500"
                    : "border-gray-200 dark:border-gray-700 focus:border-red-500"
                }`}
              />
              {errors.red && touched.red && (
                <p className="text-sm text-red-500">{errors.red}</p>
              )}
            </div>

            {errors.dates && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  {errors.dates}
                </p>
              </div>
            )}
          </div>

          {/* Submit Error */}
          {errors.submit && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
              <p className="text-sm text-red-600 dark:text-red-400">{errors.submit}</p>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 disabled:from-gray-400 disabled:to-gray-400 text-white font-bold rounded-xl shadow-lg shadow-blue-500/25 transition-all transform active:scale-95 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Adding Assignment...
              </>
            ) : (
              <>
                <Plus className="w-5 h-5" />
                Add Assignment
              </>
            )}
          </button>
        </div>
      </form>

      {/* Tips Card */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-blue-900 dark:text-blue-300 mb-2">
          <CheckCircle2 className="w-4 h-4" />
          Tips
        </h3>
        <ul className="text-sm text-blue-800 dark:text-blue-400 space-y-1 list-disc list-inside">
          <li>Green = Start working on it</li>
          <li>Yellow = Getting urgent, prioritize this</li>
          <li>Red = Final deadline, must complete</li>
        </ul>
      </div>
    </div>
  );
}
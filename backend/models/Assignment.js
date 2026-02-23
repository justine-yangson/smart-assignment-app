const mongoose = require("mongoose");

const DeadlineSchema = new mongoose.Schema({
  green: {
    type: Date,
    required: [true, "Green deadline is required"],
    validate: {
      validator: function(value) {
        const yellow = this.parent()?.deadlines?.yellow || this.yellow;
        const red = this.parent()?.deadlines?.red || this.red;
        
        // FIXED: Changed >= to > to allow same day, different times
        if (yellow && value > yellow) return false;
        if (red && value > red) return false;
        return true;
      },
      message: "Green deadline must be before Yellow and Red deadlines",
    },
  },
  yellow: {
    type: Date,
    required: [true, "Yellow deadline is required"],
    validate: {
      validator: function(value) {
        const green = this.parent()?.deadlines?.green || this.green;
        const red = this.parent()?.deadlines?.red || this.red;
        
        // FIXED: Changed <= to < and >= to > to allow same day
        if (green && value < green) return false;
        if (red && value > red) return false;
        return true;
      },
      message: "Yellow deadline must be after Green and before Red deadlines",
    },
  },
  red: {
    type: Date,
    required: [true, "Red deadline is required"],
    validate: {
      validator: function(value) {
        const green = this.parent()?.deadlines?.green || this.green;
        const yellow = this.parent()?.deadlines?.yellow || this.yellow;
        
        // FIXED: Changed <= to < to allow same day, different times
        if (green && value < green) return false;
        if (yellow && value < yellow) return false;
        return true;
      },
      message: "Red deadline must be after Green and Yellow deadlines",
    },
  },
}, { _id: false });

const AssignmentSchema = new mongoose.Schema({
  // ADDED: userEmail field to separate user data
  userEmail: {
    type: String,
    required: true,
    index: true
  },
  subject: { 
    type: String, 
    required: [true, "Subject is required"],
    trim: true,
    maxlength: [100, "Subject cannot exceed 100 characters"]
  },
  task: { 
    type: String, 
    required: [true, "Task description is required"],
    trim: true,
    maxlength: [1000, "Task description cannot exceed 1000 characters"]
  },
  deadlines: {
    type: DeadlineSchema,
    required: [true, "Deadlines are required"]
  },
  status: { 
    type: String, 
    enum: {
      values: ["upcoming", "completed", "archived"],
      message: "Status must be upcoming, completed, or archived"
    }, 
    default: "upcoming",
    index: true
  },
  priority: {
    type: String,
    enum: {
      values: ["low", "medium", "high"],
      message: "Priority must be low, medium, or high"
    },
    default: "medium",
    index: true
  },
  tags: [{
    type: String,
    trim: true,
    maxlength: [30, "Tag cannot exceed 30 characters"]
  }],
  completedAt: {
    type: Date,
    default: null
  },
  notified: {
    type: Boolean,
    default: false,
    description: "Whether user has been notified about deadline"
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// MODIFIED: Added userEmail to indexes
AssignmentSchema.index({ userEmail: 1, status: 1, "deadlines.red": 1 });
AssignmentSchema.index({ userEmail: 1, "deadlines.red": 1 });
AssignmentSchema.index({ subject: "text", task: "text" });

// Virtual for checking if assignment is overdue
AssignmentSchema.virtual("isOverdue").get(function() {
  if (this.status === "completed") return false;
  return new Date() > new Date(this.deadlines.red);
});

// Virtual for current phase (green/yellow/red/completed)
AssignmentSchema.virtual("currentPhase").get(function() {
  if (this.status === "completed") return "completed";
  
  const now = new Date();
  const { green, yellow, red } = this.deadlines;
  
  if (now >= new Date(red)) return "red";
  if (now >= new Date(yellow)) return "yellow";
  if (now >= new Date(green)) return "green";
  return "upcoming";
});

// Virtual for time remaining
AssignmentSchema.virtual("timeRemaining").get(function() {
  if (this.status === "completed") return 0;
  const now = new Date();
  const red = new Date(this.deadlines.red);
  return Math.max(0, red - now);
});

// Pre-save middleware to set completedAt
AssignmentSchema.pre("save", async function() {
  if (this.isModified("status") && this.status === "completed" && !this.completedAt) {
    this.completedAt = new Date();
  }
  if (this.isModified("status") && this.status !== "completed") {
    this.completedAt = null;
  }
});

// Static method to find overdue assignments
AssignmentSchema.statics.findOverdue = function() {
  return this.find({
    status: { $ne: "completed" },
    "deadlines.red": { $lt: new Date() }
  }).sort({ "deadlines.red": 1 });
};

// Static method to find upcoming deadlines (next 24 hours)
AssignmentSchema.statics.findUpcoming = function(hours = 24) {
  const now = new Date();
  const future = new Date(now.getTime() + hours * 60 * 60 * 1000);
  
  return this.find({
    status: { $ne: "completed" },
    "deadlines.red": { $gte: now, $lte: future }
  }).sort({ "deadlines.red": 1 });
};

// Instance method to check if notification should be sent
AssignmentSchema.methods.shouldNotify = function() {
  if (this.status === "completed" || this.notified) return false;
  
  const now = new Date();
  const { yellow, red } = this.deadlines;
  
  // Notify if in yellow phase or overdue
  return now >= new Date(yellow) || now >= new Date(red);
};

module.exports = mongoose.model("Assignment", AssignmentSchema);
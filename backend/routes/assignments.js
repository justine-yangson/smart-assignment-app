const express = require("express");
const router = express.Router();
const Assignment = require("../models/Assignment");

// -------------------- GET all assignments --------------------
router.get("/", async (req, res) => {
  try {
    const { status, priority, overdue, upcoming, search, limit = 50, skip = 0 } = req.query;
    
    // ADDED: Filter by user email from auth token
    const filter = { userEmail: req.userEmail };

    // Status filter
    if (status) filter.status = status;
    
    // Priority filter
    if (priority) filter.priority = priority;

    // Overdue filter (red deadline passed and not completed)
    if (overdue === "true") {
      filter.status = { $ne: "completed" };
      filter["deadlines.red"] = { $lt: new Date() };
    }

    // Upcoming filter (deadlines within next X hours)
    if (upcoming) {
      const hours = parseInt(upcoming) || 24;
      const now = new Date();
      const future = new Date(now.getTime() + hours * 60 * 60 * 1000);
      filter.status = { $ne: "completed" };
      filter["deadlines.red"] = { $gte: now, $lte: future };
    }

    // Text search
    if (search) {
      filter.$text = { $search: search };
    }

    const assignments = await Assignment.find(filter)
      .sort({ "deadlines.red": 1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip))
      .lean(); // Better performance

    // Add computed fields
    const enrichedAssignments = assignments.map(a => ({
      ...a,
      isOverdue: a.status !== "completed" && new Date() > new Date(a.deadlines.red),
      currentPhase: getCurrentPhase(a),
      timeRemaining: a.status === "completed" ? 0 : Math.max(0, new Date(a.deadlines.red) - new Date())
    }));

    res.json({
      success: true,
      count: enrichedAssignments.length,
      data: enrichedAssignments
    });
  } catch (err) {
    console.error("GET /assignments error:", err);
    res.status(500).json({ success: false, error: "Failed to fetch assignments" });
  }
});

// Helper function for current phase
function getCurrentPhase(assignment) {
  if (assignment.status === "completed") return "completed";
  const now = new Date();
  const { green, yellow, red } = assignment.deadlines;
  
  if (now >= new Date(red)) return "red";
  if (now >= new Date(yellow)) return "yellow";
  if (now >= new Date(green)) return "green";
  return "upcoming";
}

// -------------------- GET statistics --------------------
router.get("/stats/overview", async (req, res) => {
  try {
    const now = new Date();
    
    // MODIFIED: Added userEmail filter to all counts
    const userFilter = { userEmail: req.userEmail };
    
    const [total, completed, pending, overdue, dueSoon] = await Promise.all([
      Assignment.countDocuments(userFilter),
      Assignment.countDocuments({ ...userFilter, status: "completed" }),
      Assignment.countDocuments({ ...userFilter, status: { $ne: "completed" } }),
      Assignment.countDocuments({ 
        ...userFilter,
        status: { $ne: "completed" }, 
        "deadlines.red": { $lt: now } 
      }),
      Assignment.countDocuments({
        ...userFilter,
        status: { $ne: "completed" },
        "deadlines.red": { $gte: now, $lte: new Date(now.getTime() + 24 * 60 * 60 * 1000) }
      })
    ]);

    res.json({
      success: true,
      data: { total, completed, pending, overdue, dueSoon }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------- GET single assignment by ID --------------------
router.get("/:id", async (req, res) => {
  try {
    // MODIFIED: Added userEmail filter
    const assignment = await Assignment.findOne({ 
      _id: req.params.id,
      userEmail: req.userEmail 
    }).lean();
    
    if (!assignment) {
      return res.status(404).json({ success: false, error: "Assignment not found" });
    }
    
    // Add computed fields
    const enriched = {
      ...assignment,
      isOverdue: assignment.status !== "completed" && new Date() > new Date(assignment.deadlines.red),
      currentPhase: getCurrentPhase(assignment)
    };
    
    res.json({ success: true, data: enriched });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------- POST new assignment --------------------
router.post("/", async (req, res) => {
  console.log("=== POST /api/assignments ===");
  console.log("Request body:", JSON.stringify(req.body, null, 2));
  
  try {
    const { subject, task, deadlines, status, priority, tags } = req.body;

    // Validation
    if (!subject?.trim() || !task?.trim()) {
      console.log("ERROR: Missing subject or task");
      return res.status(400).json({ 
        success: false, 
        error: "Subject and task are required" 
      });
    }

    if (!deadlines?.green || !deadlines?.yellow || !deadlines?.red) {
      console.log("ERROR: Missing deadlines", deadlines);
      return res.status(400).json({ 
        success: false, 
        error: "All three deadlines (green, yellow, red) are required" 
      });
    }

    const green = new Date(deadlines.green);
    const yellow = new Date(deadlines.yellow);
    const red = new Date(deadlines.red);

    console.log("Parsed dates:", { green, yellow, red });

    // Validate dates are valid
    if ([green, yellow, red].some(d => isNaN(d.getTime()))) {
      console.log("ERROR: Invalid date format");
      return res.status(400).json({ 
        success: false, 
        error: "All deadlines must be valid dates" 
      });
    }

    // Validate chronological order
    if (!(green < yellow && yellow < red)) {
      console.log("ERROR: Dates not in order", { green, yellow, red });
      return res.status(400).json({ 
        success: false, 
        error: "Deadlines must follow: Green < Yellow < Red" 
      });
    }

    // Validate red deadline is in the future
    if (red < new Date()) {
      console.log("ERROR: Red deadline in past");
      return res.status(400).json({ 
        success: false, 
        error: "Red deadline must be in the future" 
      });
    }

    const newAssignment = new Assignment({
      // ADDED: userEmail from auth token
      userEmail: req.userEmail,
      subject: subject.trim(),
      task: task.trim(),
      deadlines: { green, yellow, red },
      status: status || "upcoming",
      priority: priority || "medium",
      tags: tags || []
    });

    console.log("Saving assignment...");
    const saved = await newAssignment.save();
    console.log("Saved successfully:", saved._id);
    
    res.status(201).json({ success: true, data: saved });
  } catch (err) {
    console.error("=== POST ERROR ===");
    console.error("Error name:", err.name);
    console.error("Error message:", err.message);
    console.error("Error stack:", err.stack);
    
    // Handle Mongoose validation errors
    if (err.name === "ValidationError") {
      return res.status(400).json({ 
        success: false, 
        error: Object.values(err.errors).map(e => e.message).join(", ")
      });
    }
    
    res.status(500).json({ success: false, error: "Failed to create assignment" });
  }
});

// -------------------- PATCH assignment (partial update) --------------------
router.patch("/:id", async (req, res) => {
  try {
    const { status, priority, notified, tags } = req.body;
    const updateData = {};

    // Build update object with only provided fields
    if (status !== undefined) updateData.status = status;
    if (priority !== undefined) updateData.priority = priority;
    if (notified !== undefined) updateData.notified = notified;
    if (tags !== undefined) updateData.tags = tags;

    // Handle deadline updates separately
    if (req.body.deadlines) {
      // MODIFIED: Added userEmail filter
      const current = await Assignment.findOne({ 
        _id: req.params.id,
        userEmail: req.userEmail 
      });
      
      if (!current) {
        return res.status(404).json({ success: false, error: "Assignment not found" });
      }

      const green = req.body.deadlines.green ? new Date(req.body.deadlines.green) : current.deadlines.green;
      const yellow = req.body.deadlines.yellow ? new Date(req.body.deadlines.yellow) : current.deadlines.yellow;
      const red = req.body.deadlines.red ? new Date(req.body.deadlines.red) : current.deadlines.red;

      if ([green, yellow, red].some(d => isNaN(d.getTime()))) {
        return res.status(400).json({ success: false, error: "Invalid date format" });
      }

      if (!(green < yellow && yellow < red)) {
        return res.status(400).json({ success: false, error: "Dates must follow: Green < Yellow < Red" });
      }

      updateData.deadlines = { green, yellow, red };
    }

    // MODIFIED: Added userEmail filter
    const updated = await Assignment.findOneAndUpdate(
      { _id: req.params.id, userEmail: req.userEmail },
      updateData,
      { new: true, runValidators: true }
    );

    if (!updated) {
      return res.status(404).json({ success: false, error: "Assignment not found" });
    }

    res.json({ success: true, data: updated });
  } catch (err) {
    console.error("PATCH error:", err);
    res.status(400).json({ success: false, error: err.message });
  }
});

// -------------------- PUT assignment (full update) --------------------
router.put("/:id", async (req, res) => {
  try {
    const { subject, task, deadlines, status, priority, tags } = req.body;

    // Full validation
    if (!subject?.trim() || !task?.trim() || !deadlines?.green || !deadlines?.yellow || !deadlines?.red) {
      return res.status(400).json({ 
        success: false, 
        error: "Subject, task, and all deadlines are required" 
      });
    }

    const green = new Date(deadlines.green);
    const yellow = new Date(deadlines.yellow);
    const red = new Date(deadlines.red);

    if ([green, yellow, red].some(d => isNaN(d.getTime()))) {
      return res.status(400).json({ success: false, error: "Invalid date format" });
    }

    if (!(green < yellow && yellow < red)) {
      return res.status(400).json({ success: false, error: "Dates must follow: Green < Yellow < Red" });
    }

    // MODIFIED: Added userEmail filter
    const updated = await Assignment.findOneAndUpdate(
      { _id: req.params.id, userEmail: req.userEmail },
      {
        subject: subject.trim(),
        task: task.trim(),
        deadlines: { green, yellow, red },
        status: status || "upcoming",
        priority: priority || "medium",
        tags: tags || []
      },
      { new: true, runValidators: true, overwrite: true }
    );

    if (!updated) {
      return res.status(404).json({ success: false, error: "Assignment not found" });
    }

    res.json({ success: true, data: updated });
  } catch (err) {
    console.error("PUT error:", err);
    res.status(400).json({ success: false, error: err.message });
  }
});

// -------------------- DELETE assignment --------------------
router.delete("/:id", async (req, res) => {
  try {
    // MODIFIED: Added userEmail filter
    const deleted = await Assignment.findOneAndDelete({ 
      _id: req.params.id,
      userEmail: req.userEmail 
    });
    
    if (!deleted) {
      return res.status(404).json({ success: false, error: "Assignment not found" });
    }
    res.json({ success: true, message: "Assignment deleted successfully" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------- Bulk operations --------------------
router.post("/bulk/complete", async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, error: "Array of IDs required" });
    }
    
    // MODIFIED: Added userEmail filter
    const result = await Assignment.updateMany(
      { _id: { $in: ids }, userEmail: req.userEmail },
      { status: "completed", completedAt: new Date() }
    );
    
    res.json({ success: true, modified: result.modifiedCount });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post("/bulk/delete", async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, error: "Array of IDs required" });
    }
    
    // MODIFIED: Added userEmail filter
    const result = await Assignment.deleteMany({ 
      _id: { $in: ids },
      userEmail: req.userEmail 
    });
    
    res.json({ success: true, deleted: result.deletedCount });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
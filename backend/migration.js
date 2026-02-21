// migration.js
const mongoose = require("mongoose");
const Assignment = require("./models/Assignment");
require("dotenv").config();

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    console.log("MongoDB Connected");

    const assignments = await Assignment.find({});
    for (const a of assignments) {
      // Only migrate if deadlines field does not exist
      if (!a.deadlines) {
        const oldDeadline = a.deadline || new Date();
        a.deadlines = {
          green: oldDeadline,
          yellow: oldDeadline,
          red: oldDeadline,
        };
        await a.save();
        console.log(`Updated assignment ${a._id}`);
      }
    }

    console.log("Migration done");
    mongoose.disconnect();
  })
  .catch(err => {
    console.error("Migration error:", err);
    mongoose.disconnect();
  });

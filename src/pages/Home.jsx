import { useState } from "react";

export default function Home({ list, setList }) {
  const [subject, setSubject] = useState("");
  const [task, setTask] = useState("");
  const [deadline, setDeadline] = useState("");

  const addTask = (e) => {
    e.preventDefault();
    if (!subject || !task || !deadline) return;

    setList([...list, { subject, task, deadline, done: false }]);
    setSubject("");
    setTask("");
    setDeadline("");
  };

  return (
    <div className="container">
      <h1>📚 Add Assignment</h1>

      <form onSubmit={addTask} className="card">
        <input
          placeholder="Subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
        />
        <input
          placeholder="Assignment"
          value={task}
          onChange={(e) => setTask(e.target.value)}
        />
        <input
          type="datetime-local"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
        />
        <button>Add</button>
      </form>
    </div>
  );
}

export default function Deadlines({ list }) {
  const now = new Date();

  return (
    <div className="container">
      <h1>📋 Your Deadlines</h1>

      {list.length === 0 && <p>No assignments yet 🎉</p>}

      <div className="list">
        {list.map((item, index) => {
          const isOverdue = new Date(item.deadline) < now;

          return (
            <div
              className={`deadline ${isOverdue ? "overdue" : "pending"}`}
              key={index}
            >
              <div className="deadline-header">
                <strong>{item.subject}</strong>
                <span>{isOverdue ? "⚠ Overdue" : "⏳ Pending"}</span>
              </div>

              <p>{item.task}</p>
              <small>{new Date(item.deadline).toLocaleString()}</small>
            </div>
          );
        })}
      </div>
    </div>
  );
}

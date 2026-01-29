import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import Home from "./pages/Home";
import Deadlines from "./pages/Deadlines";
import "./index.css";

export default function App() {
  const [list, setList] = useState([]);

  // -----------------------
  // THEME STATE
  // -----------------------
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem("theme");
    if (saved) return saved === "dark";
    // fallback to system preference
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  // -----------------------
  // LOAD DEADLINES
  // -----------------------
  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem("deadlines"));
    if (saved) setList(saved);
  }, []);

  // -----------------------
  // SAVE DEADLINES
  // -----------------------
  useEffect(() => {
    localStorage.setItem("deadlines", JSON.stringify(list));
  }, [list]);

  // -----------------------
  // APPLY THEME + SAVE TO LOCALSTORAGE
  // -----------------------
  useEffect(() => {
    if (isDark) {
      document.body.classList.add("dark");
    } else {
      document.body.classList.remove("dark");
    }
    localStorage.setItem("theme", isDark ? "dark" : "light");
  }, [isDark]);

  // -----------------------
  // AUTO-DARK MODE AT NIGHT (7PM-6AM)
  // -----------------------
  useEffect(() => {
    const hour = new Date().getHours();
    if (!localStorage.getItem("theme")) { // only if user hasn't chosen
      if (hour >= 19 || hour < 6) {
        setIsDark(true);
      }
    }
  }, []);

  // -----------------------
  // TOGGLE BUTTON
  // -----------------------
  const toggleTheme = () => setIsDark(prev => !prev);

  return (
    <BrowserRouter>
      <nav className="nav">
        <Link to="/">➕ Add</Link>
        <Link to="/deadlines">📋 Deadlines</Link>
        <button onClick={toggleTheme} className="theme-btn">
          {isDark ? "🌞" : "🌙"}
        </button>
      </nav>

      <Routes>
        <Route path="/" element={<Home list={list} setList={setList} />} />
        <Route path="/deadlines" element={<Deadlines list={list} />} />
      </Routes>
    </BrowserRouter>
  );
}

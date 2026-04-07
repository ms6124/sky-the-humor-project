"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

const STORAGE_KEY = "theme";

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
}

function getPreferredTheme(): Theme {
  if (typeof window === "undefined") {
    return "dark";
  }

  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark") {
    return stored;
  }

  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const preferred = getPreferredTheme();
    setTheme(preferred);
    applyTheme(preferred);
  }, []);

  const nextTheme = theme === "dark" ? "light" : "dark";
  const icon = theme === "dark" ? "☀︎" : "☾";

  function handleToggle() {
    const updated = theme === "dark" ? "light" : "dark";
    setTheme(updated);
    window.localStorage.setItem(STORAGE_KEY, updated);
    applyTheme(updated);
  }

  return (
    <button
      className="themeToggle themeToggleIcon"
      type="button"
      onClick={handleToggle}
      aria-label={`Switch to ${nextTheme} mode`}
    >
      {icon}
    </button>
  );
}

import { createContext, useContext, useState } from "react";

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [dark, setDark] = useState(false);
  return (
    <ThemeContext.Provider value={{ dark, toggle: () => setDark(d => !d) }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() { return useContext(ThemeContext); }

export function getTheme(dark) {
  return dark ? {
    bg:          "#08080a",
    surface:     "#0e0e12",
    surface2:    "#14141a",
    surfaceHover:"#1a1a22",
    border:      "#1e1e28",
    border2:     "#2e2e3e",
    text:        "#f0f0ff",
    textMuted:   "#8080a8",
    textDim:     "#404058",
    textDimmer:  "#282838",
    accent:      "#7c6fff",
    accentBg:    "#7c6fff18",
    accentBorder:"#7c6fff40",
    green:       "#00e5a0",
    greenBg:     "#00e5a018",
    orange:      "#ff8c42",
    orangeBg:    "#ff8c4218",
    pink:        "#ff5fa0",
    pinkBg:      "#ff5fa018",
    red:         "#ff4d6a",
  } : {
    bg:          "#f6f5ff",
    surface:     "#ffffff",
    surface2:    "#f0efff",
    surfaceHover:"#ebe9ff",
    border:      "#e0deff",
    border2:     "#c8c4f8",
    text:        "#0d0b24",
    textMuted:   "#6b68a0",
    textDim:     "#9d9bc0",
    textDimmer:  "#c5c3e0",
    accent:      "#5b52e8",
    accentBg:    "#5b52e810",
    accentBorder:"#5b52e830",
    green:       "#00a676",
    greenBg:     "#00a67610",
    orange:      "#e8622a",
    orangeBg:    "#e8622a10",
    pink:        "#d63580",
    pinkBg:      "#d6358010",
    red:         "#d63045",
  };
}

export const MODALITY_META = {
  text:  { label: "Text",  color: "#6366f1", bg: "#6366f115", border: "#6366f133", icon: "T" },
  code:  { label: "Code",  color: "#16a34a", bg: "#16a34a0d", border: "#16a34a33", icon: "</>" },
  image: { label: "Image", color: "#ea580c", bg: "#ea580c0d", border: "#ea580c33", icon: "img" },
  audio: { label: "Audio", color: "#db2777", bg: "#db27770d", border: "#db277733", icon: "♪" },
  video: { label: "Video", color: "#7c3aed", bg: "#7c3aed0d", border: "#7c3aed33", icon: "▶" },
};

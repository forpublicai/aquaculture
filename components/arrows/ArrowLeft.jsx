import React, { useState } from "react";
function ArrowBase({ dir, onClick, style }) {
  const [h, setH] = useState(false);
  const d = dir === "left" ? "M 5 0 L 0 5 L 5 10 L 5 0 Z" : "M 0 0 L 5 5 L 0 10 L 0 0 Z";
  return (
    <button aria-label={dir === "left" ? "Previous" : "Next"} onClick={onClick}
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)} style={{
      border: "none", cursor: "pointer", width: 40, height: 40, borderRadius: "var(--radius-control,10px)",
      backgroundColor: h ? "var(--color-brand,#EF3C24)" : "var(--surface-subtle,#F7F7F7)",
      display: "inline-flex", alignItems: "center", justifyContent: "center", padding: 0,
      transition: "background-color 120ms ease", ...style,
    }}>
      <svg width="5" height="10" viewBox="0 0 5 10" fill={h ? "#F7F7F7" : "#000"}><path d={d} /></svg>
    </button>
  );
}
export function ArrowLeft(props) { return <ArrowBase dir="left" {...props} />; }
export function ArrowRight(props) { return <ArrowBase dir="right" {...props} />; }

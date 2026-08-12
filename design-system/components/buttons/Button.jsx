import React, { useState } from "react";
export function Button({ children = "TRY IT", onClick, style }) {
  const [h, setH] = useState(false);
  return (
    <button onClick={onClick} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)} style={{
      border: "none", cursor: "pointer", borderRadius: "var(--radius-pill,1000px)",
      backgroundColor: h ? "var(--color-brand-hover,#FE6550)" : "var(--color-brand,#EF3C24)",
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      padding: "14px 22px", height: 48, boxSizing: "border-box",
      fontFamily: "var(--font-sans,'Public Sans',sans-serif)", fontWeight: 600, fontSize: 14,
      lineHeight: 1.4, color: "#fff", textTransform: "uppercase", whiteSpace: "nowrap",
      transition: "background-color 120ms ease", ...style,
    }}>{children}</button>
  );
}

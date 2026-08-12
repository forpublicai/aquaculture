import React, { useState } from "react";
export function ButtonLinkout({ children = "TRY IT", href, onClick, style }) {
  const [h, setH] = useState(false);
  const Tag = href ? "a" : "button";
  return (
    <Tag href={href} target={href ? "_blank" : undefined} rel={href ? "noopener" : undefined} onClick={onClick}
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)} style={{
      border: "none", cursor: "pointer", textDecoration: "none", borderRadius: "var(--radius-pill,1000px)",
      backgroundColor: h ? "var(--pai-gray-400,#929292)" : "var(--pai-black,#000)",
      display: "inline-flex", flexDirection: "row", gap: 2, alignItems: "center", justifyContent: "center",
      padding: "14px 22px", height: 48, boxSizing: "border-box",
      fontFamily: "var(--font-sans,'Public Sans',sans-serif)", fontWeight: 600, fontSize: 14,
      lineHeight: 1.4, color: "#fff", textTransform: "uppercase", whiteSpace: "nowrap",
      transition: "background-color 120ms ease", ...style,
    }}>
      <span>{children}</span>
      <svg width="7" height="7" viewBox="0 0 6 6.011" fill="#fff" style={{ marginBottom: 2 }} aria-hidden="true">
        <path d="M 5.01 4.993 L 5.01 1.052 L 5.649 1.091 L 0.735 6.011 L 0 5.276 L 4.914 0.362 L 4.965 1.001 L 1.007 1.001 L 1.007 0 L 6 0.011 L 6 4.993 L 5.01 4.993 Z" />
      </svg>
    </Tag>
  );
}

import React from "react";
import { Button } from "../buttons/Button.jsx";
export function Navigation({ title = "Public AI", buttonLabel = "TRY IT", breakpoint = "desktop", onButtonClick, style }) {
  return (
    <div style={{ width: breakpoint === "tablet" ? 720 : "100%", maxWidth: 1500, display: "flex", flexDirection: "row",
      padding: "20px 0px 80px 0px", justifyContent: "space-between", alignItems: "center", boxSizing: "border-box", ...style }}>
      <span style={{ fontFamily: "var(--font-sans,'Public Sans',sans-serif)", fontWeight: 400, fontSize: 30,
        lineHeight: 1.2, letterSpacing: "-0.03em", color: "#000", whiteSpace: "nowrap" }}>{title}</span>
      <Button onClick={onButtonClick}>{buttonLabel}</Button>
    </div>
  );
}

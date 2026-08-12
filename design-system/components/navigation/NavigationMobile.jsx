import React, { useState } from "react";
import { ButtonLinkout } from "../buttons/ButtonLinkout.jsx";
export function NavigationMobile({ title = "Public AI", items = ["Benefits", "Specifications", "How-to", "Contact Us"], buttonLabel = "TRY IT", open: openProp, onNavigate, style }) {
  const [openState, setOpen] = useState(false);
  const open = openProp ?? openState;
  const setOpenSafe = openProp === undefined ? setOpen : () => {};
  return (
    <div style={{ width: 375, overflow: "hidden", borderRadius: "0px 0px 20px 20px", backgroundColor: "#fff",
      boxShadow: "var(--shadow-nav,0px 2px 4px 0px rgba(0,0,0,0.05))", display: "flex", flexDirection: "column", ...style }}>
      <div style={{ display: "flex", flexDirection: "row", padding: "20px 20px 50px 20px", justifyContent: "space-between", alignItems: "flex-start" }}>
        <span style={{ fontFamily: "var(--font-sans,'Public Sans',sans-serif)", fontWeight: 500, fontSize: 24, lineHeight: 1.2, letterSpacing: "-0.03em", color: "#000" }}>{title}</span>
        <button aria-label={open ? "Close menu" : "Open menu"} onClick={() => setOpenSafe(!open)} style={{ border: "none", background: "none", padding: 0, cursor: "pointer", width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {open ? (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="#000"><path d="M 1.4 0 L 8 6.6 L 14.6 0 L 16 1.4 L 9.4 8 L 16 14.6 L 14.6 16 L 8 9.4 L 1.4 16 L 0 14.6 L 6.6 8 L 0 1.4 Z" /></svg>
          ) : (
            <svg width="18" height="12" viewBox="0 0 18 12" fill="#000"><path d="M 0 0 L 18 0 L 18 2 L 0 2 L 0 0 Z M 0 5 L 18 5 L 18 7 L 0 7 L 0 5 Z M 0 10 L 18 10 L 18 12 L 0 12 L 0 10 Z" /></svg>
          )}
        </button>
      </div>
      {open && (
        <div style={{ display: "flex", flexDirection: "column", gap: 50, padding: "8px 20px 32px 20px", alignItems: "flex-start" }}>
          <div style={{ display: "flex", flexDirection: "column", alignSelf: "stretch" }}>
            {items.map((label, i) => (
              <a key={i} href="#" onClick={(e) => { e.preventDefault(); onNavigate && onNavigate(label); }} style={{
                textDecoration: "none", border: "1px solid var(--border-hairline,#F7F7F7)", display: "flex", alignItems: "center",
                height: 80, padding: "30px 0px", boxSizing: "border-box",
                fontFamily: "var(--font-sans,'Public Sans',sans-serif)", fontWeight: 600, fontSize: 14, lineHeight: 1.4,
                color: "#000", textTransform: "uppercase" }}>{label}</a>
            ))}
          </div>
          <ButtonLinkout>{buttonLabel}</ButtonLinkout>
        </div>
      )}
    </div>
  );
}

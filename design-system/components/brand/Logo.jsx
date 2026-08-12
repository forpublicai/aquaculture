import React from "react";
const FILES = { default: "public-ai-logo.svg", mark: "public-ai-logo-mark.svg", network: "public-ai-network-logo.svg", "inference-utility": "public-ai-inference-utility-logo.svg" };
export function Logo({ variant = "default", height = 60, assetsBase = "assets", style }) {
  return <img src={`${assetsBase}/${FILES[variant] || FILES.default}`} alt="Public AI" style={{ height, width: "auto", display: "block", ...style }} />;
}
export function LogoMark({ height = 60, assetsBase = "assets", style }) {
  return <Logo variant="mark" height={height} assetsBase={assetsBase} style={style} />;
}

/**
 * Public AI square mark ("logo_mark" in Figma) — red tile with white ≥ glyph, from assets/public-ai-logo-mark.svg.
 */
export interface LogoMarkProps {
  /** Rendered height in px (default 60) */
  height?: number | string;
  /** Path prefix to the design system's assets folder (default "assets") */
  assetsBase?: string;
  style?: React.CSSProperties;
}
export declare function LogoMark(props: LogoMarkProps): JSX.Element;

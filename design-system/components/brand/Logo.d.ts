/**
 * Public AI logo lockup ("Logo" in Figma) — mark + wordmark SVG from assets/public-ai-logo.svg.
 */
export interface LogoProps {
  /** Which lockup: default | mark | network | inference-utility */
  variant?: "default" | "mark" | "network" | "inference-utility";
  /** Rendered height in px (default 60) */
  height?: number | string;
  /** Path prefix to the design system's assets folder (default "assets") */
  assetsBase?: string;
  style?: React.CSSProperties;
}
export declare function Logo(props: LogoProps): JSX.Element;

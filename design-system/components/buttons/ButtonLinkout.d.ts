/**
 * Black pill button with ↗ arrow ("Button linkout", State=Default/Hover in Figma) for external links. Hover: gray #929292.
 */
export interface ButtonLinkoutProps {
  /** Uppercase label, e.g. "TRY IT" */
  children?: React.ReactNode;
  /** Renders an <a target="_blank"> when set */
  href?: string;
  onClick?: () => void;
  style?: React.CSSProperties;
}
export declare function ButtonLinkout(props: ButtonLinkoutProps): JSX.Element;

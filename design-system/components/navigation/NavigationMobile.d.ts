/**
 * Mobile nav sheet ("Navigation mobile", Nav=open/closed in Figma): 375px white sheet with rounded bottom corners, hamburger/close toggle, uppercase hairline-ruled menu items, black linkout CTA.
 */
export interface NavigationMobileProps {
  title?: string;
  /** Menu item labels */
  items?: string[];
  buttonLabel?: string;
  /** Controlled open state; omit for self-managed toggle */
  open?: boolean;
  onNavigate?: (label: string) => void;
  style?: React.CSSProperties;
}
export declare function NavigationMobile(props: NavigationMobileProps): JSX.Element;

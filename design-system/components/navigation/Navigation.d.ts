/**
 * Top navigation bar ("Navigation", Breakpoint=Desktop/Tablet in Figma): 30px wordmark left, primary Button right.
 * @startingPoint section="Components" subtitle="Wordmark + CTA top bar" viewport="700x160"
 */
export interface NavigationProps {
  /** Wordmark text, e.g. "Public AI" or "Inference Utility" */
  title?: string;
  buttonLabel?: string;
  breakpoint?: "desktop" | "tablet";
  onButtonClick?: () => void;
  style?: React.CSSProperties;
}
export declare function Navigation(props: NavigationProps): JSX.Element;

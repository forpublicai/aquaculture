/**
 * Primary pill button ("Button", Type=Primary/Hover in Figma). Brand-red pill, uppercase Public Sans SemiBold 14. Hover: #FE6550.
 * @startingPoint section="Components" subtitle="Brand-red pill CTA" viewport="700x120"
 */
export interface ButtonProps {
  /** Uppercase label, e.g. "TRY IT" */
  children?: React.ReactNode;
  onClick?: () => void;
  style?: React.CSSProperties;
}
export declare function Button(props: ButtonProps): JSX.Element;

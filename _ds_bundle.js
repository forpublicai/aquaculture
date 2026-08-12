/* @ds-bundle: {"format":4,"namespace":"PublicAIDesignSystem_fd501f","components":[{"name":"ArrowLeft","sourcePath":"components/arrows/ArrowLeft.jsx"},{"name":"ArrowRight","sourcePath":"components/arrows/ArrowLeft.jsx"},{"name":"Logo","sourcePath":"components/brand/Logo.jsx"},{"name":"LogoMark","sourcePath":"components/brand/Logo.jsx"},{"name":"Button","sourcePath":"components/buttons/Button.jsx"},{"name":"ButtonLinkout","sourcePath":"components/buttons/ButtonLinkout.jsx"},{"name":"Navigation","sourcePath":"components/navigation/Navigation.jsx"},{"name":"NavigationMobile","sourcePath":"components/navigation/NavigationMobile.jsx"}],"sourceHashes":{"components/arrows/ArrowLeft.jsx":"ec2514340ebe","components/arrows/ArrowRight.jsx":"1286e765938b","components/brand/Logo.jsx":"a438ff815197","components/brand/LogoMark.jsx":"f9d96c86c774","components/buttons/Button.jsx":"7a5e5af362a7","components/buttons/ButtonLinkout.jsx":"6b6e74fedac0","components/navigation/Navigation.jsx":"6060d87ee442","components/navigation/NavigationMobile.jsx":"96217f543faf","ui_kits/inference-utility/Home.jsx":"8dbaaf96f3b2"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.PublicAIDesignSystem_fd501f = window.PublicAIDesignSystem_fd501f || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/arrows/ArrowLeft.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const {
  useState
} = React;
function ArrowBase({
  dir,
  onClick,
  style
}) {
  const [h, setH] = useState(false);
  const d = dir === "left" ? "M 5 0 L 0 5 L 5 10 L 5 0 Z" : "M 0 0 L 5 5 L 0 10 L 0 0 Z";
  return /*#__PURE__*/React.createElement("button", {
    "aria-label": dir === "left" ? "Previous" : "Next",
    onClick: onClick,
    onMouseEnter: () => setH(true),
    onMouseLeave: () => setH(false),
    style: {
      border: "none",
      cursor: "pointer",
      width: 40,
      height: 40,
      borderRadius: "var(--radius-control,10px)",
      backgroundColor: h ? "var(--color-brand,#EF3C24)" : "var(--surface-subtle,#F7F7F7)",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 0,
      transition: "background-color 120ms ease",
      ...style
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "5",
    height: "10",
    viewBox: "0 0 5 10",
    fill: h ? "#F7F7F7" : "#000"
  }, /*#__PURE__*/React.createElement("path", {
    d: d
  })));
}
function ArrowLeft(props) {
  return /*#__PURE__*/React.createElement(ArrowBase, _extends({
    dir: "left"
  }, props));
}
function ArrowRight(props) {
  return /*#__PURE__*/React.createElement(ArrowBase, _extends({
    dir: "right"
  }, props));
}
Object.assign(__ds_scope, { ArrowLeft, ArrowRight });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/arrows/ArrowLeft.jsx", error: String((e && e.message) || e) }); }

// components/arrows/ArrowRight.jsx
try { (() => {

Object.assign(__ds_scope, { ArrowRight: __ds_scope.ArrowRight });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/arrows/ArrowRight.jsx", error: String((e && e.message) || e) }); }

// components/brand/Logo.jsx
try { (() => {
const FILES = {
  default: "public-ai-logo.svg",
  mark: "public-ai-logo-mark.svg",
  network: "public-ai-network-logo.svg",
  "inference-utility": "public-ai-inference-utility-logo.svg"
};
function Logo({
  variant = "default",
  height = 60,
  assetsBase = "assets",
  style
}) {
  return /*#__PURE__*/React.createElement("img", {
    src: `${assetsBase}/${FILES[variant] || FILES.default}`,
    alt: "Public AI",
    style: {
      height,
      width: "auto",
      display: "block",
      ...style
    }
  });
}
function LogoMark({
  height = 60,
  assetsBase = "assets",
  style
}) {
  return /*#__PURE__*/React.createElement(Logo, {
    variant: "mark",
    height: height,
    assetsBase: assetsBase,
    style: style
  });
}
Object.assign(__ds_scope, { Logo, LogoMark });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/brand/Logo.jsx", error: String((e && e.message) || e) }); }

// components/brand/LogoMark.jsx
try { (() => {

Object.assign(__ds_scope, { LogoMark: __ds_scope.LogoMark });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/brand/LogoMark.jsx", error: String((e && e.message) || e) }); }

// components/buttons/Button.jsx
try { (() => {
const {
  useState
} = React;
function Button({
  children = "TRY IT",
  onClick,
  style
}) {
  const [h, setH] = useState(false);
  return /*#__PURE__*/React.createElement("button", {
    onClick: onClick,
    onMouseEnter: () => setH(true),
    onMouseLeave: () => setH(false),
    style: {
      border: "none",
      cursor: "pointer",
      borderRadius: "var(--radius-pill,1000px)",
      backgroundColor: h ? "var(--color-brand-hover,#FE6550)" : "var(--color-brand,#EF3C24)",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "14px 22px",
      height: 48,
      boxSizing: "border-box",
      fontFamily: "var(--font-sans,'Public Sans',sans-serif)",
      fontWeight: 600,
      fontSize: 14,
      lineHeight: 1.4,
      color: "#fff",
      textTransform: "uppercase",
      whiteSpace: "nowrap",
      transition: "background-color 120ms ease",
      ...style
    }
  }, children);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/buttons/Button.jsx", error: String((e && e.message) || e) }); }

// components/buttons/ButtonLinkout.jsx
try { (() => {
const {
  useState
} = React;
function ButtonLinkout({
  children = "TRY IT",
  href,
  onClick,
  style
}) {
  const [h, setH] = useState(false);
  const Tag = href ? "a" : "button";
  return /*#__PURE__*/React.createElement(Tag, {
    href: href,
    target: href ? "_blank" : undefined,
    rel: href ? "noopener" : undefined,
    onClick: onClick,
    onMouseEnter: () => setH(true),
    onMouseLeave: () => setH(false),
    style: {
      border: "none",
      cursor: "pointer",
      textDecoration: "none",
      borderRadius: "var(--radius-pill,1000px)",
      backgroundColor: h ? "var(--pai-gray-400,#929292)" : "var(--pai-black,#000)",
      display: "inline-flex",
      flexDirection: "row",
      gap: 2,
      alignItems: "center",
      justifyContent: "center",
      padding: "14px 22px",
      height: 48,
      boxSizing: "border-box",
      fontFamily: "var(--font-sans,'Public Sans',sans-serif)",
      fontWeight: 600,
      fontSize: 14,
      lineHeight: 1.4,
      color: "#fff",
      textTransform: "uppercase",
      whiteSpace: "nowrap",
      transition: "background-color 120ms ease",
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", null, children), /*#__PURE__*/React.createElement("svg", {
    width: "7",
    height: "7",
    viewBox: "0 0 6 6.011",
    fill: "#fff",
    style: {
      marginBottom: 2
    },
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M 5.01 4.993 L 5.01 1.052 L 5.649 1.091 L 0.735 6.011 L 0 5.276 L 4.914 0.362 L 4.965 1.001 L 1.007 1.001 L 1.007 0 L 6 0.011 L 6 4.993 L 5.01 4.993 Z"
  })));
}
Object.assign(__ds_scope, { ButtonLinkout });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/buttons/ButtonLinkout.jsx", error: String((e && e.message) || e) }); }

// components/navigation/Navigation.jsx
try { (() => {
function Navigation({
  title = "Public AI",
  buttonLabel = "TRY IT",
  breakpoint = "desktop",
  onButtonClick,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      width: breakpoint === "tablet" ? 720 : "100%",
      maxWidth: 1500,
      display: "flex",
      flexDirection: "row",
      padding: "20px 0px 80px 0px",
      justifyContent: "space-between",
      alignItems: "center",
      boxSizing: "border-box",
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-sans,'Public Sans',sans-serif)",
      fontWeight: 400,
      fontSize: 30,
      lineHeight: 1.2,
      letterSpacing: "-0.03em",
      color: "#000",
      whiteSpace: "nowrap"
    }
  }, title), /*#__PURE__*/React.createElement(__ds_scope.Button, {
    onClick: onButtonClick
  }, buttonLabel));
}
Object.assign(__ds_scope, { Navigation });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/Navigation.jsx", error: String((e && e.message) || e) }); }

// components/navigation/NavigationMobile.jsx
try { (() => {
const {
  useState
} = React;
function NavigationMobile({
  title = "Public AI",
  items = ["Benefits", "Specifications", "How-to", "Contact Us"],
  buttonLabel = "TRY IT",
  open: openProp,
  onNavigate,
  style
}) {
  const [openState, setOpen] = useState(false);
  const open = openProp ?? openState;
  const setOpenSafe = openProp === undefined ? setOpen : () => {};
  return /*#__PURE__*/React.createElement("div", {
    style: {
      width: 375,
      overflow: "hidden",
      borderRadius: "0px 0px 20px 20px",
      backgroundColor: "#fff",
      boxShadow: "var(--shadow-nav,0px 2px 4px 0px rgba(0,0,0,0.05))",
      display: "flex",
      flexDirection: "column",
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "row",
      padding: "20px 20px 50px 20px",
      justifyContent: "space-between",
      alignItems: "flex-start"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-sans,'Public Sans',sans-serif)",
      fontWeight: 500,
      fontSize: 24,
      lineHeight: 1.2,
      letterSpacing: "-0.03em",
      color: "#000"
    }
  }, title), /*#__PURE__*/React.createElement("button", {
    "aria-label": open ? "Close menu" : "Open menu",
    onClick: () => setOpenSafe(!open),
    style: {
      border: "none",
      background: "none",
      padding: 0,
      cursor: "pointer",
      width: 24,
      height: 24,
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }
  }, open ? /*#__PURE__*/React.createElement("svg", {
    width: "16",
    height: "16",
    viewBox: "0 0 16 16",
    fill: "#000"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M 1.4 0 L 8 6.6 L 14.6 0 L 16 1.4 L 9.4 8 L 16 14.6 L 14.6 16 L 8 9.4 L 1.4 16 L 0 14.6 L 6.6 8 L 0 1.4 Z"
  })) : /*#__PURE__*/React.createElement("svg", {
    width: "18",
    height: "12",
    viewBox: "0 0 18 12",
    fill: "#000"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M 0 0 L 18 0 L 18 2 L 0 2 L 0 0 Z M 0 5 L 18 5 L 18 7 L 0 7 L 0 5 Z M 0 10 L 18 10 L 18 12 L 0 12 L 0 10 Z"
  })))), open && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 50,
      padding: "8px 20px 32px 20px",
      alignItems: "flex-start"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      alignSelf: "stretch"
    }
  }, items.map((label, i) => /*#__PURE__*/React.createElement("a", {
    key: i,
    href: "#",
    onClick: e => {
      e.preventDefault();
      onNavigate && onNavigate(label);
    },
    style: {
      textDecoration: "none",
      border: "1px solid var(--border-hairline,#F7F7F7)",
      display: "flex",
      alignItems: "center",
      height: 80,
      padding: "30px 0px",
      boxSizing: "border-box",
      fontFamily: "var(--font-sans,'Public Sans',sans-serif)",
      fontWeight: 600,
      fontSize: 14,
      lineHeight: 1.4,
      color: "#000",
      textTransform: "uppercase"
    }
  }, label))), /*#__PURE__*/React.createElement(__ds_scope.ButtonLinkout, null, buttonLabel)));
}
Object.assign(__ds_scope, { NavigationMobile });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/NavigationMobile.jsx", error: String((e && e.message) || e) }); }

// ui_kits/inference-utility/Home.jsx
try { (() => {
const kit = window.PublicAIDesignSystem_fd501f;
const {
  Navigation,
  Button,
  ButtonLinkout,
  ArrowLeft,
  ArrowRight
} = kit;
const inter = "'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif";
const psans = "var(--font-sans)";
function Chatbox() {
  const [msgs, setMsgs] = React.useState([]);
  const [v, setV] = React.useState("");
  const send = () => {
    if (!v.trim()) return;
    setMsgs([...msgs, v.trim()]);
    setV("");
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      alignSelf: "stretch",
      padding: "100px 0 60px",
      display: "flex",
      flexDirection: "column",
      gap: 32
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      alignSelf: "stretch",
      border: "1px solid var(--border-hairline)",
      borderRadius: 16,
      padding: 24,
      display: "flex",
      flexDirection: "column",
      gap: 16
    }
  }, msgs.map((m, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      alignSelf: "flex-end",
      background: "var(--surface-subtle)",
      borderRadius: 12,
      padding: "10px 16px",
      fontFamily: psans,
      fontSize: 15
    }
  }, m)), msgs.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      alignSelf: "flex-start",
      fontFamily: psans,
      fontSize: 15,
      color: "var(--text-primary)"
    }
  }, "Apertus is thinking\u2026"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 12,
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement("input", {
    value: v,
    onChange: e => setV(e.target.value),
    onKeyDown: e => e.key === "Enter" && send(),
    placeholder: "Ask Apertus anything",
    style: {
      flex: 1,
      border: "1px solid var(--border-hairline)",
      borderRadius: 1000,
      padding: "14px 22px",
      fontFamily: psans,
      fontSize: 15,
      outline: "none",
      background: "var(--surface-page)",
      color: "var(--text-primary)"
    }
  }), /*#__PURE__*/React.createElement(Button, {
    onClick: send
  }, "Send"))), /*#__PURE__*/React.createElement("div", {
    style: {
      alignSelf: "stretch",
      padding: "40px 64px",
      textAlign: "center",
      fontFamily: psans,
      fontWeight: 400,
      fontSize: 32,
      lineHeight: 1.2,
      letterSpacing: "-0.02em"
    }
  }, "What if AI were public infrastructure like highways, water, or electricity?"));
}
function FeatureCard({
  title,
  sub,
  img,
  imgH,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      overflow: "hidden",
      borderRadius: 16,
      backgroundColor: "var(--surface-subtle)",
      display: "flex",
      flexDirection: "column",
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 32,
      display: "flex",
      flexDirection: "column",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: inter,
      fontWeight: 600,
      fontSize: 24,
      lineHeight: 1.2,
      letterSpacing: "-0.02em"
    }
  }, title), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: inter,
      fontWeight: 500,
      fontSize: 18,
      lineHeight: 1.45,
      letterSpacing: "-0.005em",
      color: "var(--text-primary)"
    }
  }, sub)), /*#__PURE__*/React.createElement("div", {
    style: {
      height: imgH,
      background: `url(${img}) center / cover no-repeat`,
      flexGrow: 1
    }
  }));
}
function FeatureRow({
  title,
  sub,
  cta,
  img,
  flip
}) {
  const content = /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: "flex",
      flexDirection: "column",
      gap: 48,
      justifyContent: "center"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 24
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: inter,
      fontWeight: 700,
      fontSize: 36,
      lineHeight: 1.2,
      letterSpacing: "-0.02em"
    }
  }, title), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: inter,
      fontWeight: 500,
      fontSize: 18,
      lineHeight: 1.45,
      letterSpacing: "-0.005em",
      color: "var(--text-primary)"
    }
  }, sub)), /*#__PURE__*/React.createElement("button", {
    style: {
      border: "none",
      cursor: "pointer",
      width: "fit-content",
      borderRadius: 12,
      backgroundColor: "#000",
      padding: "12px 16px",
      fontFamily: inter,
      fontWeight: 500,
      fontSize: 18,
      lineHeight: 1.45,
      letterSpacing: "-0.005em",
      color: "#fff"
    }
  }, cta));
  const image = /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      height: 242,
      borderRadius: 16,
      background: `url(${img}) center / cover no-repeat`
    }
  });
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 64,
      padding: "40px 64px",
      alignItems: "center"
    }
  }, flip ? image : content, flip ? content : image);
}
function HomePage({
  bg = "#fff"
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      width: 1280,
      margin: "0 auto",
      background: bg,
      padding: "0 40px 20px",
      boxSizing: "border-box",
      display: "flex",
      flexDirection: "column",
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement(Navigation, {
    title: "Public AI",
    buttonLabel: "LOG IN",
    style: {
      alignSelf: "stretch"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      alignSelf: "stretch",
      fontFamily: psans,
      fontWeight: 300,
      fontSize: 140,
      lineHeight: 0.9,
      letterSpacing: "-0.05em",
      textAlign: "center"
    }
  }, "Try Apertus"), /*#__PURE__*/React.createElement(Chatbox, null), /*#__PURE__*/React.createElement("div", {
    style: {
      alignSelf: "stretch",
      padding: "120px 64px",
      display: "flex",
      gap: 32,
      alignItems: "stretch"
    }
  }, /*#__PURE__*/React.createElement(FeatureCard, {
    title: "With love, from Switzerland",
    sub: "Imanol\u2019s team just launched Apertus, the most powerful open-source language model ever released by a public institution.",
    img: "../../assets/images/card-apertus-launch.png",
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: "flex",
      flexDirection: "column",
      gap: 32
    }
  }, /*#__PURE__*/React.createElement(FeatureCard, {
    title: "Airbus for AI",
    sub: "Learn more about the movement for publicly supported sovereign AI",
    img: "../../assets/images/card-airbus-for-ai.png",
    imgH: 240,
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement(FeatureCard, {
    title: "Call for Contributions",
    sub: "We\u2019re looking for open source contributors to help build public AI",
    img: "../../assets/images/card-contributions.png",
    imgH: 160,
    style: {
      flex: 1
    }
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      alignSelf: "stretch",
      border: "1px solid var(--border-hairline)",
      padding: "80px 0 60px",
      display: "flex",
      flexDirection: "column",
      gap: 50
    }
  }, /*#__PURE__*/React.createElement(FeatureRow, {
    title: "About Public AI",
    sub: "Call out a feature, benefit, or value of your site, then link to a page where people can learn more about it.",
    cta: "Call to action",
    img: "../../assets/images/feature-about.png"
  }), /*#__PURE__*/React.createElement(FeatureRow, {
    flip: true,
    title: "Contributing",
    sub: "When there\u2019s one great thing, there\u2019s usually another. What\u2019s your second thing to showcase?",
    cta: "Another button",
    img: "../../assets/images/feature-contributing.png"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      alignSelf: "stretch",
      padding: "50px 0",
      display: "flex",
      flexDirection: "column",
      gap: 30,
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: psans,
      fontSize: 15,
      lineHeight: 1.4,
      letterSpacing: "-0.005em",
      color: "var(--text-primary)"
    }
  }, "Our inference partners"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 40,
      justifyContent: "center",
      alignItems: "center",
      flexWrap: "wrap"
    }
  }, [0, 1, 2, 3, 4, 5].map(n => /*#__PURE__*/React.createElement("img", {
    key: n,
    src: `../../assets/images/partner-logo-${n}.png`,
    alt: "partner",
    style: {
      height: 32,
      objectFit: "contain"
    }
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      alignSelf: "stretch",
      border: "1px solid var(--border-hairline)",
      padding: "120px 300px",
      display: "flex",
      flexDirection: "column",
      gap: 40,
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: psans,
      fontWeight: 300,
      fontSize: 60,
      lineHeight: 0.9,
      letterSpacing: "-0.03em",
      textAlign: "center"
    }
  }, "By the people, for the people"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: psans,
      fontSize: 15,
      lineHeight: 1.4,
      color: "var(--text-primary)",
      textAlign: "center"
    }
  }, "AI as public infrastructure, built in the open"), /*#__PURE__*/React.createElement(ButtonLinkout, {
    href: "https://chat.publicai.co"
  }, "Try it")), /*#__PURE__*/React.createElement("div", {
    style: {
      alignSelf: "stretch",
      borderTop: "1px solid var(--border-hairline)",
      padding: "40px 0",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 32
    }
  }, ["TERMS & CONDITIONS", "CONTACT US"].map(t => /*#__PURE__*/React.createElement("span", {
    key: t,
    style: {
      fontFamily: psans,
      fontWeight: 600,
      fontSize: 14,
      textTransform: "uppercase"
    }
  }, t))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 16,
      fontFamily: psans,
      fontSize: 15,
      color: "var(--text-primary)"
    }
  }, /*#__PURE__*/React.createElement("span", null, "\xA9 Public AI Inference Utility"), /*#__PURE__*/React.createElement("span", null, "All Rights Reserved"))));
}
window.PAIHomePage = HomePage;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/inference-utility/Home.jsx", error: String((e && e.message) || e) }); }

__ds_ns.ArrowLeft = __ds_scope.ArrowLeft;

__ds_ns.ArrowRight = __ds_scope.ArrowRight;

__ds_ns.Logo = __ds_scope.Logo;

__ds_ns.LogoMark = __ds_scope.LogoMark;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.ButtonLinkout = __ds_scope.ButtonLinkout;

__ds_ns.Navigation = __ds_scope.Navigation;

__ds_ns.NavigationMobile = __ds_scope.NavigationMobile;

})();

const kit = window.PublicAIDesignSystem_fd501f;
const { Navigation, Button, ButtonLinkout, ArrowLeft, ArrowRight } = kit;
const inter = "'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif";
const psans = "var(--font-sans)";
function Chatbox() {
  const [msgs, setMsgs] = React.useState([]);
  const [v, setV] = React.useState("");
  const send = () => { if (!v.trim()) return; setMsgs([...msgs, v.trim()]); setV(""); };
  return (
    <div style={{ alignSelf: "stretch", padding: "100px 0 60px", display: "flex", flexDirection: "column", gap: 32 }}>
      <div style={{ alignSelf: "stretch", border: "1px solid var(--border-hairline)", borderRadius: 16, padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
        {msgs.map((m, i) => (
          <div key={i} style={{ alignSelf: "flex-end", background: "var(--surface-subtle)", borderRadius: 12, padding: "10px 16px", fontFamily: psans, fontSize: 15 }}>{m}</div>
        ))}
        {msgs.length > 0 && <div style={{ alignSelf: "flex-start", fontFamily: psans, fontSize: 15 }}>Apertus is thinking…</div>}
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <input value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Ask Apertus anything"
            style={{ flex: 1, border: "1px solid var(--border-hairline)", borderRadius: 1000, padding: "14px 22px", fontFamily: psans, fontSize: 15, outline: "none", background: "var(--surface-page)", color: "var(--text-primary)" }} />
          <Button onClick={send}>Send</Button>
        </div>
      </div>
      <div style={{ alignSelf: "stretch", padding: "40px 64px", textAlign: "center", fontFamily: psans, fontWeight: 400, fontSize: 32, lineHeight: 1.2, letterSpacing: "-0.02em" }}>
        What if AI were public infrastructure like highways, water, or electricity?
      </div>
    </div>
  );
}
function FeatureCard({ title, sub, img, imgH, style }) {
  return (
    <div style={{ overflow: "hidden", borderRadius: 16, backgroundColor: "var(--surface-subtle)", display: "flex", flexDirection: "column", ...style }}>
      <div style={{ padding: 32, display: "flex", flexDirection: "column", gap: 8 }}>
        <span style={{ fontFamily: inter, fontWeight: 600, fontSize: 24, lineHeight: 1.2, letterSpacing: "-0.02em" }}>{title}</span>
        <span style={{ fontFamily: inter, fontWeight: 500, fontSize: 18, lineHeight: 1.45, letterSpacing: "-0.005em" }}>{sub}</span>
      </div>
      <div style={{ height: imgH, background: `url(${img}) center / cover no-repeat`, flexGrow: 1 }}></div>
    </div>
  );
}
function FeatureRow({ title, sub, cta, img, flip }) {
  const content = (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 48, justifyContent: "center" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <span style={{ fontFamily: inter, fontWeight: 700, fontSize: 36, lineHeight: 1.2, letterSpacing: "-0.02em" }}>{title}</span>
        <span style={{ fontFamily: inter, fontWeight: 500, fontSize: 18, lineHeight: 1.45, letterSpacing: "-0.005em" }}>{sub}</span>
      </div>
      <button style={{ border: "none", cursor: "pointer", width: "fit-content", borderRadius: 12, backgroundColor: "#000", padding: "12px 16px", fontFamily: inter, fontWeight: 500, fontSize: 18, lineHeight: 1.45, letterSpacing: "-0.005em", color: "#fff" }}>{cta}</button>
    </div>
  );
  const image = <div style={{ flex: 1, height: 242, borderRadius: 16, background: `url(${img}) center / cover no-repeat` }}></div>;
  return (
    <div style={{ display: "flex", gap: 64, padding: "40px 64px", alignItems: "center" }}>
      {flip ? image : content}{flip ? content : image}
    </div>
  );
}
function HomePage({ bg = "#fff" }) {
  return (
    <div style={{ width: 1280, margin: "0 auto", background: bg, padding: "0 40px 20px", boxSizing: "border-box", display: "flex", flexDirection: "column", alignItems: "center" }}>
      <Navigation title="Public AI" buttonLabel="LOG IN" style={{ alignSelf: "stretch" }} />
      <div style={{ alignSelf: "stretch", fontFamily: psans, fontWeight: 300, fontSize: 140, lineHeight: 0.9, letterSpacing: "-0.05em", textAlign: "center" }}>Try Apertus</div>
      <Chatbox />
      <div style={{ alignSelf: "stretch", padding: "120px 64px", display: "flex", gap: 32, alignItems: "stretch" }}>
        <FeatureCard title="With love, from Switzerland" sub="Imanol’s team just launched Apertus, the most powerful open-source language model ever released by a public institution." img="../../assets/images/card-apertus-launch.png" style={{ flex: 1 }} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 32 }}>
          <FeatureCard title="Airbus for AI" sub="Learn more about the movement for publicly supported sovereign AI" img="../../assets/images/card-airbus-for-ai.png" imgH={240} style={{ flex: 1 }} />
          <FeatureCard title="Call for Contributions" sub="We’re looking for open source contributors to help build public AI" img="../../assets/images/card-contributions.png" imgH={160} style={{ flex: 1 }} />
        </div>
      </div>
      <div style={{ alignSelf: "stretch", border: "1px solid var(--border-hairline)", padding: "80px 0 60px", display: "flex", flexDirection: "column", gap: 50 }}>
        <FeatureRow title="About Public AI" sub="Call out a feature, benefit, or value of your site, then link to a page where people can learn more about it." cta="Call to action" img="../../assets/images/feature-about.png" />
        <FeatureRow flip title="Contributing" sub="When there’s one great thing, there’s usually another. What’s your second thing to showcase?" cta="Another button" img="../../assets/images/feature-contributing.png" />
      </div>
      <div style={{ alignSelf: "stretch", padding: "50px 0", display: "flex", flexDirection: "column", gap: 30, alignItems: "center" }}>
        <span style={{ fontFamily: psans, fontSize: 15, lineHeight: 1.4, letterSpacing: "-0.005em" }}>Our inference partners</span>
        <div style={{ display: "flex", gap: 40, justifyContent: "center", alignItems: "center", flexWrap: "wrap" }}>
          {[0, 1, 2, 3, 4, 5].map((n) => <img key={n} src={`../../assets/images/partner-logo-${n}.png`} alt="partner" style={{ height: 32, objectFit: "contain" }} />)}
        </div>
      </div>
      <div style={{ alignSelf: "stretch", border: "1px solid var(--border-hairline)", padding: "120px 300px", display: "flex", flexDirection: "column", gap: 40, alignItems: "center" }}>
        <span style={{ fontFamily: psans, fontWeight: 300, fontSize: 60, lineHeight: 0.9, letterSpacing: "-0.03em", textAlign: "center" }}>By the people, for the people</span>
        <span style={{ fontFamily: psans, fontSize: 15, lineHeight: 1.4, textAlign: "center" }}>AI as public infrastructure, built in the open</span>
        <ButtonLinkout href="https://chat.publicai.co">Try it</ButtonLinkout>
      </div>
      <div style={{ alignSelf: "stretch", borderTop: "1px solid var(--border-hairline)", padding: "40px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 32 }}>
          {["TERMS & CONDITIONS", "CONTACT US"].map((t) => <span key={t} style={{ fontFamily: psans, fontWeight: 600, fontSize: 14, textTransform: "uppercase" }}>{t}</span>)}
        </div>
        <div style={{ display: "flex", gap: 16, fontFamily: psans, fontSize: 15 }}>
          <span>© Public AI Inference Utility</span><span>All Rights Reserved</span>
        </div>
      </div>
    </div>
  );
}
window.PAIHomePage = HomePage;

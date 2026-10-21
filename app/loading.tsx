export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading documents">
      <header className="app-head" />
      <main className="dash">
        <section className="dash-hero"><div><div className="skel" style={{ height: 16, width: 280, marginBottom: 12 }} /><div className="skel" style={{ height: 44, width: 360 }} /></div></section>
        {["My documents", "Shared with me"].map((s) => (
          <section key={s} className="sec">
            <div className="sec-head"><h2>{s}</h2></div>
            <div className="doc-grid">
              {[0, 1, 2].map((i) => <div key={i} className="skel-card"><div className="skel skel-thumb" /><div className="skel l1" /><div className="skel l2" /></div>)}
            </div>
          </section>
        ))}
      </main>
    </div>
  );
}

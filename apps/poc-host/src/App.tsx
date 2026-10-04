export function App() {
  return (
    <main className="poc-host" data-testid="poc-host-shell">
      <header className="poc-host__header">
        <p className="poc-host__eyebrow">Disposable research host</p>
        <h1>Standalone native-rendering POC</h1>
        <p>
          This independent React shell reserves a native DOM boundary for later Grafana rendering gates.
        </p>
      </header>

      <section className="poc-host__sentinel" aria-labelledby="host-sentinel-title">
        <h2 id="host-sentinel-title">Host style sentinel</h2>
        <p data-testid="host-style-sentinel">
          These host-owned styles must remain unchanged when Grafana styling is introduced.
        </p>
        <div
          className="poc-host__dashboard-boundary"
          data-testid="grafana-dashboard-root"
          aria-label="Grafana dashboard rendering boundary"
        />
      </section>
    </main>
  );
}

import { Link } from 'react-router-dom';

export default function SetupNeeded() {
  return (
    <div className="page" style={{ maxWidth: 640 }}>
      <h1>
        <span className="brand">
          Fútbol<span>Stream</span>
        </span>
      </h1>
      <div className="card stack">
        <h2>Falta configurar Firebase</h2>
        <p className="muted">
          Copia <code>web/.env.example</code> a <code>web/.env.local</code> y rellena la configuración web de tu proyecto
          Firebase. Los pasos están en <code>docs/SETUP.md</code>.
        </p>
        <p>Mientras tanto puedes probar el modo demo, que funciona sin servidor:</p>
        <div className="row">
          <Link className="btn primary" to="/control/demo">
            Abrir panel demo
          </Link>
          <a className="btn" href="/overlay/demo?bg=field" target="_blank" rel="noreferrer">
            Abrir overlay demo
          </a>
        </div>
      </div>
    </div>
  );
}

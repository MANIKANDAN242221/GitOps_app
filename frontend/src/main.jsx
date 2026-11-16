import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';

const APP_VERSION = import.meta.env.VITE_APP_VERSION || 'dev';

const FALLBACK_STAGES = [
  { id: 'commit', name: 'Git Commit', tool: 'GitHub', detail: 'Developer pushes to main' },
  { id: 'ci', name: 'Build & Test', tool: 'GitHub Actions', detail: 'Lint, unit tests, image build' },
  { id: 'registry', name: 'Push Image', tool: 'Amazon ECR', detail: 'Tagged, scanned container image' },
  { id: 'sync', name: 'GitOps Sync', tool: 'Argo CD', detail: 'Desired state pulled from Git' },
  { id: 'run', name: 'Running', tool: 'Amazon EKS', detail: 'Rolling update, zero downtime' },
];

const STAGE_ICONS = {
  commit: 'M12 3v6m0 6v6M7 12a5 5 0 1 0 10 0 5 5 0 0 0-10 0',
  ci: 'M4 12l5 5L20 6',
  registry: 'M4 7l8-4 8 4-8 4-8-4zm0 5l8 4 8-4M4 17l8 4 8-4',
  sync: 'M20 12a8 8 0 0 1-14.3 4.9M4 12a8 8 0 0 1 14.3-4.9M18 3v4h-4M6 21v-4h4',
  run: 'M12 2l9 5v10l-9 5-9-5V7z',
};

const LOG_LINES = {
  commit: ['$ git push origin main', '→ commit 7f3a9c1 "feat: animated dashboard"'],
  ci: ['✓ lint passed', '✓ 6 tests passed', '✓ image built in 41s'],
  registry: ['→ pushing dev/frontend:7f3a9c1', '✓ scan complete: 0 critical'],
  sync: ['argocd: OutOfSync → Syncing', '✓ manifests applied (3 resources)'],
  run: ['deployment/frontend rolled out 3/3', '✓ Healthy · Synced'],
};

const STEP_MS = 1700;

/* ------------------------------------------------------------------ hooks */

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

function useInView(options = { threshold: 0.3 }) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setInView(true);
        io.disconnect();
      }
    }, options);
    io.observe(el);
    return () => io.disconnect();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return [ref, inView];
}

/* ------------------------------------------------- particle network canvas */

function ParticleField() {
  const canvasRef = useRef(null);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const mouse = { x: -9999, y: -9999 };
    let particles = [];
    let width = 0;
    let height = 0;
    let frame = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.min(110, Math.floor((width * height) / 14000));
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        r: Math.random() * 1.6 + 0.6,
        hue: Math.random() < 0.5 ? 252 : 168,
      }));
    };

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      const linkDist = 130;

      for (let i = 0; i < particles.length; i += 1) {
        const p = particles[i];
        if (!reduced) {
          // gentle pull toward the cursor
          const dx = mouse.x - p.x;
          const dy = mouse.y - p.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < 180 * 180) {
            p.vx += dx * 0.00004;
            p.vy += dy * 0.00004;
          }
          p.vx *= 0.995;
          p.vy *= 0.995;
          p.x += p.vx;
          p.y += p.vy;
          if (p.x < 0 || p.x > width) p.vx *= -1;
          if (p.y < 0 || p.y > height) p.vy *= -1;
        }

        for (let j = i + 1; j < particles.length; j += 1) {
          const q = particles[j];
          const dx = p.x - q.x;
          const dy = p.y - q.y;
          const dist = Math.hypot(dx, dy);
          if (dist < linkDist) {
            ctx.strokeStyle = `hsla(${p.hue}, 90%, 70%, ${(1 - dist / linkDist) * 0.22})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(q.x, q.y);
            ctx.stroke();
          }
        }

        ctx.fillStyle = `hsla(${p.hue}, 95%, 72%, 0.9)`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }

      if (!reduced) frame = requestAnimationFrame(draw);
    };

    const onMove = (e) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };
    const onLeave = () => {
      mouse.x = -9999;
      mouse.y = -9999;
    };
    const onVisibility = () => {
      cancelAnimationFrame(frame);
      if (!document.hidden && !reduced) frame = requestAnimationFrame(draw);
    };

    resize();
    draw();
    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerleave', onLeave);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerleave', onLeave);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [reduced]);

  return <canvas ref={canvasRef} className="particles" aria-hidden="true" />;
}

/* ----------------------------------------------------------- small pieces */

function RevealText({ text, className, delay = 0 }) {
  return (
    <span className={className} aria-label={text}>
      {text.split(' ').map((word, i) => (
        <span
          key={`${word}-${i}`}
          className="reveal-word"
          aria-hidden="true"
          style={{ animationDelay: `${delay + i * 90}ms` }}
        >
          {word}&nbsp;
        </span>
      ))}
    </span>
  );
}

function Icon({ path }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={path} />
    </svg>
  );
}

function TiltCard({ children, className = '' }) {
  const ref = useRef(null);
  const reduced = usePrefersReducedMotion();

  const onMove = (e) => {
    if (reduced) return;
    const el = ref.current;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    el.style.setProperty('--rx', `${(0.5 - py) * 10}deg`);
    el.style.setProperty('--ry', `${(px - 0.5) * 12}deg`);
    el.style.setProperty('--gx', `${px * 100}%`);
    el.style.setProperty('--gy', `${py * 100}%`);
  };
  const onLeave = () => {
    const el = ref.current;
    el.style.setProperty('--rx', '0deg');
    el.style.setProperty('--ry', '0deg');
  };

  return (
    <div ref={ref} className={`tilt ${className}`} onPointerMove={onMove} onPointerLeave={onLeave}>
      {children}
    </div>
  );
}

function CountUp({ end, suffix = '', decimals = 0, duration = 1800 }) {
  const [ref, inView] = useInView();
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!inView) return undefined;
    let raf;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - (1 - t) ** 4; // easeOutQuart
      setValue(end * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, end, duration]);

  return (
    <span ref={ref}>
      {value.toFixed(decimals)}
      {suffix}
    </span>
  );
}

/* ------------------------------------------------------- pipeline section */

function Pipeline({ stages, step, running, onReplay }) {
  const progress = Math.max(0, Math.min(step / (stages.length - 1), 1)) * 100;

  return (
    <section className="panel pipeline-panel" aria-labelledby="pipeline-title">
      <header className="panel-head">
        <div>
          <p className="eyebrow">Delivery flow</p>
          <h2 id="pipeline-title">From commit to cluster</h2>
        </div>
        <button className="btn btn-ghost" type="button" onClick={onReplay} disabled={running}>
          <span className={`btn-spinner ${running ? 'spin' : ''}`} aria-hidden="true" />
          {running ? 'Syncing…' : 'Replay deploy'}
        </button>
      </header>

      <div className="pipeline" style={{ '--progress': `${progress}%` }}>
        <div className="track" aria-hidden="true">
          <div className="track-fill" />
          {running && <div className="track-comet" />}
        </div>

        <ol className="stages">
          {stages.map((stage, i) => {
            const state = i < step ? 'done' : i === step ? (running ? 'active' : 'done') : 'idle';
            return (
              <li key={stage.id} className={`stage ${state}`} style={{ '--i': i }}>
                <div className="stage-node">
                  <span className="ring" aria-hidden="true" />
                  <Icon path={STAGE_ICONS[stage.id] || STAGE_ICONS.run} />
                </div>
                <div className="stage-text">
                  <strong>{stage.name}</strong>
                  <span className="tool">{stage.tool}</span>
                  <span className="detail">{stage.detail}</span>
                </div>
                <span className="sr-only">{state}</span>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

function Terminal({ lines }) {
  const bodyRef = useRef(null);
  useEffect(() => {
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines]);

  return (
    <div className="terminal" role="log" aria-live="polite" aria-label="Deployment log">
      <div className="terminal-bar" aria-hidden="true">
        <span /> <span /> <span />
        <em>argocd · app/frontend</em>
      </div>
      <div className="terminal-body" ref={bodyRef}>
        {lines.map((line, i) => (
          <div key={i} className={`log-line ${line.startsWith('✓') ? 'ok' : ''}`}>
            {line}
          </div>
        ))}
        <span className="caret" aria-hidden="true" />
      </div>
    </div>
  );
}

/* --------------------------------------------------------- live backend */

function LiveStatus() {
  const [info, setInfo] = useState(null);
  const [error, setError] = useState(false);
  const [pulse, setPulse] = useState(0);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch('/api/info', { cache: 'no-store' });
        if (!res.ok) throw new Error(res.statusText);
        const data = await res.json();
        if (alive) {
          setInfo(data);
          setError(false);
          setPulse((p) => p + 1);
        }
      } catch {
        if (alive) setError(true);
      }
    };
    load();
    const id = setInterval(load, 5000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const status = error ? 'down' : info ? 'up' : 'pending';

  return (
    <TiltCard className="panel live">
      <header className="panel-head">
        <div>
          <p className="eyebrow">Live backend</p>
          <h2>Service status</h2>
        </div>
        <span className={`status-pill ${status}`}>
          <span className="dot" key={pulse} />
          {status === 'up' ? 'Healthy' : status === 'down' ? 'Unreachable' : 'Connecting'}
        </span>
      </header>

      <dl className="kv">
        <div>
          <dt>Pod</dt>
          <dd className="mono flash" key={`h-${info?.hostname}`}>{info?.hostname ?? '—'}</dd>
        </div>
        <div>
          <dt>Environment</dt>
          <dd>{info?.environment ?? '—'}</dd>
        </div>
        <div>
          <dt>API version</dt>
          <dd className="mono">{info?.version ?? '—'}</dd>
        </div>
        <div>
          <dt>UI version</dt>
          <dd className="mono">{APP_VERSION}</dd>
        </div>
        <div>
          <dt>Uptime</dt>
          <dd className="mono">{info ? formatUptime(info.uptimeSeconds) : '—'}</dd>
        </div>
        <div>
          <dt>Runtime</dt>
          <dd className="mono">{info?.node ?? '—'}</dd>
        </div>
      </dl>
      {error && <p className="hint">Start the backend on port 3000, or check the /api proxy.</p>}
    </TiltCard>
  );
}

function formatUptime(s) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h ? `${h}h ${m}m` : m ? `${m}m ${sec}s` : `${sec}s`;
}

/* ------------------------------------------------------------------ app */

function App() {
  const [stages, setStages] = useState(FALLBACK_STAGES);
  const [step, setStep] = useState(-1);
  const [running, setRunning] = useState(false);
  const [lines, setLines] = useState(['$ waiting for changes…']);
  const timers = useRef([]);

  useEffect(() => {
    fetch('/api/pipeline')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => Array.isArray(d.stages) && d.stages.length && setStages(d.stages))
      .catch(() => {});
  }, []);

  const runDeploy = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setRunning(true);
    setStep(0);
    setLines([]);

    stages.forEach((stage, i) => {
      const log = LOG_LINES[stage.id] || [`✓ ${stage.name}`];
      log.forEach((line, j) => {
        timers.current.push(
          setTimeout(() => setLines((prev) => [...prev, line]), i * STEP_MS + j * (STEP_MS / (log.length + 1))),
        );
      });
      if (i > 0) timers.current.push(setTimeout(() => setStep(i), i * STEP_MS));
    });
    timers.current.push(setTimeout(() => setRunning(false), stages.length * STEP_MS));
  }, [stages]);

  // Auto-play once on load
  useEffect(() => {
    const id = setTimeout(runDeploy, 900);
    return () => {
      clearTimeout(id);
      timers.current.forEach(clearTimeout);
    };
  }, [runDeploy]);

  return (
    <>
      <div className="aurora" aria-hidden="true">
        <span className="blob b1" />
        <span className="blob b2" />
        <span className="blob b3" />
      </div>
      <ParticleField />
      <div className="grain" aria-hidden="true" />

      <nav className="nav">
        <span className="brand">
          <span className="brand-mark" aria-hidden="true" />
          GitOps<span className="muted">/delivery</span>
        </span>
        <span className="nav-version mono">v{APP_VERSION}</span>
      </nav>

      <main className="container">
        <section className="hero">
          <p className="eyebrow fade-in">GitHub Actions · Terraform · Argo CD · EKS</p>
          <h1>
            <RevealText text="Ship to Kubernetes" />
            <br />
            <RevealText text="by merging a commit." className="gradient-text" delay={360} />
          </h1>
          <p className="lead fade-in" style={{ animationDelay: '900ms' }}>
            Git is the source of truth. Every change is versioned, reviewed, and reconciled into the
            cluster automatically, with no manual kubectl.
          </p>
        </section>

        <Pipeline stages={stages} step={step} running={running} onReplay={runDeploy} />

        <div className="grid-2">
          <LiveStatus />
          <div className="panel term-panel">
            <header className="panel-head">
              <div>
                <p className="eyebrow">Sync log</p>
                <h2>What just happened</h2>
              </div>
            </header>
            <Terminal lines={lines} />
          </div>
        </div>

        <section className="stats" aria-label="Delivery metrics">
          {[
            { label: 'Deploys per day', end: 24, suffix: '' },
            { label: 'Lead time', end: 6.5, suffix: ' min', decimals: 1 },
            { label: 'Change failure rate', end: 1.8, suffix: '%', decimals: 1 },
            { label: 'Restore time', end: 3, suffix: ' min' },
          ].map((s, i) => (
            <TiltCard key={s.label} className="stat" >
              <span className="stat-value" style={{ animationDelay: `${i * 120}ms` }}>
                <CountUp end={s.end} suffix={s.suffix} decimals={s.decimals} />
              </span>
              <span className="stat-label">{s.label}</span>
            </TiltCard>
          ))}
        </section>
      </main>

      <footer className="footer">
        <span className="muted">Demo metrics are illustrative. Pod and version data are live from the API.</span>
      </footer>
    </>
  );
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// Gráficos sobreimpresionados. Se dibujan siempre en un lienzo de 1920×1080 y se escalan
// al tamaño disponible, así se ven igual en el móvil (720p/1080p), en OBS o en la vista previa.
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import type { Banner, LiveState, MatchEvent, Side, TeamInfo } from '../types';
import { PERIOD_LABEL, PERIOD_SHORT, formatClock, isPlaying, matchSeconds } from '../lib/clock';
import { penaltyScore, redCards, scorers } from '../lib/actions';
import './overlay.css';

const W = 1920;
const H = 1080;

export function ScaledStage({ children, className }: { children: React.ReactNode; className?: string }) {
  const outer = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const el = outer.current;
    if (!el) return;
    const update = () => setScale(Math.min(el.clientWidth / W, el.clientHeight / H) || 1);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={outer} className={`ov-outer ${className ?? ''}`}>
      <div className="ov-stage" style={{ transform: `translate(-50%, -50%) scale(${scale})` }}>
        {children}
      </div>
    </div>
  );
}

const teamVars = (t: TeamInfo): CSSProperties =>
  ({ '--team': t.primaryColor || '#334', '--team2': t.secondaryColor || '#fff' }) as CSSProperties;

function Crest({ team, size }: { team: TeamInfo; size: number }) {
  if (team.crestUrl) return <img className="ov-crest" src={team.crestUrl} alt="" style={{ width: size, height: size }} />;
  return (
    <div className="ov-crest ov-crest-fallback" style={{ width: size, height: size, fontSize: size * 0.38, ...teamVars(team) }}>
      {team.shortName.slice(0, 3)}
    </div>
  );
}

// ---------- Marcador ----------

function Scorebug({ s, now }: { s: LiveState; now: number }) {
  const secs = matchSeconds(s, now);
  const playing = isPlaying(s.period);
  const side = (k: Side) => {
    const t = s[k];
    const reds = redCards(s, k);
    return (
      <div className={`sb-team sb-${k}`} style={teamVars(t)}>
        <span className="sb-stripe" />
        <Crest team={t} size={46} />
        <span className="sb-name">{t.shortName}</span>
        {reds > 0 && (
          <span className="sb-reds">
            {Array.from({ length: reds }, (_, i) => (
              <i key={i} />
            ))}
          </span>
        )}
      </div>
    );
  };
  const showPens = s.period === 'PEN' || (s.period === 'FT' && (s.penalties.home.length > 0 || s.penalties.away.length > 0));
  return (
    <div className="sb">
      <div className="sb-main">
        {side('home')}
        <div className="sb-score">
          <span>{s.score.home}</span>
          <span className="sb-dash" />
          <span>{s.score.away}</span>
        </div>
        {side('away')}
        <div className={`sb-clock ${playing && !s.clock.running ? 'paused' : ''}`}>
          {secs != null ? formatClock(secs) : PERIOD_SHORT[s.period]}
        </div>
        {playing && s.clock.addedMinutes > 0 && <div className="sb-added">+{s.clock.addedMinutes}</div>}
      </div>
      <div className="sb-sub">
        {playing && <span className="sb-period">{PERIOD_SHORT[s.period]}</span>}
        {showPens && (
          <span className="sb-pens">
            Penaltis {penaltyScore(s, 'home')}-{penaltyScore(s, 'away')}
          </span>
        )}
      </div>
    </div>
  );
}

// ---------- Rótulo de evento ----------

/**
 * Decide si se ve el rótulo. Si llega un rótulo nuevo mientras el overlay está abierto, se cuenta
 * su duración con el reloj local (inmune a relojes desajustados entre dispositivos). Si ya estaba
 * al abrir el overlay, se usa la hora de publicación.
 */
function useBannerVisible(banner: Banner | null, now: number): boolean {
  const initialId = useRef<string | null | undefined>(undefined);
  const localStart = useRef(new Map<string, number>());
  if (initialId.current === undefined) initialId.current = banner?.id ?? null;
  if (!banner) return false;
  const dur = banner.durationSec * 1000;
  if (banner.id === initialId.current) return now - banner.shownAt < dur;
  let start = localStart.current.get(banner.id);
  if (start == null) {
    start = Date.now();
    localStart.current.set(banner.id, start);
  }
  return now - start < dur;
}

function eventTexts(ev: MatchEvent, s: LiveState): { kicker: string; title: string; sub: string; team: TeamInfo } {
  const playerTeamSide: Side = ev.type === 'goal' && ev.ownGoal ? (ev.side === 'home' ? 'away' : 'home') : ev.side;
  const team = s[ev.side];
  const pTeam = s[playerTeamSide];
  const who = (n?: string, num?: number | null) => [num != null ? num : null, n].filter((x) => x != null && x !== '').join(' · ');
  switch (ev.type) {
    case 'goal':
      return {
        kicker: ev.ownGoal ? 'Gol en propia puerta' : ev.penalty ? 'Gol de penalti' : '¡Gol!',
        title: who(ev.playerName, ev.playerNumber) || team.name,
        sub: `${ev.ownGoal ? pTeam.name : team.name}  ·  ${s.home.shortName} ${s.score.home}-${s.score.away} ${s.away.shortName}`,
        team,
      };
    case 'yellow':
      return { kicker: 'Tarjeta amarilla', title: who(ev.playerName, ev.playerNumber) || team.name, sub: team.name, team };
    case 'second_yellow':
      return { kicker: 'Segunda amarilla · Expulsión', title: who(ev.playerName, ev.playerNumber) || team.name, sub: team.name, team };
    case 'red':
      return { kicker: 'Tarjeta roja', title: who(ev.playerName, ev.playerNumber) || team.name, sub: team.name, team };
    case 'sub':
      return {
        kicker: `Cambio · ${team.name}`,
        title: who(ev.inName, ev.inNumber) || 'Entra',
        sub: who(ev.playerName, ev.playerNumber) || 'Sale',
        team,
      };
  }
}

function EventBanner({ s, now, raised }: { s: LiveState; now: number; raised: boolean }) {
  // Con una pantalla completa (previa, descanso, final) no se muestran rótulos de evento.
  const visible = useBannerVisible(s.banner, now) && s.scene === 'none';
  const last = useRef<Banner | null>(null);
  if (s.banner) last.current = s.banner;
  const b = last.current;
  if (!b) return null;

  let content: React.ReactNode;
  let style: CSSProperties = {};
  let kind = 'text';
  if (b.kind === 'event' && b.event) {
    const ev = b.event;
    const t = eventTexts(ev, s);
    style = teamVars(t.team);
    kind = ev.type;
    const icon =
      ev.type === 'goal' ? (
        <div className="bn-icon bn-ball">⚽</div>
      ) : ev.type === 'sub' ? (
        <div className="bn-icon bn-subicon">⇄</div>
      ) : (
        <div className={`bn-icon bn-card ${ev.type === 'yellow' ? 'yellow' : ev.type === 'second_yellow' ? 'second' : 'red'}`}>
          <i />
          {ev.type === 'second_yellow' && <i />}
        </div>
      );
    content = (
      <>
        <div className="bn-team">
          <Crest team={t.team} size={92} />
        </div>
        {icon}
        <div className="bn-text">
          <div className="bn-kicker">{t.kicker}</div>
          <div className="bn-title">
            {ev.type === 'sub' && <span className="bn-arrow in">▲</span>}
            {t.title}
          </div>
          <div className="bn-sub">
            {ev.type === 'sub' && <span className="bn-arrow out">▼</span>}
            {t.sub}
          </div>
        </div>
        <div className="bn-minute">{ev.minute}</div>
      </>
    );
  } else {
    content = (
      <div className="bn-text bn-text-only">
        <div className="bn-title">{b.title}</div>
        {b.subtitle && <div className="bn-sub">{b.subtitle}</div>}
      </div>
    );
  }
  return (
    <div className={`bn bn-${kind} ${visible ? 'show' : ''} ${raised ? 'raised' : ''}`} style={style}>
      {content}
    </div>
  );
}

// ---------- Rótulo inferior ----------

function LowerThird({ s }: { s: LiveState }) {
  const lt = s.lowerThird;
  const last = useRef(lt);
  if (lt.visible) last.current = lt;
  return (
    <div className={`lt ${lt.visible && (lt.title || lt.subtitle) ? 'show' : ''}`}>
      <div className="lt-title">{last.current.title}</div>
      {last.current.subtitle && <div className="lt-sub">{last.current.subtitle}</div>}
    </div>
  );
}

// ---------- Patrocinadores ----------

function SponsorBox({ s, now }: { s: LiveState; now: number }) {
  const list = s.sponsors.filter((x) => x.logoUrl);
  const show = s.sponsorsVisible && list.length > 0 && s.scene === 'none';
  const idx = list.length ? Math.floor(now / (s.sponsorRotateSec * 1000)) % list.length : 0;
  return (
    <div className={`sp ${show ? 'show' : ''}`}>
      {list.map((sp, i) => (
        <img key={sp.id} src={sp.logoUrl} alt={sp.name} className={i === idx ? 'active' : ''} />
      ))}
    </div>
  );
}

// ---------- Penaltis ----------

function PenaltyPanel({ s }: { s: LiveState }) {
  const rounds = Math.max(5, s.penalties.home.length, s.penalties.away.length);
  const row = (k: Side) => (
    <div className="pn-row" style={teamVars(s[k])}>
      <Crest team={s[k]} size={44} />
      <span className="pn-name">{s[k].shortName}</span>
      <span className="pn-dots">
        {Array.from({ length: rounds }, (_, i) => {
          const r = s.penalties[k][i];
          return <i key={i} className={r ?? ''} />;
        })}
      </span>
      <span className="pn-score">{penaltyScore(s, k)}</span>
    </div>
  );
  return (
    <div className={`pn ${s.period === 'PEN' && s.scene === 'none' ? 'show' : ''}`}>
      <div className="pn-head">Tanda de penaltis</div>
      {row('home')}
      {row('away')}
    </div>
  );
}

// ---------- Escenas a pantalla completa ----------

function SceneCard({ s }: { s: LiveState }) {
  const scene = s.scene;
  const last = useRef(scene);
  if (scene !== 'none') last.current = scene;
  const shown = last.current;
  const headline = shown === 'pre' ? 'Empezamos en breve' : shown === 'halftime' ? 'Descanso' : 'Final del partido';
  const showScore = shown !== 'pre';
  const hasPens = s.penalties.home.length + s.penalties.away.length > 0;
  const meta = [s.competition, s.round].filter(Boolean).join(' · ');
  return (
    <div className={`sc ${scene !== 'none' ? 'show' : ''} sc-${shown}`}>
      <div className="sc-card">
        {meta && <div className="sc-meta">{meta}</div>}
        <div className="sc-teams">
          {(['home', 'away'] as Side[]).map((k, i) => (
            <div key={k} className={`sc-team ${i === 0 ? 'left' : 'right'}`} style={teamVars(s[k])}>
              <Crest team={s[k]} size={200} />
              <div className="sc-name">{s[k].name}</div>
              {showScore && (
                <ul className="sc-scorers">
                  {scorers(s, k).map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
          <div className="sc-center">
            {showScore ? (
              <>
                <div className="sc-score">
                  {s.score.home}
                  <span>-</span>
                  {s.score.away}
                </div>
                {hasPens && (
                  <div className="sc-pens">
                    Penaltis {penaltyScore(s, 'home')}-{penaltyScore(s, 'away')}
                  </div>
                )}
              </>
            ) : (
              <div className="sc-vs">VS</div>
            )}
          </div>
        </div>
        <div className="sc-headline">{headline}</div>
        {s.venue && <div className="sc-venue">{s.venue}</div>}
        {s.sponsors.length > 0 && (
          <div className="sc-sponsors">
            {s.sponsors
              .filter((x) => x.logoUrl)
              .map((x) => (
                <img key={x.id} src={x.logoUrl} alt={x.name} />
              ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function OverlayView({ state, now }: { state: LiveState; now: number }) {
  const s = state;
  return (
    <div className="ov">
      <div className={`ov-layer ${s.showScorebug && s.scene === 'none' ? 'show' : ''}`}>
        <Scorebug s={s} now={now} />
      </div>
      <SponsorBox s={s} now={now} />
      <PenaltyPanel s={s} />
      <LowerThird s={s} />
      <EventBanner s={s} now={now} raised={s.lowerThird.visible || (s.period === 'PEN' && s.scene === 'none')} />
      <SceneCard s={s} />
    </div>
  );
}

/** Título legible para la pestaña / depuración. */
export function liveTitle(s: LiveState) {
  return `${s.home.shortName} ${s.score.home}-${s.score.away} ${s.away.shortName} · ${PERIOD_LABEL[s.period]}`;
}

/** Fuerza fondo transparente en la página del overlay. */
export function useTransparentPage(bg: string | null) {
  useEffect(() => {
    const color =
      bg === 'green' ? '#00b140' : bg === 'dark' ? '#111' : bg === 'field' ? '#2f6b2f' : 'transparent';
    const prev = [document.documentElement.style.background, document.body.style.background];
    document.documentElement.style.background = color;
    document.body.style.background = color;
    document.body.classList.add('overlay-page');
    return () => {
      document.documentElement.style.background = prev[0];
      document.body.style.background = prev[1];
      document.body.classList.remove('overlay-page');
    };
  }, [bg]);
}

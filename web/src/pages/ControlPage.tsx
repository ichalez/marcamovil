// Panel del operador durante el partido. Pensado para usarse desde un móvil o una tablet.
import { useState, type CSSProperties } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useLive, DEMO_ID } from '../hooks/useLive';
import { createDemoState } from '../lib/demo';
import { useNow } from '../hooks/useNow';
import { OverlayView, ScaledStage } from '../overlay/OverlayView';
import {
  NEXT_PERIOD_ACTION,
  PERIOD_LABEL,
  formatClock,
  isPlaying,
  matchSeconds,
  nextPeriods,
  periodBounds,
} from '../lib/clock';
import * as A from '../lib/actions';
import { refreshLiveFromClub } from '../lib/db';
import { CopyButton, ErrorBox, Modal, Spinner, translateError } from '../components/ui';
import type { LiveState, MatchEvent, Period, Player, Side, TeamInfo } from '../types';

const other = (s: Side): Side => (s === 'home' ? 'away' : 'home');
const teamStyle = (t: TeamInfo) => ({ '--team': t.primaryColor }) as CSSProperties;

type Dialog =
  | { kind: 'goal'; side: Side }
  | { kind: 'card'; side: Side; color: 'yellow' | 'red' }
  | { kind: 'sub'; side: Side }
  | null;

export default function ControlPage({ demo }: { demo?: boolean }) {
  const params = useParams();
  const matchId = demo ? DEMO_ID : params.matchId!;
  const store = useLive(matchId);
  const now = useNow(250);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  if (store.loading) return <Spinner full />;
  if (!store.state)
    return (
      <div className="page">
        <ErrorBox error={store.error ?? 'Partido no encontrado.'} />
        <Link className="btn" to="/">
          Volver
        </Link>
      </div>
    );

  const s = store.state;
  const run = (a: A.Action) => {
    setActionError(null);
    store.apply(a).catch((e) => setActionError(translateError(e)));
  };

  return (
    <>
      <div className="topbar">
        <Link to={demo ? '/' : `/c/${s.clubId}/partidos/${matchId}`} className="btn ghost icon" aria-label="Volver">
          ←
        </Link>
        <div className="grow" style={{ minWidth: 0 }}>
          <b style={{ whiteSpace: 'nowrap' }}>
            {s.home.shortName} {s.score.home}-{s.score.away} {s.away.shortName}
          </b>
          <div className="muted small">
            <span className={`status-dot ${store.error ? 'err' : store.pending ? 'pending' : ''}`} />
            {demo ? 'Modo demo (solo este navegador)' : store.error ? 'Error de conexión' : store.pending ? 'Enviando…' : 'Sincronizado'}
          </div>
        </div>
        <button className="btn" disabled={s.events.length === 0} onClick={() => run(A.undoLastEvent)} title="Deshacer el último evento">
          ↶ Deshacer
        </button>
      </div>

      <div className="control">
        <div className="stack">
          <ErrorBox error={actionError} />
          <TeamsControl s={s} run={run} open={setDialog} />
          <ClockControl s={s} now={now} run={run} />
          {(s.period === 'PEN' || s.penalties.home.length + s.penalties.away.length > 0) && <PenaltiesControl s={s} run={run} />}
          <EventsControl s={s} run={run} />
        </div>
        <div className="stack control-side">
          <div className="preview">
            <ScaledStage>
              <OverlayView state={s} now={now} />
            </ScaledStage>
          </div>
          <GraphicsControl s={s} run={run} />
          <StreamCard s={s} matchId={matchId} demo={!!demo} run={run} />
        </div>
      </div>

      {dialog?.kind === 'goal' && <GoalDialog s={s} side={dialog.side} onClose={() => setDialog(null)} run={run} />}
      {dialog?.kind === 'card' && (
        <PlayerDialog
          title={`${dialog.color === 'yellow' ? 'Tarjeta amarilla' : 'Tarjeta roja'} · ${s[dialog.side].name}`}
          team={s[dialog.side]}
          onClose={() => setDialog(null)}
          onPick={(p, banner) => run(A.addCard(dialog.side, dialog.color, p, banner))}
        />
      )}
      {dialog?.kind === 'sub' && <SubDialog team={s[dialog.side]} onClose={() => setDialog(null)} onPick={(o, i, b) => run(A.addSub(dialog.side, o, i, b))} />}
    </>
  );
}

// ---------- Equipos y marcador ----------

function TeamsControl({ s, run, open }: { s: LiveState; run: (a: A.Action) => void; open: (d: Dialog) => void }) {
  return (
    <div className="teams-ctl">
      {(['home', 'away'] as Side[]).map((side) => {
        const t = s[side];
        return (
          <div key={side} className="team-ctl" style={teamStyle(t)}>
            <div className="team-ctl-head">
              {t.crestUrl && <img className="crest-sm" src={t.crestUrl} alt="" />}
              <b>{t.name}</b>
            </div>
            <div className="score-big">
              <button className="btn icon" onClick={() => run(A.changeScore(side, -1))} aria-label="Restar gol sin evento">
                −
              </button>
              <span className="num">{s.score[side]}</span>
              <button className="btn icon" onClick={() => run(A.changeScore(side, 1))} aria-label="Sumar gol sin evento">
                +
              </button>
            </div>
            <div className="ev-btns">
              <button className="btn accent big goal" onClick={() => open({ kind: 'goal', side })}>
                ⚽ Gol
              </button>
              <button className="btn" onClick={() => open({ kind: 'card', side, color: 'yellow' })}>
                <span className="card-y" /> Amarilla
              </button>
              <button className="btn" onClick={() => open({ kind: 'card', side, color: 'red' })}>
                <span className="card-r" /> Roja
              </button>
              <button className="btn" style={{ gridColumn: '1 / -1' }} onClick={() => open({ kind: 'sub', side })}>
                ⇄ Cambio
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------- Reloj ----------

function ClockControl({ s, now, run }: { s: LiveState; now: number; run: (a: A.Action) => void }) {
  const secs = matchSeconds(s, now);
  const playing = isPlaying(s.period);
  const [manual, setManual] = useState('');
  const nexts = nextPeriods(s.period);

  const applyManual = () => {
    const m = manual.match(/^(\d{1,3})(?::(\d{1,2}))?$/);
    const b = periodBounds(s.period, s.rules);
    if (!m || !b) return;
    const total = Number(m[1]) * 60 + Number(m[2] ?? 0);
    run(A.setClockInPeriod(Math.max(0, total - b.startMin * 60)));
    setManual('');
  };

  return (
    <div className="card stack">
      <div className="row between">
        <div>
          <div className="muted small">{PERIOD_LABEL[s.period]}</div>
          <div className={`clock-big ${playing && !s.clock.running ? 'paused' : ''}`}>{secs != null ? formatClock(secs) : '--:--'}</div>
        </div>
        {playing && (
          <button className={`btn big ${s.clock.running ? '' : 'ok'}`} onClick={() => run(s.clock.running ? A.pauseClock : A.startClock)}>
            {s.clock.running ? '❚❚ Pausar' : '▶ Reanudar'}
          </button>
        )}
      </div>

      <div className="row">
        {nexts.map((p, i) => (
          <button
            key={p}
            className={`btn ${i === 0 ? 'primary' : ''}`}
            onClick={() => {
              if (p === 'FT' && !confirm('¿Finalizar el partido?')) return;
              // Cambio de fase y escena en una sola escritura.
              const scene = p === 'HT' || p === 'ET_HT' ? 'halftime' : p === 'FT' ? 'fulltime' : null;
              run((st, n) => {
                const next = A.setPeriod(p)(st, n);
                return scene ? A.setScene(scene)(next, n) : next;
              });
            }}
          >
            {NEXT_PERIOD_ACTION[p]}
          </button>
        ))}
      </div>

      {playing && (
        <>
          <div className="row">
            <span className="muted small">Ajustar:</span>
            <button className="btn" onClick={() => run(A.adjustClock(-60000))}>
              −1′
            </button>
            <button className="btn" onClick={() => run(A.adjustClock(-10000))}>
              −10″
            </button>
            <button className="btn" onClick={() => run(A.adjustClock(10000))}>
              +10″
            </button>
            <button className="btn" onClick={() => run(A.adjustClock(60000))}>
              +1′
            </button>
          </div>
          <div className="row">
            <span className="muted small">Descuento:</span>
            <button className="btn icon" onClick={() => run(A.setAddedMinutes(s.clock.addedMinutes - 1))}>
              −
            </button>
            <b style={{ minWidth: 34, textAlign: 'center' }}>+{s.clock.addedMinutes}</b>
            <button className="btn icon" onClick={() => run(A.setAddedMinutes(s.clock.addedMinutes + 1))}>
              +
            </button>
            <span className="grow" />
            <input
              type="text"
              inputMode="numeric"
              placeholder="mm:ss"
              value={manual}
              style={{ width: 90 }}
              onChange={(e) => setManual(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && applyManual()}
            />
            <button className="btn" disabled={!manual} onClick={applyManual}>
              Fijar
            </button>
          </div>
        </>
      )}

      <details>
        <summary className="muted small" style={{ cursor: 'pointer' }}>
          Cambiar fase manualmente
        </summary>
        <div className="row" style={{ marginTop: 8 }}>
          <select value={s.period} style={{ width: 'auto' }} onChange={(e) => run(A.setPeriod(e.target.value as Period))}>
            {(Object.keys(PERIOD_LABEL) as Period[]).map((p) => (
              <option key={p} value={p}>
                {PERIOD_LABEL[p]}
              </option>
            ))}
          </select>
          <span className="muted small">Reinicia el reloj de esa fase.</span>
        </div>
      </details>
    </div>
  );
}

// ---------- Penaltis ----------

function PenaltiesControl({ s, run }: { s: LiveState; run: (a: A.Action) => void }) {
  return (
    <div className="card stack">
      <h2 style={{ margin: 0 }}>
        Penaltis {A.penaltyScore(s, 'home')} - {A.penaltyScore(s, 'away')}
      </h2>
      {(['home', 'away'] as Side[]).map((side) => (
        <div key={side} className="row" style={teamStyle(s[side])}>
          <b style={{ width: 54 }}>{s[side].shortName}</b>
          <span className="pen-dots grow">
            {s.penalties[side].map((r, i) => (
              <i key={i} className={r} />
            ))}
          </span>
          <button className="btn ok" onClick={() => run(A.addPenalty(side, 'scored'))}>
            ✓ Gol
          </button>
          <button className="btn danger" onClick={() => run(A.addPenalty(side, 'missed'))}>
            ✕ Fallo
          </button>
          <button className="btn ghost icon" disabled={!s.penalties[side].length} onClick={() => run(A.undoPenalty(side))} aria-label="Deshacer penalti">
            ↶
          </button>
        </div>
      ))}
    </div>
  );
}

// ---------- Eventos ----------

function eventLabel(e: MatchEvent, s: LiveState) {
  const who = (n?: string, num?: number | null) => [num != null ? `${num}` : '', n ?? ''].filter(Boolean).join(' ') || '—';
  switch (e.type) {
    case 'goal':
      return `⚽ ${who(e.playerName, e.playerNumber)}${e.ownGoal ? ' (p.p.)' : e.penalty ? ' (pen.)' : ''}`;
    case 'yellow':
      return `🟨 ${who(e.playerName, e.playerNumber)}`;
    case 'second_yellow':
      return `🟨🟥 ${who(e.playerName, e.playerNumber)}`;
    case 'red':
      return `🟥 ${who(e.playerName, e.playerNumber)}`;
    case 'sub':
      return `⇄ ▲${who(e.inName, e.inNumber)} ▼${who(e.playerName, e.playerNumber)}`;
  }
  return s.home.name;
}

function EventsControl({ s, run }: { s: LiveState; run: (a: A.Action) => void }) {
  const list = [...s.events].reverse();
  return (
    <div className="card">
      <div className="section-title">
        <h2>Eventos</h2>
      </div>
      {list.length === 0 ? (
        <div className="muted small">Aún no hay eventos.</div>
      ) : (
        <div className="events-list">
          {list.map((e) => (
            <div key={e.id} className="event-row" style={teamStyle(s[e.side])}>
              <span className="min">{e.minute}</span>
              <span className="grow">{eventLabel(e, s)}</span>
              <button className="btn ghost small" onClick={() => run(A.replayBanner(e.id))} title="Volver a mostrar el rótulo">
                Rótulo
              </button>
              <button
                className="btn ghost icon"
                onClick={() => confirm('¿Borrar este evento?') && run(A.removeEvent(e.id))}
                aria-label="Borrar evento"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- Gráficos ----------

function GraphicsControl({ s, run }: { s: LiveState; run: (a: A.Action) => void }) {
  const [lt, setLt] = useState({ title: s.lowerThird.title, subtitle: s.lowerThird.subtitle });
  const [bn, setBn] = useState({ title: '', subtitle: '' });
  const scenes: [LiveState['scene'], string][] = [
    ['none', 'En juego'],
    ['pre', 'Previa'],
    ['halftime', 'Descanso'],
    ['fulltime', 'Final'],
  ];
  return (
    <div className="card stack">
      <h2 style={{ margin: 0 }}>Gráficos</h2>
      <div className="field">
        <span className="label">Pantalla</span>
        <div className="row">
          {scenes.map(([k, label]) => (
            <button key={k} className={`btn ${s.scene === k ? 'sel' : ''}`} onClick={() => run(A.setScene(k))}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="row">
        <label className="check">
          <input type="checkbox" checked={s.showScorebug} onChange={(e) => run(A.setShowScorebug(e.target.checked))} />
          Marcador
        </label>
        <label className="check">
          <input type="checkbox" checked={s.sponsorsVisible} onChange={(e) => run(A.setSponsorsVisible(e.target.checked))} />
          Patrocinadores
        </label>
        <label className="check small muted">
          cada
          <input
            type="number"
            min={3}
            max={120}
            value={s.sponsorRotateSec}
            style={{ width: 70 }}
            onChange={(e) => run(A.setSponsorRotate(Number(e.target.value) || 10))}
          />
          s
        </label>
      </div>

      <div className="field">
        <span className="label">Rótulo inferior (fijo hasta que lo ocultes)</span>
        <input type="text" placeholder="Título (p. ej. ¡Bienvenidos!)" value={lt.title} onChange={(e) => setLt({ ...lt, title: e.target.value })} />
        <input type="text" placeholder="Subtítulo" value={lt.subtitle} onChange={(e) => setLt({ ...lt, subtitle: e.target.value })} />
        <div className="row">
          <button className="btn primary" disabled={!lt.title && !lt.subtitle} onClick={() => run(A.setLowerThird({ ...lt, visible: true }))}>
            {s.lowerThird.visible ? 'Actualizar' : 'Mostrar'}
          </button>
          <button className="btn" disabled={!s.lowerThird.visible} onClick={() => run(A.setLowerThird({ visible: false }))}>
            Ocultar
          </button>
        </div>
      </div>

      <div className="field">
        <span className="label">Rótulo rápido (desaparece solo)</span>
        <input type="text" placeholder="Título" value={bn.title} onChange={(e) => setBn({ ...bn, title: e.target.value })} />
        <input type="text" placeholder="Subtítulo (opcional)" value={bn.subtitle} onChange={(e) => setBn({ ...bn, subtitle: e.target.value })} />
        <div className="row">
          <button className="btn primary" disabled={!bn.title} onClick={() => run(A.showTextBanner(bn.title, bn.subtitle))}>
            Lanzar
          </button>
          <button className="btn" onClick={() => run(A.hideBanner)}>
            Quitar rótulo
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- Emisión ----------

function StreamCard({
  s,
  matchId,
  demo,
  run,
}: {
  s: LiveState;
  matchId: string;
  demo: boolean;
  run: (a: A.Action) => void;
}) {
  const url = `${window.location.origin}/overlay/${matchId}`;
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="card stack">
      <h2 style={{ margin: 0 }}>Overlay</h2>
      <div className="row" style={{ flexWrap: 'nowrap' }}>
        <div className="url-box grow">{url}</div>
        <CopyButton text={url} />
      </div>
      <div className="row">
        <a className="btn" href={`${url}?bg=field`} target="_blank" rel="noreferrer">
          Abrir en pestaña
        </a>
        {!demo && (
          <button
            className="btn"
            onClick={async () => {
              setMsg(null);
              try {
                await refreshLiveFromClub(s.clubId, matchId);
                setMsg('Equipos y patrocinadores actualizados.');
              } catch (e) {
                setMsg(translateError(e));
              }
            }}
          >
            Actualizar desde el club
          </button>
        )}
        <button
          className="btn danger"
          onClick={() => {
            if (!confirm('¿Reiniciar el partido? Se borran marcador, eventos y reloj.')) return;
            run(demo ? () => createDemoState() : A.resetMatch);
          }}
        >
          Reiniciar partido
        </button>
      </div>
      {msg && <div className="info-box small">{msg}</div>}
      {demo && (
        <p className="muted small" style={{ margin: 0 }}>
          En modo demo el overlay solo se actualiza en otras pestañas de este mismo navegador. Con Firebase configurado se
          sincroniza con cualquier dispositivo (móvil emisor, OBS…).
        </p>
      )}
    </div>
  );
}

// ---------- Diálogos ----------

function PlayerGrid({ players, selected, onPick }: { players: Player[]; selected?: string | null; onPick: (p: Player) => void }) {
  if (players.length === 0) return <div className="muted small">Este equipo no tiene plantilla. Escribe el nombre abajo.</div>;
  return (
    <div className="player-grid">
      {players.map((p) => (
        <button key={p.id} className={`btn ${selected === p.id ? 'sel' : ''}`} onClick={() => onPick(p)}>
          <span className="num">{p.number ?? ''}</span>
          {p.name}
        </button>
      ))}
    </div>
  );
}

function FreePlayer({ onSubmit, label = 'Usar' }: { onSubmit: (p: A.PlayerRef) => void; label?: string }) {
  const [num, setNum] = useState('');
  const [name, setName] = useState('');
  return (
    <div className="row" style={{ flexWrap: 'nowrap' }}>
      <input type="number" placeholder="Nº" value={num} style={{ width: 70 }} onChange={(e) => setNum(e.target.value)} />
      <input type="text" placeholder="Otro jugador / sin nombre" value={name} onChange={(e) => setName(e.target.value)} />
      <button className="btn" onClick={() => onSubmit({ name: name.trim(), number: num === '' ? null : Number(num) })}>
        {label}
      </button>
    </div>
  );
}

function GoalDialog({ s, side, onClose, run }: { s: LiveState; side: Side; onClose: () => void; run: (a: A.Action) => void }) {
  const [ownGoal, setOwnGoal] = useState(false);
  const [penalty, setPenalty] = useState(false);
  const [banner, setBanner] = useState(true);
  const playerSide = ownGoal ? other(side) : side;
  const pick = (p: A.PlayerRef) => {
    run(A.addGoal(playerSide, p, { ownGoal, penalty, showBanner: banner }));
    onClose();
  };
  return (
    <Modal title={`Gol de ${s[side].name}`} onClose={onClose} wide>
      <div className="stack">
        <div className="row">
          <label className="check">
            <input type="checkbox" checked={penalty} onChange={(e) => setPenalty(e.target.checked)} /> De penalti
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={ownGoal}
              onChange={(e) => {
                setOwnGoal(e.target.checked);
                if (e.target.checked) setPenalty(false);
              }}
            />{' '}
            En propia puerta ({s[other(side)].shortName})
          </label>
          <label className="check">
            <input type="checkbox" checked={banner} onChange={(e) => setBanner(e.target.checked)} /> Mostrar rótulo
          </label>
        </div>
        <span className="label">{ownGoal ? `Jugador de ${s[other(side)].name}` : '¿Quién ha marcado?'}</span>
        <PlayerGrid players={s[playerSide].players} onPick={(p) => pick({ name: p.name, number: p.number })} />
        <FreePlayer onSubmit={pick} label="Gol" />
      </div>
    </Modal>
  );
}

function PlayerDialog({
  title,
  team,
  onClose,
  onPick,
}: {
  title: string;
  team: TeamInfo;
  onClose: () => void;
  onPick: (p: A.PlayerRef, banner: boolean) => void;
}) {
  const [banner, setBanner] = useState(true);
  const pick = (p: A.PlayerRef) => {
    onPick(p, banner);
    onClose();
  };
  return (
    <Modal title={title} onClose={onClose} wide>
      <div className="stack">
        <label className="check">
          <input type="checkbox" checked={banner} onChange={(e) => setBanner(e.target.checked)} /> Mostrar rótulo
        </label>
        <PlayerGrid players={team.players} onPick={(p) => pick({ name: p.name, number: p.number })} />
        <FreePlayer onSubmit={pick} />
      </div>
    </Modal>
  );
}

function SubDialog({
  team,
  onClose,
  onPick,
}: {
  team: TeamInfo;
  onClose: () => void;
  onPick: (out: A.PlayerRef, inn: A.PlayerRef, banner: boolean) => void;
}) {
  const [out, setOut] = useState<Player | null>(null);
  const [inn, setInn] = useState<Player | null>(null);
  const [banner, setBanner] = useState(true);
  const [freeOut, setFreeOut] = useState<A.PlayerRef | null>(null);
  const [freeIn, setFreeIn] = useState<A.PlayerRef | null>(null);
  const o = out ? { name: out.name, number: out.number } : freeOut;
  const i = inn ? { name: inn.name, number: inn.number } : freeIn;
  return (
    <Modal title={`Cambio · ${team.name}`} onClose={onClose} wide>
      <div className="stack">
        <span className="label" style={{ color: '#ef4444' }}>
          ▼ Sale {o && `· ${o.number ?? ''} ${o.name ?? ''}`}
        </span>
        <PlayerGrid players={team.players} selected={out?.id} onPick={(p) => (setOut(p), setFreeOut(null))} />
        <FreePlayer label="Sale" onSubmit={(p) => (setFreeOut(p), setOut(null))} />
        <span className="label" style={{ color: '#22c55e' }}>
          ▲ Entra {i && `· ${i.number ?? ''} ${i.name ?? ''}`}
        </span>
        <PlayerGrid players={team.players} selected={inn?.id} onPick={(p) => (setInn(p), setFreeIn(null))} />
        <FreePlayer label="Entra" onSubmit={(p) => (setFreeIn(p), setInn(null))} />
        <div className="row between">
          <label className="check">
            <input type="checkbox" checked={banner} onChange={(e) => setBanner(e.target.checked)} /> Mostrar rótulo
          </label>
          <button
            className="btn primary"
            disabled={!o || !i}
            onClick={() => {
              onPick(o!, i!, banner);
              onClose();
            }}
          >
            Confirmar cambio
          </button>
        </div>
      </div>
    </Modal>
  );
}

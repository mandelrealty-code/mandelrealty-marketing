import { useEffect, useRef, useState } from "react";
import {
  BLANK,
  BUTTON_ZOOM,
  FN,
  FN_ORDER,
  NODE_H,
  NODE_W,
  type EdgeRunState,
  type FnName,
  type NodeResult,
  type Port,
  type RunEvent,
  type Workflow,
  type WfNode,
  canConnect,
  defaultSource,
  edgePath,
  linkPair,
  linkTarget,
  missingNumber,
  placeNewNode,
  playResults,
  runOrder,
  runSummary,
  simulateRun,
  tileColors,
  wheelFactor,
  zoomAt,
} from "../../../shared/copilot/workflow";

const ICONS: Record<(typeof FN)[FnName]["icon"], string> = {
  clock: "M8 2.5a5.5 5.5 0 1 0 0 11a5.5 5.5 0 1 0 0-11M8 5v3l2 1.5",
  lines: "M3 4h10M3 8h10M3 12h6",
  pen: "M3 13l1-3.5L11 2.5l2.5 2.5L6.5 12z",
  globe: "M8 2.5a5.5 5.5 0 1 0 0 11a5.5 5.5 0 1 0 0-11M2.5 8h11M8 2.5c-2 2-2 9 0 11M8 2.5c2 2 2 9 0 11",
  bubble: "M3 3.5h10v7H7l-3 2.5v-2.5H3z",
  pause: "M6 4v8M10 4v8",
};

type Drag =
  | { type: "pan"; sx: number; sy: number; vx: number; vy: number; moved: boolean }
  | { type: "node"; id: string; sx: number; sy: number; nx: number; ny: number; moved: boolean }
  | { type: "link"; from: string; port: Port; sx: number; sy: number; moved: boolean };

type RunView = {
  status: "running" | "done";
  order: string[];
  nodes: Record<string, NodeResult>;
  edges: Record<string, EdgeRunState>;
  current?: string;
  failed?: string;
};

type LinkDrag = { from: string; port: Port; x: number; y: number; target: string | null; targetPort: Port | null };
type Picker = { from: string | null; sx: number; sy: number };

function Icon({ name, size }: { name: (typeof FN)[FnName]["icon"]; size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={ICONS[name]} />
    </svg>
  );
}

function Check({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 8.5l3.2 3L13 4.5" />
    </svg>
  );
}

function Cross({ size = 10 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  );
}

function previewPath(node: WfNode, port: Port, x2: number, y2: number, end: Port | null) {
  const x1 = node.x + NODE_W / 2;
  const y1 = port === "top" ? node.y : node.y + NODE_H;
  const c = Math.max(40, Math.abs(y2 - y1) / 2);
  const s1 = port === "top" ? -1 : 1;
  const s2 = end ? (end === "bottom" ? 1 : -1) : y2 > y1 ? -1 : 1;
  return `M${x1} ${y1} C${x1} ${y1 + s1 * c} ${x2} ${y2 + s2 * c} ${x2} ${y2}`;
}

function stColor(st: NodeResult["st"] | undefined) {
  if (st === "ok") return "var(--ok)";
  if (st === "fail") return "var(--danger)";
  if (st === "run") return "#c4a35a";
  return "var(--wf-line2)";
}

export function WorkflowBuilder({
  seed,
  theme,
  onBack,
  onSave,
  onTest,
}: {
  seed: Workflow;
  theme: "dark" | "light";
  onBack: () => void;
  onSave?: (wf: Workflow) => Promise<void>;
  onTest?: (wf: Workflow) => Promise<Record<string, NodeResult>>;
}) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const seq = useRef(seed.id === BLANK.id ? 1 : 10);
  const drag = useRef<Drag>(null);
  const cancelRun = useRef<(() => void) | null>(null);
  const [wf, setWf] = useState<Workflow>(seed);
  const [sel, setSel] = useState<string | null>(seed.nodes.some((n) => n.id === "n3") ? "n3" : null);
  const [selEdge, setSelEdge] = useState<string | null>(null);
  const [view, setView] = useState({ x: 40, y: 40, k: 1 });
  const [link, setLink] = useState<LinkDrag | null>(null);
  const [picker, setPicker] = useState<Picker | null>(null);
  const [panning, setPanning] = useState(false);
  const [run, setRun] = useState<RunView | null>(null);
  const wfRef = useRef(wf);
  const viewRef = useRef(view);
  const selRef = useRef(sel);
  const selEdgeRef = useRef(selEdge);
  wfRef.current = wf;
  viewRef.current = view;
  selRef.current = sel;
  selEdgeRef.current = selEdge;

  function rect() {
    return canvasRef.current?.getBoundingClientRect() ?? { left: 0, top: 0, width: 800, height: 600 };
  }

  function toWorld(cx: number, cy: number) {
    const r = rect();
    const v = viewRef.current;
    return { x: (cx - r.left - v.x) / v.k, y: (cy - r.top - v.y) / v.k };
  }

  function applyView(next: { x: number; y: number; k: number }) {
    viewRef.current = next;
    setView(next);
  }

  function fit() {
    const r = rect();
    const ns = wfRef.current.nodes;
    if (!ns.length) {
      applyView({ x: r.width / 2, y: 140, k: 1 });
      return;
    }
    const minx = Math.min(...ns.map((n) => n.x));
    const miny = Math.min(...ns.map((n) => n.y));
    const bw = Math.max(...ns.map((n) => n.x)) + NODE_W - minx;
    const bh = Math.max(...ns.map((n) => n.y)) + NODE_H - miny;
    const pad = 90;
    const k = Math.max(0.35, Math.min(1.1, (r.width - pad * 2) / bw, (r.height - pad * 2) / bh));
    applyView({ k, x: (r.width - bw * k) / 2 - minx * k, y: (r.height - bh * k) / 2 - miny * k });
  }

  function ensureVisible(id: string) {
    const n = wfRef.current.nodes.find((row) => row.id === id);
    const el = canvasRef.current;
    if (!n || !el) return;
    const r = el.getBoundingClientRect();
    const v = viewRef.current;
    const pad = 40;
    const left = v.x + n.x * v.k;
    const top = v.y + n.y * v.k;
    const right = left + NODE_W * v.k;
    const bottom = top + (NODE_H + 60) * v.k;
    if (left < pad || top < pad || right > r.width - pad || bottom > r.height - pad) fit();
  }

  function zoomAround(mx: number, my: number, factor: number) {
    applyView(zoomAt(viewRef.current, mx, my, factor));
    setPicker(null);
  }

  useEffect(() => {
    const el = canvasRef.current;
    const onWheel = (e: WheelEvent) => {
      if (!el) return;
      e.preventDefault();
      const r = el.getBoundingClientRect();
      zoomAround(e.clientX - r.left, e.clientY - r.top, wheelFactor(e));
    };
    const onMove = (e: MouseEvent) => {
      const d = drag.current;
      if (!d) return;
      if (e.clientX === 0 && e.clientY === 0) return;
      const dx = e.clientX - d.sx;
      const dy = e.clientY - d.sy;
      if (d.type !== "link" && Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
      if (d.type === "pan") {
        applyView({ ...viewRef.current, x: d.vx + dx, y: d.vy + dy });
      } else if (d.type === "node" && d.moved) {
        const k = viewRef.current.k;
        const x = d.nx + dx / k;
        const y = d.ny + dy / k;
        setWf((current) => {
          const next = { ...current, nodes: current.nodes.map((n) => (n.id === d.id ? { ...n, x, y } : n)) };
          wfRef.current = next;
          return next;
        });
      } else if (d.type === "link") {
        const p = toWorld(e.clientX, e.clientY);
        const hit = linkTarget(wfRef.current, p, d.from, viewRef.current.k);
        setLink({ from: d.from, port: d.port, x: p.x, y: p.y, target: hit?.id ?? null, targetPort: hit?.port ?? null });
      }
    };
    const onUp = (e: MouseEvent) => {
      const d = drag.current;
      drag.current = null;
      if (!d) return;
      if (d.type === "pan") {
        setPanning(false);
        if (!d.moved) {
          setSel(null);
          setSelEdge(null);
          setPicker(null);
        }
      } else if (d.type === "node") {
        if (d.moved) {
          setWf((current) => {
            const next = {
              ...current,
              nodes: current.nodes.map((n) => (n.id === d.id ? { ...n, x: Math.round(n.x / 20) * 20, y: Math.round(n.y / 20) * 20 } : n)),
            };
            wfRef.current = next;
            return next;
          });
        }
        setSel(d.id);
        setSelEdge(null);
        setPicker(null);
      } else if (d.type === "link") {
        const p = toWorld(e.clientX, e.clientY);
        const hit = linkTarget(wfRef.current, p, d.from, viewRef.current.k);
        setLink(null);
        if (!hit) return;
        const pair = linkPair(d.from, d.port, hit.id, hit.port);
        const current = wfRef.current;
        if (!canConnect(current, pair.from, pair.to)) return;
        const edge = { id: `e${seq.current}`, from: pair.from, to: pair.to };
        seq.current += 1;
        const next = { ...current, edges: [...current.edges, edge] };
        wfRef.current = next;
        setWf(next);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "Escape") {
        setSel(null);
        setSelEdge(null);
        setPicker(null);
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selEdgeRef.current) {
          const id = selEdgeRef.current;
          setWf((current) => ({ ...current, edges: current.edges.filter((edge) => edge.id !== id) }));
          setSelEdge(null);
        } else if (selRef.current) {
          const id = selRef.current;
          setWf((current) => ({
            ...current,
            nodes: current.nodes.filter((n) => n.id !== id),
            edges: current.edges.filter((edge) => edge.from !== id && edge.to !== id),
          }));
          setSel(null);
        }
      }
    };
    const onDragOver = (e: DragEvent) => {
      if (!drag.current) return;
      e.preventDefault();
      onMove(e);
    };
    el?.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("drag", onMove);
    window.addEventListener("dragend", onUp);
    window.addEventListener("keydown", onKey);
    const frame = requestAnimationFrame(() => fit());
    return () => {
      el?.removeEventListener("wheel", onWheel);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("drag", onMove);
      window.removeEventListener("dragend", onUp);
      window.removeEventListener("keydown", onKey);
      cancelAnimationFrame(frame);
      cancelRun.current?.();
    };
    // Mount only. Later moves read the refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openPicker(from: string | null) {
    const r = rect();
    const v = viewRef.current;
    let sx = 16;
    let sy = 62;
    if (from) {
      const n = wf.nodes.find((row) => row.id === from);
      if (n) {
        sx = v.x + (n.x + NODE_W / 2) * v.k - 120;
        sy = v.y + (n.y + NODE_H) * v.k + 44;
      }
    }
    sx = Math.max(8, Math.min(sx, r.width - 250));
    sy = Math.max(8, Math.min(sy, r.height - 330));
    setPicker({ from, sx, sy });
  }

  function addNode(fn: FnName, from: string | null) {
    const current = wfRef.current;
    let source = from;
    if (!source && current.nodes.length) source = defaultSource(current, selRef.current);
    const r = rect();
    const v = viewRef.current;
    const spot = placeNewNode(current, source, { x: (r.width / 2 - v.x) / v.k, y: (r.height / 2 - v.y) / v.k });
    const meta = FN[fn];
    const id = `n${seq.current}`;
    const edgeId = `e${seq.current}`;
    seq.current += 1;
    const node: WfNode = { id, fn, note: meta.defaultNote, field: meta.defaultField, x: spot.x, y: spot.y };
    const next: Workflow = {
      ...current,
      nodes: [...current.nodes, node],
      edges: source ? [...current.edges, { id: edgeId, from: source, to: id }] : current.edges,
    };
    wfRef.current = next;
    setWf(next);
    setSel(id);
    setSelEdge(null);
    setPicker(null);
    requestAnimationFrame(() => ensureVisible(id));
  }

  function startTest() {
    if (run?.status === "running") return;
    cancelRun.current?.();
    const snapshot = wfRef.current;
    setPicker(null);
    setRun({ status: "running", order: runOrder(snapshot), nodes: {}, edges: {} });
    const apply = (event: RunEvent) => {
      setRun((prev) => {
        if (!prev) return prev;
        if (event.type === "done") {
          const last = [...prev.order].reverse().find((id) => (prev.nodes[id]?.out?.length ?? 0) > 0) ?? prev.order.at(-1);
          if (last) setSel(last);
          return { ...prev, status: "done", current: undefined };
        }
        if (event.type === "edge") return { ...prev, edges: { ...prev.edges, [event.edgeId]: event.st } };
        const nodes = { ...prev.nodes, [event.nodeId]: event.result };
        return {
          ...prev,
          nodes,
          current: event.result.st === "run" ? event.nodeId : prev.current,
          failed: event.result.st === "fail" ? prev.failed || event.nodeId : prev.failed,
        };
      });
    };
    if (!onTest) {
      cancelRun.current = simulateRun(snapshot, apply);
      return;
    }
    void onTest(snapshot).then((results) => {
      cancelRun.current = playResults(snapshot, results, apply);
    }).catch((err: unknown) => {
      const first = runOrder(snapshot)[0];
      const message = err instanceof Error ? err.message : "The test failed.";
      cancelRun.current = playResults(snapshot, first ? { [first]: { st: "fail", ms: 0.1, err: message, out: [] } } : {}, apply);
    });
  }

  async function leave() {
    if (onSave && wfRef.current.nodes.length) {
      try {
        await onSave(wfRef.current);
      } catch {
        return;
      }
    }
    onBack();
  }

  async function toggleArmed() {
    if (missingNumber(wfRef.current)) return;
    const previous = wfRef.current;
    const next = { ...previous, on: !previous.on };
    wfRef.current = next;
    setWf(next);
    if (!onSave) return;
    try {
      await onSave(next);
    } catch {
      wfRef.current = previous;
      setWf(previous);
    }
  }

  function closeRun() {
    cancelRun.current?.();
    cancelRun.current = null;
    setRun(null);
  }

  const byId = Object.fromEntries(wf.nodes.map((n) => [n.id, n]));
  const hasOut = new Set(wf.edges.map((e) => e.from));
  const missing = missingNumber(wf);
  const armed = wf.on && !missing;
  const locked = missing || armed;
  const running = run?.status === "running";
  const done = run?.status === "done";
  const failedNode = run?.failed ? byId[run.failed] : undefined;
  const summary = run ? runSummary(run.order, run.nodes, wf, run.status, run.current, run.failed) : "";
  const selected = sel ? byId[sel] : undefined;

  function hideDragGhost(e: { dataTransfer: DataTransfer }) {
    const img = new Image();
    img.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
    e.dataTransfer.setDragImage(img, 0, 0);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", "step");
  }

  function startNode(e: { button: number; clientX: number; clientY: number; stopPropagation: () => void }, n: WfNode) {
    if (e.button !== 0) return;
    e.stopPropagation();
    drag.current = { type: "node", id: n.id, sx: e.clientX, sy: e.clientY, nx: n.x, ny: n.y, moved: false };
  }

  function startLink(e: { button: number; clientX: number; clientY: number; stopPropagation: () => void }, n: WfNode, port: Port) {
    if (e.button !== 0) return;
    e.stopPropagation();
    drag.current = { type: "link", from: n.id, port, sx: e.clientX, sy: e.clientY, moved: false };
    setLink({
      from: n.id,
      port,
      x: n.x + NODE_W / 2,
      y: port === "top" ? n.y : n.y + NODE_H,
      target: null,
      targetPort: null,
    });
  }

  let linkD = "";
  if (link && byId[link.from]) {
    const target = link.target ? byId[link.target] : undefined;
    const x2 = target ? target.x + NODE_W / 2 : link.x;
    const y2 = target ? (link.targetPort === "bottom" ? target.y + NODE_H : target.y) : link.y;
    linkD = previewPath(byId[link.from], link.port, x2, y2, target ? link.targetPort : null);
  }

  return (
    <div className="cp-wf">
      <div className="cp-wf-bar">
        <button type="button" className="cp-wf-back" onClick={() => void leave()}>
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M12 4.5L6.5 10l5.5 5.5" />
          </svg>
          Skills
        </button>
        <div className="cp-wf-rule" />
        <div className="cp-wf-title">
          <span>{wf.name}</span>
          <em>{wf.boundary}</em>
        </div>
        {missing ? <span className="cp-wf-need">Add a number first.</span> : null}
        <button type="button" className="cp-wf-test" onClick={startTest} style={{ cursor: running ? "default" : "pointer" }}>
          {running ? <span className="cp-wf-spin" /> : (
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden><path d="M4 2.5v11l9-5.5z" /></svg>
          )}
          {running ? "Running…" : "Test run"}
        </button>
        <button type="button" className="cp-wf-switch" onClick={() => void toggleArmed()}>
          {armed ? "On" : "Off"}
          <span className={`track${armed ? " on" : ""}`}><span /></span>
        </button>
        <button
          type="button"
          className={`cp-wf-turn${locked ? " off" : ""}${missing ? " need" : ""}`}
          style={{ cursor: missing ? "default" : "pointer" }}
          onClick={() => void toggleArmed()}
        >
          {armed ? "Turn it off" : "Turn it on"}
        </button>
      </div>

      <div className="cp-wf-body">
        <div
          ref={canvasRef}
          className="cp-wf-canvas"
          style={{
            backgroundSize: `${20 * view.k}px ${20 * view.k}px`,
            backgroundPosition: `${view.x}px ${view.y}px`,
            cursor: panning ? "grabbing" : "default",
          }}
          onMouseDown={(e) => {
            if (e.button !== 0) return;
            drag.current = { type: "pan", sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y, moved: false };
            setPanning(true);
          }}
        >
          <div className="cp-wf-world" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})` }}>
            <svg className="cp-wf-edges" width="1" height="1">
              {wf.edges.map((edge) => {
                const a = byId[edge.from];
                const b = byId[edge.to];
                if (!a || !b) return null;
                const path = edgePath(a, b);
                const es = run?.edges[edge.id];
                const selectedEdge = edge.id === selEdge;
                const stroke = selectedEdge ? "#c4a35a" : es === "pass" ? "var(--ok)" : es === "block" ? "var(--danger)" : es === "skip" ? "var(--line)" : "var(--wf-line2)";
                const width = selectedEdge || es === "pass" || es === "block" ? 2 : 1.5;
                return (
                  <g key={edge.id}>
                    <path d={path.d} fill="none" stroke={stroke} strokeWidth={width} strokeDasharray={es === "block" ? "5 5" : undefined} />
                    {es === "flow" ? <path className="cp-wf-trail" d={path.d} fill="none" stroke="var(--ok)" strokeWidth="2.5" pathLength={1} strokeDasharray="1" /> : null}
                    <path
                      d={path.d}
                      fill="none"
                      stroke="transparent"
                      strokeWidth="16"
                      style={{ pointerEvents: "stroke", cursor: "pointer" }}
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={() => { setSelEdge(edge.id); setSel(null); setPicker(null); }}
                    />
                  </g>
                );
              })}
            </svg>

            {wf.nodes.map((n) => {
              const meta = FN[n.fn];
              const tile = tileColors(meta.hue, theme);
              const st = run?.nodes[n.id]?.st;
              const result = run?.nodes[n.id];
              const isTarget = link?.target === n.id;
              const tTop = isTarget && link?.targetPort === "top";
              const tBot = isTarget && link?.targetPort === "bottom";
              const skipped = st === "skip" || (run?.status === "done" && !result);
              const selectedNode = n.id === sel;
              const border = isTarget ? "#c4a35a" : st && st !== "skip" ? stColor(st) : selectedNode ? "#c4a35a" : "var(--line)";
              return (
                <div
                  key={n.id}
                  role="group"
                  aria-label={n.fn}
                  className={`cp-wf-node${st === "fail" ? " fail" : ""}`}
                  style={{
                    left: n.x,
                    top: n.y,
                    borderColor: border,
                    boxShadow: selectedNode || isTarget ? "0 0 0 3px rgba(196,163,90,0.22)" : "var(--wf-node-shadow)",
                    opacity: skipped ? 0.45 : 1,
                  }}
                  onMouseDown={(e) => startNode(e, n)}
                  onPointerDown={(e) => startNode(e, n)}
                >
                  {st === "run" ? <span className="cp-wf-badge run"><span className="cp-wf-spin" /></span> : null}
                  {st === "ok" ? <span className="cp-wf-badge ok" title={result?.ms != null ? `Worked · ${result.ms}s` : undefined}><Check /></span> : null}
                  {st === "fail" ? <span className="cp-wf-badge fail" title={result?.ms != null ? `Failed · ${result.ms}s` : undefined}><Cross /></span> : null}
                  {st === "skip" ? <span className="cp-wf-skip">Skipped</span> : null}
                  <div
                    className="cp-wf-port in"
                    role="button"
                    draggable
                    aria-label={`Connect into the top of ${n.fn}`}
                    title="Drag to connect"
                    style={{ left: tTop ? 110 : 114, top: tTop ? -10 : -6 }}
                    onMouseDown={(e) => startLink(e, n, "top")}
                    onPointerDown={(e) => startLink(e, n, "top")}
                    onDragStart={hideDragGhost}
                  >
                    <span style={{ width: tTop ? 20 : 12, height: tTop ? 20 : 12, background: tTop ? "#c4a35a" : "var(--surf)", borderColor: tTop ? "#c4a35a" : "var(--wf-line2)" }} />
                  </div>
                  <div className="cp-wf-nodehead" role="button" aria-label={`Move ${n.fn}`} draggable onDragStart={hideDragGhost}>
                    <span className="tile" style={{ background: tile.bg, color: tile.fg }}><Icon name={meta.icon} size={16} /></span>
                    <span>
                      <strong>{n.fn}</strong>
                      <em>{meta.how}</em>
                    </span>
                  </div>
                  <div className="cp-wf-div" />
                  <p>{n.note}</p>
                  <div
                    className="cp-wf-port out"
                    role="button"
                    draggable
                    aria-label={`Connect from the bottom of ${n.fn}`}
                    title="Drag to connect"
                    onMouseDown={(e) => startLink(e, n, "bottom")}
                    onPointerDown={(e) => startLink(e, n, "bottom")}
                    onDragStart={hideDragGhost}
                  >
                    <span style={{ width: tBot ? 20 : 12, height: tBot ? 20 : 12, background: selectedNode || tBot ? "#c4a35a" : "var(--surf)", borderColor: selectedNode || tBot ? "#c4a35a" : "var(--wf-line2)" }} />
                  </div>
                  {selectedNode || !hasOut.has(n.id) ? (
                    <button type="button" className="cp-wf-plus" aria-label="Add next step" onMouseDown={(e) => e.stopPropagation()} onClick={() => openPicker(n.id)}>
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden><path d="M8 3v10M3 8h10" /></svg>
                    </button>
                  ) : null}
                </div>
              );
            })}

            {!wf.nodes.length ? (
              <button type="button" className="cp-wf-blank" style={{ left: -NODE_W / 2, top: 40 }} onMouseDown={(e) => e.stopPropagation()} onClick={() => openPicker(null)}>
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden><path d="M8 3v10M3 8h10" /></svg>
                Add a step
              </button>
            ) : null}

            {linkD ? (
              <svg className="cp-wf-edges preview" width="1" height="1">
                <path d={linkD} fill="none" stroke="#c4a35a" strokeWidth="2" strokeDasharray={link?.target ? undefined : "5 5"} />
              </svg>
            ) : null}

            {wf.edges.map((edge) => {
              if (run?.edges[edge.id] !== "flow") return null;
              const a = byId[edge.from];
              const b = byId[edge.to];
              if (!a || !b) return null;
              const path = edgePath(a, b);
              return <span key={`${edge.id}-dot`} className="cp-wf-dot" style={{ offsetPath: `path('${path.d}')` }} />;
            })}

            {wf.edges.map((edge) => {
              if (edge.id !== selEdge) return null;
              const a = byId[edge.from];
              const b = byId[edge.to];
              if (!a || !b) return null;
              const path = edgePath(a, b);
              return (
                <button
                  key={`${edge.id}-x`}
                  type="button"
                  className="cp-wf-unlink"
                  style={{ left: path.mid.x - 12, top: path.mid.y - 12 }}
                  aria-label="Remove link"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={() => setWf((current) => ({ ...current, edges: current.edges.filter((row) => row.id !== edge.id) }))}
                >
                  <Cross />
                </button>
              );
            })}
          </div>

          <button type="button" className="cp-wf-add" onMouseDown={(e) => e.stopPropagation()} onClick={() => openPicker(null)}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden><path d="M8 3v10M3 8h10" /></svg>
            Add step
          </button>

          <div className="cp-wf-zoom" onMouseDown={(e) => e.stopPropagation()}>
            <button type="button" aria-label="Zoom in" onClick={() => { const r = rect(); zoomAround(r.width / 2, r.height / 2, BUTTON_ZOOM); }}>+</button>
            <span>{Math.round(view.k * 100)}%</span>
            <button type="button" aria-label="Zoom out" onClick={() => { const r = rect(); zoomAround(r.width / 2, r.height / 2, 1 / BUTTON_ZOOM); }}>−</button>
            <i />
            <button type="button" aria-label="Fit to screen" onClick={fit}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10" />
              </svg>
            </button>
          </div>

          {!run ? <div className="cp-wf-hint">Drag a step to move it · Drag from its lower dot to connect · Scroll to zoom · Drag the board to pan</div> : null}

          {run ? (
            <div className="cp-wf-run" style={{ borderColor: done ? (failedNode ? "var(--danger)" : "var(--ok)") : "var(--line)" }} onMouseDown={(e) => e.stopPropagation()}>
              {running ? <span className="cp-wf-spin lg" /> : null}
              {done && !failedNode ? <span className="cp-wf-badge ok static"><Check /></span> : null}
              {done && failedNode ? <span className="cp-wf-badge fail static"><Cross /></span> : null}
              <div className="cp-wf-runcopy">
                <strong>Test run</strong>
                <span>{summary}</span>
              </div>
              <div className="cp-wf-chips">
                {run.order.filter((id) => byId[id]).map((id) => {
                  const row = run.nodes[id];
                  const st = row?.st;
                  return (
                    <button
                      key={id}
                      type="button"
                      style={{
                        borderColor: id === sel ? "#c4a35a" : "var(--line)",
                        background: st === "fail" ? "var(--wf-danger-wash)" : "transparent",
                        opacity: st === "skip" ? 0.6 : 1,
                      }}
                      onClick={() => { setSel(id); setSelEdge(null); }}
                    >
                      <i style={{ background: st === "skip" || !st ? "var(--quiet)" : stColor(st) }} />
                      {byId[id].fn}
                      <em>{row?.ms != null ? `${row.ms}s` : st === "skip" ? "skipped" : ""}</em>
                    </button>
                  );
                })}
              </div>
              <button type="button" className="cp-wf-again" onClick={startTest} style={{ cursor: running ? "default" : "pointer" }}>Run again</button>
              <button type="button" className="cp-wf-x" aria-label="Close test run" onClick={closeRun}><Cross size={11} /></button>
            </div>
          ) : null}

          {picker ? (
            <div className="cp-wf-pick" style={{ left: picker.sx, top: picker.sy }} onMouseDown={(e) => e.stopPropagation()}>
              <span className="label">{picker.from ? "Add the next step" : "Add a step"}</span>
              {FN_ORDER.map((fn) => {
                const meta = FN[fn];
                const tile = tileColors(meta.hue, theme);
                return (
                  <button key={fn} type="button" onClick={() => addNode(fn, picker.from)}>
                    <span className="tile" style={{ background: tile.bg, color: tile.fg }}><Icon name={meta.icon} size={14} /></span>
                    <span>
                      <strong>{fn}</strong>
                      <em>{meta.how}</em>
                    </span>
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>

        <aside className="cp-wf-panel">
          {selected ? (
            <StepPanel
              node={selected}
              theme={theme}
              wf={wf}
              run={run}
              onClose={() => setSel(null)}
              onChange={(patch) => setWf((current) => ({ ...current, nodes: current.nodes.map((n) => (n.id === selected.id ? { ...n, ...patch } : n)) }))}
              onFn={(fn) => {
                if (fn === selected.fn) return;
                const meta = FN[fn];
                setWf((current) => ({
                  ...current,
                  nodes: current.nodes.map((n) => (n.id === selected.id ? { ...n, fn, field: meta.defaultField, note: meta.defaultNote } : n)),
                }));
              }}
              onOpen={(id) => setSel(id)}
              onUnlink={(id) => { setWf((current) => ({ ...current, edges: current.edges.filter((edge) => edge.id !== id) })); setSelEdge(null); }}
              onAdd={() => openPicker(selected.id)}
              onDelete={() => {
                setWf((current) => ({
                  ...current,
                  nodes: current.nodes.filter((n) => n.id !== selected.id),
                  edges: current.edges.filter((edge) => edge.from !== selected.id && edge.to !== selected.id),
                }));
                setSel(null);
              }}
            />
          ) : (
            <div className="cp-wf-fields">
              <span className="cp-wf-h">Workflow</span>
              <label>
                <span>Name</span>
                <input value={wf.name} onChange={(e) => setWf((current) => ({ ...current, name: e.target.value }))} />
              </label>
              <label>
                <span>What it is allowed to touch</span>
                <textarea rows={3} placeholder="What is it allowed to touch?" value={wf.boundary} onChange={(e) => setWf((current) => ({ ...current, boundary: e.target.value }))} />
              </label>
              <label>
                <span>Memory</span>
                <input value={wf.memory} onChange={(e) => setWf((current) => ({ ...current, memory: e.target.value }))} />
              </label>
              <p>Click a step to change what it does. Use the + under a step to add the next one, or drag from a step's lower dot onto another step to connect them.</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function StepPanel({
  node,
  theme,
  wf,
  run,
  onClose,
  onChange,
  onFn,
  onOpen,
  onUnlink,
  onAdd,
  onDelete,
}: {
  node: WfNode;
  theme: "dark" | "light";
  wf: Workflow;
  run: RunView | null;
  onClose: () => void;
  onChange: (patch: Partial<WfNode>) => void;
  onFn: (fn: FnName) => void;
  onOpen: (id: string) => void;
  onUnlink: (edgeId: string) => void;
  onAdd: () => void;
  onDelete: () => void;
}) {
  const meta = FN[node.fn];
  const tile = tileColors(meta.hue, theme);
  const result = run?.nodes[node.id];
  const st = result?.st;
  const skipped = st === "skip" || (run?.status === "done" && !result);
  const showResult = Boolean(st || skipped);
  const byId = Object.fromEntries(wf.nodes.map((n) => [n.id, n]));
  const next = wf.edges.filter((edge) => edge.from === node.id && byId[edge.to]);
  return (
    <div className="cp-wf-fields">
      <div className="cp-wf-stephead">
        <span className="cp-wf-h">Step</span>
        <button type="button" aria-label="Close" onClick={onClose}><Cross size={11} /></button>
      </div>
      <div className="cp-wf-stepname">
        <span className="tile" style={{ background: tile.bg, color: tile.fg }}><Icon name={meta.icon} size={18} /></span>
        <span>
          <strong>{node.fn}</strong>
          <em>{meta.how}</em>
        </span>
      </div>
      {showResult ? (
        <div
          className="cp-wf-result"
          style={{
            borderColor: st === "ok" ? "var(--ok)" : st === "fail" ? "var(--danger)" : "var(--line)",
            background: st === "ok" ? "var(--wf-ok-wash)" : st === "fail" ? "var(--wf-danger-wash)" : "var(--surf)",
          }}
        >
          <div className="top">
            <span><i style={{ background: skipped ? "var(--quiet)" : stColor(st) }} />{skipped ? "Skipped. An earlier step failed." : st === "run" ? "Running…" : st === "ok" ? "Worked in the test" : "Failed in the test"}</span>
            <em>{result?.ms != null ? `${result.ms}s` : ""}</em>
          </div>
          {result?.err ? <p>{result.err}</p> : null}
          {result?.out?.length ? (
            <div className="outs">
              <span>Output</span>
              {result.out.map(([key, value]) => (
                <div key={key}><em>{key}</em><code>{value}</code></div>
              ))}
            </div>
          ) : null}
          {st === "ok" && !result?.out?.length ? <p className="quiet">{result?.note || "Ran. Nothing to show."}</p> : null}
        </div>
      ) : null}
      <div className="cp-wf-fns">
        <span>Function</span>
        <div>
          {FN_ORDER.map((fn) => (
            <button key={fn} type="button" className={fn === node.fn ? "on" : ""} onClick={() => onFn(fn)}>
              {fn}
              {fn === node.fn ? <Check size={13} /> : null}
            </button>
          ))}
        </div>
      </div>
      <label>
        <span>What this step does</span>
        <textarea rows={3} value={node.note} onChange={(e) => onChange({ note: e.target.value })} />
      </label>
      <label>
        <span>{meta.field}</span>
        <input value={node.field} placeholder={meta.placeholder || ""} onChange={(e) => onChange({ field: e.target.value })} />
      </label>
      <div className="cp-wf-next">
        <span>Next</span>
        {next.map((edge) => (
          <div key={edge.id}>
            <button type="button" onClick={() => onOpen(edge.to)}>
              <strong>{byId[edge.to].fn}</strong>
              <em>{byId[edge.to].note}</em>
            </button>
            <button type="button" aria-label="Unlink" onClick={() => onUnlink(edge.id)}><Cross /></button>
          </div>
        ))}
        <button type="button" className="add" onClick={onAdd}>
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden><path d="M8 3v10M3 8h10" /></svg>
          Add next step
        </button>
      </div>
      <button type="button" className="cp-wf-delete" onClick={onDelete}>Delete step</button>
    </div>
  );
}

// MRG Copilot — Workflow model. Port as-is; keep names and copy exact.

export type FnName = 'When' | 'Read' | 'Write' | 'Look on the web' | 'Text me' | 'Wait for you';

export const FN_ORDER: FnName[] = ['When', 'Read', 'Write', 'Look on the web', 'Text me', 'Wait for you'];

export interface FnMeta {
  how: string;          // quiet line under the function name
  field: string;        // label of the one field this step needs
  defaultField: string;
  placeholder?: string;
  defaultNote: string;  // "What this step does"
  hue: number;          // oklch hue for the icon tile
  icon: 'clock' | 'lines' | 'pen' | 'globe' | 'bubble' | 'pause';
}

export const FN: Record<FnName, FnMeta> = {
  'When':            { how: 'Checks each morning',     field: 'Check time',    defaultField: '8:00 each morning',  defaultNote: 'Something new happens',      hue: 75,  icon: 'clock' },
  'Read':            { how: 'Reads in code',           field: 'Reads from',    defaultField: 'Review inbox',       defaultNote: 'Reads what came in',         hue: 250, icon: 'lines' },
  'Write':           { how: 'Writes with Sonnet',      field: 'Tone',          defaultField: 'Short and plain',    defaultNote: 'Writes a draft',             hue: 300, icon: 'pen' },
  'Look on the web': { how: 'Looks with Cursor',       field: 'Where to look', defaultField: 'The review page',    defaultNote: 'Opens a page and checks it', hue: 200, icon: 'globe' },
  'Text me':         { how: 'Texts your number',       field: 'Your mobile',   defaultField: '', placeholder: 'Add your mobile number', defaultNote: 'Your mobile', hue: 150, icon: 'bubble' },
  'Wait for you':    { how: 'Stops until you confirm', field: 'Ask me',        defaultField: 'Before it moves on', defaultNote: 'Waits for your OK',          hue: 25,  icon: 'pause' },
};

export const tileColors = (hue: number, theme: 'dark' | 'light') =>
  theme === 'dark'
    ? { bg: `oklch(0.72 0.1 ${hue} / 0.16)`, fg: `oklch(0.8 0.1 ${hue})` }
    : { bg: `oklch(0.62 0.12 ${hue} / 0.13)`, fg: `oklch(0.5 0.13 ${hue})` };

export interface WfNode { id: string; fn: FnName; note: string; field: string; x: number; y: number; }
export interface WfEdge { id: string; from: string; to: string; }
export interface Workflow { id: string; name: string; boundary: string; memory: string; on: boolean; nodes: WfNode[]; edges: WfEdge[]; }

export const NODE_W = 240;
export const NODE_H = 132;
export const GRID = 20;

export const SEED: Workflow = {
  id: 'review-text',
  name: 'Review text',
  boundary: 'Texts you when a new review arrives. It does not text a guest.',
  memory: '20 Blue Jays Way.',
  on: false,
  nodes: [
    { id: 'n1', fn: 'When',         note: 'A new review',                field: '8:00 each morning',  x: 0,    y: 0 },
    { id: 'n2', fn: 'Read',         note: 'The review and its link',     field: 'Review inbox',       x: 0,    y: 220 },
    { id: 'n3', fn: 'Text me',      note: 'Your mobile',                 field: '(917) 555-0142',     x: -160, y: 440 },
    { id: 'n4', fn: 'Write',        note: 'A draft reply to the review', field: 'Short and plain',    x: 160,  y: 440 },
    { id: 'n5', fn: 'Wait for you', note: 'Before the reply is posted',  field: 'Before it moves on', x: 160,  y: 660 },
  ],
  edges: [
    { id: 'e1', from: 'n1', to: 'n2' },
    { id: 'e2', from: 'n2', to: 'n3' },
    { id: 'e3', from: 'n2', to: 'n4' },
    { id: 'e4', from: 'n4', to: 'n5' },
  ],
};

export const BLANK: Workflow = {
  id: "new",
  name: "New workflow",
  boundary: "",
  memory: "Nothing yet",
  on: false,
  nodes: [],
  edges: [],
};

// ---------- Rules ----------

export const missingNumber = (wf: Workflow) =>
  wf.nodes.some(n => n.fn === 'Text me' && !n.field.trim());   // blocks "Turn it on"; show "Add a number first."

export const wouldCycle = (edges: WfEdge[], from: string, to: string) => {
  const seen = new Set<string>(); const stack = [to];
  while (stack.length) { const id = stack.pop()!; if (id === from) return true; if (seen.has(id)) continue; seen.add(id); edges.filter(e => e.from === id).forEach(e => stack.push(e.to)); }
  return false;
};

export const canConnect = (wf: Workflow, from: string, to: string) =>
  from !== to && !wf.edges.some(e => e.from === from && e.to === to) && !wouldCycle(wf.edges, from, to);

export type Port = 'top' | 'bottom';

/** Magnet target while dragging a link: node box expanded by 28px/zoom; nearest port (top or bottom center) wins. */
export function linkTarget(wf: Workflow, p: { x: number; y: number }, fromId: string, zoom: number): { id: string; port: Port } | null {
  const m = 28 / zoom;
  let best: { id: string; port: Port; d: number } | null = null;
  for (const n of wf.nodes) {
    if (n.id === fromId || p.x < n.x - m || p.x > n.x + NODE_W + m || p.y < n.y - m || p.y > n.y + NODE_H + m) continue;
    for (const port of ['top', 'bottom'] as Port[]) {
      const py = port === 'top' ? n.y : n.y + NODE_H, d = (n.x + NODE_W / 2 - p.x) ** 2 + (py - p.y) ** 2;
      if (!best || d < best.d) best = { id: n.id, port, d };
    }
  }
  return best ? { id: best.id, port: best.port } : null;
}

/** Edge direction from a drag: source node/port → target node/port. */
export function linkPair(src: string, srcPort: Port, tgt: string, tgtPort: Port) {
  if (srcPort === 'top') return { from: tgt, to: src };
  return tgtPort === 'bottom' ? { from: tgt, to: src } : { from: src, to: tgt };
}

/** Where a new step goes. Returns world coords (top-left). */
export function placeNewNode(wf: Workflow, fromId: string | null, viewCenter: { x: number; y: number }) {
  const W = NODE_W, H = NODE_H;
  let x: number, y: number;
  if (fromId) {
    const b = wf.nodes.find(n => n.id === fromId)!;
    const kids = wf.edges.filter(e => e.from === fromId).map(e => wf.nodes.find(n => n.id === e.to)!).filter(Boolean);
    if (kids.length) { x = Math.max(...kids.map(k => k.x)) + W + 60; y = kids[0].y; }
    else { x = b.x; y = b.y + 220; }
  } else { x = Math.round((viewCenter.x - W / 2) / GRID) * GRID; y = Math.round((viewCenter.y - H / 2) / GRID) * GRID; }
  while (wf.nodes.some(n => Math.abs(n.x - x) < W + 20 && Math.abs(n.y - y) < H + 20)) y += H + 88;
  return { x, y };
}

/** "Add step" button with no source: attach to selected node, else the lowest leaf. */
export function defaultSource(wf: Workflow, selId: string | null) {
  if (selId && wf.nodes.some(n => n.id === selId)) return selId;
  const outs = new Set(wf.edges.map(e => e.from));
  const leaves = wf.nodes.filter(n => !outs.has(n.id)).sort((a, b) => b.y - a.y);
  return (leaves[0] ?? wf.nodes[wf.nodes.length - 1])?.id ?? null;
}

/** Edge geometry: bottom-center of `from` to top-center of `to`. Midpoint = average of endpoints. */
export function edgePath(a: WfNode, b: WfNode) {
  const x1 = a.x + NODE_W / 2, y1 = a.y + NODE_H, x2 = b.x + NODE_W / 2, y2 = b.y;
  const c = Math.max(40, Math.abs(y2 - y1) / 2);
  return { d: `M${x1} ${y1} C${x1} ${y1 + c} ${x2} ${y2 - c} ${x2} ${y2}`, mid: { x: (x1 + x2) / 2, y: (y1 + y2) / 2 } };
}

/** Zoom around a point (canvas-local px). */
export function zoomAt(view: { x: number; y: number; k: number }, mx: number, my: number, factor: number) {
  const k = Math.min(2, Math.max(0.35, view.k * factor));
  return { k, x: mx - (mx - view.x) * (k / view.k), y: my - (my - view.y) * (k / view.k) };
}
export const wheelFactor = (e: { deltaY: number; ctrlKey: boolean }) => Math.exp(-e.deltaY * (e.ctrlKey ? 0.012 : 0.004));
export const BUTTON_ZOOM = 1.4;

// ---------- Test run ----------

export type NodeRunState = 'run' | 'ok' | 'fail' | 'skip';
export type EdgeRunState = 'flow' | 'pass' | 'block' | 'skip';

export interface NodeResult { st: NodeRunState; ms?: number; out?: [string, string][]; err?: string; note?: string; }

/** Events the real executor should stream to the UI (simulated in the prototype). */
export type RunEvent =
  | { type: 'edge'; edgeId: string; st: EdgeRunState }
  | { type: 'node'; nodeId: string; result: NodeResult }
  | { type: 'done' };

export function runOrder(wf: Workflow) {
  const inc = (id: string) => wf.edges.filter(e => e.to === id);
  const q = wf.nodes.filter(n => !inc(n.id).length).map(n => n.id);
  const order: string[] = [], seen = new Set<string>();
  while (q.length) { const id = q.shift()!; if (seen.has(id)) continue; seen.add(id); order.push(id); wf.edges.filter(e => e.from === id).forEach(e => q.push(e.to)); }
  return order;
}

const ERR: Record<FnName, string> = {
  'When': "Couldn't check for new reviews.",
  'Read': "Couldn't open the review. The link returned an error.",
  'Write': "Couldn't write the draft.",
  'Look on the web': "The page didn't load in time.",
  'Text me': 'The text did not go through. The number was rejected.',
  'Wait for you': '',
};

/** Prototype-only sample outcomes. Production uses real executor results. */
export function simulateOutcome(n: WfNode, wf: Workflow, failAt: FnName | 'None'): NodeResult {
  if (n.fn === 'Text me' && !n.field.trim()) return { st: 'fail', ms: 0.1, out: [], err: 'No number to text. Add your mobile.' };
  if (n.fn === failAt) return { st: 'fail', ms: 0.6, out: [], err: ERR[n.fn] };
  const mem = wf.memory.replace(/\.$/, '');
  switch (n.fn) {
    case 'When': return { st: 'ok', ms: 0.3, out: [['Found', '1 new review'], ['Building', mem]] };
    case 'Read': return { st: 'ok', ms: 0.8, out: [['Rating', '4 of 5'], ['Link', 'reviews/20-blue-jays-way/4821']] };
    case 'Write': return { st: 'ok', ms: 2.1, out: [['Draft', 'Thank you for staying with us. We are glad the quiet street suited you.']] };
    case 'Look on the web': return { st: 'ok', ms: 1.6, out: [['Page', 'Opened'], ['Review', 'Is live']] };
    case 'Text me': return { st: 'ok', ms: 0.6, out: [['Sent to', n.field]] };
    case 'Wait for you': return { st: 'ok', ms: 0.1, out: [], note: 'Ran. It would stop for you here; a test skips the wait.' };
  }
}

/**
 * Drives the trail. `emit` receives RunEvents over time.
 * Rules: a node with incoming edges but no succeeded parent is skipped.
 * A failed node blocks its outgoing edges; other branches continue.
 */
export function simulateRun(wf: Workflow, emit: (e: RunEvent) => void, failAt: FnName | 'None' = 'None') {
  const timers: ReturnType<typeof setTimeout>[] = [];
  const at = (ms: number, f: () => void) => timers.push(setTimeout(f, ms));
  const byId = Object.fromEntries(wf.nodes.map(n => [n.id, n]));
  const res: Record<string, NodeRunState> = {};
  const FLOW_MS = 560, RUN_MS = 750, GAP_MS = 120;
  let t = 250;
  for (const id of runOrder(wf)) {
    const ins = wf.edges.filter(e => e.to === id), okIns = ins.filter(e => res[e.from] === 'ok');
    if (ins.length && !okIns.length) {
      res[id] = 'skip';
      at(t, () => { ins.forEach(e => res[e.from] !== 'fail' && emit({ type: 'edge', edgeId: e.id, st: 'skip' })); emit({ type: 'node', nodeId: id, result: { st: 'skip' } }); });
      continue;
    }
    if (okIns.length) {
      at(t, () => okIns.forEach(e => emit({ type: 'edge', edgeId: e.id, st: 'flow' }))); t += FLOW_MS;
      at(t, () => okIns.forEach(e => emit({ type: 'edge', edgeId: e.id, st: 'pass' })));
    }
    at(t, () => emit({ type: 'node', nodeId: id, result: { st: 'run' } })); t += RUN_MS;
    const r = simulateOutcome(byId[id], wf, failAt); res[id] = r.st;
    at(t, () => {
      emit({ type: 'node', nodeId: id, result: r });
      if (r.st === 'fail') wf.edges.filter(e => e.from === id).forEach(e => emit({ type: 'edge', edgeId: e.id, st: 'block' }));
    });
    t += GAP_MS;
  }
  at(t + 80, () => emit({ type: 'done' }));
  return () => timers.forEach(clearTimeout);   // cancel
}

export function runSummary(order: string[], nodes: Record<string, NodeResult>, wf: Workflow, status: 'running' | 'done', current?: string, failed?: string) {
  const fn = (id?: string) => wf.nodes.find(n => n.id === id)?.fn;
  if (status === 'running') return current ? `Running ${fn(current)}…` : 'Starting…';
  const ok = order.filter(id => nodes[id]?.st === 'ok').length;
  return failed ? `Failed at ${fn(failed)} · ${ok} of ${order.length} steps worked` : `Worked · all ${order.length} steps ran`;
}

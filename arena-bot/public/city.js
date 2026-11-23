// Улицы Говсан как граф: узлы — перекрёстки, рёбра — участки улиц.
// Координаты сняты с карты hovsan.jpg (1080×1073) и умножаются на S.
export const S = 2.5; // 1 пиксель карты = 2.5 мировых

const RAW_N = {
  tl0: [0, 85], t150: [150, 88], t150u: [152, 0], t55: [57, 89], t205: [207, 91], t360: [362, 94], t517: [518, 97], t770: [775, 99],
  hw0: [727, 0], hw1: [838, 170], hwr: [1080, 160], r940: [935, 160], r940u: [945, 0],
  hw2: [880, 300], hw3: [1045, 555], hwe: [1080, 605],
  c1: [690, 335], c2: [665, 370],
  m0: [0, 577], m45: [45, 578], m140: [140, 578], m265: [265, 580], m352: [352, 582], m512: [512, 585], m660: [658, 589], m818: [820, 590], m1040: [1035, 575],
  v205a: [205, 460], v205b: [205, 515], v350a: [350, 462],
  d195: [195, 635],
  l30: [32, 725], l45: [42, 860], b70: [72, 1032],
  b195: [192, 1018], b350: [348, 1000], b505: [508, 970], b650: [650, 958], b825: [825, 940], b1010: [1012, 925], b1080: [1080, 918],
  h515: [512, 762], h650: [652, 772],
  s812: [812, 470],
  h830: [828, 725], h1060: [1058, 740], h1080: [1080, 745],
  x1: [1035, 780], x2: [1005, 840],
};
const RAW_E = [
  ['tl0', 't55'], ['t55', 't150'], ['t150', 't205'], ['t205', 't360'], ['t360', 't517'], ['t517', 't770'], ['t770', 'hw1'], ['t150', 't150u'],
  ['hw0', 't770'], ['hw1', 'r940'], ['r940', 'hwr'], ['r940', 'r940u'], ['hw1', 'hw2'], ['hw2', 'hw3'], ['hw3', 'hwe'],
  ['hw2', 'c1'], ['c1', 'c2'], ['c2', 'm660'],
  ['t55', 'm45'], ['t205', 'v205a'], ['v205a', 'v205b'], ['v205b', 'm140'], ['v205a', 'v350a'], ['t360', 'v350a'], ['v350a', 'm352'], ['t517', 'm512'],
  ['m0', 'm45'], ['m45', 'm140'], ['m140', 'm265'], ['m265', 'm352'], ['m352', 'm512'], ['m512', 'm660'], ['m660', 'm818'], ['m818', 'm1040'], ['m1040', 'hw3'],
  ['m140', 'd195'], ['d195', 'm265'], ['d195', 'b195'],
  ['m45', 'l30'], ['l30', 'l45'], ['l45', 'b70'], ['b70', 'b195'], ['b195', 'b350'], ['b350', 'b505'], ['b505', 'b650'], ['b650', 'b825'], ['b825', 'b1010'], ['b1010', 'b1080'],
  ['m352', 'b350'], ['m512', 'h515'], ['h515', 'b505'], ['h515', 'h650'], ['m660', 'h650'], ['h650', 'b650'],
  ['s812', 'm818'], ['m818', 'h830'], ['h830', 'b825'], ['h830', 'h1060'], ['h1060', 'h1080'], ['h1060', 'x1'], ['x1', 'x2'], ['x2', 'b1010'],
];

export const NODES = Object.entries(RAW_N).map(([name, [x, y]], i) => ({ i, name, x: x * S, y: y * S, nb: [] }));
const byName = Object.fromEntries(NODES.map(n => [n.name, n.i]));
export const EDGES = RAW_E.map(([a, b]) => [byName[a], byName[b]]);
for (const [a, b] of EDGES) { NODES[a].nb.push(b); NODES[b].nb.push(a); }
export const angleOf = (a, b) => Math.atan2(NODES[b].y - NODES[a].y, NODES[b].x - NODES[a].x);
export const edgeLen = (a, b) => Math.hypot(NODES[a].x - NODES[b].x, NODES[a].y - NODES[b].y);
// перекрёстки, где можно появиться (не тупики у края карты)
export const SPAWN_NODES = NODES.filter(n => n.nb.length >= 3).map(n => n.i);

// кварталы = внутренние грани графа (нужны ботам, чтобы объезжать квартал)
const sortedNb = NODES.map(n => n.nb.slice().sort((p, q) => angleOf(n.i, p) - angleOf(n.i, q)));
function polyArea(pts) { let s = 0; for (let i = 0; i < pts.length; i++) { const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length]; s += x1 * y2 - x2 * y1; } return s / 2; }
export const BLOCKS = (() => {
  const used = new Set(), faces = [];
  for (const [a, b] of EDGES) for (const [u0, v0] of [[a, b], [b, a]]) {
    if (used.has(u0 + ',' + v0)) continue;
    const nodes = []; let u = u0, v = v0, guard = 0;
    while (!used.has(u + ',' + v) && guard++ < 500) {
      used.add(u + ',' + v); nodes.push(u);
      const nb = sortedNb[v], k = nb.indexOf(u);
      const w = nb[(k - 1 + nb.length) % nb.length];
      u = v; v = w;
    }
    faces.push({ nodes, area: polyArea(nodes.map(i => [NODES[i].x, NODES[i].y])) });
  }
  const outer = faces.reduce((m, f) => Math.abs(f.area) > Math.abs(m.area) ? f : m);
  const sign = -Math.sign(outer.area);
  return faces.filter(f => f !== outer && Math.sign(f.area) === sign && Math.abs(f.area) > 2000).map((f, id) => ({ id, nodes: f.nodes }));
})();
export const BLOCKS_AT = NODES.map(n => BLOCKS.filter(b => b.nodes.includes(n.i)));

// кратчайший путь по улицам (BFS по числу перекрёстков)
export function pathTo(from, goal) {
  const prev = new Map([[from, -1]]), q = [from];
  while (q.length) {
    const u = q.shift();
    if (goal(u)) { const p = []; for (let x = u; x !== from; x = prev.get(x)) p.unshift(x); return p; }
    for (const v of NODES[u].nb) if (!prev.has(v)) { prev.set(v, u); q.push(v); }
  }
  return [];
}

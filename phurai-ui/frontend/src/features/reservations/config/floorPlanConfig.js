export const SHAPES = {
  round2: { shape: 'circle', r: 20, n: 2, gap: 14 },
  round4: { shape: 'circle', r: 24, n: 4, gap: 15 },
  booth6: { shape: 'ellipse', rx: 50, ry: 30, n: 6, gap: 16 },
  booth8: { shape: 'ellipse', rx: 65, ry: 35, n: 8, gap: 16 },
  vip6: { shape: 'ellipse', rx: 50, ry: 28, n: 6, gap: 16 },
  rect2: { shape: 'rect', w: 46, h: 46, rx: 8, ry: 8, n: 2, gap: 14 },
  rect4: { shape: 'rect', w: 66, h: 46, rx: 8, ry: 8, n: 4, gap: 14 },
  rect6: { shape: 'rect', w: 90, h: 50, rx: 8, ry: 8, n: 6, gap: 15 },
  rect8: { shape: 'rect', w: 110, h: 54, rx: 8, ry: 8, n: 8, gap: 16 }
};

export const TABLES = [
  // These 31 real tables are the source-of-truth inventory in
  // dbo.RestaurantTables. The reception circle on the plan is not a table.
  { id: "WIN-A", x: 140, y: 120, type: "round2", fill: "#dceaf5", chair: "#cfe3da" },
  { id: "WIN-B", x: 400, y: 120, type: "round4", fill: "#dceaf5", chair: "#cfe3da" },
  { id: "WIN-C", x: 880, y: 115, type: "booth6", fill: "#dceaf5", chair: "#cfe3da" },
  { id: "WIN-D", x: 1165, y: 115, type: "booth8", fill: "#dceaf5", chair: "#cfe3da" },
  { id: "VIP-1", x: 140, y: 290, type: "vip6", fill: "#f6d6d6", chair: "#f1c2c2" },
  { id: "VIP-2", x: 140, y: 455, type: "vip6", fill: "#f6d6d6", chair: "#f1c2c2" },
  { id: "VIP-3", x: 140, y: 630, type: "vip6", fill: "#f6d6d6", chair: "#f1c2c2" },
  { id: "S-01", x: 350, y: 300, type: "round4" }, { id: "S-02", x: 490, y: 300, type: "round4" }, { id: "S-03", x: 630, y: 300, type: "round4" }, { id: "S-04", x: 770, y: 300, type: "round4" },
  { id: "S-05", x: 350, y: 450, type: "round4" }, { id: "S-06", x: 490, y: 450, type: "round4" }, { id: "S-07", x: 630, y: 450, type: "round4" }, { id: "S-08", x: 770, y: 450, type: "round4" },
  { id: "S-09", x: 350, y: 600, type: "round4" }, { id: "S-10", x: 490, y: 600, type: "round4" }, { id: "S-11", x: 630, y: 600, type: "round4" }, { id: "S-12", x: 770, y: 600, type: "round4" },
  { id: "PRE-01", x: 930, y: 290, type: "round4", fill: "#f7e6c2", chair: "#f0d8a8" }, { id: "PRE-02", x: 930, y: 405, type: "round4", fill: "#f7e6c2", chair: "#f0d8a8" },
  { id: "PRE-03", x: 930, y: 520, type: "round4", fill: "#f7e6c2", chair: "#f0d8a8" }, { id: "PRE-04", x: 930, y: 640, type: "round4", fill: "#f7e6c2", chair: "#f0d8a8" },
  { id: "PR-01", x: 1165, y: 290, type: "rect2", fill: "#ece1f0", chair: "#ddc9e6" }, { id: "PR-02", x: 1165, y: 460, type: "rect4", fill: "#ece1f0", chair: "#ddc9e6" },
  { id: "PR-03", x: 1165, y: 630, type: "rect6", fill: "#ece1f0", chair: "#ddc9e6" }, { id: "PR-04", x: 1165, y: 820, type: "rect8", fill: "#ece1f0", chair: "#ddc9e6" },
  { id: "K-01", x: 330, y: 825, type: "round4" }, { id: "K-02", x: 440, y: 825, type: "round4" }, { id: "K-03", x: 545, y: 825, type: "round4" }, { id: "K-04", x: 650, y: 825, type: "round4" }
];

export function getChairPositions(profile) {
  const pts = [];
  const { shape, n, gap } = profile;

  const rX = shape === 'circle' ? profile.r : (shape === 'rect' ? profile.w / 2 : profile.rx);
  const rY = shape === 'circle' ? profile.r : (shape === 'rect' ? profile.h / 2 : profile.ry);

  for (let i = 0; i < n; i++) {
    const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
    let radiusFactor = 1;
    if (shape === 'rect') {
      const cos = Math.abs(Math.cos(angle));
      const sin = Math.abs(Math.sin(angle));
      radiusFactor = Math.min(1 / cos, 1 / sin) * 0.9;
    }
    const cx = Math.cos(angle) * (rX + gap) * (shape === 'rect' ? radiusFactor : 1);
    const cy = Math.sin(angle) * (rY + gap) * (shape === 'rect' ? radiusFactor : 1);
    pts.push({ x: cx, y: cy, rot: (angle * 180 / Math.PI) + 90 });
  }
  return pts;
}

// Shared game configuration

export const SPHERE_RADIUS = 300;
export const HEIGHT_OFFSET = 0.1; // Height offset above sphere surface for tiles, trails, and target zone

// 3 different tile widths corresponding to keys A, S, D
export const TILE_WIDTHS = [0.8, 1.2, 1.6];

// Colors for each width index (A=red, S=blue, D=green)
export const WIDTH_COLORS = [
  { r: 1, g: 0.2, b: 0.2 },    // A - Red
  { r: 0.2, g: 0.5, b: 1 },    // S - Blue
  { r: 0.2, g: 1, b: 0.3 },    // D - Green
];

// CSS colors for legend (matching WIDTH_COLORS)
export const WIDTH_CSS_COLORS = ['#ff3333', '#3388ff', '#33ff4d'];

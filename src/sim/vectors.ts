// Canonical state order is position XYZ, then inertial velocity XYZ.
export type Vec3 = [number, number, number];
export type State = [number, number, number, number, number, number];
export const position = (y: State): Vec3 => [y[0], y[1], y[2]];
export const velocity = (y: State): Vec3 => [y[3], y[4], y[5]];
export const dot = (a: Vec3, b: Vec3) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
export const norm = (a: Vec3) => Math.hypot(...a);
export const subtract = (a: Vec3, b: Vec3): Vec3 => [a[0]-b[0], a[1]-b[1], a[2]-b[2]];
export const cross = (a: Vec3, b: Vec3): Vec3 => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
export const scale = (a: Vec3, s: number): Vec3 => [a[0]*s, a[1]*s, a[2]*s];
export const state = (r: Vec3, v: Vec3): State => [...r, ...v];
export const distance = (a: State, b: State) => norm(subtract(position(a), position(b)));
export const relativeSpeed = (a: State, b: State) => norm(subtract(velocity(a), velocity(b)));
export const XY = {u: [1,0,0] as Vec3, v: [0,1,0] as Vec3};

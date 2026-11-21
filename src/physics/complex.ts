// Minimal complex arithmetic and a dense complex linear solver (Gaussian elimination).
export type C = { re: number; im: number }
export const c = (re: number, im = 0): C => ({ re, im })
export const add = (a: C, b: C): C => c(a.re + b.re, a.im + b.im)
export const sub = (a: C, b: C): C => c(a.re - b.re, a.im - b.im)
export const mul = (a: C, b: C): C => c(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re)
export const div = (a: C, b: C): C => {
  const d = b.re * b.re + b.im * b.im
  return c((a.re * b.re + a.im * b.im) / d, (a.im * b.re - a.re * b.im) / d)
}
export const scale = (a: C, s: number): C => c(a.re * s, a.im * s)
export const abs2 = (a: C): number => a.re * a.re + a.im * a.im
export const abs = (a: C): number => Math.sqrt(abs2(a))
export const expi = (phi: number): C => c(Math.cos(phi), Math.sin(phi))
export const cexp = (a: C): C => {
  const e = Math.exp(a.re)
  return c(e * Math.cos(a.im), e * Math.sin(a.im))
}
export const csqrt = (a: C): C => {
  const r = abs(a)
  const re = Math.sqrt(Math.max(0, (r + a.re) / 2))
  const im = (a.im < 0 ? -1 : 1) * Math.sqrt(Math.max(0, (r - a.re) / 2))
  return c(re, im)
}
export const zeros = (n: number, m: number): C[][] =>
  Array.from({ length: n }, () => Array.from({ length: m }, () => c(0)))

/** Solve A X = B for X (A: n x n, B: n x m). Partial pivoting. */
export function solve(A: C[][], B: C[][]): C[][] {
  const n = A.length
  const m = B[0].length
  const a = A.map((r) => r.map((x) => ({ ...x })))
  const b = B.map((r) => r.map((x) => ({ ...x })))
  for (let k = 0; k < n; k++) {
    let p = k
    for (let i = k + 1; i < n; i++) if (abs2(a[i][k]) > abs2(a[p][k])) p = i
    ;[a[k], a[p]] = [a[p], a[k]]
    ;[b[k], b[p]] = [b[p], b[k]]
    for (let i = k + 1; i < n; i++) {
      const f = div(a[i][k], a[k][k])
      for (let j = k; j < n; j++) a[i][j] = sub(a[i][j], mul(f, a[k][j]))
      for (let j = 0; j < m; j++) b[i][j] = sub(b[i][j], mul(f, b[k][j]))
    }
  }
  const x = zeros(n, m)
  for (let i = n - 1; i >= 0; i--) {
    for (let j = 0; j < m; j++) {
      let s = b[i][j]
      for (let k = i + 1; k < n; k++) s = sub(s, mul(a[i][k], x[k][j]))
      x[i][j] = div(s, a[i][i])
    }
  }
  return x
}

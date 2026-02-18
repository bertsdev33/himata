/**
 * Minimal linear algebra routines for Ridge Regression.
 * All matrices are flat number[] in row-major order.
 */

/** Transpose an m×n matrix to n×m. */
export function transpose(A: number[], m: number, n: number): number[] {
  const T = new Array(n * m);
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      T[j * m + i] = A[i * n + j];
    }
  }
  return T;
}

/** Multiply m×n matrix A by n-vector x, returning m-vector. */
export function matVecMul(A: number[], m: number, n: number, x: number[]): number[] {
  const result = new Array(m);
  for (let i = 0; i < m; i++) {
    let sum = 0;
    const row = i * n;
    for (let j = 0; j < n; j++) {
      sum += A[row + j] * x[j];
    }
    result[i] = sum;
  }
  return result;
}

/** Compute X^T X (Gram matrix). X is m×n, result is n×n symmetric. */
export function gramMatrix(X: number[], m: number, n: number): number[] {
  const G = new Array(n * n).fill(0);
  for (let i = 0; i < n; i++) {
    for (let j = i; j < n; j++) {
      let sum = 0;
      for (let k = 0; k < m; k++) {
        sum += X[k * n + i] * X[k * n + j];
      }
      G[i * n + j] = sum;
      G[j * n + i] = sum; // symmetric
    }
  }
  return G;
}

/** Compute A^T y where A is m×n and y is m-vector. Returns n-vector. */
export function atVecMul(A: number[], m: number, n: number, y: number[]): number[] {
  const result = new Array(n).fill(0);
  for (let k = 0; k < m; k++) {
    const row = k * n;
    const yk = y[k];
    for (let j = 0; j < n; j++) {
      result[j] += A[row + j] * yk;
    }
  }
  return result;
}

/** Add alpha * I to n×n matrix G (modifies in place). */
export function addRegularization(G: number[], n: number, alpha: number): number[] {
  for (let i = 0; i < n; i++) {
    G[i * n + i] += alpha;
  }
  return G;
}

/**
 * Cholesky decomposition: A = L L^T.
 * A is n×n symmetric positive-definite (flat row-major).
 * Returns L (lower triangular, n×n flat row-major).
 */
export function cholesky(A: number[], n: number): number[] {
  const L = new Array(n * n).fill(0);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = 0;
      for (let k = 0; k < j; k++) {
        sum += L[i * n + k] * L[j * n + k];
      }
      if (i === j) {
        const diag = A[i * n + i] - sum;
        L[i * n + j] = Math.sqrt(Math.max(diag, 1e-10));
      } else {
        L[i * n + j] = (A[i * n + j] - sum) / L[j * n + j];
      }
    }
  }
  return L;
}

/** Forward solve: L x = b, where L is lower triangular n×n. */
export function forwardSolve(L: number[], n: number, b: number[]): number[] {
  const x = new Array(n);
  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (let j = 0; j < i; j++) {
      sum += L[i * n + j] * x[j];
    }
    x[i] = (b[i] - sum) / L[i * n + i];
  }
  return x;
}

/** Back solve: L^T x = b, where L is lower triangular n×n. */
export function backSolve(L: number[], n: number, b: number[]): number[] {
  const x = new Array(n);
  for (let i = n - 1; i >= 0; i--) {
    let sum = 0;
    for (let j = i + 1; j < n; j++) {
      sum += L[j * n + i] * x[j]; // L^T[i][j] = L[j][i]
    }
    x[i] = (b[i] - sum) / L[i * n + i];
  }
  return x;
}

/**
 * Solve Ridge regression: (X^T X + alpha I) beta = X^T y
 * X is m×n, y is m-vector. Returns beta (n-vector).
 */
export function solveRidge(
  X: number[],
  m: number,
  n: number,
  y: number[],
  alpha: number,
): number[] {
  const G = gramMatrix(X, m, n);
  addRegularization(G, n, alpha);
  const L = cholesky(G, n);
  const z = atVecMul(X, m, n, y);
  const w = forwardSolve(L, n, z);
  return backSolve(L, n, w);
}

/** Dot product of two vectors. */
export function dot(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += a[i] * b[i];
  }
  return sum;
}

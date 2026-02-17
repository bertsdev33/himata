import { describe, expect, it } from "bun:test";
import {
  transpose,
  matVecMul,
  gramMatrix,
  cholesky,
  forwardSolve,
  backSolve,
  solveRidge,
  dot,
  addRegularization,
} from "../src/linalg.js";

describe("transpose", () => {
  it("transposes a 2×3 matrix", () => {
    const A = [1, 2, 3, 4, 5, 6]; // 2×3
    const T = transpose(A, 2, 3);
    // Expected 3×2: [[1,4],[2,5],[3,6]]
    expect(T).toEqual([1, 4, 2, 5, 3, 6]);
  });

  it("transposes a 1×1 matrix", () => {
    expect(transpose([5], 1, 1)).toEqual([5]);
  });

  it("transposes a square 2×2 matrix", () => {
    const A = [1, 2, 3, 4];
    expect(transpose(A, 2, 2)).toEqual([1, 3, 2, 4]);
  });
});

describe("matVecMul", () => {
  it("multiplies a 2×3 matrix by a 3-vector", () => {
    const A = [1, 2, 3, 4, 5, 6];
    const x = [1, 0, 1];
    expect(matVecMul(A, 2, 3, x)).toEqual([4, 10]);
  });
});

describe("gramMatrix", () => {
  it("computes X^T X for a 3×2 matrix", () => {
    // X = [[1,0],[0,1],[1,1]] (3×2)
    const X = [1, 0, 0, 1, 1, 1];
    const G = gramMatrix(X, 3, 2);
    // X^T X = [[2,1],[1,2]]
    expect(G).toEqual([2, 1, 1, 2]);
  });
});

describe("cholesky", () => {
  it("decomposes a known 3×3 PD matrix", () => {
    // A = [[4, 12, -16], [12, 37, -43], [-16, -43, 98]]
    // L = [[2, 0, 0], [6, 1, 0], [-8, 5, 3]]
    const A = [4, 12, -16, 12, 37, -43, -16, -43, 98];
    const L = cholesky(A, 3);
    expect(L[0]).toBeCloseTo(2, 10);
    expect(L[1]).toBeCloseTo(0, 10);
    expect(L[2]).toBeCloseTo(0, 10);
    expect(L[3]).toBeCloseTo(6, 10);
    expect(L[4]).toBeCloseTo(1, 10);
    expect(L[5]).toBeCloseTo(0, 10);
    expect(L[6]).toBeCloseTo(-8, 10);
    expect(L[7]).toBeCloseTo(5, 10);
    expect(L[8]).toBeCloseTo(3, 10);
  });

  it("L×L^T roundtrips to original matrix", () => {
    const A = [4, 12, -16, 12, 37, -43, -16, -43, 98];
    const L = cholesky(A, 3);

    // Reconstruct L × L^T
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        let sum = 0;
        for (let k = 0; k < 3; k++) {
          sum += L[i * 3 + k] * L[j * 3 + k];
        }
        expect(sum).toBeCloseTo(A[i * 3 + j], 8);
      }
    }
  });
});

describe("forwardSolve and backSolve", () => {
  it("solve Lx = b then L^Tx = b roundtrip", () => {
    // L = [[2,0,0],[6,1,0],[-8,5,3]]
    const L = [2, 0, 0, 6, 1, 0, -8, 5, 3];
    const b = [2, 7, 4];

    const w = forwardSolve(L, 3, b);
    // Verify: L × w should equal b
    for (let i = 0; i < 3; i++) {
      let sum = 0;
      for (let j = 0; j <= i; j++) {
        sum += L[i * 3 + j] * w[j];
      }
      expect(sum).toBeCloseTo(b[i], 10);
    }

    const x = backSolve(L, 3, w);
    // Verify: L^T × x should equal w
    for (let i = 0; i < 3; i++) {
      let sum = 0;
      for (let j = i; j < 3; j++) {
        sum += L[j * 3 + i] * x[j];
      }
      expect(sum).toBeCloseTo(w[i], 10);
    }
  });
});

describe("solveRidge", () => {
  it("recovers known coefficients from noiseless linear data", () => {
    // y = 2*x1 + 3*x2
    // Generate 5 samples
    const X = [
      1, 0,
      0, 1,
      1, 1,
      2, 1,
      1, 2,
    ]; // 5×2
    const y = [2, 3, 5, 7, 8]; // exact linear

    // With very small alpha, should be close to OLS
    const beta = solveRidge(X, 5, 2, y, 0.001);
    expect(beta[0]).toBeCloseTo(2, 1);
    expect(beta[1]).toBeCloseTo(3, 1);
  });

  it("large alpha shrinks coefficients toward zero", () => {
    const X = [1, 0, 0, 1, 1, 1, 2, 1, 1, 2];
    const y = [2, 3, 5, 7, 8];

    const betaSmall = solveRidge(X, 5, 2, y, 0.001);
    const betaLarge = solveRidge(X, 5, 2, y, 10000);

    // Large alpha should shrink toward zero
    expect(Math.abs(betaLarge[0])).toBeLessThan(Math.abs(betaSmall[0]));
    expect(Math.abs(betaLarge[1])).toBeLessThan(Math.abs(betaSmall[1]));
  });
});

describe("dot", () => {
  it("computes dot product", () => {
    expect(dot([1, 2, 3], [4, 5, 6])).toBe(32);
  });

  it("returns 0 for orthogonal vectors", () => {
    expect(dot([1, 0], [0, 1])).toBe(0);
  });
});

describe("addRegularization", () => {
  it("adds alpha to diagonal", () => {
    const G = [1, 2, 2, 3];
    addRegularization(G, 2, 5);
    expect(G).toEqual([6, 2, 2, 8]);
  });
});

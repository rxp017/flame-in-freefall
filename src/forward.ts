/**
 * Forward droplet-burning prediction: classical quasi-steady d^2 law
 * (Spalding/Godsave form) with Hubbard-Denny-Mills 1/3 reference rule and
 * Wassiljewa/Mason-Saxena conductivity mixing. Frozen equation set; no tuning
 * to measured data. Ported line-for-line from scripts/forward_model_indep.py
 * (implementation 2, NIST-table ambient properties).
 *
 * Fuel-vapor thermal conductivity has TWO candidate sources, both shown:
 *  - 'fit': quadratic fit to NIST WebBook vapor points, EXTRAPOLATED beyond
 *    their published range at combustion reference temperatures (flagged).
 *  - 'chung': Chung et al. (1988) corresponding-states correlation.
 *    The equations below (Eq 9-4.3, 9-4.10, 9-4.11, below-10-3.14 psi,
 *    10-5.5-10-5.9 of Poling, Prausnitz & O'Connell, 5th ed.) are adapted from
 *    Cantera's HighPressureGasTransport (cantera.org), BSD-3-Clause licensed
 *    (https://github.com/Cantera/cantera/blob/main/License.txt):
 *    Copyright (c) 2001-2009, California Institute of Technology
 *    Copyright (c) 2009 Sandia Corporation
 *    Copyright (c) 2011-2026, Cantera Developers
 * The ~20% difference between candidates is transport-assumption SENSITIVITY,
 * not an uncertainty bound; neither candidate is guaranteed close to true K.
 */
import {
    CHUNG, CP_HEPT, CP_MEOH, LAM_HEPT, LAM_MEOH, MW, NIST_AMB, RECORDED,
    NU_O, QC_KG, RESIDUALS, SAT_HEPT, SAT_MEOH, T_INF,
} from './data/forwardData';

export type Fuel = 'Methanol' | 'Heptane';
export type Transport = 'fit' | 'chung';
const R = 8.314462618; // J/mol/K

function col(pts: number[][], T: number, c: number): number {
    // linear interpolation with clamped ends (same behaviour as numpy.interp)
    if (T <= pts[0][0]) return pts[0][c];
    if (T >= pts[pts.length - 1][0]) return pts[pts.length - 1][c];
    for (let i = 0; i < pts.length - 1; i++) {
        if (T >= pts[i][0] && T <= pts[i + 1][0]) {
            const f = (T - pts[i][0]) / (pts[i + 1][0] - pts[i][0]);
            return pts[i][c] + f * (pts[i + 1][c] - pts[i][c]);
        }
    }
    return pts[pts.length - 1][c];
}

function quadFit(pts: number[][]): (T: number) => number {
    // least-squares quadratic (same as numpy.polyfit deg 2)
    const n = pts.length;
    let s0 = n, s1 = 0, s2 = 0, s3 = 0, s4 = 0, t0 = 0, t1 = 0, t2 = 0;
    for (const [x, y] of pts) {
        const x2 = x * x;
        s1 += x; s2 += x2; s3 += x2 * x; s4 += x2 * x2;
        t0 += y; t1 += x * y; t2 += x2 * y;
    }
    const A = [[s4, s3, s2], [s3, s2, s1], [s2, s1, s0]];
    const b = [t2, t1, t0];
    // solve 3x3 by Cramer
    const det = (m: number[][]) =>
        m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
        m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
        m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
    const d = det(A);
    const rep = (j: number) => A.map((row, i) => row.map((v, k) => (k === j ? b[i] : v)));
    const c2 = det(rep(0)) / d, c1 = det(rep(1)) / d, c0 = det(rep(2)) / d;
    return (T: number) => c2 * T * T + c1 * T + c0;
}

const LAM_FIT: Record<Fuel, (T: number) => number> = {
    Methanol: quadFit(LAM_MEOH),
    Heptane: quadFit(LAM_HEPT),
};
const LAM_RANGE: Record<Fuel, [number, number]> = { Methanol: [339.27, 660], Heptane: [400, 600] };
const CP_TAB: Record<Fuel, number[][]> = { Methanol: CP_MEOH, Heptane: CP_HEPT };
const SAT: Record<Fuel, number[][]> = { Methanol: SAT_MEOH, Heptane: SAT_HEPT };

function satProps(fuel: Fuel, P_atm: number): [number, number, number] {
    const rows = SAT[fuel];
    if (P_atm < rows[0][1] || P_atm > rows[rows.length - 1][1]) {
        throw new Error(`${fuel} pressure ${P_atm.toFixed(3)} atm outside sourced saturation table`);
    }
    for (let i = 0; i < rows.length - 1; i++) {
        if (P_atm >= rows[i][1] && P_atm <= rows[i + 1][1]) {
            const f = (P_atm - rows[i][1]) / (rows[i + 1][1] - rows[i][1]);
            return [
                rows[i][0] + f * (rows[i + 1][0] - rows[i][0]),
                rows[i][2] + f * (rows[i + 1][2] - rows[i][2]),
                (rows[i][3] + f * (rows[i + 1][3] - rows[i][3])) * 1e3 / MW[fuel],
            ];
        }
    }
    throw new Error('unreachable');
}

function mixLambda(x: Record<string, number>, lam: Record<string, number>): number {
    const sps = Object.keys(x);
    let tot = 0;
    for (const i of sps) {
        let den = 0;
        for (const j of sps) {
            const a = Math.pow(1 + Math.sqrt(lam[i] / lam[j]) * Math.pow(MW[j] / MW[i], 0.25), 2);
            den += x[j] * a / (Math.sqrt(8) * Math.sqrt(1 + MW[i] / MW[j]));
        }
        tot += x[i] * lam[i] / den;
    }
    return tot;
}

const CA = [2.44166, -0.50924, 6.6107, 14.543, 0.79274, -5.8634, 91.089];
const CB = [0.74824, -1.5094, 5.6207, -8.9139, 0.82019, 12.801, 128.11];
const CC = [-0.91858, -49.991, 64.760, -5.6379, -0.69369, 9.5893, -54.217];
const CD = [121.72, 69.983, 27.039, 74.344, 6.3173, 65.529, 523.81];

export function chungLambda(fuel: Fuel, T: number, P_pa: number): number {
    const p = CHUNG[fuel];
    const sigma = 0.809 * Math.pow(p.Vc, 1 / 3);              // Eq 9-5.32
    const T_star = T / (p.Tc / 1.2593);                        // Eq 9-5.34 + 9-4.1
    const Om = 1.16145 / Math.pow(T_star, 0.14874) + 0.52487 / Math.exp(0.77320 * T_star)
        + 2.16178 / Math.exp(2.43787 * T_star);              // Eq 9-4.3 (domain 0.3..100)
    const mu_r = 52.46 * p.mu * p.mu * p.Pc_bar / (p.Tc * p.Tc);
    const Fc = 1 - 0.2756 * p.omega + 0.059035 * Math.pow(mu_r, 4) + p.kappa; // Eq 9-4.11
    const eta = Fc * 26.69 * Math.sqrt(MW[fuel] * 1000 * T) / (sigma * sigma * Om) * 1e-7; // Eq 9-4.10
    const Cv = col(CP_TAB[fuel], T, 1) - R;                  // J/mol/K, NIST cp tables
    const alpha = Cv / R - 1.5;
    const beta = 0.7862 - 0.7109 * p.omega + 1.3168 * p.omega * p.omega;
    const Z = 2.0 + 10.5 * Math.pow(T / p.Tc, 2);
    const psi = 1 + alpha * (0.215 + 0.28288 * alpha - 1.061 * beta + 0.26665 * Z)
        / (0.6366 + beta * Z + 1.061 * alpha * beta);        // below Eq 10-3.14
    const V_cm3 = R * T / P_pa * 1e6;
    const y = p.Vc / (6 * V_cm3);                            // Eq 10-5.6
    const B = CA.map((a, i) => a + CB[i] * p.omega + CC[i] * Math.pow(mu_r, 4) + CD[i] * p.kappa);
    const G1 = (1 - 0.5 * y) / Math.pow(1 - y, 3);           // Eq 10-5.7
    const G2 = (B[0] * (1 - Math.exp(-B[3] * y)) / y + B[1] * G1 * Math.exp(B[4] * y) + B[2] * G1)
        / (B[0] * B[3] + B[1] + B[2]);                       // Eq 10-5.8
    const q = 3.586e-3 * Math.sqrt(p.Tc / MW[fuel]) / Math.pow(p.Vc, 2 / 3);
    return (31.2 * eta * psi / MW[fuel]) * (1 / G2 + B[5] * y)
        + q * B[6] * y * y * Math.sqrt(T / p.Tc) * G2;       // Eq 10-5.5
}

export interface ForwardResult {
    K: number;          // mm^2/s
    B: number;
    Tf: number;
    Ts: number;
    Tr: number;
    lamExtrapolated: boolean; // true when transport 'fit' runs outside published range
    gasTableClamp: boolean; // true when the 1/3 reference state leaves the sourced gas cp/lambda tables: prediction refused, never silently clamped
}

export function predictK(fuel: Fuel, o2Percent: number, diluents: Record<string, number>,
    P_atm: number, transport: Transport): ForwardResult {
    const [Ts, rho_l, Hvap] = satProps(fuel, P_atm);
    const comp: Record<string, number> = { O2: o2Percent / 100, ...diluents };
    const m_mix = Object.entries(comp).reduce((s, [k, x]) => s + x * MW[k], 0);
    const Yo = comp.O2 * MW.O2 / m_mix;
    const nu = NU_O[fuel], Qc = QC_KG[fuel];
    // reference composition: 2/3 fuel vapor + 1/3 ambient by mass
    const w: Record<string, number> = { [fuel]: 2 / 3 };
    for (const [sp, x] of Object.entries(comp)) w[sp] = (1 / 3) * (x * MW[sp] / m_mix);
    const tm = Object.entries(w).reduce((s, [sp, wi]) => s + wi / MW[sp], 0);
    const xref: Record<string, number> = {};
    for (const [sp, wi] of Object.entries(w)) xref[sp] = (wi / MW[sp]) / tm;
    let Tf = 2400, cp_g = 0, lam_g = 0, Tr = Ts, extrap = false;
    for (let it = 0; it < 8; it++) {
        Tr = Ts + (Tf - Ts) / 3;
        const lam: Record<string, number> = {}, cpm: Record<string, number> = {};
        for (const sp of Object.keys(comp)) {
            lam[sp] = col(NIST_AMB[sp], Tr, 2);
            cpm[sp] = col(NIST_AMB[sp], Tr, 1) / MW[sp];
        }
        lam[fuel] = transport === 'chung' ? chungLambda(fuel, Tr, P_atm * 101325) : LAM_FIT[fuel](Tr);
        if (transport === 'fit' && (Tr < LAM_RANGE[fuel][0] || Tr > LAM_RANGE[fuel][1])) extrap = true;
        cpm[fuel] = col(CP_TAB[fuel], Tr, 1) / MW[fuel];
        lam_g = mixLambda(xref, lam);
        cp_g = Object.entries(w).reduce((s, [sp, wi]) => s + wi * cpm[sp], 0);
        // Matalon Lec.12 p.9 exact: Tf = Tinf + [(Qc - Qv)/cp - (Tinf - Ts)] / (1 + nu/Yo)
        const Tf_new = T_INF + ((Qc - Hvap) / cp_g - (T_INF - Ts)) / (1 + nu / Yo);
        if (Math.abs(Tf_new - Tf) < 1) { Tf = Tf_new; break; }
        Tf = Tf_new;
    }
    Tr = Ts + (Tf - Ts) / 3;
    const B = (cp_g * (T_INF - Ts) + Qc * Yo / nu) / Hvap;
    const K = 8 * lam_g / (rho_l * cp_g) * Math.log(1 + B) * 1e6;
    const gasClamp = Tr < 300 || Tr > 1500; // NIST_AMB sourced span; refuse instead of clamping
    return { K, B, Tf, Ts, Tr, lamExtrapolated: extrap, gasTableClamp: gasClamp };
}

/** FLEX envelope check: is this condition inside the recorded test envelope? */

/** per-variant residual stats [signedMedian, medianAbs, p10, p90, n] for the closest cohort group */
export function residualSpread(variant: Transport, fuel: Fuel, diluent: string): number[] | null {
    const v = RESIDUALS[variant] || {};
    return v[`${fuel}|${diluent}`] ?? null;
}

/** nominal d^2-law lifetime display only: D0^2/K. NOT validated against measured burn times. */
export function nominalLifetimeS(d0_mm: number, K_mm2s: number): number {
    return (d0_mm * d0_mm) / K_mm2s;
}

/** Coverage against the graded cohort's ACTUAL recorded conditions (per fuel and
 *  dominant diluent), replacing the old min-max rectangle. "near" uses a stated
 *  display threshold (|delta O2| <= 2 points AND |delta P| <= 0.3 atm of at least
 *  one recorded row); it marks where measurements exist, not model validity. */
export function coverage(fuel: Fuel, diluent: string, o2Percent: number, P_atm: number) {
    let best: { o2: number; p: number; frac: number } | null = null;
    let bestD = Infinity;
    for (const [f, d, o2, p, frac] of RECORDED) {
        if (f !== fuel || d !== diluent) continue;
        const dist = Math.max(Math.abs(o2 - o2Percent) / 2, Math.abs(p - P_atm) / 0.3);
        if (dist < bestD) { bestD = dist; best = { o2, p, frac }; }
    }
    return { nearest: best, near: best !== null && bestD <= 1, any: best !== null };
}

/** Classical flame standoff ratio r_flame/r_droplet from the same quasi-steady
 *  d-squared theory (flame sheet, unity Le): ln(1+B)/ln(1+Y_O,inf/nu_O) with
 *  nu_O = kg O2 per kg fuel (Matalon, CEFRC Lecture 12 prints rf/a =
 *  ln(1+Bc)/ln(1+nu_F*W_F*Yo/(nu_O*W_O)); nu_F*W_F/(nu_O*W_O) = 1/nu_O here).
 *  Theory estimate, known to overpredict observed ratios. Computed, not fitted. */
export function flameStandoff(fuel: Fuel, o2Percent: number, diluents: Record<string, number>, B: number): number {
    const comp: Record<string, number> = { O2: o2Percent / 100, ...diluents };
    const m_mix = Object.entries(comp).reduce((s, [k, x]) => s + x * MW[k], 0);
    const Yo = comp.O2 * MW.O2 / m_mix;
    return Math.log(1 + B) / Math.log(1 + Yo / NU_O[fuel]);
}

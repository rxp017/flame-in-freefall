import rawTuples from './data/tuples.json';

export interface O2Reading {
    percent: number;
    regime: string;
    sourceColumn: string;
    note: string;
    approximate?: boolean;
    /** Present when the source records a range (e.g. '21.5 - 21.7'); percent is the leading value, used for matching only. */
    rangeLow?: number;
    rangeHigh?: number;
}
export interface DiluentReading {
    fractions: Record<string, number>;
    dominant: string;
    sourceColumns: Record<string, string>;
    note: string;
}
export interface PressureReading {
    value: number;
    unit: string; // 'mmHg' | 'bar' | 'atm'
    sourceColumn: string;
    approximate?: boolean;
}
export interface FlowReading {
    value: number;
    unit: string;
    sourceColumn: string;
    approximate?: boolean;
}
export interface OutcomeValue {
    value?: number;
    unit?: string;
    text?: string;
    approximate?: boolean;
    unitNote?: string;
}
export interface TestTuple {
    test?: string;
    label?: string;
    note?: string;
    fuel?: string;
    o2?: O2Reading;
    diluent?: DiluentReading;
    pressure?: PressureReading;
    flow?: FlowReading;
    outcomes?: Record<string, OutcomeValue>;
}
export interface TupleTable {
    investigationId: string;
    file: string;
    kind: 'observed-log' | 'planned-matrix' | 'publication-figure-index';
    tuples?: TestTuple[];
    observedRows?: number;
    matrixRows?: number;
    indexRows?: number;
    matrix?: {
        fuels: string[];
        o2MoleFractionOptions: number[];
        pressureAtmOptions: number[];
        flowCmsPlannedRange: string;
        dropletMmPlannedRange: string;
        note: string;
    };
    figures?: { dataId: string; description: string; publication: string; figureId: string }[];
    excludedRows?: { label: string; reason: string }[];
}
export interface TupleData {
    snapshotUtc: string;
    observedRows: number;
    plannedMatrixRows: number;
    publicationFigureIndexRows: number;
    unitResolutions: string[];
    tables: TupleTable[];
}

export const TUPLES = rawTuples as unknown as TupleData;

export function tableOf(invId: string, fileFragment?: string): TupleTable | undefined {
    return TUPLES.tables.find((t) => t.investigationId === invId && (!fileFragment || t.file.includes(fileFragment)));
}

/** FLEX (PSI-69) observed droplet-combustion tests, the only snapshot table with per-test measured outcomes. */
export function flexTests(fuel?: string): TestTuple[] {
    const t = tableOf('PSI-69');
    const rows = t?.tuples || [];
    return fuel ? rows.filter((r) => r.fuel === fuel) : rows;
}

/** Pressure normalized to atm for envelope comparison. Conversion labeled at display time. */
export function pressureAtm(p?: PressureReading): number | undefined {
    if (!p) return undefined;
    if (p.unit === 'atm') return p.value;
    if (p.unit === 'mmHg') return p.value / 760; // exact definition
    if (p.unit === 'bar') return p.value / 1.01325; // 1 atm = 1.01325 bar
    return undefined;
}

export function flexK(t: TestTuple): number | undefined {
    return t.outcomes?.burningRateConstantMm2s?.value;
}
export function flexExtinctionMm(t: TestTuple): number | undefined {
    return t.outcomes?.extinctionDiameterMm?.value;
}
export function flexBurnTimeS(t: TestTuple): number | undefined {
    return t.outcomes?.burnTimeS?.value;
}
export function flexTestEnd(t: TestTuple): string | undefined {
    return t.outcomes?.testEnd?.text;
}
export function flexDropletMm(t: TestTuple): number | undefined {
    return t.outcomes?.dropletInitialDiameterMm?.value;
}

/** Distance in O2 percent points from a candidate to the recorded value or range; 0 when inside a recorded range. */
export function o2Distance(o2: O2Reading | undefined, o2Pct: number): number | undefined {
    if (!o2) return undefined;
    const lo = o2.rangeLow ?? o2.percent;
    const hi = o2.rangeHigh ?? o2.percent;
    return o2Pct < lo ? lo - o2Pct : o2Pct > hi ? o2Pct - hi : 0;
}

/** O2 display that keeps ranges and approximate flags visible. */
export function o2Label(o2: O2Reading | undefined): string {
    if (!o2) return 'not recorded';
    if (o2.rangeLow !== undefined && o2.rangeHigh !== undefined) return `${o2.rangeLow}-${o2.rangeHigh}% O2 (approx)`;
    return `${o2.percent}% O2${o2.approximate ? ' (approx)' : ''}`;
}

/** Nearest observed FLEX test for a fuel to a target (O2 %, pressure atm), by scaled distance. */
export function nearestFlexTest(fuel: string, o2Pct: number, pAtm: number): { test: TestTuple; distance: number } | undefined {
    let best: { test: TestTuple; distance: number } | undefined;
    for (const t of flexTests(fuel)) {
        const o2 = t.o2?.percent;
        const p = pressureAtm(t.pressure);
        const k = flexK(t);
        if (o2 === undefined || p === undefined || k === undefined) continue;
        // scale: 1 O2 percent point ~ 0.1 atm, so both axes weigh comparably inside the tested envelope
        const d = Math.hypot(o2 - o2Pct, (p - pAtm) * 10);
        if (!best || d < best.distance) best = { test: t, distance: d };
    }
    return best;
}

/** Observed O2/pressure envelope for a FLEX fuel. */
export function flexEnvelope(fuel: string): { o2: [number, number]; p: [number, number] } | undefined {
    const o2s: number[] = [];
    const ps: number[] = [];
    for (const t of flexTests(fuel)) {
        if (t.o2?.percent !== undefined) o2s.push(t.o2.percent);
        const p = pressureAtm(t.pressure);
        if (p !== undefined) ps.push(p);
    }
    if (!o2s.length || !ps.length) return undefined;
    return { o2: [Math.min(...o2s), Math.max(...o2s)], p: [Math.min(...ps), Math.max(...ps)] };
}

/** All observed tuples across tables that carry both an O2 reading and a pressure reading. */
export function observedConditionTuples(): (TestTuple & { inv: string; file: string })[] {
    const out: (TestTuple & { inv: string; file: string })[] = [];
    for (const tb of TUPLES.tables) {
        if (tb.kind !== 'observed-log' || !tb.tuples) continue;
        for (const t of tb.tuples) {
            out.push({ ...t, inv: tb.investigationId, file: tb.file });
        }
    }
    return out;
}

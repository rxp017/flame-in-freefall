// Data model, transparent scoring and extractive retrieval for the
// Flame in Freefall dashboard. All content derives from NASA PSI records
// harvested 2026-11-14; see data provenance in the closing notes.

export interface O2Detail {
    column: string;
    regime: string; // 'chamber / ambient atmosphere' or 'oxidizer stream to burner'
    range: [number, number];
    note: string;
}

export interface ExpTable {
    file: string;
    rows: number;
    columns: string[];
    fuels?: string[];
    o2?: O2Detail[];
    flowCmsRange?: [number, number];
    flowColumns?: string[];
    pressureColumns?: string[];
    pressureRange?: Record<string, [number, number]>;
}

export interface Investigation {
    id: string;
    acronym: string;
    title: string;
    type: string;
    subArea: string;
    platform: string;
    hardware: string;
    hardwareLink: string;
    start: string;
    end: string;
    doi: string;
    license: string;
    psiUrl: string;
    objective: string;
    approach: string;
    hypothesis: string;
    impacts: string;
    contacts: { name: string; affiliation: string }[];
    publications: { title: string; authors: string; doi: string }[];
    relatedIds: string[];
    fileStats: { count: number; bytes: number; byExt: Record<string, number> };
    tables: ExpTable[];
    group: string;
    safetyFunctions: string[];
    fuelClasses: string[];
    briefMentioned: boolean;
    summary: string;
    habitatRelevance: string;
    earthRelevance: string;
}

export interface CorpusChunk {
    inv: string;
    acro: string;
    field: string;
    text: string;
    url: string;
}

export interface Dataset {
    snapshotUtc: string;
    count: number;
    groups: Record<string, string[]>;
    investigations: Investigation[];
}

export function slug(id: string): string {
    return id.toLowerCase();
}

export function fmtBytes(bytes: number): string {
    if (bytes >= 1e12) return `${(bytes / 1e12).toFixed(1)} TB`;
    if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
    if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(0)} MB`;
    if (bytes >= 1e3) return `${(bytes / 1e3).toFixed(0)} KB`;
    return `${bytes} B`;
}

export function fuelSimple(inv: Investigation): string {
    const s = inv.fuelClasses.join(' ').toLowerCase();
    if (s.includes('solid')) return 'Solids';
    if (s.includes('liquid')) return 'Liquids';
    if (s.includes('gaseous')) return 'Gases';
    if (s.includes('aerosol') || s.includes('smoke') || s.includes('dust')) return 'Aerosols';
    return 'Other';
}

export function safetyLabel(fn: string): string {
    return fn.charAt(0).toUpperCase() + fn.slice(1);
}

// ---- Transparent ranking ----
// Criteria marked 'PSI record' are computed from harvested PSI fields; criteria marked
// 'team judgment' score AI-authored annotations (safety-role tags, brief flags). Weights are
// user-adjustable in the page; defaults below. Scores are 0-100.

export interface ScoreParts {
    safety: number;
    brief: number;
    measured: number;
    oxygen: number | null; // null when no chamber/ambient oxygen data: criterion excluded, weights renormalize
    depth: number;
}

export const CRITERIA: { key: keyof ScoreParts; label: string; describe: string; def: number; origin: string }[] = [
    { key: 'safety', label: 'Direct safety function', describe: 'Maps to prevention, detection or suppression (the brief\'s three fire-safety pillars) rather than fundamental science alone.', def: 30, origin: 'team judgment' },
    { key: 'brief', label: 'Brief emphasis', describe: 'Named or clearly referenced in the Flame in Freefall challenge brief.', def: 15, origin: 'team judgment' },
    { key: 'measured', label: 'Measured test conditions', describe: 'Has downloadable experimental-conditions tables; scales with recorded test runs.', def: 20, origin: 'PSI record' },
    { key: 'oxygen', label: 'High-oxygen relevance', describe: 'Highest oxygen recorded in a chamber or ambient atmosphere, against the roughly 30% Moon-base plan. Investigations with only oxidizer-stream measurements are not scored on this criterion.', def: 20, origin: 'PSI record' },
    { key: 'depth', label: 'Data and publication depth', describe: 'Volume of archived data files and linked publications.', def: 15, origin: 'PSI record' },
];

export function scoreParts(inv: Investigation): ScoreParts {
    const direct = inv.safetyFunctions.filter((f) => f !== 'fundamental').length;
    const safety = direct > 0 ? Math.min(100, 20 + 40 * direct) : 20;
    const brief = inv.briefMentioned ? 100 : 40;
    const runs = inv.tables.reduce((a, t) => a + t.rows, 0);
    const measured = inv.tables.length ? Math.min(100, 25 + Math.round(75 * Math.min(1, runs / 200))) : 0;
    const chamberMax = Math.max(
        0,
        ...inv.tables.flatMap((t) => (t.o2 || []).filter((d) => d.regime.startsWith('chamber')).map((d) => d.range[1])),
    );
    // Only chamber / ambient measurements count: an oxidizer stream fed to a burner says
    // nothing about a habitat atmosphere. Stream-only investigations are not scored here.
    const oxygen = chamberMax > 0 ? (chamberMax >= 30 ? 100 : chamberMax >= 21 ? 60 : 40) : null;
    const bytes = inv.fileStats.bytes;
    const depth = Math.min(
        100,
        (bytes > 1e9 ? 50 : bytes > 1e6 ? 30 : inv.fileStats.count > 0 ? 15 : 0) +
            Math.min(50, inv.publications.length * 5),
    );
    return { safety, brief, measured, oxygen, depth };
}

export function weightedScore(parts: ScoreParts, weights: Record<keyof ScoreParts, number>): number {
    let num = 0;
    let den = 0;
    for (const c of CRITERIA) {
        const part = parts[c.key];
        if (part === null || part === undefined) continue; // not applicable: excluded, weights renormalize
        num += weights[c.key] * part;
        den += weights[c.key];
    }
    return den ? Math.round(num / den) : 0;
}

// ---- Extractive retrieval over NASA source passages (no generative text) ----

const STOP = new Set(
    'the a an and or of to in for on with by is are was were be been it its this that these those from as at how what which why when where who whom did do does can could should would'.split(' '),
);

function tokens(text: string): string[] {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9%/\s-]/g, ' ')
        .split(/\s+/)
        .filter((t) => t.length > 2 && !STOP.has(t));
}

export interface Hit {
    chunk: CorpusChunk;
    score: number;
}

export function searchCorpus(corpus: CorpusChunk[], query: string, limit = 5): Hit[] {
    const q = tokens(query);
    if (!q.length) return [];
    // document frequency for idf
    const df: Record<string, number> = {};
    const chunkTokens = corpus.map((c) => tokens(`${c.acro} ${c.inv} ${c.field} ${c.text}`));
    for (const toks of chunkTokens) {
        const seen = new Set(toks);
        for (const t of seen) df[t] = (df[t] || 0) + 1;
    }
    const N = corpus.length;
    const hits: Hit[] = [];
    chunkTokens.forEach((toks, i) => {
        let score = 0;
        const counts: Record<string, number> = {};
        for (const t of toks) counts[t] = (counts[t] || 0) + 1;
        for (const t of q) {
            if (!counts[t]) continue;
            const idf = Math.log(1 + (N - (df[t] || 0) + 0.5) / ((df[t] || 0) + 0.5));
            const tf = counts[t] / (1 + toks.length / 300);
            score += idf * tf;
        }
        if (score > 0) hits.push({ chunk: corpus[i], score });
    });
    return hits.sort((a, b) => b.score - a.score).slice(0, limit);
}

export function excerpt(text: string, query: string, len = 260): string {
    const q = tokens(query);
    const lower = text.toLowerCase();
    let at = -1;
    for (const t of q) {
        const i = lower.indexOf(t);
        if (i >= 0 && (at < 0 || i < at)) at = i;
    }
    if (at < 0) return text.slice(0, len) + (text.length > len ? '…' : '');
    const start = Math.max(0, at - 60);
    const out = (start > 0 ? '…' : '') + text.slice(start, start + len);
    return out + (start + len < text.length ? '…' : '');
}

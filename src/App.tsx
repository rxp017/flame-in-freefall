import React, { useMemo, useState } from 'react';
import {
    BarChart, Bullets, ButtonLink, Callout, Caption, ChoiceRow, Closing, Facts, FileCard, Group,
    Heading, KeySentence, Link, NavLink, NumberedList, Paragraph, Photos, RangeChart, Route, Routes,
    Row, Rows, Slider, Table, Text, TextField, TextLink,
} from './kit';
import rawData from './data/investigations.json';
import rawCorpus from './data/corpus.json';
import { Hero } from './hero';
import { Story } from './story';
import { Simulate } from './simulate';
import { Check } from './check';
import { TUPLES } from './tuples';
import {
    CorpusChunk, CRITERIA, Dataset, Investigation, ScoreParts, excerpt, fmtBytes, fuelSimple,
    safetyLabel, scoreParts, searchCorpus, slug, weightedScore,
} from './model';
import heroFlame from './photos/iss040e086481.jpg';
import sphereFlame from './photos/iss040e072900.jpg';
import gloveboxOps from './photos/iss040e021546.jpg';
import acmeChamber from './photos/GRC-2016-C-05051.jpg';

const DATA = rawData as unknown as Dataset;
const CORPUS = rawCorpus as unknown as CorpusChunk[];
const INVS = DATA.investigations;
const BY_ID: Record<string, Investigation> = Object.fromEntries(INVS.map((i) => [i.id, i]));

const PHOTOS = [
    { src: heroFlame, alt: 'A blue flame spreading over a solid fuel sample during the BASS-II investigation on the ISS.' },
    { src: sphereFlame, alt: 'A rounded blue and orange flame in microgravity during BASS-II.' },
    { src: gloveboxOps, alt: 'An astronaut working at the Microgravity Science Glovebox on the ISS.' },
    { src: acmeChamber, alt: 'An engineer inside the ACME combustion chamber hardware.' },
];

const DEFAULT_WEIGHTS: Record<keyof ScoreParts, number> = Object.fromEntries(
    CRITERIA.map((c) => [c.key, c.def]),
) as Record<keyof ScoreParts, number>;

const SAFETY_OPTIONS = [
    { value: 'all', label: 'All roles' },
    { value: 'prevention', label: 'Prevention' },
    { value: 'detection', label: 'Detection' },
    { value: 'suppression', label: 'Suppression' },
    { value: 'fundamental', label: 'Fundamental' },
];

const FUEL_OPTIONS = [
    { value: 'all', label: 'All fuels' },
    { value: 'Solids', label: 'Solids' },
    { value: 'Liquids', label: 'Liquids' },
    { value: 'Gases', label: 'Gases' },
    { value: 'Aerosols', label: 'Aerosols' },
];

function totalRuns(): number {
    return INVS.reduce((a, i) => a + i.tables.reduce((b, t) => b + t.rows, 0), 0);
}

function totalBytes(): number {
    return INVS.reduce((a, i) => a + i.fileStats.bytes, 0);
}

function totalPubs(): number {
    return INVS.reduce((a, i) => a + i.publications.length, 0);
}

function uniquePubs(): number {
    const titles = new Set<string>();
    for (const inv of INVS) {
        for (const p of inv.publications) {
            titles.add((p.title || '').trim().toLowerCase());
        }
    }
    return titles.size;
}

function invName(inv: Investigation): string {
    return inv.acronym ? `${inv.acronym}` : inv.id;
}

function invDetail(inv: Investigation): string {
    const bits = [inv.type.replace(' Investigation', ''), inv.group].filter(Boolean);
    return bits.join(' · ');
}

function conditionsCsv(): string {
    const q = (s: unknown) => '"' + String(s).replace(/"/g, '""') + '"';
    const rows = [['investigation_id', 'acronym', 'table_file', 'measurement', 'source_column', 'regime', 'min', 'max', 'unit', 'note', 'source_url'].map(q).join(',')];
    for (const inv of INVS) {
        for (const t of inv.tables) {
            for (const d of t.o2 || []) {
                rows.push([inv.id, inv.acronym, t.file, 'oxygen', d.column, d.regime, d.range[0], d.range[1], 'percent O2 by volume', d.note, inv.psiUrl].map(q).join(','));
            }
            if (t.flowCmsRange) {
                rows.push([inv.id, inv.acronym, t.file, 'airflow', (t.flowColumns || []).join('; '), '', t.flowCmsRange[0], t.flowCmsRange[1], 'cm/s', 'as recorded', inv.psiUrl].map(q).join(','));
            }
            for (const [u, r] of Object.entries(t.pressureRange || {})) {
                rows.push([inv.id, inv.acronym, t.file, 'pressure', (t.pressureColumns || []).join('; '), '', r[0], r[1], u, 'as recorded', inv.psiUrl].map(q).join(','));
            }
        }
    }
    const header = '# Source: NASA Physical Sciences Informatics (psi.nasa.gov), snapshot ' + DATA.snapshotUtc + ', CC0.\n'
        + '# Normalized by team RXP for the 2026 NASA Space Apps Challenge. Ranges are endpoint min/max of recorded runs, not continuous coverage.\n';
    return header + rows.join('\n');
}

function Overview() {
    const micro = INVS.filter((i) => i.type === 'Microgravity Investigation').length;
    const csvUrl = useMemo(() => URL.createObjectURL(new Blob([conditionsCsv()], { type: 'text/csv' })), []);
    const jsonUrl = useMemo(() => URL.createObjectURL(new Blob([JSON.stringify({
        source: 'NASA Physical Sciences Informatics (psi.nasa.gov)',
        license: 'CC0',
        snapshotUtc: DATA.snapshotUtc,
        note: 'Normalized by team RXP for the 2026 NASA Space Apps Challenge. Ranges are endpoint min/max of recorded runs; regime labels distinguish chamber/ambient atmosphere from oxidizer stream to a burner.',
        investigations: INVS,
    }, null, 1)], { type: 'application/json' })), []);
    const groupCounts = Object.entries(DATA.groups)
        .map(([g, members]) => ({ label: g, value: members.length }))
        .sort((a, b) => b.value - a.value);
    return <>
        <Group label="The idea" heading="Decades of NASA fire research, made explorable">
            <Paragraph>
                NASA's Physical Sciences Informatics (PSI) repository holds {DATA.count} combustion science
                investigations, from fabric burned in a glovebox to full-scale fires set inside cargo ships.
                This dashboard summarizes, ranks and interprets them so the findings can inform fire safety
                for the Moon and Mars missions now being designed.
            </Paragraph>
            <Photos label="NASA combustion research" title="NASA combustion research" items={PHOTOS} layout="strip" />
            <Caption>Photos: NASA (iss040e086481, iss040e072900, iss040e021546, GRC-2016-C-05051).</Caption>
        </Group>
        <Group label="What is inside" heading>
            <Facts items={[
                { label: 'Combustion investigations', value: `${DATA.count} of 133 in PSI` },
                { label: 'Flown in microgravity', value: `${micro}` },
                { label: 'Rows in published conditions tables', value: `${TUPLES.observedRows.toLocaleString()} observed + ${TUPLES.plannedMatrixRows} planned-matrix + ${TUPLES.publicationFigureIndexRows} publication-figure-index` },
                { label: 'Archived volume reported by PSI', value: fmtBytes(totalBytes()) },
                { label: 'Publication links across investigations', value: `${totalPubs()} (${uniquePubs()} unique titles)` },
                { label: 'Data snapshot', value: DATA.snapshotUtc },
            ]} />
            <BarChart label="Investigations by project family" data={groupCounts} />
            <BarChart label="Recorded test runs by project family" data={Object.entries(DATA.groups).map(([g, members]) => ({
                label: g,
                value: members.reduce((a, id) => a + (BY_ID[id] ? BY_ID[id].tables.reduce((b, t) => b + t.rows, 0) : 0), 0),
            })).sort((a, b) => b.value - a.value)} />
        </Group>
        <Group label="How to use it" heading>
            <NumberedList items={[
                'Explore the catalog and open any investigation for its objectives, fuels, measured test conditions, sensors, data files and publications.',
                'Rank investigations by what matters to your mission question - every score shows its working.',
                'Compare investigations within a project family, side by side.',
                'Read the fire-safety insights for Moon and Mars habitats, including the oxygen problem and the partial-gravity data gap.',
                'Ask in plain words and get quoted NASA source passages with links - extractive search, not generated answers.',
            ]} />
        </Group>
        <Group label="Ground rules" heading>
            <Callout title="How AI was used" tone="note">
                This dashboard was built with AI assistance: code, structured data
                extraction and the summaries marked "AI-assisted" were drafted by a large language model from
                NASA's public PSI records and checked against those sources. Rankings are computed transparently
                from the data. Ask results are labeled as verbatim NASA record passages or AI-authored annotations. Nothing here is a validated fire-safety
                recommendation; it organizes the published science so people can judge it.
            </Callout>
            <Callout title="No partial-gravity data in this PSI snapshot" tone="warning">
                This PSI snapshot holds no combustion data measured at lunar or Martian gravity. NASA expects the
                LUCI and FM2 experiments to add it. Until then, microgravity and normal-gravity results can only
                bound what happens in between - treat Moon-base conclusions as informed estimates, not measurements.
            </Callout>
        </Group>
        <Group label="Reproducibility" heading="How this data was built, and how to check it">
            <NumberedList items={[
                'Harvest: a script (harvest.py) pulled every PSI investigation with Research Area "combustion science" from the public PSI API and downloaded the published experimental-conditions tables, snapshot 2026-11-14T05:05Z.',
                'Normalize: a deterministic script (normalize.py) extracted fuels, oxygen, airflow and pressure ranges with explicit unit rules - mole fractions converted to percent and labeled; flow-rate and post-burn columns excluded; unknowns kept as "not recorded".',
                'Annotate: a curated file (annotations.py) holds the team-authored fields - safety-role tags, brief-emphasis flags, AI-assisted summaries and habitat-relevance notes - kept separate from the NASA record so data and judgment never mix.',
                'Verify: every investigation links back to its live NASA PSI record, and the Ask tab quotes or labels the exact source text.',
            ]} />
            <Paragraph>
                Exports for predictive modeling: the full normalized dataset and the extracted test-conditions table,
                both citing PSI as the source with per-record URLs, units and regime labels.
            </Paragraph>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <a href={jsonUrl} download="flame-in-freefall-investigations.json" style={{ color: '#4a7a6d', fontWeight: 600 }}>Download the normalized dataset (JSON)</a>
                <a href={csvUrl} download="flame-in-freefall-conditions.csv" style={{ color: '#4a7a6d', fontWeight: 600 }}>Download the extracted test conditions (CSV)</a>
            </div>
        </Group>
    </>;
}

function Explore() {
    const [q, setQ] = useState('');
    const [safety, setSafety] = useState('all');
    const [fuel, setFuel] = useState('all');
    const shown = INVS.filter((inv) => {
        if (safety !== 'all' && !inv.safetyFunctions.includes(safety)) return false;
        if (fuel !== 'all' && fuelSimple(inv) !== fuel) return false;
        if (q.trim()) {
            const hay = `${inv.id} ${inv.acronym} ${inv.title} ${inv.group} ${inv.summary} ${inv.fuelClasses.join(' ')}`.toLowerCase();
            if (!q.toLowerCase().split(/\s+/).every((w) => hay.includes(w))) return false;
        }
        return true;
    });
    return <>
        <Group label="Catalog" heading="Explore the investigations">
            <TextField label="Search titles, fuels, acronyms" value={q} onChange={setQ} />
            <ChoiceRow label="Fire-safety role" options={SAFETY_OPTIONS} value={safety} onChange={setSafety} />
            <ChoiceRow label="Fuel class" options={FUEL_OPTIONS} value={fuel} onChange={setFuel} />
            {!shown.length && <Paragraph>No investigations match those filters.</Paragraph>}
            <Rows numbered>
                {shown.map((inv) => (
                    <Link key={inv.id} to={`/inv/${slug(inv.id)}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                        <Row name={invName(inv)} detail={`${invDetail(inv)} · ${inv.title}`}
                            value={inv.briefMentioned ? 'In brief' : ''} valueKnown={inv.briefMentioned} />
                    </Link>
                ))}
            </Rows>
            <Caption>{shown.length} of {INVS.length} investigations. "In brief" marks investigations the challenge brief calls out.</Caption>
        </Group>
    </>;
}

function Conditions({ inv }: { inv: Investigation }) {
    if (!inv.tables.length) {
        return <Callout title="No conditions table published" tone="note">
            This investigation has not published an experimental-conditions table in PSI; conditions are described in its
            approach text and final report. Unknown is shown as unknown here, never guessed.
        </Callout>;
    }
    return <>
        {inv.tables.map((t) => (
            <Group key={t.file} label={`Measured test conditions · ${t.rows} runs`}>
                <Facts items={[
                    { label: 'Source table', value: t.file },
                    ...(t.fuels?.length ? [{ label: 'Fuels / materials', value: t.fuels.slice(0, 8).join('; ') }] : []),
                    ...(t.o2 || []).map((d) => ({ label: `Oxygen (${d.regime})`, value: `${d.range[0]}-${d.range[1]}% (${d.column}; ${d.note})` })),
                    ...(t.flowCmsRange ? [{ label: 'Airflow', value: `${t.flowCmsRange[0]}-${t.flowCmsRange[1]} cm/s` }] : []),
                    ...(t.pressureRange ? Object.entries(t.pressureRange).map(([u, r]) => ({ label: `Pressure (${u})`, value: `${r[0]}-${r[1]}` })) : []),
                ]} />
                <Caption>Recorded variables: {t.columns.join(', ')}.</Caption>
            </Group>
        ))}
    </>;
}

function InvestigationView({ inv }: { inv: Investigation }) {
    const related = inv.relatedIds.filter((id) => BY_ID[id]);
    const parts = scoreParts(inv);
    return <>
        <Group label={`${inv.id} · ${inv.group}`} heading={inv.acronym ? `${inv.acronym}: ${inv.title}` : inv.title}>
            <Facts items={[
                { label: 'Project type', value: inv.type },
                ...(inv.platform ? [{ label: 'Platform', value: inv.platform }] : []),
                ...(inv.hardware ? [{ label: 'Hardware', value: inv.hardware }] : []),
                ...(inv.start ? [{ label: 'Period', value: `${inv.start} to ${inv.end || 'ongoing'}` }] : []),
                { label: 'Fire-safety role', value: inv.safetyFunctions.map(safetyLabel).join(', ') },
                { label: 'License', value: inv.license || 'See PSI record' },
            ]} />
            <ButtonLink href={inv.psiUrl}>Open the NASA PSI record</ButtonLink>
        </Group>
        <Group label="AI-assisted summary" heading>
            <Paragraph>{inv.summary}</Paragraph>
            <KeySentence>{inv.habitatRelevance}</KeySentence>
            {inv.earthRelevance ? <Paragraph>{inv.earthRelevance}</Paragraph> : null}
            <Caption>Drafted by AI from the PSI record below and checked against it. Judge it against the source text.</Caption>
        </Group>
        <Conditions inv={inv} />
        <Group label="From the NASA record" heading>
            <Text>
                {inv.objective ? <><Heading sub="NASA PSI">Objectives</Heading><Paragraph>{inv.objective}</Paragraph></> : null}
                {inv.approach ? <><Heading sub="NASA PSI">Approach</Heading><Paragraph>{inv.approach}</Paragraph></> : null}
                {inv.hypothesis ? <><Heading sub="NASA PSI">Hypothesis</Heading><Paragraph>{inv.hypothesis}</Paragraph></> : null}
                {inv.impacts ? <><Heading sub="NASA PSI">Research impacts and Earth benefits</Heading><Paragraph>{inv.impacts}</Paragraph></> : null}
            </Text>
        </Group>
        <Group label="How this investigation scores" heading>
            <Facts items={CRITERIA.map((c) => ({
                label: c.label + ' (' + c.origin + ')',
                value: parts[c.key] === null ? 'Not scored: no chamber-atmosphere oxygen data' : parts[c.key] + ' of 100',
            }))} />
            <Caption>These combine into the Rank tab's weighted average under weights you can change there. PSI-record criteria compute from harvested NASA fields; team-judgment criteria score our authored annotations, never the other way round.</Caption>
        </Group>
        <Group label="Data and publications" heading>
            <Facts items={[
                { label: 'Archived data', value: inv.fileStats.count === 0 && inv.fileStats.bytes > 0 ? `${fmtBytes(inv.fileStats.bytes)} reported; file listing not available via the PSI API` : `${inv.fileStats.count} files (${fmtBytes(inv.fileStats.bytes)})` },
                ...(inv.doi ? [{ label: 'Dataset DOI', value: inv.doi }] : []),
                ...(inv.contacts.length ? [{ label: 'Researchers', value: inv.contacts.map((c) => c.name).join(', ') }] : []),
            ]} />
            {Object.keys(inv.fileStats.byExt).length > 1 && (
                <BarChart label="Archived files by type" data={Object.entries(inv.fileStats.byExt).slice(0, 8).map(([ext, n]) => ({ label: `.${ext}`, value: n }))} />
            )}
            {inv.publications.length ? <Rows>
                {inv.publications.slice(0, 12).map((p) => (
                    <Row key={p.title} name={p.title} detail={p.authors}
                        value={p.doi ? 'DOI' : ''} valueKnown={Boolean(p.doi)} />
                ))}
            </Rows> : <Paragraph>No publications linked in the PSI record.</Paragraph>}
            {inv.publications.some((p) => p.doi) && (
                <Caption>DOIs: {inv.publications.filter((p) => p.doi).slice(0, 12).map((p) => p.doi).join(' · ')}</Caption>
            )}
        </Group>
        {related.length ? (
            <Group label="Related investigations">
                <Rows>
                    {related.map((id) => (
                        <Link key={id} to={`/inv/${slug(id)}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                            <Row name={invName(BY_ID[id])} detail={BY_ID[id].title} />
                        </Link>
                    ))}
                </Rows>
            </Group>
        ) : null}
    </>;
}

function Rank() {
    const [weights, setWeights] = useState<Record<keyof ScoreParts, number>>(DEFAULT_WEIGHTS);
    const ranked = useMemo(() => INVS.map((inv) => {
        const parts = scoreParts(inv);
        return { inv, parts, total: weightedScore(parts, weights) };
    }).sort((a, b) => b.total - a.total), [weights]);
    return <>
        <Group label="Transparent ranking" heading="Rank by what your mission needs">
            <Paragraph>
                Scores combine facts from the PSI record with a rubric our team authored: the safety-role tags, the
                brief-emphasis flags, and the formulas that turn raw measures into 0-100 criterion scores are our
                judgments, labeled as such. Set the weights, then open any investigation to see the facts behind its
                placement. Defaults weight the Moon-base oxygen problem and measured conditions highest.
            </Paragraph>
            {CRITERIA.map((c) => (
                <Slider key={c.key} label={c.label} min={0} max={50} value={weights[c.key]}
                    onChange={(v: number) => setWeights({ ...weights, [c.key]: v })}
                    describe={(v: number) => `weight ${v}`} />
            ))}
            <Rows>
                {ranked.map(({ inv, total }, idx) => (
                    <Link key={inv.id} to={`/inv/${slug(inv.id)}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                        <Row number={idx + 1} name={invName(inv)} detail={invDetail(inv)} value={`${total}`} valueKnown />
                    </Link>
                ))}
            </Rows>
        </Group>
        <Group label="How the scoring works" heading>
            <Bullets items={CRITERIA.map((c) => `${c.label}: ${c.describe}`)} />
            <Bullets items={[
                'From the NASA record: run counts, oxygen and airflow ranges, fuels, archived data volume, publication counts.',
                'Team-authored judgment: which investigations count as prevention, detection or suppression; which the challenge brief emphasizes; the 0-100 scoring formulas; the default weights.',
            ]} />
            <Caption>Scores are 0-100 per criterion, combined as a weighted average. They rank relevance to crewed-habitat
                fire safety under our rubric; they are not a measure of scientific quality and not a NASA endorsement.
                Change the weights and the ranking changes - that is the point.</Caption>
        </Group>
    </>;
}

function familyTable(title: string, ids: string[], caption: string) {
    const invs = ids.map((id) => BY_ID[id]);
    const o2 = (inv: Investigation) => {
        const ds = inv.tables.flatMap((t) => (t.o2 || []));
        if (!ds.length) return 'Not recorded in tables';
        return ds.map((d) => `${d.range[0]}-${d.range[1]}% ${d.regime.startsWith('chamber') ? '(chamber)' : '(stream)'}`).join('; ');
    };
    const flow = (inv: Investigation) => {
        const ranges = inv.tables.filter((t) => t.flowCmsRange).map((t) => t.flowCmsRange!);
        if (!ranges.length) return 'Not recorded in tables';
        const lo = Math.min(...ranges.map((r) => r[0]));
        const hi = Math.max(...ranges.map((r) => r[1]));
        return `${lo}-${hi} cm/s`;
    };
    const fuels = (inv: Investigation) => {
        const f = [...new Set(inv.tables.flatMap((t) => t.fuels || []))];
        return f.length ? f.slice(0, 4).join('; ') : inv.fuelClasses.join('; ') || 'See record';
    };
    const runs = (inv: Investigation) => `${inv.tables.reduce((a, t) => a + t.rows, 0)}`;
    return <Group label={title} heading>
        <Table
            caption={caption}
            options={invs.map((inv, i) => ({ number: i + 1, name: invName(inv) }))}
            rows={[
                { label: 'Fire-safety role', values: invs.map((inv) => inv.safetyFunctions.map(safetyLabel).join(', ')) },
                { label: 'Hardware', values: invs.map((inv) => inv.hardware || 'Ground / lab') },
                { label: 'Fuels / materials', values: invs.map(fuels) },
                { label: 'Oxygen tested', values: invs.map(o2) },
                { label: 'Airflow tested', values: invs.map(flow) },
                { label: 'Recorded runs', values: invs.map(runs) },
                { label: 'Archived data', values: invs.map((inv) => fmtBytes(inv.fileStats.bytes)) },
                { label: 'Publications', values: invs.map((inv) => `${inv.publications.length}`) },
            ]}
        />
        <Rows>
            {invs.map((inv) => (
                <Link key={inv.id} to={`/inv/${slug(inv.id)}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                    <Row name={invName(inv)} detail={inv.title} />
                </Link>
            ))}
        </Rows>
    </Group>;
}

function Compare() {
    const [custom, setCustom] = useState('');
    const tokens = custom.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
    const matches = tokens.map((tok) => INVS.find((inv) =>
        inv.id.toLowerCase() === tok || inv.id.toLowerCase() === `psi-${tok}` ||
        invName(inv).toLowerCase() === tok ||
        (inv.acronym || '').toLowerCase() === tok)).filter((inv): inv is Investigation => !!inv);
    const unique = [...new Map(matches.map((inv) => [inv.id, inv])).values()].slice(0, 4);
    return <>
        <Group label="Compare your way" heading="Pick any investigations to compare">
            <Paragraph>
                Type two to four acronyms or PSI ids, separated by commas - for example FLEX-2, SAFFIRE-I, PSI-159.
                The table updates as you type, using each investigation's measured conditions where PSI publishes
                them.
            </Paragraph>
            <TextField label="Acronyms or PSI ids, comma separated" value={custom} onChange={setCustom} />
            {custom.trim().length > 0 && unique.length < 2 && (
                <Paragraph>Keep going - a comparison needs at least two matches. Acronyms: ACME BRE, ACME CFI-G,
                    BASS, BASS-II, CFI, DAFT, FLEX, FLEX-2, SAME, SAME-R, SAFFIRE-I, SAFFIRE-II, SAFFIRE-III,
                    SPICE, SLICE.</Paragraph>
            )}
            {unique.length >= 2 && familyTable(`Your selection (${unique.length})`, unique.map((inv) => inv.id),
                'Custom comparison from your selection.')}
        </Group>
        {familyTable('BASS vs BASS-II', ['PSI-26', 'PSI-25'],
            'Solid-fuel flammability and suppression in the Microgravity Science Glovebox.')}
        {familyTable('Saffire I, II and III', ['PSI-98', 'PSI-99', 'PSI-100'],
            'Full-scale fires in uncrewed Cygnus cargo vehicles after departure from the ISS.')}
        {familyTable('FLEX vs FLEX-2', ['PSI-69', 'PSI-68'],
            'Droplet combustion and gaseous fire suppression in the Combustion Integrated Rack.')}
        {familyTable('SAME vs SAME-R', ['PSI-102', 'PSI-101'],
            'Smoke and aerosol particle sizing for spacecraft fire detection.')}
        <Caption>Similarities and differences use each investigation's measured conditions where PSI publishes them;
            "not recorded" is shown rather than estimated.</Caption>
    </>;
}

const chamberMax = (inv: Investigation) => Math.max(0, ...inv.tables.flatMap((t) => (t.o2 || []).filter((d) => d.regime.startsWith('chamber')).map((d) => d.range[1])));

function Insights() {
    const highO2 = INVS.filter((inv) => chamberMax(inv) >= 30);
    const byFn = (fn: string) => INVS.filter((inv) => inv.safetyFunctions.includes(fn));
    return <>
        <Group label="Why it matters" heading="Fire is different in free fall">
            <Paragraph>
                Without buoyancy there are no rising hot gases: a teardrop candle flame becomes a blue sphere fed
                only by diffusion. Materials, flames and smoke all behave differently, and the stakes are extreme -
                Apollo 1, the Apollo 13 oxygen-tank explosion and the 1997 Mir fire all show what fire does to a crew
                far from home.
            </Paragraph>
        </Group>
        <Group label="The Moon-base oxygen problem" heading>
            <KeySentence>
                Planned Moon bases and pressurized rovers are expected to run at 30% or more oxygen at 10.2 psi or less -
                more than a 40% increase in oxygen concentration over Earth air, making materials much more flammable.
            </KeySentence>
            <Paragraph>
                Most PSI testing happened near Earth-air oxygen levels. The exceptions matter most for lunar design:
            </Paragraph>
            <Rows>
                {highO2.map((inv) => {
                    const hi = chamberMax(inv);
                    return (
                        <Link key={inv.id} to={`/inv/${slug(inv.id)}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                            <Row name={invName(inv)} detail={inv.title} value={`up to ${hi}% O2 (chamber)`} valueKnown />
                        </Link>
                    );
                })}
            </Rows>
            <Callout title="How to read these numbers">
                Each range is the endpoint min and max of discrete recorded runs in that investigation's published experimental-conditions table, in the table's own units (mole fractions converted to percent and labeled as such). Rigs differ: BASS-II, Saffire, CFI and FLEX record the chamber or ambient atmosphere; ACME normal-flame tables record the chamber oxidizer, and only ACME inverse-flame tables record the oxygen fraction of the oxidizer stream fed to the burner. A range does not mean every value between its endpoints was tested. A run at or above 30% O2 is not evidence about Moon-base conditions, which also differ in pressure, gravity and ventilation, and no PSI combustion investigation has tested partial gravity.
            </Callout>
            <Table
                caption="Recorded oxygen conditions, with the exact source column from each published experimental-conditions table"
                options={[{ number: 1, name: 'O2 endpoints recorded (%)' }, { number: 2, name: 'Source column and what it measures' }, { number: 3, name: 'Any run at or above 30%' }]}
                rows={INVS.filter((inv) => inv.tables.some((t) => t.o2 && t.o2.length)).flatMap((inv) => {
                    const details = inv.tables.flatMap((t) => (t.o2 || []));
                    const byRegime = new Map<string, typeof details>();
                    details.forEach((d) => byRegime.set(d.regime, [...(byRegime.get(d.regime) || []), d]));
                    return [...byRegime.entries()].map(([regime, ds]) => {
                        const lo = Math.min(...ds.map((d) => d.range[0]));
                        const hi = Math.max(...ds.map((d) => d.range[1]));
                        const src = ds.map((d) => d.column).join('; ');
                        const short = regime.startsWith('chamber') ? 'chamber / ambient' : 'oxidizer stream';
                        return { label: `${invName(inv)} (${short})`, values: [`${lo} to ${hi}`, `${src} - ${regime}`, hi >= 30 ? 'yes' : 'no'] };
                    });
                })}
            />
            <RangeChart
                label="Recorded oxygen endpoints vs the 30% Moon-base plan threshold"
                legend="lowest recorded · midpoint of endpoints · highest recorded"
                rows={INVS.filter((inv) => inv.tables.some((t) => t.o2 && t.o2.length)).flatMap((inv) => {
                    const details = inv.tables.flatMap((t) => (t.o2 || []));
                    const byRegime = new Map<string, typeof details>();
                    details.forEach((d) => byRegime.set(d.regime, [...(byRegime.get(d.regime) || []), d]));
                    return [...byRegime.entries()].map(([regime, ds]) => {
                        const lo = Math.min(...ds.map((d) => d.range[0]));
                        const hi = Math.max(...ds.map((d) => d.range[1]));
                        const short = regime.startsWith('chamber') ? 'chamber' : 'stream';
                        return { label: `${invName(inv)} (${short})`, low: lo, now: Math.round((lo + hi) / 2), high: hi, highlight: hi >= 30 };
                    });
                })}
                range={[0, 90]}
                scaleLabels={['0%', '21% Earth air', '30% Moon-base plan', '90%']}
            />
            <Caption>Oxygen ranges are read from each investigation's published experimental-conditions table; mole fractions are converted to percent and labeled as such on each investigation's page.</Caption>
        </Group>
        <Group label="Prevention, detection, suppression" heading>
            <Paragraph>NASA structures spacecraft fire safety around three pillars. Where the PSI combustion record maps:</Paragraph>
            {(['prevention', 'detection', 'suppression'] as const).map((fn) => (
                <Group key={fn} label={safetyLabel(fn)}>
                    <Rows>
                        {byFn(fn).map((inv) => (
                            <Link key={inv.id} to={`/inv/${slug(inv.id)}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                                <Row name={invName(inv)} detail={inv.habitatRelevance} />
                            </Link>
                        ))}
                    </Rows>
                </Group>
            ))}
        </Group>
        <Group label="Boundaries and Earth benefits" heading>
            <Callout title="The partial-gravity gap" tone="warning">
                No PSI combustion data exists at lunar or Martian gravity. NASA expects the LUCI and FM2 experiments
                to close this. ACME's E-FIELD Flames used electric fields to mimic a partial-gravity-like force, and
                microgravity plus normal-gravity results can bound the intermediate regime - but bound, not measure.
            </Callout>
            <Bullets items={[
                'Fine-water-mist extinguishers developed for the ISS have practical firefighting applications on Earth.',
                'NASA smoke-detection work led to detectors that discriminate smoke from dust, with industrial uses such as mining.',
                'Spacesuit technology improved firefighters\' protective clothing and breathing air tanks.',
            ]} />
        </Group>
    </>;
}

const DEMO_SLIDES: { title: string; body: JSX.Element }[] = [
    {
        title: '1. The problem: Moon-base fire conditions are barely covered',
        body: <>
            <Paragraph>
                Planned Moon bases and pressurized rovers are expected to run at 30% or more oxygen at 10.2 psi or
                less - more than a 40% increase in oxygen concentration over Earth's atmosphere. Fire behaves differently in
                free fall, and almost nothing in NASA's combustion record was measured under those conditions.
            </Paragraph>
            <Paragraph>
                Apollo 1, the Apollo 13 oxygen-tank explosion and the 1997 Mir fire show what fire does to a crew far
                from home. Prevention, detection and suppression all depend on data that is scattered across decades
                of experiments.
            </Paragraph>
        </>,
    },
    {
        title: '2. The data: every PSI combustion-science investigation, in one place',
        body: <>
            <Paragraph>
                We harvested the complete combustion-science collection of NASA's Physical Sciences Informatics (PSI)
                repository: 24 investigations, 19 flown in microgravity, 1,984 observed test rows (plus 8 planned-matrix
                and 8 publication-figure-index rows) in published conditions tables, 13.5 TB of archived data and
                352 publication links (294 unique titles), snapshotted 2026-11-14T05:05Z.
            </Paragraph>
            <Paragraph>
                Every number in this dashboard traces to a NASA record or a downloaded PSI data table. Unknowns are
                shown as "not recorded", never estimated.
            </Paragraph>
        </>,
    },
    {
        title: '3. Simulate, Mode 1: run the physics, graded against the NASA record',
        body: <>
            <Paragraph>
                The Simulate tab runs the classical quasi-steady d-squared droplet-burning law forward from theory:
                pick methanol (157 recorded tests, 151 with measured K) or heptane (117 recorded, 107 with measured K),
                set ambient oxygen and pressure, and the model predicts the burning-rate constant, flame temperature
                and standoff ratio live. Two published fuel-vapor conductivity candidates run side by side - an
                extrapolated NIST vapor fit and the Chung 1988 corresponding-states correlation.
            </Paragraph>
            <Paragraph>
                Both candidates are built from published property data, and the comparison between them is exploratory. Each is
                scored on every graded FLEX test in its fuel and diluent cohort - signed median, median
                absolute and middle-80% errors over all 257 graded conditions, worst rows included. The flame on
                screen is a real-time procedural render driven by the live prediction, not experiment footage.
            </Paragraph>
        </>,
    },
    {
        title: '4. Simulate, Mode 2 and Ship check: anchored to measurement, honest about limits',
        body: <>
            <Paragraph>
                Mode 2 reconstructs actual NASA FLEX burns: the driving burning-rate constant is the value NASA itself
                measured, and only the d-squared curve through time is inferred. Variation among replicate records is
                shown, never averaged away.
            </Paragraph>
            <Paragraph>
                The Ship check tab stress-tests the app's honesty: outside the recorded envelope it says so and shows
                the nearest recorded test instead of extrapolating; unknown conditions render "not recorded", never
                estimates; no partial-gravity PSI combustion data exists yet, and the app says that too.
            </Paragraph>
        </>,
    },
    {
        title: '5. Explore and Rank: the catalog, scored transparently',
        body: <>
            <Paragraph>
                The Explore tab lists all 24 investigations with search and filters by fire-safety role (prevention,
                detection, suppression, fundamental) and fuel class. Each investigation opens to its objectives,
                approach, hypothesis and impacts verbatim from the NASA record, its measured test conditions from the
                published data tables, and its publications with DOIs.
            </Paragraph>
            <Paragraph>
                The Rank tab scores every investigation against five criteria - direct safety function, brief
                emphasis, measured test conditions, high-oxygen relevance, and data depth - with sliders that set the
                weights live. Scores combine PSI-record facts with a labeled team-authored rubric, and each
                investigation page shows the facts behind its placement.
            </Paragraph>
        </>,
    },
    {
        title: '6. Insights and Ask: the oxygen gap, and answers with provenance',
        body: <>
            <Paragraph>
                The Insights tab compares recorded oxygen endpoints against the 30% Moon-base threshold, with the exact
                source column per investigation and whether it measured chamber atmosphere or an oxidizer stream. A
                run at or above 30% is not evidence about Moon-base conditions - pressure, gravity and ventilation all
                differ - and no PSI combustion investigation has tested partial gravity. LUCI and FM2 are upcoming.
            </Paragraph>
            <Paragraph>
                The Ask tab answers with passages, not generated prose. Every result is labeled as a verbatim NASA
                record field or an AI-authored annotation, and links to the PSI record it comes from. Annotations are
                our reading of the record, never NASA's words.
            </Paragraph>
        </>,
    },
    {
        title: '7. What it means, and what comes next',
        body: <>
            <Paragraph>
                Mapped to NASA's prevention, detection and suppression pillars, the record is deep on materials
                flammability and soot (prevention), thin on smoke detection in habitat-like atmospheres, and mostly
                silent on suppression at 30% oxygen in partial gravity. The honest conclusion: the Moon-base fire
                problem needs new partial-gravity, high-oxygen data, and this dashboard shows exactly where the gaps
                are.
            </Paragraph>
            <Paragraph>
                Built by team RXP for the 2026 NASA Space Apps Challenge with AI assistance, disclosed throughout.
                Data: NASA PSI repository (CC0). Photos: NASA.
            </Paragraph>
        </>,
    },
];

function Demo() {
    const [slide, setSlide] = useState(1);
    const current = DEMO_SLIDES[slide - 1];
    return <>
        <Group label="Demo" heading="Seven-slide walkthrough">
            <Paragraph>
                The guided tour for judges. Drag the slider or read straight down; each slide is one beat of the
                story, from the problem to the honest conclusion.
            </Paragraph>
            <Slider label="Slide" value={slide} min={1} max={7} onChange={(v: number) => setSlide(v)} describe={(v: number) => `slide ${v} of 7`} />
            <Group label={`Slide ${slide} of 7`} heading={current.title}>
                {current.body}
            </Group>
            <NumberedList items={DEMO_SLIDES.map((s) => s.title)} />
        </Group>
    </>;
}

function Ask() {
    const [q, setQ] = useState('');
    const hits = useMemo(() => (q.trim().length > 2 ? searchCorpus(CORPUS, q) : []), [q]);
    return <>
        <Group label="Ask the record" heading="Search the record, with every passage labeled by origin">
            <Paragraph>
                Type a question or topic. The dashboard shows the most relevant matching passages, each labeled as
                either a verbatim field from the NASA PSI record (Objectives, Approach, Hypothesis, Research impacts)
                or an AI-authored annotation (AI-assisted summary, Habitat fire-safety relevance, Measured test
                conditions). Annotations are our reading of the record, not NASA's words; every result links to the
                NASA PSI record it comes from.
            </Paragraph>
            <TextField label="For example: which tests used high oxygen?" value={q} onChange={setQ} />
            {q.trim().length > 2 && !hits.length && <Paragraph>No matching passages. Try different words.</Paragraph>}
            <Rows numbered>
                {hits.map((h) => {
                    const verbatim = ['Objectives', 'Approach', 'Hypothesis', 'Research impacts / Earth benefits'].includes(h.chunk.field);
                    return (
                        <Row key={`${h.chunk.inv}-${h.chunk.field}`}
                            name={verbatim
                                ? `${h.chunk.acro || h.chunk.inv} · NASA record: ${h.chunk.field}`
                                : `${h.chunk.acro || h.chunk.inv} · ${h.chunk.field} (AI annotation, not a NASA quote)`}
                            detail={excerpt(h.chunk.text, q)} />
                    );
                })}
            </Rows>
            {hits.length > 0 && (
                <Caption>Sources: {[...new Set(hits.map((h) => h.chunk.inv))].map((id) => (
                    <span key={id}> <TextLink href={BY_ID[id].psiUrl}>{id}</TextLink></span>
                ))}</Caption>
            )}
        </Group>
    </>;
}

function Home() {
    return <>
        <Hero stats={{
            investigations: DATA.count,
            observed: TUPLES.observedRows,
            planned: TUPLES.plannedMatrixRows,
            terabytes: '13.5 TB',
        }} />
        <Overview />
    </>;
}

export function App() {
    return <FileCard>
        <nav className="file-nav" aria-label="File pages">
            <NavLink to="/" end>Home</NavLink>
            <NavLink to="/story">Story</NavLink>
            <NavLink to="/simulate">Simulate</NavLink>
            <NavLink to="/check">Ship check</NavLink>
            <NavLink to="/explore">Explore</NavLink>
            <NavLink to="/insights">Insights</NavLink>
            <NavLink to="/rank">Rank</NavLink>
            <NavLink to="/compare">Compare</NavLink>
            <NavLink to="/ask">Ask</NavLink>
            <NavLink to="/demo">Demo</NavLink>
        </nav>
        <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/story" element={<Story />} />
            <Route path="/simulate" element={<Simulate />} />
            <Route path="/check" element={<Check />} />
            <Route path="/explore" element={<Explore />} />
            <Route path="/rank" element={<Rank />} />
            <Route path="/compare" element={<Compare />} />
            <Route path="/insights" element={<Insights />} />
            <Route path="/ask" element={<Ask />} />
            <Route path="/demo" element={<Demo />} />
            {INVS.map((inv) => (
                <Route key={inv.id} path={`/inv/${slug(inv.id)}`} element={<InvestigationView inv={inv} />} />
            ))}
        </Routes>
        <Closing>
            Data: NASA Physical Sciences Informatics repository (psi.nasa.gov, whose homepage now redirects to science.nasa.gov; the per-investigation links in this app lead to the live PSI records), snapshot {DATA.snapshotUtc}, CC0.
            Photos: NASA. Built with AI assistance; summaries marked as such. Team RXP, 2026 NASA Space Apps Challenge.
        </Closing>
    </FileCard>;
}

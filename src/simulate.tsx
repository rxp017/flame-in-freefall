import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Callout, Caption, ChoiceRow, Facts, Group, Paragraph, Slider } from './kit';
import {
    TestTuple, flexBurnTimeS, flexDropletMm, flexEnvelope, flexExtinctionMm, flexK,
    flexTests, flexTestEnd, nearestFlexTest, pressureAtm,
} from './tuples';
import { coverage, nominalLifetimeS, predictK, residualSpread, Fuel, Transport } from './forward';
import { RESIDUALS, ENVELOPE } from './data/forwardData';
import { FireScene } from './fire';

/**
 * Simulate tab: replay of observed NASA FLEX droplet-combustion tests.
 * The animation is driven by the MEASURED burning-rate constant, droplet size,
 * extinction diameter and test end of one real, cited test. The flame halo is
 * illustrative; the droplet shrinkage follows the classical d^2 law using the
 * measured K of the anchored test. No CFD, no shape prediction.
 */

const PLAY_SECONDS = 7; // wall-clock length of one replay

/** Scatter with real axes/ticks/units; diluent facet dims rather than drops pooled points. */
function KScatter(props: {
    points: { x: number; y: number; label?: string; highlight?: boolean; diluent?: string }[];
    xTicks: number[]; yTicks: number[]; xRange: [number, number]; yRange: [number, number];
    diluent: string;
}) {
    const W = 560, H = 300, ML = 52, MB = 44, MT = 14, MR = 14;
    const sx = (x: number) => ML + ((x - props.xRange[0]) / (props.xRange[1] - props.xRange[0])) * (W - ML - MR);
    const sy = (y: number) => MT + (1 - (y - props.yRange[0]) / (props.yRange[1] - props.yRange[0])) * (H - MT - MB);
    return <svg viewBox={`0 0 ${W} ${H}`} role="img"
        aria-label="Measured burning-rate constant K in mm^2/s versus ambient oxygen percent; each point is one recorded NASA FLEX test"
        style={{ width: '100%', height: 'auto', display: 'block' }}>
        {props.yTicks.map((t) => (
            <g key={`y${t}`}>
                <line x1={ML} x2={W - MR} y1={sy(t)} y2={sy(t)} stroke="var(--ds-hairline)" strokeWidth={1} />
                <text x={ML - 8} y={sy(t) + 4} textAnchor="end" fontSize={11} fill="var(--ds-ink-2)">{t}</text>
            </g>
        ))}
        {props.xTicks.map((t) => (
            <g key={`x${t}`}>
                <line x1={sx(t)} x2={sx(t)} y1={MT} y2={H - MB} stroke="var(--ds-hairline)" strokeWidth={1} />
                <text x={sx(t)} y={H - MB + 16} textAnchor="middle" fontSize={11} fill="var(--ds-ink-2)">{t}%</text>
            </g>
        ))}
        <text x={(ML + W - MR) / 2} y={H - 6} textAnchor="middle" fontSize={12} fill="var(--ds-ink-2)">ambient oxygen (% by mole fraction)</text>
        <text x={14} y={(MT + H - MB) / 2} textAnchor="middle" fontSize={12} fill="var(--ds-ink-2)"
            transform={`rotate(-90 14 ${(MT + H - MB) / 2})`}>K (mm^2/s)</text>
        {props.points.map((p, i) => {
            const dim = props.diluent !== 'all' && p.diluent !== props.diluent && !p.highlight;
            return (
                <g key={i}>
                    <circle cx={sx(p.x)} cy={sy(p.y)} r={p.highlight ? 6 : 3.5}
                        fill={p.highlight ? 'var(--ds-teal)' : 'var(--ds-ink-2)'}
                        opacity={dim ? 0.1 : p.highlight ? 1 : 0.55} stroke="#fff" strokeWidth={1} />
                    {p.label && (
                        <text x={sx(p.x) + 10} y={sy(p.y) + 4} fontSize={12} fontWeight={600}
                            fill="var(--ds-teal)">{p.label}</text>
                    )}
                </g>
            );
        })}
    </svg>;
}

function DropletReplay(props: { test: TestTuple; replayKey: number }) {
    const ref = useRef<HTMLCanvasElement>(null);
    const k = flexK(props.test);
    const d0 = flexDropletMm(props.test);
    const burnS = flexBurnTimeS(props.test);
    const extMm = flexExtinctionMm(props.test);
    const end = flexTestEnd(props.test);
    const [phase, setPhase] = useState<'burning' | 'ended'>('burning');

    useEffect(() => {
        const canvas = ref.current;
        if (!canvas || k === undefined || d0 === undefined || !burnS) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        let raf = 0;
        const start = performance.now();
        setPhase('burning');
        const resize = () => {
            canvas.width = canvas.clientWidth * (window.devicePixelRatio || 1);
            canvas.height = canvas.clientHeight * (window.devicePixelRatio || 1);
        };
        resize();
        const scale = () => Math.min(canvas.width, canvas.height) * 0.40 / d0; // px per mm
        const tick = (now: number) => {
            const wall = (now - start) / 1000;
            const tSim = Math.min(burnS, (wall / PLAY_SECONDS) * burnS);
            const d2 = Math.max(0, d0 * d0 - k * tSim); // d-squared law with the measured K
            const d = Math.sqrt(d2);
            const W = canvas.width, H = canvas.height;
            const cx = W / 2, cy = H / 2, s = scale();
            ctx.clearRect(0, 0, W, H);
            // the recorded burn time ends the window; extinction is NEVER derived from the K line
            const done = tSim >= burnS;
            // flicker seed
            const fl = Math.sin(wall * 9) * 0.5 + Math.sin(wall * 23.7) * 0.3 + Math.sin(wall * 41.3) * 0.2;
            if (!done) {
                // illustrative halo: sized off the droplet, NOT a measured flame standoff
                const haloR = d * s * (2.1 + 0.12 * fl);
                const g = ctx.createRadialGradient(cx, cy, d * s * 0.6, cx, cy, haloR);
                g.addColorStop(0, 'rgba(120,170,255,0.55)');   // blue core typical of these flames
                g.addColorStop(0.55, 'rgba(90,140,255,0.28)');
                g.addColorStop(1, 'rgba(80,120,255,0)');
                ctx.fillStyle = g;
                ctx.beginPath();
                ctx.arc(cx, cy, haloR, 0, Math.PI * 2);
                ctx.fill();
            }
            // recorded endpoint rings: marked separately, the reconstruction is never forced through them
            const dpr = window.devicePixelRatio || 1;
            ctx.setLineDash([4 * dpr, 4 * dpr]);
            ctx.strokeStyle = 'rgba(255,255,255,0.45)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(cx, cy, d0 * s * 0.5, 0, Math.PI * 2);
            ctx.stroke();
            ctx.fillStyle = 'rgba(255,255,255,0.65)';
            ctx.font = `${11 * dpr}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.fillText(`recorded ignition diameter ${d0.toFixed(2)} mm`, cx, cy - d0 * s * 0.5 - 6 * dpr);
            if (end === 'Extinction' && extMm !== undefined) {
                ctx.beginPath();
                ctx.arc(cx, cy, Math.max(2, extMm * s * 0.5), 0, Math.PI * 2);
                ctx.stroke();
                ctx.fillText(`recorded extinction diameter ${extMm.toFixed(2)} mm`, cx, cy - Math.max(2, extMm * s * 0.5) - 6 * dpr);
            }
            ctx.setLineDash([]);
            // droplet
            ctx.beginPath();
            ctx.arc(cx, cy, Math.max(1.5, d * s * 0.5), 0, Math.PI * 2);
            ctx.fillStyle = '#251f21';
            ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,0.75)';
            ctx.lineWidth = 1;
            ctx.stroke();
            // readout + state banner
            ctx.fillStyle = 'rgba(255,255,255,0.88)';
            ctx.font = `${12 * dpr}px sans-serif`;
            ctx.textAlign = 'left';
            ctx.fillText(`t = ${tSim.toFixed(1)} s of ${burnS.toFixed(1)} s (recorded burn time)`, 12, 20);
            ctx.fillText(`d = ${d.toFixed(2)} mm (reconstruction)`, 12, 38);
            if (done && end === 'Extinction' && extMm !== undefined) {
                ctx.fillText(`recorded extinction diameter ${extMm.toFixed(2)} mm - reconstruction reads ${d.toFixed(2)} mm here`, 12, 56);
            }
            ctx.textAlign = 'center';
            ctx.fillStyle = done ? 'rgba(160,200,255,0.95)' : 'rgba(255,217,168,0.95)';
            const banner = !done
                ? `FLEX ${props.test.test} - burning`
                : end === 'Extinction'
                    ? `FLEX ${props.test.test} - recorded test end: Extinction, at the recorded time`
                    : end === 'Disruption'
                        ? `FLEX ${props.test.test} - recorded test end: Disruption (censored)`
                        : end === 'Completion'
                            ? `FLEX ${props.test.test} - recorded test end: Completion (censored)`
                            : `FLEX ${props.test.test} - recorded burn time reached`;
            ctx.fillText(banner, W / 2, H - 12 * dpr); // bottom-center: never collides with the top-left readout
            ctx.textAlign = 'left';
            if (done) setPhase((p) => (p === 'ended' ? p : 'ended'));
            else raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [props.test, props.replayKey]);

    const endNote =
        phase === 'ended' && end === 'Extinction'
            ? `Recorded test end: Extinction, annotated at the recorded burn time - not derived from the K line.`
            : phase === 'ended' && end === 'Disruption'
                ? 'Recorded test end: droplet disruption - a censored run, not an extinction measurement.'
                : phase === 'ended' && end === 'Completion'
                    ? 'Recorded test end: completion - a censored run, not an extinction measurement.'
                    : '';
    return <div className="replay">
        <canvas ref={ref} className="replay-canvas" aria-label="Droplet combustion replay" />
        <Caption>
            {endNote} Model-based reconstruction: shrinkage follows the d-squared law with this test's
            measured summary K from its fitted burn window, so it need not pass exactly through the recorded
            endpoints - those are marked separately as dashed rings. The blue halo is illustrative, not a
            measured flame shape. Time compressed to {PLAY_SECONDS}s.
        </Caption>
    </div>;
}

export function Simulate() {
    const [fuel, setFuel] = useState('Methanol');
    const env = flexEnvelope(fuel) || { o2: [12, 34], p: [0.5, 3] };
    const [o2, setO2] = useState(21);
    const [p, setP] = useState(1);
    const [replayKey, setReplayKey] = useState(0);
    const [diluent, setDiluent] = useState('all');

    const tests = useMemo(() => flexTests(fuel).filter((t) => flexK(t) !== undefined && t.o2), [fuel]);
    const anchor = useMemo(() => nearestFlexTest(fuel, o2, p), [fuel, o2, p]);
    useEffect(() => { setReplayKey((k) => k + 1); }, [anchor?.test?.test]);

    const atSameO2 = useMemo(() => {
        if (!anchor) return [] as number[];
        const o2v = anchor.test.o2?.percent;
        return tests.filter((t) => t.o2?.percent === o2v).map((t) => flexK(t)!).sort((a, b) => a - b);
    }, [anchor, tests]);

    // True repeats only when every recorded control matches: fuel (already), oxygen,
    // diluent mixture fractions and pressure. Anything looser is variation across
    // different recorded conditions, not measurement repeatability.
    const repeats = useMemo(() => {
        if (!anchor) return [] as number[];
        const a = anchor.test;
        const af = JSON.stringify(a.diluent?.fractions || {});
        const o2v = a.o2?.percent;
        return tests
            .filter((t) => t !== a
                && t.o2?.percent === o2v
                && JSON.stringify(t.diluent?.fractions || {}) === af
                && t.pressure?.value === a.pressure?.value
                && t.pressure?.unit === a.pressure?.unit)
            .map((t) => flexK(t)!)
            .concat(flexK(a)!)
            .sort((x, y) => x - y);
    }, [anchor, tests]);

    const outside =
        o2 < env.o2[0] || o2 > env.o2[1] || p < env.p[0] || p > env.p[1];

    const points = tests.map((t) => ({
        x: t.o2!.percent,
        y: flexK(t)!,
        label: anchor?.test === t ? t.test : undefined,
        highlight: anchor?.test === t,
        diluent: (t as any).diluent?.dominant as string | undefined,
    }));
    const xTicks = [15, 20, 25, 30].filter((t) => t >= env.o2[0] && t <= env.o2[1]);

    return <>
        <FireScene />

        <ForwardPrediction fuel={fuel} />

        <Group label="Mode 2 - Measurement-based reconstruction" heading="Watch a real droplet burn, reconstructed">
            <Paragraph>
                One recorded NASA FLEX droplet test (274 on the ISS, PSI-69), reconstructed: the classical
                d-squared law driven by its measured summary K - a model anchored to measured values, not a
                video or a recorded time series. Unlike Mode 1 above, the K driving this
                reconstruction is the value NASA itself measured; only the d-squared curve
                through time is inferred, not the rate.
            </Paragraph>
            {outside && (
                <Callout title="Outside the recorded envelope" tone="warning">
                    {fuel} was recorded between {env.o2[0]}% and {env.o2[1]}% oxygen and {env.p[0].toFixed(2)} to {env.p[1].toFixed(2)} atm in this archive.
                    Showing the nearest recorded test instead of extrapolating.
                </Callout>
            )}
            <div className="lab">
                {anchor && <div className="lab-canvas"><DropletReplay test={anchor.test} replayKey={replayKey} /></div>}
                <div className="lab-controls">
                    <ChoiceRow label="Fuel" value={fuel} onChange={setFuel} options={[
                        { value: 'Methanol', label: 'Methanol (157 recorded, 151 with measured K)' },
                        { value: 'Heptane', label: 'Heptane (117 recorded, 107 with measured K)' },
                    ]} />
                    <Slider label="Ambient oxygen" min={12} max={34} value={o2} onChange={setO2}
                        describe={(v) => `${v}% oxygen by mole fraction`} />
                    <Slider label="Ambient pressure" min={0.5} max={3} value={p} onChange={setP}
                        describe={(v) => `${v.toFixed(1)} atm`} />
                </div>
            </div>
            {anchor && (
                <>
                    <Facts items={[
                        { label: 'Anchored to NASA test', value: `FLEX ${anchor.test.test} (PSI-69)` },
                        { label: 'Recorded oxygen', value: `${anchor.test.o2?.percent}% (mole fraction, converted)` },
                        { label: 'Recorded diluent', value: anchor.test.diluent
                            ? `${Object.entries(anchor.test.diluent.fractions).map(([k, v]) => `${k} ${v}`).join(', ')} (recorded mole fractions)`
                            : 'not recorded' },
                        { label: 'Recorded pressure', value: anchor.test.pressure ? `${anchor.test.pressure.value} ${anchor.test.pressure.unit}` : 'not recorded' },
                        { label: 'Measured K', value: `${flexK(anchor.test)} mm^2/s` },
                        { label: 'Droplet at ignition', value: flexDropletMm(anchor.test) ? `${flexDropletMm(anchor.test)} mm` : 'not recorded' },
                        { label: 'Recorded test end', value: flexTestEnd(anchor.test) || 'not recorded' },
                    ]} />
                    {repeats.length > 1 ? (
                        <Caption>
                            Variation among records with matched fuel, oxygen, diluent mixture and pressure;
                            droplet size differs: K spans {repeats[0]} to {repeats[repeats.length - 1]} mm^2/s
                            across {repeats.length} records.
                        </Caption>
                    ) : atSameO2.length > 1 && (
                        <Caption>
                            At this oxygen level, recorded K spans {atSameO2[0]} to {atSameO2[atSameO2.length - 1]} mm^2/s
                            across {atSameO2.length} {fuel} tests run under different diluents, pressures and droplet
                            sizes - variation across different recorded conditions, not measurement repeatability.
                        </Caption>
                    )}
                    <Caption>
                        Method and unit: the reconstruction applies d^2(t) = d0^2 - K·t with this test's measured
                        summary K over its recorded burn time. The PSI CSV header is truncated ('Burning rate; mm');
                        K is the droplet burning-rate constant in mm^2/s as defined by NASA/TP-2015-216046 (linear
                        fit of diameter-squared vs time over a window starting shortly after ignition). K describes
                        droplet consumption - it is not flame spread and says nothing about spacecraft materials.
                    </Caption>
                </>
            )}
        </Group>

        <Group label="The measured record" heading={`${fuel}: burning rate vs oxygen`}>
            <ChoiceRow label="Diluent (dominant gas of the recorded mixture)" value={diluent} onChange={setDiluent} options={[
                { value: 'all', label: 'All recorded mixtures' },
                { value: 'N2', label: 'N2-dominated' },
                { value: 'CO2', label: 'CO2-dominated' },
                { value: 'He', label: 'He-dominated' },
            ]} />
            <KScatter points={points} xTicks={xTicks} yTicks={[0, 0.3, 0.6, 0.9, 1.2]}
                xRange={[env.o2[0], env.o2[1]]} yRange={[0, 1.2]} diluent={diluent} />
            <Caption>
                Each point is one recorded NASA test; the teal point is the reconstruction's anchor.
                {diluent === 'all'
                    ? ' All diluent mixtures are shown together: N2, CO2 and helium move K at the same oxygen level, which is why the cloud is wide. Pick a diluent above to facet; dimmed points are the ones a pooled view would hide. '
                    : ` Tests whose recorded mixture is ${diluent}-dominated are shown at full strength (dominance is derived from the recorded fractions, which the record panel above lists for the anchored test); the rest are dimmed, not deleted. Pressure and droplet size still vary across points. `}
                No trend line is drawn: these are mixed measured conditions, not a fitted curve.
            </Caption>
        </Group>

    </>;
}

/** Forward physics: classical d^2-law prediction from theory + sourced properties only,
 *  graded openly against the recorded FLEX archive. Two candidate fuel-vapor thermal
 *  conductivities are shown side by side; their difference is transport-assumption
 *  sensitivity, not an uncertainty bound. No extinction, no flame shape, no safety claim. */
function ForwardPrediction(props: { fuel: string }) {
    const fuel = (props.fuel === 'Heptane' ? 'Heptane' : 'Methanol') as Fuel;
    const [o2, setO2] = useState(21);
    const [p, setP] = useState(1);
    const [d0, setD0] = useState(1.5);
    const [diluent, setDiluent] = useState('N2');

    const dil = useMemo(() => ({ [diluent]: 1 - o2 / 100 }), [diluent, o2]);
    const cov = coverage(fuel, diluent, o2, p);
    const fit = useMemo(() => predictK(fuel, o2, dil, p, 'fit' as Transport), [fuel, o2, dil, p]);
    const chung = useMemo(() => predictK(fuel, o2, dil, p, 'chung' as Transport), [fuel, o2, dil, p]);
    const spreadFit = residualSpread('fit', fuel, diluent);
    const spreadChung = residualSpread('chung', fuel, diluent);

    return (
        <Group label="Mode 1 - Forward physics" heading="Predict from theory, then grade against the archive">
            <Paragraph>
                Mode 1 of 2 on this tab: the classical quasi-steady d-squared law, run forward from
                sourced thermophysical properties only - no fitting to the measurements below. It
                predicts a droplet burning-rate constant K for a condition you choose, then shows how
                the same model fared against the recorded NASA FLEX tests of this fuel and diluent.
                The sliders span the recorded archive's overall ranges for display; coverage against
                actual recorded conditions is checked per condition above, not assumed from the ranges.
            </Paragraph>
            <div className="lab">
                <div className="lab-controls">
                    <ChoiceRow label="Diluent (balance of the mixture)" value={diluent} onChange={setDiluent} options={[
                        { value: 'N2', label: 'Nitrogen' },
                        { value: 'CO2', label: 'Carbon dioxide' },
                        { value: 'He', label: 'Helium' },
                    ]} />
                    <Slider label="Ambient oxygen" min={12} max={34} value={o2} onChange={setO2}
                        describe={(v) => `${v}% by mole fraction`} />
                    <Slider label="Ambient pressure" min={0.69} max={3.05} value={p} onChange={setP}
                        describe={(v) => `${v.toFixed(2)} atm`} />
                    <Slider label="Droplet at ignition" min={0.5} max={4} value={d0} onChange={setD0}
                        describe={(v) => `${v.toFixed(1)} mm`} />
                </div>
                <div>
                    {cov.any && !cov.near && (
                        <Callout title="No nearby recorded measurement" tone="warning">
                            No recorded {fuel} test with this diluent sits near this condition - the nearest
                            graded test is at {cov.nearest!.o2}% oxygen, {cov.nearest!.p} atm, and its recorded
                            balance is {(cov.nearest!.frac * 100).toFixed(0)}% {diluent} of the whole mixture
                            (as recorded - a blend, not your pure selection). The prediction
                            below is still computed from theory, but the archive holds no nearby measurement
                            to grade it against; the spreads quoted describe that fuel/diluent group, not this
                            point. (Display threshold: within 2 oxygen points and 0.3 atm.)
                        </Callout>
                    )}
                    {!cov.any && (
                        <Callout title="No recorded measurement for this pair" tone="warning">
                            The archive holds no graded {fuel} test with this diluent at all; the prediction
                            below is computed from theory with nothing to grade it against.
                        </Callout>
                    )}
                    {fit && chung && (fit.gasTableClamp || chung.gasTableClamp) && (
                        <Callout title="Outside sourced property tables" tone="warning">
                            At this condition the model's reference state leaves the sourced gas-property
                            tables (300-1500 K). No prediction is offered rather than extrapolating silently.
                        </Callout>
                    )}
                    {fit && chung && !fit.gasTableClamp && !chung.gasTableClamp && (
                        <>
                            <Facts items={[
                                { label: 'Predicted K (extrapolated NIST vapor fit)', value: `${fit.K.toFixed(2)} mm^2/s` },
                                { label: 'Predicted K (Chung 1988 variant)', value: `${chung.K.toFixed(2)} mm^2/s` },
                                { label: 'Nominal droplet time D0^2/K', value: `${nominalLifetimeS(d0, fit.K).toFixed(1)} s (not validated against recorded burn times)` },
                                { label: 'Flame temperature (thin-flame model)', value: `${fit.Tf.toFixed(0)} K - a modeling construct, not a measurement` },
                            ]} />
                            {fit.lamExtrapolated && (
                                <Caption>
                                    Transport caveat: at this reference temperature the extrapolated NIST vapor fit
                                    extrapolates the published fuel-vapor conductivity beyond its sourced
                                    range (published: 339-660 K methanol, 400-600 K heptane); the Chung
                                    correlation is the in-domain alternative. Against the published
                                    conductivity data alone, Chung matches heptane within about +3% but
                                    reads methanol about 25% low. Neither candidate is selected as primary,
                                    and their roughly 20% difference is sensitivity to an unmeasured
                                    property - not a bound on the true K.
                                </Caption>
                            )}
                            {spreadFit && spreadChung && (
                                <Caption>
                                    Scored on {spreadFit[4]} graded FLEX {fuel} tests whose balance is {diluent === 'N2' ? 'nitrogen' : diluent === 'CO2' ? 'carbon dioxide' : 'helium'}-dominant
                                    (all cohort rows including the worst, exploratory comparison):
                                    Extrapolated NIST vapor fit - signed median {spreadFit[0]}%, median absolute {spreadFit[1]}%, middle 80% {spreadFit[2]}% to {spreadFit[3]}%.
                                    Chung variant - signed median {spreadChung[0]}%, median absolute {spreadChung[1]}%, middle 80% {spreadChung[2]}% to {spreadChung[3]}%.
                                    Recorded mixtures are mixed-gas, not pure: their actual diluent fractions differ
                                    from the pure balance selected above, so this is a nearest-condition grouping,
                                    never a claim that your exact condition was tested. These are empirical spreads
                                    of past errors, not confidence bands, and a small median does not bound any
                                    individual prediction.
                                </Caption>
                            )}
                            <Caption>
                                Frozen equations: K = 8*lambda/(rho_l*cp)*ln(1+B), B from the Spalding transfer
                                number, thin-flame temperature per Matalon (2013, Lecture 12), Hubbard-Denny-Mills
                                1/3 reference state, Wassiljewa/Mason-Saxena conductivity mixing. Properties: NIST
                                WebBook (saturation, gas cp, vapor conductivity), Cantera critical data (Chung
                                inputs, BSD-3-Clause). Two independent implementations agree to 0.7% median, and an
                                independent numerical audit reproduced the per-row results - that checks the
                                arithmetic, not the physics. This classical model does not predict extinction,
                                flame shape, soot or solids, and says nothing about spacecraft materials or
                                cabin safety.
                            </Caption>
                        </>
                    )}
                </div>
            </div>
        </Group>
    );
}

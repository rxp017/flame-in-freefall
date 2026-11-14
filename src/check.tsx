import React, { useMemo, useState } from 'react';
import { Callout, Caption, Group, Paragraph, Rows, Row, Slider } from './kit';
import { o2Distance, o2Label, observedConditionTuples, pressureAtm, tableOf } from './tuples';
import rawData from './data/investigations.json';

/** Investigation id -> rig/experiment name for row context. */
const RIG: Record<string, string> = Object.fromEntries(
    (rawData as any).investigations.map((i: any) => [i.id, i.acronym ? `${i.acronym} (${i.id})` : i.id]),
);

/**
 * Ship check tab: screening context for a proposed atmosphere.
 * Compares the chosen O2 / pressure against recorded NASA test conditions.
 * Reference information about NASA-STD-6001B Test 1 is shown as published.
 * This is NOT a flammability assessment and never returns safe / unsafe.
 */

const O2_TOL = 2;     // +/- percent points
const P_TOL = 0.5;    // +/- atm

export function Check() {
    const [o2, setO2] = useState(21);
    const [p, setP] = useState(1);

    // Cabin-atmosphere screening compares against chamber/ambient-regime tests only.
    // Oxidizer-stream (inverse-flame) rows are a different physical regime and are never pooled in.
    const all = useMemo(
        () => observedConditionTuples().filter((t) => t.o2?.regime === 'chamber / ambient atmosphere'),
        [],
    );
    const matches = useMemo(() => {
        const withDist = all
            .map((t) => {
                const tp = pressureAtm(t.pressure);
                const do2 = o2Distance(t.o2, o2); // range-aware: 0 inside a recorded range, distance to the nearest bound otherwise
                if (do2 === undefined) return undefined;
                const dp = tp === undefined ? Number.POSITIVE_INFINITY : Math.abs(tp - p);
                // missing pressure is NOT a wildcard: rows without a recorded pressure never count as near matches
                return { t, tp, d: Math.hypot(do2, dp * 4), near: do2 <= O2_TOL && tp !== undefined && dp <= P_TOL };
            })
            .filter(Boolean) as { t: any; tp?: number; d: number; near: boolean }[];
        withDist.sort((a, b) => a.d - b.d);
        return withDist;
    }, [all, o2, p]);

    const near = matches.filter((m) => m.near);
    const matrix = tableOf('PSI-68')?.matrix;
    const matrixCovers = matrix
        && matrix.o2MoleFractionOptions.some((v) => Math.abs(v * 100 - o2) <= 0.5)
        && matrix.pressureAtmOptions.some((v) => Math.abs(v - p) <= 0.1);

    return <>
        <Group label="Screening context" heading="Was anything like this atmosphere tested?">
            <Paragraph>
                Enter a candidate cabin atmosphere. This tool lists the recorded NASA test conditions
                nearest to it in the same physical regime (chamber / ambient atmosphere) - what was
                measured, in which rig, with which fuel or material. Oxidizer-stream inverse-flame tests
                are a different regime and are excluded, not averaged in. It is a record lookup, not a
                flammability assessment.
            </Paragraph>
            <Slider label="Oxygen concentration" min={10} max={40} value={o2} onChange={setO2}
                describe={(v) => `${v}% oxygen by volume`} />
            <Slider label="Cabin pressure" min={0.2} max={4} value={p} onChange={setP}
                describe={(v) => `${v.toFixed(1)} atm`} />

            {near.length > 0 ? (
                <Paragraph>
                    {near.length} recorded test rows in this PSI snapshot sit within +/-{O2_TOL} oxygen points
                    and +/-{P_TOL} atm of your entry. The closest are listed below.
                </Paragraph>
            ) : (
                <Callout title="No matching record in this snapshot" tone="note">
                    No recorded test row in this PSI snapshot of 14 Nov 2026 covers these conditions.
                    That is an absence in this archive - it is not evidence that the conditions were never
                    tested anywhere, and it says nothing about safety.
                </Callout>
            )}

            <Rows>
                {matches.slice(0, 8).map((m, i) => (
                    <Row key={i}
                        name={`${RIG[m.t.inv] || m.t.inv}${m.t.test ? ' · test ' + m.t.test : ''}`}
                        detail={`${m.t.fuel || 'fuel/material not recorded'} · ${m.t.o2?.regime || ''}`}
                        value={`${o2Label(m.t.o2)}${m.tp !== undefined ? ` · ${m.tp.toFixed(2)} atm` : ''}`}
                        valueKnown />
                ))}
            </Rows>
            <Caption>
                Pressures were converted to atm for comparison only (760 mmHg = 1 atm exactly;
                1.01325 bar = 1 atm); source columns and units are named on each investigation page.
            </Caption>

            {(() => {
                const missing = matches.filter((m) => m.tp === undefined);
                if (missing.length === 0) return null;
                const ids = [...new Set(missing.map((m) => m.t.inv as string))].join(', ');
                return (
                    <Callout title="Rows without recorded pressure - listed separately" tone="note">
                        {missing.length} recorded rows in this snapshot report no pressure, so pressure cannot
                        be compared and they never count as near matches above (investigations: {ids}).
                        These include large-scale SAFFIRE material-burn rows (PSI-98/99/100) - a different,
                        larger-scale rig than the droplet and chamber tests; treat them as separate evidence,
                        not as near-condition matches.
                    </Callout>
                );
            })()}

            {matrix && (
                <Caption>
                    FLEX-2's planned test matrix {matrixCovers ? 'includes' : 'does not include'} this point
                    (planned options: oxygen {matrix.o2MoleFractionOptions.map((v) => `${Math.round(v * 100)}%`).join(', ')};
                    pressure {matrix.pressureAtmOptions.join(' / ')} atm; fuels: {matrix.fuels.join(', ')}).
                    A planned matrix is a test plan, not a result.
                </Caption>
            )}
        </Group>

        <Group label="Reference standard" heading="How NASA screens materials">
            <Paragraph>
                NASA-STD-6001B (Flammability, Offgassing, and Compatibility Requirements and Test
                Procedures) Test 1, Upward Flame Propagation, is the screening test for materials in
                crewed cabins. As published: a material fails if a test specimen propagates flame more
                than 15 cm (6 in) or transfers burning material to the indicator paper below; five
                replicate specimens are tested at the worst-case anticipated atmosphere - commonly
                30% oxygen at 70.3 kPa (10.2 psia). The Maximum Oxygen Concentration (MOC) method extends
                it to find the highest oxygen level at which a material passes.
            </Paragraph>
            <Callout title="What this app does not do" tone="warning">
                This app does not run the standard, does not certify materials, and does not issue
                safe-or-unsafe verdicts. It shows what the PSI archive recorded near your conditions and
                points to the standard that governs actual qualification testing.
            </Callout>
            <Caption>
                Source: NASA-STD-6001B with Change 3 (standards.nasa.gov) and NASA/TM discussion of the
                Test 1 MOC method (ntrs.nasa.gov/citations/20170004702).
            </Caption>
        </Group>
    </>;
}

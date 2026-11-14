import React from 'react';
import { Callout, Caption, Group, KeySentence, Paragraph } from './kit';
import sphereFlame from './photos/iss040e072900.jpg';
import gloveboxOps from './photos/iss040e021546.jpg';
import acmeChamber from './photos/GRC-2016-C-05051.jpg';
import heroFlame from './photos/iss040e086481.jpg';

/** Story tab: photo-led scenes; the photograph opens each chapter, the text supports it. */

function Scene(props: { src: string; alt: string; chapter: string; title: string; credit: string }) {
    return <section className="scene" aria-label={props.title}>
        <img className="scene-photo" src={props.src} alt={props.alt} />
        <div className="scene-shade" />
        <div className="scene-copy">
            <p className="scene-eyebrow">{props.chapter}</p>
            <h2 className="scene-title">{props.title}</h2>
            <p className="scene-credit">{props.credit}</p>
        </div>
    </section>;
}

export function Story() {
    return <>
        <Scene chapter="Chapter 1" title="Fire without gravity is a different animal"
            src={sphereFlame} alt="A rounded blue and orange flame in microgravity during NASA's BASS-II investigation."
            credit="Photo: NASA, BASS-II investigation aboard the ISS." />
        <Group label="Chapter 1">
            <KeySentence>
                On Earth, hot air rises and feeds a flame its teardrop shape. In orbit, that current
                disappears - and fire becomes slow, round, and strange.
            </KeySentence>
            <Paragraph>
                A candle flame on the space station curls into a ball. Some flames keep burning in
                atmospheres so thin in oxygen that the same fire on Earth would snuff itself out, because
                no buoyancy-driven flow is there to stretch and cool them. Others fade out where no one
                expected. If crews are going to live for months inside Moon and Mars habitats, every one
                of those surprises is a safety question.
            </Paragraph>
        </Group>

        <Scene chapter="Chapter 2" title="NASA has been asking for decades"
            src={gloveboxOps} alt="An astronaut working at the Microgravity Science Glovebox on the ISS."
            credit="Photo: NASA, Microgravity Science Glovebox operations on the ISS." />
        <Group label="Chapter 2">
            <Paragraph>
                NASA's Physical Sciences Informatics (PSI) repository archives 24 combustion-science
                investigations - 19 flown in microgravity and 5 on the ground. Inside: droplets of methanol
                and heptane burning one at a time, thin films and rods of spacecraft-like materials
                smoldering in controlled airflow, and full-scale fires set inside uncrewed cargo ships
                after they left the station. The records add up to 13.5 TB.
            </Paragraph>
            <Paragraph>
                This app normalizes 1,984 observed test-condition rows from those experiments - plus 8
                planned-matrix rows for the FLEX-2 droplet study and 8 publication-figure-index rows -
                so they can be searched, compared and reconstructed, with every number traceable to its
                NASA record.
            </Paragraph>
        </Group>

        <Scene chapter="Chapter 3" title="The honest gap"
            src={acmeChamber} alt="An engineer inside the ACME combustion chamber hardware."
            credit="Photo: NASA, ACME combustion chamber hardware." />
        <Group label="Chapter 3">
            <KeySentence>
                Nothing in this archive was measured at Moon or Mars gravity - and no oxygen percentage
                here certifies a habitat atmosphere.
            </KeySentence>
            <Paragraph>
                The PSI combustion record covers Earth gravity and near-weightlessness. Partial gravity,
                the regime of lunar and Martian habitats, is the target of upcoming work such as the LUCI
                investigation. The oxygen ranges in this app are the endpoints of recorded runs, not
                continuous coverage, and chamber atmospheres are reported separately from burner oxidizer
                streams. Where a value was never recorded, this app says so.
            </Paragraph>
            <Callout title="Our honesty contract" tone="warning">
                Measured NASA data is always labeled with its source. Anything this app calculates is
                labeled as a model with its assumptions and limits beside it. Anything animated is
                labeled illustrative. No safe-or-unsafe verdicts, no invented findings.
            </Callout>
        </Group>

        <Scene chapter="Chapter 4" title="What you can do here"
            src={heroFlame} alt="A blue flame spreading over a solid fuel sample during the BASS-II investigation on the ISS."
            credit="Photo: NASA, BASS-II investigation aboard the ISS." />
        <Group label="Chapter 4">
            <Paragraph>
                Reconstruct a real droplet combustion test condition-by-condition in Simulate. Check a habitat
                atmosphere against the conditions NASA actually recorded in Ship check. Then go deeper:
                search all 24 investigations in Explore, compare oxygen regimes in Insights, weigh the
                ranking rubric yourself in Rank, put investigations side by side in Compare, and ask the
                archive questions in Ask - where answers quote the NASA record verbatim or are labeled as
                AI annotations.
            </Paragraph>
        </Group>
    </>;
}

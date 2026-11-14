import React, { useState } from 'react';
import { Callout, Caption, Group, Paragraph, TextField, TextLink } from './kit';
import { Dataset, Investigation } from './model';
import { SI_ENDPOINT } from './siConfig';

type SiResult = {
    ok: boolean;
    kind?: string;
    error?: string;
    reason?: string;
    failures?: string[] | null;
    attempts?: {model:string;httpStatus:number|null;finishReason:string|null;elapsedMs:number;neurons:number|null;validation:string[]}[];
    result?: Record<string, unknown> | null;
    raw?: string | null;
    model?: string;
    route?: string | null;
    fallbacks?: string[] | null;
    neurons?: number | null;
    availability?: string;
    generatedAt?: string;
    cached?: boolean;
};

async function siCall(body: Record<string, unknown>): Promise<SiResult> {
    const res = await fetch(`${SI_ENDPOINT}/api/si`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    return res.json();
}

function useSi() {
    const [busy, setBusy] = useState(false);
    const [out, setOut] = useState<SiResult | null>(null);
    const run = async (body: Record<string, unknown>) => {
        setBusy(true);
        setOut(null);
        try {
            setOut(await siCall(body));
        } catch {
            setOut({ ok: false, error: 'Could not reach the SI gateway. Deterministic search and simulation remain available.' });
        }
        setBusy(false);
    };
    return { busy, out, run };
}

function Badge({ out }: { out: SiResult }) {
    return (
        <Caption>
            {out.route === 'local-safety-guardrail' ? 'Local safety guardrail (no AI call)' : <>Model <strong>{out.model || 'not reported'}</strong> via Groq (free tier)</>}
            {' · '}{out.route || 'route not reported'}
            {out.cached ? ' · stored interpretation (not fresh inference)' : ' · new response'}
            {out.fallbacks?.length ? ` · ${out.fallbacks.length} earlier model attempt(s) failed` : ''}
            {out.neurons != null ? ` · ${out.neurons.toFixed(1)} neurons on original generation` : ''}
            {out.generatedAt ? ` · ${new Date(out.generatedAt).toUTCString()}` : ''}.
            {out.availability ? ` ${out.availability}.` : ''}
        </Caption>
    );
}

function Field({ label, value }: { label: string; value: unknown }) {
    if (value == null) return null;
    if (Array.isArray(value)) {
        return (
            <div className="si-field">
                <div className="si-field-label">{label}</div>
                <ul>{value.map((v, i) => <li key={i}>{String(v)}</li>)}</ul>
            </div>
        );
    }
    return (
        <div className="si-field">
            <div className="si-field-label">{label}</div>
            <p>{String(value)}</p>
        </div>
    );
}

function outageCopy(out: SiResult): string {
    const reset = new Date();
    reset.setUTCHours(24, 0, 0, 0);
    const resetLocal = reset.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' });
    const fallback = ' Previously stored valid answers, deterministic search, and the simulation remain available.';
    switch (out.reason) {
        case 'demo_allowance':
            return `Not enough free demo allowance remains for this fresh SI request. The allowance resets at 00:00 UTC (${resetLocal} your time).${fallback}`;
        case 'provider_pace':
            return `Too many SI requests in the current minute window (the app's pace guard or the provider's per-minute limit). Wait about a minute and try again.${fallback}`;
        case 'provider_quota':
            return `The AI provider rejected the request for quota. Its free tier has per-minute and per-day limits per model: a per-minute limit recovers within about a minute; a per-day limit only after the provider's daily window rolls over. Try again shortly; if it keeps failing today, try again later.${fallback}`;
        case 'invalid_output':
            return `The AI model's answer did not pass the source-checking gates (verbatim evidence quotes and source tags), so it was not shown. That fail-closed behavior is intentional.${fallback}`;
        case 'provider_timeout':
            return `The SI provider did not answer in time.${fallback}`;
        case 'provider_unavailable':
        case 'budget_storage_unavailable':
        case 'budget_storage_or_provider_unavailable':
            return `Fresh SI answers are temporarily unavailable.${fallback}`;
        default:
            return out.error || `Fresh SI answers are temporarily unavailable.${fallback}`;
    }
}

const NASA_TEXT_FIELDS = new Set(['objective', 'approach', 'hypothesis', 'impacts', 'publications', 'conditionTables']);

function passageSourceLabel(kind: string | undefined, field: string): string {
    if (NASA_TEXT_FIELDS.has(field)) return 'NASA record text';
    if (field === 'teamSummary' || field === 'teamHabitatRelevance') return 'team annotation, not NASA text';
    return kind === 'investigate' ? 'record metadata' : 'team-curated index metadata';
}

type EvidenceEntry = { id: string; field: string; quote?: string; passage?: number; claimIndex?: number };

function EvidenceList({ out, byId }: { out: SiResult; byId: Record<string, Investigation> }) {
    const r = out.result;
    if (!r || !Array.isArray(r.evidence) || r.evidence.length === 0) return null;
    const claims: string[] = Array.isArray(r.keyFindings) ? (r.keyFindings as string[])
        : Array.isArray(r.ranking) ? (r.ranking as { why: string }[]).map((x) => x.why)
        : Array.isArray(r.crossCuttingInsights) ? (r.crossCuttingInsights as string[])
        : [];
    return (
        <div className="si-field">
            <div className="si-field-label">Cited source passages</div>
            <ul>
                {(r.evidence as EvidenceEntry[]).map((e, i) => (
                    <li key={i}>
                        <strong>{e.id}</strong> · {e.field}
                        {typeof e.passage === 'number' ? ` passage ${e.passage}` : ''} · {passageSourceLabel(out.kind, String(e.field))}
                        {e.quote ? <>: {'"'}{e.quote}{'"'}</> : null}
                        {typeof e.claimIndex === 'number' && claims[e.claimIndex] ? <> - cited for: {'"'}{claims[e.claimIndex]}{'"'}</> : null}
                        {byId[e.id]?.psiUrl ? <> (<TextLink href={byId[e.id].psiUrl}>PSI record</TextLink>)</> : null}
                    </li>
                ))}
            </ul>
            <Caption>Exact passages show what the model cited so its claims can be checked against the source. A faithful citation does not prove the interpretation is correct.</Caption>
        </div>
    );
}

function ResultCard({ out, byId }: { out: SiResult; byId: Record<string, Investigation> }) {
    if (!out.ok) return <Callout title="SI engine" tone="warning">{outageCopy(out)}</Callout>;
    const r = out.result;
    return (
        <div className="si-card">
            <Callout title={out.route==='local-safety-guardrail'?'Safety guardrail':'SI-generated interpretation'} tone="note">
                {out.route==='local-safety-guardrail' ? 'This is a fixed safety notice. No AI inference was needed.' : 'This text was produced by a third-party AI model. It may be wrong or incomplete. It is separate from deterministic physics and verbatim search. Verify claims against the cited record fields.'}
            </Callout>
            {r ? <>
                <Field label="Summary" value={r.summary} />
                <Field label="Key findings" value={r.keyFindings} />
                <Field label="Fire-safety relevance" value={r.fireSafetyRelevance} />
                <Field label="Themes" value={r.themes} />
                <Field label="Cross-cutting insights" value={r.crossCuttingInsights} />
                <Field label="Coverage gaps" value={r.coverageGaps} />
                <Field label="Limitations" value={r.limitations} />
                {Array.isArray(r.ranking) && (
                    <div className="si-field">
                        <div className="si-field-label">SI ranking</div>
                        <ol>
                            {(r.ranking as { id: string; why: string }[]).map((x) => (
                                <li key={x.id}><strong>{x.id}</strong> - {x.why}</li>
                            ))}
                        </ol>
                    </div>
                )}
                <Field label="Note" value={r.note} />
                <Field label="Uncertainty" value={r.uncertainty} />
            </> : <Paragraph>{out.raw || 'No content returned.'}</Paragraph>}
            <EvidenceList out={out} byId={byId} />
            <Badge out={out} />
        </div>
    );
}

const LABELS: Record<string, string> = {
    summary: 'Summary', keyFindings: 'Key findings', fireSafetyRelevance: 'Fire-safety relevance',
};

export function Si({ data, byId }: { data: Dataset; byId: Record<string, Investigation> }) {
    const invOptions = [
        { value: '', label: 'Choose an investigation' },
        ...data.investigations.map((i) => ({ value: i.id, label: `${i.id}${i.acronym ? ` · ${i.acronym}` : ''}` })),
    ];
    const [invId, setInvId] = useState(invOptions[1]?.value || '');
    const [criterion, setCriterion] = useState('most relevant to preventing fire in a crewed spacecraft habitat');
    const syn = useSi();
    const inv = useSi();
    const rnk = useSi();

    return <>
        <Group label="SI engine" heading="SI-powered interpretation of the NASA record">
            <Paragraph>
                This tab is the dashboard's super intelligence (SI) layer. On request, the frozen NASA PSI records
                are sent through a Cloudflare Worker to the Groq API on its free tier, using a priority waterfall
                of AI models until one answers. The model interprets, summarizes or ranks the record and must cite
                the exact record fields it used. Everything else in this dashboard - the search, the physics
                simulation, the ship check - is deterministic and does not use an AI model.
            </Paragraph>
            <Callout title="Read this before trusting an SI answer" tone="warning">
                SI output is an interpretation that can be wrong. Source tags and verbatim evidence aid checking but do not prove that an interpretation is correct; check it against
                the linked NASA PSI record. Your question text is processed by third-party AI providers together with the
                app's record content: interpreting one record sends that record's fields (NASA original text or team
                annotations); ranking and cross-record synthesis send team-curated summaries (team annotations drawn
                from the public NASA PSI records). Do not enter personal or sensitive information. Network requests also expose an IP address to the service providers. Interpretations never certify hardware as safe.
            </Callout>
        </Group>

        <Group label="Synthesize" heading="Cross-investigation SI synthesis">
            <Paragraph>
                One click asks the SI engine to read all {data.investigations.length} investigation summaries and pull
                out themes, cross-cutting insights and coverage gaps for spacecraft fire safety.
            </Paragraph>
            <button className="si-go" disabled={syn.busy} onClick={() => syn.run({ kind: 'synthesize' })}>
                {syn.busy ? 'Asking the SI engine...' : 'Synthesize the whole record'}
            </button>
            {syn.out && <ResultCard out={syn.out} byId={byId} />}
        </Group>

        <Group label="Interpret" heading="SI interpretation of one investigation">
            <div className="k-field">
                <p className="k-field-label">Investigation</p>
                <select className="si-select" value={invId} onChange={(e) => setInvId(e.target.value)}>
                    {invOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
            </div>
            {invId && byId[invId] && (
                <Caption>
                    Record interpreted: <TextLink href={byId[invId].psiUrl}>{byId[invId].title}</TextLink>
                </Caption>
            )}
            <button className="si-go" disabled={inv.busy || !invId} onClick={() => inv.run({ kind: 'investigate', id: invId })}>
                {inv.busy ? 'Interpreting...' : `Interpret ${invId} with SI`}
            </button>
            {inv.out && <ResultCard out={inv.out} byId={byId} />}
        </Group>

        <Group label="Rank" heading="SI re-ranking by your criterion">
            <Paragraph>
                The deterministic Rank tab scores investigations by fixed weights. Here the SI engine reads the same
                records and ranks them for a criterion you phrase yourself, explaining each pick from record fields.
            </Paragraph>
            <TextField label="Criterion" value={criterion} onChange={setCriterion} />
            <Caption>
                Your criterion is sent to Groq together with the app's team-curated record summaries (team annotations drawn from the public NASA PSI records). Groq states it does not
                use submitted content to train its models by default. Do not enter personal or private
                information; ask about the public research records only.
            </Caption>
            <button className="si-go" disabled={rnk.busy || criterion.trim().length < 4} onClick={() => rnk.run({ kind: 'rank', query: criterion })}>
                {rnk.busy ? 'Ranking...' : 'Rank with SI'}
            </button>
            {rnk.out && <ResultCard out={rnk.out} byId={byId} />}
        </Group>
    </>;
      }

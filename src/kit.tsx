// kit.tsx - the app's own UI component layer and hash router.
// Standard React only; no external UI dependencies.
import React, {
    createContext, useContext, useEffect, useState,
} from 'react';

/* ---------- hash router ---------- */

const RouterCtx = createContext<{ path: string }>({ path: '/' });

function readPath(): string {
    const h = window.location.hash.replace(/^#/, '');
    return h.startsWith('/') ? h : '/';
}

export function FileRouter({ children }: { children: React.ReactNode }) {
    const [path, setPath] = useState(readPath());
    useEffect(() => {
        const on = () => { setPath(readPath()); window.scrollTo(0, 0); };
        window.addEventListener('hashchange', on);
        return () => window.removeEventListener('hashchange', on);
    }, []);
    return <RouterCtx.Provider value={{ path }}>{children}</RouterCtx.Provider>;
}

export function Routes({ children }: { children: React.ReactNode }) {
    const { path } = useContext(RouterCtx);
    let match: React.ReactElement | null = null;
    React.Children.forEach(children, (child) => {
        if (match || !React.isValidElement(child)) return;
        if ((child.props as { path?: string }).path === path) match = child;
    });
    return match ? (match.props as { element?: React.ReactNode }).element ?? null : null;
}

export function Route(_props: { path: string; element: React.ReactNode }) {
    return null;
}

export function Link({ to, children, className, style }: {
    to: string; children: React.ReactNode; className?: string; style?: React.CSSProperties;
}) {
    return <a className={className} style={style} href={`#${to}`}>{children}</a>;
}

export function NavLink({ to, end, children }: {
    to: string; end?: boolean; children: React.ReactNode;
}) {
    const { path } = useContext(RouterCtx);
    const active = end ? path === to : path === to || path.startsWith(`${to}/`);
    return <a href={`#${to}`} className={active ? 'active' : undefined} aria-current={active ? 'page' : undefined}>{children}</a>;
}

export function TextLink({ href, children }: { href: string; children: React.ReactNode }) {
    return <a className="k-textlink" href={href} target="_blank" rel="noreferrer">{children}</a>;
}

export function ButtonLink({ href, children }: { href: string; children: React.ReactNode }) {
    return <a className="k-buttonlink" href={href} target="_blank" rel="noreferrer">{children}</a>;
}

/* ---------- layout ---------- */

export function FileCard({ children }: { children: React.ReactNode }) {
    return <div className="k-filecard">{children}</div>;
}

export function Group({ label, heading, children }: {
    label: string; heading?: string | boolean; children: React.ReactNode;
}) {
    return (
        <section className="k-group">
            <p className="k-eyebrow">{label}</p>
            {typeof heading === 'string' && heading ? <h2 className="k-heading">{heading}</h2> : null}
            {children}
        </section>
    );
}

export function Paragraph({ children }: { children: React.ReactNode }) {
    return <p className="k-paragraph">{children}</p>;
}

export function Caption({ children }: { children: React.ReactNode }) {
    return <p className="k-caption">{children}</p>;
}

export function Text({ children }: { children: React.ReactNode }) {
    return <div className="k-text">{children}</div>;
}

export function KeySentence({ children }: { children: React.ReactNode }) {
    return <p className="k-keysentence">{children}</p>;
}

export function Heading({ sub, children }: { sub?: string; children: React.ReactNode }) {
    return (
        <h3 className="k-subheading">
            {sub ? <span className="k-heading-sub">{sub}</span> : null}
            {children}
        </h3>
    );
}

export function Callout({ title, tone, children }: {
    title: string; tone?: string; children: React.ReactNode;
}) {
    return (
        <aside className={`k-callout${tone ? ` k-callout-${tone}` : ''}`}>
            <p className="k-callout-title">{title}</p>
            <div>{children}</div>
        </aside>
    );
}

export function Closing({ children }: { children: React.ReactNode }) {
    return <footer className="k-closing">{children}</footer>;
}

/* ---------- data display ---------- */

export function Facts({ items }: { items: { label: string; value: React.ReactNode }[] }) {
    return (
        <dl className="k-facts">
            {items.map((it, i) => (
                <div className="k-fact" key={i}>
                    <dt>{it.label}</dt>
                    <dd>{it.value}</dd>
                </div>
            ))}
        </dl>
    );
}

export function Bullets({ items }: { items: string[] }) {
    return <ul className="k-bullets">{items.map((t, i) => <li key={i}>{t}</li>)}</ul>;
}

export function NumberedList({ items }: { items: string[] }) {
    return <ol className="k-numbered">{items.map((t, i) => <li key={i}>{t}</li>)}</ol>;
}

export function Rows({ numbered, children }: { numbered?: boolean; children: React.ReactNode }) {
    const Tag = (numbered ? 'ol' : 'ul') as 'ul';
    return <Tag className="k-rows">{children}</Tag>;
}

export function Row({ number, name, detail, value, valueKnown }: {
    number?: number; name: React.ReactNode; detail?: React.ReactNode;
    value?: React.ReactNode; valueKnown?: boolean;
}) {
    return (
        <li className="k-row">
            <span className="k-row-main">
                {number != null ? <span className="k-row-number">{number}.</span> : null}
                <span className="k-row-name">{name}</span>
                {detail ? <span className="k-row-detail">{detail}</span> : null}
            </span>
            {value ? (
                <span className={`k-row-value${valueKnown ? '' : ' k-row-unknown'}`}>{value}</span>
            ) : null}
        </li>
    );
}

export function Table({ caption, options, rows }: {
    caption?: string;
    options: { number: number; name: string }[];
    rows: { label: string; values: React.ReactNode[] }[];
}) {
    return (
        <figure className="k-table-wrap">
            {caption ? <figcaption className="k-caption">{caption}</figcaption> : null}
            <div className="k-table-scroll">
                <table className="k-table">
                    <thead>
                        <tr>
                            <th />
                            {options.map((o) => <th key={o.number}>{o.name}</th>)}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((r, i) => (
                            <tr key={i}>
                                <th>{r.label}</th>
                                {r.values.map((v, j) => <td key={j}>{v}</td>)}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </figure>
    );
}

export function Photos({ label, title, items, layout }: {
    label: string; title?: string;
    items: { src: string; alt: string }[]; layout?: string;
}) {
    return (
        <figure className={`k-photos k-photos-${layout || 'grid'}`} aria-label={label}>
            {title ? <figcaption className="k-caption">{title}</figcaption> : null}
            <div className="k-photos-track">
                {items.map((p, i) => <img key={i} src={p.src} alt={p.alt} loading="lazy" />)}
            </div>
        </figure>
    );
}

/* ---------- inputs ---------- */

export function ChoiceRow({ label, options, value, onChange }: {
    label: string;
    options: { value: string; label: string }[];
    value: string;
    onChange: (v: string) => void;
}) {
    return (
        <div className="k-field">
            <p className="k-field-label">{label}</p>
            <div className="k-choices">
                {options.map((o) => (
                    <button
                        key={o.value}
                        type="button"
                        className={o.value === value ? 'on' : ''}
                        aria-pressed={o.value === value}
                        onClick={() => onChange(o.value)}
                    >{o.label}</button>
                ))}
            </div>
        </div>
    );
}

export function Slider({ label, min, max, step, value, onChange, describe }: {
    label: string; min: number; max: number; step?: number;
    value: number; onChange: (v: number) => void;
    describe?: (v: number) => string;
}) {
    return (
        <div className="k-field">
            <p className="k-field-label">
                {label}
                {describe ? <span className="k-field-value">{describe(value)}</span> : null}
            </p>
            <input
                type="range"
                min={min}
                max={max}
                step={step ?? 1}
                value={value}
                aria-label={label}
                onChange={(e) => onChange(Number(e.target.value))}
            />
        </div>
    );
}

export function TextField({ label, value, onChange, placeholder }: {
    label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
    return (
        <div className="k-field">
            <p className="k-field-label">{label}</p>
            <input
                type="text"
                value={value}
                placeholder={placeholder}
                aria-label={label}
                onChange={(e) => onChange(e.target.value)}
            />
        </div>
    );
}

/* ---------- charts ---------- */

export function BarChart({ label, data }: {
    label: string; data: { label: string; value: number }[];
}) {
    const max = Math.max(1, ...data.map((d) => d.value));
    return (
        <figure className="k-barchart">
            <figcaption className="k-field-label">{label}</figcaption>
            {data.map((d, i) => (
                <div className="k-bar-row" key={i}>
                    <span className="k-bar-label">{d.label}</span>
                    <span className="k-bar-track">
                        <span className="k-bar-fill" style={{ width: `${(d.value / max) * 100}%` }} />
                    </span>
                    <span className="k-bar-value">{d.value}</span>
                </div>
            ))}
        </figure>
    );
}

export function RangeChart({ label, legend, rows, range, scaleLabels }: {
    label: string; legend?: string;
    rows: { label: string; low: number; now: number; high: number; highlight?: boolean }[];
    range: [number, number]; scaleLabels?: string[];
}) {
    const [lo, hi] = range;
    const pct = (v: number) => `${((v - lo) / (hi - lo)) * 100}%`;
    return (
        <figure className="k-rangechart">
            <figcaption className="k-field-label">{label}</figcaption>
            {legend ? <p className="k-caption">{legend}</p> : null}
            {rows.map((r, i) => (
                <div className={`k-range-row${r.highlight ? ' k-range-highlight' : ''}`} key={i}>
                    <span className="k-bar-label">{r.label}</span>
                    <span className="k-range-track">
                        <span
                            className="k-range-band"
                            style={{ left: pct(r.low), width: `${((r.high - r.low) / (hi - lo)) * 100}%` }}
                        />
                        <span className="k-range-dot" style={{ left: pct(r.now) }} />
                    </span>
                    <span className="k-bar-value">{r.low}-{r.high}</span>
                </div>
            ))}
            {scaleLabels ? (
                <div className="k-range-scale">
                    {scaleLabels.map((s, i) => <span key={i}>{s}</span>)}
                </div>
            ) : null}
        </figure>
    );
}

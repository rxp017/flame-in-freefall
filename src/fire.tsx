import React, { useEffect, useMemo, useRef, useState } from 'react';
import { predictK, flameStandoff, nominalLifetimeS, residualSpread, Fuel, Transport } from './forward';

/* ------------------------------------------------------------------ */
/* The fire scene: ONE complete scenario, judged as an experience.     */
/* Computed (labelled): K, droplet D(t) by d^2-law, flame/droplet      */
/* ratio, nominal d-squared end time. Decorative (labelled): texture,   */
/* embers, scene lighting. Methanol flames really are blue and faint;  */
/* heptane flames really are orange and sooty - that colour choice is  */
/* physical, the texture is not.                                       */
/* ------------------------------------------------------------------ */

const VERT = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const FRAG = `
precision highp float;
uniform vec2 u_res;
uniform float u_time;
uniform vec2 u_center;     // flame centre, px (y up)
uniform float u_dropR;     // droplet radius, px
uniform float u_flameR;    // flame radius, px
uniform float u_fuel;      // 0 methanol, 1 heptane
uniform float u_o2;        // 0..1 oxygen fraction
uniform vec2 u_lean;       // pointer lean, px
uniform float u_tf;        // flame temperature K (drives brightness only)
uniform float u_fade;      // 1 burning, 0 dark (nominal end / ignition fade)

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x),
               mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + vec2(19.7, 7.3); a *= 0.5; }
    return v;
}

void main() {
    vec2 frag = gl_FragCoord.xy;
    vec2 p = frag - u_center;

    // pointer lean: shear grows with height above the droplet (visual only)
    p.x -= u_lean.x * clamp(p.y / (u_flameR * 2.0), 0.0, 1.2) * 0.35;
    p.y -= u_lean.y * clamp(length(p) / (u_flameR * 2.0), 0.0, 1.0) * 0.10;

    float rPx = length(p);
    float r = rPx / u_flameR;

    // --- flame body (decorative texture over a computed envelope) ---
    float vigor = 0.9 + 1.6 * u_o2;             // lean flames churn slower
    float t = u_time * (1.1 + 0.8 * u_o2);
    vec2 q = p / u_flameR;
    float ang = atan(p.y, p.x);
    float nR = fbm(vec2(cos(ang), sin(ang)) * 2.1 + vec2(0.0, r * 4.2 - t * 2.3)); // tongues, seam-free in angle
    float nT = fbm(q * 3.1 + vec2(0.0, -t * 1.2));         // interior churn
    float edge = r + (nR - 0.5) * 0.30 + (nT - 0.5) * 0.10;
    float shell = exp(-pow((edge - 0.88) * 4.6, 2.0));      // luminous shell AT the flame radius
    float inner = smoothstep(0.75, 0.15, r) * 0.14;          // dim vapor zone inside
    float flick = 0.90 + 0.10 * sin(u_time * (7.0 + 6.0 * u_o2) + nR * 22.0) * vigor * 0.5;
    float tb = clamp((u_tf - 1100.0) / 1400.0, 0.45, 1.25);  // brightness from computed Tf

    // methanol: blue, less luminous; heptane: bright orange soot
    vec3 edgeCol = mix(vec3(0.10, 0.30, 1.00), vec3(1.00, 0.34, 0.04), u_fuel);
    vec3 coreCol = mix(vec3(0.42, 0.62, 1.00), vec3(1.00, 0.82, 0.30), u_fuel);
    float alphaScale = mix(0.85, 1.30, u_fuel);

    float I = (shell * (0.45 + 0.85 * nR) * 1.6 + inner * (0.4 + 0.6 * nT)) * flick * tb * alphaScale * u_fade;
    vec3 flame = mix(edgeCol, coreCol, clamp(shell * 0.85, 0.0, 1.0)) * I;

    // soft glow halo + wide bloom
    float halo = exp(-r * 2.2) * 0.34 * alphaScale * tb * u_fade;
    float bloom = exp(-r * 0.9) * 0.10 * alphaScale * tb * u_fade;
    flame += edgeCol * (halo + bloom);

    // --- background: near-black with faint drifting embers/stars ---
    vec2 bg = frag / u_res;
    float vig = smoothstep(1.25, 0.35, length(bg - vec2(0.5, 0.42)) * 1.4);
    vec3 col = vec3(0.012, 0.012, 0.020) * (0.35 + 0.65 * vig);
    vec2 cell = floor(frag / 3.0);
    float star = step(0.9985, hash(cell)) * (0.25 + 0.75 * hash(cell + 7.0));
    star *= 0.5 + 0.5 * sin(u_time * 0.8 + hash(cell) * 40.0);
    col += vec3(0.5, 0.6, 0.9) * star * 0.10 * (1.0 - I * 4.0);

    col += flame;

    // --- droplet: dark sphere with rim light, occludes the flame ---
    if (rPx < u_dropR) {
        vec3 nrm = vec3(p / u_dropR, sqrt(max(0.0, 1.0 - dot(p / u_dropR, p / u_dropR))));
        float rim = pow(1.0 - nrm.z, 3.0);
        float lit = clamp(dot(nrm, normalize(vec3(-0.4, 0.7, 0.6))), 0.0, 1.0);
        vec3 skin = vec3(0.010, 0.012, 0.022) + vec3(0.06, 0.08, 0.12) * lit * 0.30;
        skin += mix(vec3(0.25, 0.42, 1.0), vec3(1.0, 0.55, 0.15), u_fuel) * rim * 0.30 * u_fade;
        float spec = pow(clamp(dot(nrm, normalize(vec3(-0.35, 0.6, 0.72))), 0.0, 1.0), 24.0);
        skin += vec3(0.5, 0.6, 0.8) * spec * 0.35;
        col = mix(col, skin, 0.92);
    }

    // subtle filmic lift + gamma
    col = pow(max(col, 0.0), vec3(0.9));
    gl_FragColor = vec4(col, 1.0);
}
`;

function makeGL(canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl', { antialias: true, alpha: false });
    if (!gl) return null;
    const sh = (type: number, src: string) => {
        const s = gl.createShader(type)!;
        gl.shaderSource(s, src); gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || 'shader');
        return s;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog); gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const U = (n: string) => gl.getUniformLocation(prog, n)!;
    return {
        gl,
        u: {
            res: U('u_res'), time: U('u_time'), center: U('u_center'), dropR: U('u_dropR'),
            flameR: U('u_flameR'), fuel: U('u_fuel'), o2: U('u_o2'), lean: U('u_lean'),
            tf: U('u_tf'), fade: U('u_fade'),
        },
    };
}

const DILUENTS = [
    { v: 'N2', label: 'Nitrogen' },
    { v: 'CO2', label: 'Carbon dioxide' },
    { v: 'He', label: 'Helium' },
];

export function FireScene() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const traceRef = useRef<HTMLCanvasElement>(null);
    const [fuel, setFuel] = useState<Fuel>('Methanol');
    const [diluent, setDiluent] = useState('N2');
    const [o2, setO2] = useState(21);
    const [p, setP] = useState(1);
    const [d0, setD0] = useState(1.5);
    const [transport, setTransport] = useState<Transport>('fit');
    const [hud, setHud] = useState({ d: d0, t: 0, fade: 1 });

    const dil = useMemo(() => ({ [diluent]: 1 - o2 / 100 }), [diluent, o2]);
    const pred = useMemo(() => predictK(fuel, o2, dil, p, transport), [fuel, o2, dil, p, transport]);
    const other = useMemo(() => predictK(fuel, o2, dil, p, transport === 'fit' ? 'chung' : 'fit'), [fuel, o2, dil, p, transport]);
    const standoff = useMemo(() => flameStandoff(fuel, o2, dil, pred.B), [fuel, o2, dil, pred.B]);
    const life = nominalLifetimeS(d0, pred.K);
    const spread = residualSpread(transport, fuel, diluent);

    // pointer lean
    const lean = useRef({ x: 0, y: 0, tx: 0, ty: 0 });
    useEffect(() => {
        const el = canvasRef.current;
        if (!el) return;
        const move = (e: PointerEvent) => {
            const r = el.getBoundingClientRect();
            lean.current.tx = ((e.clientX - r.left) / r.width - 0.5) * 2 * 40;
            lean.current.ty = ((e.clientY - r.top) / r.height - 0.5) * 2 * 40;
        };
        el.addEventListener('pointermove', move);
        return () => el.removeEventListener('pointermove', move);
    }, []);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        let ctx: ReturnType<typeof makeGL> = null;
        try { ctx = makeGL(canvas); } catch { ctx = null; }
        if (!ctx) return;
        const { gl, u } = ctx;
        let raf = 0;
        const t0 = performance.now();
        const IGNITE = 0.9;   // seconds of ignition rise
        const OUT = 1.2;      // nominal d-squared end fade

        const frame = () => {
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            const w = canvas.clientWidth * dpr, h = canvas.clientHeight * dpr;
            if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; gl.viewport(0, 0, w, h); }

            const now = (performance.now() - t0) / 1000;
            const cycle = IGNITE + life + OUT + 0.8;
            const tc = now % cycle;

            let fade = 1, frac = 0; // frac of burn completed
            if (tc < IGNITE) { fade = tc / IGNITE; frac = 0; }
            else if (tc < IGNITE + life) { fade = 1; frac = (tc - IGNITE) / life; }
            else if (tc < IGNITE + life + OUT) { fade = 1 - (tc - IGNITE - life) / OUT; frac = 1; }
            else { fade = 0; frac = 1; }

            // d^2 law: D^2 = D0^2 (1 - frac)
            const dNow = d0 * Math.sqrt(Math.max(0, 1 - frac));
            const pxPerMm = Math.min(w, h) * 0.52 / (standoff * d0);   // initial flame diameter ~52% of frame
            const dropR = Math.max(dNow / 2 * pxPerMm, 0.0);
            // MODELED BURN (fade = 1): flameR = standoff x LIVE droplet radius exactly -
            // on-screen ratio equals the computed ratio at every instant and the shell
            // shrinks with the droplet under the d-squared law; no finite flame at 0 mm.
            // IGNITION and END FADE are outside the modeled phase (decorative, labelled):
            // radius ramps up during ignition, and u_fade drives the scene to black at the
            // nominal d-squared end. The 0.5px floor only guards shader division at droplet
            // zero; nothing physical is claimed at subpixel radius.
            const flameR = Math.max(standoff * dNow / 2 * pxPerMm * (0.35 + 0.65 * Math.min(fade * 2, 1)), 0.5);

            lean.current.x += (lean.current.tx - lean.current.x) * 0.06;
            lean.current.y += (lean.current.ty - lean.current.y) * 0.06;

            const cx = w / 2, cy = h * 0.46;
            gl.uniform2f(u.res, w, h);
            gl.uniform1f(u.time, now);
            gl.uniform2f(u.center, cx, cy);
            gl.uniform1f(u.dropR, dropR);
            gl.uniform1f(u.flameR, flameR);
            gl.uniform1f(u.fuel, fuel === 'Heptane' ? 1 : 0);
            gl.uniform1f(u.o2, o2 / 100);
            gl.uniform2f(u.lean, lean.current.x * dpr, lean.current.y * dpr);
            gl.uniform1f(u.tf, pred.Tf);
            gl.uniform1f(u.fade, Math.max(fade, 0));
            gl.drawArrays(gl.TRIANGLES, 0, 3);

            setHud((prev) => (Math.abs(prev.t - (tc - IGNITE)) > 0.08 || prev.d !== dNow || prev.fade !== fade
                ? { d: dNow, t: Math.min(Math.max(tc - IGNITE, 0), life), fade } : prev));

            // live d^2 trace
            const tr = traceRef.current;
            if (tr) {
                const c2 = tr.getContext('2d');
                if (c2) {
                    const tw = tr.clientWidth * dpr, th = tr.clientHeight * dpr;
                    if (tr.width !== tw || tr.height !== th) { tr.width = tw; tr.height = th; }
                    c2.clearRect(0, 0, tw, th);
                    c2.strokeStyle = 'rgba(120,140,200,0.25)';
                    c2.strokeRect(0.5, 0.5, tw - 1, th - 1);
                    // theory line D^2/D0^2 = 1 - t/life
                    c2.strokeStyle = 'rgba(90,200,160,0.9)'; c2.lineWidth = 2 * dpr;
                    c2.beginPath(); c2.moveTo(0, 0); c2.lineTo(tw, th); c2.stroke();
                    // progress marker
                    const mx = frac * tw, my = frac * th;
                    c2.fillStyle = '#ffd27a';
                    c2.beginPath(); c2.arc(mx, my, 3.5 * dpr, 0, 7); c2.fill();
                }
            }
            raf = requestAnimationFrame(frame);
        };
        raf = requestAnimationFrame(frame);
        return () => cancelAnimationFrame(raf);
    }, [fuel, diluent, o2, p, d0, transport, pred, standoff, life]);

    const dilLabel = diluent === 'N2' ? 'nitrogen' : diluent === 'CO2' ? 'carbon dioxide' : 'helium';

    return (
        <section className="fire-scene" aria-label="Fire scenario prototype">
            <div className="fire-stage">
                <canvas ref={canvasRef} className="fire-canvas" />
                <div className="fire-top">
                    <div>
                        <div className="fire-kicker">PROTOTYPE - ONE COMPLETE SCENARIO</div>
                        <h2 className="fire-title">A {fuel.toLowerCase()} droplet, burning in freefall</h2>
                        <div className="fire-sub">
                            {o2}% oxygen in {dilLabel}, {p.toFixed(2)} atm, droplet {d0.toFixed(1)} mm
                        </div>
                    </div>
                    <div className="fire-variant">
                        <button className={transport === 'fit' ? 'on' : ''} onClick={() => setTransport('fit')}>Extrapolated NIST vapor fit</button>
                        <button className={transport === 'chung' ? 'on' : ''} onClick={() => setTransport('chung')}>Chung 1988 variant</button>
                    </div>
                </div>
            </div>

            <div className="fire-panel">
                <div className="fire-variant fire-variant-panel">
                    <button className={transport === 'fit' ? 'on' : ''} onClick={() => setTransport('fit')}>Extrapolated NIST vapor fit</button>
                    <button className={transport === 'chung' ? 'on' : ''} onClick={() => setTransport('chung')}>Chung 1988 variant</button>
                </div>
                <div className="fire-readouts">
                    <div><span>Droplet</span><strong>{hud.d.toFixed(2)} mm</strong></div>
                    <div><span>Burn rate K</span><strong>{pred.K.toFixed(2)} mm2/s</strong><em>other candidate: {other.K.toFixed(2)}</em></div>
                    <div><span>Flame / droplet (theory)</span><strong>{standoff.toFixed(1)}x</strong><em>classical estimate - overpredicts observed ratios</em></div>
                    <div><span>Elapsed</span><strong>{hud.t.toFixed(1)} s</strong><em>nominal d-squared end {life.toFixed(1)} s - not a predicted extinction, not validated</em></div>
                    <div><span>Flame temp (model)</span><strong>{pred.Tf.toFixed(0)} K</strong><em>construct, not a measurement</em></div>
                    <div className="fire-trace">
                        <canvas ref={traceRef} />
                        <div className="fire-trace-label">d-squared law, live: diameter squared falls on a straight line (computed)</div>
                    </div>
                </div>

                <div className="fire-controls">
                    <div className="fire-chips">
                        {(['Methanol', 'Heptane'] as Fuel[]).map((f) => (
                            <button key={f} className={fuel === f ? 'on' : ''} onClick={() => setFuel(f)}>{f}</button>
                        ))}
                    </div>
                    <div className="fire-chips">
                        {DILUENTS.map((d) => (
                            <button key={d.v} className={diluent === d.v ? 'on' : ''} onClick={() => setDiluent(d.v)}>{d.label}</button>
                        ))}
                    </div>
                    <label>Oxygen <input type="range" min={12} max={34} value={o2} onChange={(e) => setO2(+e.target.value)} /> <b>{o2}%</b></label>
                    <label>Pressure <input type="range" min={0.69} max={3.05} step={0.01} value={p} onChange={(e) => setP(+e.target.value)} /> <b>{p.toFixed(2)} atm</b></label>
                    <label>Droplet <input type="range" min={0.5} max={4} step={0.1} value={d0} onChange={(e) => setD0(+e.target.value)} /> <b>{d0.toFixed(1)} mm</b></label>
                </div>

                <div className="fire-honesty">
                    <span><i className="dot computed" /> Computed: burn rate, droplet size, timing; flame size is a theory estimate (see above)</span>
                    <span><i className="dot decorative" /> Decorative: flame texture, flicker, pointer lean, embers</span>
                    {spread && (
                        <span><i className="dot graded" /> Vs {spread[4]} recorded NASA {fuel} tests ({dilLabel}-dominant blends): the {transport === 'fit' ? 'Extrapolated NIST vapor fit' : 'Chung 1988 variant'} candidate's past errors - signed median {spread[0]}%, median absolute {spread[1]}%, middle 80% {spread[2]}% to {spread[3]}%. Not a promise for any single run.</span>
                    )}
                    {pred.lamExtrapolated && <span><i className="dot decorative" /> This candidate extrapolates the published vapor conductivity past its sourced range here; the Chung variant does not.</span>}
                </div>
            </div>
        </section>
    );
}

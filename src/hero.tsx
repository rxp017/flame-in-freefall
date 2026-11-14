import React, { useEffect, useRef } from 'react';
import { Link } from './kit';
import heroFlame from './photos/iss040e086481.jpg';

/**
 * Home hero: a full-bleed dark panel with the NASA BASS-II flame photograph,
 * an ember canvas (decorative, labeled illustrative) and the entry points.
 */

interface Ember {
    x: number; y: number; r: number; vy: number; vx: number; life: number; max: number;
}

function EmberCanvas() {
    const ref = useRef<HTMLCanvasElement>(null);
    useEffect(() => {
        const canvas = ref.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        let raf = 0;
        let embers: Ember[] = [];
        const resize = () => {
            canvas.width = canvas.clientWidth * (window.devicePixelRatio || 1);
            canvas.height = canvas.clientHeight * (window.devicePixelRatio || 1);
        };
        resize();
        window.addEventListener('resize', resize);
        const spawn = (): Ember => ({
            x: Math.random() * canvas.width,
            y: canvas.height * (0.55 + Math.random() * 0.45),
            r: (0.8 + Math.random() * 2.2) * (window.devicePixelRatio || 1),
            vy: -(0.25 + Math.random() * 0.8) * (window.devicePixelRatio || 1),
            vx: (Math.random() - 0.5) * 0.35 * (window.devicePixelRatio || 1),
            life: 0,
            max: 220 + Math.random() * 260,
        });
        const tick = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            if (embers.length < 46 && Math.random() < 0.5) embers.push(spawn());
            embers = embers.filter((e) => e.life < e.max && e.y > -10);
            for (const e of embers) {
                e.life += 1;
                e.x += e.vx + Math.sin((e.life + e.max) * 0.03) * 0.3;
                e.y += e.vy;
                const a = Math.max(0, 0.85 * (1 - e.life / e.max));
                const g = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, e.r * 3);
                g.addColorStop(0, `rgba(255,196,120,${a})`);
                g.addColorStop(0.5, `rgba(255,132,60,${a * 0.5})`);
                g.addColorStop(1, 'rgba(255,120,40,0)');
                ctx.fillStyle = g;
                ctx.beginPath();
                ctx.arc(e.x, e.y, e.r * 3, 0, Math.PI * 2);
                ctx.fill();
            }
            raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
    }, []);
    return <canvas ref={ref} className="hero-embers" aria-hidden="true" />;
}

export function Hero(props: {
    stats: { investigations: number; observed: number; planned: number; terabytes: string };
}) {
    return <>
        <section className="hero" aria-label="Flame in Freefall">
            <img className="hero-photo" src={heroFlame}
                alt="A blue flame spreading over a solid fuel sample during NASA's BASS-II investigation on the International Space Station." />
            <div className="hero-shade" />
            <EmberCanvas />
            <div className="hero-copy">
                <p className="hero-eyebrow">NASA Space Apps Challenge 2026 · Team RXP</p>
                <h1 className="hero-title">Flame in Freefall</h1>
                <p className="hero-sub">
                    Fire forgets how to burn when gravity lets go. Explore all 24 combustion-science
                    investigations in NASA's Physical Sciences Informatics archive, reconstruct measured
                    microgravity droplet tests, and check a spacecraft atmosphere against what was recorded.
                </p>
                <div className="hero-stats">
                    <span><strong>{props.stats.investigations}</strong> NASA investigations</span>
                    <span><strong>{props.stats.observed.toLocaleString()}</strong> recorded test rows</span>
                    <span><strong>{props.stats.terabytes}</strong> of archive</span>
                </div>
                <div className="hero-cta">
                    <Link to="/story" className="file-button is-compact">Start the story</Link>
                    <Link to="/simulate" className="file-button is-compact">Reconstruct a real test</Link>
                    <Link to="/check" className="file-button is-compact">Check an atmosphere</Link>
                </div>
                <p className="hero-note">
                    Photo: NASA (BASS-II, ISS). Floating embers are an illustrative animation, not a simulation.
                </p>
            </div>
        </section>
    </>;
}

import { JSDOM } from 'jsdom';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
    url: 'http://localhost/', pretendToBeVisual: true,
});
const w = dom.window;
for (const k of Object.getOwnPropertyNames(w)) {
    if (k in globalThis) continue;
    try { Object.defineProperty(globalThis, k, { value: w[k], configurable: true, writable: true }); } catch (e) {}
}
globalThis.self = w;
w.HTMLCanvasElement.prototype.getContext = () => null;

const html = fs.readFileSync('dist/index.html', 'utf8');
if (!html.includes('type="module"')) throw new Error('dist index.html missing module script');

const jsFile = fs.readdirSync('dist/assets').find((f) => f.endsWith('.js'));
await import(url.pathToFileURL(path.resolve('dist/assets', jsFile)).href);
await new Promise((r) => setTimeout(r, 800));
let text = w.document.body.textContent || '';
const checks = {
    rendered: text.length > 200,
    hasSimulateNav: text.includes('Simulate'),
    hasHeroClaim: text.includes('Fire forgets how to burn'),
};
console.log(JSON.stringify({ textLen: text.length, checks }));
if (!checks.rendered || !checks.hasSimulateNav) { console.log('FAIL', text.slice(0, 300)); process.exit(1); }
console.log('HOME PASS');

for (const route of ['#/story', '#/simulate', '#/check', '#/explore', '#/insights', '#/rank', '#/compare', '#/ask', '#/si', '#/demo']) {
    w.location.hash = route;
    w.dispatchEvent(new w.Event('hashchange'));
    await new Promise((r) => setTimeout(r, 400));
    const t = w.document.body.textContent || '';
    console.log(route, 'len', t.length);
    if (t.length < 500) { console.log('ROUTE FAIL', route, t.slice(0, 200)); process.exit(1); }
}
const t2 = w.document.body.textContent || '';
console.log(JSON.stringify({ picker157: t2.includes('157 recorded, 151 with measured K') }));
w.location.hash = '#/simulate';
w.dispatchEvent(new w.Event('hashchange'));
await new Promise((r) => setTimeout(r, 500));
const t3 = w.document.body.textContent || '';
const sim = { picker: t3.includes('157 recorded, 151 with measured K'), residual: t3.includes('Scored on 135 graded FLEX') };
console.log(JSON.stringify(sim));
if (!sim.picker || !sim.residual) { console.log('SIM FAIL'); process.exit(1); }
console.log('ALL ROUTES PASS');
process.exit(0);

// Public endpoint of the team's SI gateway (a Cloudflare Worker that holds all
// credentials server-side). Safe to ship in the client bundle: the Worker
// validates request shape, rate-limits and never exposes provider keys.
export const SI_ENDPOINT = 'https://fiff-si-gateway.rajashekarreddy99668.workers.dev';

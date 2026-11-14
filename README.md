# Flame in Freefall


An interactive fire-safety dashboard built for the NASA Space Apps Challenge 2026 "Flame in Freefall" challenge. It turns NASA Physical Sciences Informatics (PSI) combustion records into explorable evidence: 24 investigations, 1,984 observed test rows, and a transparent droplet-burning forward model graded against the FLEX (PSI-69) experiment record.

## What it does

- **Explore** - the 24 PSI combustion investigations with objectives, hardware, publications, and per-file statistics, straight from the PSI repository (snapshot 2026-11-14).
- **Ask** - deterministic extractive search over the frozen PSI corpus. No language model; every passage is labeled as either a verbatim NASA record field or an AI-authored annotation, with a link to its source record.
- **Simulate** - a droplet-combustion forward model (d-squared law, Matalon standoff relation, Wassiljewa/Mason-Saxena mixture transport) with two published fuel-vapor conductivity candidates. Each candidate is shown with its signed median, median absolute, and p10-p90 residuals per fuel, diluent and variant cell across the 257-test graded FLEX cohort. The comparison is exploratory; neither candidate is presented as validated.
- **Ship check** - honest-envelope checks: unknown conditions render "not recorded", never estimates.

## Data sources

- NASA PSI data repository, 24 combustion investigations, harvested 2026-11-14: https://psi.nasa.gov/physci/repo/
- FLEX experimental table (PSI-69): https://psi.nasa.gov/physci/repo/data/investigations/PSI-69
- NIST Chemistry WebBook saturation tables (ambient gas properties).
- Cantera HighPressureGasTransport equations (BSD-3-Clause; copyright lines reproduced verbatim in NOTICE.md).
- Poling, Prausnitz & O'Connell, The Properties of Gases and Liquids, 5th ed.
- Matalon Lecture 12, CEFRC Princeton (flame standoff ratio).
- Unit resolution for the PSI-69 CSV header: NTRS 20150023456.

## Running

Standard React + TypeScript + Vite project. `npm install`, then `npm run dev` for a local server or `npm run build` for a production bundle. No external services or API keys required; all data ships in `src/data/`.

## AI assistance

Code, data preparation, and documentation were developed with AI assistance. Outputs were checked against the cited sources. The running application contains no machine-learning model and makes no external AI API calls: all results are deterministic classical physics and extractive retrieval over the cited NASA records. See NOTICE.md.

## License

Copyright 2026 Raja Shekar. Licensed under the Apache License, Version 2.0 - see LICENSE. Third-party notices and data-source attributions are in NOTICE.md.

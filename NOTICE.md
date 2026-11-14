# NOTICE


## Development and runtime disclosure

Code, data preparation, documentation, and visual design were developed with AI assistance under the team owner's direction. Record summaries and annotations are AI-assisted team interpretations, not NASA findings. Source records and deterministic outputs can be checked against their cited data; runtime interpretations require separate source checking.

- **Imagery**: all flame visuals are deterministic procedural shader output. There is no AI-synthesized imagery. The four NASA photographs (GRC-2016-C-05051, iss040e021546, iss040e072900, iss040e086481) are used unmodified. Delivery screenshots and video are captures of the app output and are watermarked "AI-assisted simulation render - not experiment footage".
- **Runtime (SI tab)**: on request the SI tab sends the visitor's question to third-party AI models through a Cloudflare Worker using free-tier Groq API models, together with record content: interpreting one record sends that record's fields (NASA original text or team annotations); ranking and cross-record synthesis send team-curated summaries (team annotations drawn from the public NASA PSI records). Every SI answer is labeled as an AI interpretation, must cite the record fields it used, and is never presented as validated science. The Search, Simulate and Ship-check tabs contain no machine-learning model and make no external AI API calls: search is deterministic extractive retrieval and the simulator is deterministic classical physics. No app account is required. Prompts contain public NASA data and visitor question text; service providers also receive network metadata such as IP addresses. Do not enter personal or sensitive information.

## Third-party acknowledgments

- NASA Physical Sciences Informatics (PSI) repository data, https://psi.nasa.gov/physci/repo/ - per-investigation licenses as listed in data/investigations.json (e.g., CC0 1.0 where noted). NASA branding is not modified and no endorsement is implied.
- Gas-transport equations in src/forward.ts are adapted from Cantera's HighPressureGasTransport (https://cantera.org), BSD-3-Clause licensed, https://github.com/Cantera/cantera/blob/main/License.txt:

```
Copyright (c) 2001-2009, California Institute of Technology
All rights reserved.

Copyright (c) 2009 Sandia Corporation. Under the terms of
Contract AC04-94AL85000 with Sandia Corporation, the U.S. Government
retains certain rights in this software.

Copyright (c) 2011-2026, Cantera Developers.
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are
met:

- Redistributions of source code must retain the above copyright
  notice, this list of conditions and the following disclaimer.

- Redistributions in binary form must reproduce the above copyright
  notice, this list of conditions and the following disclaimer in the
  documentation and/or other materials provided with the distribution.

- Neither the name of the California Institute of Technology, Sandia
  Corporation nor the names of other contributors may be used to
  endorse or promote products derived from this software without
  specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
"AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
```
- NIST Chemistry WebBook, https://webbook.nist.gov/ (saturation table data).
- Chung et al. (1988), corresponding-states transport correlation.
- Matalon, Lecture 12 notes, CEFRC Princeton (droplet flame standoff).

# How does the SKLPC community actually speak?

Question (2026-11-05): what distinguishes the spoken Gujarati of Kutch Leva Patels (SKLPC) from standard Gujarati, as source material for the Apollo app?
Projects affected: Personal (Apollo).

## Answer

**Not established from public sources.** No source describes SKLPC home speech directly. What exists is:

1. **General Kutchi** (a Sindhi-related language, ISO kfr). It's documented mostly from Khoja and Memon (Muslim) communities, plus a few blogs.
2. **Evidence that Leva Patel speech sits on a Gujarati–Kutchi continuum.**
   - An East-Africa survey lists "Cutchi-speaking Leva Patel (Hindu)".
   - Wikipedia says Hindus of rural-Kutch descent "reject Kutchi" in favour of Gujaratised forms such as *chhado hane* (standard *chhodo have*).
   - The SKLPC Saturday School in London teaches Gujarati.
3. **A handful of community terms**: *chovis gaam* (the 24 home villages) and *ujamni* (the annual UK gathering).

Best working model: Gujarati grammar and vocabulary as the base, with Kutchi words and verb forms mixed in. The mix varies by family and generation. Apollo teaches standard spoken Gujarati as the base, plus a labelled Kutchi layer. The family's verdict in the app is the deciding test.

## Method and its limits

- Three parallel sweeps covered SKLPC sites and gaams, linguistics, and social video.
- **The session's network blocked every page fetch**, including Wikipedia, YouTube, Reddit, sklpc.com, the CAL PDF and FreeLang. Every item was read through web-search snippets only.
- Because no page was opened in full, nothing is rated above `claimed`.
- Raw outputs: `knowledge/wikis/web/raw/2026-11-05-apollo-{sites,linguistics,social}.json`.

## Claims

| Claim | Std Gujarati | Confidence | Source |
| --- | --- | --- | --- |
| kien aayo? = how are you (4 sources, varied spelling) | kem cho? | claimed | memeraki.com, kutchimaadu.com, Quora |
| aaun = I; aain = you (respectful) | hu; tame | claimed | khojawiki.org (Muslim Kutchi), memeraki.com |
| achanto / vinanto = I'm coming / going | aavu chu / jaau chu | claimed | Wikipedia (citation needed), memeraki.com |
| koro/kuro = what; kada = where; ker = who | shu; kya; kon | claimed | memeraki.com, kutchimaadu.com |
| achija = bye | aavjo | claimed | kutchimaadu.com, memeraki.com |
| chhado hane = drop it now (Gujaratised Kutchi of rural-Kutch Hindus) | chhodo have | claimed | Wikipedia "Kutchi language" |
| muke bhookh lagi aay = I'm hungry; maf karija = sorry | mane bhukh lagi che; maaf karjo | claimed | grand3d.in |
| Chovis Gaam Ujamni: SKLPC UK annual gathering, 9,000+ attendees in 2025 | — | claimed | asian-voice.com, 2025-09 |
| Swahili loans saani, boga, dizi, sufrio | thaali, shaak, kela, tapeli | claimed | saada.org, Wikipedia "Kutchi-Swahili" (Muslim families) |

## Contradictions

- **Home language.** The AwaaZ/ResearchGate survey says Leva Patels speak Kutchi. Wikipedia says Hindus use Gujarati. Neither source is dated more precisely than its edition, and both may be true across generations.
- **kada.** One snippet glosses *kada* as "where", another as "when".

## What could not be established

- The Kutchi copula, negation, past and future tenses, and "why".
- SKLPC-specific kinship terms: whether *bapa* means father or grandfather.
- Whether SKLPC families use Swahili loans.
- Any village-level differences between gaams.
- The full list of the 24 villages. Only Kodki, Bharasar and Samatra are confirmed.

## Next fetch (needs network allowlist, or run on the Mac)

panjokutch.com (phrase table with elder/younger forms), cal.org heritage PDF, freelang.net Kutchi dictionary, en.wikipedia.org, sklpc.com, and the 1965 paper on Swahili words in spoken Gujarati. YouTube Kutchi Patel comedy channels via `research.py youtube` on the Mac.

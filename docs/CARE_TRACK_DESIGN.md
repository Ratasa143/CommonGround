# CommonGround Care Track: research and integration plan

Reviewed: 1 November 2026. This is product and engineering guidance, not legal advice. Each institution must approve its own routes, staff roles, notices, mandatory reporting duties, retention schedule, and escalation policy with qualified counsel and the relevant campus committees before accepting personal case reports.

## Product boundary

Care is a separate, opt-in support track for bullying, ragging, sexual harassment, discrimination, and other personal concerns. It is not a new category in the ordinary campus-service incident queue. A student must never be routed to maintenance staff or an AI triage process for a personal disclosure.

The current preview supports only a directory of external emergency and support contacts. It does **not** accept or store a Care Track narrative, contact preference, allegation, or confidential case. It must not suggest that the preview is a confidential reporting channel. The case intake remains blocked until the Care Track security, identity, policy, and operational gates below are implemented and independently reviewed.

## Research findings

### Distinct institutional pathways

- The UGC lists the 2023 Student Grievance Redressal Regulations and the 2015 sexual-harassment regulations as separate student-centric regulations. The 2023 regulations define student grievances and establish an SGRC and Ombudsperson process; a university must configure its applicable institution and appeal route from the regulation and its own policies. [UGC student-centric regulations](https://www.ugc.gov.in/regulations/UGC_Regulations_Student_Centric), [UGC 2023 regulations (Gazette PDF)](https://www.ugc.gov.in/pdfnews/4675881_Regulation.pdf).
- The UGC sexual-harassment regulations require a campus ICC mechanism and describe confidentiality, support, inquiry and recusal responsibilities. The UGC compendium describes the ICC's duties to protect complainant identity, prevent victimisation/retaliation, provide appropriate relief, and complete an inquiry under the stated framework. The POSH Act contains separate statutory provisions and exceptions. The app must not decide legal applicability, promise absolute confidentiality, or hard-code a one-size-fits-all deadline. [UGC regulations, composition](https://www.ugc.gov.in/e-book/UGC_Regulation/files/basic-html/page986.html), [UGC regulations, ICC responsibilities and process](https://www.ugc.gov.in/e-book/UGC_Regulation/files/basic-html/page987.html), [POSH Act, 2013](https://www.indiacode.nic.in/bitstream/123456789/19302/1/sexual_harrassment_of_women_at_workplace_act_2013.pdf).
- For ragging, UGC's 2025 circular reiterates the Anti-Ragging Committee/Squad responsibilities and publishes the national helpline. Do not send ragging disclosures through the ordinary Wi-Fi or facilities workflow. [UGC anti-ragging circular](https://www.antiragging.in/assets/pdf/advisory/circular-for-anti-ragging-regulations-2009.pdf).
- WHO's LIVES approach (Listen, Inquire about needs, Validate, Enhance safety, Support) is useful as a design lens for supportive language. It is guidance for trained health-care providers, not a script that an app or an untrained campus operator should impersonate. In product terms: make no-demand choices, ask only for what is necessary, validate without judging, show safety options, and connect students to trained people. [WHO first-line support](https://www.who.int/data/gho/indicator-metadata-registry/imr-details/first-line-support-in-policy).
- For India deployments, official support references include pan-India emergency number 112, Tele-MANAS at 14416 / 1-800-891-4416 (24×7), and the National Anti-Ragging Helpline at 1800-180-5522 (24×7) / helpline@antiragging.in. Verify these contacts and local campus contacts at deployment and display a last-verified date. [ERSS 112](https://112.gov.in/), [MoHFW Tele-MANAS](https://www.dghs.mohfw.gov.in/national-mental-health-programme.php), [UGC anti-ragging circular](https://www.antiragging.in/assets/pdf/advisory/circular-for-anti-ragging-regulations-2009.pdf).
- The DPDP Rules commencement notification phases provisions over time, with several substantive duties commencing 18 months after publication on 13 November 2025. Design for privacy and security now; do not treat phased commencement as permission to collect sensitive reports without safeguards. Get advice on minors, consent, institution/vendor roles, and applicable child-protection or mandatory-reporting duties. [MeitY Gazette notification G.S.R. 843(E)](https://www.meity.gov.in/static/uploads/2025/11/c56ceae6c383460ca69577428d36828b.pdf).

## Student experience and routing

1. Put **Support** beside Home, Report, and My requests. Use neutral language such as “You deserve support” and “What would help right now?” Never force a student to pick a legal category before they can see resources.
2. First screen: immediate-danger guidance and verified emergency links; provide support resources before asking for details. The app itself is not an emergency service.
3. Offer clear choices: find a trained person, learn the campus routes, keep a private dated record, or make a formal report once that route is live. Explain who receives each option, whether a response is possible, and any known limits before collection.
4. Let a student leave, pause, skip questions, request an advocate/support person, or ask for a different handler. No countdowns, forced narrative, blame, or “prove it” questions. Support measures (for example, a schedule/contact change) are separate from findings and investigation outcomes.
5. For formal reports, show the institution's configured route and what happens next. Sexual-harassment reports go only to authorised ICC roles; ragging follows the institution's anti-ragging route; other harassment/discrimination follows its configured SGRC/equity route. Offer a “not sure” route to a trained contact. The app may present the institution's process; it must not make the legal classification itself.
6. Anonymous reporting and case-code follow-up are separate settings. Explain that network/device metadata may still exist. Never call a flow anonymous unless the deployment's identity, logs, telemetry, email, backups, and support tooling have been verified to preserve that property. No matched-report escrow in v1.

## Chain of responsibility

Each campus configures roles, substitutes, availability, response targets, escalation and emergency obligations from its policy. Suggested *configuration slots*, not universal legal instructions:

| Concern | First contact / routing destination | Subsequent configured route |
|---|---|---|
| Sexual harassment | ICC Presiding Officer or a designated trained intake contact | ICC inquiry roles; institution-designated appeal/escalation route |
| Ragging | Anti-Ragging Squad / designated helpline contact | Anti-Ragging Committee and institution authority, consistent with current UGC rules |
| Bullying, discrimination, other personal grievance | Trained intake contact or SGRC-designated intake | SGRC, then the applicable Ombudsperson/appeal route |
| Immediate danger / crisis | Emergency services / counsellor as appropriate | Only contact institution roles with the student's consent, except duties the institution has validated and disclosed |

Access is case-scoped and time-bounded. A conflicted handler is recused and cannot view or act; the system routes only to a pre-approved alternate and logs the recusal without narrative content. A care administrator may configure roles and audit access but may not read narrative content by default. Escalation notifications contain a case code, route and overdue step only.

## Security architecture gates before sensitive intake

- Create an isolated `care` module, storage schema and least-privilege database role. No joins to ordinary incidents, no imports from `packages/meko` or `packages/llm`, no model prompt, embedding, analytics, swarm, or logging path for Care Track content.
- Replace the current spoofable `x-demo-persona` identity before live intake. Require institution-approved authentication for named flows; anonymous-code flows need a reviewed threat model, rate limits, secure passphrase handling and an explanation of their limits. Enforce role and case grants server-side on every read and write.
- Encrypt narrative and safe-contact fields at the application layer using envelope encryption and per-case data keys wrapped by a managed secret/KMS. Keep keys out of source, logs and the same database backups. Define rotation, backup restore, deletion, legal hold, retention and breach response before launch.
- Store access grants, assignments, status and due dates separately from encrypted content. Make access audit append-only/tamper-evident and commit each access audit record atomically with the access. Logs and notifications contain no allegation, identity, free text, sensitive category detail, or URL parameter carrying identity.
- Do not put sensitive drafts in `localStorage`, analytics, browser crash reports, service-worker caches, or offline queues. Consider local-only drafts only after a browser threat-model/security review; never cache reports on shared lab devices by default.
- Keep human-led routing and decisions. No model labels credibility, urgency, respondent guilt, or legal scope. Only campus-trained/authorised people conduct inquiry. Preserve fair-process duties and explain when a complaint may need to be shared with a respondent under the institution's applicable procedure.
- Before launch: counsel and committee review; privacy notice and consent review including under-18 students; tabletop safety test; accessibility/language review with students and counsellors; role-access and recusal tests; penetration test; documented incident response and named operational owners.

## Technology choices for this project

Use a technology only where it solves an identified user or operator need. Sponsor-track eligibility is not the same as product value; confirm the specific competition's published rubric rather than promising that adding vendors increases the chance of winning.

| Technology | Recommendation | Boundaries |
|---|---|---|
| YugabyteDB | Keep as authoritative store for ordinary incident state. For a future Care Track, use a genuinely isolated schema/role and separately reviewed encryption design; do not reuse the Wi-Fi report schema for case narratives. | Current preview already persists ordinary incidents here. No claim of production-ready Care isolation. |
| Meko | Highlight the implemented gateway honestly. For ordinary Wi-Fi work, use fixed role facades for carefully minimised, non-identifying operational context only after the live permission gate. A future committee-approved process lesson should be aggregate/de-identified and reviewed before promotion. | Never send Care reports, narrative, contact details, named people, respondent details, or small-group clues to Meko. The running product preview currently has no live Meko product calls. |
| Gemini | Optional for structured, non-sensitive Wi-Fi triage after the LLM gateway, provider/model verification, and privacy review. Use synthetic fixtures or human-reviewed translation drafts. | Never send Care Track content or use a model for crisis triage, legal classification, credibility, or decision-making. |
| TigerData | Do not add now. It provides PostgreSQL time-series hypertables/analytics; revisit only if measured operational telemetry has a clear analytics workload that Yugabyte cannot serve economically. | Avoid a second database for case truth or sensitive narratives. Any future feed must be de-identified, minimum-cohort aggregated and purpose-limited. |
| DigitalOcean or Vultr | Select one hosting provider after deployment needs, data location, security controls, support and cost are checked. DigitalOcean App Platform can host app components from Git/container images; Vultr could be considered if its chosen deployment shape fits. | Do not dual-host for a sponsor logo. Keep secrets in managed environment configuration and the DB's recovery plan explicit. |
| MongoDB | Do not add for this MVP. Current relational status, ownership and approvals already belong in YugabyteDB. Reconsider only for a concrete document/search workload with privacy controls and a clear source-of-truth contract. | No duplicate sensitive-case store; avoid copying reports to gain a vector-search demo. |
| Solana | Do not use for grievance records or identity/consent. There is no payment, transferable asset, or user-controlled on-chain credential requirement in this workflow. | Avoid public, durable case metadata, wallet linkage, or any design that cannot honor a validated deletion/retention process. |

## Sequence and acceptance gates

1. **Now:** maintain the safe resource directory, remove placeholder/pseudo-live UI claims, add student-reviewed English/Hindi/Hinglish copy, and test mobile/keyboard/accessibility. Do not accept personal reports in this preview.
2. **Before MVP intake:** implement the identity/tenant boundary; obtain campus policies and named owners; complete Care schema, per-case encryption, access grants, audit, retention, contact safety, recusal, escalation and an independent security review.
3. **Then:** implement case submission, separate staff console, case-code access only if approved, and user-controlled support measures. Run synthetic privacy/access tests; no real student data in the hackathon/demo environment.
4. **After production approval:** onboard one campus with its counsel/ICC/anti-ragging/SGRC configuration; review feedback from students and trained responders; measure first human response and support offered using only privacy-reviewed aggregates.

The current build may demo only step 1. Do not describe the Care Track as implemented until the security, policy and operational gates have evidence.

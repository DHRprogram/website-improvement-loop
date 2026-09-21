# Personas — Synthetic User Testing

## P01 — Busy Professional
- **Who**: 35yr old product manager, 4 meetings/day, impatient
- **Context**: Desktop 1440×900, Fast network, en-US locale, zoom 1.0, input: mouse
- **Patience**: 5s per action, 1 retry
- **Goals**: Complete tasks as fast as possible, skip anything not essential
- **Tasks**: Sign up, find key feature, check pricing, upgrade plan
- **Watches for**: Loading spinners longer than 2s, unnecessary steps, unclear CTAs, broken back buttons, form validation that blocks progress

## P02 — College Student
- **Who**: 21yr old, budget-conscious, uses site on phone during commute
- **Context**: Mobile 390×844, Fast 4G network, en-US locale, zoom 1.0, input: touch
- **Patience**: 10s, 1 retry
- **Goals**: Find free tier, explore features, share with friends
- **Tasks**: Sign up with Google, find free plan, share a page, use a core feature
- **Watches for**: Paywalls before trial, mobile layout issues, share button visibility, slow scroll, sign-up friction

## P03 — Screen Reader User
- **Who**: 29yr old blind accessibility advocate, uses VoiceOver/NVDA
- **Context**: Desktop 1440×900, Fast network, en-US locale, zoom 1.0, input: screen-reader (keyboard)
- **Patience**: 10s per action (longer due to screen reader), 1 retry
- **Goals**: Complete sign-up, navigate to content, find search, read article
- **Tasks**: Navigate by headings, find main content, fill form, read error messages
- **Watches for**: Missing alt text, unlabeled buttons, heading gaps, focus order broken, live region not announced, missing skip-link

## P04 — Older Adult
- **Who**: 68yr old retired teacher, moderate tech confidence
- **Context**: Desktop 1440×900, Fast network, en-US locale, zoom 1.25, input: mouse
- **Patience**: 3s (low confidence — quick to give up), 2 retries
- **Goals**: Find simple, clear, large-text interface
- **Tasks**: Read about product, find pricing (simple table), contact support
- **Watches for**: Small text, confusing icons, weak colour contrast, moving elements, Japanese/visual clutter, unclear CTAs

## P05 — Hacker / Dev
- **Who**: 27yr old frontend developer, inspects everything
- **Context**: Desktop 1440×900, Fast network, en-US locale, zoom 1.0, input: keyboard
- **Patience**: 10s, 1 retry
- **Goals**: Use keyboard only, look for API, check performance
- **Tasks**: Navigate entire app with Tab, find API docs, test search, check keyboard shortcuts
- **Watches for**: Tab order, focus visibility, keyboard traps, missing shortcuts, API docs quality

## P06 — Non-Native Speaker
- **Who**: 32yr old from Brazil, reads English but not fluent
- **Context**: Desktop 1440×900, Fast network, pt-BR locale, zoom 1.0, input: mouse
- **Patience**: 10s, 1 retry
- **Goals**: Understand the page despite language barrier
- **Tasks**: Sign up, use main feature, find help/docs
- **Watches for**: Idioms/jargon, unclear icons, no i18n support, auto-translate breaks layout, form validation in English only

## P07 — Power User
- **Who**: 41yr old data analyst, uses complex features daily
- **Context**: Desktop 1440×900, Fast network, en-US locale, zoom 1.0, input: mouse
- **Patience**: 10s, 1 retry
- **Goals**: Use advanced features, bulk actions, export data
- **Tasks**: Use advanced search, bulk edit, export report, set preferences
- **Watches for**: Bulk action confirmation, export formats, search syntax help, pagination at scale

## P08 — Casual Visitor
- **Who**: 19yr old, just browsing, no account, short attention
- **Context**: Mobile 390×844, Slow 4G network, en-US locale, zoom 1.0, input: touch
- **Patience**: 10s, 1 retry
- **Goals**: See what this is about in under 30s
- **Tasks**: Land on homepage, scroll to see value prop, click testimonial, read pricing
- **Watches for**: Slow load, confusing homepage, not obvious what it does, too much text, no clear next step

## P09 — Enterprise Buyer
- **Who**: 45yr old VP of Engineering, needs security and compliance info
- **Context**: Desktop 1440×900, Fast network, en-US locale, zoom 1.0, input: mouse
- **Patience**: 10s, 1 retry
- **Goals**: Find enterprise features, security compliance, pricing, contact sales
- **Tasks**: Find security page, check compliance badges, read enterprise pricing, contact sales
- **Watches for**: No enterprise page, pricing not transparent, vague security claims, no SOC/SSO info, hard to contact

## P10 — Social Sharer
- **Who**: 24yr old influencer, shares everything
- **Context**: Mobile 390×844, Fast network, en-US locale, zoom 1.0, input: touch
- **Patience**: 10s, 1 retry
- **Goals**: Share cool things immediately, screenshot key pages, share links
- **Tasks**: Sign up, find content worth sharing, share to social, screenshot profile
- **Watches for**: Share buttons not visible, no OG tags in preview, share link broken, no social proof display

## P11 — Adversarial Chaos Tester
- **Who**: Not a demographic persona. Goal: break the UI.
- **Context**: 3 passes — desktop 1440×900 fast, mobile 390×844 Slow 3G, desktop with network throttling/offline
- **Patience**: Infinite
- **Tasks**: Execute the adversarial-playbook.md (40 attacks) in all 3 passes
- **Watches for**: Any S0–S3 severity issue, anything suspicious
- **Special rules (allowed)**: DevTools network throttling/offline, paste any content, double/triple-click, rapid Back/Forward, refresh mid-flow
- **Forbidden**: page.evaluate, DOM edit, hidden selector, direct URL, real auth/payment attacks on production, real charges, real emails, real data deletion
- **Deliverables**: persona-11.json, P11_ATTACKS.md, Top 5 embarassments

## P12 — Accessibility Auditor
- **Who**: WCAG 2.2 AA automated auditor using axe-core
- **Context**: Desktop 1440×900, mobile 390×844 (menu closed + open), zoom 200%
- **Runs on**: Top 5 routes by internal link count + new routes from Phase E
- **Deliverables**: axe/*.json, axe/summary.json, P12_A11Y.md, merged into AGGREGATE
- **Special rules**: This is the ONLY persona allowed to use evaluate/AX API (read-only DOM). Critical → P0 → halt Phase B, escalate immediately

# LinkedIn Post Draft — EventAI Concierge

Three versions, pick the one that fits your voice. The last hashtag block is reusable.

---

## Version A — Short & punchy (LinkedIn character sweet spot)

Spent the week shipping **EventAI Concierge** for the Google AI Prompt Hackathon 🎯

It's an AI guide for physical events, built on **Gemini 2.5 Flash** — but the twist is *how* it helps:

🎙️ Ask with your voice
📸 Point your phone at any booth, sign, or map — Gemini Vision reads it
🗺️ An interactive floor plan lights up the room the AI is talking about
📅 "Recommend me a schedule" → one tap → .ics into your calendar
⚡ Streaming answers so nothing feels like waiting

Everything grounded in the event data, so the AI can't hallucinate a room that doesn't exist.

Built with intent-driven prompting in Antigravity — the whole stack (backend, frontend, tests, PWA, accessibility) started from a single comprehensive prompt.

Live demo + code → [link]

#GoogleAIHackathon #Gemini #AI #EventTech #Accessibility #BuiltWithAntigravity

---

## Version B — Story-led

Imagine you're walking into a 2,500-person conference. You have 8 hours, 9 sessions to pick, 10 booths to find, and you're wearing a lanyard, not a map.

What would you actually *want*?

Not a PDF of the schedule. Not another chatbot. Something that…

→ Lets you ask by voice while you're walking
→ Reads a booth sign if you just point your camera at it
→ Shows you exactly where to go, with a wheelchair-accessible route if you need one
→ Builds a personalised schedule for you on request
→ And lives on your phone even when the venue Wi-Fi dies

That's **EventAI Concierge**, built in 5 days on Gemini 2.5 Flash for the Google AI Prompt Hackathon.

Streaming chat, voice input, Gemini Vision, interactive SVG floor map, personal agenda with .ics export, installable PWA, and WCAG-AA accessibility throughout.

The fun part: the entire stack was scaffolded from one long prompt in Antigravity. Clear instructions + a capable model are the new full-stack engineer.

Demo → [link]
Code → [link]

#GoogleAIHackathon #Gemini #GenerativeAI #Accessibility #BuiltWithAntigravity #AIAgents

---

## Version C — Technical / builder voice

Pushed EventAI Concierge for the Google AI Prompt Hackathon today. Some highlights for the AI-builder crowd:

**Grounding** — the full event JSON is injected as the system instruction. Prompt rules forbid inventing rooms, booths, or people. Works shockingly well with Gemini 2.5 Flash.

**Streaming** — `generateContentStream()` piped through Express Server-Sent Events. Word-by-word rendering with a blinking caret. Cache warm? < 200 ms TTFB.

**Structured output without function-calling overhead** — I used a lightweight prompt contract: the model emits a hidden `<CARDS>{...}</CARDS>` marker at the end of any reply that references rooms/booths/sessions. The UI parses it out and renders rich cards + auto-highlights the room on an SVG floor map. No JSON-mode round-trip.

**Multi-modal** — same grounding, different prompt. `inlineData` parts for base-64 images. Point your camera at a booth and get schedule + accessibility context back.

**Voice** — Web Speech API (hold-to-talk) + `speechSynthesis` for responses. Zero extra network calls.

**PWA + offline shell** — service-worker cache keeps the app usable when venue Wi-Fi drops. AI endpoints deliberately bypassed.

All in < 1 KLOC of JS, fully tested, WCAG-AA accessible.

Most of the grunt work was done by a single intent-driven prompt in Antigravity. Refactoring has never been cheaper.

Repo → [link]

#GoogleAIHackathon #Gemini #AntigravityDev #EventTech #AI


# Build Your Own Browser AI Agent

> 2 hours &nbsp;·&nbsp; Zero cost &nbsp;·&nbsp; 100% in your browser

No cloud servers, no API keys, no cloud bills. In one sitting you go from a blank HTML file to a working AI chat agent with a persona, memory, a polished UI, and tool-calling — all running locally on your machine.

📽️ **Slides are in this repo:** [`slides.pdf`](slides.pdf) &nbsp;·&nbsp; live/interactive version: [`slides.html`](slides.html)

---

## The Stack

| | |
|---|---|
| 🧠 **Gemma 2 2B** | Google's open model, quantized to ~1.5 GB |
| ⚡ **WebLLM** | OpenAI-compatible chat API — same shape as `openai.chat.completions.create`, so the skills transfer directly |
| 🖥️ **WebGPU** | GPU compute in the browser — runs inference without a server |

One CDN import (`@mlc-ai/web-llm`), no npm install, no build step.

---

## Workshop agenda

| Phase | Focus |
|---|---|
| ⚡ **Phase 1 — The AI Loop** | Load the model, first chat completion, streaming responses, personas, multi-turn memory |
| 🎨 **Phase 2 — Make It Real** | Wrap the loop in a proper chat UI — bubbles, scrolling, input bar |
| 🚀 **Phase 3 — Make It Yours** | Customize your agent's persona and prompts, then a live demo of an agentic **Research Agent** that calls tools (Wikipedia, weather, calculator) and reasons over the results |
| 🏁 **Phase 4 — Ship It** | Submit your agent for the hackathon qualifier |

---

## What's in this repo

**Getting started**
- [`slides.html`](slides.html) / [`slides.pdf`](slides.pdf) — the workshop deck
- [`precache.html`](precache.html) — pre-download the AI model before the session

**Workshop files** (built up phase by phase)
- [`basic.html`](basic.html) — minimal hello-world, non-streaming — start here
- [`checkpoint.html`](checkpoint.html) — Phase 1 catch-up point (streaming + multi-turn + persona)
- [`chat.html`](chat.html) — the finished, polished chat UI
- [`research-agent.html`](research-agent.html) — the agentic, tool-calling demo

**Bonus examples** — same tool-calling pattern, different builds: `adventure/`, `quiz-tutor/`, `budget/`, `flashcards/`, `escape-room/`, `npc-civilization/`, `health-attendance/`

Open [`index.html`](index.html) for a linked gallery of all of the above.

## Getting started

New here? Start with the [pre-workshop setup guide](pre-workshop-guide.md) to install VS Code + Live Server and pre-cache the model.

---

## Resources

| | |
|---|---|
| WebLLM docs | github.com/mlc-ai/web-llm |
| MLC model zoo | huggingface.co/mlc-ai |
| Gemma on HF | huggingface.co/google/gemma-2-2b-it |
| Workshop repo | app.hidevs.xyz/learning-hub/webinar/zero-cost-ai-agent-browser-lab |

**Go deeper:** Web Workers (off main thread) · structured JSON output · bigger models (Gemma 9B, 27B) · native function calling


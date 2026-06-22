# Project Architecture - Web Automation Agent

This document explains the design decisions, component layouts, and execution workflows implemented in the autonomous website automation agent.

---

## 1. System Components

The project uses a clean client-server architecture separating UI display from OS-level browser orchestration.

```
                    ┌────────────────────────┐
                    │     React Dashboard    │
                    └───────────▲────────────┘
                                │ SSE Stream (base64 screenshot,
                                │ logs, coordinates)
                                ▼
                    ┌────────────────────────┐
                    │      Express API       │
                    └───────────▲────────────┘
                                │ Actions / Coordinates
                                ▼
         ┌──────────────────────────────────────────────┐
         │                Agent Executor                │
         └─────▲──────────────────────────────────▲─────┘
               │                                  │
               ▼                                  ▼
 ┌───────────────────────────┐      ┌───────────────────────────┐
 │   Playwright Controller   │      │        LLM Client         │
 └───────────────────────────┘      └───────────────────────────┘
```

### A. React Dashboard
- **Role**: Premium control center and visualization simulator.
- **Key Details**: Built on React 18, it renders base64 screenshot packets received from the server. An SVG coordinate mapping overlay translates absolute `(1280x800)` coordinates into relative percentages, scaling interactive bounding boxes perfectly as the viewport resizes. A click indicator overlays blinking ripples wherever a click command is dispatched.

### B. Express Server (`server.js`)
- **Role**: API router and Server-Sent Events (SSE) broadcaster.
- **Key Details**: Manages starting/stopping execution. Utilizes a long-lived HTTP SSE stream (`/api/agent/stream`) to broadcast screenshots and step details to connected dashboard clients without the overhead of WebSockets.

### C. Agent Executor (`agent/executor.js`)
- **Role**: Coordinates the main action loop.
- **Key Details**: Spins up a browser, loads pages, retrieves coordinates, queries the LLM (or fallback planner), dispatches actions through the Playwright controller, updates step records, and pushes state updates back to the API broadcasts.

### D. Playwright Controller (`agent/browser.js`)
- **Role**: Driver implementing low-level atomic actions.
- **Key Details**: Wraps Playwright browser commands. Implements `open_browser`, `navigate_to_url`, `click_on_screen`, `double_click`, `send_keys`, `scroll`, and `take_screenshot`.

---

## 2. Element Detection and Coordinate Alignment

Rather than sending massive raw HTML pages to the LLM, the agent utilizes a **hybrid visual-DOM coordinate approach**:

1. **DOM Scraper Injection**: When evaluating a page, the agent injects a JS scraper via Playwright's `page.evaluate`.
2. **Visibility Filtering**: The scraper finds interactive DOM tags (`input`, `textarea`, `button`, `a`, etc.) and filters out elements with size `0`, hidden visibility styles, or coordinates located outside the active viewport.
3. **Label Discovery**: The scraper deduces names from inputs (placeholder values, parent labels, `aria-labels`, title attributes, or inner text contents).
4. **Coordinate Calculation**: The scraper calls `getBoundingClientRect()` to compute the exact `(x, y)` center pixels relative to the current viewport.
5. **LLM/Planner Payload**: The server receives a clean JSON structure of these elements. The planner selects elements using these label details, instructing the driver to click exactly at the computed center coordinate `(x, y)`.

This makes operations extremely robust against variations in stylesheet structures, dynamic CSS frameworks, or React DOM re-renders.

---

## 3. Tool Composition and Step-by-Step Typing

To execute input text operations, the agent adheres to strict modular tool composition rules:
- **Focusing**: First, the agent dispatches a `click_on_screen(x, y)` to focus the target input.
- **Emulating Inputs**: Next, it dispatches `send_keys(text)` as a separate step. The driver implements realistic human emulation: it triggers a `Ctrl+A` and `Backspace` to clear any existing text, then inputs letters using `page.keyboard.type(text)` with a 40ms typing delay.

---

## 4. Error Handling and Defensive Execution

To ensure the agent does not freeze during networks lag or element mismatches, the driver implements:
- **Navigation Wait States**: Navigating URL waits for load events, combined with a 2-second timeout to allow client hydration to finish.
- **Timeout Protection**: The executor caps steps at 15 per task run. If a step fails, the event is caught, logged as an error, and the loop moves on or aborts rather than freezing.
- **Key Safety**: The fallback Planner identifies form elements by scanning strings using case-insensitive contains filters, adapting dynamically even if the page layout changes.
- **Session Cleanup**: In case of failures, a `finally` block runs on the backend to cleanly close all Playwright chromium instances, freeing memory resources.

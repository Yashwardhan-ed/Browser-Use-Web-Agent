# Autonomous Web Automation Agent (Mini Browser Use)

An intelligent, self-directed browser automation agent that navigates web pages, dynamically identifies interactive DOM elements, computes their precise pixel center coordinates, and performs form-filling and click operations autonomously.

This project is built as a complete client-server application with an **Express/Node.js** backend utilizing **Playwright** for browser control, and a premium **React** frontend dashboard for task management and real-time step visualization.

---

## Technical Stack & Libraries

1. **Frontend**: React (Vite-powered SPA), Vanilla CSS, Lucide React (for premium dashboard icons).
2. **Backend**: Node.js & Express API Server, Playwright (Chromium driver), SSE (Server-Sent Events) for live screenshot and log broadcasting.
3. **AI Planning**: Google Gemini & OpenAI API support, paired with an **Intelligent Dynamic Solver** (Demo Mode) that completes tasks dynamically without requiring API keys.

---

## Core Agent Capabilities & Tools

Agent is equipped with the following core tools:
- `open_browser(headed)`: Initializes Chromium (headed or headless).
- `navigate_to_url(url)`: Directs the browser to a URL and waits for page load.
- `click_on_screen(x, y)`: Moves the cursor and clicks coordinates.
- `double_click(x, y)`: Double-clicks coordinate locations.
- `send_keys(text)`: Focuses inputs, clears them (Ctrl+A + Backspace), and types keys.
- `scroll(direction)`: Scrolls the screen up or down by 70% viewport height.
- `take_screenshot()`: Captures a JPEG snapshot of the browser viewport.
- `get_interactive_elements()`: Scrapes the DOM in-page to identify visible buttons, inputs, links, and textareas, mapping their names, values, and pixel coordinates.

---

## Installation & Setup

Ensure you have **Node.js** (v18+) and **npm** installed on your system.

### 1. Install Dependencies
Run the project-wide installation script from the root directory:
```bash
npm run install-all
```
This command automatically installs packages in the root, `backend/`, and `frontend/` workspaces.

### 2. Download Playwright Browser Binaries
Install the Chromium browser binaries required by Playwright:
```bash
npx --prefix backend playwright install chromium
```

### 3. Environment Variables (Optional)
If you want to configure Gemini or OpenAI keys globally on the server, create a `.env` file in the `backend/` folder based on the template:
```bash
cp backend/.env.example backend/.env
```
Add your API keys to the `.env` file:
```env
OPENAI_API_KEY=your_openai_key
API_KEY=your_gemini_key
```

---

## How to Run

Start both the Express backend server (port 5000) and Vite React server (port 5173) in dev mode using a single command:
```bash
npm run dev
```

Open your browser and navigate to the frontend dashboard:
```
http://localhost:5173
```

---

## Running the Target Task

To demonstrate the agent automatically filling the form on:
`https://ui.shadcn.com/docs/forms/react-hook-form`

1. Open the dashboard at `http://localhost:5173`.
2. Keep the default URL and Task input, or enter:
   - **Start URL**: `https://ui.shadcn.com/docs/forms/react-hook-form`
   - **Task**: `Navigate to shadcn form, identify username & bio fields, fill them out, and click submit.`
3. Select **Demo Mode** under "LLM Provider" (or select Gemini/OpenAI if you want to use your API keys).
4. Click **Run Task**.
5. **Watch the live simulator feed**:
   - The browser starts in the background.
   - Screenshots update in real time.
   - Viewport coordinates overlay showing interactive elements.
   - A pulsing red indicator flashes where the agent clicks.
   - Text is typed into the "Username" and "Bio" fields.
   - The submit button is clicked, completing the task!

---

## Project Structure

```
├── backend/                  # Express server & Playwright logic
│   ├── agent/
│   │   ├── browser.js        # Playwright controller (tools)
│   │   ├── executor.js       # Main step-by-step agent loop
│   │   └── llm.js            # LLM interface & Demo planner
│   ├── scratch/              # Temporary test scripts
│   ├── server.js             # Express app entry & SSE stream endpoint
│   └── package.json
│
├── frontend/                 # Vite React application
│   ├── src/
│   │   ├── App.jsx           # Dashboard panel interface
│   │   ├── index.css         # Custom Vanilla CSS design styles
│   │   └── main.jsx
│   ├── index.html            # Entrypoint with SEO meta tags
│   └── package.json
│
├── package.json              # Root workspace coordinator
└── README.md
```

---

## Deployment Guide

This project is optimized for deployment as a split-architecture application: hosting the static React frontend on **Vercel** and the browser-driving Node.js backend on a containerized service (like **Render** or **Railway**) that supports Playwright's system dependencies.

### 1. Frontend Deployment (Vercel)
The codebase includes a root-level [vercel.json](file:///home/yashwardhan/Desktop/GenAI/Assignment_4/vercel.json) configuration, making deployment on Vercel simple and automated:

1. Push your repository to GitHub.
2. Import the repository into your Vercel Dashboard.
3. Keep the settings as default (Vercel will detect the root `package.json` and automatically run the custom `npm run build` command, compiling the React application and outputting it to `frontend/dist`).
4. **Environment Variables**: In your Vercel project settings, add the following environment variable:
   - `VITE_API_URL`: The production URL of your hosted backend server (e.g. `https://your-backend-service.onrender.com`).
   *Note: If omitted, the frontend will default to talking to `http://localhost:5000` for local runs.*

### 2. Backend Deployment (Render / Railway)
Because Playwright requires browser executable binaries (Chromium) and low-level Linux libraries (like `libgbm`, `nss`, etc.), it cannot run directly inside serverless functions like Vercel's. Instead, host it on a persistent Node.js environment:

#### Hosting on Render:
1. Create a new **Web Service** on Render and connect your repository.
2. Set the **Root Directory** settings to `backend`.
3. Set the **Build Command** to:
   ```bash
   npm install && npx playwright install chromium
   ```
4. Set the **Start Command** to:
   ```bash
   npm start 
   ```
5. Add your LLM keys in the Render environment settings (`API_KEY` for Gemini and `OPENAI_API_KEY` for OpenAI).

Once both are deployed, Vercel will host your premium dashboard interface, communicating securely with your custom automation runner in the cloud!

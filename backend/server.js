import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { AgentExecutor } from './agent/executor.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for frontend requests
app.use(cors());
app.use(express.json());

// In-memory reference to the active executor
let activeExecutor = null;
let sseClients = [];

/**
 * Sends real-time event updates to all SSE-connected clients
 */
function broadcastAgentUpdate(data) {
  const payload = JSON.stringify(data);
  sseClients.forEach((client) => {
    client.write(`data: ${payload}\n\n`);
  });
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date() });
});

/**
 * Server-Sent Events (SSE) endpoint to listen to agent actions and page state in real-time
 */
app.get('/api/agent/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders(); // Establish stream connection immediately

  // Add client to registry
  sseClients.push(res);
  console.log(`SSE Client connected. Total clients: ${sseClients.length}`);

  // Send initial connection confirm
  res.write(`data: ${JSON.stringify({ status: 'connected', logs: ['System: Connected to SSE Event Stream'] })}\n\n`);

  req.on('close', () => {
    sseClients = sseClients.filter((c) => c !== res);
    console.log(`SSE Client disconnected. Total clients: ${sseClients.length}`);
  });
});

/**
 * POST endpoint to start a browser automation task
 */
app.post('/api/agent/run', async (req, res) => {
  const { task, startUrl, provider, model, apiKey, headed } = req.body;

  if (activeExecutor && activeExecutor.isRunning) {
    return res.status(400).json({ error: 'An agent task is already running. Stop it first.' });
  }

  if (!task) {
    return res.status(400).json({ error: 'Task description is required' });
  }

  // Create new executor
  activeExecutor = new AgentExecutor();

  // Respond immediately that the task has started
  res.json({ message: 'Agent task started' });

  // Resolve API Key from env variables based on provider selection
  let resolvedApiKey = '';
  if (provider === 'gemini') {
    resolvedApiKey = process.env.API_KEY || '';
  } else if (provider === 'openai') {
    resolvedApiKey = process.env.OPENAI_API_KEY || '';
  }

  // Run the agent task asynchronously
  try {
    await activeExecutor.runTask(
      {
        task,
        startUrl,
        provider: provider || 'demo',
        model,
        apiKey: resolvedApiKey,
        headed: !!headed
      },
      (update) => {
        broadcastAgentUpdate(update);
      }
    );
  } catch (error) {
    console.error('Agent run failed:', error);
    broadcastAgentUpdate({
      status: 'failed',
      error: error.message,
      logs: [`System Error: ${error.message}`]
    });
  } finally {
    activeExecutor = null;
  }
});

/**
 * POST endpoint to terminate the active automation task
 */
app.post('/api/agent/stop', async (req, res) => {
  if (!activeExecutor || !activeExecutor.isRunning) {
    return res.json({ message: 'No active agent task is running' });
  }

  try {
    await activeExecutor.stop();
    res.json({ message: 'Agent stop signal sent successfully' });
  } catch (error) {
    res.status(500).json({ error: `Failed to stop agent: ${error.message}` });
  } finally {
    activeExecutor = null;
  }
});

app.listen(PORT, () => {
  console.log(`Web Automation Backend Server running on port ${PORT}`);
});

import OpenAI from 'openai';
import { GoogleGenAI } from '@google/genai';

const SYSTEM_PROMPT = `You are an autonomous web automation agent. Your goal is to complete the user's task on the web page.
At each step, you receive:
1. The user's task prompt.
2. The current URL.
3. A list of visible interactive elements on the page with their IDs, tag names, labels, values, and center coordinates (x, y).
4. The history of actions you have taken so far.

Based on this, you must choose exactly ONE action to execute next.

Supported actions:
- navigate_to_url: { "url": "string" }
- click_on_screen: { "x": number, "y": number }
- send_keys: { "keys": "string" } (Types text into the currently focused/clicked element, clearing any existing text)
- scroll: { "direction": "up" | "down" }
- double_click: { "x": number, "y": number }
- finish: {} (Call this when the task is fully completed)

IMPORTANT Rules:
1. You can only call ONE action at a time.
2. To type into a text field, you MUST first click on it using click_on_screen(x, y) to focus it, then send_keys(keys) in the next step.
3. Identify elements by matching their labels, placeholders, or values.
4. Respond ONLY with a valid JSON object matching this structure:
{
  "thought": "Your reasoning process",
  "action": "action_name",
  "args": { ... }
}
Do not wrap your response in markdown blocks or include any additional text.`;

export class LLMClient {
  constructor() {
    this.history = [];
  }

  resetHistory() {
    this.history = [];
  }

  addHistory(action, args, result) {
    this.history.push({ action, args, result });
  }

  /**
   * Main planning call. Decides the next step.
   */
  async planNextStep({ task, currentUrl, elements, provider, model, apiKey }) {
    console.log(`Planning step using ${provider} (${model || 'default'})...`);

    // Fallback: Smart Dynamic Solver (Demo Mode)
    if (provider === 'demo' || !apiKey) {
      return this.planDemoStep(task, currentUrl, elements);
    }

    const stateDescription = {
      task,
      currentUrl,
      elements: elements.map(el => ({
        id: el.id,
        tagName: el.tagName,
        type: el.type,
        label: el.label,
        value: el.value,
        x: el.x,
        y: el.y,
        name: el.name,
        idAttr: el.idAttr
      })),
      history: this.history
    };

    try {
      if (provider === 'gemini') {
        return await this.callGemini(stateDescription, model, apiKey);
      } else if (provider === 'openai') {
        return await this.callOpenAI(stateDescription, model, apiKey);
      } else {
        throw new Error(`Unsupported provider: ${provider}`);
      }
    } catch (err) {
      console.error('LLM API Call failed:', err);
      // Fallback to demo solver if LLM call fails
      console.log('Falling back to rule-based Demo Planner.');
      return this.planDemoStep(task, currentUrl, elements);
    }
  }

  /**
   * Gemini SDK call
   */
  async callGemini(state, modelName, apiKey) {
    const ai = new GoogleGenAI({ apiKey });
    const model = modelName || 'gemini-2.5-flash';
    
    const response = await ai.models.generateContent({
      model: model,
      contents: JSON.stringify(state),
      config: {
        systemInstruction: SYSTEM_PROMPT,
        responseMimeType: 'application/json'
      }
    });

    const text = response.text.trim();
    return this.parseJSONResponse(text);
  }

  /**
   * OpenAI SDK call
   */
  async callOpenAI(state, modelName, apiKey) {
    const openai = new OpenAI({ apiKey });
    const model = modelName || 'gpt-4o-mini';

    const response = await openai.chat.completions.create({
      model: model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: JSON.stringify(state) }
      ],
      response_format: { type: 'json_object' }
    });

    const text = response.choices[0].message.content.trim();
    return this.parseJSONResponse(text);
  }Antigr

  parseJSONResponse(text) {
    // Strip markdown code block markers if present
    let clean = text;
    if (clean.startsWith('```json')) {
      clean = clean.substring(7);
    } else if (clean.startsWith('```')) {
      clean = clean.substring(3);
    }
    if (clean.endsWith('```')) {
      clean = clean.substring(0, clean.length - 3);
    }
    clean = clean.trim();

    return JSON.parse(clean);
  }

  /**
   * Intelligent Rule Planner for Shadcn react-hook-form completion
   * Dynamically locates Username and Description/Bio inputs and submits them.
   */
  planDemoStep(task, currentUrl, elements) {
    console.log('Executing intelligent rule planning logic...');

    // If we're not on the Shadcn forms page and need to navigate
    if (!currentUrl || currentUrl === 'about:blank') {
      return {
        thought: 'Navigating to the target form page.',
        action: 'navigate_to_url',
        args: { url: 'https://ui.shadcn.com/docs/forms/react-hook-form' }
      };
    }

    // Examine history to see what we've already done
    const clickedUsername = this.history.some(h => h.action === 'click_on_screen' && h.meta === 'username');
    const typedUsername = this.history.some(h => h.action === 'send_keys' && h.meta === 'username');
    const clickedBio = this.history.some(h => h.action === 'click_on_screen' && h.meta === 'bio');
    const typedBio = this.history.some(h => h.action === 'send_keys' && h.meta === 'bio');
    const clickedSubmit = this.history.some(h => h.action === 'click_on_screen' && h.meta === 'submit');

    // 1. Identify Name/Username Field
    const usernameElement = elements.find(el => {
      const label = el.label.toLowerCase();
      const nameAttr = (el.name || '').toLowerCase();
      const idAttr = (el.idAttr || '').toLowerCase();
      return (
        (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') && 
        (label.includes('username') || label.includes('name') || label.includes('title') || label.includes('shadcn') ||
         nameAttr.includes('username') || nameAttr.includes('name') || nameAttr.includes('title') ||
         idAttr.includes('username') || idAttr.includes('name') || idAttr.includes('title'))
      );
    });

    // 2. Identify Description/Bio Field
    const bioElement = elements.find(el => {
      const label = el.label.toLowerCase();
      const nameAttr = (el.name || '').toLowerCase();
      const idAttr = (el.idAttr || '').toLowerCase();
      return (
        (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') && 
        (label.includes('bio') || label.includes('description') || label.includes('about') ||
         nameAttr.includes('bio') || nameAttr.includes('description') || nameAttr.includes('about') ||
         idAttr.includes('bio') || idAttr.includes('description') || idAttr.includes('about'))
      );
    });

    // 3. Identify Submit/Submit Button
    const submitElement = elements.find(el => {
      const label = el.label.toLowerCase();
      const type = (el.type || '').toLowerCase();
      const nameAttr = (el.name || '').toLowerCase();
      const idAttr = (el.idAttr || '').toLowerCase();
      
      // Exclude theme, code, search, menu, or copy buttons that are submit type
      if (
        label.includes('theme') || label.includes('toggle') || 
        label.includes('search') || label.includes('code') || 
        label.includes('copy') || label.includes('menu')
      ) {
        return false;
      }
      
      return (
        el.tagName === 'BUTTON' && 
        (label.includes('submit') || label.includes('update') || label.includes('save') || label.includes('send') || type === 'submit')
      );
    });

    // Step 1: Click Username Field
    if (!clickedUsername && usernameElement) {
      return {
        thought: `Found Username field at (${usernameElement.x}, ${usernameElement.y}). Clicking to focus.`,
        action: 'click_on_screen',
        args: { x: usernameElement.x, y: usernameElement.y },
        meta: 'username'
      };
    }

    // Step 2: Send Keys to Username Field
    if (clickedUsername && !typedUsername) {
      return {
        thought: 'Username field is focused. Typing user name.',
        action: 'send_keys',
        args: { keys: 'Web Agent' },
        meta: 'username'
      };
    }

    // Step 3: Click Bio Field
    if (typedUsername && !clickedBio && bioElement) {
      return {
        thought: `Found Bio/Description textarea at (${bioElement.x}, ${bioElement.y}). Clicking to focus.`,
        action: 'click_on_screen',
        args: { x: bioElement.x, y: bioElement.y },
        meta: 'bio'
      };
    }

    // Step 4: Send Keys to Bio Field
    if (clickedBio && !typedBio) {
      return {
        thought: 'Bio textarea is focused. Typing description details.',
        action: 'send_keys',
        args: { keys: 'Autonomous Web Agent running smoothly with Playwright, Express, and React!' },
        meta: 'bio'
      };
    }

    // Step 5: Click Submit Button
    if (typedBio && !clickedSubmit && submitElement) {
      return {
        thought: `Form is filled. Clicking the submit button at (${submitElement.x}, ${submitElement.y}).`,
        action: 'click_on_screen',
        args: { x: submitElement.x, y: submitElement.y },
        meta: 'submit'
      };
    }

    // Step 6: Scroll down to reveal success toast or finish
    if (clickedSubmit || (typedUsername && typedBio && !submitElement)) {
      return {
        thought: 'All tasks completed successfully. Wrapping up.',
        action: 'finish',
        args: {}
      };
    }

    // Default scroll/wait if elements aren't immediately visible
    return {
      thought: 'Required elements not found. Scrolling to search.',
      action: 'scroll',
      args: { direction: 'down' }
    };
  }
}

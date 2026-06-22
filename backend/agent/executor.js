import { BrowserDriver } from './browser.js';
import { LLMClient } from './llm.js';

export class AgentExecutor {
  constructor() {
    this.driver = null;
    this.llmClient = new LLMClient();
    this.isRunning = false;
    this.logs = [];
  }

  log(message) {
    const timestamp = new Date().toLocaleTimeString();
    const logMsg = `[${timestamp}] ${message}`;
    console.log(logMsg);
    this.logs.push(logMsg);
  }

  async stop() {
    this.isRunning = false;
    this.log('Agent execution stopped by request.');
    if (this.driver) {
      await this.driver.close_browser().catch(() => {});
      this.driver = null;
    }
  }

  async runTask({ task, startUrl, provider, model, apiKey, headed = false }, onUpdate) {
    if (this.isRunning) {
      throw new Error('An agent task is already running');
    }

    this.isRunning = true;
    this.logs = [];
    this.llmClient.resetHistory();
    this.driver = new BrowserDriver();

    this.log(`Starting task: "${task}"`);
    this.log(`Browser Mode: ${headed ? 'Headed' : 'Headless'}`);
    this.log(`Model Provider: ${provider}`);

    try {
      // Step 1: Open browser
      this.log('Opening browser...');
      await this.driver.open_browser(headed);

      // Step 2: Navigate to URL
      if (startUrl) {
        this.log(`Navigating to start URL: ${startUrl}`);
        await this.driver.navigate_to_url(startUrl);
      }

      const maxSteps = 25;
      let currentStep = 1;

      while (this.isRunning && currentStep <= maxSteps) {
        this.log(`--- Step ${currentStep} of ${maxSteps} ---`);

        // Gather current page state
        const currentUrl = this.driver.page ? this.driver.page.url() : 'unknown';
        this.log(`Current page URL: ${currentUrl}`);

        this.log('Capturing page state and screenshot...');
        const screenshot = await this.driver.take_screenshot().catch(err => {
          this.log(`Screenshot capture failed: ${err.message}`);
          return '';
        });

        const elements = await this.driver.get_interactive_elements().catch(err => {
          this.log(`Interactive elements extraction failed: ${err.message}`);
          return [];
        });

        this.log(`Detected ${elements.length} visible interactive elements.`);

        // Notify client with current state before making the decision
        onUpdate({
          status: 'planning',
          step: currentStep,
          url: currentUrl,
          screenshot,
          elements,
          logs: [...this.logs],
          lastAction: null
        });

        // Query LLM/Planner for the next action
        this.log('Requesting next step from planner...');
        const decision = await this.llmClient.planNextStep({
          task,
          currentUrl,
          elements,
          provider,
          model,
          apiKey
        });

        this.log(`Planner Thought: "${decision.thought}"`);
        this.log(`Planner Action: ${decision.action} (${JSON.stringify(decision.args || {})})`);

        // Update with thought
        onUpdate({
          status: 'executing',
          step: currentStep,
          url: currentUrl,
          screenshot,
          elements,
          logs: [...this.logs],
          thought: decision.thought,
          currentAction: { action: decision.action, args: decision.args }
        });

        // Check if finished
        if (decision.action === 'finish') {
          this.log('Task marked as completed by planner.');
          onUpdate({
            status: 'completed',
            step: currentStep,
            url: currentUrl,
            screenshot,
            elements,
            logs: [...this.logs],
            thought: decision.thought,
            currentAction: { action: decision.action, args: decision.args }
          });
          break;
        }

        // Execute target action
        let actionResult = 'success';
        try {
          const { action, args } = decision;

          if (action === 'navigate_to_url') {
            await this.driver.navigate_to_url(args.url);
            this.log(`Successfully navigated to ${args.url}`);
          } else if (action === 'click_on_screen') {
            await this.driver.click_on_screen(args.x, args.y);
            this.log(`Successfully clicked coordinates (${args.x}, ${args.y})`);
          } else if (action === 'double_click') {
            await this.driver.double_click(args.x, args.y);
            this.log(`Successfully double-clicked coordinates (${args.x}, ${args.y})`);
          } else if (action === 'send_keys') {
            await this.driver.send_keys(args.keys);
            this.log(`Successfully typed keys: "${args.keys}"`);
          } else if (action === 'scroll') {
            await this.driver.scroll(args.direction || 'down');
            this.log(`Successfully scrolled ${args.direction || 'down'}`);
          } else {
            throw new Error(`Unknown action: ${action}`);
          }
        } catch (execErr) {
          actionResult = `error: ${execErr.message}`;
          this.log(`Action execution failed: ${execErr.message}`);
        }

        // Add action to planner history so it is aware of it in the next step
        this.llmClient.addHistory(decision.action, decision.args, actionResult);
        if (decision.meta) {
          // preserve custom metadata (like 'username', 'bio') for demo planner
          this.llmClient.history[this.llmClient.history.length - 1].meta = decision.meta;
        }

        currentStep++;
        await new Promise(resolve => setTimeout(resolve, 1500)); // small delay between steps
      }

      if (currentStep > maxSteps) {
        this.log('Task terminated due to exceeding maximum steps limit.');
        onUpdate({
          status: 'timeout',
          logs: [...this.logs]
        });
      }

    } catch (err) {
      this.log(`Fatal agent error: ${err.message}`);
      onUpdate({
        status: 'failed',
        error: err.message,
        logs: [...this.logs]
      });
    } finally {
      this.isRunning = false;
      this.log('Cleaning up browser resources...');
      if (this.driver) {
        await this.driver.close_browser().catch(() => {});
        this.driver = null;
      }
      this.log('Agent execution flow completed.');
    }
  }
}

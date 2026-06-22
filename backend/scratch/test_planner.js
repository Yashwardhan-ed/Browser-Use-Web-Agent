import { BrowserDriver } from '../agent/browser.js';
import { LLMClient } from '../agent/llm.js';

async function verifyPlanner() {
  console.log('--- STARTING PLANNER INTEGRATION VERIFICATION ---');
  const driver = new BrowserDriver();
  const llmClient = new LLMClient();
  
  try {
    console.log('1. Launching browser...');
    await driver.open_browser(false); // headless
    
    let currentUrl = 'about:blank';
    const maxSteps = 15;
    let step = 1;
    let finished = false;
    
    while (step <= maxSteps && !finished) {
      console.log(`\nStep ${step}:`);
      
      // Capture state
      const url = driver.page ? driver.page.url() : currentUrl;
      console.log(`- Current URL: ${url}`);
      
      const elements = await driver.get_interactive_elements();
      console.log(`- Extracted ${elements.length} visible elements`);
      
      // Call planner (Demo Mode)
      const decision = llmClient.planDemoStep('Complete form', url, elements);
      console.log(`- Thought: "${decision.thought}"`);
      console.log(`- Action: ${decision.action} (${JSON.stringify(decision.args || {})})`);
      
      if (decision.action === 'finish') {
        console.log('Success! Task finished.');
        finished = true;
        break;
      }
      
      // Execute
      let result = 'success';
      try {
        if (decision.action === 'navigate_to_url') {
          await driver.navigate_to_url(decision.args.url);
          currentUrl = decision.args.url;
        } else if (decision.action === 'click_on_screen') {
          await driver.click_on_screen(decision.args.x, decision.args.y);
        } else if (decision.action === 'send_keys') {
          await driver.send_keys(decision.args.keys);
        } else if (decision.action === 'scroll') {
          await driver.scroll(decision.args.direction);
        }
      } catch (err) {
        result = `error: ${err.message}`;
        console.log(`- Execution Error: ${err.message}`);
      }
      
      // Save history
      llmClient.addHistory(decision.action, decision.args, result);
      if (decision.meta) {
        llmClient.history[llmClient.history.length - 1].meta = decision.meta;
      }
      
      step++;
      await new Promise(r => setTimeout(r, 1000));
    }
    
    if (!finished) {
      console.log(`\nFailure! Did not complete within ${maxSteps} steps.`);
    } else {
      console.log('\n--- VERIFICATION COMPLETED SUCCESSFULLY ---');
    }
  } catch (error) {
    console.error('Fatal test error:', error);
  } finally {
    await driver.close_browser();
  }
}

verifyPlanner();

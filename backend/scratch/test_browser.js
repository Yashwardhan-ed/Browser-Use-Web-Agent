import { BrowserDriver } from '../agent/browser.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function test() {
  console.log('--- STARTING BROWSER DRIVER TEST ---');
  const driver = new BrowserDriver();
  
  try {
    // 1. Open browser
    console.log('Step 1: Opening browser...');
    await driver.open_browser(false); // headless
    
    // 2. Navigate to target URL
    console.log('Step 2: Navigating to target URL...');
    await driver.navigate_to_url('https://ui.shadcn.com/docs/forms/react-hook-form');
    
    // 3. Extract interactive elements
    console.log('Step 3: Extracting interactive elements...');
    const elements = await driver.get_interactive_elements();
    console.log(`Success! Extracted ${elements.length} elements.`);
    console.log('Sample elements:');
    console.log(elements.slice(0, 10)); // log first 10 elements
    
    // 4. Capture screenshot
    console.log('Step 4: Capturing page screenshot...');
    const b64screenshot = await driver.take_screenshot();
    console.log(`Success! Screenshot size: ${b64screenshot.length} characters.`);
    
    // Write screenshot to test file to visually confirm
    const imgBuffer = Buffer.from(b64screenshot, 'base64');
    const outputPath = path.join(__dirname, 'test_screenshot.jpg');
    fs.writeFileSync(outputPath, imgBuffer);
    console.log(`Saved test screenshot to: ${outputPath}`);
    
    console.log('--- BROWSER DRIVER TEST COMPLETED SUCCESSFULLY ---');
  } catch (error) {
    console.error('Test failed with error:', error);
  } finally {
    await driver.close_browser();
  }
}

test();

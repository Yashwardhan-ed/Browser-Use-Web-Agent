import { chromium } from 'playwright';

export class BrowserDriver {
  constructor() {
    this.browser = null;
    this.context = null;
    this.page = null;
    this.isHeaded = false; // Run headless by default, but configurable
  }

  /**
   * Initializes and launches a browser instance
   */
  async open_browser(headed = false) {
    if (this.browser) {
      console.log('Browser already open, reusing existing instance');
      return;
    }
    this.isHeaded = headed;
    console.log(`Launching Chromium (headed=${headed})...`);
    this.browser = await chromium.launch({
      headless: !headed,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    this.context = await this.browser.newContext({
      viewport: { width: 1280, height: 800 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });

    this.page = await this.context.newPage();
    console.log('Browser instance initialized successfully.');
  }

  /**
   * Navigates to a specific URL
   */
  async navigate_to_url(url) {
    if (!this.page) {
      throw new Error('Browser is not open. Call open_browser first.');
    }
    console.log(`Navigating to URL: ${url}`);
    await this.page.goto(url, {
      waitUntil: 'load',
      timeout: 30000
    });
    // Wait an additional small duration to ensure JS hydration is complete
    await this.page.waitForTimeout(2000);
  }

  /**
   * Performs mouse click at specified coordinates
   */
  async click_on_screen(x, y) {
    if (!this.page) {
      throw new Error('Browser is not open.');
    }
    console.log(`Clicking on screen coordinates: (${x}, ${y})`);
    
    // Move mouse and click
    await this.page.mouse.move(x, y);
    await this.page.mouse.down();
    await this.page.waitForTimeout(50);
    await this.page.mouse.up();
    
    // Wait for any UI update
    await this.page.waitForTimeout(800);
  }

  /**
   * Perform double-click action at specified coordinates
   */
  async double_click(x, y) {
    if (!this.page) {
      throw new Error('Browser is not open.');
    }
    console.log(`Double-clicking on screen coordinates: (${x}, ${y})`);
    await this.page.mouse.dblclick(x, y);
    await this.page.waitForTimeout(800);
  }

  /**
   * Input text into currently focused element or form fields
   * Emulates keyboard typing by first focusing the input.
   */
  async send_keys(text) {
    if (!this.page) {
      throw new Error('Browser is not open.');
    }
    console.log(`Sending keys: "${text}"`);
    
    // Focus is expected to be on the active element after click_on_screen.
    // Clear the existing text before typing using Ctrl+A and Backspace.
    await this.page.keyboard.down('Control');
    await this.page.keyboard.press('a');
    await this.page.keyboard.up('Control');
    await this.page.keyboard.press('Backspace');
    await this.page.waitForTimeout(100);

    // Type text with slight delay to mimic human behavior
    await this.page.keyboard.type(text, { delay: 40 });
    await this.page.waitForTimeout(500);
  }

  /**
   * Scroll the page up or down
   */
  async scroll(direction = 'down') {
    if (!this.page) {
      throw new Error('Browser is not open.');
    }
    console.log(`Scrolling: ${direction}`);
    await this.page.evaluate((dir) => {
      const scrollHeight = 450; // Scroll 450px to keep form elements visible with overlap
      window.scrollBy(0, dir === 'down' ? scrollHeight : -scrollHeight);
    }, direction);
    await this.page.waitForTimeout(800);
  }

  /**
   * Capture screenshot and return base64 string
   */
  async take_screenshot() {
    if (!this.page) {
      throw new Error('Browser is not open.');
    }
    const buffer = await this.page.screenshot({
      type: 'jpeg',
      quality: 80
    });
    return buffer.toString('base64');
  }

  /**
   * Closes the browser
   */
  async close_browser() {
    console.log('Closing browser...');
    if (this.page) {
      await this.page.close().catch(() => {});
      this.page = null;
    }
    if (this.context) {
      await this.context.close().catch(() => {});
      this.context = null;
    }
    if (this.browser) {
      await this.browser.close().catch(() => {});
      this.browser = null;
    }
    console.log('Browser closed.');
  }

  /**
   * Injects an in-page script to extract interactive elements and calculate their positions.
   * Returns a list of elements with center coordinates.
   */
  async get_interactive_elements() {
    if (!this.page) {
      return [];
    }

    return await this.page.evaluate(() => {
      const elements = [];
      
      // Select potentially interactive tags
      const candidates = document.querySelectorAll(
        'button, input, textarea, select, a, [role="button"], [role="link"], [role="checkbox"], [role="radio"]'
      );

      let idCounter = 0;

      candidates.forEach((el) => {
        // Basic visibility check
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        
        if (
          rect.width === 0 || 
          rect.height === 0 || 
          style.display === 'none' || 
          style.visibility === 'hidden' || 
          style.opacity === '0' ||
          el.disabled
        ) {
          return;
        }

        // Check if element is out of bounds of the current viewport
        if (
          rect.bottom < 0 ||
          rect.right < 0 ||
          rect.left > window.innerWidth ||
          rect.top > window.innerHeight
        ) {
          return;
        }

        // Skip hidden inputs
        if (el.tagName === 'INPUT' && el.type === 'hidden') {
          return;
        }

        // Deduce readable labels
        let label = '';
        
        // 1. Check associated label by ID
        if (el.id) {
          const associatedLabel = document.querySelector(`label[for="${el.id}"]`);
          if (associatedLabel) {
            label = associatedLabel.innerText.trim();
          }
        }
        
        // 2. If no label, check parent label
        if (!label) {
          const parentLabel = el.closest('label');
          if (parentLabel) {
            label = parentLabel.innerText.trim();
          }
        }
        
        // 3. If no label, check aria-label
        if (!label) {
          label = el.getAttribute('aria-label') || '';
        }

        // 4. If no label, check placeholder
        if (!label) {
          label = el.placeholder || '';
        }

        // 5. If no label, check innerText (for buttons/links)
        if (!label && el.innerText) {
          label = el.innerText.trim();
        }

        // 6. If no label, check title
        if (!label) {
          label = el.getAttribute('title') || '';
        }

        // Truncate overly long labels
        if (label.length > 100) {
          label = label.substring(0, 97) + '...';
        }

        // Calculate center coordinate
        const x = Math.round(rect.left + rect.width / 2);
        const y = Math.round(rect.top + rect.height / 2);

        elements.push({
          id: idCounter++,
          tagName: el.tagName,
          type: el.type || null,
          label: label || 'Interactive Element',
          x,
          y,
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          value: el.value || '',
          name: el.name || null,
          idAttr: el.id || null
        });
      });

      return elements;
    });
  }
}

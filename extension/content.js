// Guard against double-injection (manifest + on-demand scripting.executeScript)
if (!window.__firefoxMcpBridge) {
  window.__firefoxMcpBridge = true;

  browser.runtime.onMessage.addListener((msg) => {
    return handleCommand(msg);
  });
}

async function handleCommand({ command, params }) {
  switch (command) {
    case 'get_page_content': {
      const content = params.format === 'html'
        ? document.documentElement.outerHTML
        : document.body.innerText;
      return { content };
    }

    case 'evaluate_js': {
      // eslint-disable-next-line no-eval -- intentional automation power tool
      const raw = eval(params.code);
      // Await if the code returned a Promise
      const resolved = raw instanceof Promise ? await raw : raw;
      return { result: JSON.stringify(resolved) };
    }

    case 'click': {
      const el = document.querySelector(params.selector);
      if (!el) throw new Error(`Element not found: "${params.selector}"`);
      el.click();
      return null;
    }

    case 'type': {
      const el = document.querySelector(params.selector);
      if (!el) throw new Error(`Element not found: "${params.selector}"`);
      el.focus();
      el.value = params.text;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return null;
    }

    case 'scroll': {
      window.scrollBy(params.x, params.y);
      return null;
    }

    case 'find_element': {
      const el = document.querySelector(params.selector);
      if (!el) return { found: false };
      return { found: true, text: el.textContent?.trim() ?? '' };
    }

    default:
      throw new Error(`Unknown DOM command: ${command}`);
  }
}

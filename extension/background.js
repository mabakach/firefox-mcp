const DEFAULT_PORT = 9009;
const MIN_RECONNECT_MS = 1000;
const MAX_RECONNECT_MS = 30_000;

let ws = null;
let reconnectDelay = MIN_RECONNECT_MS;
let reconnectTimer = null;
let currentPort = DEFAULT_PORT;
let isConnected = false;

async function loadConfig() {
  const { token, port, tls } = await browser.storage.local.get(['token', 'port', 'tls']);
  currentPort = typeof port === 'number' ? port : DEFAULT_PORT;
  return { token: token ?? null, port: currentPort, tls: tls === true };
}

function makeCircleIcon(color, size) {
  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext('2d');
  const r = size / 2 - 1;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, r, 0, 2 * Math.PI);
  ctx.fillStyle = color;
  ctx.fill();
  return ctx.getImageData(0, 0, size, size);
}

function setStatus(connected) {
  isConnected = connected;
  const color = connected ? '#22c55e' : '#ef4444';
  const scheme = connected ? (ws?.url?.startsWith('wss') ? 'wss' : 'ws') : '';
  const title = connected
    ? `Firefox MCP — Connected  ${scheme}://127.0.0.1:${currentPort}`
    : 'Firefox MCP — Disconnected (reconnecting…)';
  browser.action.setIcon({ imageData: { 16: makeCircleIcon(color, 16), 32: makeCircleIcon(color, 32) } });
  browser.action.setTitle({ title });
}

browser.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'get_status') {
    return Promise.resolve({ connected: isConnected, port: currentPort });
  }
});

function disconnect() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (ws) {
    ws.onclose = null; // prevent reconnect loop when we intentionally close
    ws.close();
    ws = null;
  }
  setStatus(false);
}

async function connect() {
  const { token, port, tls } = await loadConfig();

  if (!token) {
    browser.action.setTitle({ title: 'Firefox MCP — No token configured. Open Options to set up.' });
    return;
  }

  const scheme = tls ? 'wss' : 'ws';
  ws = new WebSocket(`${scheme}://127.0.0.1:${port}`);

  ws.addEventListener('open', () => {
    reconnectDelay = MIN_RECONNECT_MS;
    ws.send(JSON.stringify({ type: 'auth', token }));
  });

  ws.addEventListener('message', async (event) => {
    let msg;
    try {
      msg = JSON.parse(event.data);
    } catch {
      return;
    }

    if (msg.type === 'auth_ok') {
      setStatus(true);
      return;
    }

    if (msg.type === 'command') {
      const response = await dispatch(msg);
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(response));
      }
    }
  });

  ws.addEventListener('close', (event) => {
    setStatus(false);
    // 4401 = bad token; don't retry immediately but still retry (user may fix token)
    reconnectTimer = setTimeout(connect, reconnectDelay);
    reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_MS);
  });

  ws.addEventListener('error', () => {
    // error always precedes close; let close handler drive reconnect
  });
}

async function dispatch(msg) {
  const { requestId, command, params } = msg;
  try {
    const data = await execute(command, params);
    return { type: 'response', requestId, ok: true, data };
  } catch (e) {
    return { type: 'response', requestId, ok: false, error: e.message ?? String(e) };
  }
}

async function getActiveTab() {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error('No active tab found');
  return tab;
}

async function relayToContent(command, params) {
  const tab = await getActiveTab();
  // Inject content script in case the tab was open before the extension loaded
  await browser.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['content.js'],
  }).catch(() => {});
  return browser.tabs.sendMessage(tab.id, { command, params });
}

async function execute(command, params) {
  switch (command) {
    case 'navigate': {
      const tab = await getActiveTab();
      await browser.tabs.update(tab.id, { url: params.url });
      return null;
    }

    case 'go_back': {
      const tab = await getActiveTab();
      await browser.tabs.goBack(tab.id);
      return null;
    }

    case 'go_forward': {
      const tab = await getActiveTab();
      await browser.tabs.goForward(tab.id);
      return null;
    }

    case 'reload': {
      const tab = await getActiveTab();
      await browser.tabs.reload(tab.id);
      return null;
    }

    case 'list_tabs': {
      const tabs = await browser.tabs.query({});
      return tabs.map((t) => ({ id: t.id, title: t.title ?? '', url: t.url ?? '', active: t.active }));
    }

    case 'new_tab': {
      const tab = await browser.tabs.create({ url: params.url });
      return { id: tab.id, title: tab.title ?? '', url: tab.url ?? '', active: tab.active };
    }

    case 'close_tab': {
      await browser.tabs.remove(params.tabId);
      return null;
    }

    case 'switch_tab': {
      await browser.tabs.update(params.tabId, { active: true });
      return null;
    }

    case 'screenshot': {
      const dataUrl = await browser.tabs.captureVisibleTab(null, { format: 'png' });
      return { dataUrl };
    }

    case 'get_cookies': {
      const tab = await getActiveTab();
      const url = new URL(tab.url ?? 'about:blank');
      const cookies = await browser.cookies.getAll({ domain: url.hostname });
      return cookies.map((c) => ({ name: c.name, value: c.value, domain: c.domain, path: c.path }));
    }

    case 'get_page_content':
    case 'evaluate_js':
    case 'click':
    case 'type':
    case 'scroll':
    case 'find_element':
      return relayToContent(command, params);

    default:
      throw new Error(`Unknown command: ${command}`);
  }
}

// Reconnect immediately when token or port is changed in options
browser.storage.onChanged.addListener((changes) => {
  if ('token' in changes || 'port' in changes || 'tls' in changes) {
    disconnect();
    connect();
  }
});

setStatus(false);
connect();

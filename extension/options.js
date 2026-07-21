const tokenInput = document.getElementById('token');
const portInput = document.getElementById('port');
const tlsInput = document.getElementById('tls');
const statusEl = document.getElementById('status');
const form = document.getElementById('options-form');
const dot = document.getElementById('dot');
const connectionLabel = document.getElementById('connection-label');
const statusIcon = document.getElementById('status-icon');

async function loadSaved() {
  const { token, port, tls } = await browser.storage.local.get(['token', 'port', 'tls']);
  if (token) tokenInput.value = token;
  if (typeof port === 'number') portInput.value = String(port);
  tlsInput.checked = tls === true;
}

async function updateConnectionStatus() {
  try {
    const { connected, port } = await browser.runtime.sendMessage({ type: 'get_status' });
    dot.className = `dot ${connected ? 'connected' : 'disconnected'}`;
    connectionLabel.textContent = connected ? `Connected  ws://127.0.0.1:${port}` : 'Disconnected (reconnecting…)';
    statusIcon.src = connected ? 'icons/connected.svg' : 'icons/disconnected.svg';
  } catch {
    dot.className = 'dot disconnected';
    connectionLabel.textContent = 'Disconnected';
    statusIcon.src = 'icons/disconnected.svg';
  }
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const token = tokenInput.value.trim();
  const port = parseInt(portInput.value, 10);
  const tls = tlsInput.checked;

  if (!token) {
    showStatus('Token cannot be empty.', true);
    return;
  }
  if (isNaN(port) || port < 1024 || port > 65535) {
    showStatus('Port must be between 1024 and 65535.', true);
    return;
  }

  await browser.storage.local.set({ token, port, tls });
  showStatus('Saved — reconnecting…', false);

  // Poll for status update after save (background reconnects via storage.onChanged)
  setTimeout(updateConnectionStatus, 1500);
  setTimeout(updateConnectionStatus, 3000);
});

function showStatus(msg, isError) {
  statusEl.textContent = msg;
  statusEl.className = isError ? 'error' : '';
  statusEl.style.display = 'inline';
  if (!isError) {
    setTimeout(() => { statusEl.style.display = 'none'; }, 4000);
  }
}

loadSaved();
updateConnectionStatus();
setInterval(updateConnectionStatus, 2000);

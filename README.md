# mcp-browser-bridge

Remote-control Firefox from Claude Code via the Model Context Protocol.

```
Claude Code  ──stdio──▶  MCP Server (Node.js)
                              │
                    WebSocket ws://127.0.0.1:9009
                              │
                    Firefox Extension (MV3)
                    ├── background.js  — tabs, navigation, screenshots
                    └── content.js     — DOM interaction
```

The MCP server exposes 16 browser-automation tools. The Firefox extension connects to the server over a local WebSocket, authenticates with a shared secret, and executes commands inside Firefox. All traffic stays on `127.0.0.1` — nothing is exposed to the network.

---

## Prerequisites

- **Node.js** 18 or later
- **Yarn** (`npm install -g yarn`)
- **Firefox** 109 or later (Manifest V3 support)
- **Claude Code** CLI

---

## 1. Build the MCP server

```bash
git clone <this-repo>
cd mcp-browser-bridge
yarn install
yarn build
```

The compiled server lands in `dist/index.js`.

---

## 2. Generate a secret token

The extension and the server share a secret token. Generate one and keep it — you'll need it in both steps below.

```bash
openssl rand -hex 32
```

Example output: `a3f8c2d1e4b7...` — copy this string.

---

## 3. Install the Firefox extension

1. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on…**
3. Navigate to the `extension/` folder inside this repo and select `manifest.json`
4. The **MCP Browser Bridge** extension appears in the toolbar with a **red** icon (disconnected)

> **Temporary add-ons** are removed when Firefox restarts. For a permanent installation use Firefox Developer Edition with `xpinstall.signatures.required` set to `false` in `about:config`, then load the extension via `about:addons` → Install Add-on From File.

### Configure the extension

1. **Right-click** the toolbar icon → **Manage Extension** → **Preferences**  
   *(or: `about:addons` → MCP Browser Bridge → Preferences)*
2. Paste your secret token into the **Secret Token** field
3. Set the **WebSocket Port** (default: `9009`) — must match `FIREFOX_MCP_WS_PORT` on the server
4. Click **Save**

The toolbar icon turns **green** once the extension connects to a running MCP server.

> **Firefox HTTPS-Only Mode:** Extension background pages are treated as a secure context, so Firefox upgrades `ws://` to `wss://` when HTTPS-Only Mode is on. Adding a site exception does not help. Use the wss:// setup below instead.

---

## 4. Register the server with Claude Code

Use the `claude mcp add` command. Replace the path and token with your own values:

```bash
claude mcp add mcp-browser-bridge \
  -e FIREFOX_MCP_TOKEN=<your-secret-token> \
  -e FIREFOX_MCP_WS_PORT=9009 \
  -- node /absolute/path/to/mcp-browser-bridge/dist/index.js
```

This registers the server at the default **local** scope (current machine, all projects). To restrict it to a single project, add `--scope project`; to make it available across all machines via your user config, use `--scope user`.

Confirm the server is registered:

```bash
claude mcp list
```

The server will connect automatically the next time you start Claude Code. Run `/mcp` inside a session to check its live status.

---

## 5. Verify the setup

Ask Claude:

> "List my open Firefox tabs."

The extension icon should be **green** and Claude should respond with a formatted list of your open tabs.

---

## Available tools

| Tool | Description |
|---|---|
| `navigate` | Navigate the active tab to a URL |
| `go_back` | Go back in browser history |
| `go_forward` | Go forward in browser history |
| `reload` | Reload the active tab |
| `list_tabs` | List all open tabs (id, title, url, active) |
| `new_tab` | Open a new tab, optionally at a URL |
| `close_tab` | Close a tab by numeric ID |
| `switch_tab` | Focus a tab by numeric ID |
| `get_page_content` | Get page content as plain text or HTML |
| `evaluate_js` | Evaluate JavaScript in the page context |
| `screenshot` | Capture the active tab as a PNG image |
| `get_cookies` | List cookies for the active tab's domain |
| `click` | Click a DOM element by CSS selector |
| `type` | Type text into an input by CSS selector |
| `scroll` | Scroll the page by x/y pixels |
| `find_element` | Check if a selector exists and return its text |

### `evaluate_js`

This is an intentional power tool. It executes arbitrary JavaScript in the page context and can read/write the DOM, call page functions, or make fetch requests. For async code, wrap it in an immediately-invoked async function:

```javascript
(async () => {
  const res = await fetch('/api/data');
  return await res.json();
})()
```

---

## wss:// setup (Firefox HTTPS-Only Mode)

Firefox extension background pages run in a secure context (`moz-extension://`), so Firefox upgrades plain `ws://` connections to `wss://` when HTTPS-Only Mode is enabled. Site exceptions in the Firefox settings do **not** help here — the upgrade happens at the extension level, not the tab level. The fix is to run the server with TLS.

### Why mkcert

The server needs a certificate that Firefox trusts. Self-signed certs are rejected. `mkcert` creates a local certificate authority (CA), installs it into the system and browser trust stores, and issues a cert signed by that CA — so Firefox accepts the `wss://` connection without warnings or errors.

### 1. Install mkcert

```bash
brew install mkcert nss   # nss is required to add the CA to Firefox's cert store
```

### 2. Install the local CA

```bash
mkcert -install
```

This creates the CA and registers it with Firefox (via the `nss` cert database). You only need to do this once per machine.

### 3. Generate a certificate for 127.0.0.1

```bash
mkdir -p ~/.mcp-browser-bridge
mkcert -key-file ~/.mcp-browser-bridge/key.pem -cert-file ~/.mcp-browser-bridge/cert.pem 127.0.0.1
```

### 4. Pass the cert paths to the MCP server

```bash
claude mcp add mcp-browser-bridge \
  -s user \
  -e FIREFOX_MCP_TOKEN=<your-token> \
  -e FIREFOX_MCP_WS_PORT=9009 \
  -e FIREFOX_MCP_TLS_CERT=$HOME/.mcp-browser-bridge/cert.pem \
  -e FIREFOX_MCP_TLS_KEY=$HOME/.mcp-browser-bridge/key.pem \
  -- node /absolute/path/to/mcp-browser-bridge/dist/index.js
```

If you already have the server registered without TLS, remove it first:

```bash
claude mcp remove mcp-browser-bridge
```

### 5. Enable wss:// in the extension options

Open the extension **Preferences** page, tick **Use secure WebSocket (wss://)**, and click **Save**. Reload the extension in `about:debugging` if the icon does not turn green within a few seconds.

---

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `FIREFOX_MCP_TOKEN` | *(required)* | Shared secret; must match the token set in the extension options |
| `FIREFOX_MCP_WS_PORT` | `9009` | WebSocket port the server listens on |
| `FIREFOX_MCP_TLS_CERT` | — | Path to TLS certificate file (enables wss://) |
| `FIREFOX_MCP_TLS_KEY` | — | Path to TLS private key file (enables wss://) |

---

## Development

Run the server without building first (uses `tsx` for on-the-fly TypeScript):

```bash
FIREFOX_MCP_TOKEN=mytoken yarn dev
```

Type-check without emitting:

```bash
yarn typecheck
```

---

## Known limitations

- `evaluate_js` returns the synchronous return value. For async results, use the IIFE pattern shown above.
- `type` may not work on React / Vue controlled inputs. Use `evaluate_js` as an escape hatch.
- `get_page_content` with `format: html` can return very large strings on complex pages; prefer `text`.
- Content scripts cannot be injected into `about:*`, `moz-extension:*`, or PDF viewer tabs. DOM tools will return an error on those pages.
- The extension is a **temporary add-on** by default and must be reloaded after Firefox restarts.

---

## Security

- The WebSocket server binds exclusively to `127.0.0.1` — it is never reachable from the network.
- The extension rejects any connection attempt that does not present the correct token as its first message (WebSocket close code `4401`).
- Do not expose the MCP server to untrusted AI clients or forward it over SSH tunnels without understanding the implications of `evaluate_js`.

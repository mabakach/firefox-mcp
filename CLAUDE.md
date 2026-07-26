# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
yarn build        # compile TypeScript → dist/index.js
yarn dev          # run server without building (tsx, requires FIREFOX_MCP_TOKEN env var)
yarn typecheck    # type-check without emitting
```

No test suite exists. Manual verification requires a running Firefox instance with the extension loaded.

## Architecture

The project has two independent components that communicate via WebSocket:

**MCP Server** (`src/`) — TypeScript, compiled to `dist/`. Runs as a Node.js process registered with Claude Code via `claude mcp add`. Communicates with Claude Code over stdio using `@modelcontextprotocol/sdk`.

**Firefox Extension** (`extension/`) — Manifest V3, plain JS, loaded as a temporary add-on. No build step — the `extension/` directory is loaded directly into Firefox.

### Request flow

```
Claude Code  ──stdio──▶  MCP Server  ──WebSocket──▶  Firefox Extension
                         (src/)                       (extension/)
```

1. Claude invokes an MCP tool → `mcp-server.ts` receives it
2. `mcp-server.ts` calls `bridge.send(command, params)` → `bridge.ts` serializes it with a `requestId` and sends over the active WebSocket
3. `extension/background.js` receives the command; DOM-touching commands are forwarded to `extension/content.js` via `browser.tabs.sendMessage`; browser API commands (tabs, screenshots, cookies) are handled directly in the background script
4. Response is sent back as `{ type: 'response', requestId, ok, data/error }` → `bridge.ts` resolves the pending Promise

### Multi-session IPC (`src/ipc.ts`)

Only one process can bind a given port. When a second Claude Code session starts, `index.ts` catches `EADDRINUSE` and connects to the primary instance via a Unix socket at `/tmp/firefox-mcp-<port>.sock`. The `IpcBridge` class implements the same `IBridge` interface as `Bridge`, so `mcp-server.ts` is unaware of whether it's primary or secondary.

### Authentication

The extension sends `{ type: 'auth', token }` as its first WebSocket message. The server closes the connection with code `4401` if the token doesn't match. Only one authenticated socket is active at a time; a new connection displaces the previous one.

### TLS mode (wss://)

When `FIREFOX_MCP_TLS_CERT` and `FIREFOX_MCP_TLS_KEY` are set, `ws-server.ts` creates an HTTPS server and attaches the WebSocket server to it instead of listening on a plain TCP socket. Required when Firefox's HTTPS-Only Mode is enabled, because extension background pages are a secure context and Firefox upgrades `ws://` to `wss://` automatically.

### Adding a new tool

1. Add the command name to `CommandName` in `src/types.ts`
2. Handle it in `extension/background.js` `execute()` — either directly with browser APIs, or via `relayToContent()` for DOM operations
3. If relayed, handle the message in `extension/content.js`
4. Register the MCP tool in the appropriate file under `src/tools/` using `server.tool(name, schema, handler)` where the handler calls `bridge.send(command, params)`

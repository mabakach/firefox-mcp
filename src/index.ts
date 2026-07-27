import { existsSync } from 'node:fs';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { startWsServer } from './ws-server.js';
import { startIpcServer, IpcBridge, ipcSocketPath } from './ipc.js';
import { createMcpServer } from './mcp-server.js';

const token = process.env.FIREFOX_MCP_TOKEN;
if (!token) {
  process.stderr.write('Error: FIREFOX_MCP_TOKEN environment variable is required\n');
  process.exit(1);
}

const port = parseInt(process.env.FIREFOX_MCP_WS_PORT ?? '9009', 10);
if (isNaN(port) || port < 1024 || port > 65535) {
  process.stderr.write('Error: FIREFOX_MCP_WS_PORT must be a valid port number (1024-65535)\n');
  process.exit(1);
}

const tlsCert = process.env.FIREFOX_MCP_TLS_CERT;
const tlsKey = process.env.FIREFOX_MCP_TLS_KEY;

if (tlsCert && !existsSync(tlsCert)) {
  process.stderr.write(`Error: FIREFOX_MCP_TLS_CERT file not found: ${tlsCert}\nRun mkcert to generate it — see README for setup instructions.\n`);
  process.exit(1);
}
if (tlsKey && !existsSync(tlsKey)) {
  process.stderr.write(`Error: FIREFOX_MCP_TLS_KEY file not found: ${tlsKey}\nRun mkcert to generate it — see README for setup instructions.\n`);
  process.exit(1);
}

const socketPath = ipcSocketPath(port);
let bridge;

try {
  const wsBridge = await startWsServer({ port, token, tlsCert, tlsKey });
  startIpcServer(socketPath, wsBridge);
  bridge = wsBridge;
} catch (e) {
  if ((e as NodeJS.ErrnoException).code !== 'EADDRINUSE') throw e;
  process.stderr.write(`[mcp-browser-bridge] Port ${port} in use — connecting to existing instance\n`);
  try {
    bridge = await IpcBridge.connect(socketPath);
    process.stderr.write('[mcp-browser-bridge] Running as secondary instance\n');
  } catch {
    process.stderr.write(
      `[mcp-browser-bridge] Error: port ${port} is occupied by a non-mcp-browser-bridge process, or the primary instance has not started yet.\n`,
    );
    process.exit(1);
  }
}

const server = createMcpServer(bridge);
const transport = new StdioServerTransport();
await server.connect(transport);

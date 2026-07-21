import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { startWsServer } from './ws-server.js';
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

import { existsSync } from 'node:fs';

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

const bridge = startWsServer({ port, token, tlsCert, tlsKey });
const server = createMcpServer(bridge);
const transport = new StdioServerTransport();
await server.connect(transport);

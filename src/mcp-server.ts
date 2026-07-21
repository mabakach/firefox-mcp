import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Bridge } from './bridge.js';
import { registerNavigationTools } from './tools/navigation.js';
import { registerTabTools } from './tools/tabs.js';
import { registerPageTools } from './tools/page.js';
import { registerInteractionTools } from './tools/interaction.js';

export function createMcpServer(bridge: Bridge): McpServer {
  const server = new McpServer({
    name: 'firefox-mcp',
    version: '0.1.0',
  });

  registerNavigationTools(server, bridge);
  registerTabTools(server, bridge);
  registerPageTools(server, bridge);
  registerInteractionTools(server, bridge);

  return server;
}

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { Bridge } from '../bridge.js';

export function registerNavigationTools(server: McpServer, bridge: Bridge): void {
  server.tool('navigate', 'Navigate the active Firefox tab to a URL.', { url: z.string().url().describe('URL to navigate to') }, async ({ url }) => {
    try {
      await bridge.send('navigate', { url });
      return { content: [{ type: 'text' as const, text: `Navigated to ${url}` }] };
    } catch (e) {
      return { content: [{ type: 'text' as const, text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
    }
  });

  server.tool('go_back', 'Navigate the active Firefox tab back in browser history.', async () => {
    try {
      await bridge.send('go_back');
      return { content: [{ type: 'text' as const, text: 'Navigated back' }] };
    } catch (e) {
      return { content: [{ type: 'text' as const, text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
    }
  });

  server.tool('go_forward', 'Navigate the active Firefox tab forward in browser history.', async () => {
    try {
      await bridge.send('go_forward');
      return { content: [{ type: 'text' as const, text: 'Navigated forward' }] };
    } catch (e) {
      return { content: [{ type: 'text' as const, text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
    }
  });

  server.tool('reload', 'Reload the active Firefox tab.', async () => {
    try {
      await bridge.send('reload');
      return { content: [{ type: 'text' as const, text: 'Page reloaded' }] };
    } catch (e) {
      return { content: [{ type: 'text' as const, text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
    }
  });
}

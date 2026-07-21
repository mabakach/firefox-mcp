import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { Bridge } from '../bridge.js';
import type { TabInfo } from '../types.js';

export function registerTabTools(server: McpServer, bridge: Bridge): void {
  server.tool('list_tabs', 'List all open Firefox tabs with their id, title, url, and active status.', async () => {
    try {
      const tabs = (await bridge.send('list_tabs')) as TabInfo[];
      const text = tabs.map((t) => `[${t.active ? '*' : ' '}] #${t.id}  ${t.title}\n       ${t.url}`).join('\n');
      return { content: [{ type: 'text' as const, text: text || '(no tabs)' }] };
    } catch (e) {
      return { content: [{ type: 'text' as const, text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
    }
  });

  server.tool(
    'new_tab',
    'Open a new Firefox tab, optionally navigating to a URL.',
    { url: z.string().url().optional().describe('URL to open — omit for a blank tab') },
    async ({ url }) => {
      try {
        const tab = (await bridge.send('new_tab', url ? { url } : {})) as TabInfo;
        return { content: [{ type: 'text' as const, text: `Opened tab #${tab.id}` }] };
      } catch (e) {
        return { content: [{ type: 'text' as const, text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
      }
    },
  );

  server.tool(
    'close_tab',
    'Close a Firefox tab by its numeric ID (use list_tabs to find IDs).',
    { tabId: z.number().int().describe('Numeric tab ID to close') },
    async ({ tabId }) => {
      try {
        await bridge.send('close_tab', { tabId });
        return { content: [{ type: 'text' as const, text: `Closed tab #${tabId}` }] };
      } catch (e) {
        return { content: [{ type: 'text' as const, text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
      }
    },
  );

  server.tool(
    'switch_tab',
    'Activate (focus) a Firefox tab by its numeric ID.',
    { tabId: z.number().int().describe('Numeric tab ID to switch to') },
    async ({ tabId }) => {
      try {
        await bridge.send('switch_tab', { tabId });
        return { content: [{ type: 'text' as const, text: `Switched to tab #${tabId}` }] };
      } catch (e) {
        return { content: [{ type: 'text' as const, text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
      }
    },
  );
}

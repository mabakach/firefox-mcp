import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { Bridge } from '../bridge.js';

export function registerPageTools(server: McpServer, bridge: Bridge): void {
  server.tool(
    'get_page_content',
    'Get the content of the active Firefox tab as plain text or raw HTML.',
    { format: z.enum(['text', 'html']).default('text').describe('Return plain text (default) or raw HTML') },
    async ({ format }) => {
      try {
        const result = (await bridge.send('get_page_content', { format })) as { content: string };
        return { content: [{ type: 'text' as const, text: result.content }] };
      } catch (e) {
        return { content: [{ type: 'text' as const, text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
      }
    },
  );

  server.tool(
    'evaluate_js',
    'Evaluate arbitrary JavaScript in the active tab\'s page context and return the result. ' +
      'This is an intentional power tool for browser automation — it can read/write the DOM, make fetch requests, ' +
      'or call any page function. The return value is serialized to JSON. ' +
      'For async code, wrap in an immediately-invoked async function: (async () => { return await ... })()',
    { code: z.string().describe('JavaScript code to evaluate in the page context') },
    async ({ code }) => {
      try {
        const result = (await bridge.send('evaluate_js', { code })) as { result: string };
        return { content: [{ type: 'text' as const, text: result.result }] };
      } catch (e) {
        return { content: [{ type: 'text' as const, text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
      }
    },
  );

  server.tool('screenshot', 'Capture the visible area of the active Firefox tab as a PNG image.', async () => {
    try {
      const result = (await bridge.send('screenshot')) as { dataUrl: string };
      const base64 = result.dataUrl.replace(/^data:image\/png;base64,/, '');
      return { content: [{ type: 'image' as const, data: base64, mimeType: 'image/png' }] };
    } catch (e) {
      return { content: [{ type: 'text' as const, text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
    }
  });

  server.tool("get_cookies", "List cookies for the active tab's domain.", async () => {
    try {
      const cookies = (await bridge.send('get_cookies')) as Array<{
        name: string;
        value: string;
        domain: string;
        path: string;
      }>;
      const text = cookies.map((c) => `${c.name}=${c.value}  (domain: ${c.domain}, path: ${c.path})`).join('\n');
      return { content: [{ type: 'text' as const, text: text || '(no cookies)' }] };
    } catch (e) {
      return { content: [{ type: 'text' as const, text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
    }
  });
}

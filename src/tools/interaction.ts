import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { IBridge } from '../bridge.js';

export function registerInteractionTools(server: McpServer, bridge: IBridge): void {
  server.tool(
    'click',
    'Click a DOM element in the active Firefox tab identified by a CSS selector.',
    { selector: z.string().describe('CSS selector of the element to click') },
    async ({ selector }) => {
      try {
        await bridge.send('click', { selector });
        return { content: [{ type: 'text' as const, text: `Clicked "${selector}"` }] };
      } catch (e) {
        return { content: [{ type: 'text' as const, text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
      }
    },
  );

  server.tool(
    'type',
    'Type text into an input or textarea in the active Firefox tab identified by a CSS selector. ' +
      'Note: may not work on React/Vue controlled inputs — use evaluate_js as an escape hatch for those.',
    {
      selector: z.string().describe('CSS selector of the input element'),
      text: z.string().describe('Text to type into the element'),
    },
    async ({ selector, text }) => {
      try {
        await bridge.send('type', { selector, text });
        return { content: [{ type: 'text' as const, text: `Typed into "${selector}"` }] };
      } catch (e) {
        return { content: [{ type: 'text' as const, text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
      }
    },
  );

  server.tool(
    'scroll',
    'Scroll the active Firefox tab by a given number of pixels.',
    {
      x: z.number().describe('Horizontal scroll amount in pixels (positive = right)'),
      y: z.number().describe('Vertical scroll amount in pixels (positive = down)'),
    },
    async ({ x, y }) => {
      try {
        await bridge.send('scroll', { x, y });
        return { content: [{ type: 'text' as const, text: `Scrolled by (${x}px, ${y}px)` }] };
      } catch (e) {
        return { content: [{ type: 'text' as const, text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
      }
    },
  );

  server.tool(
    'find_element',
    'Check if a CSS selector matches an element in the active tab and return its text content.',
    { selector: z.string().describe('CSS selector to search for') },
    async ({ selector }) => {
      try {
        const result = (await bridge.send('find_element', { selector })) as { found: boolean; text?: string };
        if (!result.found) {
          return { content: [{ type: 'text' as const, text: `Element not found: "${selector}"` }] };
        }
        return { content: [{ type: 'text' as const, text: result.text ?? '(no text content)' }] };
      } catch (e) {
        return { content: [{ type: 'text' as const, text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
      }
    },
  );
}

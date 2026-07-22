import { createServer as createHttpsServer } from 'node:https';
import { readFileSync } from 'node:fs';
import { WebSocketServer, WebSocket } from 'ws';
import { Bridge } from './bridge.js';
import type { ExtensionMessage } from './types.js';

export function startWsServer({
  port,
  token,
  tlsCert,
  tlsKey,
}: {
  port: number;
  token: string;
  tlsCert?: string;
  tlsKey?: string;
}): Promise<Bridge> {
  return new Promise((resolve, reject) => {
  const bridge = new Bridge();

  let wss: WebSocketServer;
  if (tlsCert && tlsKey) {
    const httpsServer = createHttpsServer({
      cert: readFileSync(tlsCert),
      key: readFileSync(tlsKey),
    });
    wss = new WebSocketServer({ server: httpsServer });
    httpsServer.on('error', reject);
    httpsServer.listen(port, '127.0.0.1');
  } else {
    wss = new WebSocketServer({ host: '127.0.0.1', port });
    wss.on('error', reject);
  }

  let activeSocket: WebSocket | null = null;

  wss.on('connection', (ws) => {
    let authenticated = false;

    ws.on('message', (raw) => {
      let msg: ExtensionMessage;
      try {
        msg = JSON.parse(raw.toString()) as ExtensionMessage;
      } catch {
        ws.close(4400, 'Invalid JSON');
        return;
      }

      if (!authenticated) {
        if (msg.type === 'auth' && msg.token === token) {
          authenticated = true;
          if (activeSocket && activeSocket !== ws) {
            activeSocket.close(4409, 'Replaced by new connection');
          }
          activeSocket = ws;
          bridge.setSocket(ws);
          ws.send(JSON.stringify({ type: 'auth_ok' }));
        } else {
          ws.close(4401, 'Unauthorized');
        }
        return;
      }

      if (msg.type === 'response') {
        bridge.receiveResponse(msg);
      }
    });

    ws.on('close', () => {
      if (ws === activeSocket) {
        activeSocket = null;
        bridge.clearSocket();
      }
    });

    ws.on('error', (err) => {
      process.stderr.write(`[ws] Socket error: ${err.message}\n`);
    });
  });

  wss.on('listening', () => {
    const scheme = tlsCert && tlsKey ? 'wss' : 'ws';
    process.stderr.write(`[firefox-mcp] WebSocket server listening on ${scheme}://127.0.0.1:${port}\n`);
    resolve(bridge);
  });

  }); // end Promise
}

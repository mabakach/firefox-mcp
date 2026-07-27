import { createServer, createConnection } from 'node:net';
import { unlinkSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import type { Bridge, IBridge } from './bridge.js';
import type { CommandName } from './types.js';

export function ipcSocketPath(port: number): string {
  return `/tmp/mcp-browser-bridge-${port}.sock`;
}

// Run on the primary instance: accepts command requests from secondaries.
export function startIpcServer(socketPath: string, bridge: Bridge): void {
  try { unlinkSync(socketPath); } catch {}

  const server = createServer((socket) => {
    let buf = '';
    socket.on('data', (chunk) => {
      buf += chunk.toString();
      const lines = buf.split('\n');
      buf = lines.pop()!;
      for (const line of lines) {
        if (!line.trim()) continue;
        let msg: { type: string; requestId: string; command: CommandName; params?: Record<string, unknown> };
        try { msg = JSON.parse(line); } catch { continue; }
        if (msg.type !== 'command') continue;
        bridge.send(msg.command, msg.params ?? {}).then(
          (data) => socket.write(JSON.stringify({ type: 'response', requestId: msg.requestId, ok: true, data }) + '\n'),
          (err: Error) => socket.write(JSON.stringify({ type: 'response', requestId: msg.requestId, ok: false, error: err.message }) + '\n'),
        );
      }
    });
    socket.on('error', () => {});
  });

  server.listen(socketPath);
  process.on('exit', () => { try { unlinkSync(socketPath); } catch {} });
}

// Used by secondary instances: forwards send() calls to the primary over the Unix socket.
export class IpcBridge implements IBridge {
  private buf = '';
  private readonly pending = new Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
  private readonly socket;

  private constructor(socketPath: string) {
    this.socket = createConnection(socketPath);
    this.socket.on('data', (chunk) => {
      this.buf += chunk.toString();
      const lines = this.buf.split('\n');
      this.buf = lines.pop()!;
      for (const line of lines) {
        if (!line.trim()) continue;
        let msg: { type: string; requestId: string; ok: boolean; data?: unknown; error?: string };
        try { msg = JSON.parse(line); } catch { continue; }
        const req = this.pending.get(msg.requestId);
        if (!req) continue;
        this.pending.delete(msg.requestId);
        if (msg.ok) req.resolve(msg.data);
        else req.reject(new Error(msg.error ?? 'Unknown IPC error'));
      }
    });
    this.socket.on('close', () => {
      for (const [id, req] of this.pending) {
        this.pending.delete(id);
        req.reject(new Error('Connection to primary mcp-browser-bridge instance lost'));
      }
    });
    this.socket.on('error', () => {});
  }

  static connect(socketPath: string): Promise<IpcBridge> {
    return new Promise((resolve, reject) => {
      const bridge = new IpcBridge(socketPath);
      bridge.socket.once('connect', () => resolve(bridge));
      bridge.socket.once('error', reject);
    });
  }

  async send(command: CommandName, params: Record<string, unknown> = {}): Promise<unknown> {
    const requestId = randomUUID();
    return new Promise((resolve, reject) => {
      this.pending.set(requestId, { resolve, reject });
      this.socket.write(JSON.stringify({ type: 'command', requestId, command, params }) + '\n');
    });
  }
}

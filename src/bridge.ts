import { randomUUID } from 'node:crypto';
import type { WebSocket } from 'ws';
import type { CommandName, PendingRequest, ResponseMessage } from './types.js';

export interface IBridge {
  send(command: CommandName, params?: Record<string, unknown>): Promise<unknown>;
}

const TIMEOUT_MS = 30_000;
// How long to wait for the extension to (re)connect before giving up on a command.
// Covers the case where a secondary MCP instance calls a tool while the extension
// is mid-reconnect; the command queues here until auth_ok arrives.
const SOCKET_WAIT_MS = 10_000;

export class Bridge implements IBridge {
  private socket: WebSocket | null = null;
  private pending = new Map<string, PendingRequest>();
  private waiters: Array<() => void> = [];

  setSocket(ws: WebSocket): void {
    this.socket = ws;
    // Wake all queued send() calls that were waiting for a connection.
    const woken = this.waiters.splice(0);
    for (const wake of woken) wake();
  }

  clearSocket(): void {
    this.socket = null;
    // Reject in-flight commands; leave waiters alive so they can be served
    // when the extension reconnects and setSocket() is called again.
    for (const [id, req] of this.pending) {
      clearTimeout(req.timer);
      req.reject(new Error('Extension disconnected'));
      this.pending.delete(id);
    }
  }

  isConnected(): boolean {
    return this.socket !== null;
  }

  private waitForSocket(): Promise<void> {
    if (this.socket) return Promise.resolve();
    return new Promise<void>((resolve, reject) => {
      let settled = false;
      const wake = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve();
      };
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        const idx = this.waiters.indexOf(wake);
        if (idx !== -1) this.waiters.splice(idx, 1);
        reject(new Error(
          'No Firefox extension connected. Load the extension in Firefox and configure it with the correct token and port.',
        ));
      }, SOCKET_WAIT_MS);
      this.waiters.push(wake);
    });
  }

  async send(command: CommandName, params: Record<string, unknown> = {}): Promise<unknown> {
    if (!this.socket) await this.waitForSocket();

    const requestId = randomUUID();

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(requestId);
        reject(new Error(`Command "${command}" timed out after ${TIMEOUT_MS / 1000}s`));
      }, TIMEOUT_MS);

      this.pending.set(requestId, { resolve, reject, timer });
      this.socket!.send(JSON.stringify({ type: 'command', requestId, command, params }));
    });
  }

  receiveResponse(msg: ResponseMessage): void {
    const req = this.pending.get(msg.requestId);
    if (!req) return;
    clearTimeout(req.timer);
    this.pending.delete(msg.requestId);
    if (msg.ok) {
      req.resolve(msg.data);
    } else {
      req.reject(new Error(msg.error ?? 'Unknown error from extension'));
    }
  }
}

import { randomUUID } from 'node:crypto';
import type { WebSocket } from 'ws';
import type { CommandName, PendingRequest, ResponseMessage } from './types.js';

export interface IBridge {
  send(command: CommandName, params?: Record<string, unknown>): Promise<unknown>;
}

const TIMEOUT_MS = 30_000;

export class Bridge implements IBridge {
  private socket: WebSocket | null = null;
  private pending = new Map<string, PendingRequest>();

  setSocket(ws: WebSocket): void {
    this.socket = ws;
  }

  clearSocket(): void {
    this.socket = null;
    for (const [id, req] of this.pending) {
      clearTimeout(req.timer);
      req.reject(new Error('Extension disconnected'));
      this.pending.delete(id);
    }
  }

  isConnected(): boolean {
    return this.socket !== null;
  }

  async send(command: CommandName, params: Record<string, unknown> = {}): Promise<unknown> {
    if (!this.socket) {
      throw new Error(
        'No Firefox extension connected. Load the extension in Firefox and configure it with the correct token and port.',
      );
    }

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

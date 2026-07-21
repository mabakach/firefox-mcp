export type CommandName =
  | 'navigate'
  | 'go_back'
  | 'go_forward'
  | 'reload'
  | 'list_tabs'
  | 'new_tab'
  | 'close_tab'
  | 'switch_tab'
  | 'get_page_content'
  | 'evaluate_js'
  | 'click'
  | 'type'
  | 'scroll'
  | 'screenshot'
  | 'get_cookies'
  | 'find_element';

export type AuthMessage = { type: 'auth'; token: string };
export type AuthOkMessage = { type: 'auth_ok' };

export type CommandMessage = {
  type: 'command';
  requestId: string;
  command: CommandName;
  params: Record<string, unknown>;
};

export type ResponseMessage = {
  type: 'response';
  requestId: string;
  ok: boolean;
  data?: unknown;
  error?: string;
};

export type ExtensionMessage = AuthMessage | ResponseMessage;
export type ServerMessage = AuthOkMessage | CommandMessage;

export type PendingRequest = {
  resolve: (data: unknown) => void;
  reject: (reason: Error) => void;
  timer: NodeJS.Timeout;
};

export type TabInfo = {
  id: number;
  title: string;
  url: string;
  active: boolean;
};

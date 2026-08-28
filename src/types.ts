export type ServerStatus = {
  connected: boolean;
  connecting?: boolean;
  error?: string;
  server?: string;
};

export type NatsMessage = {
  type: "message";
  subject: string;
  payload: unknown;
  timestamp: number;
  size: number;
};

export type LogEntry = {
  id: number;
  timestamp: number;
  path: string;
  subject: string;
  value: unknown;
};

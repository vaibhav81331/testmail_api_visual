export interface Attachment {
  filename: string;
  contentType: string;
  size: number; // in bytes
  downloadUrl: string;
}

export interface Email {
  id: string;
  from: string;
  subject: string;
  html?: string;
  text?: string;
  timestamp: number;
  tag: string;
  to: string;
  attachments?: Attachment[];
}

export interface ApiResponse {
  result: 'success' | 'fail';
  message?: string;
  count: number;
  limit: number;
  offset: number;
  emails: Email[];
}

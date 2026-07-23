export interface Attachment {
  name: string;
  extension: string;
  size: string;
  content: string; // can be text or data URL
}

export interface PastedContent {
  title: string;
  extension: string;
  content: string;
  lineCount: number;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  attachments?: Attachment[];
  pastedContents?: PastedContent[];
  pendingDecision?: {
    rawText: string;
    userPrompt: string;
  };
  hasSelectedChatMode?: boolean;
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: number;
  messages: Message[];
  code?: string;
}

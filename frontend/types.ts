
export interface DocumentState {
  id: string;
  title: string;
  content: string;
  lastModified: number;
}

export type AIAction = 'continue' | 'brainstorm' | 'refine' | 'summarize';

export interface AIResponse {
  text: string;
  action: AIAction;
}

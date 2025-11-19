export interface UserProfile {
  fullName: string;
  age: number;
  currentDate: string;
  birthCity: string;
}

export interface DreamContext {
  dreamText: string;
  dreamDate: string;
  dreamTime: string;
  additionalNotes: string;
  image?: string; // Base64 string of uploaded/generated image
}

export interface DreamHistoryItem {
  id: string;
  dream: DreamContext;
  analysis: string;
  timestamp: number;
}

export enum AppView {
  ONBOARDING = 'ONBOARDING',
  INPUT = 'INPUT',
  ANALYSIS = 'ANALYSIS',
  CHAT = 'CHAT',
  VISUALIZER = 'VISUALIZER'
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}

export interface AnalysisResponse {
  personalAnalysis: string;
  universalAnalysis: string;
  futuristicPerspective: string;
  symbolism: string[];
}
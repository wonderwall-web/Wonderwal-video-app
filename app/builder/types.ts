export type VideoStyle = 'ERA_KOLONIAL' | 'SEJARAH_PERJUANGAN' | 'LEGENDA_RAKYAT' | 'BUDAYA_NUSANTARA';
export type VideoFormat = 'SHORT' | 'LONG';
export type AudienceType = 'LOCAL' | 'GLOBAL';
export type GenreType = 'DRAMA' | 'MYSTERY' | 'ACTION' | 'HORROR';
export type TemplateType = 'VIRAL_DRAMA' | 'DOCUMENTARY' | 'MYSTERY_REVEAL';

export type MotionEasing = 'LINEAR' | 'EASE_IN' | 'EASE_OUT' | 'EASE_IN_OUT';

export interface Scene {
  id: string;
  narrative: string;
  imagePromptA: string;
  imagePromptB: string;
  videoPrompt: string;
  imageDataA?: string;
  imageDataB?: string;
  audioData?: AudioBuffer;
  audioRaw?: string;
  isGeneratingImageA?: boolean;
  isGeneratingImageB?: boolean;
  isGeneratingAudio?: boolean;
}

export interface VideoProject {
  topic: string;
  style: VideoStyle;
  format: VideoFormat;
  audience: AudienceType;
  genre: GenreType;
  template: TemplateType;
  referenceImage?: string;
  scenes: Scene[];
}

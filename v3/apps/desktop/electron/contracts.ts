import type { TrimSegment, VideoProbeMetadata } from '../../../../v4/apps/web/lib/squish-core';

export type NativeJob =
  | { kind: 'compress'; path: string }
  | { kind: 'merge'; paths: string[] }
  | { kind: 'trim'; path: string; deleteSegments: TrimSegment[] };

/** Encoder progress from the main process; the renderer maps it to phases. */
export interface NativeJobProgress {
  jobId: string;
  stage: 'preparing' | 'encoding' | 'finalizing';
  /** 0–1 within the stage; for encoding, across every attempt of the job. */
  ratio: number;
}

export interface NativeJobResult {
  originalSize: number;
  compressedSize: number;
  filename: string;
  /** Same-origin URL the renderer can download or play. */
  outputUrl: string;
  skippedEncode: boolean;
  encodeTimeMs: number;
  totalTimeMs: number;
  clipCount?: number;
  trimSegmentCount?: number;
}

export type ShareTarget = 'drive' | 'mail' | 'slack' | 'more';

/** 'opened': the target app or folder took the file. 'revealed': the file is shown in Finder to drag in. */
export type ShareResult = 'opened' | 'revealed';

export interface DesktopApi {
  pathForFile(file: File): string;
  probe(path: string): Promise<VideoProbeMetadata>;
  runJob(jobId: string, job: NativeJob): Promise<NativeJobResult>;
  cancelJob(): Promise<void>;
  onJobProgress(callback: (progress: NativeJobProgress) => void): () => void;
  onOutputSaved(callback: (path: string) => void): () => void;
  revealOutput(path: string): Promise<void>;
  shareOutput(outputUrl: string, target: ShareTarget): Promise<ShareResult>;
  onFullScreenChange(callback: (fullScreen: boolean) => void): () => void;
  setTheme(theme: 'light' | 'dark'): Promise<void>;
}

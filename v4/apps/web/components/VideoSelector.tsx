/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

'use client';

import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  formatTimestamp,
  parseDeleteRangeText,
  validateDeleteSegments,
  type TrimSegment,
} from '@/lib/squish-core';
import { probeVideoFile } from '@/lib/compress-wasm';
import AnimatedSection from './AnimatedSection';
import { useFlipList } from '@/hooks/useFlipList';
import CompressOIcon from './CompressOIcon';
import MaterialIcon from './MaterialIcon';
import PanelMascot from './mascot/PanelMascot';
import SquikHero from './SquikHero';

const VIDEO_ACCEPT = 'video/mp4,video/quicktime,video/webm,video/x-matroska,.mp4,.mov,.webm,.mkv';
const VIDEO_EXT = /\.(mp4|mov|mkv|webm|avi|m4v)$/i;

export type SelectorMode = 'compress' | 'merge' | 'trim';

export interface ClipEntry {
  id: string;
  file: File;
}

interface VideoSelectorProps {
  onVideoSelected: (file: File) => void;
  onMergeAndCompress: (files: File[]) => void;
  onTrimAndCompress: (file: File, deleteSegments: TrimSegment[]) => void;
  disabled?: boolean;
}

function isVideoFile(file: File): boolean {
  return file.type.startsWith('video/') || VIDEO_EXT.test(file.name);
}

function clipKey(file: File): string {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

export default function VideoSelector({
  onVideoSelected,
  onMergeAndCompress,
  onTrimAndCompress,
  disabled = false,
}: VideoSelectorProps) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<SelectorMode>('compress');
  const [isDragActive, setIsDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clips, setClips] = useState<ClipEntry[]>([]);
  const [trimVideo, setTrimVideo] = useState<File | null>(null);
  const [trimDurationSec, setTrimDurationSec] = useState<number | null>(null);
  const [rangeText, setRangeText] = useState('');
  const [trimProbing, setTrimProbing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const clipListRef = useRef<HTMLUListElement>(null);
  const ignoreClickRef = useRef(false);
  const clipLayoutKey = clips.map((clip) => clip.id).join('|');
  const { captureBeforeUpdate: captureClipLayout } = useFlipList(clipListRef, clipLayoutKey);

  const clearTrimState = () => {
    setTrimVideo(null);
    setTrimDurationSec(null);
    setRangeText('');
    setTrimProbing(false);
  };

  const selectTrimVideo = async (file: File) => {
    setTrimProbing(true);
    setError(null);
    setTrimVideo(file);
    setTrimDurationSec(null);

    try {
      const metadata = await probeVideoFile(file);
      setTrimDurationSec(metadata.duration);
    } catch {
      setError(t('errors.trimProbeFailed'));
      setTrimVideo(null);
    } finally {
      setTrimProbing(false);
    }
  };

  const addClips = (files: File[]) => {
    if (files.length === 0) return;
    captureClipLayout();
    setClips((prev) => {
      const seen = new Set(prev.map((c) => c.id));
      const next = [...prev];
      for (const file of files) {
        if (!isVideoFile(file)) continue;
        const id = clipKey(file);
        if (!seen.has(id)) {
          seen.add(id);
          next.push({ id, file });
        }
      }
      return next;
    });
  };

  const pickFile = (file: File | undefined) => {
    if (!file || disabled) return;
    if (!isVideoFile(file)) {
      setError(t('errors.invalidFile'));
      return;
    }
    setError(null);
    if (mode === 'trim') {
      void selectTrimVideo(file);
      return;
    }
    onVideoSelected(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setIsDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    if (disabled) return;

    ignoreClickRef.current = true;
    window.setTimeout(() => {
      ignoreClickRef.current = false;
    }, 400);

    const files = Array.from(e.dataTransfer.files ?? []);
    if (files.length === 0) return;

    if (mode === 'compress') {
      pickFile(files[0]);
      return;
    }

    if (mode === 'trim') {
      pickFile(files[0]);
      return;
    }

    const valid = files.filter(isVideoFile);
    if (valid.length === 0) {
      setError(t('errors.invalidFiles'));
      return;
    }
    setError(null);
    addClips(valid);
  };

  const handleZoneClick = () => {
    if (disabled || ignoreClickRef.current) return;
    fileInputRef.current?.click();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';

    if (mode === 'compress') {
      pickFile(files[0]);
      return;
    }

    if (mode === 'trim') {
      pickFile(files[0]);
      return;
    }

    if (files.length === 0) return;
    const valid = files.filter(isVideoFile);
    if (valid.length === 0) {
      setError(t('errors.invalidFiles'));
      return;
    }
    setError(null);
    addClips(valid);
  };

  const moveClip = (index: number, direction: -1 | 1) => {
    captureClipLayout();
    setClips((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const removeClip = (index: number) => {
    captureClipLayout();
    setClips((prev) => prev.filter((_, i) => i !== index));
  };

  const handleTrim = () => {
    if (!trimVideo) {
      setError(t('trim.pickVideoFirst'));
      return;
    }
    if (trimDurationSec == null) {
      setError(t('errors.trimProbeFailed'));
      return;
    }

    if (!rangeText.trim()) {
      setError(t('errors.trimRangeEmpty'));
      return;
    }

    const deleteSegments = parseDeleteRangeText(rangeText);
    if (deleteSegments.length === 0) {
      setError(t('errors.trimRangeInvalid'));
      return;
    }

    const validation = validateDeleteSegments(deleteSegments, trimDurationSec);
    if (validation === 'outOfBounds') {
      setError(
        t('errors.trimRangeOutOfBounds', {
          duration: formatTimestamp(trimDurationSec),
        }),
      );
      return;
    }
    if (validation === 'nothingLeft') {
      setError(t('errors.trimRangeNothingLeft'));
      return;
    }
    if (validation) {
      setError(t('errors.trimRangeInvalid'));
      return;
    }

    setError(null);
    onTrimAndCompress(trimVideo, deleteSegments);
  };

  const handleMerge = () => {
    if (clips.length < 2) {
      setError(t('errors.needTwoVideos'));
      return;
    }
    setError(null);
    onMergeAndCompress(clips.map((c) => c.file));
  };

  const switchMode = (nextMode: SelectorMode) => {
    if (clips.length > 0) captureClipLayout();
    setMode(nextMode);
    setError(null);
    setClips([]);
    clearTrimState();
  };

  let parsedRangeCount = 0;
  if (mode === 'trim' && rangeText.trim() && trimDurationSec != null) {
    try {
      const segments = parseDeleteRangeText(rangeText);
      if (validateDeleteSegments(segments, trimDurationSec) === null) {
        parsedRangeCount = segments.length;
      }
    } catch {
      parsedRangeCount = 0;
    }
  }

  return (
    <section className="tool-layout">
      <input
        ref={fileInputRef}
        type="file"
        accept={VIDEO_ACCEPT}
        multiple={mode === 'merge'}
        className="hidden"
        onChange={handleInputChange}
      />

      {isDragActive && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-canvas/90 pointer-events-none">
          <div className="drop-overlay">
            <CompressOIcon name="addMedia" size={52} />
            <p>{t('landing.dropAnywhere')}</p>
          </div>
        </div>
      )}

      <SquikHero />

      <div className="tool-ui" data-ui="video-compressor">
        <div className="tool-ui-body">
          <div className="tool-tabs" data-ui="mode-controls" role="group" aria-label={t('landing.tools')}>
            {(['compress', 'merge', 'trim'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                aria-pressed={mode === tab}
                disabled={disabled}
                onClick={() => switchMode(tab)}
                className="tool-tab"
              >
                {t(`common.${tab}`)}
              </button>
            ))}
          </div>

          {mode === 'trim' && trimVideo ? (
            <div className="selected-video">
              <MaterialIcon name="movie" size={20} className="text-accent shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="selected-video-name">{trimVideo.name}</p>
                {trimProbing ? (
                  <p className="selected-video-meta">{t('phase.preparing')}</p>
                ) : trimDurationSec != null ? (
                  <p className="selected-video-meta">
                    {t('trim.duration', { duration: formatTimestamp(trimDurationSec) })}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                disabled={disabled || trimProbing}
                onClick={() => fileInputRef.current?.click()}
                className="text-action"
              >
                {t('landing.browseSingle')}
              </button>
            </div>
          ) : (
            <div className="drop-zone-wrap">
              <button
                type="button"
                disabled={disabled}
                data-ui="video-drop-zone"
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={handleZoneClick}
                className={`drop-zone ${isDragActive ? 'is-dragging' : ''} ${
                  mode === 'trim' ? 'drop-zone-compact' : ''
                }`}
              >
                <CompressOIcon name="addMedia" size={mode === 'trim' ? 42 : 52} className="text-accent" />
                <span className="drop-zone-title">
                  {t('landing.dragDrop')}
                </span>
                <span className="drop-zone-browse">
                  {mode === 'merge' ? t('landing.browseMultiple') : t('landing.browseSingle')}
                </span>
                <span className="drop-zone-formats">{t('landing.formats')}</span>
              </button>
            </div>
          )}

          {mode === 'trim' ? (
            <div className="trim-controls">
              <div className="app-panel-body-scroll space-y-3 text-left pr-0.5">
                <div>
                  <label htmlFor="trim-ranges" className="trim-label">
                    {t('trim.rangesLabel')}
                  </label>
                  <p className="trim-hint">{t('trim.rangesHint')}</p>
                  <textarea
                    id="trim-ranges"
                    rows={3}
                    value={rangeText}
                    disabled={disabled || !trimVideo || trimProbing}
                    onChange={(e) => {
                      setRangeText(e.target.value);
                      setError(null);
                    }}
                    placeholder={t('trim.rangesPlaceholder')}
                    className="trim-input"
                  />
                  {parsedRangeCount > 0 && (
                    <p className="trim-parsed">
                      {t('trim.parsedRanges', { count: parsedRangeCount })}
                    </p>
                  )}
                </div>

                {error && (
                  <div className="inline-error">
                    <PanelMascot variant="error" size="sm" className="shrink-0" />
                    <span className="text-left">{error}</span>
                  </div>
                )}
              </div>

              <div className="tool-action-row">
                <div className="flex justify-center">
                  <button
                    type="button"
                    disabled={disabled || !trimVideo || trimProbing || trimDurationSec == null}
                    onClick={handleTrim}
                    className="pixel-btn"
                  >
                    {t('common.trimAndCompress')}
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          <AnimatedSection show={mode === 'merge' && clips.length > 0} className="merge-clips">
            <ul
              ref={clipListRef}
              className="scrollbar-hidden max-h-[min(12rem,28vh)] space-y-2 overflow-y-auto overscroll-contain"
            >
              {clips.map((clip, index) => (
                <li
                  key={clip.id}
                  data-flip-id={clip.id}
                  className="merge-clip"
                >
                  <MaterialIcon name="movie" size={18} className="text-accent shrink-0" />
                  <span className="flex-1 truncate text-ink">{clip.file.name}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      aria-label={t('a11y.moveUp')}
                      disabled={index === 0}
                      onClick={() => moveClip(index, -1)}
                      className="clip-control"
                    >
                      <MaterialIcon name="arrow_upward" size={18} />
                    </button>
                    <button
                      type="button"
                      aria-label={t('a11y.moveDown')}
                      disabled={index === clips.length - 1}
                      onClick={() => moveClip(index, 1)}
                      className="clip-control"
                    >
                      <MaterialIcon name="arrow_downward" size={18} />
                    </button>
                    <button
                      type="button"
                      aria-label={t('a11y.remove')}
                      onClick={() => removeClip(index)}
                      className="clip-control"
                    >
                      <MaterialIcon name="close" size={18} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            <div className="flex justify-center pt-1">
              <button
                type="button"
                disabled={disabled || clips.length < 2}
                onClick={handleMerge}
                className="pixel-btn"
              >
                {t('common.merge')}
              </button>
            </div>
          </AnimatedSection>

          {error && mode !== 'trim' && (
            <div className="inline-error">
              <PanelMascot variant="error" size="sm" className="shrink-0" />
              <span className="text-left">{error}</span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

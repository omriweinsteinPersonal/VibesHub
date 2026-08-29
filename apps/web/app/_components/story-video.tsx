'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Play, X } from 'lucide-react';

import { trackClientAnalytics } from '../../lib/analytics';

interface StoryVideoProps {
  creatorId: string | undefined;
  posterUrl: string;
  productId: string;
  productName: string;
  recommendationId: string;
  videoUrl?: string;
  videoUrls?: string[];
}

export function StoryVideo({
  creatorId,
  posterUrl,
  productId,
  productName,
  recommendationId,
  videoUrl,
  videoUrls,
}: StoryVideoProps) {
  const clips = videoUrls?.length ? videoUrls : videoUrl ? [videoUrl] : [];
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [playbackError, setPlaybackError] = useState(false);
  const [progress, setProgress] = useState(0);
  const closeButton = useRef<HTMLButtonElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const viewer = useRef<HTMLDivElement>(null);
  const completionSent = useRef(false);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const triggerNode = trigger.current;
    document.body.style.overflow = 'hidden';
    closeButton.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = Array.from(
        viewer.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], video[controls]',
        ) ?? [],
      );
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      triggerNode?.focus();
    };
  }, [open]);

  function showStory() {
    completionSent.current = false;
    setPlaybackError(false);
    setProgress(0);
    setActiveIndex(0);
    setOpen(true);
    if (creatorId) {
      trackClientAnalytics({
        creatorId,
        name: 'story.opened',
        productId,
        recommendationId,
      });
    }
  }

  function recordCompletion(video: HTMLVideoElement) {
    if (!Number.isFinite(video.duration) || video.duration <= 0) return;
    setProgress(Math.min(100, (video.currentTime / video.duration) * 100));
    if (!creatorId || completionSent.current || video.duration > 15 * 60) return;
    const durationMs = Math.max(1, Math.round(video.duration * 1_000));
    const watchedMs = Math.min(
      durationMs,
      Math.max(0, Math.round(video.currentTime * 1_000)),
    );
    if (watchedMs < durationMs * 0.9) return;
    completionSent.current = true;
    trackClientAnalytics({
      creatorId,
      durationMs,
      name: 'story.completed',
      productId,
      recommendationId,
      watchedMs,
    });
  }

  function finishClip(video: HTMLVideoElement) {
    recordCompletion(video);
    if (activeIndex < clips.length - 1) {
      completionSent.current = false;
      setPlaybackError(false);
      setProgress(0);
      setActiveIndex((current) => current + 1);
    }
  }

  if (!clips.length) return null;
  const activeUrl = clips[activeIndex]!;

  return (
    <>
      <button
        aria-haspopup="dialog"
        aria-label={`Watch video preview for ${productName}`}
        className="storyPreview storyPreviewCircle"
        onClick={showStory}
        ref={trigger}
        type="button"
      >
        <span
          className="storyPreviewThumb"
          style={{ backgroundImage: `url(${posterUrl})` }}
          aria-hidden="true"
        >
          <b>
            <Play aria-hidden="true" size={14} />
          </b>
        </span>
      </button>
      {open
        ? createPortal(
            <div
              aria-label={`${productName} video preview`}
              aria-modal="true"
              className="storyViewerBackdrop"
              onMouseDown={(event) => {
                if (event.currentTarget === event.target) setOpen(false);
              }}
              role="dialog"
            >
              <div className="storyViewer" ref={viewer}>
                <div
                  className="storyViewerProgress storyViewerSegments"
                  aria-hidden="true"
                >
                  {clips.map((_, index) => (
                    <i key={index}>
                      <span
                        style={{
                          width: `${index < activeIndex ? 100 : index === activeIndex ? progress : 0}%`,
                        }}
                      />
                    </i>
                  ))}
                </div>
                <div className="storyViewerHeader">
                  <div>
                    <p>Creator story</p>
                    <strong>{productName}</strong>
                  </div>
                  <button
                    aria-label="Close video preview"
                    className="storyViewerClose"
                    onClick={() => setOpen(false)}
                    ref={closeButton}
                    type="button"
                  >
                    <X aria-hidden="true" size={16} />
                  </button>
                </div>
                {playbackError ? (
                  <div className="storyViewerError" role="alert">
                    <p>This video preview could not be played.</p>
                    <a href={activeUrl} rel="noopener noreferrer" target="_blank">
                      Open the original video
                    </a>
                  </div>
                ) : (
                  <video
                    autoPlay
                    controls
                    key={activeUrl}
                    onEnded={(event) => finishClip(event.currentTarget)}
                    onError={() => setPlaybackError(true)}
                    onTimeUpdate={(event) => recordCompletion(event.currentTarget)}
                    playsInline
                    poster={posterUrl}
                    preload="metadata"
                    src={activeUrl}
                  />
                )}
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

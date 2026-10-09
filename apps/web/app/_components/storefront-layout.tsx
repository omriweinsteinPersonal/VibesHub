'use client';

import {
  Children,
  Fragment,
  isValidElement,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type PointerEvent,
} from 'react';
import { AlignJustify } from 'lucide-react';
import type { StorefrontTheme, StorefrontThemeConfiguration } from '@vibeshub/contracts';
import {
  moveKey,
  orderedKeys,
  persistStorefrontLayout,
} from '../../lib/storefront-layout';
import styles from './storefront-layout.module.css';

type Slot = {
  id: string;
  label: string;
  children: ReactNode;
  kind?: 'profile' | 'social' | 'content';
};
export function StorefrontSlot({ children }: Slot) {
  return <>{children}</>;
}
export function StorefrontRegion({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

function slotsIn(children: ReactNode): Slot[] {
  return Children.toArray(children).flatMap((child) => {
    if (!isValidElement<{ children?: ReactNode }>(child)) return [];
    if (child.type === StorefrontSlot) return [child.props as Slot];
    if (child.type === Fragment || child.type === StorefrontRegion)
      return slotsIn(child.props.children);
    return [];
  });
}

/** Pointer capture + touch-action:none on handles avoids iOS cancelling a drag to scroll.
 * The rest of each block remains scrollable and tappable for editing. */
function Sortable({
  id,
  label,
  children,
  group,
  disabled,
  onMove,
  compact = false,
}: {
  id: string;
  label: string;
  children: ReactNode;
  group: string;
  disabled: boolean;
  onMove: (source: string, target: string) => void;
  compact?: boolean;
}) {
  const [target, setTarget] = useState<string | null>(null);
  const [moving, setMoving] = useState(false);
  const cleanup = useRef<(() => void) | null>(null);
  useEffect(() => () => cleanup.current?.(), []);
  function start(event: PointerEvent<HTMLButtonElement>) {
    if (disabled || event.button !== 0) return;
    event.stopPropagation();
    const handle = event.currentTarget;
    handle.setPointerCapture(event.pointerId);
    const root = handle.closest<HTMLElement>('[data-sort-region]');
    if (!root) return;
    const candidates = () =>
      Array.from(root.querySelectorAll<HTMLElement>('[data-sort-key]')).filter(
        (node) => node.dataset.sortGroup === group,
      );
    let destination: string | null = null;
    let lastY = event.clientY;
    let lastX = event.clientX;
    let frame = 0;
    let moved = false;
    const markTarget = (value: string | null) => {
      candidates().forEach((node) => {
        node.dataset.dropTarget = String(node.dataset.sortKey === value);
      });
      destination = value;
      setTarget(value);
    };
    const locate = () => {
      let hit = document
        .elementFromPoint(lastX, lastY)
        ?.closest<HTMLElement>('[data-sort-key]');
      // A page block can contain a second sortable region (the label rail).
      while (hit && hit.dataset.sortGroup !== group)
        hit = hit.parentElement?.closest<HTMLElement>('[data-sort-key]');
      if (hit?.dataset.sortGroup === group && hit.dataset.sortKey !== id)
        markTarget(hit.dataset.sortKey ?? null);
      else markTarget(null);
    };
    const scroll = () => {
      if (moved) {
        const delta = lastY < 80 ? -12 : lastY > window.innerHeight - 90 ? 12 : 0;
        if (delta) {
          window.scrollBy(0, delta);
          locate();
        }
        // Horizontal filter rails must also be reorderable when the target is offscreen.
        if (compact) {
          const bounds = root.getBoundingClientRect();
          root.scrollLeft +=
            lastX < bounds.left + 32 ? -8 : lastX > bounds.right - 32 ? 8 : 0;
          locate();
        }
      }
      frame = requestAnimationFrame(scroll);
    };
    const move = (pointer: globalThis.PointerEvent) => {
      if (pointer.pointerId !== event.pointerId) return;
      lastY = pointer.clientY;
      lastX = pointer.clientX;
      if (Math.hypot(lastX - event.clientX, lastY - event.clientY) < 5 && !moved) return;
      moved = true;
      setMoving(true);
      locate();
    };
    const finish = (pointer: globalThis.PointerEvent) => {
      if (pointer.pointerId !== event.pointerId) return;
      const next = destination;
      stop();
      if (pointer.type === 'pointerup' && moved && next) onMove(id, next);
    };
    const stop = () => {
      cancelAnimationFrame(frame);
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', finish);
      handle.removeEventListener('pointercancel', finish);
      if (handle.hasPointerCapture(event.pointerId))
        handle.releasePointerCapture(event.pointerId);
      markTarget(null);
      setMoving(false);
      cleanup.current = null;
    };
    cleanup.current = stop;
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', finish);
    handle.addEventListener('pointercancel', finish);
    frame = requestAnimationFrame(scroll);
  }
  return (
    <div
      className={`${styles.sortable} ${compact ? styles.compact : ''}`}
      data-sort-key={id}
      data-sort-group={group}
      data-moving={moving}
    >
      <button
        type="button"
        className={styles.handle}
        aria-label={`Move ${label}`}
        aria-describedby="storefront-move-help"
        disabled={disabled}
        onPointerDown={start}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          const offset = ['ArrowUp', 'ArrowLeft'].includes(event.key)
            ? -1
            : ['ArrowDown', 'ArrowRight'].includes(event.key)
              ? 1
              : 0;
          if (!offset || disabled) return;
          event.preventDefault();
          const root = event.currentTarget.closest('[data-sort-region]');
          const keys = Array.from(
            root?.querySelectorAll<HTMLElement>('[data-sort-key]') ?? [],
          )
            .filter((node) => node.dataset.sortGroup === group)
            .map((node) => node.dataset.sortKey!);
          const next = keys[keys.indexOf(id) + offset];
          if (next) onMove(id, next);
        }}
      >
        <AlignJustify size={16} aria-hidden="true" />
        <span className={styles.handleLabel}>Move</span>
      </button>
      {children}
      {moving ? (
        <span className={styles.dragHint}>
          {target ? 'Release to place here' : `Moving ${label}`}
        </span>
      ) : null}
    </div>
  );
}

export function StorefrontLayout({
  children,
  compactPreview = false,
  theme,
  editable,
  creatorId,
  onTheme,
  persistLayout = persistStorefrontLayout,
}: {
  children: ReactNode;
  compactPreview?: boolean;
  theme: StorefrontTheme;
  editable: boolean;
  creatorId: string;
  onTheme: (theme: StorefrontTheme) => void;
  persistLayout?: (
    layout: NonNullable<StorefrontTheme['layout']>,
  ) => Promise<StorefrontThemeConfiguration>;
}) {
  const slots = slotsIn(children);
  const [pending, setPending] = useState<StorefrontTheme['layout'] | null>(null);
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const layout = pending ?? theme.layout;
  const visibleSlots = slots.filter(
    ({ id }) => !(layout?.hiddenBlocks ?? []).includes(id),
  );
  // Profile, bio, and social connectors are one fixed identity area. They
  // must stay together above the reorderable storefront content, even when a
  // previous layout saved one of their ids in the old blocks order.
  const fixedSlots = visibleSlots.filter(
    ({ id, kind }) => id === 'bio' || kind === 'profile' || kind === 'social',
  );
  const movableSlots = visibleSlots.filter(
    ({ id, kind }) => id !== 'bio' && kind !== 'profile' && kind !== 'social',
  );
  const keys = orderedKeys(
    movableSlots.map(({ id }) => id),
    layout?.blocks,
  );
  async function saveLayout(next: NonNullable<StorefrontTheme['layout']>) {
    if (busy.current) return;
    busy.current = true;
    setPending(next);
    setSaving(true);
    setError('');
    setMessage('Saving layout…');
    try {
      // Read the current version so edits in the color/content panel aren't overwritten.
      const saved = await persistLayout(next);
      onTheme({ ...theme, layout: saved.theme.layout });
      if (window.parent !== window)
        window.parent.postMessage(
          { type: 'swavii:layout-saved', creatorId, configuration: saved },
          window.location.origin,
        );
      setMessage('Position saved.');
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Could not save this position. Try again.',
      );
      setMessage('');
    } finally {
      setPending(null);
      setSaving(false);
      busy.current = false;
    }
  }
  useEffect(() => {
    if (!editable || window.parent === window) return;
    const receive = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== window.parent)
        return;
      const data = event.data as {
        blockId?: string;
        creatorId?: string;
        hidden?: boolean;
        type?: string;
      };
      if (
        data.type !== 'swavii:toggle-layout-block' ||
        data.creatorId !== creatorId ||
        !data.blockId
      )
        return;
      const hiddenBlocks = new Set(layout?.hiddenBlocks ?? []);
      if (data.hidden) hiddenBlocks.add(data.blockId);
      else hiddenBlocks.delete(data.blockId);
      void saveLayout({
        blocks: keys,
        labels: layout?.labels ?? [],
        hiddenBlocks: Array.from(hiddenBlocks),
      });
    };
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, [creatorId, editable, keys, layout, saveLayout]);
  const ordered = [
    ...fixedSlots,
    ...keys.map((id) => movableSlots.find((slot) => slot.id === id)!),
  ];
  const firstContentId = movableSlots[0]?.id;
  // Adjacent platform links form one natural icon row, wherever they are placed.
  const groups: Slot[][] = [];
  ordered.forEach((slot) => {
    const previous = groups[groups.length - 1];
    if (slot.kind === 'social' && previous?.[0]?.kind === 'social') previous.push(slot);
    else groups.push([slot]);
  });
  const render = (slot: Slot) =>
    editable && slot.kind !== 'profile' && slot.kind !== 'social' ? (
      <Sortable
        key={slot.id}
        id={slot.id}
        label={slot.label}
        group="page"
        disabled={saving}
        onMove={(source, target) =>
          void saveLayout({
            blocks: moveKey(keys, source, target),
            labels: layout?.labels ?? [],
            hiddenBlocks: layout?.hiddenBlocks,
          })
        }
      >
        {slot.children}
      </Sortable>
    ) : (
      <Fragment key={slot.id}>{slot.children}</Fragment>
    );
  return (
    <div
      className={styles.layout}
      data-compact-preview={compactPreview}
      data-sort-region="page"
      data-layout-editable={editable}
    >
      {editable ? (
        <div className={styles.instructions}>
          <p id="storefront-move-help">
            Move sections below your profile and social links. Tap content to edit.
          </p>
          <span className="srOnly">
            Use arrow keys on a focused handle to change position.
          </span>
          <span role="status">{message}</span>
          {error ? (
            <p role="alert" className="formError">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
      {groups.map((group) => (
        <div
          key={group[0]!.id}
          className={
            group[0]!.kind === 'social'
              ? styles.socials
              : group[0]!.kind === 'profile'
                ? `${styles.profile}${
                    group[0]!.id === 'profile'
                      ? ` ${styles.hero} referenceStorefrontHero`
                      : ''
                  }`
                : `referenceStorefrontProducts ${styles.content}${
                    group[0]!.id === firstContentId ? ` ${styles.firstContent}` : ''
                  }`
          }
        >
          {group.map((slot) =>
            slot.id === 'labels' ? (
              <Fragment key={slot.id}>
                {editable ? (
                  <Sortable
                    id={slot.id}
                    label={slot.label}
                    group="page"
                    disabled={saving}
                    onMove={(source, target) =>
                      void saveLayout({
                        blocks: moveKey(keys, source, target),
                        labels: layout?.labels ?? [],
                        hiddenBlocks: layout?.hiddenBlocks,
                      })
                    }
                  >
                    <LabelRail
                      order={layout?.labels}
                      editable
                      disabled={saving}
                      onMove={(labels) =>
                        void saveLayout({
                          blocks: keys,
                          labels,
                          hiddenBlocks: layout?.hiddenBlocks,
                        })
                      }
                    >
                      {slot.children}
                    </LabelRail>
                  </Sortable>
                ) : (
                  <LabelRail
                    order={layout?.labels}
                    editable={false}
                    disabled={false}
                    onMove={() => undefined}
                  >
                    {slot.children}
                  </LabelRail>
                )}
              </Fragment>
            ) : (
              render(slot)
            ),
          )}
        </div>
      ))}
    </div>
  );
}

function LabelRail({
  children,
  order,
  editable,
  disabled,
  onMove,
}: {
  children: ReactNode;
  order?: string[] | undefined;
  editable: boolean;
  disabled: boolean;
  onMove: (keys: string[]) => void;
}) {
  const nav = Children.toArray(children).find((child) => isValidElement(child));
  if (!isValidElement<{ children: ReactNode }>(nav)) return children;
  const buttons = Children.toArray(nav.props.children).filter(
    isValidElement<{ 'data-label-id'?: string; children: ReactNode }>,
  );
  const labels = buttons.filter((button) => button.props['data-label-id']);
  const keys = orderedKeys(
    labels.map((button) => button.props['data-label-id']!),
    order,
  );
  return (
    <nav
      aria-label="Store filters"
      className={`referenceStorefrontLabels ${styles.labels}`}
      data-sort-region="labels"
    >
      {buttons.filter((button) => !button.props['data-label-id'])}
      {keys.map((id) => {
        const button = labels.find((item) => item.props['data-label-id'] === id)!;
        return editable ? (
          <Sortable
            compact
            key={id}
            id={id}
            label={
              typeof button.props.children === 'string' ? button.props.children : 'Label'
            }
            group="labels"
            disabled={disabled}
            onMove={(source, target) => onMove(moveKey(keys, source, target))}
          >
            {button}
          </Sortable>
        ) : (
          <Fragment key={id}>{button}</Fragment>
        );
      })}
    </nav>
  );
}

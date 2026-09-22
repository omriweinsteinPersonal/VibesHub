'use client';

import {
  defaultStorefrontTheme,
  type StorefrontTheme,
  type StorefrontThemeConfiguration,
} from '@vibeshub/contracts';
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';

import { apiRequest } from '../../lib/api';
import { contrastRatio } from '../../lib/storefront-theme';

type ThemeKey = keyof StorefrontTheme;
type ThemeSection = 'profile' | 'recommendations' | 'product' | 'discount' | 'collection';
const desktopQuery = '(min-width: 901px) and (pointer: fine)';
const groups: Array<{
  id: ThemeSection;
  title: string;
  fields: Array<{ key: ThemeKey; label: string }>;
}> = [
  {
    id: 'profile',
    title: 'Profile',
    fields: [{ key: 'profileBackground', label: 'Background' }],
  },
  {
    id: 'recommendations',
    title: 'Recommendations',
    fields: [
      { key: 'recommendationsBackground', label: 'Page background' },
      { key: 'textColor', label: 'Text' },
      { key: 'accentColor', label: 'Buttons and accents' },
    ],
  },
  {
    id: 'product',
    title: 'Product cards',
    fields: [{ key: 'productBackground', label: 'Card background' }],
  },
  {
    id: 'discount',
    title: 'Brand discounts',
    fields: [{ key: 'discountBackground', label: 'Card background' }],
  },
  {
    id: 'collection',
    title: 'Collections',
    fields: [{ key: 'collectionBackground', label: 'Frame background' }],
  },
];
const palettes: Array<{ name: string; theme: StorefrontTheme }> = [
  { name: 'Editorial', theme: defaultStorefrontTheme },
  {
    name: 'Sand',
    theme: {
      profileBackground: '#eee4d6',
      recommendationsBackground: '#faf7f2',
      productBackground: '#ffffff',
      discountBackground: '#f1e8dc',
      collectionBackground: '#f5eee5',
      accentColor: '#8b6248',
      textColor: '#302820',
    },
  },
  {
    name: 'Slate',
    theme: {
      profileBackground: '#dde4e7',
      recommendationsBackground: '#f5f7f7',
      productBackground: '#ffffff',
      discountBackground: '#e8edee',
      collectionBackground: '#edf1f2',
      accentColor: '#3e6570',
      textColor: '#26343a',
    },
  },
];

function subscribe(callback: () => void) {
  const query = window.matchMedia(desktopQuery);
  query.addEventListener('change', callback);
  return () => query.removeEventListener('change', callback);
}
function desktopSnapshot() {
  return (
    window.matchMedia(desktopQuery).matches &&
    !new URLSearchParams(window.location.search).has('mobilePreview')
  );
}

export function StorefrontPhonePreview({
  children,
  creatorId,
  editable = false,
  previewUrl,
  theme,
  title,
}: {
  children: ReactNode;
  creatorId: string;
  editable?: boolean;
  previewUrl: string;
  theme: StorefrontTheme;
  title: string;
}) {
  const showPhone = useSyncExternalStore(subscribe, desktopSnapshot, () => false);
  const [canEdit, setCanEdit] = useState(editable);
  const frame = useRef<HTMLIFrameElement>(null);
  const [configuration, setConfiguration] = useState<StorefrontThemeConfiguration | null>(
    null,
  );
  const [draft, setDraft] = useState<StorefrontTheme>(theme);
  const [selected, setSelected] = useState<ThemeSection>('profile');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (editable || !showPhone) return;
    let active = true;
    apiRequest<{ creator: { id: string } | null }>('/me')
      .then(({ creator }) => {
        if (active && creator?.id === creatorId) setCanEdit(true);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [creatorId, editable, showPhone]);

  useEffect(() => {
    if (!canEdit || !showPhone) return;
    let active = true;
    apiRequest<StorefrontThemeConfiguration>('/creator/studio/storefront-theme')
      .then((value) => {
        if (!active) return;
        setConfiguration(value);
        setDraft(value.theme);
      })
      .catch((cause: unknown) => {
        if (active)
          setError(
            cause instanceof Error
              ? cause.message
              : 'Could not load the storefront design.',
          );
      });
    return () => {
      active = false;
    };
  }, [canEdit, showPhone]);

  useEffect(() => {
    if (!showPhone) return;
    frame.current?.contentWindow?.postMessage(
      { type: 'swave:theme-preview', creatorId, theme: draft },
      window.location.origin,
    );
  }, [creatorId, draft, showPhone]);

  useEffect(() => {
    if (!canEdit || !showPhone) return;
    const receive = (event: MessageEvent) => {
      if (
        event.origin !== window.location.origin ||
        event.source !== frame.current?.contentWindow
      )
        return;
      const data = event.data as {
        creatorId?: string;
        section?: ThemeSection;
        type?: string;
      };
      if (
        data.type === 'swave:theme-select' &&
        data.creatorId === creatorId &&
        groups.some(({ id }) => id === data.section)
      ) {
        setSelected(data.section as ThemeSection);
      }
    };
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, [canEdit, creatorId, showPhone]);

  if (!showPhone) return <>{children}</>;
  const changed = JSON.stringify(draft) !== JSON.stringify(configuration?.theme ?? theme);
  async function save() {
    if (!configuration || !changed || saving) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const value = await apiRequest<StorefrontThemeConfiguration>(
        '/creator/studio/storefront-theme',
        {
          method: 'PUT',
          headers: { 'if-match': `"${configuration.version}"` },
          body: JSON.stringify(draft),
        },
      );
      setConfiguration(value);
      setDraft(value.theme);
      setNotice('Design saved to your storefront.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save the design.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={`storefrontDesignWorkspace${canEdit ? ' hasEditor' : ''}`}>
      {canEdit ? (
        <aside aria-label="Storefront design" className="storefrontDesignPanel">
          <div className="storefrontDesignPanelHeading">
            <p className="eyebrow">YOUR STOREFRONT</p>
            <h2>Design your page</h2>
            <p>
              Choose a palette, then refine each part. Changes appear in the phone before
              you save.
            </p>
          </div>
          <div className="storefrontPaletteList" role="group" aria-label="Color palettes">
            {palettes.map(({ name, theme: palette }) => (
              <button
                aria-pressed={JSON.stringify(draft) === JSON.stringify(palette)}
                key={name}
                onClick={() => {
                  setDraft(palette);
                  setNotice('');
                }}
                type="button"
              >
                <span aria-hidden="true" className="storefrontPaletteSwatches">
                  <i style={{ background: palette.profileBackground }} />
                  <i style={{ background: palette.recommendationsBackground }} />
                  <i style={{ background: palette.accentColor }} />
                </span>
                {name}
              </button>
            ))}
          </div>
          <div className="storefrontDesignFields">
            {groups.map((group) => (
              <section
                className={selected === group.id ? 'isSelected' : ''}
                key={group.id}
              >
                <button
                  aria-expanded={selected === group.id}
                  onClick={() => setSelected(group.id)}
                  type="button"
                >
                  {group.title}
                  <span aria-hidden="true">{selected === group.id ? '−' : '+'}</span>
                </button>
                {selected === group.id ? (
                  <div className="storefrontColorFields">
                    {group.fields.map(({ key, label }) => (
                      <label key={key}>
                        <span>{label}</span>
                        <span className="storefrontColorControl">
                          <input
                            aria-label={`${group.title}: ${label}`}
                            onChange={(event) => {
                              setDraft((current) => ({
                                ...current,
                                [key]: event.target.value,
                              }));
                              setNotice('');
                            }}
                            type="color"
                            value={draft[key]}
                          />
                          <output>{draft[key].toUpperCase()}</output>
                        </span>
                      </label>
                    ))}
                  </div>
                ) : null}
              </section>
            ))}
          </div>
          {[
            draft.profileBackground,
            draft.recommendationsBackground,
            draft.productBackground,
            draft.discountBackground,
            draft.collectionBackground,
          ].some((color) => contrastRatio(draft.textColor, color) < 4.5) ? (
            <p className="storefrontContrastNotice">
              Some text and background colors need more contrast to stay readable.
            </p>
          ) : null}
          {error ? (
            <p className="formError" role="alert">
              {error}
            </p>
          ) : null}
          {notice ? (
            <p className="storefrontDesignNotice" role="status">
              {notice}
            </p>
          ) : null}
          <div className="storefrontDesignActions">
            <button
              disabled={!changed || saving}
              onClick={() => {
                setDraft(configuration?.theme ?? theme);
                setNotice('');
              }}
              type="button"
            >
              Undo changes
            </button>
            <button
              disabled={saving}
              onClick={() => {
                setDraft(defaultStorefrontTheme);
                setNotice('');
              }}
              type="button"
            >
              Reset colors
            </button>
            <button
              className="button primary"
              disabled={!configuration || !changed || saving}
              onClick={() => void save()}
              type="button"
            >
              {saving ? 'Saving…' : 'Save design'}
            </button>
          </div>
        </aside>
      ) : null}
      <div className="storefrontPhoneStage">
        <div className="storefrontPhoneDevice">
          <span aria-hidden="true" className="storefrontPhoneIsland" />
          <iframe
            className="storefrontPhoneScreen"
            onLoad={() =>
              frame.current?.contentWindow?.postMessage(
                { type: 'swave:theme-preview', creatorId, theme: draft },
                window.location.origin,
              )
            }
            ref={frame}
            src={previewUrl}
            title={title}
          />
        </div>
      </div>
    </div>
  );
}

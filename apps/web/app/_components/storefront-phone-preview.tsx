'use client';

import {
  defaultStorefrontTheme,
  storefrontThemeConfigurationSchema,
  type StorefrontTheme,
  type StorefrontTitle,
  type StorefrontThemeConfiguration,
  type CreatorProfileSocialLink,
} from '@vibeshub/contracts';
import {
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  Eye,
  Pencil,
  SlidersHorizontal,
} from 'lucide-react';
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';

import { apiRequest } from '../../lib/api';
import { StorefrontContentEditor } from './storefront-content-editor';
import { contrastRatio } from '../../lib/storefront-theme';

type ThemeKey = Exclude<keyof StorefrontTheme, 'layout'>;
type ThemeSection = 'profile' | 'recommendations' | 'product' | 'discount' | 'collection';
const desktopQuery = '(min-width: 901px)';
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
  contentTargets,
  creatorId,
  editable = false,
  previewUrl,
  theme,
  title,
}: {
  children: ReactNode;
  contentTargets: Array<{ id: string; title: string; kind?: string }>;
  creatorId: string;
  editable?: boolean;
  previewUrl: string;
  theme: StorefrontTheme;
  title: string;
}) {
  const desktopPreview = useSyncExternalStore(subscribe, desktopSnapshot, () => false);
  // Creators need the same editor on a phone. The preview becomes a full-width
  // device there, while public storefront visitors still see the regular page.
  const showPhone = desktopPreview || editable;
  const [tab, setTab] = useState<'design' | 'content'>('content');
  const [selectedBlock, setSelectedBlock] = useState<string | null>(null);
  const [previewBrandOrder, setPreviewBrandOrder] = useState<string[] | null>(null);
  const [previewTitles, setPreviewTitles] = useState<StorefrontTitle[] | null>(null);
  const [previewBio, setPreviewBio] = useState<string | null>(null);
  const [previewSocialLinks, setPreviewSocialLinks] = useState<
    CreatorProfileSocialLink[] | null
  >(null);
  const [canEdit, setCanEdit] = useState(editable);
  const frame = useRef<HTMLIFrameElement>(null);
  const [configuration, setConfiguration] = useState<StorefrontThemeConfiguration | null>(
    null,
  );
  const [draft, setDraft] = useState<StorefrontTheme>(theme);
  const [selected, setSelected] = useState<ThemeSection>('profile');
  const [saving, setSaving] = useState(false);
  const [savingSearch, setSavingSearch] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [mobileEditorOpen, setMobileEditorOpen] = useState(false);
  const [previewMode, setPreviewMode] = useState(true);

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
      {
        type: 'swavii:theme-preview',
        creatorId,
        theme: draft,
        titles: previewTitles,
        brandOrder: previewBrandOrder,
        bio: previewBio,
        socialLinks: previewSocialLinks,
        selectedBlock,
        editingContent: tab === 'content',
        previewMode,
      },
      window.location.origin,
    );
  }, [
    creatorId,
    draft,
    previewTitles,
    previewBrandOrder,
    previewBio,
    previewSocialLinks,
    previewMode,
    selectedBlock,
    tab,
    showPhone,
  ]);

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
        blockId?: string;
        type?: string;
        configuration?: unknown;
      };
      if (data.type === 'swavii:layout-saved' && data.creatorId === creatorId) {
        const parsed = storefrontThemeConfigurationSchema.safeParse(data.configuration);
        if (parsed.success) {
          setConfiguration(parsed.data);
          setDraft((current) => ({ ...current, layout: parsed.data.theme.layout }));
        }
        return;
      }
      if (
        data.type === 'swavii:block-select' &&
        data.creatorId === creatorId &&
        data.blockId
      ) {
        setSelectedBlock(data.blockId);
        setTab('content');
        setMobileEditorOpen(true);
        return;
      }
      if (
        data.type === 'swavii:theme-select' &&
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

  const searchVisible = !(draft.layout?.hiddenBlocks ?? []).includes('search');
  async function setSearchVisible(visible: boolean) {
    if (!configuration || savingSearch) return;
    const hiddenBlocks = new Set(configuration.theme.layout?.hiddenBlocks ?? []);
    if (visible) hiddenBlocks.delete('search');
    else hiddenBlocks.add('search');
    const nextTheme: StorefrontTheme = {
      ...configuration.theme,
      layout: {
        blocks: configuration.theme.layout?.blocks ?? [],
        labels: configuration.theme.layout?.labels ?? [],
        hiddenBlocks: [...hiddenBlocks],
      },
    };
    setSavingSearch(true);
    setError('');
    setNotice('');
    try {
      const value = await apiRequest<StorefrontThemeConfiguration>(
        '/creator/studio/storefront-theme',
        {
          method: 'PUT',
          headers: { 'if-match': `"${configuration.version}"` },
          body: JSON.stringify(nextTheme),
        },
      );
      setConfiguration(value);
      setDraft(value.theme);
      setNotice(visible ? 'Search is visible on your storefront.' : 'Search is hidden.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update search.');
    } finally {
      setSavingSearch(false);
    }
  }

  return (
    <div
      className={`storefrontDesignWorkspace${canEdit && !previewMode ? ' hasEditor' : ''}`}
    >
      {canEdit ? (
        <>
          <div className="storefrontWorkspaceIntro">
            <div>
              <p className="eyebrow">CREATOR STUDIO / STOREFRONT</p>
              <h1>Your storefront.</h1>
              <p>See your page as visitors do. Switch to editing when you are ready.</p>
            </div>
            <a href={previewUrl.split('?')[0]} rel="noreferrer" target="_blank">
              Open live page <ArrowUpRight aria-hidden="true" size={17} />
            </a>
          </div>
          <div className="storefrontPreviewToolbar">
            <div
              aria-label="Storefront mode"
              className="storefrontModeSwitch"
              role="group"
            >
              <button
                aria-pressed={previewMode}
                onClick={() => {
                  setPreviewMode(true);
                  setMobileEditorOpen(false);
                }}
                type="button"
              >
                <Eye aria-hidden="true" size={16} /> Preview
              </button>
              <button
                aria-pressed={!previewMode}
                onClick={() => {
                  setPreviewMode(false);
                  setMobileEditorOpen(true);
                }}
                type="button"
              >
                <Pencil aria-hidden="true" size={16} /> Edit page
              </button>
            </div>
            <span>Your preview stays visible while you edit.</span>
          </div>
        </>
      ) : null}
      {canEdit && !previewMode ? (
        <aside
          aria-label="Storefront design"
          className="storefrontDesignPanel"
          data-mobile-open={mobileEditorOpen}
        >
          <button
            aria-expanded={mobileEditorOpen}
            className="mobileStorefrontEditorToggle"
            onClick={() => setMobileEditorOpen((open) => !open)}
            type="button"
          >
            <span>
              <SlidersHorizontal aria-hidden="true" size={18} />
              {mobileEditorOpen ? 'Back to storefront' : 'Design & content'}
            </span>
            {mobileEditorOpen ? (
              <ChevronDown aria-hidden="true" size={18} />
            ) : (
              <ChevronUp aria-hidden="true" size={18} />
            )}
          </button>
          <div className="storefrontDesignPanelBody">
            <div className="storefrontDesignPanelHeading">
              <h2>Edit your page</h2>
              <p>Choose what to change. See it update alongside.</p>
            </div>
            <div className="storefrontDesignTabs" role="group" aria-label="Page editor">
              <button
                type="button"
                aria-pressed={tab === 'content'}
                onClick={() => setTab('content')}
              >
                Content
              </button>
              <button
                type="button"
                aria-pressed={tab === 'design'}
                onClick={() => setTab('design')}
              >
                Design
              </button>
            </div>
            <div hidden={tab !== 'content'}>
              <section className="storefrontSearchControl" aria-label="Store search">
                <div>
                  <strong>Store search</strong>
                  <p>
                    Let visitors search your recommendations from any part of the page.
                  </p>
                </div>
                <label>
                  <input
                    aria-label="Show store search"
                    checked={searchVisible}
                    disabled={!configuration || savingSearch}
                    onChange={(event) => void setSearchVisible(event.target.checked)}
                    type="checkbox"
                  />
                  <span>{searchVisible ? 'Shown' : 'Hidden'}</span>
                </label>
              </section>
              <StorefrontContentEditor
                creatorId={creatorId}
                targets={contentTargets}
                selectedId={selectedBlock}
                onSelect={setSelectedBlock}
                onPreview={(next) => {
                  setPreviewTitles(next.titles);
                  setPreviewBrandOrder(next.brandOrder);
                  setPreviewBio(next.bio ?? null);
                  setPreviewSocialLinks(next.socialLinks ?? null);
                }}
              />
            </div>
            <div hidden={tab !== 'design'}>
              <div
                className="storefrontPaletteList"
                role="group"
                aria-label="Color palettes"
              >
                {palettes.map(({ name, theme: palette }) => (
                  <button
                    aria-pressed={Object.keys(defaultStorefrontTheme).every(
                      (key) => draft[key as ThemeKey] === palette[key as ThemeKey],
                    )}
                    key={name}
                    onClick={() => {
                      setDraft((current) => ({ ...palette, layout: current.layout }));
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
                    setDraft((current) => ({
                      ...defaultStorefrontTheme,
                      layout: current.layout,
                    }));
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
            </div>
          </div>
        </aside>
      ) : null}
      <div className="storefrontPhoneStage">
        {canEdit ? (
          <p className="storefrontVisitorLabel">
            <span aria-hidden="true" /> Visitor view · {previewUrl.split('?')[0]}
          </p>
        ) : null}
        <div className="storefrontPhoneDevice">
          <span aria-hidden="true" className="storefrontPhoneIsland" />
          <iframe
            className="storefrontPhoneScreen"
            onLoad={() =>
              frame.current?.contentWindow?.postMessage(
                {
                  type: 'swavii:theme-preview',
                  creatorId,
                  theme: draft,
                  titles: previewTitles,
                  brandOrder: previewBrandOrder,
                  bio: previewBio,
                  socialLinks: previewSocialLinks,
                  selectedBlock,
                  editingContent: tab === 'content',
                  previewMode,
                },
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

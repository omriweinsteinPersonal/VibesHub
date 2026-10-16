'use client';

import {
  storefrontTitlesSchema,
  defaultStorefrontTheme,
  storefrontThemeConfigurationSchema,
  type CreatorStorefrontConfiguration,
  type CreatorProfileSettings,
  type StorefrontTitle,
  type StorefrontTheme,
  type StorefrontThemeConfiguration,
} from '@vibeshub/contracts';
import { ChevronDown, ChevronUp, Eye, Pencil, SlidersHorizontal } from 'lucide-react';
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';

import { apiRequest } from '../../lib/api';

type ThemeKey = Exclude<
  keyof StorefrontTheme,
  | 'layout'
  | 'profileImageUrl'
  | 'templateId'
  | 'headerStyle'
  | 'labelsFrame'
  | 'bioAlign'
  | 'headingFont'
  | 'bodyFont'
>;
type ThemeSection = 'theme' | 'header' | 'labels' | 'templates' | 'typography' | 'titles';
const desktopQuery = '(min-width: 901px)';
const groups: Array<{
  id: ThemeSection;
  title: string;
  fields: Array<{ key: ThemeKey; label: string }>;
}> = [
  {
    id: 'theme',
    title: 'Theme',
    fields: [
      { key: 'recommendationsBackground', label: 'Page background' },
      { key: 'productBackground', label: 'Section / card background' },
      { key: 'accentColor', label: 'Accent' },
      { key: 'textColor', label: 'Text' },
    ],
  },
  {
    id: 'header',
    title: 'Header',
    fields: [],
  },
  {
    id: 'labels',
    title: 'Storefront labels',
    fields: [],
  },
  {
    id: 'templates',
    title: 'Templates',
    fields: [],
  },
  {
    id: 'typography',
    title: 'Typography',
    fields: [],
  },
  {
    id: 'titles',
    title: 'Titles',
    fields: [],
  },
];

const templatePresets = [
  {
    id: 'citrus-glow',
    title: 'Citrus Glow',
    description: 'A bright lime tone with a subtle organic texture.',
    colors: {
      recommendationsBackground: '#d8ef66',
    },
  },
  {
    id: 'clay-editorial',
    title: 'Clay Editorial',
    description: 'Warm terracotta, soft cream, and an editorial feel.',
    colors: { recommendationsBackground: '#d99a78' },
  },
] as const;

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
  const [canEdit, setCanEdit] = useState(editable);
  const frame = useRef<HTMLIFrameElement>(null);
  const [configuration, setConfiguration] = useState<StorefrontThemeConfiguration | null>(
    null,
  );
  const [titleDraft, setTitleDraft] = useState<StorefrontTitle[]>([]);
  const [titlesSaving, setTitlesSaving] = useState(false);
  const [draft, setDraft] = useState<StorefrontTheme>({
    ...theme,
  });
  const [selected, setSelected] = useState<ThemeSection>('theme');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [mobileEditorOpen, setMobileEditorOpen] = useState(false);
  const [previewMode, setPreviewMode] = useState(true);
  const [selectedBlock, setSelectedBlock] = useState<string | null>(null);
  const [bioDraft, setBioDraft] = useState<string | null>(null);
  const [bioProfileVersion, setBioProfileVersion] = useState<number | null>(null);
  const [bioLoading, setBioLoading] = useState(false);
  const [bioSaving, setBioSaving] = useState(false);
  const editorVisible = desktopPreview || !previewMode;
  const effectivePreviewMode = desktopPreview ? false : previewMode;

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
    if (!canEdit || !showPhone) return;
    apiRequest<CreatorStorefrontConfiguration>('/creator/studio/storefront-sections')
      .then((value) => {
        const titles = storefrontTitlesSchema.parse(value.titles ?? []);
        setTitleDraft(titles);
      })
      .catch(() => undefined);
  }, [canEdit, showPhone]);

  useEffect(() => {
    if (!showPhone) return;
    frame.current?.contentWindow?.postMessage(
      {
        type: 'swavii:theme-preview',
        creatorId,
        theme: draft,
        bio: bioDraft ?? undefined,
        editingContent: selectedBlock === 'bio',
        previewMode: effectivePreviewMode,
        selectedBlock,
      },
      window.location.origin,
    );
  }, [bioDraft, creatorId, draft, effectivePreviewMode, selectedBlock, showPhone]);

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
        if (data.blockId === 'bio' && bioDraft === null) {
          setBioLoading(true);
          void apiRequest<CreatorProfileSettings>('/creator/profile')
            .then((profile) => {
              setBioDraft(profile.bioHe);
              setBioProfileVersion(profile.version);
            })
            .catch((cause: unknown) => {
              setError(
                cause instanceof Error ? cause.message : 'Could not load your bio.',
              );
            })
            .finally(() => setBioLoading(false));
        }
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
  }, [bioDraft, canEdit, creatorId, showPhone]);

  if (!showPhone) return <>{children}</>;
  const changed = JSON.stringify(draft) !== JSON.stringify(configuration?.theme ?? theme);
  const searchVisible = !(draft.layout?.hiddenBlocks ?? []).includes('search');
  function setSearchVisible(visible: boolean) {
    frame.current?.contentWindow?.postMessage(
      {
        type: 'swavii:toggle-layout-block',
        blockId: 'search',
        creatorId,
        hidden: !visible,
      },
      window.location.origin,
    );
  }
  async function saveBio() {
    if (bioDraft === null || !bioProfileVersion || bioSaving) return;
    setBioSaving(true);
    setError('');
    setNotice('');
    try {
      const profile = await apiRequest<CreatorProfileSettings>('/creator/profile', {
        body: JSON.stringify({ bioHe: bioDraft }),
        headers: { 'if-match': `"${bioProfileVersion}"` },
        method: 'PATCH',
      });
      setBioDraft(profile.bioHe);
      setBioProfileVersion(profile.version);
      setNotice('Bio is live on your storefront.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save your bio.');
    } finally {
      setBioSaving(false);
    }
  }
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
  function addTitle() {
    setTitleDraft((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        text: '',
        format: 'heading',
        align: 'center',
        size: 'medium',
        beforeId: null,
      },
    ]);
  }
  async function saveTitles() {
    if (titlesSaving || titleDraft.some((title) => !title.text.trim())) return;
    setTitlesSaving(true);
    setError('');
    setNotice('');
    try {
      const latest = await apiRequest<CreatorStorefrontConfiguration>(
        '/creator/studio/storefront-sections',
      );
      const value = await apiRequest<CreatorStorefrontConfiguration>(
        '/creator/studio/storefront-sections',
        {
          body: JSON.stringify({
            brandOrder: latest.brandOrder,
            categoryIds: latest.sections.map(({ category }) => category.id),
            contentOrder: latest.contentOrder,
            curatedSections: latest.curatedSections,
            featuredMedia: latest.featuredMedia,
            hiddenBrandIds: latest.hiddenBrandIds,
            hiddenCollectionIds: latest.hiddenCollectionIds,
            hiddenRecommendationIds: latest.hiddenRecommendationIds,
            labels: latest.labels,
            titles: titleDraft.map((title) => ({ ...title, text: title.text.trim() })),
          }),
          headers: { 'if-match': `"${latest.version}"` },
          method: 'PUT',
        },
      );
      const titles = storefrontTitlesSchema.parse(value.titles ?? []);
      setTitleDraft(titles);
      setNotice('Titles saved to your storefront.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save titles.');
    } finally {
      setTitlesSaving(false);
    }
  }

  return (
    <div
      className={`storefrontDesignWorkspace${canEdit && editorVisible ? ' hasEditor' : ''}`}
    >
      {canEdit && !desktopPreview ? (
        <>
          <div className="storefrontWorkspaceIntro">
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
            </div>
          </div>
        </>
      ) : null}
      {canEdit && editorVisible ? (
        <aside
          aria-label="Storefront design"
          className="storefrontDesignPanel"
          data-mobile-open={desktopPreview || mobileEditorOpen}
        >
          <button
            aria-expanded={mobileEditorOpen}
            className="mobileStorefrontEditorToggle"
            onClick={() => setMobileEditorOpen((open) => !open)}
            type="button"
          >
            <span>
              <SlidersHorizontal aria-hidden="true" size={18} />
              {mobileEditorOpen ? 'Back to storefront' : 'Design'}
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
              <p>Shape your storefront with colors, layout, and style.</p>
            </div>
            {selectedBlock === 'bio' ? (
              <section className="storefrontBioEditor" aria-labelledby="bio-editor-title">
                <div>
                  <h3 id="bio-editor-title">Profile bio</h3>
                  <p>This text appears below your name in the storefront header.</p>
                </div>
                {bioLoading ? (
                  <p className="storefrontEditorHint">Loading your bio…</p>
                ) : (
                  <>
                    <textarea
                      aria-label="Profile bio"
                      dir="auto"
                      maxLength={1000}
                      onChange={(event) => setBioDraft(event.target.value)}
                      placeholder="Write a short introduction…"
                      rows={4}
                      value={bioDraft ?? ''}
                    />
                    <label className="storefrontBioAlignment">
                      <span>Text alignment</span>
                      <select
                        aria-label="Bio text alignment"
                        onChange={(event) => {
                          setDraft((current) => ({
                            ...current,
                            bioAlign: event.target.value as StorefrontTheme['bioAlign'],
                          }));
                          setNotice('');
                        }}
                        value={draft.bioAlign}
                      >
                        <option value="left">Left</option>
                        <option value="center">Center</option>
                        <option value="right">Right</option>
                      </select>
                    </label>
                    <button
                      className="button primary"
                      disabled={bioSaving || bioDraft === null}
                      onClick={() => void saveBio()}
                      type="button"
                    >
                      {bioSaving ? 'Saving…' : 'Save bio'}
                    </button>
                  </>
                )}
              </section>
            ) : null}
            <section
              aria-labelledby="search-visibility-title"
              className="storefrontSearchVisibility"
            >
              <div>
                <h3 id="search-visibility-title">Store search</h3>
                <p>Let visitors search recommendations from any part of your page.</p>
              </div>
              <label>
                <span>{searchVisible ? 'Shown' : 'Hidden'}</span>
                <input
                  aria-label="Show store search"
                  checked={searchVisible}
                  onChange={(event) => setSearchVisible(event.target.checked)}
                  type="checkbox"
                />
              </label>
            </section>
            <div>
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
                        {group.id === 'header' ? (
                          <div
                            className="storefrontChoiceGrid"
                            role="group"
                            aria-label="Header style"
                          >
                            {[
                              [
                                'classic',
                                'Full-bleed',
                                'Keep the immersive profile header.',
                              ],
                              [
                                'circular',
                                'Circular',
                                'Center the profile photo above the name.',
                              ],
                            ].map(([value, label, description]) => (
                              <button
                                aria-pressed={draft.headerStyle === value}
                                className="storefrontChoiceCard"
                                key={value}
                                onClick={() => {
                                  setDraft((current) => ({
                                    ...current,
                                    headerStyle: value as 'classic' | 'circular',
                                  }));
                                  setNotice('');
                                }}
                                type="button"
                              >
                                <strong>{label}</strong>
                                <span>{description}</span>
                              </button>
                            ))}
                          </div>
                        ) : group.id === 'labels' ? (
                          <label className="storefrontFrameToggle">
                            <input
                              checked={draft.labelsFrame ?? true}
                              onChange={(event) => {
                                setDraft((current) => ({
                                  ...current,
                                  labelsFrame: event.target.checked,
                                }));
                                setNotice('');
                              }}
                              type="checkbox"
                            />
                            <span>
                              <strong>Show a frame around labels</strong>
                              <small>
                                Add or remove the outline around All, Fashion and other
                                storefront filters.
                              </small>
                            </span>
                          </label>
                        ) : group.id === 'templates' ? (
                          <div
                            aria-label="Storefront templates"
                            className="storefrontChoiceGrid storefrontTemplateGrid"
                            role="group"
                          >
                            {templatePresets.map((template) => (
                              <button
                                aria-pressed={draft.templateId === template.id}
                                className="storefrontChoiceCard storefrontTemplateCard"
                                key={template.id}
                                onClick={() => {
                                  setDraft((current) => ({
                                    ...current,
                                    templateId: template.id,
                                    ...template.colors,
                                  }));
                                  setNotice('');
                                }}
                                type="button"
                              >
                                <span
                                  aria-hidden="true"
                                  className={`storefrontTemplateSwatch storefrontTemplateSwatch-${template.id}`}
                                />
                                <span>
                                  <strong>{template.title}</strong>
                                  <span>{template.description}</span>
                                </span>
                              </button>
                            ))}
                          </div>
                        ) : group.id === 'typography' ? (
                          <div className="storefrontTypographyFields">
                            <label>
                              <span>Headings</span>
                              <select
                                aria-label="Heading font"
                                onChange={(event) => {
                                  setDraft((current) => ({
                                    ...current,
                                    headingFont: event.target
                                      .value as StorefrontTheme['headingFont'],
                                  }));
                                  setNotice('');
                                }}
                                value={draft.headingFont}
                              >
                                <option value="display">Display serif</option>
                                <option value="sans">Clean sans</option>
                                <option value="editorial">Editorial serif</option>
                              </select>
                            </label>
                            <label>
                              <span>Body text</span>
                              <select
                                aria-label="Body font"
                                onChange={(event) => {
                                  setDraft((current) => ({
                                    ...current,
                                    bodyFont: event.target
                                      .value as StorefrontTheme['bodyFont'],
                                  }));
                                  setNotice('');
                                }}
                                value={draft.bodyFont}
                              >
                                <option value="aptos">Aptos</option>
                                <option value="sans">Modern sans</option>
                                <option value="serif">Soft serif</option>
                              </select>
                            </label>
                          </div>
                        ) : group.id === 'titles' ? (
                          <TitlesEditor
                            draft={titleDraft}
                            onAdd={addTitle}
                            onChange={setTitleDraft}
                            onSave={() => void saveTitles()}
                            saving={titlesSaving}
                          />
                        ) : (
                          group.fields.map(({ key, label }) => (
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
                          ))
                        )}
                      </div>
                    ) : null}
                  </section>
                ))}
              </div>
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
                      templateId: current.templateId,
                      profileImageUrl: current.profileImageUrl,
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
                  bio: bioDraft ?? undefined,
                  editingContent: selectedBlock === 'bio',
                  previewMode: effectivePreviewMode,
                  selectedBlock,
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

function TitlesEditor({
  draft,
  onAdd,
  onChange,
  onSave,
  saving,
}: {
  draft: StorefrontTitle[];
  onAdd: () => void;
  onChange: (titles: StorefrontTitle[]) => void;
  onSave: () => void;
  saving: boolean;
}) {
  return (
    <div className="storefrontTitlesEditor">
      <div className="storefrontTitlesEditorHeader">
        <p>Add simple titles to organize your storefront.</p>
        <button onClick={onAdd} type="button">
          Add title
        </button>
      </div>
      {draft.map((title, index) => (
        <article key={title.id}>
          <label>
            <span>Title {index + 1}</span>
            <input
              maxLength={2000}
              onChange={(event) =>
                onChange(
                  draft.map((item) =>
                    item.id === title.id ? { ...item, text: event.target.value } : item,
                  ),
                )
              }
              placeholder="Your storefront title"
              value={title.text}
            />
          </label>
          <label>
            <span>Alignment</span>
            <select
              onChange={(event) =>
                onChange(
                  draft.map((item) =>
                    item.id === title.id
                      ? { ...item, align: event.target.value as StorefrontTitle['align'] }
                      : item,
                  ),
                )
              }
              value={title.align}
            >
              <option value="start">Left</option>
              <option value="center">Center</option>
              <option value="end">Right</option>
            </select>
          </label>
          <button
            onClick={() => onChange(draft.filter((item) => item.id !== title.id))}
            type="button"
          >
            Remove
          </button>
        </article>
      ))}
      {!draft.length ? <p className="storefrontEditorHint">No titles yet.</p> : null}
      <button
        className="button primary"
        disabled={saving || draft.some((title) => !title.text.trim())}
        onClick={onSave}
        type="button"
      >
        {saving ? 'Saving…' : 'Save titles'}
      </button>
    </div>
  );
}

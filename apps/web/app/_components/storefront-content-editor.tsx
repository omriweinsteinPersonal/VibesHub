'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, Plus, Trash2 } from 'lucide-react';
import {
  creatorStorefrontConfigurationInputSchema,
  type CreatorStorefrontConfiguration,
  type CreatorProfileSettings,
  type CreatorProfileSocialLink,
  type StorefrontTitle,
} from '@vibeshub/contracts';
import { randomUuid } from '../../lib/random-id';
import { apiRequest } from '../../lib/api';

type Draft = {
  titles: StorefrontTitle[];
  brandOrder: string[];
  bio?: string;
  socialLinks?: CreatorProfileSocialLink[];
};
type Target = { id: string; title: string; kind?: string };
export function StorefrontContentEditor({
  creatorId,
  targets,
  onPreview,
  selectedId,
  onSelect,
}: {
  creatorId: string;
  targets: Target[];
  onPreview: (draft: Draft) => void;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const [configuration, setConfiguration] =
    useState<CreatorStorefrontConfiguration | null>(null);
  const [draft, setDraft] = useState<Draft>({ titles: [], brandOrder: [] });
  const [history, setHistory] = useState<Draft[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<CreatorProfileSettings | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  useEffect(() => {
    let active = true;
    Promise.all([
      apiRequest<CreatorStorefrontConfiguration>('/creator/studio/storefront-sections'),
      apiRequest<CreatorProfileSettings>('/creator/profile'),
    ])
      .then(([value, creatorProfile]) => {
        if (!active) return;
        setConfiguration(value);
        setDraft({ titles: value.titles ?? [], brandOrder: value.brandOrder ?? [] });
        setProfile(creatorProfile);
      })
      .catch((cause: unknown) => {
        if (active)
          setError(cause instanceof Error ? cause.message : 'Could not load content.');
      });
    return () => {
      active = false;
    };
  }, [creatorId]);
  const change = (next: Draft) => {
    setHistory((past) => [...past.slice(-29), draft]);
    setDraft(next);
    onPreview(next);
    setNotice('');
  };
  const update = (id: string, patch: Partial<StorefrontTitle>) =>
    change({
      ...draft,
      titles: draft.titles.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    });
  function addBlock(kind: NonNullable<StorefrontTitle['contentKind']>) {
    const id = randomUuid();
    const defaults = {
      text: 'New text',
      'photo-gallery': 'Photo gallery',
      video: 'Video',
      instagram: 'Instagram post',
    } as const;
    change({
      ...draft,
      titles: [
        ...draft.titles,
        {
          id,
          text: defaults[kind],
          contentKind: kind,
          format: 'heading',
          align: 'start',
          size: 'medium',
          beforeId: null,
          appearance: 'card',
          padding: 'medium',
          radius: 'rounded',
        },
      ],
    });
    onSelect(id);
  }
  const brands = targets
    .filter(({ kind }) => kind === 'brand')
    .sort((a, b) => {
      const ai = draft.brandOrder.indexOf(a.id),
        bi = draft.brandOrder.indexOf(b.id);
      return (ai < 0 ? 1000 : ai) - (bi < 0 ? 1000 : bi);
    });
  const brandIds = new Set(brands.map(({ id }) => id));
  const layers = brands.flatMap((brand) => [
    ...draft.titles
      .filter(({ beforeId }) => beforeId === brand.id)
      .map((item) => ({
        id: item.id,
        title: item.text || 'Empty text',
        kind: item.contentKind ?? 'text',
      })),
    { ...brand, kind: 'brand' },
  ]);
  layers.push(
    ...draft.titles
      .filter(({ beforeId }) => !beforeId || !brandIds.has(beforeId))
      .map((item) => ({
        id: item.id,
        title: item.text || 'Empty text',
        kind: item.contentKind ?? 'text',
      })),
  );
  const selected = draft.titles.find(({ id }) => id === selectedId);
  const selectedTarget = targets.find(({ id }) => id === selectedId);
  const profileDraft = {
    bio: draft.bio ?? profile?.bioHe ?? '',
    socialLinks: draft.socialLinks ?? profile?.socialLinks ?? [],
  };
  function changeProfile(patch: Partial<typeof profileDraft>) {
    const next = { ...profileDraft, ...patch };
    const nextDraft = { ...draft, bio: next.bio, socialLinks: next.socialLinks };
    setDraft(nextDraft);
    onPreview(nextDraft);
    setNotice('');
  }
  async function saveProfile() {
    if (!profile || savingProfile) return;
    setSavingProfile(true);
    setError('');
    try {
      const updated = await apiRequest<CreatorProfileSettings>('/creator/profile', {
        method: 'PATCH',
        headers: { 'if-match': `"${profile.version}"` },
        body: JSON.stringify({
          bioHe: profileDraft.bio,
          socialLinks: profileDraft.socialLinks,
        }),
      });
      setProfile(updated);
      const next = { ...draft, bio: updated.bioHe, socialLinks: updated.socialLinks };
      setDraft(next);
      onPreview(next);
      setNotice('Profile changes are live.');
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Could not save profile changes.',
      );
    } finally {
      setSavingProfile(false);
    }
  }
  const dirty =
    configuration &&
    JSON.stringify({ titles: draft.titles, brandOrder: draft.brandOrder }) !==
      JSON.stringify({
        titles: configuration.titles ?? [],
        brandOrder: configuration.brandOrder ?? [],
      });
  async function save() {
    if (!configuration) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const input = creatorStorefrontConfigurationInputSchema.parse({
        categoryIds: configuration.sections.map(({ category }) => category.id),
        curatedSections: configuration.curatedSections.map(
          ({
            id,
            kind,
            brandId,
            title,
            description,
            imageUrl,
            parentCollectionId,
            recommendationIds,
            showItemsIndividually,
          }) => ({
            id,
            kind,
            brandId,
            title,
            description,
            imageUrl,
            parentCollectionId,
            recommendationIds,
            showItemsIndividually,
          }),
        ),
        contentOrder: configuration.contentOrder,
        labels: configuration.labels,
        titles: draft.titles,
        brandOrder: draft.brandOrder,
      });
      const updated = await apiRequest<CreatorStorefrontConfiguration>(
        '/creator/studio/storefront-sections',
        {
          method: 'PUT',
          headers: { 'if-match': '"' + configuration.version + '"' },
          body: JSON.stringify(input),
        },
      );
      const next = { titles: updated.titles ?? [], brandOrder: updated.brandOrder ?? [] };
      setConfiguration(updated);
      setDraft(next);
      onPreview(next);
      setHistory([]);
      setNotice('Content saved.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save content.');
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="storefrontContentEditor">
      <p>
        Tap a block in the preview to edit it. Drag its dotted handle to change its
        position. Positions save automatically.
      </p>
      <button
        aria-expanded={addMenuOpen}
        className="storefrontAddContentToggle"
        disabled={!configuration || saving || draft.titles.length >= 24}
        onClick={() => setAddMenuOpen((open) => !open)}
        type="button"
      >
        <span>
          <Plus aria-hidden="true" size={17} /> Add content
        </span>
        <ChevronDown aria-hidden="true" size={17} />
      </button>
      {addMenuOpen ? (
        <div
          className="storefrontAddContentActions"
          role="group"
          aria-label="Add content block"
        >
          {(
            [
              ['text', 'Text or link'],
              ['photo-gallery', 'Photo gallery'],
              ['video', 'Video'],
              ['instagram', 'Instagram post'],
            ] as const
          ).map(([kind, label]) => (
            <button
              className="button secondary"
              type="button"
              key={kind}
              disabled={!configuration || saving || draft.titles.length >= 24}
              onClick={() => {
                addBlock(kind);
                setAddMenuOpen(false);
              }}
            >
              <Plus aria-hidden="true" size={16} /> {label}
            </button>
          ))}
        </div>
      ) : null}
      {targets.some(({ kind }) => kind === 'bio' || kind === 'social') ? (
        <div
          className="storefrontProfileTargets"
          role="group"
          aria-label="Profile content"
        >
          {targets
            .filter(({ kind }) => kind === 'bio' || kind === 'social')
            .map((target) => (
              <button
                aria-pressed={selectedId === target.id}
                key={target.id}
                onClick={() => onSelect(target.id)}
                type="button"
              >
                {target.kind === 'bio' ? 'Edit bio' : `Edit ${target.title}`}
              </button>
            ))}
        </div>
      ) : null}
      <h3>Layers</h3>
      <ol className="storefrontLayerList">
        {layers.map((layer) => (
          <li key={layer.id} data-selected={selectedId === layer.id}>
            <button
              type="button"
              aria-pressed={selectedId === layer.id}
              onClick={() => onSelect(layer.id)}
            >
              <small>
                {layer.kind === 'brand' ? 'Brand' : layer.kind.replace('-', ' ')}
              </small>
              <span>{layer.title}</span>
            </button>
          </li>
        ))}
      </ol>
      {selectedTarget?.kind === 'bio' ? (
        <section className="storefrontTitleEditor">
          <label>
            Bio
            <textarea
              dir="auto"
              maxLength={1000}
              rows={4}
              value={profileDraft.bio}
              onChange={(event) => changeProfile({ bio: event.target.value })}
            />
          </label>
          <button
            className="button primary"
            disabled={savingProfile}
            onClick={() => void saveProfile()}
            type="button"
          >
            {savingProfile ? 'Saving...' : 'Save bio'}
          </button>
        </section>
      ) : selectedTarget?.kind === 'social' ? (
        <section className="storefrontTitleEditor">
          <p>
            Edit this link here. To move an icon, drag its dotted handle in the preview.
          </p>
          <ol className="storefrontLayerList">
            {profileDraft.socialLinks.map((link) => (
              <li key={link.platform}>
                <button type="button" onClick={() => onSelect(`social:${link.platform}`)}>
                  <small>Platform</small>
                  <span>{link.platform}</span>
                </button>
              </li>
            ))}
          </ol>
          {(() => {
            const platform = selectedTarget.id.slice('social:'.length);
            const link = profileDraft.socialLinks.find(
              (item) => item.platform === platform,
            );
            return link ? (
              <label>
                {link.platform} URL
                <input
                  type="url"
                  value={link.url}
                  onChange={(event) =>
                    changeProfile({
                      socialLinks: profileDraft.socialLinks.map((item) =>
                        item.platform === link.platform
                          ? { ...item, url: event.target.value }
                          : item,
                      ),
                    })
                  }
                />
              </label>
            ) : null;
          })()}
          <button
            className="button primary"
            disabled={savingProfile}
            onClick={() => void saveProfile()}
            type="button"
          >
            {savingProfile ? 'Saving...' : 'Save links'}
          </button>
        </section>
      ) : selected ? (
        <section className="storefrontTitleEditor">
          <fieldset disabled={saving}>
            <label>
              {selected.contentKind && selected.contentKind !== 'text'
                ? 'Heading or caption'
                : 'Text'}
              <textarea
                maxLength={2000}
                dir="auto"
                rows={4}
                value={selected.text}
                onChange={(e) => update(selected.id, { text: e.target.value })}
              />
            </label>
            {selected.contentKind === 'photo-gallery' ? (
              <label>
                Photo URLs <small>One HTTPS image URL per line, up to six.</small>
                <textarea
                  rows={6}
                  inputMode="url"
                  placeholder={
                    'https://example.com/photo-1.jpg\nhttps://example.com/photo-2.jpg'
                  }
                  value={(selected.mediaUrls ?? []).join('\n')}
                  onChange={(event) =>
                    update(selected.id, {
                      mediaUrls: event.target.value
                        .split(/\r?\n/)
                        .map((value) => value.trim())
                        .filter(Boolean),
                    })
                  }
                />
              </label>
            ) : null}
            {selected.contentKind === 'video' ? (
              <label>
                Video URL <small>Direct HTTPS video file URL.</small>
                <input
                  type="url"
                  inputMode="url"
                  placeholder="https://example.com/video.mp4"
                  value={selected.videoUrl ?? ''}
                  onChange={(event) =>
                    update(selected.id, {
                      videoUrl: event.target.value.trim() || undefined,
                    })
                  }
                />
              </label>
            ) : null}
            {selected.contentKind === 'instagram' ? (
              <label>
                Public Instagram post or reel URL
                <input
                  type="url"
                  inputMode="url"
                  placeholder="https://www.instagram.com/p/.../"
                  value={selected.instagramUrl ?? ''}
                  onChange={(event) =>
                    update(selected.id, {
                      instagramUrl: event.target.value.trim() || undefined,
                    })
                  }
                />
                <small>
                  Private or removed posts may not embed. Your page keeps a direct
                  Instagram link.
                </small>
              </label>
            ) : null}
            {!selected.contentKind || selected.contentKind === 'text' ? (
              <>
                <label>
                  Destination link <small>Optional</small>
                  <input
                    inputMode="url"
                    placeholder="https://example.com"
                    type="url"
                    value={selected.url ?? ''}
                    onChange={(e) =>
                      update(selected.id, { url: e.target.value.trim() || undefined })
                    }
                  />
                </label>
                <label>
                  Button label{' '}
                  <small>Optional — shown only with a destination link</small>
                  <input
                    maxLength={80}
                    placeholder="e.g. Shop the collection"
                    type="text"
                    value={selected.buttonLabel ?? ''}
                    onChange={(e) =>
                      update(selected.id, {
                        buttonLabel: e.target.value.trim() || undefined,
                      })
                    }
                  />
                </label>
                <label>
                  Text style
                  <select
                    value={selected.format ?? 'heading'}
                    onChange={(e) =>
                      update(selected.id, {
                        format: e.target.value as 'heading' | 'paragraph',
                      })
                    }
                  >
                    <option value="heading">Heading</option>
                    <option value="paragraph">Paragraph</option>
                  </select>
                </label>
              </>
            ) : null}
            <label>
              Appearance
              <select
                value={selected.appearance ?? 'plain'}
                onChange={(e) =>
                  update(selected.id, { appearance: e.target.value as 'plain' | 'card' })
                }
              >
                <option value="plain">Plain text</option>
                <option value="card">Card — matches your storefront palette</option>
              </select>
            </label>
            {selected.appearance === 'card' ? (
              <>
                <label>
                  Background
                  <input
                    type="color"
                    value={selected.background ?? '#f8f6f2'}
                    onChange={(e) => update(selected.id, { background: e.target.value })}
                  />
                </label>
                <div className="storefrontBackgroundReset">
                  <button
                    className="button secondary"
                    disabled={!selected.background}
                    onClick={() => update(selected.id, { background: undefined })}
                    type="button"
                  >
                    Use storefront palette color
                  </button>
                  <small>
                    {selected.background
                      ? 'Using a custom background color.'
                      : 'Using the current storefront card color.'}
                  </small>
                </div>
                <label>
                  Background image URL <small>Optional</small>
                  <input
                    inputMode="url"
                    placeholder="https://example.com/background.jpg"
                    type="url"
                    value={selected.backgroundImageUrl ?? ''}
                    onChange={(e) =>
                      update(selected.id, {
                        backgroundImageUrl: e.target.value.trim() || undefined,
                      })
                    }
                  />
                </label>
                <label>
                  Spacing
                  <select
                    value={selected.padding ?? 'small'}
                    onChange={(e) =>
                      update(selected.id, {
                        padding: e.target.value as StorefrontTitle['padding'],
                      })
                    }
                  >
                    <option value="small">Small</option>
                    <option value="medium">Medium</option>
                    <option value="large">Large</option>
                  </select>
                </label>
                <label>
                  Corners
                  <select
                    value={selected.radius ?? 'rounded'}
                    onChange={(e) =>
                      update(selected.id, {
                        radius: e.target.value as StorefrontTitle['radius'],
                      })
                    }
                  >
                    <option value="square">Square</option>
                    <option value="rounded">Rounded</option>
                    <option value="soft">Soft</option>
                  </select>
                </label>
              </>
            ) : null}
            <label>
              Size
              <select
                value={selected.size}
                onChange={(e) =>
                  update(selected.id, { size: e.target.value as StorefrontTitle['size'] })
                }
              >
                <option value="small">Small</option>
                <option value="medium">Medium</option>
                <option value="large">Large</option>
              </select>
            </label>
            <label>
              Alignment
              <select
                value={selected.align}
                onChange={(e) =>
                  update(selected.id, {
                    align: e.target.value as StorefrontTitle['align'],
                  })
                }
              >
                <option value="start">Start (matches language)</option>
                <option value="center">Center</option>
                <option value="end">End</option>
              </select>
            </label>
            <button
              className="button secondary"
              type="button"
              onClick={() => {
                change({
                  ...draft,
                  titles: draft.titles.filter(({ id }) => id !== selected.id),
                });
                onSelect(null);
              }}
            >
              <Trash2 size={15} /> Delete block
            </button>
          </fieldset>
        </section>
      ) : selectedId ? (
        <p>Drag this section directly in the preview to change its position.</p>
      ) : null}
      {error ? (
        <p role="alert" className="formError">
          {error}
        </p>
      ) : null}
      {notice ? <p role="status">{notice}</p> : null}
      <div className="storefrontDesignActions">
        <button
          type="button"
          disabled={!history.length || saving}
          onClick={() => {
            const next = history.at(-1)!;
            setDraft(next);
            onPreview(next);
            setHistory(history.slice(0, -1));
          }}
        >
          Undo
        </button>
        <button
          type="button"
          disabled={!dirty || saving}
          onClick={() => {
            const next = {
              titles: configuration?.titles ?? [],
              brandOrder: configuration?.brandOrder ?? [],
            };
            change(next);
          }}
        >
          Reset changes
        </button>
        <button
          className="button primary"
          type="button"
          disabled={!dirty || saving || draft.titles.some(({ text }) => !text.trim())}
          onClick={() => void save()}
        >
          {saving ? 'Saving...' : 'Save content'}
        </button>
      </div>
    </div>
  );
}

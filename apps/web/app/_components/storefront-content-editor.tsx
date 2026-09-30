'use client';
import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
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
  const [dragged, setDragged] = useState<string | null>(null);
  const [profile, setProfile] = useState<CreatorProfileSettings | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [draggedSocial, setDraggedSocial] = useState<string | null>(null);
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
      .map((item) => ({ id: item.id, title: item.text || 'Empty text', kind: 'text' })),
    { ...brand, kind: 'brand' },
  ]);
  layers.push(
    ...draft.titles
      .filter(({ beforeId }) => !beforeId || !brandIds.has(beforeId))
      .map((item) => ({ id: item.id, title: item.text || 'Empty text', kind: 'text' })),
  );
  function move(id: string, to: number) {
    const from = layers.findIndex((item) => item.id === id);
    if (saving || from < 0 || to < 0 || to >= layers.length || to === from) return;
    const next = [...layers];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item!);
    const titles = next.flatMap((layer, index) => {
      const text = draft.titles.find(({ id }) => id === layer.id);
      return text
        ? [
            {
              ...text,
              beforeId:
                next.slice(index + 1).find(({ kind }) => kind === 'brand')?.id ?? null,
            },
          ]
        : [];
    });
    change({
      titles,
      brandOrder: next.filter(({ kind }) => kind === 'brand').map(({ id }) => id),
    });
  }
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
        ...draft,
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
        Tap a block in the preview to edit it. Drag a section to place it where you want
        it.
      </p>
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
      <button
        className="button secondary"
        type="button"
        disabled={!configuration || saving || draft.titles.length >= 24}
        onClick={() => {
          const id = randomUuid();
          change({
            ...draft,
            titles: [
              ...draft.titles,
              {
                id,
                text: 'New text',
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
        }}
      >
        <Plus aria-hidden="true" size={16} /> Add text
      </button>
      <h3>Layers</h3>
      <ol className="storefrontLayerList">
        {layers.map((layer, index) => (
          <li
            key={layer.id}
            draggable={!saving}
            onDragStart={() => setDragged(layer.id)}
            onDragEnd={() => setDragged(null)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              if (dragged) move(dragged, index);
              setDragged(null);
            }}
            data-selected={selectedId === layer.id}
          >
            <button
              type="button"
              aria-pressed={selectedId === layer.id}
              onClick={() => onSelect(layer.id)}
            >
              <small>{layer.kind === 'text' ? 'Text' : 'Brand'}</small>
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
          <p>Edit this link, or drag platforms below to set their live order.</p>
          <ol className="storefrontLayerList">
            {profileDraft.socialLinks.map((link, index) => (
              <li
                draggable={!savingProfile}
                key={link.platform}
                onDragEnd={() => setDraggedSocial(null)}
                onDragOver={(event) => event.preventDefault()}
                onDragStart={() => setDraggedSocial(link.platform)}
                onDrop={(event) => {
                  event.preventDefault();
                  if (!draggedSocial || draggedSocial === link.platform) return;
                  const links = [...profileDraft.socialLinks];
                  const from = links.findIndex(
                    ({ platform }) => platform === draggedSocial,
                  );
                  const [moving] = links.splice(from, 1);
                  links.splice(index, 0, moving!);
                  changeProfile({ socialLinks: links });
                  setDraggedSocial(null);
                }}
              >
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
              Text
              <textarea
                maxLength={2000}
                dir="auto"
                rows={4}
                value={selected.text}
                onChange={(e) => update(selected.id, { text: e.target.value })}
              />
            </label>
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
              Button label <small>Optional — shown only with a destination link</small>
              <input
                maxLength={80}
                placeholder="e.g. Shop the collection"
                type="text"
                value={selected.buttonLabel ?? ''}
                onChange={(e) =>
                  update(selected.id, { buttonLabel: e.target.value.trim() || undefined })
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
              <Trash2 size={15} /> Delete text
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

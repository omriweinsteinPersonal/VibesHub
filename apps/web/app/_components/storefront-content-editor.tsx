'use client';
import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import {
  creatorStorefrontConfigurationInputSchema,
  type CreatorStorefrontConfiguration,
  type StorefrontTitle,
} from '@vibeshub/contracts';
import { randomUuid } from '../../lib/random-id';
import { apiRequest } from '../../lib/api';

type Draft = { titles: StorefrontTitle[]; brandOrder: string[] };
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
  useEffect(() => {
    let active = true;
    apiRequest<CreatorStorefrontConfiguration>('/creator/studio/storefront-sections')
      .then((value) => {
        if (!active) return;
        setConfiguration(value);
        setDraft({ titles: value.titles ?? [], brandOrder: value.brandOrder ?? [] });
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
  const dirty =
    configuration &&
    JSON.stringify(draft) !==
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
        Select a block in the preview, or choose a layer below. Drag layers or use the
        arrows to reorder.
      </p>
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
            <button
              type="button"
              aria-label={'Move ' + layer.title + ' up'}
              disabled={saving || index === 0}
              onClick={() => move(layer.id, index - 1)}
            >
              <ArrowUp size={14} />
            </button>
            <button
              type="button"
              aria-label={'Move ' + layer.title + ' down'}
              disabled={saving || index === layers.length - 1}
              onClick={() => move(layer.id, index + 1)}
            >
              <ArrowDown size={14} />
            </button>
          </li>
        ))}
      </ol>
      {selected ? (
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
                <option value="plain">Plain</option>
                <option value="card">Card</option>
              </select>
            </label>
            {selected.appearance === 'card' ? (
              <>
                <label>
                  Background
                  <input
                    type="color"
                    value={selected.background ?? '#f1e8dc'}
                    onChange={(e) => update(selected.id, { background: e.target.value })}
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
        <p>Use the layer arrows or drag this brand to change its position.</p>
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

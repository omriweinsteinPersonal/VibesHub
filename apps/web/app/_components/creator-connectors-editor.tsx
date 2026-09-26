'use client';

import type {
  CreatorProfileSettings,
  CreatorProfileSocialLink,
} from '@vibeshub/contracts';
import { ExternalLink, Plus, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';

import { apiRequest } from '../../lib/api';
import { connectorLabel, creatorConnectors } from '../../lib/creator-connectors';
import { CreatorConnectorIcon } from './creator-connector-icon';

export function CreatorConnectorsEditor({
  onSaved,
  profile,
}: {
  onSaved: (profile: CreatorProfileSettings) => void;
  profile: CreatorProfileSettings | null;
}) {
  const [links, setLinks] = useState<CreatorProfileSocialLink[]>(
    () => profile?.socialLinks ?? [],
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile) return;
    const normalized = links.map((link) => ({
      ...link,
      url: link.url.trim(),
    }));
    if (
      normalized.some(({ url }) => {
        try {
          return new URL(url).protocol !== 'https:';
        } catch {
          return true;
        }
      })
    ) {
      setError('Enter a complete HTTPS link for every connector.');
      return;
    }
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const updated = await apiRequest<CreatorProfileSettings>('/creator/profile', {
        body: JSON.stringify({ socialLinks: normalized }),
        headers: { 'if-match': `"${profile.version}"` },
        method: 'PATCH',
      });
      onSaved(updated);
      setNotice('Connectors saved to your storefront.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save connectors.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="creatorConnectors" id="creator-connectors">
      <div className="creatorConnectorsHeading">
        <div>
          <p className="eyebrow">YOUR STOREFRONT</p>
          <h2>Connectors</h2>
          <p>Add the places where shoppers can find you. Links appear below your name.</p>
        </div>
        {profile ? (
          <a href={`/${profile.handle}`} rel="noopener noreferrer" target="_blank">
            View storefront <ExternalLink aria-hidden="true" size={14} />
          </a>
        ) : null}
      </div>
      {!profile ? (
        <p>Loading your profile…</p>
      ) : (
        <form onSubmit={(event) => void save(event)}>
          {links.length ? (
            <ol className="creatorConnectorList">
              {links.map((link) => (
                <li key={link.platform}>
                  <label>
                    <span className="creatorConnectorPlatform">
                      <CreatorConnectorIcon platform={link.platform} />
                      <strong>{connectorLabel(link.platform)}</strong>
                    </span>
                    <input
                      autoComplete="url"
                      disabled={saving}
                      onChange={(event) =>
                        setLinks((current) =>
                          current.map((item) =>
                            item.platform === link.platform
                              ? { ...item, url: event.target.value }
                              : item,
                          ),
                        )
                      }
                      placeholder={
                        creatorConnectors.find(
                          ({ platform }) => platform === link.platform,
                        )?.placeholder
                      }
                      required
                      type="url"
                      value={link.url}
                    />
                  </label>
                  <div className="creatorConnectorActions">
                    <button
                      aria-label={`Remove ${connectorLabel(link.platform)}`}
                      disabled={saving}
                      onClick={() =>
                        setLinks((current) =>
                          current.filter(({ platform }) => platform !== link.platform),
                        )
                      }
                      type="button"
                    >
                      <Trash2 aria-hidden="true" size={16} />
                    </button>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="creatorConnectorEmpty">No connectors yet. Add one below.</p>
          )}
          <div className="creatorConnectorChoices" aria-label="Add a connector">
            {creatorConnectors
              .filter(({ platform }) => !links.some((link) => link.platform === platform))
              .map(({ label, platform }) => (
                <button
                  disabled={saving}
                  key={platform}
                  onClick={() => {
                    setLinks((current) => [...current, { platform, url: '' }]);
                    setError('');
                    setNotice('');
                  }}
                  type="button"
                >
                  <CreatorConnectorIcon platform={platform} />
                  <span>{label}</span>
                  <Plus aria-hidden="true" size={15} />
                </button>
              ))}
          </div>
          {error ? (
            <p className="formError" role="alert">
              {error}
            </p>
          ) : null}
          {notice ? (
            <p className="formSuccess" role="status">
              {notice}
            </p>
          ) : null}
          <button className="button primary" disabled={saving} type="submit">
            {saving ? 'Saving…' : 'Save connectors'}
          </button>
        </form>
      )}
    </section>
  );
}

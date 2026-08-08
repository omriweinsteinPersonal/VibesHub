'use client';

import type { CreatorDiscountCode } from '@vibeshub/contracts';
import Link from 'next/link';
import { useCallback, useEffect, useState, type FormEvent } from 'react';

import { apiCollectionRequest, apiRequest } from '../../../lib/api';

interface EditorState {
  code: string;
  detailsHe: string;
  expiresAt: string;
  label: string;
  merchantUrl: string;
  startsAt: string;
}

const emptyEditor: EditorState = {
  code: '',
  detailsHe: '',
  expiresAt: '',
  label: '',
  merchantUrl: '',
  startsAt: '',
};

export default function CreatorDiscountCodesPage() {
  const [codes, setCodes] = useState<CreatorDiscountCode[]>([]);
  const [editor, setEditor] = useState<EditorState>(emptyEditor);
  const [editing, setEditing] = useState<CreatorDiscountCode | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const page = await apiCollectionRequest<CreatorDiscountCode>(
        '/creator/discount-codes',
      );
      setCodes(page.data);
    } catch (cause) {
      setError(messageFor(cause));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void apiCollectionRequest<CreatorDiscountCode>('/creator/discount-codes')
      .then((page) => {
        if (active) setCodes(page.data);
      })
      .catch((cause: unknown) => {
        if (active) setError(messageFor(cause));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    const body = JSON.stringify({
      code: editor.code,
      detailsHe: editor.detailsHe.trim() || null,
      expiresAt: toIso(editor.expiresAt),
      label: editor.label.trim() || null,
      merchantUrl: editor.merchantUrl,
      startsAt: toIso(editor.startsAt),
    });
    try {
      if (editing) {
        await apiRequest<CreatorDiscountCode>(`/creator/discount-codes/${editing.id}`, {
          body,
          headers: { 'if-match': `"${editing.version}"` },
          method: 'PATCH',
        });
        setNotice('Discount code updated. Reconfirm it if its terms changed.');
      } else {
        await apiRequest<CreatorDiscountCode>('/creator/discount-codes', {
          body,
          idempotent: true,
          method: 'POST',
        });
        setNotice('Draft discount code created. Confirm it before publishing.');
      }
      cancelEditing();
      await load();
    } catch (cause) {
      setError(messageFor(cause));
    } finally {
      setSaving(false);
    }
  }

  async function transition(
    code: CreatorDiscountCode,
    command: 'archive' | 'confirm' | 'hide',
  ) {
    if (
      command === 'archive' &&
      !window.confirm('Archive this discount code? It will leave your storefront.')
    ) {
      return;
    }
    setError('');
    setNotice('');
    try {
      await apiRequest<CreatorDiscountCode>(
        `/creator/discount-codes/${code.id}/${command}`,
        {
          headers: { 'if-match': `"${code.version}"` },
          idempotent: true,
          method: 'POST',
        },
      );
      setNotice(
        command === 'confirm'
          ? 'Code confirmed and published.'
          : command === 'hide'
            ? 'Code hidden from your storefront.'
            : 'Code archived.',
      );
      if (editing?.id === code.id) cancelEditing();
      await load();
    } catch (cause) {
      setError(messageFor(cause));
    }
  }

  function beginEditing(code: CreatorDiscountCode) {
    setEditing(code);
    setEditor({
      code: code.code,
      detailsHe: code.details?.value ?? '',
      expiresAt: toLocalDateTime(code.expiresAt),
      label: code.label ?? '',
      merchantUrl: code.merchantUrl,
      startsAt: toLocalDateTime(code.startsAt),
    });
    window.scrollTo({ behavior: 'smooth', top: 0 });
  }

  function cancelEditing() {
    setEditing(null);
    setEditor(emptyEditor);
  }

  function update<K extends keyof EditorState>(key: K, value: EditorState[K]) {
    setEditor((current) => ({ ...current, [key]: value }));
  }

  return (
    <main className="workspacePage">
      <header className="workspaceHeader creatorStudioHeader">
        <Link className="logo" href="/">
          <span>✣</span> VibesHub
        </Link>
        <nav aria-label="Creator studio navigation">
          <Link href="/account">Account</Link>
          <Link href="/creator/profile">Profile</Link>
          <Link href="/creator/recommendations">Recommendations</Link>
          <Link aria-current="page" href="/creator/discount-codes">
            Discount codes
          </Link>
          <Link href="/creator/analytics">Analytics</Link>
          <Link href="/creators">Storefronts</Link>
        </nav>
      </header>

      <section className="workspaceContent creatorStudio discountStudio">
        <div className="studioIntro">
          <div>
            <p className="eyebrow">CREATOR STUDIO</p>
            <h1>Discount codes</h1>
            <p className="workspaceLead">
              Keep every code, validity window and verification date in one truthful
              source of record.
            </p>
          </div>
          <Link className="button secondary" href="/creator/recommendations">
            Manage recommendations
          </Link>
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

        <form className="applicationForm discountCodeForm" onSubmit={save}>
          <div className="formHeading">
            <div>
              <p className="eyebrow">{editing ? 'EDIT CODE' : 'NEW CODE'}</p>
              <h2>{editing ? `Update ${editing.code}` : 'Add a discount code'}</h2>
            </div>
            {editing ? (
              <button className="button secondary" onClick={cancelEditing} type="button">
                Cancel editing
              </button>
            ) : null}
          </div>

          <label>
            Merchant or brand website
            <input
              maxLength={2048}
              onChange={(event) => update('merchantUrl', event.target.value)}
              placeholder="https://brand.co.il"
              required
              type="url"
              value={editor.merchantUrl}
            />
            <span className="fieldHint">
              Use the HTTPS homepage where shoppers can redeem the code.
            </span>
          </label>

          <div className="fieldGrid">
            <label>
              Code
              <input
                autoCapitalize="characters"
                maxLength={50}
                onChange={(event) => update('code', event.target.value.toUpperCase())}
                placeholder="NOA10"
                required
                value={editor.code}
              />
            </label>
            <label>
              Discount label
              <input
                maxLength={100}
                onChange={(event) => update('label', event.target.value)}
                placeholder="10% off"
                value={editor.label}
              />
            </label>
          </div>

          <label>
            Details in Hebrew
            <textarea
              dir="rtl"
              lang="he"
              maxLength={1000}
              onChange={(event) => update('detailsHe', event.target.value)}
              placeholder="עשרה אחוזי הנחה על כל האתר"
              rows={4}
              value={editor.detailsHe}
            />
          </label>

          <div className="fieldGrid">
            <label>
              Starts at
              <input
                onChange={(event) => update('startsAt', event.target.value)}
                type="datetime-local"
                value={editor.startsAt}
              />
            </label>
            <label>
              Expires at
              <input
                onChange={(event) => update('expiresAt', event.target.value)}
                type="datetime-local"
                value={editor.expiresAt}
              />
            </label>
          </div>

          <button className="button primary studioSave" disabled={saving} type="submit">
            {saving ? 'Saving…' : editing ? 'Save changes' : 'Save draft'}
          </button>
        </form>

        <section className="studioCollection" aria-labelledby="discount-list-title">
          <div className="directoryHeading">
            <div>
              <p className="eyebrow">YOUR CODES</p>
              <h2 id="discount-list-title">Storefront discounts</h2>
            </div>
            <p>Creator confirmation stays fresh for 30 days.</p>
          </div>

          {loading ? <p className="queueLoading">Loading discount codes…</p> : null}
          {!loading && codes.length === 0 ? (
            <div className="directoryState">
              <h3>No discount codes yet</h3>
              <p>Create a draft above, check its terms, then confirm it.</p>
            </div>
          ) : null}

          <div className="discountCodeGrid">
            {codes.map((code) => (
              <article className="workspaceCard discountCodeCard" key={code.id}>
                <div className="studioStatusRow">
                  <span className={`statusPill ${code.lifecycle}`}>{code.lifecycle}</span>
                  <span>{verificationLabel(code.verificationStatus)}</span>
                </div>
                <p className="productBrand">{code.merchantHostname}</p>
                <h3>{code.code}</h3>
                {code.label ? <p className="discountCodeLabel">{code.label}</p> : null}
                {code.details ? (
                  <p className="discountCodeDetails" dir="rtl" lang="he">
                    {code.details.value}
                  </p>
                ) : null}
                <dl className="discountCodeFacts">
                  <div>
                    <dt>Expires</dt>
                    <dd>{formatDate(code.expiresAt) ?? 'No expiry'}</dd>
                  </div>
                  <div>
                    <dt>Last confirmed</dt>
                    <dd>{formatDate(code.lastVerifiedAt) ?? 'Not confirmed'}</dd>
                  </div>
                </dl>
                <div className="studioActions">
                  {code.lifecycle !== 'archived' ? (
                    <button
                      className="button secondary"
                      onClick={() => beginEditing(code)}
                      type="button"
                    >
                      Edit
                    </button>
                  ) : null}
                  {code.lifecycle !== 'published' && code.lifecycle !== 'archived' ? (
                    <button
                      className="button primary"
                      onClick={() => void transition(code, 'confirm')}
                      type="button"
                    >
                      Confirm &amp; publish
                    </button>
                  ) : null}
                  {code.lifecycle === 'published' ? (
                    <button
                      className="button secondary"
                      onClick={() => void transition(code, 'hide')}
                      type="button"
                    >
                      Hide
                    </button>
                  ) : null}
                  {code.lifecycle !== 'archived' ? (
                    <button
                      className="button danger"
                      onClick={() => void transition(code, 'archive')}
                      type="button"
                    >
                      Archive
                    </button>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}

function toIso(value: string): string | null {
  return value ? new Date(value).toISOString() : null;
}

function toLocalDateTime(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function formatDate(value: string | null): string | null {
  return value
    ? new Intl.DateTimeFormat('en-IL', { dateStyle: 'medium' }).format(new Date(value))
    : null;
}

function verificationLabel(status: CreatorDiscountCode['verificationStatus']): string {
  return {
    creator_confirmed: 'Creator confirmed',
    failed: 'Verification failed',
    merchant_verified: 'Merchant verified',
    staff_confirmed: 'Staff confirmed',
    stale: 'Needs reconfirmation',
    unverified: 'Not yet confirmed',
  }[status];
}

function messageFor(cause: unknown): string {
  return cause instanceof Error ? cause.message : 'The request could not be completed.';
}

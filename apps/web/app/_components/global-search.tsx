'use client';

import type { GlobalSearchResults } from '@vibeshub/contracts';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useId, useRef, useState } from 'react';

import { getApiUrl } from '../../lib/config';

const EMPTY_RESULTS: GlobalSearchResults = { creators: [], products: [] };

export function GlobalSearch() {
  const resultsId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GlobalSearchResults>(EMPTY_RESULTS);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    inputRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  useEffect(() => {
    const normalizedQuery = query.trim();
    if (!open || normalizedQuery.length < 2) {
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      const parameters = new URLSearchParams({ limit: '5', q: normalizedQuery });
      void fetch(`${getApiUrl()}/v1/search?${parameters}`, {
        signal: controller.signal,
      })
        .then(async (response) => {
          const body = (await response.json()) as {
            data?: GlobalSearchResults;
            detail?: string;
          };
          if (!response.ok || !body.data) {
            throw new Error(body.detail ?? 'Search is temporarily unavailable.');
          }
          setResults(body.data);
          setStatus('ready');
        })
        .catch((cause: unknown) => {
          if (cause instanceof DOMException && cause.name === 'AbortError') return;
          setResults(EMPTY_RESULTS);
          setStatus('error');
        });
    }, 220);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [open, query]);

  const normalizedQuery = query.trim();
  const hasResults = results.creators.length > 0 || results.products.length > 0;
  const close = () => setOpen(false);

  return (
    <>
      <button
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label="Search creators and products"
        className="searchTrigger"
        type="button"
        onClick={() => {
          setOpen(true);
          if (query.trim().length >= 2) setStatus('loading');
        }}
      >
        <SearchIcon />
      </button>

      {open ? (
        <div
          className="searchModalBackdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) close();
          }}
        >
          <section
            aria-label="Search VibesHub"
            aria-modal="true"
            className="searchModal"
            role="dialog"
          >
            <header>
              <div>
                <p className="eyebrow">SEARCH VIBESHUB</p>
                <h2>Find creators and products</h2>
              </div>
              <button
                aria-label="Close search"
                className="searchClose"
                type="button"
                onClick={close}
              >
                ×
              </button>
            </header>

            <label className="searchModalInput" htmlFor={`${resultsId}-input`}>
              <SearchIcon />
              <input
                aria-controls={resultsId}
                aria-expanded={normalizedQuery.length >= 2}
                autoComplete="off"
                id={`${resultsId}-input`}
                placeholder="Search a creator, product or brand…"
                ref={inputRef}
                role="combobox"
                type="search"
                value={query}
                onChange={(event) => {
                  const nextQuery = event.target.value;
                  setQuery(nextQuery);
                  if (nextQuery.trim().length < 2) {
                    setResults(EMPTY_RESULTS);
                    setStatus('idle');
                  } else {
                    setStatus('loading');
                  }
                }}
              />
            </label>

            <div aria-live="polite" className="searchModalResults" id={resultsId}>
              {normalizedQuery.length < 2 ? (
                <p className="searchHint">
                  Type at least two characters to start searching.
                </p>
              ) : status === 'loading' ? (
                <p className="searchHint">Searching…</p>
              ) : status === 'error' ? (
                <p className="searchHint" role="status">
                  Search is temporarily unavailable. Please try again.
                </p>
              ) : status === 'ready' && !hasResults ? (
                <p className="searchHint">
                  No creators or products match “{normalizedQuery}”.
                </p>
              ) : (
                <>
                  {results.creators.length > 0 ? (
                    <div className="searchResultGroup">
                      <p>Creators</p>
                      {results.creators.map((creator) => (
                        <Link
                          className="creatorSearchResult"
                          href={`/creators/${creator.handle}`}
                          key={creator.id}
                          onClick={close}
                        >
                          <span aria-hidden="true">{initials(creator.displayName)}</span>
                          <div>
                            <strong>
                              {creator.displayName}
                              {creator.verificationStatus === 'verified' ? ' ✓' : ''}
                            </strong>
                            <small>
                              @{creator.handle} · {creator.primaryCategory.name}
                            </small>
                          </div>
                        </Link>
                      ))}
                    </div>
                  ) : null}

                  {results.products.length > 0 ? (
                    <div className="searchResultGroup">
                      <p>Products</p>
                      {results.products.map((product) => (
                        <Link
                          className="productSearchResult"
                          href={`/discover?q=${encodeURIComponent(product.productName)}`}
                          key={product.productId}
                          onClick={close}
                        >
                          <span className="productSearchImage">
                            <Image
                              alt=""
                              fill
                              sizes="64px"
                              src={product.imageUrl}
                              unoptimized
                            />
                          </span>
                          <div>
                            <small>{product.brandName}</small>
                            <strong>{product.productName}</strong>
                            <span>Recommended by {product.creator.displayName}</span>
                          </div>
                          <b>{formatIls(product.price.amountMinor)}</b>
                        </Link>
                      ))}
                    </div>
                  ) : null}
                </>
              )}
            </div>

            {normalizedQuery.length >= 2 ? (
              <Link
                className="searchAllLink"
                href={`/discover?q=${encodeURIComponent(normalizedQuery)}`}
                onClick={close}
              >
                See all product results <span aria-hidden="true">→</span>
              </Link>
            ) : null}
          </section>
        </div>
      ) : null}
    </>
  );
}

function SearchIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="20" viewBox="0 0 24 24" width="20">
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="m16 16 4 4"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function formatIls(amountMinor: number): string {
  return new Intl.NumberFormat('he-IL', {
    currency: 'ILS',
    maximumFractionDigits: amountMinor % 100 === 0 ? 0 : 2,
    style: 'currency',
  }).format(amountMinor / 100);
}

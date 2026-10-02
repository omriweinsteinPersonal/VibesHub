import { createElement as h, Fragment } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { defaultStorefrontTheme } from '@vibeshub/contracts';
import { describe, it, expect } from 'vitest';
import { StorefrontLayout, StorefrontRegion, StorefrontSlot } from './storefront-layout';

describe('public storefront layout rendering', () => {
  it('renders saved DOM order, nested brand slots, and social links without editor controls', () => {
    const markup = renderToStaticMarkup(
      h(StorefrontLayout, {
        creatorId: 'test',
        editable: false,
        onTheme: () => undefined,
        theme: {
          ...defaultStorefrontTheme,
          layout: { blocks: ['brand:a', 'social:instagram', 'bio'], labels: [] },
        },
        children: [
          h(StorefrontRegion, {
            key: 'profile',
            children: [
              h(StorefrontSlot, {
                id: 'bio',
                label: 'Bio',
                children: h('p', null, 'MY_BIO'),
                key: 'bio',
              }),
              h(StorefrontSlot, {
                id: 'social:instagram',
                label: 'Instagram',
                kind: 'social',
                children: h('a', { href: 'https://instagram.com' }, 'MY_SOCIAL'),
                key: 'social',
              }),
            ],
          }),
          h(
            Fragment,
            { key: 'brands' },
            h(StorefrontSlot, {
              id: 'brand:a',
              label: 'Brand',
              children: h('h2', null, 'MY_BRAND'),
            }),
          ),
        ],
      }),
    );
    expect(markup.indexOf('MY_BRAND')).toBeLessThan(markup.indexOf('MY_SOCIAL'));
    expect(markup.indexOf('MY_SOCIAL')).toBeLessThan(markup.indexOf('MY_BIO'));
    expect(markup).not.toContain('Drag the dotted');
    expect(markup).not.toContain('data-sort-key');
  });
  it('reorders label buttons without changing their links or hiding All', () => {
    const markup = renderToStaticMarkup(
      h(StorefrontLayout, {
        creatorId: 'test',
        editable: false,
        onTheme: () => undefined,
        theme: {
          ...defaultStorefrontTheme,
          layout: { blocks: ['labels'], labels: ['b', 'a'] },
        },
        children: h(StorefrontSlot, {
          id: 'labels',
          label: 'Labels',
          children: h(
            'nav',
            null,
            h('button', null, 'All'),
            h('button', { 'data-label-id': 'a' }, 'CLOSET'),
            h('button', { 'data-label-id': 'b' }, 'HOME'),
          ),
        }),
      }),
    );
    expect(markup.indexOf('All')).toBeLessThan(markup.indexOf('HOME'));
    expect(markup.indexOf('HOME')).toBeLessThan(markup.indexOf('CLOSET'));
  });
  it('omits a hidden utility block without changing the other saved blocks', () => {
    const markup = renderToStaticMarkup(
      h(StorefrontLayout, {
        creatorId: 'test',
        editable: false,
        onTheme: () => undefined,
        theme: {
          ...defaultStorefrontTheme,
          layout: {
            blocks: ['search', 'bio'],
            labels: [],
            hiddenBlocks: ['search'],
          },
        },
        children: [
          h(StorefrontSlot, {
            id: 'search',
            label: 'Search',
            children: h('div', null, 'SEARCH_FIELD'),
            key: 'search',
          }),
          h(StorefrontSlot, {
            id: 'bio',
            label: 'Bio',
            children: h('p', null, 'MY_BIO'),
            key: 'bio',
          }),
        ],
      }),
    );
    expect(markup).not.toContain('SEARCH_FIELD');
    expect(markup).toContain('MY_BIO');
  });
});

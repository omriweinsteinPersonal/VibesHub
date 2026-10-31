import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import HomePage from './page';

describe('Swavii homepage', () => {
  it('shows the approved message, truthful example analytics and current pricing', () => {
    const html = renderToStaticMarkup(createElement(HomePage));
    expect(html).toContain('Your World,');
    expect(html).toContain('curated in one place.');
    expect(html).toContain('Collection views');
    expect(html).toContain('Illustrative data');
    expect(html).toContain('First month free');
    expect(html).toContain('$12');
    expect(html).not.toMatch(/earnings|Average order|testimonial/i);
  });

  it('renders the Rotem phone storefront example', () => {
    const html = renderToStaticMarkup(createElement(HomePage));
    const rotem = html.match(
      /aria-label="Rotem Cohen, example creator page"[\s\S]*?aria-label="Mia Chen, example creator page"/,
    )?.[0];
    expect(rotem).toBeDefined();
    expect(rotem).toContain('rotem-phone-preview.jpg');
    expect(rotem).toContain('Rotem Smith&#x27;s creator storefront preview');
    expect(html).not.toContain('Examples of pages you can make your own.');
  });

  it('offers signup and manual recommendation walkthrough navigation', () => {
    const html = renderToStaticMarkup(createElement(HomePage));
    expect(html).toContain('action="/auth"');
    expect(html).toContain('name="mode" value="signup"');
    expect(html).toContain('Next walkthrough step');
    expect(html).toContain('Previous walkthrough step');
    expect(html).toContain('/auth?mode=signup');
    expect(html).toContain('Mobile navigation');
    expect(html).toContain('Add a recommendation');
    expect(html).toContain('Paste a product link');
    expect(html).toContain('Fetch the details');
    expect(html).toContain('See it on your storefront');
    expect(html).toContain('Arrange sections');
    expect(html).toContain('Your colors. Your atmosphere.');
    expect(html).toContain('Organize picks your way.');
  });
});

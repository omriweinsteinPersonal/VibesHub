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

  it('renders Rotem’s complete example storefront', () => {
    const html = renderToStaticMarkup(createElement(HomePage));
    const rotem = html.match(
      /aria-label="Rotem Cohen, example creator page"[\s\S]*?aria-label="Mia Chen, example creator page"/,
    )?.[0];
    expect(rotem).toBeDefined();
    for (const item of [
      'Softline Dress',
      'Daylight Denim',
      'Luna Structured Bag',
      'Dune Sunglasses',
    ])
      expect(rotem).toContain(item);
    expect(rotem).toContain('Rotem Cohen&#x27;s Style Notes');
    expect(html).toContain('Examples of pages you can make your own.');
  });

  it('offers signup, mobile carousel controls and manual walkthrough navigation', () => {
    const html = renderToStaticMarkup(createElement(HomePage));
    expect(html).toContain('action="/auth"');
    expect(html).toContain('name="mode" value="signup"');
    expect(html).toContain('Show Rotem Cohen&#x27;s page');
    expect(html).toContain('Next walkthrough step');
    expect(html).toContain('Previous walkthrough step');
    expect(html).toContain('/auth?mode=signup');
    expect(html).toContain('Mobile navigation');
    expect(html).toContain('Photo gallery');
    expect(html).toContain('Social links');
    expect(html).toContain('Arrange sections');
    expect(html).toContain('Things worth sharing.');
    expect(html).toContain('A slow morning at home');
    expect(html).toContain('Selected favorites');
  });
});

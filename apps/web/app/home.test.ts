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

  it('preserves Daniel’s four products and the distinct collection examples', () => {
    const html = renderToStaticMarkup(createElement(HomePage));
    const daniel = html.match(
      /aria-label="Daniel Parks, example creator page"[\s\S]*?<\/article>/,
    )?.[0];
    expect(daniel).toBeDefined();
    for (const item of ['Compact camera', 'Table lamp', 'Lounge chair', 'Ceramic mug'])
      expect(daniel).toContain(item);
    expect(daniel).not.toContain('The Everyday Edit');
    expect(html).toContain('The Everyday Edit');
    expect(html).toContain('Sunday table');
    expect(html).toContain('Examples of pages you can make your own.');
  });

  it('offers signup, mobile carousel controls and manual walkthrough navigation', () => {
    const html = renderToStaticMarkup(createElement(HomePage));
    expect(html).toContain('action="/auth"');
    expect(html).toContain('name="mode" value="signup"');
    expect(html).toContain('Show Daniel Parks');
    expect(html).toContain('Next walkthrough step');
    expect(html).toContain('Previous walkthrough step');
    expect(html).toContain('/auth?mode=signup');
    expect(html).toContain('Mobile navigation');
    expect(html).toContain('Photo gallery');
    expect(html).toContain('Instagram post');
    expect(html).toContain('Arrange sections');
    expect(html).toContain('Things worth sharing.');
    expect(html).toContain('A slow morning at home');
    expect(html).toContain('Selected favorites');
  });
});

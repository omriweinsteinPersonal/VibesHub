import { defaultStorefrontTheme } from '@vibeshub/contracts';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { StorefrontPhonePreview } from './storefront-phone-preview';

describe('StorefrontPhonePreview', () => {
  it('opens the creator workspace in visitor preview with the phone visible', () => {
    const markup = renderToStaticMarkup(
      <StorefrontPhonePreview
        contentTargets={[]}
        creatorId="creator-1"
        editable
        previewUrl="/creator-name?mobilePreview=1"
        theme={defaultStorefrontTheme}
        title="Creator storefront"
      >
        <p>Public page</p>
      </StorefrontPhonePreview>,
    );

    expect(markup).toContain('aria-pressed="true"');
    expect(markup).toContain('Preview</button>');
    expect(markup).toContain('Edit page</button>');
    expect(markup).toContain('storefrontPhoneDevice');
    expect(markup).toContain('src="/creator-name?mobilePreview=1"');
    expect(markup).not.toContain('class="storefrontDesignPanel"');
    expect(markup).not.toContain('See your page as visitors do');
    expect(markup).not.toContain('hasEditor');
  });
});

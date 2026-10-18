export const siteName = 'Swavii';
export const siteUrl = 'https://swavii.com';
export const siteDescription =
  'Build a customizable creator page for recommendations, collections, links, photos and videos — all in one place.';

export const websiteStructuredData = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: siteName,
  alternateName: ['swavii', 'Swavii.com'],
  url: `${siteUrl}/`,
} as const;

export const organizationStructuredData = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: siteName,
  url: `${siteUrl}/`,
  logo: `${siteUrl}/icon.svg`,
  sameAs: ['https://www.instagram.com/swavii_/'],
} as const;

const merchantNames: Record<string, string> = {
  adidas: 'Adidas',
  'foodappeal-online': 'Food Appeal',
  fox: 'Fox',
  terminalx: 'Terminal X',
  weshoes: 'WeShoes',
};

export function merchantNameFromHostname(hostname: string, fallback: string): string {
  const labels = hostname
    .toLowerCase()
    .replace(/^www\./u, '')
    .split('.');
  const publicSuffix = labels.at(-1) ?? '';
  const secondLevel = labels.at(-2) ?? '';
  const countryCodeDomain =
    publicSuffix.length === 2 &&
    ['ac', 'co', 'com', 'gov', 'net', 'org'].includes(secondLevel);
  const identity = countryCodeDomain ? labels.at(-3) : secondLevel || labels[0];
  if (!identity) return fallback;
  return (
    merchantNames[identity] ??
    identity
      .split(/[-_]/u)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ')
  );
}

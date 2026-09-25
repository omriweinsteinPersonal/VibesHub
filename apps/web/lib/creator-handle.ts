export const creatorHandlePattern = /^[a-z0-9][a-z0-9_-]{1,29}$/;

const hebrewTransliteration: Record<string, string> = {
  א: 'a',
  ב: 'b',
  ג: 'g',
  ד: 'd',
  ה: 'h',
  ו: 'v',
  ז: 'z',
  ח: 'h',
  ט: 't',
  י: 'y',
  כ: 'k',
  ך: 'k',
  ל: 'l',
  מ: 'm',
  ם: 'm',
  נ: 'n',
  ן: 'n',
  ס: 's',
  ע: 'a',
  פ: 'p',
  ף: 'p',
  צ: 'ts',
  ץ: 'ts',
  ק: 'k',
  ר: 'r',
  ש: 'sh',
  ת: 't',
};

export function normalizeCreatorHandle(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9_-]/g, '')
    .replace(/^[^a-z0-9]+/, '')
    .slice(0, 30);
}

export function suggestCreatorHandle(displayName: string): string {
  const transliterated = [...displayName]
    .map((character) => hebrewTransliteration[character] ?? character)
    .join('');
  const normalized = normalizeCreatorHandle(transliterated);
  return normalized.length >= 2 ? normalized : '';
}

export function isCreatorHandle(value: string): boolean {
  return creatorHandlePattern.test(value);
}

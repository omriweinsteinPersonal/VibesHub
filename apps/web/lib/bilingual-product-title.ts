const hebrew = /[\u0590-\u05ff]/u;
const latin = /[A-Za-z]/u;
const separator = /^[|/\-\u2013\u2014]+$/u;

export function splitBilingualProductTitle(title: string) {
  if (!hebrew.test(title) || !latin.test(title)) return null;

  const english: string[] = [];
  const hebrewWords: string[] = [];
  let previous: 'en' | 'he' = title.search(hebrew) < title.search(latin) ? 'he' : 'en';

  for (const word of title.trim().split(/\s+/u)) {
    if (separator.test(word)) continue;
    if (hebrew.test(word) && latin.test(word)) {
      let previousPart: 'en' | 'he' | null = null;
      for (const part of word.match(
        /[\u0590-\u05ff]+|[A-Za-z]+|[0-9]+|[^\u0590-\u05ffA-Za-z0-9]+/gu,
      ) ?? []) {
        if (!hebrew.test(part) && !latin.test(part) && !/[0-9]/u.test(part)) continue;
        if (hebrew.test(part)) previous = 'he';
        else if (latin.test(part)) previous = 'en';
        const words = previous === 'he' ? hebrewWords : english;
        if (previousPart === previous && words.length) words[words.length - 1] += part;
        else words.push(part);
        previousPart = previous;
      }
      continue;
    }
    if (hebrew.test(word)) previous = 'he';
    else if (latin.test(word)) previous = 'en';
    (previous === 'he' ? hebrewWords : english).push(word);
  }

  if (!english.length || !hebrewWords.length) return null;
  return { english: english.join(' '), hebrew: hebrewWords.join(' ') };
}

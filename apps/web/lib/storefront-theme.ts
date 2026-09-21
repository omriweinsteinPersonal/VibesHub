export function contrastRatio(first: string, second: string) {
  const luminance = (color: string) => {
    const channels = [1, 3, 5].map((start) => parseInt(color.slice(start, start + 2), 16) / 255);
    const linear = channels.map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    return (linear[0] ?? 0) * 0.2126 + (linear[1] ?? 0) * 0.7152 + (linear[2] ?? 0) * 0.0722;
  };
  const a = luminance(first);
  const b = luminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

export function textOnAccent(accent: string) {
  return contrastRatio(accent, '#ffffff') >= 4.5 ? '#ffffff' : '#1d1916';
}

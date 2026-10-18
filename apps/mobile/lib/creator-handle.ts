const creatorHandlePattern = /^(?=.{2,100}$)(?!.*[/?#%\\\p{Cc}]).+$/u;

export type CreatorHandleStatus =
  'idle' | 'checking' | 'available' | 'unavailable' | 'invalid';

export function isCreatorHandle(value: string): boolean {
  return creatorHandlePattern.test(value.trim());
}

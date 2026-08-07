import { Injectable } from '@nestjs/common';

export interface VideoPreviewProvider {
  normalizeExternalPreviewUrl(url: string | null): string | null;
}

@Injectable()
export class DeferredVideoPreviewProvider implements VideoPreviewProvider {
  normalizeExternalPreviewUrl(url: string | null): string | null {
    if (!url) return null;
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') throw new Error('Video previews require HTTPS');
    return parsed.toString();
  }
}

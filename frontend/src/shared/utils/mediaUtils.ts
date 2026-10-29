/**
 * Media utility functions for robust video/image/audio detection and fallback resolution.
 */

export const DEFAULT_FALLBACK_VIDEO_URL =
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4';

export const DEFAULT_FALLBACK_THUMBNAIL_URL =
  'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800';

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg', '.bmp', '.tiff', '.exr', '.hdr'];
const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.ogg', '.mov', '.m4v', '.mkv'];
const AUDIO_EXTENSIONS = ['.mp3', '.wav', '.ogg', '.aac', '.flac', '.m4a'];

/**
 * Checks if a given URL points to a known image resource
 */
export function isImageUrl(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false;
  const cleanUrl = url.trim().toLowerCase();
  if (cleanUrl.includes('images.unsplash.com') || cleanUrl.includes('unsplash.com/photo-')) {
    return true;
  }
  return IMAGE_EXTENSIONS.some((ext) => cleanUrl.includes(ext));
}

/**
 * Checks if a given URL points to a valid video stream
 */
export function isVideoUrl(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false;
  const cleanUrl = url.trim().toLowerCase();
  if (isImageUrl(cleanUrl)) return false;
  if (cleanUrl.includes('gtv-videos-bucket') || cleanUrl.includes('.mp4') || cleanUrl.includes('.webm')) {
    return true;
  }
  return VIDEO_EXTENSIONS.some((ext) => cleanUrl.includes(ext));
}

/**
 * Resolves a safe video URL, returning a valid video stream or fallback
 */
export function resolveSafeVideoUrl(url?: string | null, fallbackUrl: string = DEFAULT_FALLBACK_VIDEO_URL): string {
  if (!url || typeof url !== 'string' || !url.trim()) {
    return fallbackUrl;
  }
  if (isImageUrl(url)) {
    return fallbackUrl;
  }
  return url;
}

/**
 * Informs whether media type should be treated as image instead of video
 */
export function inferMediaType(url?: string | null, explicitType?: string): 'video' | 'image' | 'audio' | 'sequence' {
  if (explicitType === 'audio') return 'audio';
  if (explicitType === 'sequence') return 'sequence';
  if (isImageUrl(url)) return 'image';
  if (isVideoUrl(url)) return 'video';
  if (explicitType === 'image') return 'image';
  return 'video';
}

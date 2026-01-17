/**
 * Image Generation Service for Koe
 *
 * Provides a unified interface for generating images from text prompts.
 * Supports multiple providers: OpenAI DALL-E (default), Stability AI, Replicate.
 *
 * Features:
 * - Configurable provider selection
 * - Local IndexedDB caching for generated images
 * - Graceful error handling with fallbacks
 */

import type {
  ImageProvider,
  ImageSize,
  ImageStyle,
  ImageQuality,
  ImageGenerationConfig,
  GeneratedImage,
  ImageCacheEntry,
} from '../models/types';
import { getApiKey, useSettingsStore } from '../store/settingsStore';

// Helper functions to get API keys (checks store first, then env vars)
const getOpenAIKey = () => getApiKey('openai');
const getStabilityKey = () => getApiKey('stability');
const getReplicateKey = () => getApiKey('replicate');
const getFalKey = () => getApiKey('fal');

// Default configuration
const DEFAULT_CONFIG: ImageGenerationConfig = {
  provider: 'openai',
  model: 'dall-e-3',
  size: '1024x1024',
  style: 'vivid',
  quality: 'standard',
};

// Current configuration (can be changed at runtime)
let currentConfig: ImageGenerationConfig = { ...DEFAULT_CONFIG };

// Cache settings
const CACHE_DB_NAME = 'koe-image-cache';
const CACHE_STORE_NAME = 'images';
const CACHE_EXPIRY_HOURS = 24 * 7; // 7 days

// IndexedDB instance
let cacheDb: IDBDatabase | null = null;

/**
 * Initialize the IndexedDB cache
 */
async function initCache(): Promise<IDBDatabase> {
  if (cacheDb) return cacheDb;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(CACHE_DB_NAME, 1);

    request.onerror = () => reject(new Error('Failed to open image cache database'));

    request.onsuccess = () => {
      cacheDb = request.result;
      resolve(cacheDb);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(CACHE_STORE_NAME)) {
        const store = db.createObjectStore(CACHE_STORE_NAME, { keyPath: 'id' });
        store.createIndex('promptHash', 'promptHash', { unique: false });
        store.createIndex('expiresAt', 'expiresAt', { unique: false });
      }
    };
  });
}

/**
 * Generate a hash for a prompt string (for cache lookup)
 */
function hashPrompt(prompt: string, provider: ImageProvider, model: string): string {
  // Simple hash function for cache key
  let hash = 0;
  const str = `${provider}:${model}:${prompt}`;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString(16);
}

/**
 * Check cache for existing image
 */
async function getCachedImage(promptHash: string): Promise<ImageCacheEntry | null> {
  try {
    const db = await initCache();
    return new Promise((resolve) => {
      const transaction = db.transaction(CACHE_STORE_NAME, 'readonly');
      const store = transaction.objectStore(CACHE_STORE_NAME);
      const index = store.index('promptHash');
      const request = index.get(promptHash);

      request.onsuccess = () => {
        const entry = request.result as ImageCacheEntry | undefined;
        if (entry && new Date(entry.expiresAt) > new Date()) {
          resolve(entry);
        } else {
          resolve(null);
        }
      };

      request.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/**
 * Save image to cache
 */
async function cacheImage(entry: ImageCacheEntry): Promise<void> {
  try {
    const db = await initCache();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(CACHE_STORE_NAME, 'readwrite');
      const store = transaction.objectStore(CACHE_STORE_NAME);
      const request = store.put(entry);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to cache image'));
    });
  } catch (error) {
    console.warn('Failed to cache image:', error);
  }
}

/**
 * Clean up expired cache entries
 */
async function cleanExpiredCache(): Promise<void> {
  try {
    const db = await initCache();
    const now = new Date().toISOString();

    return new Promise((resolve) => {
      const transaction = db.transaction(CACHE_STORE_NAME, 'readwrite');
      const store = transaction.objectStore(CACHE_STORE_NAME);
      const index = store.index('expiresAt');
      const range = IDBKeyRange.upperBound(now);
      const request = index.openCursor(range);

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          resolve();
        }
      };

      request.onerror = () => resolve();
    });
  } catch {
    // Silently fail cache cleanup
  }
}

/**
 * Convert a URL image to base64
 */
async function urlToBase64(url: string): Promise<string> {
  const response = await fetch(url);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// ============================================================================
// Provider Implementations
// ============================================================================

/**
 * Generate image using OpenAI DALL-E API
 */
async function generateWithOpenAI(
  prompt: string,
  options: {
    model?: string;
    size?: ImageSize;
    style?: ImageStyle;
    quality?: ImageQuality;
  } = {}
): Promise<GeneratedImage> {
  const apiKey = getOpenAIKey();
  if (!apiKey) {
    throw new Error('OpenAI API key not configured. Set it in Settings or VITE_OPENAI_API_KEY in your .env file.');
  }

  const model = options.model || 'dall-e-3';
  const size = options.size || '1024x1024';
  const style = options.style || 'vivid';
  const quality = options.quality || 'standard';

  // DALL-E 2 has different size options
  const validSize = model === 'dall-e-2'
    ? (['256x256', '512x512', '1024x1024'].includes(size) ? size : '1024x1024')
    : size;

  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      prompt,
      n: 1,
      size: validSize,
      response_format: 'b64_json',
      ...(model === 'dall-e-3' && { style, quality }),
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      error.error?.message || `OpenAI API error: ${response.status} ${response.statusText}`
    );
  }

  const data = await response.json();
  const imageData = data.data[0];

  return {
    id: crypto.randomUUID(),
    prompt,
    base64: `data:image/png;base64,${imageData.b64_json}`,
    provider: 'openai',
    model,
    createdAt: new Date().toISOString(),
    cached: false,
  };
}

/**
 * Generate image using Stability AI API
 */
async function generateWithStability(
  prompt: string,
  options: {
    model?: string;
    size?: ImageSize;
  } = {}
): Promise<GeneratedImage> {
  const apiKey = getStabilityKey();
  if (!apiKey) {
    throw new Error('Stability API key not configured. Set it in Settings or VITE_STABILITY_API_KEY in your .env file.');
  }

  const model = options.model || 'stable-diffusion-xl-1024-v1-0';

  // Parse size to width/height
  const size = options.size || '1024x1024';
  const [width, height] = size.split('x').map(Number);

  const response = await fetch(
    `https://api.stability.ai/v1/generation/${model}/text-to-image`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        text_prompts: [{ text: prompt, weight: 1 }],
        cfg_scale: 7,
        height,
        width,
        samples: 1,
        steps: 30,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      error.message || `Stability API error: ${response.status} ${response.statusText}`
    );
  }

  const data = await response.json();
  const artifact = data.artifacts[0];

  return {
    id: crypto.randomUUID(),
    prompt,
    base64: `data:image/png;base64,${artifact.base64}`,
    provider: 'stability',
    model,
    createdAt: new Date().toISOString(),
    cached: false,
  };
}

/**
 * Generate image using Replicate API
 */
async function generateWithReplicate(
  prompt: string,
  options: {
    model?: string;
    size?: ImageSize;
  } = {}
): Promise<GeneratedImage> {
  const apiKey = getReplicateKey();
  if (!apiKey) {
    throw new Error('Replicate API key not configured. Set it in Settings or VITE_REPLICATE_API_KEY in your .env file.');
  }

  // Default to SDXL model
  const model = options.model || 'stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b';

  // Parse size to width/height
  const size = options.size || '1024x1024';
  const [width, height] = size.split('x').map(Number);

  // Create prediction
  const createResponse = await fetch('https://api.replicate.com/v1/predictions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Token ${apiKey}`,
    },
    body: JSON.stringify({
      version: model.includes(':') ? model.split(':')[1] : model,
      input: {
        prompt,
        width,
        height,
      },
    }),
  });

  if (!createResponse.ok) {
    const error = await createResponse.json().catch(() => ({}));
    throw new Error(
      error.detail || `Replicate API error: ${createResponse.status} ${createResponse.statusText}`
    );
  }

  const prediction = await createResponse.json();

  // Poll for completion (max 60 seconds)
  const maxWait = 60000;
  const pollInterval = 1000;
  let elapsed = 0;

  while (elapsed < maxWait) {
    const statusResponse = await fetch(prediction.urls.get, {
      headers: {
        'Authorization': `Token ${apiKey}`,
      },
    });

    if (!statusResponse.ok) {
      throw new Error(`Failed to check prediction status: ${statusResponse.status}`);
    }

    const status = await statusResponse.json();

    if (status.status === 'succeeded') {
      const imageUrl = Array.isArray(status.output) ? status.output[0] : status.output;

      // Convert URL to base64
      const base64 = await urlToBase64(imageUrl);

      return {
        id: crypto.randomUUID(),
        prompt,
        url: imageUrl,
        base64,
        provider: 'replicate',
        model,
        createdAt: new Date().toISOString(),
        cached: false,
      };
    }

    if (status.status === 'failed') {
      throw new Error(status.error || 'Image generation failed');
    }

    await new Promise((resolve) => setTimeout(resolve, pollInterval));
    elapsed += pollInterval;
  }

  throw new Error('Image generation timed out');
}

/**
 * Generate image using FAL.ai API
 *
 * FAL.ai offers fast, cheap image generation (~$0.01-0.02/image).
 * Uses Flux Schnell by default for sub-second generation.
 */
async function generateWithFal(
  prompt: string,
  options: {
    model?: string;
    size?: ImageSize;
  } = {}
): Promise<GeneratedImage> {
  const apiKey = getFalKey();
  if (!apiKey) {
    throw new Error('FAL API key not configured. Set it in Settings or VITE_FAL_API_KEY in your .env file.');
  }

  // Default to Flux Schnell (fastest, cheapest)
  // Other options: 'fal-ai/flux/dev', 'fal-ai/flux-pro'
  const model = options.model || 'fal-ai/flux/schnell';

  // Parse size to width/height
  const size = options.size || '1024x1024';
  const [width, height] = size.split('x').map(Number);

  const response = await fetch(`https://fal.run/${model}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Key ${apiKey}`,
    },
    body: JSON.stringify({
      prompt,
      image_size: {
        width,
        height,
      },
      num_inference_steps: 4, // Schnell uses fewer steps for speed
      num_images: 1,
      enable_safety_checker: true,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      error.detail || error.message || `FAL API error: ${response.status} ${response.statusText}`
    );
  }

  const data = await response.json();

  // FAL returns images array with url property
  const imageUrl = data.images?.[0]?.url;
  if (!imageUrl) {
    throw new Error('FAL API did not return an image URL');
  }

  // Convert URL to base64
  const base64 = await urlToBase64(imageUrl);

  return {
    id: crypto.randomUUID(),
    prompt,
    url: imageUrl,
    base64,
    provider: 'fal',
    model,
    createdAt: new Date().toISOString(),
    cached: false,
  };
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Configure the image generation service
 */
export function configureImageGen(config: Partial<ImageGenerationConfig>): void {
  currentConfig = { ...currentConfig, ...config };
}

/**
 * Get the current configuration
 */
export function getImageGenConfig(): ImageGenerationConfig {
  return { ...currentConfig };
}

/**
 * Check if image generation is available (API key configured)
 */
export function isImageGenAvailable(): boolean {
  // Use provider from settings store
  const provider = useSettingsStore.getState().imageProvider;
  switch (provider) {
    case 'openai':
      return Boolean(getOpenAIKey());
    case 'stability':
      return Boolean(getStabilityKey());
    case 'replicate':
      return Boolean(getReplicateKey());
    case 'fal':
      return Boolean(getFalKey());
    default:
      return false;
  }
}

/**
 * Generate an image from a text prompt
 */
export async function generateImage(
  prompt: string,
  options: Partial<ImageGenerationConfig> = {}
): Promise<GeneratedImage> {
  // Use provider from settings store if not specified in options
  const storeProvider = useSettingsStore.getState().imageProvider;
  const config = { ...currentConfig, provider: storeProvider, ...options };
  const promptHash = hashPrompt(prompt, config.provider, config.model || 'default');

  // Check cache first
  const cached = await getCachedImage(promptHash);
  if (cached) {
    return {
      id: cached.id,
      prompt,
      base64: cached.base64,
      provider: cached.provider,
      model: cached.model,
      createdAt: cached.createdAt,
      cached: true,
    };
  }

  // Generate new image based on provider
  let result: GeneratedImage;

  switch (config.provider) {
    case 'openai':
      result = await generateWithOpenAI(prompt, config);
      break;
    case 'stability':
      result = await generateWithStability(prompt, config);
      break;
    case 'replicate':
      result = await generateWithReplicate(prompt, config);
      break;
    case 'fal':
      result = await generateWithFal(prompt, config);
      break;
    default:
      throw new Error(`Unknown provider: ${config.provider}`);
  }

  // Cache the result
  if (result.base64) {
    const cacheEntry: ImageCacheEntry = {
      id: result.id,
      promptHash,
      base64: result.base64,
      provider: result.provider,
      model: result.model,
      createdAt: result.createdAt,
      expiresAt: new Date(Date.now() + CACHE_EXPIRY_HOURS * 60 * 60 * 1000).toISOString(),
    };
    await cacheImage(cacheEntry);
  }

  // Periodically clean expired cache
  cleanExpiredCache().catch(() => {});

  return result;
}

/**
 * Generate a character portrait optimized for conversations
 *
 * @param description - Description of the character (e.g., "a wise old wizard with a long beard")
 * @param style - Optional style modifier (e.g., "anime", "realistic", "watercolor")
 * @returns Promise<string> - Returns base64 data URL of the generated image
 */
export async function generateCharacterPortrait(
  description: string,
  style?: string
): Promise<string> {
  // Craft a prompt optimized for character portraits
  const styleModifier = style ? `, ${style} style` : '';
  const prompt = `Portrait of ${description}${styleModifier}. Close-up headshot, centered composition, expressive face, detailed features, professional lighting, high quality.`;

  const result = await generateImage(prompt, {
    size: '1024x1024', // Square for portraits
    quality: 'standard', // Faster generation
  });

  if (!result.base64) {
    throw new Error('Failed to generate portrait: no image data returned');
  }

  return result.base64;
}

/**
 * Generate a scene image for backgrounds or environments
 *
 * @param prompt - Description of the scene
 * @returns Promise<string> - Returns base64 data URL of the generated image
 */
export async function generateSceneImage(prompt: string): Promise<string> {
  // Enhance prompt for scene generation
  const enhancedPrompt = `${prompt}. Wide shot, atmospheric lighting, detailed environment, cinematic composition, high quality.`;

  const result = await generateImage(enhancedPrompt, {
    size: '1792x1024', // Wide for scenes
    style: 'vivid',
  });

  if (!result.base64) {
    throw new Error('Failed to generate scene: no image data returned');
  }

  return result.base64;
}

/**
 * Clear the image cache
 */
export async function clearImageCache(): Promise<void> {
  try {
    const db = await initCache();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(CACHE_STORE_NAME, 'readwrite');
      const store = transaction.objectStore(CACHE_STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to clear image cache'));
    });
  } catch (error) {
    console.warn('Failed to clear image cache:', error);
  }
}

/**
 * Get cache statistics
 */
export async function getImageCacheStats(): Promise<{ count: number; oldestEntry?: string }> {
  try {
    const db = await initCache();
    return new Promise((resolve) => {
      const transaction = db.transaction(CACHE_STORE_NAME, 'readonly');
      const store = transaction.objectStore(CACHE_STORE_NAME);
      const countRequest = store.count();
      const cursorRequest = store.openCursor();

      let count = 0;
      let oldestEntry: string | undefined;

      countRequest.onsuccess = () => {
        count = countRequest.result;
      };

      cursorRequest.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor && !oldestEntry) {
          oldestEntry = cursor.value.createdAt;
        }
      };

      transaction.oncomplete = () => {
        resolve({ count, oldestEntry });
      };

      transaction.onerror = () => {
        resolve({ count: 0 });
      };
    });
  } catch {
    return { count: 0 };
  }
}

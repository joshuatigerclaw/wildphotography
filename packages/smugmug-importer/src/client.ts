/**
 * SmugMug API Client with OAuth 1.0a
 * 
 * Handles:
 * - OAuth 1.0a authentication
 * - Album/image enumeration
 * - Rate limiting with adaptive backoff
 */

import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import OAuth from 'oauth-1.0a';
import crypto from 'crypto';

export interface SmugMugConfig {
  apiKey: string;
  apiSecret: string;
  accessToken: string;
  accessTokenSecret: string;
}

export interface Album {
  Uri: string;
  Name: string;
  Description?: string;
  UrlPath?: string;
  ImageCount?: number;
  AlbumKey?: string;
}

export interface SmugMugImage {
  Uri: string;
  ImageKey: string;
  Caption?: string;
  Description?: string;
  FileName?: string;
  Width?: number;
  Height?: number;
  Date?: string;
  DateCreated?: string;
  TakenDate?: string;
  MetaData?: {
    Date?: string;
    DateTimeOriginal?: string;
    Camera?: string;
    Lens?: string;
    ExposureTime?: string;
    FNumber?: string;
    ISO?: number;
    FocalLength?: string;
    GPS?: {
      Latitude?: number;
      Longitude?: number;
    };
  };
  AvailableForPurchase?: boolean;
  OriginalImage?: {
    Url: string;
    Width: number;
    Height: number;
    FileSize: number;
  };
  Keywords?: string[];
}

export interface RateLimitInfo {
  remaining: number;
  reset: number;
}

// Extend AxiosRequestConfig to include our token
interface SmugMugRequestConfig extends InternalAxiosRequestConfig {
  accessToken?: string;
  accessTokenSecret?: string;
}

export class SmugMugClient {
  private client: AxiosInstance;
  private oauth: OAuth;
  private accessToken: string;
  private accessTokenSecret: string;
  private rateLimit: RateLimitInfo = { remaining: 500, reset: Date.now() + 60000 };
  private lastRequestTime = 0;
  private minRequestInterval = 200;

  constructor(config: SmugMugConfig) {
    this.accessToken = config.accessToken;
    this.accessTokenSecret = config.accessTokenSecret;

    this.oauth = new OAuth({
      consumer: {
        key: config.apiKey,
        secret: config.apiSecret,
      },
      signature_method: 'HMAC-SHA1',
      hash_function(base_string, key) {
        return crypto.createHmac('sha1', key).update(base_string).digest('base64');
      },
    });

    this.client = axios.create({
      baseURL: 'https://api.smugmug.com/api/v2',
      headers: {
        'Accept': 'application/json',
      },
    });

    // Add auth interceptor
    this.client.interceptors.request.use((config: SmugMugRequestConfig) => {
      const token = {
        key: this.accessToken,
        secret: this.accessTokenSecret,
      };
      const authHeader = this.oauth.toHeader(
        this.oauth.authorize(
          {
            url: config.url!,
            method: config.method?.toUpperCase() || 'GET',
          },
          token
        )
      );
      config.headers['Authorization'] = authHeader['Authorization'];
      return config;
    });

    // Add response interceptor for rate limiting
    this.client.interceptors.response.use(
      (response) => {
        this.updateRateLimit(response.headers);
        return response;
      },
      async (error: AxiosError) => {
        await this.handleRateLimitError(error);
        throw error;
      }
    );
  }

  private updateRateLimit(headers: any) {
    if (headers['x-ratelimit-remaining']) {
      this.rateLimit.remaining = parseInt(headers['x-ratelimit-remaining']);
    }
    if (headers['x-ratelimit-reset']) {
      this.rateLimit.reset = parseInt(headers['x-ratelimit-reset']) * 1000;
    }
  }

  private async handleRateLimitError(error: AxiosError) {
    if (error.response?.status === 429) {
      const waitTime = Math.max(0, this.rateLimit.reset - Date.now()) + 1000;
      console.log(`[smugmug] Rate limited! Waiting ${waitTime}ms`);
      this.minRequestInterval = Math.min(this.minRequestInterval * 2, 1000);
      await this.sleep(waitTime);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async throttle() {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    
    if (elapsed < this.minRequestInterval) {
      await this.sleep(this.minRequestInterval - elapsed);
    }
    
    if (this.rateLimit.remaining < 10) {
      console.log(`[smugmug] Rate limit low (${this.rateLimit.remaining}), slowing down...`);
      await this.sleep(1000);
    }
    
    this.lastRequestTime = Date.now();
  }

  /**
   * Get albums with pagination
   */
  async getAlbums(options: { start?: number; count?: number } = {}): Promise<{ albums: Album[]; total: number; pages: number }> {
    await this.throttle();
    
    const params: any = {
      start: options.start || 0,
      count: options.count || 25,
    };
    
    const response = await this.client.get('/user/*/albums', { params });
    const data = response.data.Response;
    
    return {
      albums: data.Album || [],
      total: data.Total || 0,
      pages: data.Pages || 1,
    };
  }

  /**
   * Get single album by key
   */
  async getAlbum(albumKey: string): Promise<Album> {
    await this.throttle();
    const response = await this.client.get(`/album/${albumKey}`);
    return response.data.Response.Album;
  }

  /**
   * Get images in album with pagination
   */
  async getAlbumImages(albumKey: string, options: { start?: number; count?: number } = {}): Promise<{ images: SmugMugImage[]; total: number; pages: number }> {
    await this.throttle();
    
    const params: any = {
      start: options.start || 0,
      count: options.count || 100,
      keywords: true,
      metadata: true,
    };
    
    const response = await this.client.get(`/album/${albumKey}!images`, { params });
    const data = response.data.Response;
    
    return {
      images: data.AlbumImage || [],
      total: data.Total || 0,
      pages: data.Pages || 1,
    };
  }

  /**
   * Get single image by key
   */
  async getImage(imageKey: string): Promise<SmugMugImage> {
    await this.throttle();
    const response = await this.client.get(`/image/${imageKey}`);
    return response.data.Response.Image;
  }

  /**
   * Get image keywords
   */
  async getImageKeywords(imageKey: string): Promise<string[]> {
    await this.throttle();
    const response = await this.client.get(`/image/${imageKey}!keywords`);
    const keywords = response.data.Response.Keywords?.Keyword || [];
    return Array.isArray(keywords) ? keywords : [keywords];
  }

  /**
   * Get current rate limit status
   */
  getRateLimitStatus(): RateLimitInfo {
    return { ...this.rateLimit };
  }
}

export default SmugMugClient;

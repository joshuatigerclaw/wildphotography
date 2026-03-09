/**
 * SmugMug API Client with OAuth 1.0a
 * 
 * Fixed version with proper OAuth
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
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
  Keywords?: string[];
}

export interface RateLimitInfo {
  remaining: number;
  reset: number;
}

export class SmugMugClient {
  private client: AxiosInstance;
  private config: SmugMugConfig;
  private rateLimit: RateLimitInfo = { remaining: 500, reset: Date.now() + 60000 };
  private lastRequestTime = 0;
  private minRequestInterval = 200;

  constructor(config: SmugMugConfig) {
    this.config = config;
    
    this.client = axios.create({
      baseURL: 'https://api.smugmug.com/api/v2',
      headers: {
        'Accept': 'application/json',
      },
    });

    // Add auth interceptor
    this.client.interceptors.request.use((config) => {
      const authHeader = this.getAuthHeader(config.url || '', config.method?.toUpperCase() || 'GET');
      config.headers['Authorization'] = authHeader;
      return config;
    });

    // Rate limit interceptor
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

  private getAuthHeader(url: string, method: string): string {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = crypto.randomBytes(16).toString('hex');
    
    const params = [
      `oauth_consumer_key=${this.config.apiKey}`,
      `oauth_nonce=${nonce}`,
      `oauth_signature_method=HMAC-SHA1`,
      `oauth_timestamp=${timestamp}`,
      `oauth_token=${this.config.accessToken}`,
      `oauth_version=1.0`,
    ].join('&');
    
    const baseString = `${method}&${encodeURIComponent(url)}&${encodeURIComponent(params)}`;
    const signingKey = `${this.config.apiSecret}&${this.config.accessTokenSecret}`;
    const signature = crypto.createHmac('sha1', signingKey).update(baseString).digest('base64');
    
    return `OAuth oauth_consumer_key="${this.config.apiKey}", oauth_nonce="${nonce}", oauth_signature="${encodeURIComponent(signature)}", oauth_signature_method="HMAC-SHA1", oauth_timestamp="${timestamp}", oauth_token="${this.config.accessToken}", oauth_version="1.0"`;
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

  async getAlbums(options: { start?: number; count?: number } = {}): Promise<{ albums: Album[]; total: number; pages: number }> {
    await this.throttle();
    
    const params: any = { start: options.start || 0, count: options.count || 25 };
    const response = await this.client.get('/user/wildphotography1!albums', { params });
    const data = response.data.Response;
    
    return {
      albums: data.Album || [],
      total: data.Total || 0,
      pages: data.Pages || 1,
    };
  }

  async getAlbum(albumKey: string): Promise<Album> {
    await this.throttle();
    const response = await this.client.get(`/album/${albumKey}`);
    return response.data.Response.Album;
  }

  async getAlbumImages(albumKey: string, options: { start?: number; count?: number } = {}): Promise<{ images: SmugMugImage[]; total: number; pages: number }> {
    await this.throttle();
    
    const params: any = { start: options.start || 0, count: options.count || 100 };
    const response = await this.client.get(`/album/${albumKey}!images`, { params });
    const data = response.data.Response;
    
    return {
      images: data.AlbumImage || [],
      total: data.Total || 0,
      pages: data.Pages || 1,
    };
  }

  getRateLimitStatus(): RateLimitInfo {
    return { ...this.rateLimit };
  }
}

export default SmugMugClient;

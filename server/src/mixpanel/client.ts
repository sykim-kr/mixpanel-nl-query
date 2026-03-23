import fetch from 'node-fetch';
import type { MixpanelProject } from '../types';

interface MixpanelConfig {
  projectId?: string;
  username: string;
  secret: string;
}

export class MixpanelClient {
  private config: MixpanelConfig;
  private baseUrl = 'https://mixpanel.com/api';
  private maxRetries = 3;

  constructor(config: MixpanelConfig) {
    this.config = config;
  }

  private getAuthHeader(): string {
    const credentials = Buffer.from(
      `${this.config.username}:${this.config.secret}`
    ).toString('base64');
    return `Basic ${credentials}`;
  }

  private requireProjectId(): string {
    if (!this.config.projectId) {
      throw new Error('projectId is required for this Mixpanel API call.');
    }
    return this.config.projectId;
  }

  private async fetchWithRetry(url: string, options: Record<string, any> = {}): Promise<any> {
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      const response = await fetch(url, options);

      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get('retry-after') || '0', 10);
        const waitMs = Math.max((retryAfter || (attempt + 1) * 10) * 1000, 5000);
        console.log(`Rate limited. Retry ${attempt + 1}/${this.maxRetries} after ${waitMs}ms`);
        await new Promise(r => setTimeout(r, waitMs));
        continue;
      }

      return response;
    }

    throw new Error('Mixpanel API rate limit: 최대 재시도 횟수를 초과했습니다. 잠시 후 다시 시도해 주세요.');
  }

  async getProjects(): Promise<MixpanelProject[]> {
    const response = await this.fetchWithRetry('https://mixpanel.com/api/app/me/', {
      headers: { Authorization: this.getAuthHeader() },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Mixpanel auth/project lookup error: ${response.status} - ${text}`);
    }

    const data = await response.json();
    return this.extractProjects(data);
  }

  private extractProjects(payload: any): MixpanelProject[] {
    const candidates =
      payload?.results?.projects ??
      payload?.projects ??
      payload?.user?.projects ??
      [];

    if (Array.isArray(candidates)) {
      return candidates
        .map((item: any) => ({
          id: String(item.id ?? item.project_id ?? ''),
          name: String(item.name ?? item.project_name ?? item.id ?? ''),
        }))
        .filter((item: MixpanelProject) => item.id && item.name);
    }

    // candidates가 object인 경우 (key가 project id)
    if (typeof candidates === 'object') {
      return Object.entries(candidates)
        .map(([key, val]: [string, any]) => ({
          id: String(val?.id ?? key),
          name: String(val?.name ?? val?.project_name ?? key),
        }))
        .filter((item: MixpanelProject) => item.id && item.name);
    }

    return [];
  }

  async queryInsights(params: {
    from_date: string;
    to_date: string;
    event?: string;
    where?: string;
    group_by?: string[];
  }): Promise<unknown> {
    const url = new URL(`${this.baseUrl}/2.0/segmentation`);
    url.searchParams.set('project_id', this.requireProjectId());
    url.searchParams.set('from_date', params.from_date);
    url.searchParams.set('to_date', params.to_date);
    if (params.event) {
      url.searchParams.set('event', params.event);
    }
    if (params.where) {
      url.searchParams.set('where', params.where);
    }
    if (params.group_by && params.group_by.length > 0) {
      url.searchParams.set('on', `properties["${params.group_by[0]}"]`);
    }

    const response = await this.fetchWithRetry(url.toString(), {
      headers: { 'Authorization': this.getAuthHeader() },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Mixpanel API error: ${response.status} - ${text}`);
    }
    return response.json();
  }

  async getEvents(): Promise<unknown> {
    const url = `${this.baseUrl}/2.0/events/names?project_id=${this.requireProjectId()}`;
    const response = await this.fetchWithRetry(url, {
      headers: { 'Authorization': this.getAuthHeader() },
    });
    if (!response.ok) {
      throw new Error(`Mixpanel API error: ${response.status}`);
    }
    return response.json();
  }

  async getEventProperties(event: string): Promise<unknown> {
    const url = `${this.baseUrl}/2.0/events/properties/names?project_id=${this.requireProjectId()}&event=${encodeURIComponent(event)}`;
    const response = await this.fetchWithRetry(url, {
      headers: { 'Authorization': this.getAuthHeader() },
    });
    if (!response.ok) {
      throw new Error(`Mixpanel API error: ${response.status}`);
    }
    return response.json();
  }

  async getPropertyValues(property: string): Promise<unknown> {
    const url = `${this.baseUrl}/2.0/events/properties/values?project_id=${this.requireProjectId()}&name=${encodeURIComponent(property)}`;
    const response = await this.fetchWithRetry(url, {
      headers: { 'Authorization': this.getAuthHeader() },
    });
    if (!response.ok) {
      throw new Error(`Mixpanel API error: ${response.status}`);
    }
    return response.json();
  }

  async runJql(script: string): Promise<unknown> {
    const url = `${this.baseUrl}/2.0/jql`;
    const response = await this.fetchWithRetry(url, {
      method: 'POST',
      headers: {
        'Authorization': this.getAuthHeader(),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `project_id=${this.requireProjectId()}&script=${encodeURIComponent(script)}`,
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Mixpanel JQL error: ${response.status} - ${text}`);
    }
    return response.json();
  }
}

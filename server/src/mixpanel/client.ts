import fetch from 'node-fetch';

interface MixpanelConfig {
  projectId: string;
  username: string;
  secret: string;
}

export class MixpanelClient {
  private config: MixpanelConfig;
  private baseUrl = 'https://mixpanel.com/api';

  constructor(config: MixpanelConfig) {
    this.config = config;
  }

  private getAuthHeader(): string {
    const credentials = Buffer.from(
      `${this.config.username}:${this.config.secret}`
    ).toString('base64');
    return `Basic ${credentials}`;
  }

  async queryInsights(params: {
    from_date: string;
    to_date: string;
    event?: string;
    where?: string;
    group_by?: string[];
  }): Promise<unknown> {
    const url = new URL(`${this.baseUrl}/2.0/insights`);
    url.searchParams.set('project_id', this.config.projectId);

    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Authorization': this.getAuthHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      throw new Error(`Mixpanel API error: ${response.status} ${response.statusText}`);
    }
    return response.json();
  }

  async getEvents(): Promise<unknown> {
    const url = `${this.baseUrl}/2.0/events/names?project_id=${this.config.projectId}`;
    const response = await fetch(url, {
      headers: { 'Authorization': this.getAuthHeader() },
    });
    if (!response.ok) {
      throw new Error(`Mixpanel API error: ${response.status}`);
    }
    return response.json();
  }

  async getEventProperties(event: string): Promise<unknown> {
    const url = `${this.baseUrl}/2.0/events/properties/names?project_id=${this.config.projectId}&event=${encodeURIComponent(event)}`;
    const response = await fetch(url, {
      headers: { 'Authorization': this.getAuthHeader() },
    });
    if (!response.ok) {
      throw new Error(`Mixpanel API error: ${response.status}`);
    }
    return response.json();
  }

  async getPropertyValues(property: string): Promise<unknown> {
    const url = `${this.baseUrl}/2.0/events/properties/values?project_id=${this.config.projectId}&name=${encodeURIComponent(property)}`;
    const response = await fetch(url, {
      headers: { 'Authorization': this.getAuthHeader() },
    });
    if (!response.ok) {
      throw new Error(`Mixpanel API error: ${response.status}`);
    }
    return response.json();
  }

  async runJql(script: string): Promise<unknown> {
    const url = `${this.baseUrl}/2.0/jql`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': this.getAuthHeader(),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `project_id=${this.config.projectId}&script=${encodeURIComponent(script)}`,
    });
    if (!response.ok) {
      throw new Error(`Mixpanel JQL error: ${response.status}`);
    }
    return response.json();
  }
}

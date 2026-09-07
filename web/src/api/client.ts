import {
  BootstrapResponse,
  LiveSnapshot,
  Capabilities,
  Server,
  Profile,
  HistoryEvent,
  PortForwardingInfo,
  TrafficMetrics,
  APIErrorResponse,
} from '../types';

class APIClient {
  private csrfToken: string | null = null;

  public setCSRFToken(token: string) {
    this.csrfToken = token;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (options.body && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    if (this.csrfToken && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(options.method || 'GET')) {
      headers['X-CSRF-Token'] = this.csrfToken;
    }

    const response = await fetch(endpoint, {
      ...options,
      headers,
      credentials: 'same-origin',
    });

    if (!response.ok) {
      let errorDetails = `HTTP ${response.status}: ${response.statusText}`;
      try {
        const errorJSON = (await response.json()) as APIErrorResponse;
        if (errorJSON.error && errorJSON.error.message) {
          errorDetails = errorJSON.error.message;
        }
      } catch {
        // Not JSON
      }
      throw new Error(errorDetails);
    }

    return response.json() as Promise<T>;
  }

  public async getBootstrap(): Promise<BootstrapResponse> {
    const data = await this.request<BootstrapResponse>('/api/dashboard/bootstrap');
    if (data.snapshot) {
      // update CSRF if returned in session
    }
    return data;
  }

  public async getStatus(): Promise<LiveSnapshot> {
    return this.request<LiveSnapshot>('/api/dashboard/status');
  }

  public async getCapabilities(): Promise<Capabilities> {
    return this.request<Capabilities>('/api/dashboard/capabilities');
  }

  public async getServers(params?: {
    provider?: string;
    country?: string;
    city?: string;
    hostname?: string;
    protocol?: string;
    port_forward?: boolean;
    secure_core?: boolean;
    tor?: boolean;
    stream?: boolean;
  }): Promise<Server[]> {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined && val !== '') {
          query.set(key, String(val));
        }
      });
    }
    const queryStr = query.toString() ? `?${query.toString()}` : '';
    return this.request<Server[]>(`/api/dashboard/servers${queryStr}`);
  }

  public async getPortForwarding(): Promise<PortForwardingInfo> {
    return this.request<PortForwardingInfo>('/api/dashboard/port-forwarding');
  }

  public async getTraffic(): Promise<TrafficMetrics> {
    return this.request<TrafficMetrics>('/api/dashboard/traffic');
  }

  public async getHistory(filter?: { type?: string; severity?: string; limit?: number }): Promise<HistoryEvent[]> {
    const query = new URLSearchParams();
    if (filter?.type) query.set('type', filter.type);
    if (filter?.severity) query.set('severity', filter.severity);
    if (filter?.limit) query.set('limit', String(filter.limit));
    const queryStr = query.toString() ? `?${query.toString()}` : '';
    return this.request<HistoryEvent[]>(`/api/dashboard/history${queryStr}`);
  }

  public async getProfiles(): Promise<Profile[]> {
    return this.request<Profile[]>('/api/dashboard/profiles');
  }

  public async createProfile(profile: Partial<Profile>): Promise<Profile> {
    return this.request<Profile>('/api/dashboard/profiles', {
      method: 'POST',
      body: JSON.stringify(profile),
    });
  }

  public async updateProfile(id: string, profile: Partial<Profile>): Promise<Profile> {
    return this.request<Profile>(`/api/dashboard/profiles/${id}`, {
      method: 'PUT',
      body: JSON.stringify(profile),
    });
  }

  public async deleteProfile(id: string): Promise<void> {
    await this.request<{ message: string }>(`/api/dashboard/profiles/${id}`, {
      method: 'DELETE',
    });
  }

  public async applyProfile(id: string): Promise<{ outcome: string; snapshot: LiveSnapshot }> {
    return this.request<{ outcome: string; snapshot: LiveSnapshot }>(`/api/dashboard/profiles/${id}/apply`, {
      method: 'POST',
    });
  }

  public async vpnConnect(): Promise<{ outcome: string; snapshot: LiveSnapshot }> {
    return this.request<{ outcome: string; snapshot: LiveSnapshot }>('/api/dashboard/vpn/connect', {
      method: 'POST',
    });
  }

  public async vpnDisconnect(): Promise<{ outcome: string; snapshot: LiveSnapshot }> {
    return this.request<{ outcome: string; snapshot: LiveSnapshot }>('/api/dashboard/vpn/disconnect', {
      method: 'POST',
      body: JSON.stringify({ confirmed: true }),
    });
  }

  public async vpnReconnect(): Promise<{ outcome: string; snapshot: LiveSnapshot }> {
    return this.request<{ outcome: string; snapshot: LiveSnapshot }>('/api/dashboard/vpn/reconnect', {
      method: 'POST',
      body: JSON.stringify({ confirmed: true }),
    });
  }

  public async vpnChangeServer(selection: {
    country?: string;
    city?: string;
    hostname?: string;
    protocol?: string;
  }): Promise<{ supported: boolean; outcome: string; snapshot: LiveSnapshot }> {
    return this.request<{ supported: boolean; outcome: string; snapshot: LiveSnapshot }>(
      '/api/dashboard/vpn/selection',
      {
        method: 'PUT',
        body: JSON.stringify({
          confirmed: true,
          provider: 'protonvpn',
          ...selection,
        }),
      }
    );
  }

  public async testEndpoint(): Promise<{
    reachable: boolean;
    endpoint?: string;
    port: number;
    message: string;
    tested_at: string;
  }> {
    return this.request('/api/dashboard/endpoint/test', {
      method: 'POST',
    });
  }

  public async setMockScenario(scenario: string): Promise<{ scenario: string; snapshot: LiveSnapshot }> {
    return this.request('/api/dashboard/mock/scenario', {
      method: 'POST',
      body: JSON.stringify({ scenario }),
    });
  }

  public async login(username: string, password: string): Promise<{ token: string; csrf_token: string; username: string }> {
    const res = await this.request<{ token: string; csrf_token: string; username: string }>(
      '/api/dashboard/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      }
    );
    this.csrfToken = res.csrf_token;
    return res;
  }

  public async logout(): Promise<void> {
    await this.request('/api/dashboard/auth/logout', { method: 'POST' });
    this.csrfToken = null;
  }
}

export const apiClient = new APIClient();

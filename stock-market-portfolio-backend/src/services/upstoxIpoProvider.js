const IpoProvider = require('./ipoProvider');

const DEFAULT_BASE_URL = 'https://api.upstox.com';

class UpstoxIpoProvider extends IpoProvider {
  constructor() {
    super();
    this.baseUrl = process.env.UPSTOX_API_BASE_URL || DEFAULT_BASE_URL;
    this.accessToken = process.env.UPSTOX_ACCESS_TOKEN;
  }

  isConfigured() {
    return Boolean(this.accessToken);
  }

  async request(path, options = {}) {
    if (!this.isConfigured()) {
      const error = new Error('IPO data provider is not configured. Set UPSTOX_ACCESS_TOKEN on the backend.');
      error.code = 'IPO_PROVIDER_NOT_CONFIGURED';
      throw error;
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${this.accessToken}`,
        ...(options.headers || {})
      }
    });

    if (!response.ok) {
      const error = new Error(`IPO provider request failed with status ${response.status}`);
      error.status = response.status;
      throw error;
    }

    return response.json();
  }

  async list() {
    const payload = await this.request('/v2/ipos');
    return Array.isArray(payload?.data) ? payload.data : [];
  }

  async getById(id) {
    const payload = await this.request(`/v2/ipos/${encodeURIComponent(id)}`);
    return payload?.data || null;
  }
}

module.exports = UpstoxIpoProvider;

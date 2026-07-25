/**
 * API 通信模块
 */

export function getToken() {
  return localStorage.getItem('gotab_token');
}

export async function apiRequest(path, options = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = 'Bearer ' + token;

  const response = await fetch(path, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  return response.json();
}

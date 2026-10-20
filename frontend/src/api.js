// Configurazione URL API per compatibilita sia locale sia cloud (Netlify / Vercel)
export const API_BASE = (import.meta.env && import.meta.env.VITE_API_BASE) || '';

export function apiUrl(path) {
  if (!path.startsWith('/')) path = '/' + path;
  return `${API_BASE}${path}`;
}

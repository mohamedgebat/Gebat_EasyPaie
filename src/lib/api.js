/**
 * URL de base de l'API backend.
 * - En développement local : utilise le proxy Vite (localhost:5000)
 * - En production (Vercel) : utilise la variable VITE_API_URL définie sur Vercel
 *   pointant vers le backend Railway
 */
export const API_BASE = import.meta.env.VITE_API_URL || '';

/**
 * Helper fetch qui préfixe automatiquement l'URL de base de l'API.
 * Utilisez cette fonction à la place de fetch() dans tous les composants.
 *
 * @param {string} path - Le chemin de l'API, ex: '/api/ouvriers'
 * @param {RequestInit} options - Options fetch standard
 * @returns {Promise<Response>}
 */
export function apiFetch(path, options = {}) {
  return fetch(`${API_BASE}${path}`, options);
}

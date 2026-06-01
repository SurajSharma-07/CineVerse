/**
 * Formats a relative or absolute thumbnail URL to resolve correctly on both
 * local development and cloud production deployments (Vercel + Render).
 */
export const getImageUrl = (url: string | null | undefined): string => {
  if (!url) return '';
  
  // If the url is already fully qualified, return as-is
  if (
    url.startsWith('http://') ||
    url.startsWith('https://') ||
    url.startsWith('data:') ||
    url.startsWith('/') && !url.startsWith('/uploads/')
  ) {
    return url;
  }
  
  // Retrieve the backend API URL from the Vite environment variable or determine dynamically
  const getDynamicApiUrl = (): string => {
    if (import.meta.env.VITE_API_URL) {
      return import.meta.env.VITE_API_URL.replace(/\/$/, '');
    }
    if (typeof window !== 'undefined') {
      const protocol = window.location.protocol;
      const hostname = window.location.hostname;
      return `${protocol}//${hostname}:3000`;
    }
    return 'http://localhost:3000';
  };

  const apiUrl = getDynamicApiUrl();
  
  // Clean the relative path
  const relativePath = url.startsWith('/') ? url : `/${url}`;
  
  return `${apiUrl}${relativePath}`;
};

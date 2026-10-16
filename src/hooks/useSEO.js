import { useEffect } from 'react';

function upsertMeta(name, content) {
  let tag = document.querySelector(`meta[name="${name}"]`);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute('name', name);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
}

function upsertOg(property, content) {
  let tag = document.querySelector(`meta[property="${property}"]`);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute('property', property);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
}

const CANONICAL_ORIGIN = 'https://nova-systems.app';

// Sets the document title + meta/OG description for the current page, a per-page canonical URL on the canonical domain
// (previously every page inherited index.html's canonical "/", telling search engines each page duplicated the home page),
// and an optional robots directive (e.g. 'noindex' for private token pages).
export function useSEO({ title, description, robots = null }) {
  useEffect(() => {
    if (title) document.title = title;
    const path = window.location.pathname.replace(/\/+$/, '') || '/';
    let link = document.querySelector('link[rel="canonical"]');
    if (!link) { link = document.createElement('link'); link.setAttribute('rel', 'canonical'); document.head.appendChild(link); }
    link.setAttribute('href', `${CANONICAL_ORIGIN}${path === '/' ? '/' : path}`);
    upsertOg('og:url', `${CANONICAL_ORIGIN}${path === '/' ? '/' : path}`);
    const existing = document.querySelector('meta[name="robots"]');
    if (robots) upsertMeta('robots', robots); else if (existing) existing.remove();
    if (description) {
      upsertMeta('description', description);
      upsertOg('og:description', description);
    }
    if (title) upsertOg('og:title', title);
    upsertOg('og:type', 'website');
  }, [title, description, robots]);
}

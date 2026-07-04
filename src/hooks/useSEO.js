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

// Sets the document title + meta/OG description for the current page.
export function useSEO({ title, description }) {
  useEffect(() => {
    if (title) document.title = title;
    if (description) {
      upsertMeta('description', description);
      upsertOg('og:description', description);
    }
    if (title) upsertOg('og:title', title);
    upsertOg('og:type', 'website');
  }, [title, description]);
}

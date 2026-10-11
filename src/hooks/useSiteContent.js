import { useState, useEffect } from 'react'

export function useSiteContent(key) {
  const [content, setContent] = useState(null)
  useEffect(() => {
    fetch(`/api/client?resource=site-content&key=${encodeURIComponent(key)}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.content_json) setContent(d.content_json) })
      .catch(() => {})
  }, [key])
  return content
}

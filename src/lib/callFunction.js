/**
 * Call a Base44 backend function by name.
 * Works without the full SDK — uses the platform's standard function endpoint.
 */
export async function callFunction(name, payload) {
  const appId = window.__BASE44_APP_ID__ || document.querySelector("meta[name='base44-app-id']")?.content || "";
  const res = await fetch(`/api/functions/${name}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Function ${name} failed`);
  }
  return res.json();
}
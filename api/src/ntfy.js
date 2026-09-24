const NTFY_URL = process.env.NTFY_URL || 'https://ntfy.sh';
const NTFY_TOPIC = process.env.NTFY_TOPIC;

// actions: array of ntfy action objects, e.g. { action: 'view', label, url }
// topic: per-user override; falls back to the global NTFY_TOPIC env var when absent.
async function sendNtfy({ title, message, actions, priority, tags, topic }) {
  const payload = {
    topic: topic || NTFY_TOPIC,
    title,
    message,
    ...(priority ? { priority } : {}),
    ...(tags ? { tags } : {}),
    ...(actions && actions.length ? { actions } : {}),
  };
  await fetch(NTFY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

module.exports = { sendNtfy };

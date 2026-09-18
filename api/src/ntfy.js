const NTFY_URL = process.env.NTFY_URL || 'https://ntfy.sh';
const NTFY_TOPIC = process.env.NTFY_TOPIC;

// actions: array of ntfy action objects, e.g. { action: 'view', label, url }
async function sendNtfy({ title, message, actions, priority, tags }) {
  const payload = {
    topic: NTFY_TOPIC,
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

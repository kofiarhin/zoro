const API = import.meta.env.VITE_API_URL;

export async function sendToBrain(message) {
  const res = await fetch(`${API}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });

  if (!res.ok) {
    throw new Error("Failed to reach brain");
  }

  return res.json();
}

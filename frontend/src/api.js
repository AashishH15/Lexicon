const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export async function checkGrammar(
  text,
  language = "en-US",
  ignore = [],
  signal,
) {
  const response = await fetch(`${API_URL}/grammar/check`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, language, ignore }),
    signal,
  });
  if (!response.ok) {
    throw new Error(`Grammar check failed: ${response.status}`);
  }
  const data = await response.json();
  return data.matches;
}

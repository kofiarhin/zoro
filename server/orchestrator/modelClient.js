class ModelClient {
  constructor({
    baseUrl = process.env.BRAIN_BASE_URL || "http://127.0.0.1:11434/v1",
    model = process.env.BRAIN_MODEL || "dolphin-llama3:latest",
    apiKey = process.env.BRAIN_API_KEY || "ollama-local",
    timeoutMs = 120000,
  } = {}) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.model = model;
    this.apiKey = apiKey;
    this.timeoutMs = timeoutMs;
  }

  async complete({ messages, temperature = 0.1, maxTokens = 1800 }) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          temperature,
          max_tokens: maxTokens,
          stream: false,
        }),
        signal: controller.signal,
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        const message =
          data?.error?.message || data?.error || "Model request failed";
        const error = new Error(message);
        error.status = response.status;
        throw error;
      }

      return data?.choices?.[0]?.message?.content?.trim() || "";
    } catch (error) {
      if (error.name === "AbortError") {
        const timeoutError = new Error("Agent model request timed out");
        timeoutError.status = 504;
        throw timeoutError;
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}

module.exports = { ModelClient };

import env from "@server/env";
import { ValidationError } from "@server/errors";
import Logger from "@server/logging/Logger";
import fetch from "@server/utils/fetch";

interface GenerateTldrOptions {
  text: string;
  maxLength?: number;
}

interface OpenAIChatCompletionChoice {
  message?: {
    content?: string | null;
  };
}

interface OpenAIChatCompletionResponse {
  choices: OpenAIChatCompletionChoice[];
}

/**
 * Service responsible for generating AI-powered TL;DR summaries for documents.
 */
export class TldrService {
  /**
   * Generates a TL;DR summary for the provided text using the configured AI
   * provider.
   *
   * @param options options for TL;DR generation.
   * @returns a promise that resolves to the generated summary.
   */
  public static async generateTldr(
    options: GenerateTldrOptions
  ): Promise<string> {
    if (!env.AI_TLDR_API_KEY) {
      throw ValidationError("AI_TLDR_API_KEY environment variable is required");
    }

    if (!options.text.trim()) {
      throw ValidationError("Cannot generate a summary for empty content");
    }

    const provider = (env.AI_TLDR_PROVIDER || "openai").toLowerCase();

    if (provider !== "openai") {
      throw ValidationError(
        `Unsupported AI_TLDR_PROVIDER "${env.AI_TLDR_PROVIDER}", only "openai" is supported`
      );
    }

    const model = env.AI_TLDR_MODEL || "gpt-4.1-mini";
    const maxLength = options.maxLength && options.maxLength > 0
      ? options.maxLength
      : 600;

    const maxInputLength = 8000;
    const inputText =
      options.text.length > maxInputLength
        ? options.text.slice(0, maxInputLength)
        : options.text;

    const prompt = [
      "You are an assistant for the Outline knowledge base.",
      "Generate a concise TL;DR of the following document.",
      "Prefer 3–6 short bullet points.",
      "Respond in the same language as the input text.",
    ].join(" ");

    const url = "https://api.openai.com/v1/chat/completions";

    Logger.debug("tldr", "Generating TL;DR via OpenAI", {
      model,
      textLength: inputText.length,
      maxLength,
    });

    const response = await fetch(url, {
      method: "POST",
      timeout: 15000,
      headers: {
        Authorization: `Bearer ${env.AI_TLDR_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content: prompt,
          },
          {
            role: "user",
            content: inputText,
          },
        ],
        max_tokens: maxLength,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      Logger.error("tldr", "Failed to generate TL;DR", {
        status: response.status,
        body: errorBody,
      });

      throw ValidationError(
        "Failed to generate TL;DR summary from AI provider"
      );
    }

    const json = (await response.json()) as OpenAIChatCompletionResponse;
    const content =
      json.choices?.[0]?.message?.content?.trim() ??
      "";

    if (!content) {
      throw ValidationError("AI provider returned an empty TL;DR summary");
    }

    return content;
  }
}


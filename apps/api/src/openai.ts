interface OpenAIRequest {
  model: string;
  messages: { role: string; content: string }[];
  max_tokens: number;
  response_format?: { type: string };
}

interface OpenAIResponse {
  choices: { message: { content: string } }[];
}

export async function callOpenAI(
  apiKey: string,
  body: OpenAIRequest,
): Promise<OpenAIResponse> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenAI API error ${response.status}: ${text}`);
  }

  return response.json() as Promise<OpenAIResponse>;
}

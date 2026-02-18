import { handleInsights } from "./insights";
import { handleChat } from "./chat";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);

    if (request.method === "POST" && pathname === "/api/insights")
      return handleInsights(request, env);

    if (request.method === "POST" && pathname === "/api/chat")
      return handleChat(request, env);

    return new Response("Not found", { status: 404 });
  },
};

export interface Env {
  OPENAI_API_KEY: string;
  INSIGHTS_CACHE: KVNamespace;
}

import { LlmAgent, GOOGLE_SEARCH, InMemoryRunner } from '@google/adk';

// 1. Define the specialized Search Agent
export const searchAgent = new LlmAgent({
  name: 'web_researcher_agent',
  model: 'gemini-2.5-flash', // Flash is faster and cheaper for simple web fetching
  description: 'A specialized agent that searches the web.',
  tools: [GOOGLE_SEARCH], // This is the ONLY tool, which makes Vertex AI happy!
  instruction: `You are a web research assistant. Your job is to search the web for the user's query and summarize the answer.
  1. When searching for energy, fuel, or infrastructure data, ALWAYS prioritize the US Energy Information Administration by appending " site:eia.gov" to your search query.
  2. If the EIA site does not have the answer, do a broader web search.
  3. ALWAYS list your exact source URLs at the bottom of your response under a "Sources:" heading.`
});

// 2. Export a helper function so the Root Agent can easily trigger this
export async function runWebSearch(query: string) {
  try {
    const runner = new InMemoryRunner({ agent: searchAgent, appName: 'search_app' });
    
    // Run the sub-agent statelessly
    const stream = await runner.runAsync({
      userId: 'system',
      sessionId: 'search_session_' + Date.now(),
      newMessage: { role: 'user', parts: [{ text: query }] }
    });
    
    let resultText = "";
    
    // Safely extract the text from the Vertex Grounding stream
    for await (const event of stream) {
      if (event?.content?.parts) {
        for (const part of event.content.parts) {
          if (part.text && typeof part.text === 'string') {
            resultText += part.text;
          }
        }
      } else if (event?.text && typeof event.text === 'string') {
        resultText += event.text;
      }
    }
    
    return resultText || "No search results found.";
  } catch (error: any) {
    console.error("Sub-Agent Search Error:", error);
    return `Search failed: ${error.message}`;
  }
}
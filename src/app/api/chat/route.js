import { NextResponse } from 'next/server';
import { rootAgent } from '@/lib/agent';
// [CHANGE 1] Import the InMemoryRunner from ADK
import { InMemoryRunner } from '@google/adk';

// [CHANGE 2] Initialize the runner globally. 
// Doing this outside the POST function allows it to keep conversational memory alive in RAM!
const runner = new InMemoryRunner({ agent: rootAgent, appName: 'cummins_app' });
const USER_ID = 'local_user';
let SESSION_ID = null;

export async function POST(req) {
  try {
    const { message } = await req.json();

    if (!message) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    console.log(`🤖 Agent received message: "${message}"`);

    // [CHANGE 3] Create a session on the very first message
    if (!SESSION_ID) {
      const session = await runner.sessionService.createSession({ 
        appName: 'cummins_app', 
        userId: USER_ID 
      });
      SESSION_ID = session.id;
    }

    // [CHANGE 4] Format the user input exactly how the TS ADK expects it
    const content = { role: 'user', parts: [{ text: message }] };

    // [CHANGE 5] Execute the agent using runAsync
    const stream = runner.runAsync({ 
      userId: USER_ID, 
      sessionId: SESSION_ID, 
      newMessage: content 
    });
    
    // [CHANGE 6] The ADK returns a stream of events. We loop through them to collect the final text.
    const responses = [];
    for await (const event of stream) {
      responses.push(event);
    }
    
    // Extract the actual text response from the event payload
    const replyText = responses
      .flatMap(e => e.content?.parts?.map(p => p.text) ?? [])
      .join('') || "I processed that successfully, but returned no text.";

    return NextResponse.json({ reply: replyText });

  } catch (error) {
    console.error("❌ Agent API Error:", error);
    return NextResponse.json(
      { error: "The agent encountered an error processing your request: " + error.message }, 
      { status: 500 }
    );
  }
}
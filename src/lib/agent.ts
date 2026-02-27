import { FunctionTool, LlmAgent } from '@google/adk';
import { z } from 'zod';
import { BigQuery } from '@google-cloud/bigquery';

// Initialize the BigQuery Client. 
// It automatically uses GOOGLE_CLOUD_PROJECT and GOOGLE_APPLICATION_CREDENTIALS from your .env
const bigquery = new BigQuery();

/* 1. Create the BigQuery Tool */
const queryBigQueryTool = new FunctionTool({
  name: 'query_bigquery',
  description: 'Executes a Google Standard SQL query against BigQuery and returns the data.',
  parameters: z.object({
    query: z.string().describe("The exact Standard SQL query to execute."),
  }),
  execute: async ({ query }) => {
    try {
      const sanitizedQuery = query.toUpperCase().trim();

      // GUARDRAIL 1: Must start with SELECT
      if (!sanitizedQuery.startsWith('SELECT')) {
        console.warn(`🛑 [BLOCKED] Agent tried a non-SELECT query: ${query}`);
        return { 
          status: 'error', 
          message: 'SECURITY BLOCKED: You are strictly limited to SELECT queries. Do not attempt to modify the database.' 
        };
      }

      // GUARDRAIL 2: Must not contain destructive keywords
      const forbiddenWords = ['DROP', 'DELETE', 'UPDATE', 'INSERT', 'ALTER', 'CREATE', 'GRANT', 'TRUNCATE'];
      for (const word of forbiddenWords) {
        // Using regex to check for exact word matches
        const regex = new RegExp(`\\b${word}\\b`);
        if (regex.test(sanitizedQuery)) {
          console.warn(`🛑 [BLOCKED] Agent tried a destructive command: ${query}`);
          return { 
            status: 'error', 
            message: `SECURITY BLOCKED: The keyword '${word}' is forbidden. You only have read access.` 
          };
        }
      }

      console.log(`\n✅ [Agent is running SQL]: ${query}\n`);
      
      // Run the query safely
      const [rows] = await bigquery.query({ query: query });
      
      if (!rows || rows.length === 0) {
        return { status: 'success', data: "Query executed successfully, but returned 0 rows." };
      }

      return { status: 'success', data: rows };
      
    } catch (error: any) {
      console.error(`❌ [SQL Error]:`, error.message);
      return { status: 'error', message: `Query failed: ${error.message}. Please fix the SQL syntax and try again.` };
    }
  },
});

const BIGQUERY_EXAMPLE_PROJECT = process.env.BIGQUERY_EXAMPLE_PROJECT ;
const BIGQUERY_EXAMPLE_DATASET = process.env.BIGQUERY_EXAMPLE_DATASET ;
const BIGQUERY_TABLE_EXAMPLE = process.env.BIGQUERY_TABLE_EXAMPLE;
const BIGQUERY_DESCRIPTION_EXAMPLE = process.env.BIGQUERY_DESCRIPTION_EXAMPLE;

/* 2. Define the Agent and Guardrails */
export const rootAgent = new LlmAgent({
  name: 'cummins_insights_agent',
  model: 'gemini-2.5-flash',
  description: 'A data analyst agent that answers questions using the Cummins BigQuery database.',
  tools: [queryBigQueryTool],
  instruction: `You are a data insights agent for Cummins. Your job is to answer user questions by querying the databases.

CRITICAL RULES TO PREVENT HALLUCINATIONS AND ENSURE SECURITY:
1. YOU ARE IN A STRICT READ-ONLY ENVIRONMENT. You only have permission to execute SELECT queries.
2. NEVER attempt to use INSERT, UPDATE, DELETE, ALTER, or DROP commands. They will fail.
3. YOU MUST NEVER GUESS, INVENT, OR ESTIMATE DATA.
4. When asked to perform an operation that you cannot do, respond 'I don't have the capability to do that' or 'I do not have access to that information'. Do not ever talk about which tables or datasets you have access to or what operations or queries you can perform on the tables. 
5. Always aggregate data (e.g., SUM, COUNT, AVG) in your SQL query to avoid returning massive datasets. Avoid 'SELECT *' unless the table is extremely small.
6. Do not ever tell the names of the table or dataset or project. If asked what you can do, only talk about the information given via Description for a table

DATABASE SCHEMA:
Project ID:${BIGQUERY_EXAMPLE_PROJECT}
Dataset: ${BIGQUERY_EXAMPLE_DATASET}

Table 1: ${BIGQUERY_TABLE_EXAMPLE}
Description: ${BIGQUERY_DESCRIPTION_EXAMPLE}


When responding, be professional, concise, and clearly state the numbers you found.`,
});
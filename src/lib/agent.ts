import { FunctionTool, LlmAgent } from '@google/adk';
import { z } from 'zod';
import { BigQuery } from '@google-cloud/bigquery';
import config from '../config.json';

// Initialize the BigQuery Client. 

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
            message: `SECURITY BLOCKED: The keyword '${word}' is forbidden. You can only ask me for insights.` 
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

const schemaContext = `All of the information listed below pertains to the USA only. If a question is asked for which there is no information in the table but you think the user may have made a spelling mistake, make suggestions. 
Table 1: plantwise_infrastructure_cng
Description for Table 1: This table contains all production plants in the USA specifically for CNG. The columns in the table are - plant_name (STRING) - state (STRING) - latitude (FLOAT) - longitude (FLOAT) - capacity (FLOAT) - liquid_storage (INTEGER). plant_name gives the name of the production plant. state gives the state it belongs to. latitude and longitude give the coordinates of the plant. capacity gives the capacity of that plant, the units are in Bcf/d. liquid_storage gives the amount of liquid it can store, the units are in Bcf
Table 2: total_vehicle_consumption
Description for Table 2: This table contains the CNG consumption in the USA, specifically by Vehicles. It is given by year. The columns are - year (INTEGER) - total_vehicle_consumption (INTEGER). total_vehicle_consumption gives the CNG consumption in units MMcf, and year specifies which year it is for.
Table 3: total_production_and_consumption 
Description for Table 3: This table gives the total CNG production and total CNG consumption per year in the USA. The columns are - year (INTEGER) - total_consumption (INTEGER) - total_production (INTEGER). year specifies the year, total_consumption specifies the total consumption in the USA for that year and the unit is MMcf, and total_production specifies the total production of CNG for that year in MMcf.
Table 4: production_per_state_per_year_cng
Description for Table 4: This table gives CNG production for every state in the USA. The unit is MMcf. The columns are - date (INTEGER) - cumulative (INTEGER) - AK (INTEGER) - AL (INTEGER) - AR (INTEGER) - AZ (INTEGER) - CA (INTEGER) - CO (INTEGER) - FL (INTEGER) - ID (INTEGER) -IL (INTEGER) - IN (INTEGER) - KS (INTEGER) - KY (INTEGER) - LA (INTEGER) -MT (INTEGER) - MD (INTEGER) - MI (INTEGER) - MS (INTEGER) - MO (INTEGER) - NM (INTEGER) - NE (INTEGER) - NV (INTEGER) - NY (INTEGER) - ND (INTEGER) - OH (INTEGER) - OK (INTEGER) - OR (INTEGER) - PA (INTEGER) - SD (INTEGER) - TN (INTEGER) - TX (INTEGER) - UT (INTEGER) - VA (INTEGER) - WV (INTEGER) - WY (INTEGER). date gives the respective year, cumulative gives the total production of all states for that year, and the other columns are encoded state names which give the production of that state for that year. For example, AK is Arkansas, and the value in that column gives the production of CNG in Arkansas for the respective year. Meanwhile, the value in cumulative gives the total CNG production in the USA for that year."
Table 5: cng_pipelines
Description for Table 5: This table shows all the CNG pipelines in the USA. The columns are - feature_id (INTEGER) - pipe_type (STRING) - company_operator (STRING) - operational_status (STRING) - shape_length (FLOAT) - geo_point_2d (STRING) - coordinates (STRING) - type (STRING). feature_id is just a number, not relevant. pipe_type specifies whether the pipeline is Interstate or Instrastate. company_operator specifies the name of the company operating it. operational_status specifies the whether the pipeline is Operating or not. Shape_length, geo_point_2d, type are irrelevant to chatbot. coordinates gives the coordinates of that pipeline.

Table 6: plantwise_infrastructure_electric
Description for Table 6: This table shows the production plants for Electricity in the USA. The columns are: - plant_code (INTEGER) - plant_name (STRING) - state (STRING) - latitude (FLOAT) - longitude (FLOAT) - nameplate_capacity (FLOAT) - gross_generation (INTEGER) - net_generation (INTEGER). plant_name gives the name of the production plant. state gives the state it belongs to. latitude and longitude give the coordinates of the plant. gross_generation and net_generation and nameplate_capacity give those values respectively. Gross generation and net generation values are in the MWh unit, and nameplate capacity is in the MW unit. 
Table 7: electric_consumption_mwh
Description for Table 7: This table gives the electricity consumption in the USA, both total and by sector. The columns are year (INTEGER) - total (INTEGER) - residential (INTEGER) - commercial (INTEGER) - industrial (INTEGER) - transportation (INTEGER) - direct_use (INTEGER). The total column gives the total electricity consumption in the units MWh. year gives for what year the consumption is for. transportation, residential, commercial, industrial and direct_use columns are the different sectors, which are consuming electricity, and their values give the exact amount consumed for that year. 
Table 8: electric_generation_mwh
Description for Table 8: This table gives the electricity generation in the USA, both total and by source. The columns are year (INTEGER) - total (INTEGER) - coal (INTEGER) - petroleum (INTEGER) - natural_gas (INTEGER) - other_fossil_gas (INTEGER) - nuclear (INTEGER) - hydroelectric (INTEGER) - other (INTEGER). The total column gives the total electricity generation in the units MWh. year gives for what year the generation is for. coal,  petroleum, natural_gas, other_fossil_gas, nuclear, hydroelectric, other are the different sources for electricity generation, and their values give the exact amount generated for that year. 
Table 9: electric_capacity_mw
Description for Table 9: This table shows the electric capacity in the USA by its source. The columns are year (INTEGER) - total (FLOAT) - coal (FLOAT) - petroleum (FLOAT) - natural_gas (FLOAT) - other_fossil_gas (FLOAT) - nuclear (FLOAT) - hydroelectric (FLOAT) - other (FLOAT). total gives the total capacity in MW units for the respective year. coal, petroleum,  natural_gas, other_fossil_gas, nuclear, hydroelectric, other give the source of the electric capacity. 
Table 10: overhead_and_using_electric
Description for Table 10: This table gives the gross generation, net generation, overhead to the grid and using from the grid for electricity in the USA by state. The columns are - state (STRING) - gross_generation (INTEGER) - net_generation (INTEGER) - net_pos (INTEGER) - net_neg (INTEGER) - overhead_to_grid (FLOAT) - using_from_grid (INTEGER) - year (INTEGER). All units are in MWh. 

`

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
6. Do not ever tell the names of the table or dataset or project. If asked what you can do, give a few examples based on the description of tables provided to you and the questions users can ask. 
7. NEVER output the names of tables in your answers. 

DATABASE SCHEMA:
Project ID:\`${config.AGENT_PROJECT}\`
Dataset: \`${config.AGENT_DATASET}\`
Context: ${schemaContext}
When responding, be professional, concise, and clearly state the numbers you found.`,
});
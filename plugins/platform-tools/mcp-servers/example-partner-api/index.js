import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const PARTNER_API_URL = process.env.PARTNER_API_URL || "https://api.example.com";
const PARTNER_API_KEY = process.env.PARTNER_API_KEY;

async function partnerFetch(path) {
  if (!PARTNER_API_KEY) {
    throw new Error(
      "Partner API authentication failed. Check PARTNER_API_KEY in MCP server config."
    );
  }

  const response = await fetch(`${PARTNER_API_URL}${path}`, {
    headers: {
      "X-Api-Key": PARTNER_API_KEY,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Partner API ${response.status}: ${body}`);
  }

  return response.json();
}

const server = new McpServer({
  name: "example-partner-api",
  version: "1.0.0",
});

server.tool(
  "partner__get_resource",
  "Fetch a resource by ID from the partner API. Returns the resource schema and metadata.",
  { resource_id: z.string().describe("The resource ID") },
  async ({ resource_id }) => {
    try {
      const data = await partnerFetch(`/v1/resources/${resource_id}`);
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: error.message }],
        isError: true,
      };
    }
  }
);

server.tool(
  "partner__list_resources",
  "List all resources from the partner API with names, statuses, and metadata.",
  {},
  async () => {
    try {
      const data = await partnerFetch("/v1/resources");
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: error.message }],
        isError: true,
      };
    }
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);

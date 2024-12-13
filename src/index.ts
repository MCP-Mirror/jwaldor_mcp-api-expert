#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { exec } from "child_process";

import { promisify } from "util";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { promises as fs } from "fs";
import path from "path";
import { Command } from "commander";
import { installCommand } from "./install.js";

// Define Zod schemas for validation
const RequestSchema = z.object({
  type: z.enum(["POST", "GET", "PUT", "DELETE"]),
  url: z.string(),
  headers: z.record(z.string(), z.string()),
  body: z.any(),
});
// Create server instance
const server = new Server(
  {
    name: "requests",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "request",
        description: "Make an HTTP request with curl",
        inputSchema: {
          type: "object",
          properties: {
            type: {
              type: "string",
              description: "Type of the request. GET, POST, PUT, DELETE",
            },
            url: {
              type: "string",
              description: "Url to make the request to",
            },
            headers: {
              type: "object",
              description: "Headers to include in the request",
            },
            body: {
              type: "object",
              description: "Body to include in the request",
            },
          },
          required: ["type", "url", "headers", "body"],
        },
      },
    ],
  };
});

// Add this near other helper functions
const execPromise = promisify(exec);

// Replace makeRequest function
export async function makeRequest(
  url: string,
  type: string,
  headers: Record<string, string>,
  body: any
) {
  try {
    const response = await fetch(url, {
      method: type,
      headers,
      body:
        body && (type === "POST" || type === "PUT")
          ? JSON.stringify(body)
          : undefined,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return {
      status: response.status,
      data: await response.text(),
      headers: Object.fromEntries(response.headers),
    };
  } catch (error) {
    console.error("Error making request:", error);
    throw error;
  }
}

// Add this logging function near the other helper functions
async function logToFile(key: string, value: any) {
  const logDir = "logs";
  const logFile = path.join(logDir, "requests.log");

  try {
    // Create logs directory if it doesn't exist
    await fs.mkdir(logDir, { recursive: true });

    const timestamp = new Date().toISOString();
    const logEntry = `${timestamp} | ${key}: ${JSON.stringify(value)}\n`;

    // Append to log file
    await fs.appendFile(logFile, logEntry, "utf8");
  } catch (error) {
    console.error("Error writing to log file:", error);
  }
}

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === "request") {
      const { type, url, headers, body } = RequestSchema.parse(args);
      logToFile("request", { type, url, headers, body });
      const response = await makeRequest(url, type, headers, body);
      logToFile("response", response);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              response,
            }),
          },
        ],
      };
    } else {
      throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(
        `Invalid arguments: ${error.errors
          .map((e) => `${e.path.join(".")}: ${e.message}`)
          .join(", ")}`
      );
    }
    throw error;
  }
});

const createServer = async () => {
  try {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("MCP Rest APIs Server running on stdio");
  } catch (error) {
    console.error("Error creating server:", error);
  }
};
const runServer = new Command("serve").action(createServer);

const program = new Command();
program.addCommand(runServer);
program.addCommand(installCommand);
program.parse(process.argv);

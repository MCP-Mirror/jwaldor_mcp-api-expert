import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { exec } from "child_process";
import { promisify } from "util";
import { CallToolRequestSchema, ListToolsRequestSchema, } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { promises as fs } from "fs";
import path from "path";
import axios from "axios";
const CLAUDE_ENVIRONMENT_PATH = "/Users/jacobwaldor/Library/Application Support/ClaudeEnvironment/";
// Define Zod schemas for validation
const RequestSchema = z.object({
    type: z.enum(["POST", "GET", "PUT", "DELETE"]),
    url: z.string(),
    headers: z.record(z.string(), z.string()),
    body: z.any(),
});
// Create server instance
const server = new Server({
    name: "requests",
    version: "1.0.0",
}, {
    capabilities: {
        tools: {},
    },
});
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
async function makeRequestOld(url, type, headers, body) {
    try {
        let response;
        switch (type) {
            case "GET":
                response = await axios.get(url, {
                    headers,
                    data: body,
                });
                break;
            case "POST":
                response = await axios.post(url, body, {
                    headers,
                });
                break;
            case "PUT":
                response = await axios.put(url, body, {
                    headers,
                });
                break;
            case "DELETE":
                response = await axios.delete(url, {
                    headers,
                    data: body,
                });
                break;
            default:
                throw new Error(`Unknown request type: ${type}`);
        }
        if (response.status !== 200) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response;
    }
    catch (error) {
        console.error("Error making NWS request:", error);
        return `There was an error making the request: ${error}`;
    }
}
export async function saveEnvironmentVariableToFile() {
    const environment = await fs.readFile(path.join(CLAUDE_ENVIRONMENT_PATH, "environment.json"), "utf8");
}
// Replace makeRequest function
export async function makeRequest(url, type, headers, body) {
    try {
        // Convert headers to curl format
        const headerArgs = Object.entries(headers)
            .map(([key, value]) => `-H "${key}: ${value}"`)
            .join(" ");
        // Construct the curl command
        let curlCommand = `curl -X ${type} ${headerArgs}`;
        // Add body for POST/PUT requests
        if (body && (type === "POST" || type === "PUT")) {
            curlCommand += ` -d '${JSON.stringify(body)}'`;
        }
        // Add the URL and some default options
        curlCommand += ` "${url}" -s -w "\nHTTP_STATUS:%{http_code}"`;
        const { stdout, stderr } = await execPromise(curlCommand);
        // Parse the response
        const [responseBody, statusLine] = stdout.split("\nHTTP_STATUS:");
        const status = parseInt(statusLine, 10);
        if (status !== 200) {
            throw new Error(`HTTP error! status: ${status}`);
        }
        return {
            status,
            data: responseBody.trim(),
            headers: {}, // Note: You can add -i flag to curl to get headers if needed
        };
    }
    catch (error) {
        console.error("Error making curl request:", error);
        return `There was an error making the request: ${error}`;
    }
}
// Add this logging function near the other helper functions
async function logToFile(key, value) {
    const logDir = "logs";
    const logFile = path.join(logDir, "requests.log");
    try {
        // Create logs directory if it doesn't exist
        await fs.mkdir(logDir, { recursive: true });
        const timestamp = new Date().toISOString();
        const logEntry = `${timestamp} | ${key}: ${JSON.stringify(value)}\n`;
        // Append to log file
        await fs.appendFile(logFile, logEntry, "utf8");
    }
    catch (error) {
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
                            request: { args, type, url, headers, body },
                            response,
                        }),
                    },
                ],
            };
        }
        else {
            throw new Error(`Unknown tool: ${name}`);
        }
    }
    catch (error) {
        if (error instanceof z.ZodError) {
            throw new Error(`Invalid arguments: ${error.errors
                .map((e) => `${e.path.join(".")}: ${e.message}`)
                .join(", ")}`);
        }
        throw error;
    }
});
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Create Cron MCP Server running on stdio");
}
main().catch((error) => {
    console.error("Fatal error in main():", error);
    process.exit(1);
});

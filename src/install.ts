import path from "path";
import os from "os";
import { Command, Option } from "commander";
import fs from "fs";

function getClaudeDesktopConfigPath() {
  switch (process.platform) {
    case "darwin":
      return path.join(
        os.homedir(),
        "Library",
        "Application Support",
        "Claude",
        "claude_desktop_config.json"
      );
    case "win32":
      return path.join(
        process.env.APPDATA || "",
        "Claude",
        "claude_desktop_config.json"
      );
    default:
      throw new Error("Unsupported platform");
  }
}

export function updateClaudeDesktopConfig() {
  const scriptPath = process.argv[1];
  const configPath = getClaudeDesktopConfigPath();

  try {
    let config: {
      mcpServers?: { mcprestapis?: { command: string; args?: string[] } };
    } = {};
    try {
      config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    } catch (err) {
      console.log("Creating new config file");
    }

    config.mcpServers = config.mcpServers || {};

    if (process.platform === "win32") {
      config.mcpServers["mcprestapis"] = {
        command: "C:\\Program Files\\nodejs\\node.exe",
        args: [scriptPath],
      };
    } else {
      config.mcpServers["mcprestapis"] = {
        command: `mcprestapis`,
        args: ["serve"],
      };
    }

    const configDir = path.dirname(configPath);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log("Updated config at:", configPath);
    console.log("Added server with command:", scriptPath);
  } catch (err) {
    console.error("Error updating config:", err);
    process.exit(1);
  }
}

export const installCommand = new Command("install").action((args) => {
  updateClaudeDesktopConfig();
});

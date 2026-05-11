import type { ToolDefinition, ToolResult } from '../core/types';

export interface SDKTool {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties?: Record<string, { type: string; description?: string }>;
    required?: string[];
  };
}

export abstract class BaseTool {
  abstract name: string;
  abstract description: string;
  abstract parameterDescriptions: Record<string, string>;

  abstract execute(input: unknown): Promise<ToolResult>;

  getDefinition(): ToolDefinition {
    return {
      name: this.name,
      description: this.description,
      inputSchema: this.parameterDescriptions as Record<string, unknown>
    };
  }

  getSDKTool(): SDKTool {
    const properties: Record<string, { type: string; description?: string }> = {};
    const required: string[] = [];

    for (const [key, desc] of Object.entries(this.parameterDescriptions)) {
      const isOptional = desc.startsWith('可选');
      if (!isOptional) {
        required.push(key);
      }
      properties[key] = {
        type: 'string',
        description: desc
      };
    }

    return {
      name: this.name,
      description: this.description,
      input_schema: {
        type: 'object',
        properties,
        required: required.length > 0 ? required : undefined
      }
    };
  }

  formatForPrompt(): string {
    const params = Object.entries(this.parameterDescriptions)
      .map(([key, desc]) => `  - ${key}: ${desc}`)
      .join('\n');
    return `${this.name}\n  ${this.description}\n${params}`;
  }
}

export class ToolRegistry {
  private tools: Map<string, BaseTool> = new Map();

  register(tool: BaseTool): void {
    this.tools.set(tool.name, tool);
  }

  get(name: string): BaseTool | undefined {
    return this.tools.get(name);
  }

  getAll(): BaseTool[] {
    return Array.from(this.tools.values());
  }

  getNames(): string[] {
    return Array.from(this.tools.keys());
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  async execute(name: string, input: unknown): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      return {
        success: false,
        output: '',
        error: `Tool ${name} not found`
      };
    }

    try {
      const result = await tool.execute(input);
      return result;
    } catch (error) {
      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  getAllDefinitions(): ToolDefinition[] {
    return this.getAll().map(t => t.getDefinition());
  }

  getSDKTools(): SDKTool[] {
    return this.getAll().map(t => t.getSDKTool());
  }

  formatToolsForPrompt(): string {
    return this.getAll()
      .map(t => t.formatForPrompt())
      .join('\n\n');
  }
}

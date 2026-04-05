import Anthropic from '@anthropic-ai/sdk';
import { AgentRole, AgentStatus, EventCategory } from '@/lib/types';
import { pushEvent } from '@/lib/event-store';

const MODEL = 'claude-opus-4-20250514';

export interface AgentConfig {
  role: AgentRole;
  displayName: string;
  systemPrompt: string;
  categories: EventCategory[];
}

export interface AgentTask {
  instruction: string;
  category: EventCategory;
  metadata?: Record<string, unknown>;
}

/**
 * Base agent runner powered by Claude Opus.
 * Each agent role extends this with its own system prompt and capabilities.
 */
export class BaseAgent {
  private client: Anthropic;
  private config: AgentConfig;

  constructor(config: AgentConfig) {
    this.client = new Anthropic(); // Uses ANTHROPIC_API_KEY env var
    this.config = config;
  }

  /** Log an action to the event store (shows up on dashboard in real-time) */
  async logActivity(action: string, status: AgentStatus, category: EventCategory, metadata?: Record<string, unknown>) {
    return pushEvent({
      agentRole: this.config.role,
      status,
      action,
      category,
      metadata,
    });
  }

  /** Execute a task using Claude Opus with full compute */
  async executeTask(task: AgentTask): Promise<string> {
    // Log that we're starting work
    await this.logActivity(
      `Starting: ${task.instruction}`,
      'working',
      task.category,
      task.metadata
    );

    try {
      const response = await this.client.messages.create({
        model: MODEL,
        max_tokens: 16384,
        system: this.config.systemPrompt,
        messages: [
          {
            role: 'user',
            content: task.instruction,
          },
        ],
      });

      const result = response.content
        .filter((block) => block.type === 'text')
        .map((block) => {
          if (block.type === 'text') return block.text;
          return '';
        })
        .join('\n');

      // Log completion
      await this.logActivity(
        `Completed: ${task.instruction}`,
        'idle',
        task.category,
        { ...task.metadata, tokensUsed: response.usage?.output_tokens }
      );

      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      await this.logActivity(
        `Error: ${message}`,
        'error',
        task.category,
        task.metadata
      );
      throw error;
    }
  }

  /** Execute a multi-turn conversation with Claude Opus */
  async executeConversation(
    messages: Anthropic.MessageParam[],
    category: EventCategory,
    description: string,
    metadata?: Record<string, unknown>
  ): Promise<string> {
    await this.logActivity(description, 'working', category, metadata);

    try {
      const response = await this.client.messages.create({
        model: MODEL,
        max_tokens: 16384,
        system: this.config.systemPrompt,
        messages,
      });

      const result = response.content
        .filter((block) => block.type === 'text')
        .map((block) => {
          if (block.type === 'text') return block.text;
          return '';
        })
        .join('\n');

      await this.logActivity(
        `Completed: ${description}`,
        'idle',
        category,
        { ...metadata, tokensUsed: response.usage?.output_tokens }
      );

      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      await this.logActivity(`Error: ${message}`, 'error', category, metadata);
      throw error;
    }
  }

  get role() {
    return this.config.role;
  }

  get name() {
    return this.config.displayName;
  }
}

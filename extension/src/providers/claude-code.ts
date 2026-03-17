import { spawn, type ChildProcess } from 'child_process';
import type {
  LLMProvider,
  LLMModel,
  LLMMessage,
  LLMRequestOptions,
  LLMStreamEvent,
} from '../types/llm';

/**
 * Claude Code CLI Provider.
 *
 * Spawns `claude` CLI as subprocess with `--print --output-format stream-json --verbose`.
 * Uses Claude Code's own OAuth authentication (Claude Max/Pro subscription).
 * No API key needed — auth handled by Claude Code itself.
 */
export class ClaudeCodeProvider implements LLMProvider {
  readonly id = 'claude-code';
  readonly name = 'Claude (CC)';
  private available: boolean | null = null;

  setApiKey(_apiKey: string): void {
    // Not needed — auth handled by Claude Code CLI
  }

  getModels(): LLMModel[] {
    return [
      { id: 'sonnet', name: 'Claude Sonnet (via CC)', tier: 'medium', inputCostPer1M: 0, outputCostPer1M: 0, contextWindow: 200000, maxOutputTokens: 16000 },
      { id: 'opus', name: 'Claude Opus (via CC)', tier: 'high', inputCostPer1M: 0, outputCostPer1M: 0, contextWindow: 200000, maxOutputTokens: 16000 },
      { id: 'haiku', name: 'Claude Haiku (via CC)', tier: 'low', inputCostPer1M: 0, outputCostPer1M: 0, contextWindow: 200000, maxOutputTokens: 16000 },
    ];
  }

  /** Check if claude CLI is available */
  async detect(): Promise<boolean> {
    if (this.available !== null) return this.available;

    return new Promise((resolve) => {
      const proc = spawn('claude', ['--version'], {
        shell: true,
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 5000,
      });

      let stdout = '';
      proc.stdout?.on('data', (d: Buffer) => { stdout += d.toString(); });

      proc.on('close', (code) => {
        this.available = code === 0;
        resolve(this.available);
      });

      proc.on('error', (err) => {
        this.available = false;
        console.error(`[ClaudeCode] detect error:`, err.message);
        resolve(false);
      });
    });
  }

  async *streamMessage(
    model: string,
    messages: LLMMessage[],
    options?: LLMRequestOptions,
  ): AsyncGenerator<LLMStreamEvent> {
    // Build prompt from last message
    const lastMessage = messages[messages.length - 1];
    const prompt = typeof lastMessage.content === 'string'
      ? lastMessage.content
      : lastMessage.content.map(b => b.type === 'text' ? b.text : '').join('');

    // Only safe, short flags go as args.
    // Prompt & system prompt go through stdin to avoid Windows cmd.exe escaping issues
    // (multi-line Korean text with special chars breaks shell argument passing)
    const args = [
      '-p',
      '--output-format', 'stream-json',
      '--verbose',
      '--model', model,
    ];

    // Note: Claude CLI -p mode does not support --max-tokens (v2.1.76+)

    // DO NOT pass prompt or --system-prompt as args (breaks on Windows cmd.exe with multi-line text)
    // Instead, combine system instructions + user message and pipe via stdin

    const stdinPayload = options?.system
      ? `[시스템 지시사항]\n${options.system}\n\n[사용자 메시지]\n${prompt}`
      : prompt;


    const proc = spawn('claude', args, {
      shell: true,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env },
    });

    // Write prompt via stdin (safe for all platforms, no shell escaping issues)
    proc.stdin?.write(stdinPayload);
    proc.stdin?.end();


    // Handle abort
    if (options?.signal) {
      options.signal.addEventListener('abort', () => {
        proc.kill();
      }, { once: true });
    }

    let stderrData = '';
    proc.stderr?.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      stderrData += text;
    });

    yield* this.processStream(proc, options?.signal);

    // Check if process exited with error
    const exitCode = await new Promise<number | null>((resolve) => {
      if (proc.exitCode !== null) {
        resolve(proc.exitCode);
      } else {
        proc.on('close', resolve);
      }
    });


    if (exitCode !== null && exitCode !== 0) {
      console.error(`[ClaudeCode] Process FAILED with code ${exitCode}: ${stderrData}`);
      yield {
        type: 'error',
        code: `exit_${exitCode}`,
        message: stderrData || `Claude CLI exited with code ${exitCode}`,
        retryable: false,
      };
    }
  }

  private async *processStream(
    proc: ChildProcess,
    signal?: AbortSignal,
  ): AsyncGenerator<LLMStreamEvent> {
    const stdout = proc.stdout;
    if (!stdout) {
      console.warn('[ClaudeCode] processStream — no stdout!');
      return;
    }

    let buffer = '';
    let lastText = '';
    let gotResult = false;
    let eventCount = 0;
    let deltaCount = 0;


    for await (const chunk of stdout) {
      if (signal?.aborted) {
        proc.kill();
        return;
      }

      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.trim()) continue;

        let event: any;
        try {
          event = JSON.parse(line);
        } catch {
          console.warn(`[ClaudeCode] Failed to parse line: ${line.slice(0, 100)}`);
          continue;
        }

        eventCount++;

        // Extract text from assistant messages (cumulative text, compute delta)
        if (event.type === 'assistant' && event.message?.content) {
          for (const block of event.message.content) {
            if (block.type === 'text' && block.text) {
              const newText = block.text;
              if (newText.length > lastText.length) {
                const delta = newText.slice(lastText.length);
                lastText = newText;
                deltaCount++;
                yield { type: 'delta', chunk: delta };
              }
            }
          }
        }

        // Result event = stream complete
        if (event.type === 'result') {
          gotResult = true;
          const usage = event.usage ?? {};
          const inputTokens = (usage.input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0);
          const outputTokens = usage.output_tokens ?? 0;
          yield {
            type: 'done',
            stopReason: event.stop_reason === 'max_tokens' ? 'max_tokens' : 'end_turn',
            usage: { inputTokens, outputTokens },
          };
          return;
        }
      }
    }


    if (!gotResult) {
      if (lastText.length > 0) {
        // Had content but no result event — synthesize done to preserve content
        console.warn(`[ClaudeCode] Stream ended WITHOUT result event but HAS text (${lastText.length} chars) — synthesizing done`);
        yield {
          type: 'done',
          stopReason: 'end_turn',
          usage: { inputTokens: 0, outputTokens: 0 },
        };
      } else {
        // No content at all — CLI likely failed, report as error
        console.error(`[ClaudeCode] Stream ended with NO output and NO result — CLI probably failed`);
        yield {
          type: 'error',
          code: 'no_output',
          message: 'Claude CLI produced no output (check Output panel for stderr)',
          retryable: true,
        };
      }
    }
  }

  async validateKey(_apiKey: string): Promise<boolean> {
    return this.detect();
  }
}

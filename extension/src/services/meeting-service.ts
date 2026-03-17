import type { LLMRegistry } from './llm-registry';
import type { PanelManager } from '../host/panel-manager';
import type { ConfigService } from './config-service';
import type { TeamMember, MeetingConfig } from '../types/team';
import type { LLMProvider, LLMMessage, ModelTier } from '../types/llm';
import type { AgentResult, HostMessage, MeetingSummary } from '../types/messages';

type MeetingEventCallback = (message: HostMessage) => void;

export class MeetingService {
  private readonly STAGGER_MS: number;
  private readonly MAX_RETRIES: number;
  private controllers = new Map<string, AbortController>();
  private onEventCallbacks: MeetingEventCallback[] = [];

  private readonly AGENT_TIMEOUT_MS: number;

  constructor(
    private readonly registry: LLMRegistry,
    private readonly panel: PanelManager,
    private readonly config: ConfigService,
  ) {
    this.STAGGER_MS = config.get('staggerDelayMs', 200);
    this.MAX_RETRIES = config.get('maxRetries', 2);
    this.AGENT_TIMEOUT_MS = config.get('agentTimeoutMs', 120_000);
  }

  /** Subscribe to meeting lifecycle events (agentDone, meetingDone, meetingCancelled) */
  onEvent(callback: MeetingEventCallback): void {
    this.onEventCallbacks.push(callback);
  }

  private emit(message: HostMessage): void {
    for (const cb of this.onEventCallbacks) {
      cb(message);
    }
  }

  startMeeting(meetingConfig: MeetingConfig): string {
    const controller = new AbortController();
    this.controllers.set(meetingConfig.id, controller);

    // Notify panel
    this.panel.post({
      type: 'meetingStarted',
      meetingId: meetingConfig.id,
      participants: meetingConfig.participants.map(m => m.id),
      topic: meetingConfig.topic,
      mode: meetingConfig.mode,
    });

    // Run async — don't await
    this.runMeeting(meetingConfig, controller)
      .finally(() => this.controllers.delete(meetingConfig.id));

    return meetingConfig.id;
  }

  cancelMeeting(meetingId: string): void {
    const controller = this.controllers.get(meetingId);
    if (!controller) return;
    controller.abort();
    const msg = { type: 'meetingCancelled' as const, meetingId };
    this.panel.post(msg);
    this.emit(msg);
  }

  private async runMeeting(config: MeetingConfig, controller: AbortController): Promise<void> {
    const provider = this.registry.getActive();
    const signal = controller.signal;

    try {
      if (config.mode === 'quick') {
        await this.runQuickMeeting(config, provider, signal);
      } else {
        await this.runDeepMeeting(config, provider, signal);
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      console.error(`[Meeting] Error in ${config.id}:`, err);
      // Unexpected error — send meetingDone with empty summary
      if (!signal.aborted) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        // Send error to panel so user can see what happened
        for (const member of config.participants) {
          this.panel.post({
            type: 'agentError',
            meetingId: config.id,
            agentId: member.id,
            error: errorMessage,
            retryable: false,
          });
        }
        const msg = { type: 'meetingDone' as const, meetingId: config.id, summary: this.emptySummary() };
        this.panel.post(msg);
        this.emit(msg);
      }
    }
  }

  private async runQuickMeeting(
    config: MeetingConfig,
    provider: LLMProvider,
    signal: AbortSignal,
  ): Promise<void> {
    const mediumModel = this.getModelForTier(provider, 'medium');
    const system = this.buildQuickSystemPrompt(config.participants);
    const messages: LLMMessage[] = [{ role: 'user', content: config.topic }];

    let fullContent = '';
    let seq = 0;
    const startTime = Date.now();

    for await (const event of provider.streamMessage(mediumModel, messages, {
      system,
      signal,
      maxTokens: 4096,
    })) {
      if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');

      switch (event.type) {
        case 'delta': {
          fullContent += event.chunk;
          // Parse and broadcast to each agent as chunks arrive
          this.panel.post({
            type: 'agentStream',
            meetingId: config.id,
            agentId: '_quick',
            seq: seq++,
            chunk: event.chunk,
          });
          break;
        }
        case 'done': {
          // Parse the response into per-agent sections
          const parsed = this.parseQuickResponse(fullContent, config.participants);
          const durationMs = Date.now() - startTime;

          for (const [agentId, content] of Object.entries(parsed)) {
            const agentDoneMsg = {
              type: 'agentDone' as const,
              meetingId: config.id,
              agentId,
              result: {
                content,
                tokenUsage: {
                  inputTokens: Math.round(event.usage.inputTokens / config.participants.length),
                  outputTokens: Math.round(event.usage.outputTokens / config.participants.length),
                },
                durationMs,
                model: mediumModel,
              },
            };
            this.panel.post(agentDoneMsg);
            this.emit(agentDoneMsg);
          }

          const summary = await this.buildQuickSummary(parsed, event.usage, durationMs, mediumModel, provider, signal);
          const doneMsg = { type: 'meetingDone' as const, meetingId: config.id, summary };
          this.panel.post(doneMsg);
          this.emit(doneMsg);
          return;
        }
        case 'error': {
          for (const member of config.participants) {
            this.panel.post({
              type: 'agentError',
              meetingId: config.id,
              agentId: member.id,
              error: event.message,
              retryable: event.retryable,
            });
          }
          const errDoneMsg = { type: 'meetingDone' as const, meetingId: config.id, summary: this.emptySummary() };
          this.panel.post(errDoneMsg);
          this.emit(errDoneMsg);
          return;
        }
      }
    }
  }

  private async runDeepMeeting(
    config: MeetingConfig,
    provider: LLMProvider,
    signal: AbortSignal,
  ): Promise<void> {
    const tasks = config.participants.map((member, idx) =>
      this.delay(idx * this.STAGGER_MS).then(() => {
        if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
        return this.runSingleAgent(config.id, member, config.topic, provider, signal);
      }),
    );

    const results = await Promise.allSettled(tasks);

    if (!signal.aborted) {
      const summary = await this.buildDeepSummary(results, config, provider, signal);
      const deepDoneMsg = { type: 'meetingDone' as const, meetingId: config.id, summary };
      this.panel.post(deepDoneMsg);
      this.emit(deepDoneMsg);
    }
  }

  private async runSingleAgent(
    meetingId: string,
    member: TeamMember,
    topic: string,
    provider: LLMProvider,
    signal: AbortSignal,
    attempt = 1,
  ): Promise<AgentResult> {
    const model = this.getModelForTier(provider, member.salary);
    const system = this.buildAgentSystemPrompt(member);
    const messages: LLMMessage[] = [{ role: 'user', content: topic }];

    let seq = 0;
    let fullContent = '';
    const startTime = Date.now();


    // Per-agent timeout — abort if LLM hangs
    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => timeoutController.abort(), this.AGENT_TIMEOUT_MS);

    // Combined signal: abort when either parent or timeout fires
    const combinedController = new AbortController();
    const abortCombined = () => { combinedController.abort(); };
    const onParentAbort = () => { abortCombined(); clearTimeout(timeoutId); };
    const onTimeoutAbort = () => { abortCombined(); };

    if (signal.aborted) {
      combinedController.abort();
    } else {
      signal.addEventListener('abort', onParentAbort, { once: true });
    }
    if (timeoutController.signal.aborted) {
      combinedController.abort();
    } else {
      timeoutController.signal.addEventListener('abort', onTimeoutAbort, { once: true });
    }

    const combinedSignal = combinedController.signal;

    const cleanup = () => {
      clearTimeout(timeoutId);
      signal.removeEventListener('abort', onParentAbort);
      timeoutController.signal.removeEventListener('abort', onTimeoutAbort);
    };

    try {
      for await (const event of provider.streamMessage(model, messages, { system, signal: combinedSignal })) {
        if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
        if (timeoutController.signal.aborted) throw new Error(`Timeout after ${this.AGENT_TIMEOUT_MS / 1000}s`);

        switch (event.type) {
          case 'delta':
            fullContent += event.chunk;
            this.panel.post({
              type: 'agentStream',
              meetingId,
              agentId: member.id,
              seq: seq++,
              chunk: event.chunk,
            });
            break;
          case 'done': {
            cleanup();
            const result: AgentResult = {
              content: fullContent,
              tokenUsage: event.usage,
              durationMs: Date.now() - startTime,
              model,
            };
            const agentDoneMsg = { type: 'agentDone' as const, meetingId, agentId: member.id, result };
            this.panel.post(agentDoneMsg);
            this.emit(agentDoneMsg);
            return result;
          }
          case 'error': {
            console.error(`[MeetingService] agent=${member.id} ERROR — ${event.message} retryable=${event.retryable}`);
            if (event.retryable && attempt <= this.MAX_RETRIES) {
              cleanup();
              this.panel.post({
                type: 'agentError',
                meetingId,
                agentId: member.id,
                error: event.message,
                retryable: true,
              });
              // Exponential backoff
              await this.delay(1000 * Math.pow(2, attempt - 1));
              return this.runSingleAgent(meetingId, member, topic, provider, signal, attempt + 1);
            }
            this.panel.post({
              type: 'agentError',
              meetingId,
              agentId: member.id,
              error: event.message,
              retryable: false,
            });
            throw new Error(event.message);
          }
        }
      }
    } catch (err: unknown) {
      cleanup();
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw err;
      }
      if (err instanceof Error && attempt <= this.MAX_RETRIES) {
        this.panel.post({
          type: 'agentError',
          meetingId,
          agentId: member.id,
          error: err.message,
          retryable: true,
        });
        await this.delay(1000 * Math.pow(2, attempt - 1));
        return this.runSingleAgent(meetingId, member, topic, provider, signal, attempt + 1);
      }
      this.panel.post({
        type: 'agentError',
        meetingId,
        agentId: member.id,
        error: err instanceof Error ? err.message : 'Unknown error',
        retryable: false,
      });
      throw err;
    }

    cleanup();
    throw new Error('Stream ended without done event');
  }

  retryAgent(meetingId: string, agentId: string, member: TeamMember, topic: string): void {
    const controller = this.controllers.get(meetingId);
    if (!controller) return;

    const provider = this.registry.getActive();
    this.runSingleAgent(meetingId, member, topic, provider, controller.signal)
      .catch(() => { /* errors already sent via postMessage */ });
  }

  private parseQuickResponse(
    content: string,
    participants: TeamMember[],
  ): Record<string, string> {
    const result: Record<string, string> = {};
    const sections = content.split(/^###\s+/m).filter(s => s.trim());

    if (sections.length === 0) {
      // Fallback: assign all content to first participant
      if (participants.length > 0) {
        result[participants[0].id] = content;
      }
      return result;
    }

    for (const section of sections) {
      const lines = section.split('\n');
      const header = lines[0].trim();
      const body = lines.slice(1).join('\n').trim();

      // Try to match header to a participant by name
      const matched = participants.find(m =>
        header.includes(m.name) || header.includes(m.roleLabel),
      );

      if (matched) {
        result[matched.id] = body;
      }
    }

    // If parsing missed some participants, assign remaining content
    const unmatched = participants.filter(m => !result[m.id]);
    if (unmatched.length > 0 && Object.keys(result).length === 0) {
      // Complete parse failure — assign everything to first participant
      result[participants[0].id] = content;
    }

    return result;
  }

  private buildQuickSystemPrompt(participants: TeamMember[]): string {
    const roles = participants
      .map(m => {
        const lines = [`- **${m.name}** (${m.roleLabel}, ${m.experience}년차 ${m.experienceLevel})`];
        lines.push(`  설명: ${m.description}`);
        lines.push(`  판단기준: ${m.criteria}`);
        if (m.communicationStyle) {
          lines.push(`  말투: ${m.communicationStyle}`);
        }
        if (m.criticalRules?.length) {
          lines.push(`  금지사항: ${m.criticalRules[0]}`);
        }
        return lines.join('\n');
      })
      .join('\n\n');

    return `당신은 팀 회의 시뮬레이터입니다.
다음 팀원들의 관점에서 주어진 주제를 논의하세요.
각 팀원의 성격, 말투, 판단기준을 반영하세요:

${roles}

각 팀원의 의견을 다음 형식으로 작성하세요:
### 이름 (역할)
1. 핵심 의견 (해당 역할의 판단기준 적용)
2. 우려사항 또는 리스크 (전문성 관점에서 구체적으로)
3. 제안하는 방향

반드시 각 팀원의 정의된 말투와 성격으로 답변하세요.
모든 팀원의 의견을 포함해주세요.`;
  }

  private buildAgentSystemPrompt(member: TeamMember): string {
    const focusSection = member.analysisFocus?.length
      ? `\n## 분석 포커스\n${member.analysisFocus.map(f => `- ${f}`).join('\n')}`
      : '';

    const rulesSection = member.criticalRules?.length
      ? `\n## Critical Rules\n${member.criticalRules.map(r => `- ${r}`).join('\n')}`
      : '';

    const styleSection = member.communicationStyle
      ? `\n## Communication Style\n${member.communicationStyle}`
      : '';

    const formatSection = member.resultFormat
      ? `\n## 결과물 형식\n${member.resultFormat}`
      : '';

    const skillSection = member.skillContent
      ? `\n## 당신의 전문 스킬셋\n${member.skillContent}`
      : '';

    return `당신은 ${member.name}입니다.

## 프로필
- **역할**: ${member.roleLabel}
- **경력**: ${member.experience}년차 (${member.experienceLevel})
- **설명**: ${member.description}
- **판단 기준**: ${member.criteria}
${focusSection}${rulesSection}${styleSection}${formatSection}${skillSection}

위 프로필의 성격과 말투 그대로, 전문 스킬셋의 프레임워크를 활용해서 다음을 작성하세요:
1. 이 주제에 대한 당신의 핵심 의견 (스킬셋의 판단 기준 적용)
2. 우려사항 또는 리스크 (당신 전문성 관점에서, 구체적 수치나 체크리스트 활용)
3. 제안하는 방향 (실행 가능한 수준으로 구체적으로)
4. 다른 팀원에게 묻고 싶은 것 (1가지, 당신 역할에서 가장 중요한 미결 사항)

반드시 프로필에 정의된 말투와 성격으로 답변하세요.
다른 팀원의 의견은 모르는 상태입니다.`;
  }

  private async buildQuickSummary(
    parsed: Record<string, string>,
    usage: { inputTokens: number; outputTokens: number },
    durationMs: number,
    model: string,
    provider: LLMProvider,
    signal?: AbortSignal,
  ): Promise<MeetingSummary> {
    const totalCost = this.estimateTokenCost(usage.inputTokens, usage.outputTokens, model);
    const allResponses = Object.values(parsed).join('\n\n');
    const llmSummary = await this.generateSummaryViaLLM(allResponses, provider, signal);

    return {
      agreements: llmSummary.agreements,
      conflicts: llmSummary.conflicts,
      nextActions: llmSummary.nextActions,
      totalCost,
      totalDurationMs: durationMs,
    };
  }

  private async buildDeepSummary(
    results: PromiseSettledResult<AgentResult>[],
    _config: MeetingConfig,
    provider: LLMProvider,
    signal?: AbortSignal,
  ): Promise<MeetingSummary> {
    let totalCost = 0;
    let maxDuration = 0;
    const contentParts: string[] = [];

    for (const r of results) {
      if (r.status === 'fulfilled') {
        totalCost += this.estimateTokenCost(
          r.value.tokenUsage.inputTokens,
          r.value.tokenUsage.outputTokens,
          r.value.model,
        );
        maxDuration = Math.max(maxDuration, r.value.durationMs);
        contentParts.push(r.value.content);
      }
    }

    const allResponses = contentParts.join('\n\n');
    const llmSummary = await this.generateSummaryViaLLM(allResponses, provider, signal);

    return {
      agreements: llmSummary.agreements,
      conflicts: llmSummary.conflicts,
      nextActions: llmSummary.nextActions,
      totalCost,
      totalDurationMs: maxDuration,
    };
  }

  private async generateSummaryViaLLM(
    allResponses: string,
    provider: LLMProvider,
    signal?: AbortSignal,
  ): Promise<{ agreements: string[]; conflicts: { topic: string; opinions: { agentId: string; opinion: string }[] }[]; nextActions: string[] }> {
    const emptyResult = { agreements: [], conflicts: [], nextActions: [] };

    try {
      const model = this.getModelForTier(provider, 'low');
      const system = `다음 팀 회의 내용을 분석하여 JSON으로 응답하세요. JSON만 출력하고 다른 텍스트는 포함하지 마세요.

형식:
{
  "agreements": ["합의사항1", "합의사항2"],
  "conflicts": [{"topic": "충돌주제", "opinions": [{"agentId": "이름", "opinion": "의견"}]}],
  "nextActions": ["액션1", "액션2"]
}`;

      const messages: LLMMessage[] = [{ role: 'user', content: allResponses }];

      let fullContent = '';
      for await (const event of provider.streamMessage(model, messages, {
        system,
        maxTokens: 500,
        signal,
      })) {
        switch (event.type) {
          case 'delta':
            fullContent += event.chunk;
            break;
          case 'done': {
            // Extract JSON from response (handle possible markdown code blocks)
            let jsonStr = fullContent.trim();
            const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
            if (codeBlockMatch) {
              jsonStr = codeBlockMatch[1].trim();
            }
            const parsed = JSON.parse(jsonStr);
            return {
              agreements: Array.isArray(parsed.agreements)
                ? parsed.agreements.filter((a: unknown) => typeof a === 'string')
                : [],
              conflicts: Array.isArray(parsed.conflicts)
                ? parsed.conflicts.filter((c: any) => c && typeof c.topic === 'string' && Array.isArray(c.opinions))
                : [],
              nextActions: Array.isArray(parsed.nextActions)
                ? parsed.nextActions.filter((a: unknown) => typeof a === 'string')
                : [],
            };
          }
          case 'error':
            console.error(`[MeetingService] generateSummaryViaLLM error: ${event.message}`);
            return emptyResult;
        }
      }

      return emptyResult;
    } catch (err: unknown) {
      console.error('[MeetingService] generateSummaryViaLLM failed:', err);
      return emptyResult;
    }
  }

  private estimateTokenCost(inputTokens: number, outputTokens: number, model: string): number {
    const provider = this.registry.getActive();
    const modelInfo = provider.getModels().find(m => m.id === model);
    if (!modelInfo) return 0;

    return (
      (inputTokens / 1_000_000) * modelInfo.inputCostPer1M +
      (outputTokens / 1_000_000) * modelInfo.outputCostPer1M
    );
  }

  private emptySummary(): MeetingSummary {
    return {
      agreements: [],
      conflicts: [],
      nextActions: [],
      totalCost: 0,
      totalDurationMs: 0,
    };
  }

  private getModelForTier(provider: LLMProvider, tier: ModelTier): string {
    const models = provider.getModels();
    return models.find(m => m.tier === tier)?.id ?? models[0].id;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

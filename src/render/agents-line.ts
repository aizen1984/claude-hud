import type { RenderContext, AgentEntry } from '../types.js';
import { yellow, green, magenta, dim, agentModel as agentModelColor } from './colors.js';

const LONG_RUNNING_THRESHOLD_MS = 180_000; // 3 minutes

export function renderAgentsLine(ctx: RenderContext): string | null {
  const { agents } = ctx.transcript;
  const colors = ctx.config?.colors;

  const runningAgents = agents.filter((a) => a.status === 'running');
  const now = Date.now();
  const recentCompleted = agents
    .filter((a) => a.status === 'completed' && a.endTime && (now - a.endTime.getTime()) < 30_000)
    .slice(-3);

  const toShow = [...runningAgents, ...recentCompleted];

  if (toShow.length === 0) {
    return null;
  }

  const parts: string[] = [];

  for (const agent of toShow) {
    parts.push(formatAgent(agent, colors));
  }

  return parts.join('\n');
}

function formatAgent(agent: AgentEntry, colors?: RenderContext['config']['colors']): string {
  const isRunning = agent.status === 'running';
  const icon = isRunning ? yellow('◐') : green('✓');

  // Layout: icon 🤖 type [model] description  elapsed
  const typeLabel = agent.type && agent.type !== 'unknown' ? magenta(agent.type) : '';
  const model = agent.model ? agentModelColor(`[${agent.model}]`, colors) : '';
  const meta = [typeLabel, model].filter(Boolean).join(' ');

  const desc = agent.description
    ? truncateDesc(agent.description, 60)
    : '';

  const elapsed = formatElapsed(agent);

  return `${icon} 🤖 ${meta ? `${meta} ` : ''}${desc}  ${elapsed}`;
}

function truncateDesc(desc: string, maxLen: number = 60): string {
  if (desc.length <= maxLen) return desc;
  return desc.slice(0, maxLen - 3) + '...';
}

function formatElapsed(agent: AgentEntry): string {
  const now = Date.now();
  const start = agent.startTime.getTime();
  const end = agent.endTime?.getTime() ?? now;
  const ms = end - start;

  let timeStr: string;
  if (ms < 1000) timeStr = '<1s';
  else if (ms < 60000) timeStr = `${Math.round(ms / 1000)}s`;
  else {
    const mins = Math.floor(ms / 60000);
    const secs = Math.round((ms % 60000) / 1000);
    timeStr = `${mins}m${secs}s`;
  }

  // Long running agents get yellow elapsed time
  if (ms >= LONG_RUNNING_THRESHOLD_MS && agent.status === 'running') {
    return yellow(timeStr);
  }
  return dim(timeStr);
}

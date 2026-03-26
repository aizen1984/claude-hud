import type { RenderContext } from '../types.js';
import { yellow, green, dim, skill as skillColor, RESET } from './colors.js';

const TOOL_ICONS: Record<string, string> = {
  Read: '📘',
  Glob: '🔍',
  Grep: '🔍',
  Edit: '✏️',
  Write: '📝',
  Bash: '📟',
  Agent: '🤖',
  Skill: '🧩',
};

// Merge these tools into one count in display
const MERGE_TOOLS: Record<string, string> = {
  Grep: 'Glob',   // search
  Write: 'Edit',  // write
};

function toolIcon(name: string): string {
  // Trailing space prevents emoji overlap in terminals with inconsistent emoji width (e.g. IntelliJ IDEA)
  return (TOOL_ICONS[name] ?? '🔧') + ' ';
}

export function renderToolsLine(ctx: RenderContext): string | null {
  const { tools } = ctx.transcript;
  const colors = ctx.config?.colors;
  const turnStart = ctx.transcript.lastUserMessageTime;

  if (tools.length === 0) {
    return null;
  }

  // Only show tools from the current turn (after latest user message)
  const currentTurnTools = turnStart
    ? tools.filter((t) => t.startTime >= turnStart)
    : tools;

  if (currentTurnTools.length === 0) {
    return null;
  }

  const parts: string[] = [];

  // Exclude Agent/Task from tools display (shown in agents-line)
  const AGENT_NAMES = new Set(['Agent', 'Task']);
  const realTools = currentTurnTools.filter((t) => !AGENT_NAMES.has(t.name) && !t.isSkill);
  const skillTools = currentTurnTools.filter((t) => t.isSkill);

  // 0. Skill calls first (highest priority)
  const runningSkills = skillTools.filter((t) => t.status === 'running');
  const now = Date.now();
  const recentCompletedSkills = skillTools
    .filter((t) => t.status === 'completed' && t.endTime && (now - t.endTime.getTime()) < 30_000)
    .slice(-2);

  for (const s of runningSkills) {
    const name = s.target ? `/${s.target}` : '/skill';
    parts.push(`${skillColor('⚡' + name, colors)}`);
  }
  for (const s of recentCompletedSkills) {
    const name = s.target ? `/${s.target}` : '/skill';
    parts.push(`${green('✓' + name)}`);
  }

  // 1. Always show running tools with target (file path)
  const runningTools = realTools.filter((t) => t.status === 'running');
  for (const tool of runningTools.slice(-3)) {
    const target = tool.target
      ? (tool.name === 'Bash' ? tool.target : basename(tool.target))
      : '';
    parts.push(`${yellow('◐')} ${toolIcon(tool.name)}${target ? dim(` ${target}`) : ''}`);
  }

  // 2. Find the most recent batch of completed tools
  //    A "batch" = tools within 90s of the latest completed tool
  const completedTools = realTools
    .filter((t) => t.status === 'completed' || t.status === 'error')
    .sort((a, b) => (a.endTime?.getTime() ?? 0) - (b.endTime?.getTime() ?? 0));

  let editedFiles: string[] = [];

  if (completedTools.length > 0) {
    const latestEnd = completedTools[completedTools.length - 1].endTime?.getTime() ?? Date.now();
    const batchCutoff = latestEnd - 90_000; // 90 seconds window

    const batchTools = completedTools.filter(
      (t) => (t.endTime?.getTime() ?? 0) >= batchCutoff
    );

    // Collect edited file names for detail line
    const EDIT_NAMES = new Set(['Edit', 'Write']);
    const seen = new Set<string>();
    for (const tool of batchTools) {
      if (EDIT_NAMES.has(tool.name) && tool.target) {
        const name = basename(tool.target);
        if (!seen.has(name)) {
          seen.add(name);
          editedFiles.push(name);
        }
      }
    }

    // Group by name with count (merge similar tools), excluding Edit/Write if we have editedFiles
    const toolCounts = new Map<string, number>();
    for (const tool of batchTools) {
      // Skip Edit/Write from counts when editedFiles list is shown
      if (editedFiles.length > 0 && EDIT_NAMES.has(tool.name)) continue;
      const displayName = MERGE_TOOLS[tool.name] ?? tool.name;
      toolCounts.set(displayName, (toolCounts.get(displayName) ?? 0) + 1);
    }

    const sorted = Array.from(toolCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    for (const [name, count] of sorted) {
      parts.push(`${toolIcon(name)}${dim(`${count}`)}`);
    }
  }

  // 3. Edited files list (yellow, inline)
  if (editedFiles.length > 0) {
    const MAX_FILES = 5;
    const shown = editedFiles.slice(0, MAX_FILES);
    const extra = editedFiles.length - MAX_FILES;
    const fileList = shown.join(', ') + (extra > 0 ? ` +${extra}` : '');
    parts.push(`✏️  ${yellow(fileList)}`);
  }

  if (parts.length === 0) {
    return null;
  }

  return parts.join('  ');
}

function basename(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/');
  const parts = normalized.split('/');
  const name = parts.pop() || normalized;
  if (name.length > 30) return name.slice(0, 27) + '...';
  return name;
}

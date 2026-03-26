import type { RenderContext } from '../../types.js';
import { label, RESET } from '../colors.js';

export function renderCostLine(ctx: RenderContext): string | null {
  const display = ctx.config?.display;

  if (display?.showCost === false) {
    return null;
  }

  const cost = ctx.stdin.cost;
  if (!cost || typeof cost.total_cost_usd !== 'number') {
    return null;
  }

  const colors = ctx.config?.colors;
  const costDisplay = formatCost(cost.total_cost_usd);

  return `${label('Cost', colors)} ${costDisplay}`;
}

export function formatCost(usd: number): string {
  if (usd < 0.01) {
    return `$${usd.toFixed(4)}`;
  }
  if (usd < 1) {
    return `$${usd.toFixed(3)}`;
  }
  return `$${usd.toFixed(2)}`;
}

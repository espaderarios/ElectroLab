/** Editing tools use an explicit neutral mode so clicking an already-active
 * toolbar button can release it instead of leaving it permanently highlighted.
 * Palette selections use their own command and do not toggle automatically.
 */
import type { ToolId } from './types';

export type ToggleableTool = 'select' | 'wire';

export function nextToggleableTool(
  current: ToolId,
  requested: ToggleableTool,
  panActive = false,
): ToolId {
  return !panActive && current === requested ? 'none' : requested;
}

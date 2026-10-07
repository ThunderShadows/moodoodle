import { BOARD_COLORS, type Board, type BoardColor, type SavedImage } from './types';

export const FREE_BOARD_LIMIT = 3;
/** Off until payments ship: there is no Plus yet to lift the limit (v1.2 spec §3.2). */
export const ENFORCE_BOARD_LIMIT = false;
export const MAX_BOARD_NAME = 40;

export type BoardNameError = 'empty' | 'too-long' | 'duplicate';

export const BOARD_NAME_ERRORS: Record<BoardNameError, string> = {
  empty: 'Give your board a name',
  'too-long': `Keep it under ${MAX_BOARD_NAME} characters`,
  duplicate: 'You already have a board with that name',
};

export class BoardNameInvalid extends Error {
  constructor(public readonly reason: BoardNameError) {
    super(BOARD_NAME_ERRORS[reason]);
  }
}

export function validateBoardName(
  raw: string,
  boards: Board[],
  exceptId?: string,
): { ok: true; name: string } | { ok: false; error: BoardNameError } {
  const name = raw.trim().replace(/\s+/g, ' ');
  if (!name) return { ok: false, error: 'empty' };
  if (name.length > MAX_BOARD_NAME) return { ok: false, error: 'too-long' };
  const lower = name.toLowerCase();
  if (boards.some((b) => b.id !== exceptId && b.name.toLowerCase() === lower)) return { ok: false, error: 'duplicate' };
  return { ok: true, name };
}

export interface BoardQuota {
  used: number;
  limit: number;
  visible: boolean;
  atLimit: boolean;
}

export function boardQuota(used: number, opts: { enforce: boolean; plus: boolean }): BoardQuota {
  const visible = opts.enforce && !opts.plus;
  return { used, limit: FREE_BOARD_LIMIT, visible, atLimit: visible && used >= FREE_BOARD_LIMIT };
}

export function boardCounts(images: SavedImage[]): { all: number; unsorted: number; byBoard: Record<string, number> } {
  const byBoard: Record<string, number> = {};
  let unsorted = 0;
  for (const img of images) {
    if (img.boardIds.length === 0) unsorted++;
    for (const id of img.boardIds) byBoard[id] = (byBoard[id] ?? 0) + 1;
  }
  return { all: images.length, unsorted, byBoard };
}

export function nextBoardColor(boards: Board[]): BoardColor {
  return BOARD_COLORS[boards.length % BOARD_COLORS.length]!;
}

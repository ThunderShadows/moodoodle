import { describe, it, expect } from 'vitest';
import { validateBoardName, boardQuota, boardCounts, nextBoardColor, FREE_BOARD_LIMIT } from './boards';
import { emptyCredit, type Board, type SavedImage } from './types';

const board = (id: string, name: string): Board => ({ id, name, color: 'peach', createdAt: '2026-10-07T00:00:00.000Z' });
const img = (id: string, boardIds: string[]): SavedImage => ({
  id, imageUrl: `https://x.com/${id}.png`, pageUrl: 'https://x.com', pageTitle: 'P', site: 'x.com',
  savedAt: '2026-10-07T00:00:00.000Z', width: 1, height: 1, mimeType: 'image/png', byteSize: 1,
  palette: [], colorFamily: 'neutral', tags: [], boardIds, credit: emptyCredit(),
});

describe('validateBoardName', () => {
  it('trims and collapses spaces', () => {
    expect(validateBoardName('  Ocean   study ', [])).toEqual({ ok: true, name: 'Ocean study' });
  });
  it('rejects empty and too-long names', () => {
    expect(validateBoardName('   ', [])).toEqual({ ok: false, error: 'empty' });
    expect(validateBoardName('x'.repeat(41), [])).toEqual({ ok: false, error: 'too-long' });
  });
  it('rejects names that differ only by case or spacing', () => {
    expect(validateBoardName('ocean  STUDY', [board('a', 'Ocean study')])).toEqual({ ok: false, error: 'duplicate' });
  });
  it('allows keeping the same name when renaming that board', () => {
    expect(validateBoardName('Ocean study', [board('a', 'Ocean study')], 'a')).toEqual({ ok: true, name: 'Ocean study' });
  });
});

describe('boardQuota', () => {
  it('is hidden while the limit is not enforced', () => {
    expect(boardQuota(5, { enforce: false, plus: false })).toMatchObject({ visible: false, atLimit: false });
  });
  it('shows the meter and hits the limit at 3 on free', () => {
    expect(boardQuota(2, { enforce: true, plus: false })).toEqual({ used: 2, limit: FREE_BOARD_LIMIT, visible: true, atLimit: false });
    expect(boardQuota(3, { enforce: true, plus: false })).toMatchObject({ visible: true, atLimit: true });
  });
  it('never limits Plus', () => {
    expect(boardQuota(9, { enforce: true, plus: true })).toMatchObject({ visible: false, atLimit: false });
  });
});

describe('boardCounts', () => {
  it('counts all, unsorted and per board (an image can be in several)', () => {
    expect(boardCounts([img('1', []), img('2', ['a']), img('3', ['a', 'b'])])).toEqual({ all: 3, unsorted: 1, byBoard: { a: 2, b: 1 } });
  });
});

describe('nextBoardColor', () => {
  it('cycles through the palette', () => {
    expect(nextBoardColor([])).toBe('peach');
    expect(nextBoardColor([board('a', 'A')])).toBe('mint');
    expect(nextBoardColor(Array.from({ length: 6 }, (_, i) => board(String(i), String(i))))).toBe('peach');
  });
});

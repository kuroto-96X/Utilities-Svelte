type KeyType = 'white' | 'black';

const PC_INFO: Record<number, { type: KeyType; whiteIndex?: number; afterWhiteIndex?: number }> = {
  0:  { type: 'white', whiteIndex: 0 },
  1:  { type: 'black', afterWhiteIndex: 0 },
  2:  { type: 'white', whiteIndex: 1 },
  3:  { type: 'black', afterWhiteIndex: 1 },
  4:  { type: 'white', whiteIndex: 2 },
  5:  { type: 'white', whiteIndex: 3 },
  6:  { type: 'black', afterWhiteIndex: 3 },
  7:  { type: 'white', whiteIndex: 4 },
  8:  { type: 'black', afterWhiteIndex: 4 },
  9:  { type: 'white', whiteIndex: 5 },
  10: { type: 'black', afterWhiteIndex: 5 },
  11: { type: 'white', whiteIndex: 6 },
};

export const WHITE_W = 48;
export const WHITE_H = 180;
export const BLACK_W = 28;
export const BLACK_H = 112;
export const TOTAL_WIDTH = 7 * WHITE_W;

export interface LayoutKey { pc: number; windowIndex: number; x: number; }

export function buildKeyboardWindow(startSemitone: number): { whiteKeys: LayoutKey[]; blackKeys: LayoutKey[] } {
  const items = Array.from({ length: 12 }, (_, i) => {
    const s = startSemitone + i;
    const oct = Math.floor(s / 12);
    const pc = ((s % 12) + 12) % 12;
    const info = PC_INFO[pc];
    return {
      windowIndex: i,
      pc,
      type: info.type,
      absWhiteIndex: info.type === 'white' ? oct * 7 + info.whiteIndex! : null,
      absAnchorIndex: info.type === 'black' ? oct * 7 + info.afterWhiteIndex! : null,
    };
  });

  const minAbs = Math.min(...items.filter(it => it.type === 'white').map(it => it.absWhiteIndex!));

  const whiteKeys = items
    .filter(it => it.type === 'white')
    .map(it => ({ pc: it.pc, windowIndex: it.windowIndex, x: (it.absWhiteIndex! - minAbs) * WHITE_W }));

  const blackKeys = items
    .filter(it => it.type === 'black')
    .map(it => ({ pc: it.pc, windowIndex: it.windowIndex, x: (it.absAnchorIndex! - minAbs + 1) * WHITE_W - BLACK_W / 2 }));

  return { whiteKeys, blackKeys };
}

const ROMAN = ['I','II','III','IV','V','VI','VII'];

function romanFor(thirdSemi: number, fifthSemi: number, idx: number): { base: string; quality: 'maj'|'min'|'dim'|'aug'|'other' } {
  let base = ROMAN[idx];
  let quality: 'maj'|'min'|'dim'|'aug'|'other' = 'other';
  if      (thirdSemi === 4 && fifthSemi === 7) quality = 'maj';
  else if (thirdSemi === 3 && fifthSemi === 7) quality = 'min';
  else if (thirdSemi === 3 && fifthSemi === 6) quality = 'dim';
  else if (thirdSemi === 4 && fifthSemi === 8) quality = 'aug';
  if (quality === 'min' || quality === 'dim') base = base.toLowerCase();
  if (quality === 'dim') base += '°';
  if (quality === 'aug') base += '+';
  return { base, quality };
}

export interface DiatonicChord {
  degreeIndex: number;
  roman: string;
  quality: string;
  rootPc: number;
  intervals: [number, number, number];
}

export function buildDiatonicChords(intervals: number[], rootPc: number): DiatonicChord[] | null {
  if (intervals.length !== 7) return null;
  const extended = [...intervals, ...intervals.map(v => v + 12)];
  return intervals.map((deg, d) => {
    const thirdSemi = extended[d + 2] - extended[d];
    const fifthSemi = extended[d + 4] - extended[d];
    const { base, quality } = romanFor(thirdSemi, fifthSemi, d);
    return {
      degreeIndex: d,
      roman: base,
      quality,
      rootPc: (rootPc + deg) % 12,
      intervals: [0, thirdSemi, fifthSemi],
    };
  });
}

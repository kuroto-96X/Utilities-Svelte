export interface PrintSheetSize {
  id: string
  label: string
  widthMm: number
  heightMm: number
}

export const printSheetSizes: PrintSheetSize[] = [
  { id: 'l',  label: 'L判',  widthMm: 89,  heightMm: 127 },
  { id: '2l', label: '2L判', widthMm: 127, heightMm: 178 },
]

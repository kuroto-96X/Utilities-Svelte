export interface IdPhotoPreset {
  id: string
  label: string
  note: string
  widthMm: number
  heightMm: number
}

export const idPhotoPresets: IdPhotoPreset[] = [
  { id: 'resume',        label: '履歴書用',           widthMm: 30, heightMm: 40, note: '一般的な履歴書サイズ' },
  { id: 'general-small', label: '証明写真（一般・小）', widthMm: 24, heightMm: 30, note: '各種申請書類向け' },
  { id: 'general-large', label: '証明写真（一般・大）', widthMm: 35, heightMm: 45, note: '各種申請書類向け' },
  { id: 'passport',      label: 'パスポート用',        widthMm: 35, heightMm: 45, note: 'パスポート申請向け' },
  { id: 'my-number',     label: 'マイナンバーカード用', widthMm: 35, heightMm: 45, note: 'マイナンバーカード申請向け' },
  { id: 'license',       label: '運転免許証用',        widthMm: 24, heightMm: 30, note: '運転免許証更新向け' },
]

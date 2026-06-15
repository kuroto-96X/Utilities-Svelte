export interface SnsPreset {
  id: string
  label: string
  service: string
  width: number
  height: number
}

export const snsPresets: SnsPreset[] = [
  { id: 'ig-square',   label: 'Instagram 投稿（正方形）',     service: 'Instagram', width: 1080, height: 1080 },
  { id: 'ig-portrait', label: 'Instagram 投稿（縦長）',       service: 'Instagram', width: 1080, height: 1350 },
  { id: 'ig-story',    label: 'Instagram ストーリー / リール', service: 'Instagram', width: 1080, height: 1920 },
  { id: 'x-post',      label: 'X(Twitter) 投稿画像',          service: 'X',         width: 1600, height: 900  },
  { id: 'x-header',   label: 'X(Twitter) ヘッダー画像',      service: 'X',         width: 1500, height: 500  },
  { id: 'yt-thumb',   label: 'YouTube サムネイル',            service: 'YouTube',   width: 1280, height: 720  },
  { id: 'yt-art',     label: 'YouTube チャンネルアート',      service: 'YouTube',   width: 2560, height: 1440 },
  { id: 'fb-cover',   label: 'Facebook カバー画像',           service: 'Facebook',  width: 820,  height: 312  },
  { id: 'li-post',    label: 'LinkedIn 投稿画像',             service: 'LinkedIn',  width: 1200, height: 627  },
]

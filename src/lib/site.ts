export const site = {
  name: "96X's Tools",
  tagline: "個人開発ツール集",
  author: {
    name: "96X",
    handle: "@96X_SBRB",
    bio: "ゲーム開発と楽曲制作の合間に、自分が欲しかった『ちょっとした道具』を作って置いています。",
    links: {
      x: "https://x.com/96X_SBRB",
      booth: "https://kogatagemmaipan.booth.pm/",
      youtube: "https://www.youtube.com/@96X%E3%81%93%E3%81%8C%E3%81%9F%E7%8E%84%E7%B1%B3%E3%83%91%E3%83%B3",
    },
  },
  categories: [
    { id: 'music',       label: '楽曲制作' },
    { id: 'programming', label: 'プログラミング' },
    { id: 'image',       label: '画像' },
    { id: 'investment',  label: '投資' },
  ],
  tools: [
    {
      href: "/bpm-tapper",
      label: "BPM Tapper",
      description: "タップしてBPMを計測するツール",
      category: 'music',
    },
    {
      href: "/note-duration",
      label: "BPM音符換算",
      description: "BPMから全音符〜32分音符の長さを秒・msで計算するツール",
      category: 'music',
    },
    {
      href: "/scale-visualizer",
      label: "スケールビジュアライザー",
      description: "スケール・コードを鍵盤で確認し、コード進行やメロディを試せるツール",
      category: 'music',
    },
    {
      href: "/hepburn-converter",
      label: "ヘボン式変換",
      description: "日本語をヘボン式ローマ字に変換するツール",
      category: 'programming',
    },
    {
      href: "/color-converter",
      label: "Color32/Color変換",
      description: "Unity の Color32・Color・HEX を相互変換するツール",
      category: 'programming',
    },
    {
      href: "/image-tools",
      label: "画像変換",
      description: "画像の圧縮・リサイズ・形式変換ツール",
      category: 'image',
    },
    {
      href: "/sns-image-resize",
      label: "SNS画像リサイズ",
      description: "SNS各サービスの推奨サイズにワンクリックでリサイズ・クロップするツール",
      category: 'image',
    },
    {
      href: "/id-photo",
      label: "証明写真",
      description: "証明写真・履歴書用写真のサイズ調整とコンビニ印刷用シート作成ツール",
      category: 'image',
    },
    {
      href: "/nisa-simple-calculator",
      label: "NISA年率計算",
      description: "NISAの損益率から運用年率を逆算するツール",
      category: 'investment',
    },
    {
      href: "/nisa-detailed-calculator",
      label: "NISA詳細年率計算",
      description: "投資額の変更履歴からXIRRで運用年率を計算するツール",
      category: 'investment',
    },
    {
      href: "/nisa-accumulation-simulator",
      label: "NISA積立シミュレーター",
      description: "毎月・毎年の積立投資の将来評価額と資産推移をシミュレーションするツール",
      category: 'investment',
    },
  ],
} as const

// text-sm(14px) の日本語1文字あたりの概算表示幅（実測ベース、フォント変更時は要再計測）
const CHAR_WIDTH_PX = 15
// カテゴリーボタンの左右padding (Tailwind px-2 = 8px * 2)
const BUTTON_PADDING_PX = 16
// nav の gap-1（ボタン間の間隔）
const BUTTON_GAP_PX = 4
// ロゴ「96X's Tools」(font-extrabold text-lg) + mr-4 の実測幅
const LOGO_WIDTH_PX = 130
// nav コンテナの px-4（左右合計）
const NAV_PADDING_PX = 32
// 実測誤差を吸収するための余裕
const SAFETY_MARGIN_PX = 24
// Tailwindのsmブレークポイント(640px)と揃えるための下限値。
// これを下回ると、ヘッダーはPC版に切り替わっているのにページ本体は
// 既存のsm:基準でまだスマホ版レイアウトのまま、という中間状態が生まれるため。
const MIN_BREAKPOINT_PX = 640

/**
 * 表示中カテゴリーのラベル一覧から、上部ナビ（ロゴ＋カテゴリーボタン横並び）が
 * 折り返しなしで収まるために必要な最小幅(px)を計算する。
 * サイト名・カテゴリー構成が変わらない限り、この値はビルド時に一意に決まる。
 * 既存のTailwind sm:ブレークポイント(640px)との整合を保つため、640px未満にはならない。
 */
export function calculateRequiredNavWidthPx(categoryLabels: string[]): number {
  const buttonsWidth = categoryLabels.reduce(
    (sum, label) => sum + label.length * CHAR_WIDTH_PX + BUTTON_PADDING_PX + BUTTON_GAP_PX,
    0
  )
  const requiredWidth = NAV_PADDING_PX + LOGO_WIDTH_PX + buttonsWidth + SAFETY_MARGIN_PX
  return Math.max(requiredWidth, MIN_BREAKPOINT_PX)
}

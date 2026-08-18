// トランプの裏面デザイン(紺地+インディゴ格子柄)。Solitaireから移植したもの。
// CardFace.svelte(裏向きカード)・PlayArea.svelte(山札ボタン)の両方で使う。
export const CARD_BACK_STYLE =
  'background:#0f172a;' +
  'background-image:' +
  'repeating-linear-gradient(0deg,transparent,transparent 7px,rgba(99,102,241,0.25) 7px,rgba(99,102,241,0.25) 8px),' +
  'repeating-linear-gradient(90deg,transparent,transparent 7px,rgba(99,102,241,0.25) 7px,rgba(99,102,241,0.25) 8px);'

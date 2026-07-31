# 星詠みソリティア -Shidasu- 今後の改善計画

現時点では未着手・未検討のアイデアメモ。着手する際は`superpowers:brainstorming`から設計を詰める。

1. **画面表示項目の検討**
   スコア・コンボ・チェーンなど、プレイ中に表示する情報項目自体の見直しを検討する。
   護符の並べ替えUI: `docs/shidasu-gofu-candidates.md`の型の凡例で「加算・倍算型の護符が複数ある場合、適用順はプレイヤーの護符の並べ方に依存する(左から順に適用)」と定義したため、所持護符の並び順をプレイヤーが変更できるUI・機能が必要(現状の`+page.svelte`は`[...new Set(run.items)]`で単純な一覧表示のみで、並び替え機能は無い)。
2. **「ワンパン軸」アイテムの検討**
   少ない枚数で高得点を狙う軸のアイテムは、他の軸(役ボーナス緩和・コンボ・全消し・詰み救済)に比べて手薄。新規アイテムの検討余地がある。

## 完了済み(履歴)

以下は着手済み・完了済みの改善項目。詳細は各specを参照。

- **アイテムのモチーフ・名称体系**: 秘儀=ルーン文字、天啓=二十八宿、神託=八卦で統一命名済み。護符は自由命名(`docs/shidasu-gofu-candidates.md`参照)。
- **アイテムの種類・効果の拡充**: 役ボーナス緩和(階段・列一掃)、同スート・同色・同ランク軸、コンボ軸、全消し軸、詰み救済軸、ワイルド供給アイテムまで実装済み(約80種の護符)。`docs/superpowers/specs/2026-07-09-shidasu-item-hard-yaku-relax-design.md`ほか多数。
- **デバッグ用専用画面**: `/admin/shidasu-debug`として実装済み。`docs/superpowers/specs/2026-07-15-shidasu-debug-sandbox-design.md`ほか。
- **ステージ構成(旧ボスWave構想)**: 旧`BossKind`階級制を廃止し、Wave単位の「星」(`stars`)による目標倍率・報酬・制限ルールの仕組みに再構築済み。`docs/superpowers/specs/2026-07-28-shidasu-run-structure-redesign-design.md`、`2026-07-30-shidasu-boss-tiers-removal-design.md`ほか。
- **ゲーム内通貨・ショップ**: 通貨(星片)を新設し、Wave終了ごとのショップで護符・秘儀・天啓・神託を購入できる仕組みを実装済み。`docs/superpowers/specs/2026-07-22-shidasu-currency-design.md`、`2026-07-23-shidasu-shop-design.md`ほか。
- **エフェクト・アニメーション**: カードプレイ移動・Wave開始配布・得点内訳表示・得点パーツ演出・片付け演出などを実装済み。`docs/superpowers/specs/2026-07-27-shidasu-play-card-animation-design.md`ほか多数。

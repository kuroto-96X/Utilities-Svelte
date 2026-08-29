# Godotプロジェクトの実パス(フェーズ2成果物)

## 配置場所

```
c:\Users\the-f\Documents\ClaudeProjects\Shidasu-Godot\
```

`Utilities-Svelte`とは兄弟階層の別フォルダ。ローカルgitリポジトリとして独立して初期化済み(リモートリポジトリは未作成。作成する場合はユーザーへの確認が必要)。

## ソリューション構成

```
Shidasu-Godot/
  ShidasuGodot.slnx           .NETソリューション(.slnx形式、理由はADR0001参照)
  Shidasu.code-workspace      VSCodeマルチルートワークスペース(Shidasu-Godot + Utilities-Svelte)
  .gitignore
  Game/                       Godotプロジェクト本体(project.godot、C# UIアダプタ層)
  Shidasu.Core/               Pure C#クラスライブラリ(ゲームロジック本体、Godot非依存)
  Shidasu.Core.Tests/         xUnitテストプロジェクト
  docs/adr/                   アーキテクチャ決定記録(0001〜0005)
```

## アーキテクチャ決定記録(ADR)

後続フェーズ(3〜16)は以下のADRに従うこと。

- `docs/adr/0001-project-structure.md` — ソリューション構成・フォルダ構成方針(重要: Godotプロジェクトを`Game/`サブフォルダに分離した理由=SDK暗黙globの衝突回避)
- `docs/adr/0002-state-management.md` — 状態管理パターン(`record`+`with`式)
- `docs/adr/0003-logic-ui-separation.md` — ロジック層/UI層の分離方針、Godot依存混入防止策
- `docs/adr/0004-rng-policy.md` — 乱数方針(`System.Random`+mulberry32相当の自前PRNG)
- `docs/adr/0005-csharp-conventions.md` — 命名規約・namespace構成・enum/Union型の表現方針

## 技術的な決定事項の補足

- Godotバージョン: 4.6.3(2026年8月時点の最新安定版)を前提に`Godot.NET.Sdk/4.6.3`を指定。
- TargetFramework: `net8.0`(Godot 4.6系の既定値)。全3プロジェクトで統一。
- ビルド確認済み: `dotnet build ShidasuGodot.slnx`で3プロジェクトとも成功。

## 既知の環境上の注意点

このAIエージェントの実行環境には.NET 10 SDK/ランタイムのみがインストールされており、**net8.0の実行用ランタイムがインストールされていない**。そのため`dotnet build`(コンパイル)は成功するが、`dotnet test`等の実行(ランタイムが必要な操作)はこの環境では失敗する(`You must install or update .NET to run this application`エラー)。

実際にGodotエディタで開発・実行する際は、Godot 4.6.3エディタ本体がnet8.0ランタイムを内包/解決するため通常は問題にならないが、Godotを使わず`dotnet test`等をコマンドラインで直接実行したい場合は、.NET 8.0 ランタイム(またはSDK)を別途インストールする必要がある(.NET 10と共存可能、通常のside-by-installで問題ない)。ユーザー側で必要に応じてインストールを検討すること。

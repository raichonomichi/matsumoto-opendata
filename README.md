# matsumoto-opendata

松本市オープンデータを活用した、すぐに使える1ページ完結型のミニサービスを公開するサイトです（JSON API としての公開は非対応）。

- 公開URL（予定）: `https://modata.raichonomichi.net`
- アイデア一覧: [GitHub Issues](https://github.com/raichonomichi/matsumoto-opendata/issues)

## 技術スタック・基盤構成

- **フロントエンド**: Astro + TypeScript + Tailwind CSS v4（重いUI・地図・3Dはページ単位で独立導入）
- **ホスティング**: Cloudflare Workers（Static Assets）＋ GitHub Actions 自動デプロイ
  - 大容量データ（3D Tiles 等）は必要時に Cloudflare R2 へ配置
- **データ整形**: TypeScript (`tsx` + `zod`)（GIS/CityGML 等の特殊処理のみ必要時に Python 併用）
- **品質管理**: `pnpm` / Biome / Vitest / `astro check`

## ディレクトリ構成

```text
├── src/
│   ├── content/
│   │   ├── datasets/        # オープンデータのメタ情報（出典・ライセンス・更新日）
│   │   └── services/        # 公開サービスのメタ情報（TOPページ一覧へ自動反映）
│   ├── components/          # 共通UI（ServiceCard, DatasetAttribution 等）
│   ├── data/                # サービスビルド用の整形済みデータ
│   ├── layouts/             # 共通レイアウト（出典フッター自動表示）
│   ├── lib/                 # 共通Zodスキーマ・ユーティリティ
│   └── pages/
│       ├── index.astro      # TOP（オープンデータ概要・公開サービス一覧）
│       ├── data/            # データ一覧（出典・ライセンスカタログ）
│       └── <service-slug>/  # 1ページ完結型ミニサービス
├── pipelines/               # データ取得・整形スクリプト
├── public/
│   └── _headers             # セキュリティヘッダ設定
└── wrangler.jsonc           # Cloudflare Workers Static Assets 設定
```

## ローカル開発

```bash
pnpm install
pnpm dev
```

### 検証コマンド

```bash
pnpm lint     # Biome Lint / Format チェック
pnpm check    # Astro / TypeScript 型チェック
pnpm test     # Vitest（スキーマ・データ整合性テスト）
pnpm build    # Astro ビルド
pnpm preview  # Wrangler ローカルプレビュー
```

## サービス・データの追加手順

1. **データセット登録**: `src/content/datasets/<id>.json` を作成（出典・ライセンス・確認日を記載）。
2. **サービス追加**:
   - `src/pages/<slug>/index.astro` を作成し、`BaseLayout` の `datasetIds` に使用データIDを渡す（出典フッターが自動描画されます）。
   - `src/content/services/<slug>.json` を作成して `status: "published"` にすると TOP ページへ自動掲載されます。

## 松本の日別気温データの更新

年初に、[気象庁「過去の気象データ・ダウンロード」](https://www.data.jma.go.jp/risk/obsdl/)から長野県の「松本」の前年分の日別値を取得します。項目は「最低気温」「最高気温」、表示オプションは「利用上注意が必要なデータは値を表示（格納）する」「観測環境などの変化前の値を表示（格納）する」「すべて数値で格納」「日付リテラルで格納」を選びます。

```bash
pnpm pipeline:matsumoto-weather-history /path/to/matsumoto-daily.csv
```

複数のCSVも指定できます。同じ観測日は後から指定したCSVの値で更新されます。生成された `src/data/matsumoto-weather-history.json` と、データセットの `updatedAt` を更新してコミットします。

## Cloudflare 自動デプロイ設定

GitHub リポジトリの **Settings > Secrets and variables > Actions** に以下を設定すると、`main` へのプッシュ時に自動デプロイされます。

- `CLOUDFLARE_API_TOKEN`（Workers Scripts: Edit 権限）
- `CLOUDFLARE_ACCOUNT_ID`

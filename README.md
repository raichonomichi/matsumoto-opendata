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

## Cloudflare 自動デプロイ設定

GitHub リポジトリの **Settings > Secrets and variables > Actions** に以下を設定すると、`main` へのプッシュ時に自動デプロイされます。

- `CLOUDFLARE_API_TOKEN`（Workers Scripts: Edit 権限）
- `CLOUDFLARE_ACCOUNT_ID`

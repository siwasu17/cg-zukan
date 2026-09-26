# CG・ゲーム表現図鑑

3DCGの質感や光、ゲームの動きや演出、自動生成やドット絵の技法を、ブラウザの中で実際に動く小さな見本で見比べる図鑑シリーズです。

## 収録している図鑑

| 分類 | 図鑑 | 種類 | 見本 |
| --- | --- | --- | --- |
| 3DCGの見た目 | 球体マテリアル図鑑 | 3D | 45 |
| 3DCGの見た目 | 毛と流体の球体図鑑 | 3D | 28 |
| 3DCGの見た目 | ライティング図鑑 | 3D | 22 |
| 3DCGの見た目 | ポストエフェクト図鑑 | 3D | 21 |
| ゲームの動きと演出 | 弾幕図鑑 | 2D | 27 |
| ゲームの動きと演出 | ゲームの手触り図鑑 | 2D | 18 |
| ゲームの動きと演出 | パーティクル・エフェクト図鑑 | 2D | 23 |
| ゲームの動きと演出 | 物理シミュレーション図鑑 | 2D | 18 |
| ゲームの動きと演出 | 動き・AI図鑑 | 2D | 21 |
| 作る技法 | 自動生成図鑑 | 2D | 21 |
| 作る技法 | ドット絵・2D技法図鑑 | 2D | 20 |

## フォルダ構成

```
.
├── index.html               一覧ページ（catalogues.json から自動で組み立てる）
├── catalogues.json          図鑑の一覧（ここに登録すると一覧とシリーズのリンクに出る）
├── assets/
│   ├── css/base.css         図鑑ページ共通のデザイン
│   ├── css/series.css       ページ上部の「図鑑シリーズ」リンクの見た目
│   ├── css/index.css        一覧ページのデザイン
│   ├── js/g2d.js            2D図鑑の共通処理（カード作成・60fps の更新・マウス操作・リセット）
│   ├── js/g3d.js            3D図鑑の共通処理（three.js、カードごとの描画領域・ドラッグ回転）
│   ├── js/series.js         「図鑑シリーズ」リンクを catalogues.json から作る
│   └── js/index.js          一覧ページの描画
├── catalogues/
│   └── <id>/
│       ├── index.html       図鑑のページ（見出し・説明文・用語）
│       ├── main.js          カードの中身（ここに見本を書く）
│       └── thumbnail.png    一覧ページのサムネイル（なくてもよい）
├── templates/2d, 3d/        新しい図鑑のひな形
├── scripts/
│   ├── new-catalogue.mjs    新しい図鑑を作って catalogues.json に登録する
│   ├── check.mjs            catalogues.json とファイルの対応を確認する
│   ├── serve.mjs            手元で確認するための簡易サーバー
│   └── thumbnail.mjs        サムネイルを撮る（Playwright が必要・任意）
└── .github/workflows/pages.yml   GitHub Pages への自動公開
```

`material`・`furfluid`・`danmaku` の3冊は最初に作った図鑑で、共通処理を使わず1つの `index.html` に全部入っています。残りの8冊は `assets/js/g2d.js` または `g3d.js` の上に `main.js` を載せる形です。どちらの形でも同じように一覧に並びます。

## 手元で見る

Node.js 18 以上があれば、追加のインストールなしで動きます。

```sh
node scripts/serve.mjs        # → http://localhost:8000/
```

Python がある場合は `python3 -m http.server 8000` でも構いません。

`index.html` をファイルとして直接開くと、ブラウザの制限で `catalogues.json` を読み込めず一覧が表示されません。必ずサーバー経由で開いてください。


## 新しい図鑑を追加する

### スクリプトで作る（おすすめ）

```sh
node scripts/new-catalogue.mjs <id> "<タイトル>" --kind 2d --group game --eyebrow "English label" --description "一覧に出す説明"
```

例:

```sh
node scripts/new-catalogue.mjs sound "サウンド表現図鑑" --kind 2d --group game --eyebrow "Sound catalogue"
node scripts/new-catalogue.mjs shader-art "シェーダーアート図鑑" --kind 3d --group cg
```

これで `catalogues/<id>/` にひな形（動く見本カードが2枚入った状態）が作られ、`catalogues.json` にも登録されます。あとは次の順に進めます。

1. `catalogues/<id>/main.js` の `SECTIONS` と `ITEMS` に見本カードを書く
2. `catalogues/<id>/index.html` の説明文と用語を書き換える
3. `catalogues.json` の `cards`（見本の枚数）と `description` を更新する
4. `node scripts/check.mjs` で確認する
5. 必要ならサムネイルを撮る（下記）

### 手で追加する

1. `templates/2d`（または `templates/3d`）を `catalogues/<id>/` にコピーし、`{{ID}}` `{{TITLE}}` `{{EYEBROW}}` `{{DESCRIPTION}}` を書き換える
2. `catalogues.json` の `catalogues` に1行追加する

### catalogues.json の項目

| 項目 | 必須 | 内容 |
| --- | --- | --- |
| `id` | ○ | 半角英小文字・数字・ハイフン。フォルダ名と `series.js` の `data-catalogue` にも使う |
| `title` | ○ | 図鑑の名前 |
| `path` | ○ | 図鑑のフォルダ（例: `catalogues/sound/`、最後に `/`） |
| `group` | | `groups` の `id`。一覧ページでの分類。未登録の値だと「その他」に入る |
| `kind` | | `"2D"` か `"3D"`。一覧のバッジに出る |
| `cards` | | 見本の枚数。0 か省略でバッジを出さない |
| `description` | | 一覧に出す1〜2文の説明 |
| `thumbnail` | | サムネイル画像のパス。省略すると、タイトルの1文字目を大きく描いたタイルになる |
| `hidden` | | `true` で一覧とシリーズのリンクから隠す（下書き用） |

分類を増やしたいときは `groups` に `{ "id": ..., "title": ..., "description": ... }` を追加します。一覧ページの分類の並び順は `groups` の順、図鑑の並び順は `catalogues` の順です。

## 見本カードの書き方

詳しい説明は `templates/2d/main.js` と `templates/3d/main.js` の先頭のコメントにあります。

**2D（`G2D.run`）**：カードごとに `make(env)` を書き、`step()`（1秒に60回呼ばれる更新）と `draw(g)`（Canvas 2D での描画）を持つオブジェクトを返します。マウス操作は `down / move / up`、左下の表示は `hud()` で足せます。`reseed: true` にするとボタンが「作り直す」になり、押すたびに乱数の種が変わります。

**3D（`G3D.run`）**：カードごとに `make(ctx)` を書き、three.js の `scene`・`camera`・`root`（ドラッグで回るグループ）を返します。毎フレームの動きは `update(t)`、ポストエフェクトのように自分で描画したい場合は `render(...)` を使います。

## サムネイルを撮る

一覧ページのサムネイルは、図鑑のページを実際に開いてカードの描画部分を撮影したものです。

```sh
npm i -D playwright && npx playwright install chromium
node scripts/serve.mjs &                                    # 別のターミナルで起動してもよい
node scripts/thumbnail.mjs material:4 furfluid:8 lighting:20 post:6
```

`<id>:<番号>` の番号は、ページ内で何枚目のカードを撮るか（0から数える）です。撮影後、`catalogues.json` の `thumbnail` が自動で書き込まれます。

## 注意

- フォントは Google Fonts から読み込みます。読み込めない環境では、端末にある日本語フォントで表示されます。
- どの図鑑も、ブラウザの中でその場で計算して描いています。3Dの図鑑は WebGL が使えるブラウザが必要です。

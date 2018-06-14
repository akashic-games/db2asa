# db2asa
DragonBonesで作成したアニメーションをakashic-animation形式にコンバートするコマンドラインツール。

## インストール
`db2asa` は `Node.js` で動作します。以下のコマンドでインストールできます。
```sh
$ npm install -g @akashic-extension/db2asa
```

Akashic Engineの詳細な利用方法については、 [公式ページ](https://akashic-games.github.io/) を参照してください。

## 使い方
DragonBonesからJSON形式でexportしたファイルを用意してください。`Image Type`は`Images`のみをサポートしています。texturesディレクトリはJSONファイルと同じディレクトリに配置してください。

```sh
$ db2asa exported_dragonbones.json
```

次のファイルが出力されます。

| 拡張子        |                                        |
|:------------- | :------------------------------------- |
| asapj         | プロジェクトファイル                   |
| asabn, asaan  | ボーンファイルとアニメーションファイル |
| asask         | スキンファイル                         |

### オプション
#### -h, --help
ヘルプを表示します。

### -V, --version
バージョンを表示します。

#### -o, --out-dir
出力先ディレクトリを指定します。存在しない時、ディレクトリを作成します。

#### -p, --add-prefix
出力ファイルのファイル名に次の接頭辞を加えます。

| ファイル形式  | 接頭辞        |
|:------------- |:------------- |
| asapj         | pj_           |
| asabn         | bn_           |
| asaan         | an_           |
| asask         | sk_           |

#### -l, --longName
asaanファイル名(アニメーション名が用いられる)の前にそのアニメーションの持ち主であるarmatureの名前が加わります。２つの間は`_`で区切られます。

#### -P --set-prefix
`-p` オプションで出力ファイル名に加わる接頭辞を指定します。asapj,asabn,asask,asaan形式それぞれについて、この並びでカンマ区切りで指定します。デフォルトは`pj_,bn_,sk_,an_`です。

#### -v, --verbose
実行時の出力に詳細情報を含めます。

#### -u, --user-data
Timelineのbone/eventレイヤーのActionをユーザデータとして出力します。次のような構造になります。

```json
{
    "event":"body-event",
    "action":"body-action",
    "sound":"body-sound"
}
```

#### -r, --related-file-info
asapjファイルと関連するファイルの一覧をasapjファイルのユーザデータとして出力します。`contents.userData.relatedFileInfo`プロパティからアクセスできます。

例(contentsプロパティ内の本件と関係のないものは省略):
```json
{
    "version": "2.0.0",
    "contents": {
        "userData": {
            "relatedFileInfo": {
                "boneSetFileNames": [
                    "stickgirl.asabn",
                    "stickman.asabn"
                ],
                "skinFileNames": [
                    "stickgirl.asask",
                    "stickman.asask"
                ],
                "animationFileNames": [
                    "stickgirl_anime_1.asaan",
                    "stickman_anime_1.asaan",
                    "stickman_anime_1_bezier.asaan",
                    "stickman_anime_1_liner.asaan"
                ],
                "imageFileNames": [
                    "stickgirl.png",
                    "stickman.png"
                ]
            }
        }
    }
}
```

## 補足
### Displayとセルの関係
`DragonBones`の`Display`は`akashic-animation`の`Cell`に変換されます。セル名は次のように決まります。

`<Displayの所属するスロット名>_<パスを除いたDisplay名>`

`head`スロットに配置された`parts/eye`ディスプレイの場合:

`head_eye`

## 制限
以下をサポートしていません。

* メッシュ
* 透明度の継承可否設定
* スロットのカラーアニメーション
* Export時にatlas化されたテクスチャ
* skew(せん断)変換行列
* Displayのスケール成分
* IKアニメーション
* 複数のスロット
* ネストされたarmature
* event layer（Timelineの一番下）のAction(ユーザデータ)

## ライセンス
本リポジトリは MIT License の元で公開されています。
詳しくは [LICENSE](./LICENSE) をご覧ください。

ただし、画像ファイルおよび音声ファイルは
[CC BY 2.1 JP](https://creativecommons.org/licenses/by/2.1/jp/) の元で公開されています。

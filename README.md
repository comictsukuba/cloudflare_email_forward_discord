# cloudflare_email_forward_discord

Cloudflare Email Routing と Cloudflare Workers を活用した、サーバーレスのメール転送・Discord通知システムです。
受信経路をCloudflareのサーバーレス環境で構築し、送信・保管経路をSAKURAインターネットのレンタルサーバーに委任する構成を採用しています。

## 特徴

- **サーバーレスでのメール受信**: Cloudflare Workers上で稼働し、インフラの保守管理が不要。
- **Discord リアルタイム通知**: 受信したメールを解析し、整形したEmbedでDiscordチャンネルへ即時転送。
- **引用文の自動カット**: 返信メール等の不要な引用テキスト（`> ` や `On ... wrote:`）を自動で削除し、通知をクリーンに保ちます。
- **ハイブリッドメール運用**: 受信はCloudflare、送信・保管はSAKURAサーバー（IMAP/SMTP）に完全分離。
- **セキュアな送信ドメイン認証**: SPF, DKIM, DMARCに対応、独自ドメインからのメール送信がスパム判定されるのを防ぎます。
- **CI/CD**: GitHub Actionsを用いて構築済み。

## 技術スタック
Runtime: Cloudflare Workers (Node.js 20)

Parser: postal-mime (メールデータのパース処理)

CI/CD: GitHub Actions

Infrastructure: Cloudflare DNS, SAKURA Internet (Mail Server)

## システムアーキテクチャ

```mermaid
flowchart TD
    subgraph ReceiveFlow [受信通知フロー]
        direction TB
        ExtSender([外部の送信者])
        
        CF_Routing{Cloudflare DNS<br>Email Routing}
        
        CF_Workers[Cloudflare Email Workers<br>email-discord-bot]
        
        Discord[コミつくDiscordサーバー<br>#006_gmail転送]
        
        Sakura[(SAKURA レンタルサーバ<br>メール保管・送信)]
        
        ExtSender -->|"① メール受信<br>(to info@)"| CF_Routing
        CF_Routing -->|"② Routing Rules<br>Action: Send to a Worker"| CF_Workers
        CF_Workers -->|"③ fetch API(POST)"| Discord
        CF_Workers -->|"④ メール転送<br>(to info@comic-tsukuba.sakura.ne.jp)"| Sakura
    end

    subgraph SendFlow [送信フロー]
        direction TB
        EmailClient([送受信者<br>Thunderbird])
        Recipient([外部の受信者])
    end

    %% クロスリンク
    EmailClient -->|"A. メール送信<br>(from info@, SMTP/587)"| Sakura
    Sakura -->|"B. 暗号化<br>(STARTTLS)"| RecipientMTA([受信側MTA])
    RecipientMTA -->|"C. メール認証<br>(SPF, DKIM)"| CF_Routing
    RecipientMTA -->|"D. メール受信"| Recipient
    Sakura -->|"⑤ メール受信<br>IMAP(TCP/993)"| EmailClient

    %% スタイルの定義
    classDef cfColor fill:#F48120,stroke:#C05600,stroke-width:2px,color:#fff,font-weight:bold
    classDef discordColor fill:#5865F2,stroke:#4752C4,stroke-width:2px,color:#fff,font-weight:bold
    classDef sakuraColor fill:#D66E9B,stroke:#A34C73,stroke-width:2px,color:#fff,font-weight:bold
    classDef defaultNode fill:#fff,stroke:#333,stroke-width:2px

    %% スタイルの適用
    class CF_Routing,CF_Workers cfColor
    class Discord discordColor
    class Sakura sakuraColor
    class ExtSender,EmailClient,Recipient,RecipientMTA defaultNode
    
    style ReceiveFlow fill:#FFFFE0,stroke:#BDB76B,stroke-width:1px
    style SendFlow fill:#FFFFE0,stroke:#BDB76B,stroke-width:1px

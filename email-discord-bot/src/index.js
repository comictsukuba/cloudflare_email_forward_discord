import PostalMime from 'postal-mime';

//日付の整形
function formatDate(dateString) {
	const date = new Date(dateString);
  const jstdate = new Date(date.getTime() + 9 * 60 * 60 * 1000);

	if (isNaN(date.getTime())) return "不明な日付";

  const year = jstdate.getUTCFullYear();
  const month = (jstdate.getUTCMonth() + 1).toString().padStart(2, '0');
  const day = jstdate.getUTCDate().toString().padStart(2, '0');
  const hours = jstdate.getUTCHours().toString().padStart(2, '0');
  const minutes = jstdate.getUTCMinutes().toString().padStart(2, '0');
  const seconds = jstdate.getUTCSeconds().toString().padStart(2, '0');
  return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`;
}

// 引用部分を削除する関数
function removeQuotedText(body) {
  const quotePatterns = [
    /^On.*wrote:$/m,          // "On [date] wrote:" の形式
    /^>+.*$/m,                // ">" から始まる行
    /^--\s*$/m,               // "--" の署名区切り
    /^From:.*$/m,             // "From:" から始まる行
    /^Sent:.*$/m,             // "Sent:" から始まる行
    /^To:.*$/m,               // "To:" から始まる行
    /^Subject:.*$/m           // "Subject:" から始まる行
  ];

  // 各パターンを適用して引用部分を削除
  quotePatterns.forEach(pattern => {
    body = body.split(pattern)[0];
  });

  // 不要な空白行を削除
  body = body.trim();
  return body;
}

function formatAddresses(addresses) {
  if (!addresses || addresses.length === 0) return "なし";
  return addresses.map(addr => addr.address).join(', ');
}

// スパム判定
function isSpam(message) {
  const from = message.from || "";
  const subject = message.headers.get("subject") || "";
  const authResults = message.headers.get("Authentication-Results") || "";

  // ブラックリストドメイン
  const blockedDomains = ["spammer.com"];
  const domain = from.split('@')[1] || "";
  if (blockedDomains.includes(domain)) {
    return { spam: true, reason: "ブラックリストのドメイン" };
  }

  // 件名のNGキーワード
  const spamKeywords = 
  [ 
    "センチュリオン", 
    "当選", 
    "viagra", 
    "投資", 
    "ビットコイン",
    "Bitcoin",
    "MetaMask",
    "American Express"
  ];
  const subjectLower = subject.toLowerCase();
  for (const keyword of spamKeywords) {
    if (subjectLower.includes(keyword.toLowerCase())) {
      return { spam: true, reason: `NGキーワード検出: ${keyword}` };
    }
  }

  // SPF / DKIM 認証の失敗
  if (authResults.includes("spf=fail") || authResults.includes("dkim=fail")) {
    return { spam: true, reason: "SPFまたはDKIM認証失敗" };
  }

  return { spam: false };
}

export default {
  async email(message, env, ctx) {
    const FORWARD_ADDRESS = env.FORWARD_ADDRESS;
    const DISCORD_WEBHOOK_URL = env.DISCORD_WEBHOOK_URL;

    // メールの転送（スパム判定に関わらず必ず実行）
    await message.forward(FORWARD_ADDRESS).catch(e => console.error("メール転送エラー:", e));

    // スパムチェック
    const spamCheck = isSpam(message);
    if (spamCheck.spam) {
      console.log(`[Discord通知スキップ] 理由: ${spamCheck.reason} | 送信元: ${message.from}`);
      return; 
    }

    // Discord通知処理（スパムでない場合のみ）
    const parsed = await PostalMime.parse(message.raw);

    let body = removeQuotedText(parsed.text || parsed.html || "");

    if (body.length > 1900 ){
      body = body.substring(0, 1890) + "\n...（省略）";
    }
    
    const date = formatDate(parsed.date);
    const toString = formatAddresses(parsed.to);
    const ccString = formatAddresses(parsed.cc);
    const bccString = formatAddresses(parsed.bcc);

    const payload = {
      content: `\`\`\`件名: ${parsed.subject}\n送信元: ${parsed.from?.address}\n送信先: ${toString}\n        Cc: ${ccString}, Bcc: ${bccString}\n受信日: ${date}\n\`\`\``,
      embeds: [{
        title: parsed.subject,
        color: 9341951,
        author: {
          name: parsed.from?.name,
        },
        footer:{
          text: date,
        },
        description: body,
      }],
    };

    if (!DISCORD_WEBHOOK_URL) {
      console.error("エラー: DISCORD_WEBHOOK_URLが設定されていません");
      return;
    }

    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    };

    const response = await fetch(DISCORD_WEBHOOK_URL, options).catch(e => console.error("Discord転送エラー:", e));
    if (response) {
      console.log(`Discord Webhook Status: ${response.status}`);
    }
  }
};
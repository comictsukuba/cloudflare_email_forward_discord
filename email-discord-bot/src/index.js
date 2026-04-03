import PostalMime from 'postal-mime';
require('dotenv').config()

//日付の整形
function formatDate(date) {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const seconds = date.getSeconds().toString().padStart(2, '0');
  return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`;
}

// 引用部分を削除する関数
function removeQuotedText(body) {
  // Gmailの返信引用部分に含まれるパターンを検出
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

export default {
	async email(message, env, ctx) {
	
		const FORWARD_ADDRESS = env.FORWARD_ADDRESS;
		const	DISCORD_WEBHOOK_URL = env.DISCORD_WEBHOOK_URL;

		await message.forward(FORWARD_ADDRESS).catch (e => console.error("メール転送エラー:", e));

		const parsed = await PostalMime.parse(message.raw);

		let body = removeQuotedText(parsed.text);

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

		const response = await fetch(DISCORD_WEBHOOK_URL, options).catch (e => console.error("Discord転送エラー:", e));
		console.log(response.status);
	}
};


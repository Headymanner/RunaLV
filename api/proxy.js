module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const KEY = process.env.GEMINI_KEY;
  if (!KEY) return res.status(500).json({error:{message:'GEMINI_KEY not set'}});

  const body = req.body;
  const type = body && body.type;

  try {
    // ── CHAT ─────────────────────────────────────
    if (type === 'chat') {
      const r = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + KEY,
        { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body.body) }
      );
      const data = await r.json();
      return res.status(r.status).json(data);
    }

    // ── TTS ──────────────────────────────────────
    if (type === 'tts') {
      const text = (body.text || '').substring(0, 400);
      const voice = body.voice || 'Aoede';
      const r = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=' + KEY,
        {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({
            contents: [{parts:[{text}]}],
            generationConfig: {
              responseModalities: ['AUDIO'],
              speechConfig: {voiceConfig:{prebuiltVoiceConfig:{voiceName: voice}}}
            }
          })
        }
      );
      const data = await r.json();
      const part = data?.candidates?.[0]?.content?.parts?.[0];
      if (!part?.inlineData?.data) {
        return res.status(500).json({error:{message:'No audio data'}});
      }
      return res.status(200).json({data: part.inlineData.data, mimeType: part.inlineData.mimeType || 'audio/L16'});
    }

    // ── STT (Speech to Text via Gemini) ──────────
    if (type === 'stt') {
      const audioData = body.audio; // base64
      const mimeType = body.mimeType || 'audio/webm';
      const lang = body.lang || 'lv'; // lv or ru

      const prompt = lang === 'ru'
        ? 'Это аудиозапись на русском языке. Транскрибируй точно что сказано. Верни ТОЛЬКО текст без пояснений.'
        : 'Šis ir audio ieraksts latviešu valodā. Precīzi transkribi ko saka. Atdod TIKAI tekstu bez paskaidrojumiem.';

      const r = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + KEY,
        {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({
            contents: [{
              parts: [
                {inline_data: {mime_type: mimeType, data: audioData}},
                {text: prompt}
              ]
            }],
            generationConfig: {temperature: 0, maxOutputTokens: 200}
          })
        }
      );
      const data = await r.json();
      let text = '';
      try { text = data.candidates[0].content.parts[0].text.trim(); } catch(e) {}
      return res.status(200).json({text});
    }

    return res.status(400).json({error:{message:'Unknown type: ' + type}});
  } catch(e) {
    return res.status(500).json({error:{message: e.message}});
  }
}

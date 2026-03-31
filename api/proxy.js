module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const KEY = process.env.GEMINI_KEY;
  if (!KEY) return res.status(500).json({error:{message:'GEMINI_KEY not set in Vercel Environment Variables'}});

  // Vercel auto-parses JSON body
  const body = req.body;
  const type = body && body.type;

  if (!type) {
    return res.status(400).json({error:{message:'Missing type field. Got: ' + JSON.stringify(body).substring(0,100)}});
  }

  try {
    // ── CHAT ─────────────────────────────────────
    if (type === 'chat') {
      const chatBody = body.body;
      const r = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + KEY,
        {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify(chatBody)
        }
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
            contents: [{parts: [{text: text}]}],
            generationConfig: {
              responseModalities: ['AUDIO'],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: {voiceName: voice}
                }
              }
            }
          })
        }
      );

      const data = await r.json();

      if (!r.ok) {
        return res.status(r.status).json({error:{message: JSON.stringify(data).substring(0,200)}});
      }

      const part = data &&
                   data.candidates &&
                   data.candidates[0] &&
                   data.candidates[0].content &&
                   data.candidates[0].content.parts &&
                   data.candidates[0].content.parts[0];

      if (!part || !part.inlineData || !part.inlineData.data) {
        return res.status(500).json({error:{message:'No audio in response'}});
      }

      return res.status(200).json({
        data: part.inlineData.data,
        mimeType: part.inlineData.mimeType || 'audio/L16'
      });
    }

    return res.status(400).json({error:{message:'Unknown type: ' + type}});

  } catch(e) {
    return res.status(500).json({error:{message: e.message, stack: e.stack}});
  }
}

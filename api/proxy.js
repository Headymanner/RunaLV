module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const KEY = process.env.GEMINI_KEY;
  if (!KEY) return res.status(500).json({error:{message:'GEMINI_KEY not set'}});

  // Parse body - Vercel sometimes needs this
  let data = req.body;
  if (typeof data === 'string') {
    try { data = JSON.parse(data); } catch(e) {}
  }
  if (!data) return res.status(400).json({error:{message:'Empty body'}});

  const type = data.type;

  try {
    if (type === 'chat') {
      const r = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + KEY,
        { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(data.body) }
      );
      const result = await r.json();
      return res.status(r.status).json(result);
    }

    if (type === 'tts') {
      const safeText = (data.text || '').substring(0, 400);
      const voice = data.voice || 'Aoede';
      const r = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=' + KEY,
        {
          method: 'POST',
          headers: {'Content-Type':'application/json'},
          body: JSON.stringify({
            contents: [{parts:[{text: safeText}]}],
            generationConfig: {
              responseModalities: ['AUDIO'],
              speechConfig: {voiceConfig:{prebuiltVoiceConfig:{voiceName: voice}}}
            }
          })
        }
      );
      const result = await r.json();
      const part = result && result.candidates && result.candidates[0] &&
                   result.candidates[0].content && result.candidates[0].content.parts &&
                   result.candidates[0].content.parts[0];
      if (!part || !part.inlineData || !part.inlineData.data) {
        return res.status(500).json({error:{message:'No audio: ' + JSON.stringify(result).substring(0,200)}});
      }
      return res.status(200).json({
        data: part.inlineData.data,
        mimeType: part.inlineData.mimeType || 'audio/L16'
      });
    }

    return res.status(400).json({error:{message:'Unknown type: ' + type}});
  } catch(e) {
    return res.status(500).json({error:{message: e.message}});
  }
}

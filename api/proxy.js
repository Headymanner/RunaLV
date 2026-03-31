// Vercel Serverless Function - CommonJS format
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const KEY = process.env.GEMINI_KEY;
  if (!KEY) return res.status(500).json({error:{message:'GEMINI_KEY not configured'}});

  const body = req.body || {};
  const type = body.type;
  const text = body.text;
  const voice = body.voice || 'Aoede';
  const chatBody = body.body;

  try {
    if (type === 'chat') {
      const r = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + KEY,
        { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(chatBody) }
      );
      const data = await r.json();
      return res.status(r.status).json(data);
    }

    if (type === 'tts') {
      const safeText = (text || '').substring(0, 400);
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
      const data = await r.json();
      const part = data && data.candidates && data.candidates[0] &&
                   data.candidates[0].content && data.candidates[0].content.parts &&
                   data.candidates[0].content.parts[0];
      if (!part || !part.inlineData || !part.inlineData.data) {
        return res.status(500).json({error:{message:'No audio data'}});
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

const GEMINI_KEY = process.env.GEMINI_KEY;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();
  if (!GEMINI_KEY) return res.status(500).json({error:{message:'No API key'}});

  const { type, body, text, voice } = req.body;

  try {
    if (type === 'chat') {
      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
        {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)}
      );
      const data = await resp.json();
      return res.status(resp.status).json(data);
    }
    if (type === 'tts') {
      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${GEMINI_KEY}`,
        {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({
          contents:[{parts:[{text:(text||'').substring(0,400)}]}],
          generationConfig:{responseModalities:['AUDIO'],speechConfig:{voiceConfig:{prebuiltVoiceConfig:{voiceName:voice||'Aoede'}}}}
        })}
      );
      const data = await resp.json();
      const part = data?.candidates?.[0]?.content?.parts?.[0];
      if (!part?.inlineData?.data) return res.status(500).json({error:{message:'No audio'}});
      return res.status(200).json({data:part.inlineData.data, mimeType:part.inlineData.mimeType||'audio/L16'});
    }
    return res.status(404).end();
  } catch(e) {
    return res.status(500).json({error:{message:e.message}});
  }
}


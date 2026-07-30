// Vercel Serverless Function - Recibe leads del formulario "Avísame" y los añade a Brevo
// Endpoint: /api/aviso
// Env vars requeridas en Vercel: BREVO_API_KEY, BREVO_LIST_ID

export default async function handler(req, res) {
  // Solo aceptar POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // CORS - permitir peticiones desde cualquier origen (o restringir a benudea.com)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { email, nombre } = req.body || {};

    // Validaciones
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({ error: 'Email inválido' });
    }
    if (email.length > 200 || (nombre && nombre.length > 100)) {
      return res.status(400).json({ error: 'Datos demasiado largos' });
    }

    // Anti-spam básico (honeypot)
    if (req.body.website) {
      // Bot detected - respondemos OK pero no hacemos nada
      return res.status(200).json({ ok: true });
    }

    const BREVO_API_KEY = process.env.BREVO_API_KEY;
    const BREVO_LIST_ID = parseInt(process.env.BREVO_LIST_ID || '0', 10);

    if (!BREVO_API_KEY || !BREVO_LIST_ID) {
      console.error('Faltan variables de entorno BREVO_API_KEY o BREVO_LIST_ID');
      return res.status(500).json({ error: 'Configuración incompleta del servidor' });
    }

    // Llamada a Brevo API - Add contact to list
    const brevoResponse = await fetch('https://api.brevo.com/v3/contacts', {
      method: 'POST',
      headers: {
        'api-key': BREVO_API_KEY,
        'Content-Type': 'application/json',
        'accept': 'application/json'
      },
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
        attributes: nombre ? { FIRSTNAME: nombre.trim() } : undefined,
        listIds: [BREVO_LIST_ID],
        updateEnabled: true  // si ya existe el contacto, actualiza en vez de fallar
      })
    });

    // Brevo devuelve 201 (created), 204 (updated) o 400 si hay error
    if (brevoResponse.ok || brevoResponse.status === 204) {
      return res.status(200).json({ ok: true });
    }

    const brevoError = await brevoResponse.text();
    console.error('Brevo API error:', brevoResponse.status, brevoError);

    // Si Brevo dice que el contacto ya existe, respondemos OK igualmente
    if (brevoResponse.status === 400 && brevoError.includes('duplicate_parameter')) {
      return res.status(200).json({ ok: true, message: 'ya estabas en la lista' });
    }

    return res.status(500).json({ error: 'Error registrando el aviso' });
  } catch (err) {
    console.error('Function error:', err);
    return res.status(500).json({ error: 'Error interno' });
  }
}

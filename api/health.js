// Endpoint de diagnóstico sin acceso a información privada.
export default function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Método no permitido' });
  }

  return res.status(200).json({
    ok: true,
    service: 'amway-manager',
    platform: 'vercel',
    database: process.env.DATABASE_URL ? 'configurada' : 'sin_configurar'
  });
}

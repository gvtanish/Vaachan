// Privileged teacher provisioning endpoint. Keep the service-role key in
// Vercel only; it must never be exposed to the browser.
const json = (res, status, body) => res.status(status).json(body);

async function supabaseRequest(url, options) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed.' });

  const url = process.env.VAACHAN_SUPABASE_URL;
  const anonKey = process.env.VAACHAN_SUPABASE_KEY;
  const serviceKey = process.env.VAACHAN_SUPABASE_SERVICE_ROLE_KEY;
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!url || !anonKey || !serviceKey) {
    return json(res, 500, { error: 'Teacher provisioning is not configured on the server.' });
  }
  if (!token) return json(res, 401, { error: 'Please sign in as an administrator.' });

  const { response: userResponse, payload: user } = await supabaseRequest(`${url}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${token}` }
  });
  if (!userResponse.ok || !user?.id) return json(res, 401, { error: 'Your session is invalid or has expired.' });

  const { response: roleResponse, payload: profiles } = await supabaseRequest(
    `${url}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=role`,
    { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
  );
  if (!roleResponse.ok || profiles?.[0]?.role !== 'admin') {
    return json(res, 403, { error: 'Only administrators can create teacher accounts.' });
  }

  const teachers = Array.isArray(req.body?.teachers) ? req.body.teachers : [];
  if (!teachers.length || teachers.length > 100) {
    return json(res, 400, { error: 'Provide between 1 and 100 teacher accounts.' });
  }

  const results = [];
  for (const teacher of teachers) {
    const name = String(teacher.name || '').trim();
    const employeeId = String(teacher.employeeId || '').trim();
    const password = String(teacher.password || '');
    if (!name || !employeeId || password.length < 6) {
      results.push({ employeeId, ok: false, error: 'Name, employee ID, and a 6-character password are required.' });
      continue;
    }

    const email = `${employeeId.toLowerCase()}@vaachan.school`;
    const { response, payload } = await supabaseRequest(`${url}/auth/v1/admin/users`, {
      method: 'POST',
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        email_confirm: true,
        user_metadata: { name, employee_id: employeeId, role: 'teacher' }
      })
    });
    results.push({ employeeId, ok: response.ok, error: response.ok ? null : (payload.msg || payload.message || 'Unable to create account.') });
  }

  return json(res, 200, { results });
}

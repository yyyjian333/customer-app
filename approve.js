// /api/approve.js
// Vercel Serverless Function (Node.js). Save as api/approve.js
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL; // set in Vercel
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY; // set securely in Vercel
const ADMIN_APPROVE_SECRET = process.env.ADMIN_APPROVE_SECRET; // set securely in Vercel
const SUPER_ADMIN = 'yyyjian96996@gmail.com'; // optional double-check

const sbAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Only POST' });
  try {
    const { pendingId, adminSecret } = req.body || {};
    if (!pendingId) return res.status(400).json({ message: 'missing pendingId' });
    if (!adminSecret || adminSecret !== ADMIN_APPROVE_SECRET) return res.status(403).json({ message: 'invalid admin secret' });

    // fetch pending signup
    const { data: pending, error: e1 } = await sbAdmin.from('pending_signups').select('*').eq('id', pendingId).single();
    if (e1) return res.status(500).json({ message: 'failed to load pending signup', detail: e1.message });
    if (!pending) return res.status(404).json({ message: 'pending signup not found' });
    if (pending.status !== 'pending') return res.status(400).json({ message: 'already processed' });

    const email = pending.email;
    const name = pending.name || '';

    // create auth user with random password
    const password = Math.random().toString(36).slice(2,10) + 'A1!';
    // Use Admin API to create user
    const { data: userData, error: e2 } = await sbAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name }
    });
    if (e2) return res.status(500).json({ message: 'failed to create user', detail: e2.message });

    // optionally insert into users table (link)
    await sbAdmin.from('users').insert([{ supa_uid: userData.user.id, email, name, role: 'user' }]);

    // mark pending as approved
    await sbAdmin.from('pending_signups').update({ status: 'approved', processed_at: new Date().toISOString() }).eq('id', pendingId);

    return res.json({ ok: true, user_id: userData.user.id, password_preview: password });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'server error', detail: err.message });
  }
};

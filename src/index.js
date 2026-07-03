export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/consultation' && request.method === 'POST') {
      return handleConsultation(request, env);
    }

    return env.ASSETS.fetch(request);
  }
};

async function handleConsultation(request, env) {
  let data;
  try {
    data = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request' }), { status: 400 });
  }

  const { name, email, company, message, 'cf-turnstile-response': turnstileToken } = data;

  if (!name || !email) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400 });
  }

  const turnstileVerify = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      secret: env.TURNSTILE_SECRET_KEY,
      response: turnstileToken,
    }),
  });
  const turnstileResult = await turnstileVerify.json();
  if (!turnstileResult.success) {
    return new Response(JSON.stringify({ error: 'Spam check failed' }), { status: 403 });
  }

  const emailRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'GFP Website <noreply@gfpaccounting.com>',
      to: ['bmartinez@gfpaccounting.com'],
      reply_to: email,
      subject: `New Consultation Request from ${name}`,
      text: `Name: ${name}\nEmail: ${email}\nCompany: ${company || 'N/A'}\n\nMessage:\n${message || 'N/A'}`,
    }),
  });

  if (!emailRes.ok) {
    return new Response(JSON.stringify({ error: 'Failed to send' }), { status: 502 });
  }

  return new Response(JSON.stringify({ success: true }), { status: 200 });
}

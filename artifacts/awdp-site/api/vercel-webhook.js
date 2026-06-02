export const config = {
  runtime: 'edge',
};

// Vercel Webhook Handler - Triggers smoke test after successful deployment
export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const body = await req.json();

    // Only proceed on successful deployments
    if (body.type !== 'deployment.succeeded') {
      return new Response('Ignored - not a successful deployment', { status: 200 });
    }

    const githubToken = process.env.GITHUB_TOKEN;
    if (!githubToken) {
      console.error('GITHUB_TOKEN not configured');
      return new Response('Missing GITHUB_TOKEN', { status: 500 });
    }

    // Trigger GitHub Action via repository_dispatch
    const response = await fetch(
      'https://api.github.com/repos/alykay1522/AWDP1/dispatches',
      {
        method: 'POST',
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${githubToken}`,
          'X-GitHub-Api-Version': '2022-11-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          event_type: 'vercel-deployed',
          client_payload: {
            deploymentId: body.payload?.deployment?.id,
            url: body.payload?.deployment?.url,
            source: 'vercel-webhook',
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Failed to trigger GitHub Action:', errorText);
      return new Response('Failed to trigger workflow', { status: 500 });
    }

    console.log('Smoke test workflow triggered after Vercel deployment');
    return new Response('Smoke test triggered', { status: 200 });
  } catch (error) {
    console.error('Error in vercel-webhook:', error);
    return new Response('Internal server error', { status: 500 });
  }
}

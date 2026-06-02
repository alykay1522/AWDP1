export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const githubToken = process.env.GITHUB_TOKEN;
    if (!githubToken) {
      return new Response('Missing GITHUB_TOKEN', { status: 500 });
    }

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
            source: 'vercel-deploy-hook',
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Failed to trigger GitHub Action:', errorText);
      return new Response('Failed to trigger workflow', { status: 500 });
    }

    return new Response('Smoke test workflow triggered', { status: 200 });
  } catch (error) {
    console.error('Error in trigger-smoke-test:', error);
    return new Response('Internal server error', { status: 500 });
  }
}

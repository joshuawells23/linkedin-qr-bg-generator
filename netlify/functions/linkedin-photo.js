export default async (req) => {
  const url = new URL(req.url);
  const linkedinUrl = url.searchParams.get('url');

  if (!linkedinUrl || !linkedinUrl.includes('linkedin.com/in/')) {
    return new Response(JSON.stringify({ error: 'Invalid LinkedIn URL' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  try {
    // Fetch the LinkedIn profile page
    const res = await fetch(linkedinUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
    });

    if (!res.ok) {
      return new Response(JSON.stringify({ error: 'Could not reach LinkedIn profile' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    const html = await res.text();

    // Extract og:image from meta tags
    const ogMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);

    if (!ogMatch || !ogMatch[1]) {
      return new Response(JSON.stringify({ error: 'No profile image found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    const imageUrl = ogMatch[1];

    // Proxy the image to avoid CORS issues on the client
    const imgRes = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      },
    });

    if (!imgRes.ok) {
      // Fall back to just returning the URL
      return new Response(JSON.stringify({ imageUrl }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
    const imageBuffer = await imgRes.arrayBuffer();

    return new Response(imageBuffer, {
      headers: {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Failed to fetch profile: ' + err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
};

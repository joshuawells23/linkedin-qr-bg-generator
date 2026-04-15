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
    // Strip trailing slash for consistent redirects
    const cleanUrl = linkedinUrl.replace(/\/+$/, '');

    // Fetch the LinkedIn profile page (Twitterbot UA gets og:image access)
    const res = await fetch(cleanUrl, {
      headers: {
        'User-Agent': 'Twitterbot/1.0',
        'Accept': 'text/html',
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

    // Decode HTML entities (&amp; → &, etc.)
    const imageUrl = ogMatch[1]
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"');

    // Proxy the image to avoid CORS issues on the client
    const imgRes = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Referer': 'https://www.linkedin.com/',
      },
    });

    if (!imgRes.ok) {
      // Fall back to returning the cleaned URL for the client to try directly
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

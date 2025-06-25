import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

async function getHtml(url: string) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

  try {
    // Try multiple approaches for fetching
    let response;
    
    try {
      // First attempt with modern headers
      response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1',
          'Upgrade-Insecure-Requests': '1'
        }
      });
    } catch (firstError) {
      // First fetch attempt failed, trying with basic headers
      
      // Fallback attempt with minimal headers
      response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; MetadataBot/1.0)',
          'Accept': 'text/html'
        }
      });
    }
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
    }
    
    const html = await response.text();
    // Successfully fetched HTML
    return html;
    
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('Fetch timed out for URL:', url);
    } else {
      console.error('Error fetching HTML for URL:', url, error);
    }
    return '';
  }
}

function getMeta(doc: Document) {
  const get = (selector: string, attribute: string = 'content') => {
    try {
      const element = doc.querySelector(selector);
      if (!element) return '';
      
      if (attribute === 'textContent') {
        return element.textContent?.trim() || '';
      }
      
      return element.getAttribute(attribute)?.trim() || '';
    } catch (e) {
      return '';
    }
  };

  // Try multiple selectors for title
  const title = get('title', 'textContent') || 
                get('meta[property="og:title"]') || 
                get('meta[name="twitter:title"]') ||
                get('h1', 'textContent');

  // Try multiple selectors for description
  const description = get('meta[name="description"]') || 
                      get('meta[property="og:description"]') || 
                      get('meta[name="twitter:description"]');

  // Try multiple selectors for image
  const image = get('meta[property="og:image"]') || 
                get('meta[name="twitter:image"]') ||
                get('meta[property="og:image:url"]');

  const siteName = get('meta[property="og:site_name"]') ||
                   get('meta[name="application-name"]');

  return { title, description, image, siteName };
}

function getFavicon(doc: Document, url: string) {
  const selectors = [
    'link[rel="icon"][sizes="32x32"]',
    'link[rel="icon"][sizes="16x16"]',
    'link[rel="shortcut icon"]',
    'link[rel="apple-touch-icon"]',
    'link[rel="icon"]',
  ];

  let faviconUrl = '';
  
  // Try to find favicon from link tags
  for (const selector of selectors) {
    try {
      const element = doc.querySelector(selector);
      const href = element?.getAttribute('href');
      if (href && href.trim()) {
        faviconUrl = href.trim();
        break;
      }
    } catch (e) {
      continue;
    }
  }

  // If no favicon found in HTML, try default favicon.ico
  if (!faviconUrl) {
    try {
      const parsedUrl = new URL(url);
      faviconUrl = `${parsedUrl.protocol}//${parsedUrl.host}/favicon.ico`;
    } catch (e) {
      return '';
    }
  }

  // Convert relative URLs to absolute
  try {
    return new URL(faviconUrl, url).href;
  } catch (e) {
    return '';
  }
}

function extractContent(doc: Document): string {
  try {
    // Remove script and style elements
    const scripts = doc.querySelectorAll('script, style, nav, header, footer, aside');
    scripts.forEach(el => el.remove());
    
    // Try to get main content
    const contentSelectors = [
      'main',
      'article',
      '[role="main"]',
      '.content',
      '.post-content',
      '.entry-content',
      '.article-content',
      'body'
    ];
    
    let content = '';
    for (const selector of contentSelectors) {
      const element = doc.querySelector(selector);
      if (element) {
        content = element.textContent || '';
        break;
      }
    }
    
    return content
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 1000); // Limit to 1000 characters
  } catch (e) {
    return '';
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');

  // Metadata API called

  if (!url) {
    console.error('No URL provided');
    return NextResponse.json({ error: 'URL is required' }, { status: 400 });
  }

  let normalizedUrl = url;
  try {
    // Ensure URL has protocol
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      normalizedUrl = `https://${url}`;
    }
    
    // Validate URL
    new URL(normalizedUrl);
    // URL normalized
  } catch (e) {
    console.error('Invalid URL:', url, e);
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
  }

  try {
    // Starting to fetch HTML
    
    const html = await getHtml(normalizedUrl);
    // HTML fetched
    
    if (!html) {
      console.warn('No HTML content received, returning default metadata');
      const parsedUrl = new URL(normalizedUrl);
      return NextResponse.json({ 
        title: parsedUrl.hostname,
        description: 'Website content could not be fetched.',
        favicon: `${parsedUrl.protocol}//${parsedUrl.host}/favicon.ico`,
        siteName: parsedUrl.hostname,
        image: '',
        content: ''
      });
    }

    // Parsing HTML with JSDOM
    const { JSDOM } = await import('jsdom');
    const dom = new JSDOM(html, { url: normalizedUrl });
    const doc = dom.window.document;

    // Extracting metadata
    const metadata = getMeta(doc);
    // Basic metadata extracted
    
    const favicon = getFavicon(doc, normalizedUrl);
    // Favicon extracted
    
    const content = extractContent(doc);
    // Content extracted

    const parsedUrl = new URL(normalizedUrl);
    const result = {
      title: metadata.title || parsedUrl.hostname,
      description: metadata.description || '',
      image: metadata.image || '',
      siteName: metadata.siteName || parsedUrl.hostname,
      favicon: favicon || `${parsedUrl.protocol}//${parsedUrl.host}/favicon.ico`,
      content: content || ''
    };

    // Final metadata result prepared
    return NextResponse.json(result);

  } catch (error) {
    console.error(`Error fetching metadata for ${normalizedUrl}:`, error);
    try {
      const parsedUrl = new URL(normalizedUrl);
      const errorResult = {
        title: parsedUrl.hostname,
        description: 'Error occurred while fetching metadata.',
        favicon: `${parsedUrl.protocol}//${parsedUrl.host}/favicon.ico`,
        siteName: parsedUrl.hostname,
        image: '',
        content: ''
      };
      return NextResponse.json(errorResult);
    } catch (urlError) {
      return NextResponse.json({
        title: normalizedUrl,
        description: 'Error occurred while fetching metadata.',
        favicon: '',
        siteName: '',
        image: '',
        content: ''
      }, { status: 500 });
    }
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/utils/logger';
import { withTimeout, TimeoutError } from '@/lib/utils/timeout';
import { retry } from '@/lib/utils/retry';

export const dynamic = 'force-dynamic';

// Disable caching for metadata API (responses can be >2MB)
export const revalidate = 0;
export const fetchCache = 'force-no-store';

// Configuration
const METADATA_TIMEOUT_MS = 20000; // 20 seconds for metadata fetching
const HTML_FETCH_TIMEOUT_MS = 15000; // 15 seconds for HTML fetch

async function getHtml(url: string): Promise<string> {
  logger.info('getHtml: Fetching HTML', { url });
  
  const fetchHtml = async (): Promise<string> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), HTML_FETCH_TIMEOUT_MS);

    try {
      let response;
      
      // Try with full headers first
      try {
        response = await fetch(url, {
          signal: controller.signal,
          cache: 'no-store', // Disable Next.js caching (responses can be >2MB)
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
        // Fallback to simpler headers
        logger.debug('getHtml: First attempt failed, trying simpler headers', { 
          error: firstError instanceof Error ? firstError.message : String(firstError) 
        });
        response = await fetch(url, {
          signal: controller.signal,
          cache: 'no-store', // Disable Next.js caching for large responses
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; MetadataBot/1.0)',
            'Accept': 'text/html'
          }
        });
      }
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const html = await response.text();
      
      if (!html || html.length === 0) {
        throw new Error('Empty response from server');
      }
      
      logger.info('getHtml: Success', { 
        url, 
        htmlLength: html.length 
      });
      
      return html;
      
    } catch (error: any) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        throw new TimeoutError(`HTML fetch timed out after ${HTML_FETCH_TIMEOUT_MS}ms`);
      }
      
      throw error;
    }
  };

  // Retry with exponential backoff
  try {
    return await retry(fetchHtml, {
      maxAttempts: 3,
      delayMs: 1000,
      shouldRetry: (error) => {
        // Retry on network errors and 5xx errors
        if (error instanceof TimeoutError) return false;
        if (error?.message?.includes('timeout')) return true;
        if (error?.status >= 500 && error?.status < 600) return true;
        if (error?.code === 'ECONNRESET' || error?.code === 'ETIMEDOUT') return true;
        return false;
      },
    });
  } catch (error: any) {
    logger.error('getHtml: Failed after retries', { 
      url, 
      error: error.message 
    }, error);
    return '';
  }
}

function getMeta(doc: Document, url?: string) {
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

  // Check if this is a tweet URL
  const isTweet = url && (url.includes('twitter.com') || url.includes('x.com'));

  let title = get('meta[property="og:title"]') || 
              get('meta[name="twitter:title"]') ||
              get('title', 'textContent') || 
              get('h1', 'textContent');

  let description = get('meta[property="og:description"]') || 
                    get('meta[name="twitter:description"]') ||
                    get('meta[name="description"]');

  // For tweets, try to extract the actual tweet content
  if (isTweet) {
    // The og:title often has format "Author on X: "tweet text...""
    const ogTitle = get('meta[property="og:title"]');
    if (ogTitle) {
      // Try to extract just the author name for title
      const authorMatch = ogTitle.match(/^(.+?) on (?:X|Twitter):/);
      if (authorMatch) {
        title = `Tweet by ${authorMatch[1]}`;
      }
      
      // Extract tweet text from title if description is empty
      if (!description || description.length < 20) {
        const tweetMatch = ogTitle.match(/on (?:X|Twitter):\s*[""]?(.+?)[""]?\s*$/);
        if (tweetMatch && tweetMatch[1]) {
          description = tweetMatch[1].replace(/^[""]/, '').replace(/[""]$/, '');
        }
      }
    }
    
    // Clean up tweet description (remove quotes)
    if (description) {
      description = description
        .replace(/^[""]/, '')
        .replace(/[""]$/, '')
        .trim();
    }
  }

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

  if (!faviconUrl) {
    try {
      const parsedUrl = new URL(url);
      faviconUrl = `${parsedUrl.protocol}//${parsedUrl.host}/favicon.ico`;
    } catch (e) {
      return '';
    }
  }

  try {
    return new URL(faviconUrl, url).href;
  } catch (e) {
    return '';
  }
}

// Detect content type from URL
function detectContentType(url: string): string {
  const urlLower = url.toLowerCase();
  
  if (urlLower.includes('twitter.com') || urlLower.includes('x.com')) {
    return 'tweet';
  }
  if (urlLower.includes('youtube.com') || urlLower.includes('youtu.be')) {
    return 'video';
  }
  if (
    urlLower.includes('medium.com') ||
    urlLower.includes('dev.to') ||
    urlLower.includes('hashnode.') ||
    urlLower.includes('substack.com') ||
    urlLower.includes('/blog') ||
    urlLower.includes('/article') ||
    urlLower.includes('/post')
  ) {
    return 'article';
  }
  
  return 'webpage';
}

// Check if URL is a tweet
function isTweetUrl(url: string): boolean {
  const urlLower = url.toLowerCase();
  return (urlLower.includes('twitter.com') || urlLower.includes('x.com')) && 
         urlLower.includes('/status/');
}

// Fetch tweet data using Twitter's oEmbed API
async function fetchTweetOEmbed(url: string): Promise<{
  title: string;
  description: string;
  author: string;
  siteName: string;
} | null> {
  try {
    // Twitter oEmbed API - official way to get tweet data
    const oembedUrl = `https://publish.twitter.com/oembed?url=${encodeURIComponent(url)}&omit_script=true`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch(oembedUrl, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
      },
    }).finally(() => clearTimeout(timeoutId));
    
    if (!response.ok) {
      logger.warn('fetchTweetOEmbed: API returned error', { 
        url, 
        status: response.status 
      });
      return null;
    }
    
    const data = await response.json();
    
    // Extract tweet text from the HTML
    // The html field contains: <blockquote>...<p>TWEET TEXT</p>...— Author (@handle)</blockquote>
    let tweetText = '';
    if (data.html) {
      // Extract text from <p> tags (this contains the actual tweet)
      const pMatch = data.html.match(/<p[^>]*>([\s\S]*?)<\/p>/g);
      if (pMatch) {
        tweetText = pMatch
          .map((p: string) => p.replace(/<[^>]+>/g, ''))
          .join(' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/&mdash;.*$/, '') // Remove the author attribution at the end
          .replace(/pic\.twitter\.com\/\w+/g, '') // Remove pic.twitter.com links
          .replace(/\s+/g, ' ')
          .trim();
      }
    }
    
    // If no <p> tags found, try to get text from the whole html
    if (!tweetText && data.html) {
      tweetText = data.html
        .replace(/<[^>]+>/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&mdash;.*$/, '') // Remove the author attribution
        .replace(/pic\.twitter\.com\/\w+/g, '') // Remove pic.twitter.com links
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 500);
    }
    
    return {
      title: `Tweet by ${data.author_name || 'Unknown'}`,
      description: tweetText,
      author: data.author_name || '',
      siteName: 'X (Twitter)',
    };
  } catch (error: any) {
    logger.warn('fetchTweetOEmbed: Failed', { url, error: error.message });
    return null;
  }
}

// Extract Twitter/X content from meta tags
function extractTwitterContent(doc: Document, url: string): string {
  // Twitter/X stores tweet content in meta tags since the page is JS-rendered
  const parts: string[] = [];
  
  // Get the tweet author from URL or meta
  let author = '';
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/').filter(Boolean);
    if (pathParts.length > 0) {
      author = `@${pathParts[0]}`;
    }
  } catch {}
  
  // Try to get author from meta tags
  const metaAuthor = doc.querySelector('meta[property="og:title"]')?.getAttribute('content') || '';
  if (metaAuthor && metaAuthor.includes(' on X:')) {
    // Format: "Author Name on X: "tweet text...""
    const authorMatch = metaAuthor.match(/^(.+?) on X:/);
    if (authorMatch) {
      author = authorMatch[1];
    }
  } else if (metaAuthor && metaAuthor.includes(' on Twitter:')) {
    const authorMatch = metaAuthor.match(/^(.+?) on Twitter:/);
    if (authorMatch) {
      author = authorMatch[1];
    }
  }
  
  if (author) {
    parts.push(`Tweet by ${author}`);
  }
  
  // The tweet text is usually in og:description or the og:title after the colon
  let tweetText = '';
  
  // First try og:description - this usually has the full tweet
  const ogDescription = doc.querySelector('meta[property="og:description"]')?.getAttribute('content') || '';
  if (ogDescription && ogDescription.length > 10) {
    tweetText = ogDescription;
  }
  
  // If og:description is empty or too short, try extracting from og:title
  if (!tweetText || tweetText.length < 20) {
    const ogTitle = doc.querySelector('meta[property="og:title"]')?.getAttribute('content') || '';
    // Format: "Author on X: "tweet content here""
    const titleMatch = ogTitle.match(/on (?:X|Twitter):\s*[""]?(.+?)[""]?\s*$/);
    if (titleMatch && titleMatch[1]) {
      tweetText = titleMatch[1];
    }
  }
  
  // Also try twitter:description
  if (!tweetText || tweetText.length < 20) {
    const twitterDesc = doc.querySelector('meta[name="twitter:description"]')?.getAttribute('content') || '';
    if (twitterDesc && twitterDesc.length > tweetText.length) {
      tweetText = twitterDesc;
    }
  }
  
  // Try to get from the title element as last resort
  if (!tweetText || tweetText.length < 20) {
    const titleEl = doc.querySelector('title')?.textContent || '';
    const titleMatch = titleEl.match(/on (?:X|Twitter):\s*[""]?(.+?)[""]?\s*$/);
    if (titleMatch && titleMatch[1]) {
      tweetText = titleMatch[1];
    }
  }
  
  if (tweetText) {
    // Clean up the tweet text
    tweetText = tweetText
      .replace(/^[""]/, '')  // Remove leading quote
      .replace(/[""]$/, '')  // Remove trailing quote
      .replace(/\s+/g, ' ')  // Normalize whitespace
      .trim();
    parts.push(tweetText);
  }
  
  return parts.join('\n\n');
}

// Extract YouTube content
function extractYouTubeContent(doc: Document): string {
  const title = doc.querySelector('meta[property="og:title"]')?.getAttribute('content') || '';
  const description = doc.querySelector('meta[property="og:description"]')?.getAttribute('content') || '';
  
  // Try to get full description
  const descSelectors = [
    '#description-inline-expander',
    '#description',
    'ytd-text-inline-expander',
  ];
  
  let fullDescription = '';
  for (const selector of descSelectors) {
    const element = doc.querySelector(selector);
    if (element?.textContent) {
      fullDescription = element.textContent.trim();
      break;
    }
  }
  
  return [title, fullDescription || description].filter(Boolean).join('\n\n');
}

// Extract article content
function extractArticleContent(doc: Document): string {
  // Remove unwanted elements
  const unwantedSelectors = [
    'script', 'style', 'nav', 'header', 'footer', 'aside',
    '.sidebar', '.advertisement', '.ads', '.social-share',
    '.comments', '.related-posts', '.newsletter', '[role="banner"]',
    '[role="navigation"]', '[role="complementary"]', '.cookie-notice',
  ];
  
  const docClone = doc.cloneNode(true) as Document;
  unwantedSelectors.forEach(selector => {
    docClone.querySelectorAll(selector).forEach(el => el.remove());
  });
  
  // Content selectors
  const contentSelectors = [
    'article',
    '[role="article"]',
    'main',
    '.post-content',
    '.article-content',
    '.entry-content',
    '.content',
    '.post-body',
    '.blog-post',
    '#content',
    '.markdown-body',
    '.prose',
  ];
  
  let contentElement: Element | null = null;
  for (const selector of contentSelectors) {
    contentElement = docClone.querySelector(selector);
    if (contentElement && contentElement.textContent && contentElement.textContent.length > 200) {
      break;
    }
  }
  
  if (!contentElement) {
    contentElement = docClone.body;
  }
  
  // Extract text from paragraphs and headings
  if (contentElement) {
    const textElements = contentElement.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, blockquote, pre');
    const textParts: string[] = [];
    
    textElements.forEach(el => {
      const text = el.textContent?.trim();
      if (text && text.length > 10) {
        textParts.push(text);
      }
    });
    
    if (textParts.length > 0) {
      return textParts.join('\n\n');
    }
  }
  
  // Fallback to all text
  return contentElement?.textContent?.replace(/\s+/g, ' ').trim() || '';
}

// Main content extraction
function extractFullContent(doc: Document, url: string): {
  fullText: string;
  contentType: string;
  author?: string;
  wordCount: number;
} {
  const contentType = detectContentType(url);
  let fullText = '';
  
  switch (contentType) {
    case 'tweet':
      fullText = extractTwitterContent(doc, url);
      break;
    case 'video':
      fullText = extractYouTubeContent(doc);
      break;
    case 'article':
    default:
      fullText = extractArticleContent(doc);
      break;
  }
  
  // Clean the text
  fullText = fullText
    .replace(/\s+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  
  // Get author
  const authorSelectors = [
    '[rel="author"]',
    '.author-name',
    '.post-author',
    '[itemprop="author"]',
    '.byline',
    'meta[name="author"]',
  ];
  
  let author = '';
  for (const selector of authorSelectors) {
    const element = doc.querySelector(selector);
    if (element) {
      author = element.getAttribute('content') || element.textContent?.trim() || '';
      if (author) break;
    }
  }
  
  const wordCount = fullText.split(/\s+/).filter(w => w.length > 0).length;
  
  return { fullText, contentType, author, wordCount };
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url');
    const extractContent = searchParams.get('extractContent') === 'true';

    if (!url || url.trim().length === 0) {
      return NextResponse.json(
        { error: 'URL parameter is required' }, 
        { status: 400 }
      );
    }

    // Normalize and validate URL
    let normalizedUrl = url.trim();
    try {
      if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
        normalizedUrl = `https://${normalizedUrl}`;
      }
      const urlObj = new URL(normalizedUrl);
      // Ensure we have a valid protocol
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        throw new Error('Invalid protocol');
      }
    } catch (e) {
      logger.warn('GET /api/metadata: Invalid URL', { url });
      return NextResponse.json(
        { error: 'Invalid URL format' }, 
        { status: 400 }
      );
    }

    logger.info('GET /api/metadata: Request received', { 
      url: normalizedUrl, 
      extractContent 
    });

    // Special handling for tweets - use oEmbed API
    if (isTweetUrl(normalizedUrl)) {
      logger.info('GET /api/metadata: Detected tweet URL, using oEmbed API', { url: normalizedUrl });
      
      const tweetData = await fetchTweetOEmbed(normalizedUrl);
      if (tweetData) {
        const duration = Date.now() - startTime;
        logger.info('GET /api/metadata: Tweet oEmbed success', {
          url: normalizedUrl,
          hasTitle: !!tweetData.title,
          hasDescription: !!tweetData.description,
          durationMs: duration
        });
        
        return NextResponse.json({
          title: tweetData.title,
          description: tweetData.description,
          image: '',
          siteName: tweetData.siteName,
          favicon: 'https://abs.twimg.com/favicons/twitter.3.ico',
          content: tweetData.description,
          fullContent: {
            fullText: `${tweetData.title}\n\n${tweetData.description}`,
            contentType: 'tweet',
            author: tweetData.author,
            wordCount: tweetData.description.split(/\s+/).length,
          }
        }, {
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
          },
        });
      }
      // Fall through to regular HTML fetch if oEmbed fails
      logger.warn('GET /api/metadata: Tweet oEmbed failed, falling back to HTML', { url: normalizedUrl });
    }

    // Fetch HTML with timeout and retry
    const html = await withTimeout(
      getHtml(normalizedUrl),
      METADATA_TIMEOUT_MS,
      'Metadata fetch timed out'
    );
    
    if (!html || html.length === 0) {
      logger.warn('GET /api/metadata: No HTML content fetched', { url: normalizedUrl });
      const parsedUrl = new URL(normalizedUrl);
      return NextResponse.json({ 
        title: parsedUrl.hostname,
        description: 'Website content could not be fetched.',
        favicon: `${parsedUrl.protocol}//${parsedUrl.host}/favicon.ico`,
        siteName: parsedUrl.hostname,
        image: '',
        content: '',
        fullContent: null
      });
    }

    // Parse HTML with JSDOM
    let doc: Document;
    try {
      const { JSDOM } = await import('jsdom');
      const dom = new JSDOM(html, { 
        url: normalizedUrl,
        pretendToBeVisual: true,
        resources: 'usable'
      });
      doc = dom.window.document;
    } catch (parseError: any) {
      logger.error('GET /api/metadata: HTML parsing failed', { 
        url: normalizedUrl,
        error: parseError.message 
      }, parseError);
      throw new Error('Failed to parse HTML content');
    }

    // Extract metadata
    let metadata, favicon, fullContent, basicContent;
    try {
      metadata = getMeta(doc, normalizedUrl);
      favicon = getFavicon(doc, normalizedUrl);
      
      // Extract full content for semantic search
      if (extractContent) {
        try {
          fullContent = extractFullContent(doc, normalizedUrl);
        } catch (contentError: any) {
          logger.warn('GET /api/metadata: Content extraction failed', { 
            url: normalizedUrl,
            error: contentError.message 
          });
          fullContent = null;
        }
      }
      
      // Basic content for backward compatibility
      basicContent = fullContent?.fullText?.slice(0, 1000) || '';
    } catch (extractError: any) {
      logger.error('GET /api/metadata: Metadata extraction failed', { 
        url: normalizedUrl,
        error: extractError.message 
      }, extractError);
      // Continue with fallback values
      metadata = { title: '', description: '', image: '', siteName: '' };
      favicon = '';
      fullContent = null;
      basicContent = '';
    }

    const parsedUrl = new URL(normalizedUrl);
    const result = {
      title: metadata.title || parsedUrl.hostname,
      description: metadata.description || '',
      image: metadata.image || '',
      siteName: metadata.siteName || parsedUrl.hostname,
      favicon: favicon || `${parsedUrl.protocol}//${parsedUrl.host}/favicon.ico`,
      content: basicContent,
      // Extended content for semantic search
      fullContent: fullContent ? {
        fullText: fullContent.fullText,
        contentType: fullContent.contentType,
        author: fullContent.author,
        wordCount: fullContent.wordCount,
      } : null
    };

    const duration = Date.now() - startTime;
    logger.info('GET /api/metadata: Success', {
      url: normalizedUrl,
      hasTitle: !!result.title,
      hasDescription: !!result.description,
      hasFullContent: !!fullContent,
      durationMs: duration
    });

    // Return response with no-cache headers to prevent Next.js caching large responses
    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });

  } catch (error: any) {
    const duration = Date.now() - startTime;
    
    // Try to get URL for fallback response
    let normalizedUrl = '';
    try {
      const { searchParams } = new URL(request.url);
      const url = searchParams.get('url') || '';
      normalizedUrl = url.startsWith('http') ? url : `https://${url}`;
      new URL(normalizedUrl);
    } catch {
      // Invalid URL, use empty fallback
    }

    logger.error('GET /api/metadata: Error', { 
      url: normalizedUrl || 'unknown',
      error: error.message,
      durationMs: duration
    }, error);

    try {
      const parsedUrl = normalizedUrl ? new URL(normalizedUrl) : null;
      return NextResponse.json({
        title: parsedUrl?.hostname || 'Unknown',
        description: error instanceof TimeoutError 
          ? 'Metadata fetch timed out. Please try again.'
          : 'Error occurred while fetching metadata.',
        favicon: parsedUrl 
          ? `${parsedUrl.protocol}//${parsedUrl.host}/favicon.ico`
          : '',
        siteName: parsedUrl?.hostname || '',
        image: '',
        content: '',
        fullContent: null
      }, { 
        status: error instanceof TimeoutError ? 504 : 500 
      });
    } catch (urlError) {
      return NextResponse.json({
        title: normalizedUrl || 'Unknown',
        description: 'Error occurred while fetching metadata.',
        favicon: '',
        siteName: '',
        image: '',
        content: '',
        fullContent: null
      }, { status: 500 });
    }
  }
}

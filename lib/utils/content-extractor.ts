// Content Extraction Service
// Extracts full text content from various link types (Twitter, YouTube, blogs, etc.)

export interface ExtractedContent {
  title: string;
  description: string;
  fullText: string;
  contentType: 'article' | 'tweet' | 'video' | 'webpage' | 'unknown';
  author?: string;
  publishedDate?: string;
  wordCount: number;
}

// Detect content type from URL
export const detectContentType = (url: string): ExtractedContent['contentType'] => {
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
};

// Extract Twitter/X content
export const extractTwitterContent = (doc: Document): Partial<ExtractedContent> => {
  // Try to get tweet text from various selectors
  const tweetSelectors = [
    '[data-testid="tweetText"]',
    '.tweet-text',
    '[lang] > span',
    'article [dir="auto"]',
  ];
  
  let tweetText = '';
  for (const selector of tweetSelectors) {
    const element = doc.querySelector(selector);
    if (element?.textContent) {
      tweetText = element.textContent.trim();
      break;
    }
  }
  
  // Get author
  const authorSelectors = [
    '[data-testid="User-Name"]',
    '.username',
    'a[href*="/status/"] span',
  ];
  
  let author = '';
  for (const selector of authorSelectors) {
    const element = doc.querySelector(selector);
    if (element?.textContent) {
      author = element.textContent.trim();
      break;
    }
  }
  
  // Fallback to og:description for tweet content
  const ogDescription = doc.querySelector('meta[property="og:description"]')?.getAttribute('content') || '';
  
  return {
    fullText: tweetText || ogDescription,
    contentType: 'tweet',
    author,
  };
};

// Extract YouTube content
export const extractYouTubeContent = (doc: Document): Partial<ExtractedContent> => {
  // Get video title
  const title = doc.querySelector('meta[property="og:title"]')?.getAttribute('content') ||
                doc.querySelector('title')?.textContent || '';
  
  // Get video description
  const description = doc.querySelector('meta[property="og:description"]')?.getAttribute('content') ||
                     doc.querySelector('meta[name="description"]')?.getAttribute('content') || '';
  
  // Try to get full description from page
  const descriptionSelectors = [
    '#description-inline-expander',
    '#description',
    '[slot="content"]',
    'ytd-text-inline-expander',
  ];
  
  let fullDescription = '';
  for (const selector of descriptionSelectors) {
    const element = doc.querySelector(selector);
    if (element?.textContent) {
      fullDescription = element.textContent.trim();
      break;
    }
  }
  
  // Get channel name
  const channelSelectors = [
    '#channel-name',
    'ytd-channel-name',
    '[itemprop="author"] [itemprop="name"]',
  ];
  
  let author = '';
  for (const selector of channelSelectors) {
    const element = doc.querySelector(selector);
    if (element?.textContent) {
      author = element.textContent.trim();
      break;
    }
  }
  
  const fullText = [title, fullDescription || description].filter(Boolean).join('\n\n');
  
  return {
    title,
    description,
    fullText,
    contentType: 'video',
    author,
  };
};

// Extract article/blog content
export const extractArticleContent = (doc: Document): Partial<ExtractedContent> => {
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
  
  // Content selectors in order of preference
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
  
  // Extract text content
  let fullText = '';
  if (contentElement) {
    // Get all paragraphs and headings
    const textElements = contentElement.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, blockquote, pre, code');
    const textParts: string[] = [];
    
    textElements.forEach(el => {
      const text = el.textContent?.trim();
      if (text && text.length > 10) {
        textParts.push(text);
      }
    });
    
    fullText = textParts.join('\n\n');
  }
  
  // If still no content, get all text
  if (!fullText || fullText.length < 100) {
    fullText = contentElement?.textContent?.replace(/\s+/g, ' ').trim() || '';
  }
  
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
  
  // Get published date
  const dateSelectors = [
    'time[datetime]',
    '[itemprop="datePublished"]',
    '.post-date',
    '.publish-date',
    'meta[property="article:published_time"]',
  ];
  
  let publishedDate = '';
  for (const selector of dateSelectors) {
    const element = doc.querySelector(selector);
    if (element) {
      publishedDate = element.getAttribute('datetime') || 
                     element.getAttribute('content') || 
                     element.textContent?.trim() || '';
      if (publishedDate) break;
    }
  }
  
  return {
    fullText,
    contentType: 'article',
    author,
    publishedDate,
  };
};

// Main extraction function
export const extractFullContent = (doc: Document, url: string): ExtractedContent => {
  const contentType = detectContentType(url);
  
  // Get basic metadata
  const title = doc.querySelector('meta[property="og:title"]')?.getAttribute('content') ||
               doc.querySelector('title')?.textContent?.trim() || '';
  
  const description = doc.querySelector('meta[property="og:description"]')?.getAttribute('content') ||
                     doc.querySelector('meta[name="description"]')?.getAttribute('content') || '';
  
  let extracted: Partial<ExtractedContent> = {};
  
  switch (contentType) {
    case 'tweet':
      extracted = extractTwitterContent(doc);
      break;
    case 'video':
      extracted = extractYouTubeContent(doc);
      break;
    case 'article':
    default:
      extracted = extractArticleContent(doc);
      break;
  }
  
  const fullText = extracted.fullText || description || '';
  
  return {
    title: extracted.title || title,
    description: description,
    fullText: cleanText(fullText),
    contentType,
    author: extracted.author,
    publishedDate: extracted.publishedDate,
    wordCount: countWords(fullText),
  };
};

// Clean extracted text
const cleanText = (text: string): string => {
  return text
    .replace(/\s+/g, ' ')  // Normalize whitespace
    .replace(/\n{3,}/g, '\n\n')  // Max 2 newlines
    .replace(/[^\S\n]+/g, ' ')  // Normalize spaces
    .trim();
};

// Count words
const countWords = (text: string): number => {
  return text.split(/\s+/).filter(word => word.length > 0).length;
};

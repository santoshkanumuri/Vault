export interface LinkMetadata {
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
  favicon?: string;
  content?: string;
}

// Add URL validation function
export const isValidUrl = (url: string): boolean => {
  try {
    // Ensure URL has protocol
    const normalized = url.startsWith('http') ? url : `https://${url}`;
    new URL(normalized);
    return true;
  } catch {
    return false;
  }
};

export const fetchLinkMetadata = async (url: string): Promise<LinkMetadata> => {
  try {
    // Fetching metadata for URL
    
    const response = await fetch(`/api/metadata?url=${encodeURIComponent(url)}`);

    if (!response.ok) {
      console.error(`HTTP error! status: ${response.status}`);
      return {
        title: url,
        description: 'Could not fetch metadata for this URL.',
        favicon: '',
        siteName: '',
        image: '',
        content: ''
      };
    }

    const metadata: LinkMetadata = await response.json();
    // Metadata received successfully
    
    return metadata;
  } catch (error) {
    console.error("Error fetching link metadata:", error);
    return {
      title: url,
      description: 'Error occurred while fetching metadata.',
      favicon: '',
      siteName: '',
      image: '',
      content: ''
    };
  }
};
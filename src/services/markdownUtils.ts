/**
 * Appends a title to markdown content with a '#' prefix
 * @param contentMd - The original markdown content
 * @param title - The title to append
 * @returns The combined markdown content with the title
 */
export const appendContentToTitle = (contentMd: string, title: string): string => {
  // ✅ Sécurité : gérer le cas où contentMd est undefined ou null
  const safeContentMd = contentMd || '';
  
  // If content is empty, just return the title with #
  if (!safeContentMd.trim()) {
    return `# ${title}`;
  }

  // Append the title with # prefix
  return `# ${title}\n ${safeContentMd}`;
};

/**
 * Extracts the title from markdown content (first line starting with #)
 * @param contentMd - The markdown content
 * @returns The extracted title or null if no title found
 */
export const extractTitleFromMarkdown = (contentMd: string): string | null => {
  const lines = contentMd.split('\n');
  const firstLine = lines[0]?.trim();
  
  if (firstLine && firstLine.startsWith('#')) {
    return firstLine.substring(1).trim();
  }
  
  return null;
};

/**
 * Appends a title to markdown content with a '#' prefix
 * @param contentMd - The original markdown content
 * @param title - The title to append
 * @returns The combined markdown content with the title
 */
export const appendContentToTitle = (contentMd: string, title: string): string => {
  // If content is empty, just return the title with #
  if (!contentMd.trim()) {
    return `# ${title}`;
  }

  // Append the title with # prefix
  return `# ${title}\n ${contentMd}`;
};

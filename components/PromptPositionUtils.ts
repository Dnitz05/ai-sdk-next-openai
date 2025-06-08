import { IAPrompt } from './PromptSidebar';

/**
 * Calculate positions for prompts based on paragraph positions in the document
 * and adjust to prevent overlapping
 */
export const calculatePromptPositions = (
  prompts: IAPrompt[],
  documentRef: React.RefObject<HTMLDivElement>,
  contentWrapperRef: React.RefObject<HTMLDivElement>
): IAPrompt[] => {
  if (!documentRef.current || !contentWrapperRef.current) return prompts;
  
  const updatedPrompts = [...prompts];
  const paragraphElements: Record<string, DOMRect> = {};
  const wrapperRect = contentWrapperRef.current.getBoundingClientRect();
  
  // Get positions of all paragraphs with IDs
  documentRef.current.querySelectorAll('p[data-paragraph-id]').forEach(p => {
    const id = (p as HTMLElement).dataset.paragraphId;
    if (id) {
      const rect = p.getBoundingClientRect();
      // Store position relative to the wrapper
      paragraphElements[id] = rect;
    }
  });
  
  // Update prompt positions based on paragraph positions
  updatedPrompts.forEach(prompt => {
    const rect = paragraphElements[prompt.paragraphId];
    if (rect) {
      // Calculate the vertical center position of the paragraph relative to the wrapper
      prompt.position = rect.top + (rect.height / 2) - wrapperRect.top;
    }
  });
  
  // Sort prompts by position
  updatedPrompts.sort((a, b) => a.position - b.position);
  
  // Adjust positions to prevent overlapping
  const MIN_PROMPT_SPACING = 110; // Minimum pixels between prompts (adjust based on collapsed card height)
  
  for (let i = 1; i < updatedPrompts.length; i++) {
    const prevPrompt = updatedPrompts[i - 1];
    const currentPrompt = updatedPrompts[i];
    
    const gap = currentPrompt.position - prevPrompt.position;
    
    if (gap < MIN_PROMPT_SPACING) {
      // If prompts are too close, adjust the current prompt's position
      const adjustment = MIN_PROMPT_SPACING - gap;
      currentPrompt.position += adjustment;
      
      // Propagate adjustment to all subsequent prompts
      for (let j = i + 1; j < updatedPrompts.length; j++) {
        updatedPrompts[j].position += adjustment;
      }
    }
  }
  
  return updatedPrompts;
};

/**
 * Find the paragraph element in the document that corresponds to a specific prompt
 */
export const findParagraphElement = (
  paragraphId: string,
  documentRef: React.RefObject<HTMLDivElement>
): HTMLElement | null => {
  if (!documentRef.current) return null;
  
  return documentRef.current.querySelector(`p[data-paragraph-id="${paragraphId}"]`) as HTMLElement;
};

/**
 * Scroll to a specific paragraph in the document
 */
export const scrollToParagraph = (
  paragraphId: string,
  documentRef: React.RefObject<HTMLDivElement>,
  contentWrapperRef: React.RefObject<HTMLDivElement>
): void => {
  const paragraph = findParagraphElement(paragraphId, documentRef);
  if (!paragraph || !contentWrapperRef.current) return;
  
  const wrapperRect = contentWrapperRef.current.getBoundingClientRect();
  const paragraphRect = paragraph.getBoundingClientRect();
  
  // Calculate scroll position to center the paragraph in the viewport
  const scrollTop = paragraphRect.top + contentWrapperRef.current.scrollTop - wrapperRect.top - (wrapperRect.height / 2) + (paragraphRect.height / 2);
  
  // Smooth scroll to the paragraph
  contentWrapperRef.current.scrollTo({
    top: scrollTop,
    behavior: 'smooth'
  });
  
  // Highlight the paragraph temporarily
  paragraph.classList.add('highlight-paragraph');
  setTimeout(() => {
    paragraph.classList.remove('highlight-paragraph');
  }, 2000);
};

/**
 * Generate a unique ID for a new prompt
 */
export const generatePromptId = (): string => {
  return `prompt-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
};

/**
 * Create a new prompt for a paragraph
 */
export const createPromptForParagraph = (
  paragraphId: string,
  paragraphText: string,
  documentRef: React.RefObject<HTMLDivElement>,
  contentWrapperRef: React.RefObject<HTMLDivElement>
): IAPrompt => {
  const paragraph = findParagraphElement(paragraphId, documentRef);
  let position = 0;
  
  if (paragraph && contentWrapperRef.current) {
    const wrapperRect = contentWrapperRef.current.getBoundingClientRect();
    const paragraphRect = paragraph.getBoundingClientRect();
    position = paragraphRect.top + (paragraphRect.height / 2) - wrapperRect.top;
  }
  
  // Normalitzar el text del paràgraf (eliminar espais innecessaris)
  const normalizedParagraphText = paragraphText.trim();
  
  return {
    id: generatePromptId(),
    paragraphId,
    content: '',
    status: 'draft',
    createdAt: new Date(),
    updatedAt: new Date(),
    position,
    isExpanded: true,
    originalParagraphText: normalizedParagraphText, // Afegir el text original del paràgraf
    useExistingText: true // Valor per defecte segons el pla de l'arquitecte
  };
};

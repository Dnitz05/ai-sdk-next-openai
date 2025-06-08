import React, { useEffect, useRef } from 'react';
import PromptCard from './PromptCard';

export interface IAPrompt {
  id: string;
  paragraphId: string;
  content: string; // Aquest camp ara contindrà SEMPRE el text del prompt
  status: 'draft' | 'saved';
  useExistingText: boolean; // El nou flag
  createdAt: Date;
  updatedAt: Date;
  position: number;
  isExpanded: boolean;
  isEditing?: boolean; // Added isEditing property as optional
  order?: number; // Added order property for sequential numbering
  originalParagraphText?: string; // Text original del paràgraf per ajudar a trobar-lo al DOCX
}

interface PromptSidebarProps {
  prompts: IAPrompt[];
  documentRef: React.RefObject<HTMLDivElement>;
  contentWrapperRef: React.RefObject<HTMLDivElement>;
  onPromptUpdate: (prompt: IAPrompt) => void;
  onPromptDelete: (promptId: string) => void;
  onPromptSelect: (paragraphId: string) => void;
  activePromptId: string | null;
  excelHeaders: string[];
}

const PromptSidebar: React.FC<PromptSidebarProps> = ({
  prompts,
  documentRef,
  contentWrapperRef,
  onPromptUpdate,
  onPromptDelete,
  onPromptSelect,
  activePromptId,
  excelHeaders
}) => {
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Effect to sync scroll position with document
  useEffect(() => {
    if (!documentRef.current || !sidebarRef.current || !contentWrapperRef.current) return;

    const handleDocumentScroll = () => {
      if (!documentRef.current || !sidebarRef.current || !contentWrapperRef.current) return;
      
      // Get the scroll position of the document
      const docScrollTop = contentWrapperRef.current.scrollTop;
      
      // Apply the same scroll position to the sidebar
      sidebarRef.current.scrollTop = docScrollTop;
    };

    // Add scroll event listener to the document
    contentWrapperRef.current.addEventListener('scroll', handleDocumentScroll);

    // Clean up
    return () => {
      if (contentWrapperRef.current) {
        contentWrapperRef.current.removeEventListener('scroll', handleDocumentScroll);
      }
    };
  }, [documentRef, contentWrapperRef]);

  // Sort prompts by order first, then position
  const sortedPrompts = [...prompts].sort((a, b) => {
    const oa = a.order ?? Infinity;  // els 'draft' (sense #) queden al final
    const ob = b.order ?? Infinity;
    return oa === ob ? a.position - b.position : oa - ob;
  });

  return (
    <div 
      ref={sidebarRef}
      className="prompt-sidebar h-full overflow-y-auto bg-[#f3f2f1] border-r border-gray-200"
      style={{ width: '280px', position: 'relative' }}
    >
      <div className="sticky top-4 p-4">
        <div className="bg-white rounded shadow border mb-4">
          <div className="border-b border-gray-200 px-3 py-2 bg-[#f9f9f9]">
            <h3 className="text-sm font-semibold text-gray-700">Prompts IA</h3>
          </div>
          <div className="p-3">
            <p className="text-xs text-gray-500 mb-2">
              {prompts.length} prompts associats
            </p>
          </div>
        </div>

        <div className="prompt-list space-y-4">
          {sortedPrompts.length > 0 ? (
            sortedPrompts.map(prompt => (
              <PromptCard
                key={prompt.id}
                prompt={prompt}
                isActive={activePromptId === prompt.id}
                onUpdate={onPromptUpdate}
                onDelete={onPromptDelete}
                onSelect={() => onPromptSelect(prompt.paragraphId)}
                excelHeaders={excelHeaders}
              />
            ))
          ) : (
            <div className="bg-white rounded shadow border p-4">
              <div className="text-center py-4 text-gray-400 text-sm">
                <p>No hi ha prompts IA</p>
                <p className="text-xs mt-1">Fes clic a un paràgraf per afegir-ne un</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PromptSidebar;

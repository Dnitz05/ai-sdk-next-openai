import React, { useEffect, useRef } from 'react';
import PromptCard from './PromptCard';

export interface IAPrompt {
  id: string;
  paragraphId: string;
  content: string;
  status: 'draft' | 'saved';
  createdAt: Date;
  updatedAt: Date;
  position: number;
  isExpanded: boolean;
  isEditing?: boolean; // Added isEditing property as optional
}

interface PromptSidebarProps {
  prompts: IAPrompt[];
  documentRef: React.RefObject<HTMLDivElement>;
  contentWrapperRef: React.RefObject<HTMLDivElement>;
  onPromptUpdate: (prompt: IAPrompt) => void;
  onPromptDelete: (promptId: string) => void;
  onPromptSelect: (paragraphId: string) => void;
  activePromptId: string | null;
}

const PromptSidebar: React.FC<PromptSidebarProps> = ({
  prompts,
  documentRef,
  contentWrapperRef,
  onPromptUpdate,
  onPromptDelete,
  onPromptSelect,
  activePromptId
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

  // Sort prompts by position
  const sortedPrompts = [...prompts].sort((a, b) => a.position - b.position);

  return (
    <div 
      ref={sidebarRef}
      className="prompt-sidebar h-full overflow-y-auto bg-gray-50 border-r border-gray-200"
      style={{ width: '280px', position: 'relative' }}
    >
      <div className="p-3 border-b border-gray-200 bg-white sticky top-0 z-10">
        <h3 className="text-sm font-semibold text-gray-700">Prompts IA</h3>
        <p className="text-xs text-gray-500 mt-1">
          {prompts.length} prompts associats
        </p>
      </div>

      <div className="prompt-list p-3 space-y-4">
        {sortedPrompts.length > 0 ? (
          sortedPrompts.map(prompt => (
            <PromptCard
              key={prompt.id}
              prompt={prompt}
              isActive={activePromptId === prompt.id}
              onUpdate={onPromptUpdate}
              onDelete={onPromptDelete}
              onSelect={() => onPromptSelect(prompt.paragraphId)}
            />
          ))
        ) : (
          <div className="text-center py-6 text-gray-400 text-sm">
            <p>No hi ha prompts IA</p>
            <p className="text-xs mt-1">Fes clic a un paràgraf per afegir-ne un</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PromptSidebar;

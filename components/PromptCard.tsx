import React, { useState, useRef, useEffect } from 'react';
import { IAPrompt } from './PromptSidebar';

interface PromptCardProps {
  prompt: IAPrompt;
  isActive: boolean;
  onUpdate: (prompt: IAPrompt) => void;
  onDelete: (promptId: string) => void;
  onSelect: () => void;
}

const PromptCard: React.FC<PromptCardProps> = ({
  prompt,
  isActive,
  onUpdate,
  onDelete,
  onSelect
}) => {
  // Use the isEditing property from the prompt if it exists, otherwise use local state
  const [isEditing, setIsEditing] = useState(prompt.isEditing || false);
  const [content, setContent] = useState(prompt.content);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Focus textarea when editing starts or when the component mounts with isEditing=true
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      
      // Place cursor at the end of the text
      const length = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(length, length);
    }
  }, [isEditing]);

  // Check if the prompt has the isEditing property and update local state
  useEffect(() => {
    if (prompt.isEditing) {
      setIsEditing(true);
      // Clear the isEditing flag in the prompt to avoid reopening on re-render
      onUpdate({
        ...prompt,
        isEditing: false
      });
    }
  }, [prompt.isEditing, prompt.id]);

  // Auto-resize textarea based on content
  useEffect(() => {
    if (textareaRef.current) {
      // Reset height to auto to get the correct scrollHeight
      textareaRef.current.style.height = 'auto';
      
      // Set the height to scrollHeight to fit the content
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${Math.min(scrollHeight, 200)}px`;
    }
  }, [content, isEditing]);

  // Handle save action
  const handleSave = () => {
    // If content is empty, delete the prompt instead of saving it
    if (content.trim() === '') {
      onDelete(prompt.id);
      return;
    }
    
    onUpdate({
      ...prompt,
      content,
      status: 'saved',
      updatedAt: new Date()
    });
    setIsEditing(false);
  };

  // Handle cancel action
  const handleCancel = () => {
    // If the prompt was new (empty content) and user cancels, delete it
    if (prompt.content.trim() === '' && content.trim() === '') {
      onDelete(prompt.id);
      return;
    }
    
    setContent(prompt.content);
    setIsEditing(false);
  };

  // Handle blur event on textarea
  const handleBlur = () => {
    // If content is empty, delete the prompt
    if (content.trim() === '') {
      onDelete(prompt.id);
      return;
    }
    
    // Otherwise save the content
    handleSave();
  };

  // Handle expand/collapse toggle
  const toggleExpand = () => {
    onUpdate({
      ...prompt,
      isExpanded: !prompt.isExpanded
    });
  };

  // Handle delete confirmation
  const handleDeleteConfirm = () => {
    if (isConfirmingDelete) {
      onDelete(prompt.id);
      setIsConfirmingDelete(false);
    } else {
      setIsConfirmingDelete(true);
    }
  };

  // Cancel delete confirmation
  const cancelDelete = () => {
    setIsConfirmingDelete(false);
  };

  // Get paragraph number or ID for display
  const paragraphIdentifier = prompt.paragraphId.substring(0, 5);

  return (
    <div 
      className={`prompt-card rounded-md border ${
        isActive 
          ? 'border-indigo-500 bg-indigo-50' 
          : prompt.status === 'saved' 
            ? 'border-green-200 bg-white' 
            : 'border-gray-200 bg-white'
      } shadow-sm transition-all duration-200 overflow-hidden`}
      style={{ 
        maxHeight: prompt.isExpanded ? '500px' : isEditing ? '300px' : '100px',
        position: 'relative'
      }}
    >
      {/* Card header with controls */}
      <div className="prompt-header flex items-center justify-between p-2 bg-gray-50 border-b border-gray-200">
        <div 
          className="paragraph-indicator flex items-center text-xs font-medium cursor-pointer"
          onClick={onSelect}
        >
          {/* Display prompt order number in a circle */}
          <span className={`w-4 h-4 rounded-full mr-1.5 flex items-center justify-center text-white text-xs font-bold ${
            isActive ? 'bg-indigo-600' : 'bg-gray-500'
          }`}>
            {prompt.order || ''}
          </span>
          <span>¶ {paragraphIdentifier}</span>
        </div>
        
        <div className="prompt-controls flex space-x-1">
          <button 
            onClick={toggleExpand}
            className="p-1 text-gray-500 hover:text-gray-700 rounded"
            title={prompt.isExpanded ? "Col·lapsar" : "Expandir"}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {prompt.isExpanded 
                ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              }
            </svg>
          </button>
          
          {!isEditing && (
            <button 
              onClick={() => setIsEditing(true)}
              className="p-1 text-gray-500 hover:text-indigo-600 rounded"
              title="Editar"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
          )}
          
          {!isEditing && !isConfirmingDelete && (
            <button 
              onClick={handleDeleteConfirm}
              className="p-1 text-gray-500 hover:text-red-600 rounded"
              title="Eliminar"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
      </div>
      
      {/* Card content */}
      <div className="prompt-content p-2">
        {isEditing ? (
          <div className="editing-container">
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onBlur={handleBlur}
              className="w-full p-1.5 text-sm border border-gray-300 rounded focus:ring-indigo-500 focus:border-indigo-500"
              style={{ 
                resize: 'none',
                minHeight: '60px',
                maxHeight: '200px',
                overflow: 'auto'
              }}
              placeholder="Escriu el teu prompt d'IA aquí..."
            />
            <div className="flex justify-end space-x-2 mt-2">
              <button
                onClick={handleCancel}
                className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
              >
                Cancel·lar
              </button>
              <button
                onClick={handleSave}
                className="px-2 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700"
              >
                Desar
              </button>
            </div>
          </div>
        ) : isConfirmingDelete ? (
          <div className="delete-confirmation p-1.5">
            <p className="text-sm text-red-600 font-medium">Segur que vols eliminar?</p>
            <div className="flex justify-end space-x-2 mt-2">
              <button
                onClick={cancelDelete}
                className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
              >
                Cancel·lar
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
              >
                Eliminar
              </button>
            </div>
          </div>
        ) : (
          <div className="prompt-text text-sm text-gray-700 whitespace-pre-wrap">
            {prompt.isExpanded 
              ? prompt.content 
              : prompt.content.length > 100 
                ? `${prompt.content.substring(0, 100)}...` 
                : prompt.content
            }
            {!prompt.isExpanded && prompt.content.length > 100 && (
              <button 
                onClick={toggleExpand}
                className="text-xs text-indigo-600 hover:text-indigo-800 ml-1"
              >
                Veure més
              </button>
            )}
          </div>
        )}
      </div>
      
      {/* Status indicator */}
      <div className="status-indicator absolute bottom-0 left-0 right-0 h-1">
        <div 
          className={`h-full ${
            prompt.status === 'saved' ? 'bg-green-500' : 'bg-yellow-400'
          }`}
          style={{ width: prompt.status === 'saved' ? '100%' : '60%' }}
        ></div>
      </div>
      
      {/* Visual connector to paragraph - dotted line */}
      <div 
        className="prompt-connector absolute right-0 top-1/2 border-t border-dashed border-gray-400"
        style={{ 
          width: '10px',
          transform: 'translateY(-50%)'
        }}
      ></div>
    </div>
  );
};

export default PromptCard;

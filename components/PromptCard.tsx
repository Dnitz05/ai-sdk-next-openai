import React, { useState, useRef, useEffect } from 'react';
import { IAPrompt } from './PromptSidebar';

interface PromptCardProps {
  prompt: IAPrompt;
  isActive: boolean;
  onUpdate: (prompt: IAPrompt) => void;
  onDelete: (promptId: string) => void;
  onSelect: () => void;
  excelHeaders: string[];
}

const PromptCard: React.FC<PromptCardProps> = ({
  prompt,
  isActive,
  onUpdate,
  onDelete,
  onSelect,
  excelHeaders
}) => {
  // Use the isEditing property from the prompt if it exists, otherwise use local state
  const [isEditing, setIsEditing] = useState(prompt.isEditing || false);
  const [content, setContent] = useState(prompt.content);
  const [useExistingText, setUseExistingText] = useState(prompt.useExistingText || false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [showExcelDropdown, setShowExcelDropdown] = useState(false);
  const [isInteractingWithInternalControls, setIsInteractingWithInternalControls] = useState(false);
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
    
    // El contingut ja s'hauria d'haver propagat.
    // Aquí principalment canviem l'status a 'saved' i actualitzem el timestamp.
    onUpdate({
      ...prompt,
      content, // Assegura que s'envia el contingut actual de l'estat local
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

  // Handle blur event on textarea with delay to allow internal interactions
  const handleBlur = () => {
    // Add small delay to check if user is interacting with internal controls
    setTimeout(() => {
      // Only proceed with blur handling if we're not interacting with internal controls
      if (!isInteractingWithInternalControls) {
        // If content is empty, delete the prompt
        if (content.trim() === '') {
          onDelete(prompt.id);
          return;
        }
        
        // Otherwise save the content
        handleSave();
      }
    }, 100); // Small delay to allow internal clicks to register
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

  // Handle insert placeholder function
  const handleInsertPlaceholder = (header: string) => {
    if (textareaRef.current) {
      const textarea = textareaRef.current;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const placeholder = `{{${header}}}`;
      
      // Insert the placeholder at cursor position
      const newContent = content.substring(0, start) + placeholder + content.substring(end);
      setContent(newContent);
      
      // Update the prompt immediately
      onUpdate({
        ...prompt,
        content: newContent,
        updatedAt: new Date()
      });
      
      // Set cursor position after the inserted placeholder
      setTimeout(() => {
        const newPosition = start + placeholder.length;
        textarea.setSelectionRange(newPosition, newPosition);
        textarea.focus();
      }, 0);
    }
    setShowExcelDropdown(false);
  };

  // Handle checkbox change
  const handleUseExistingTextChange = (checked: boolean) => {
    setUseExistingText(checked);
    onUpdate({
      ...prompt,
      useExistingText: checked,
      updatedAt: new Date()
    });
  };

  // Determine if the order number should be displayed
  // Only show the order number if the prompt has been saved with content
  const showOrderNumber = prompt.status === 'saved' && prompt.order !== undefined;

  return (
    <div 
      className={`prompt-card rounded border shadow ${
        isActive 
          ? 'border-indigo-500' 
          : 'border-gray-200'
      } bg-white transition-all duration-200 overflow-hidden`}
      style={{ 
        maxHeight: prompt.isExpanded ? '500px' : isEditing ? '300px' : '100px',
        position: 'relative'
      }}
    >
      {/* Card header with controls */}
      <div className="prompt-header flex items-center justify-between px-3 py-2 bg-[#f9f9f9] border-b border-gray-200">
        <div 
          className="paragraph-indicator flex items-center text-xs font-medium cursor-pointer"
          onClick={onSelect}
        >
          {/* Display prompt order number in a circle only if it has been saved with content */}
          {showOrderNumber ? (
            <span className={`w-4 h-4 rounded-full mr-1.5 flex items-center justify-center text-white text-xs font-bold ${
              isActive ? 'bg-indigo-600' : 'bg-gray-500'
            }`}>
              {prompt.order}
            </span>
          ) : (
            <span className="w-4 h-4 mr-1.5"></span> // Empty placeholder to maintain spacing
          )}
          {/* Removed the paragraph identifier text */}
        </div>
        
        <div className="prompt-controls flex space-x-1">
          {/* Only show expand button if content is long enough to need expansion */}
          {prompt.content.length > 100 && (
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
            {/* Excel dropdown button */}
            {excelHeaders.length > 0 && (
              <div className="relative mb-2">
                <button
                  onMouseDown={() => setIsInteractingWithInternalControls(true)}
                  onMouseUp={() => setTimeout(() => setIsInteractingWithInternalControls(false), 150)}
                  onClick={() => setShowExcelDropdown(!showExcelDropdown)}
                  className="w-full px-2 py-1 text-xs bg-green-100 border border-green-300 rounded hover:bg-green-200 text-green-800 flex items-center justify-between"
                  type="button"
                >
                  <span>＋ Inserir camp d'Excel ▼</span>
                </button>
                
                {showExcelDropdown && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded shadow-lg max-h-32 overflow-y-auto">
                    {excelHeaders.map((header, index) => (
                      <button
                        key={index}
                        onMouseDown={() => setIsInteractingWithInternalControls(true)}
                        onMouseUp={() => setTimeout(() => setIsInteractingWithInternalControls(false), 150)}
                        onClick={() => handleInsertPlaceholder(header)}
                        className="w-full px-3 py-1 text-xs text-left hover:bg-gray-100 first:rounded-t last:rounded-b"
                        type="button"
                      >
                        {header}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => {
                const newContent = e.target.value;
                setContent(newContent);
                // Propagate changes immediately to TemplateEditor with 'draft' status
                // or keep 'saved' if it was already saved and just being edited.
                // The key is that the content is updated in the parent.
                onUpdate({
                  ...prompt,
                  content: newContent,
                  // status: prompt.status === 'saved' ? 'saved' : 'draft', // Keep status or set to draft
                  updatedAt: new Date() // Update timestamp on any change
                });
              }}
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
            
            {/* Checkbox for using existing text */}
            <div className="flex items-center mt-2 mb-2">
              <input
                type="checkbox"
                id={`use-existing-${prompt.id}`}
                checked={useExistingText}
                onChange={(e) => handleUseExistingTextChange(e.target.checked)}
                className="h-3 w-3 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
              />
              <label 
                htmlFor={`use-existing-${prompt.id}`}
                className="ml-2 text-xs text-gray-700 cursor-pointer"
              >
                Usar el paràgraf existent com a base
              </label>
            </div>
            
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
          <div 
            className="prompt-text text-sm text-gray-700 whitespace-pre-wrap cursor-pointer hover:bg-gray-50 p-1 rounded"
            onClick={() => !isConfirmingDelete && setIsEditing(true)}
            title="Fes clic per editar"
          >
            {prompt.isExpanded 
              ? prompt.content 
              : prompt.content.length > 100 
                ? `${prompt.content.substring(0, 100)}...` 
                : prompt.content
            }
            {!prompt.isExpanded && prompt.content.length > 100 && (
              <button 
                onClick={(e) => {
                  e.stopPropagation(); // Prevent triggering edit mode
                  toggleExpand();
                }}
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

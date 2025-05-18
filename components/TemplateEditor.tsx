import React, { useState, useEffect, useRef, MouseEvent } from 'react';
import { v4 as uuidv4 } from 'uuid'; // Importar uuid
import * as XLSX from 'xlsx';
import PromptSidebar, { IAPrompt } from './PromptSidebar';
import { createBrowserSupabaseClient } from '@/lib/supabase/browserClient';
import { 
  calculatePromptPositions, 
  scrollToParagraph, 
  createPromptForParagraph,
  findParagraphElement
} from './PromptPositionUtils';
import './PromptSidebar.css';

// Legacy interfaces kept for backward compatibility
interface ParagraphIaData {
  currentPrompt: string;
  savedPrompt: string;
  y: number;
  height: number;
  isActiveEditor: boolean;
}

interface ParagraphButtonVisual {
  yButton: number;
  showButton: boolean;
  hasSavedPrompt: boolean;
}

interface TemplateEditorProps {
  initialTemplateData: any;
  mode: 'edit' | 'new';
}

const MIN_EDITOR_BOX_HEIGHT = 90; // px - Adjusted for label, button, padding, and some textarea space

const TemplateEditor: React.FC<TemplateEditorProps> = ({ initialTemplateData, mode }) => {
  const templateTitle = initialTemplateData?.config_name || '';
  const docxName = initialTemplateData?.base_docx_name || ''; // Nom del fitxer DOCX original
  const excelName = initialTemplateData?.excel_file_name || '';
  const initialExcelHeaders: string[] = initialTemplateData?.excel_headers || [];

  // Nous estats per a la gestió de l'ID de la plantilla i la ruta del DOCX a Storage
  const [currentTemplateId, setCurrentTemplateId] = useState<string | null>(null);
  const [originalDocxStoragePath, setOriginalDocxStoragePath] = useState<string | null>(
    initialTemplateData?.base_docx_storage_path || null
  );
  
  // State for Excel headers so they can be updated
  const [excelHeaders, setExcelHeaders] = useState<string[]>(initialExcelHeaders);
  
  // Use creation and modification dates from initialTemplateData if available,
  // otherwise use default historical dates
  const createdDate = initialTemplateData?.created_at
    ? new Date(initialTemplateData.created_at)
    : new Date(2024, 0, 15); // January 15, 2024 as default
  
  const modifiedDate = initialTemplateData?.updated_at
    ? new Date(initialTemplateData.updated_at)
    : new Date(2024, 3, 5); // April 5, 2024 as default

  const [selectedExcelHeader, setSelectedExcelHeader] = useState<string | null>(null);
  const [convertedHtml, setConvertedHtml] = useState<string>(initialTemplateData?.final_html || '');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [isEditingTitle, setIsEditingTitle] = useState<boolean>(false);
  const [templateTitleValue, setTemplateTitleValue] = useState<string>(templateTitle);
  const [docxNameValue, setDocxNameValue] = useState<string>(docxName); // Nom del fitxer per mostrar
  const [excelNameValue, setExcelNameValue] = useState<string>(excelName);
  const contentWrapperRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // IA mode is always active
  const iaMode = true; // Always true, no toggle needed
  
  // New prompt management state
  const [prompts, setPrompts] = useState<IAPrompt[]>([]);
  const [activePromptId, setActivePromptId] = useState<string | null>(null);
  const [hoveredPId, setHoveredPId] = useState<string | null>(null);
  
  // Counter for sequential prompt numbering
  const [nextPromptNumber, setNextPromptNumber] = useState<number>(1);

  // Efecte per inicialitzar currentTemplateId i originalDocxStoragePath
  useEffect(() => {
    if (mode === 'edit' && initialTemplateData?.id) {
      setCurrentTemplateId(initialTemplateData.id);
      setOriginalDocxStoragePath(initialTemplateData.base_docx_storage_path || null);
      setDocxNameValue(initialTemplateData.base_docx_name || ''); // Assegurar que el nom es carrega
    } else if (mode === 'new') {
      setCurrentTemplateId(uuidv4()); // Generar UUID per a noves plantilles
      setOriginalDocxStoragePath(null);
      setDocxNameValue(''); // Començar sense nom de DOCX
    }
  }, [mode, initialTemplateData]);

  // Load existing prompts when editing an existing template
  useEffect(() => {
    if (mode === 'edit' && initialTemplateData?.ai_instructions) {
      const loaded: IAPrompt[] = initialTemplateData.ai_instructions.map((instr: any) => ({
        id: instr.id,
        paragraphId: instr.paragraphId,
        content: instr.content,
        status: instr.status || 'saved',
        createdAt: new Date(),     // Placeholder date
        updatedAt: new Date(),     // Placeholder date
        position: 0,               // Will be recalculated
        isExpanded: false,
        order: instr.order
      }));
      setPrompts(loaded);
      // Ensure nextPromptNumber starts after the highest existing order
      setNextPromptNumber(
        loaded.reduce((max, p) => Math.max(max, p.order ?? 0), 0) + 1
      );
    }
  }, [mode, initialTemplateData]);
  
  // Legacy state kept for backward compatibility
  const [iaPromptsData, setIaPromptsData] = useState<Record<string, ParagraphIaData>>({});
  const [paragraphButtonVisuals, setParagraphButtonVisuals] = useState<Record<string, ParagraphButtonVisual>>({});
  const iaTextAreaRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});

  // assign unique ids to paragraphs
  useEffect(() => {
    if (!contentRef.current) return;
    const ps = contentRef.current.querySelectorAll('p');
    let updated = false;
    ps.forEach(p => {
      if (!p.dataset.paragraphId) {
        p.dataset.paragraphId = `p-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        updated = true;
      }
    });
    if (updated) {
      setConvertedHtml(contentRef.current.innerHTML);
    }
  }, [convertedHtml]);

  // Effect to detect changes in the document
  useEffect(() => {
    // This is a simple implementation - in a real app, you would compare with the saved version
    // or track changes more precisely
    setHasUnsavedChanges(true);
  }, [convertedHtml, prompts]);

  // Effect to focus the title input when editing
  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  // Effect to update prompt positions based on paragraph positions
  useEffect(() => {
    if (!contentRef.current || !contentWrapperRef.current) return;
    
    // Calculate updated positions for prompts
    const updatedPrompts = calculatePromptPositions(prompts, contentRef, contentWrapperRef);
    
    // Only update if positions have changed
    if (JSON.stringify(updatedPrompts) !== JSON.stringify(prompts)) {
      setPrompts(updatedPrompts);
    }
    
    // Update paragraph button visuals
    const newVisuals: Record<string, ParagraphButtonVisual> = {};
    const ps = contentRef.current.querySelectorAll('p[data-paragraph-id]');
    const wrapRect = contentWrapperRef.current.getBoundingClientRect();

    ps.forEach(pElement => {
      const pid = (pElement as HTMLElement).dataset.paragraphId!;
      if (!pid) return;

      const rect = pElement.getBoundingClientRect();
      const yButton = (rect.top + rect.height / 2) - wrapRect.top;
      const hasSavedPrompt = !!prompts.find(p => p.paragraphId === pid && (p.status === 'saved' || p.status === 'draft'));
      
      // Show button only if paragraph is hovered or has a prompt
      const showButton = iaMode && (hoveredPId === pid || hasSavedPrompt);
      
      newVisuals[pid] = { yButton, showButton, hasSavedPrompt };
    });
    setParagraphButtonVisuals(newVisuals);
    
  }, [iaMode, convertedHtml, prompts, contentRef, contentWrapperRef, hoveredPId]);

  // Handle mouse over paragraph to track hovered paragraph
  const handleMouseOver = (e: MouseEvent<HTMLDivElement>) => {
    if (!iaMode) return;
    const target = e.target as HTMLElement;
    const p = target.closest('p[data-paragraph-id]');
    if (p) {
      setHoveredPId((p as HTMLElement).dataset.paragraphId!);
    }
  };

  const handleMouseLeave = () => {
    setHoveredPId(null);
  };

  // Handle creating or editing a prompt for a paragraph
  const handleParagraphClick = (paragraphId: string) => {
    if (!contentRef.current) return;
    
    // Find the paragraph element
    const pElement = contentRef.current.querySelector(`p[data-paragraph-id="${paragraphId}"]`);
    if (!pElement) return;
    
    // Clear previous highlights
    contentRef.current.querySelectorAll('p.ia-selected').forEach(el => el.classList.remove('ia-selected'));
    pElement.classList.add('ia-selected');
    
    // Check if a prompt already exists for this paragraph
    const existingPromptIndex = prompts.findIndex(p => p.paragraphId === paragraphId);
    
    if (existingPromptIndex >= 0) {
      // If prompt exists, set it as active
      setActivePromptId(prompts[existingPromptIndex].id);
    } else {
      // If no prompt exists, create a new one
      const newPrompt = createPromptForParagraph(
        paragraphId, 
        pElement.textContent || '', 
        contentRef, 
        contentWrapperRef
      );
      
      // Set isEditing to true for the new prompt to open the text box immediately
      // but don't assign an order number yet - it will be assigned when saved
      const newPromptWithEditing = {
        ...newPrompt,
        isEditing: true
      };
      
      setPrompts(prev => [...prev, newPromptWithEditing]);
      setActivePromptId(newPromptWithEditing.id);
    }
    
    // Legacy code for backward compatibility
    const rect = pElement.getBoundingClientRect();
    const wrapRect = contentWrapperRef.current!.getBoundingClientRect();
    const y = rect.top - wrapRect.top;
    const height = rect.height;

    setIaPromptsData(prevData => ({
      ...prevData,
      [paragraphId]: {
        currentPrompt: prevData[paragraphId]?.savedPrompt || '', // Load saved or empty
        savedPrompt: prevData[paragraphId]?.savedPrompt || '',
        y,
        height,
        isActiveEditor: true,
      }
    }));

    setTimeout(() => {
      iaTextAreaRefs.current[paragraphId]?.focus();
    }, 0);
  };
  
  // Handle updating a prompt
  const handlePromptUpdate = (updatedPrompt: IAPrompt) => {
    // Check if this is a save operation (status changing to 'saved')
    const existingPrompt = prompts.find(p => p.id === updatedPrompt.id);
    
    // If the prompt is being saved for the first time (status changing from draft to saved)
    // and it doesn't have an order number yet, assign one
    if (
      existingPrompt && 
      existingPrompt.status !== 'saved' && 
      updatedPrompt.status === 'saved' && 
      !existingPrompt.order && 
      updatedPrompt.content.trim() !== ''
    ) {
      // Assign the next available order number
      updatedPrompt.order = nextPromptNumber;
      // Increment the counter for the next prompt
      setNextPromptNumber(prev => prev + 1);
    }
    
    // Si ja està en estat 'saved' però no té número d'ordre, assignar-n'hi un
    if (
      updatedPrompt.status === 'saved' && 
      !updatedPrompt.order &&
      updatedPrompt.content.trim() !== ''
    ) {
      updatedPrompt.order = nextPromptNumber;
      setNextPromptNumber(prev => prev + 1);
    }
    
    setPrompts(prev => 
      prev.map(p => p.id === updatedPrompt.id ? updatedPrompt : p)
    );
    
    // Legacy code for backward compatibility
    if (updatedPrompt.paragraphId) {
      setIaPromptsData(prev => {
        const currentEntry = prev[updatedPrompt.paragraphId];
        if (!currentEntry) return prev;
        return {
          ...prev,
          [updatedPrompt.paragraphId]: {
            ...currentEntry,
            savedPrompt: updatedPrompt.content,
            currentPrompt: updatedPrompt.content,
          },
        };
      });
    }
  };
  
  // Handle deleting a prompt
  const handlePromptDelete = (promptId: string) => {
    const promptToDelete = prompts.find(p => p.id === promptId);
    
    if (promptToDelete) {
      setPrompts(prev => prev.filter(p => p.id !== promptId));
      
      // If the deleted prompt was active, clear active prompt
      if (activePromptId === promptId) {
        setActivePromptId(null);
      }
      
      // Legacy code for backward compatibility
      if (promptToDelete.paragraphId) {
        setIaPromptsData(prev => {
          const newData = { ...prev };
          delete newData[promptToDelete.paragraphId];
          return newData;
        });
      }
    }
  };
  
  // Handle selecting a prompt (and scrolling to its paragraph)
  const handlePromptSelect = (paragraphId: string) => {
    // Find the prompt for this paragraph
    const prompt = prompts.find(p => p.paragraphId === paragraphId);
    
    if (prompt) {
      setActivePromptId(prompt.id);
      
      // Scroll to the paragraph
      scrollToParagraph(paragraphId, contentRef, contentWrapperRef);
    }
  };
  
  // Legacy function for backward compatibility
  const adaptWithIA = (paragraphId: string) => {
    handleParagraphClick(paragraphId);
  };
  
  // Legacy function for backward compatibility
  const handleSaveIaPrompt = (paragraphId: string) => {
    const prompt = prompts.find(p => p.paragraphId === paragraphId);
    
    if (prompt) {
      handlePromptUpdate({
        ...prompt,
        status: 'saved',
        updatedAt: new Date()
      });
    } else {
      setIaPromptsData(prev => {
        const currentEntry = prev[paragraphId];
        if (!currentEntry) return prev;
        return {
          ...prev,
          [paragraphId]: {
            ...currentEntry,
            savedPrompt: currentEntry.currentPrompt,
          },
        };
      });
    }
    // Future: API call to save prompt to backend
  };

  // Function to save the template to the backend
  const saveTemplate = async () => {
    try {
      // Extract Excel mappings from the HTML
      const linkMappings: Array<{id: string; excelHeader: string; selectedText: string}> = [];
      if (contentRef.current) {
        const linkedSpans = contentRef.current.querySelectorAll('span.linked-placeholder');
        linkedSpans.forEach(span => {
          const htmlSpan = span as HTMLSpanElement;
          const excelHeader = htmlSpan.dataset.excelHeader;
          const linkId = htmlSpan.dataset.linkId;
          // Utilitzar originalText en lloc de textContent (que és la capçalera d'Excel)
          const selectedText = htmlSpan.dataset.originalText || htmlSpan.textContent;
          
          if (excelHeader && linkId && selectedText) {
            linkMappings.push({
              id: linkId,
              excelHeader,
              selectedText
            });
          }
        });
      }
      
      // Prepare data based on the expected format for each endpoint
      if (mode === 'edit' && initialTemplateData?.id) {
        // Obtain authentication token for edit mode
        const supabase = createBrowserSupabaseClient();
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError || !sessionData?.session?.access_token) {
          console.error('Error d\'autenticació:', sessionError);
          alert('Error d\'autenticació. Torna a iniciar sessió.');
          return;
        }
        
        const accessToken = sessionData.session.access_token;
        
        // FORMAT FOR UPDATE-TEMPLATE
        const updateData: any = { // Usar 'any' temporalment o definir una interfície més completa
          config_name: templateTitleValue,
          base_docx_name: docxNameValue, // Nom del fitxer DOCX
          excel_file_name: excelNameValue,
          final_html: convertedHtml,
          excel_headers: excelHeaders,
          link_mappings: linkMappings,
          ai_instructions: prompts.map(p => ({
            id: p.id,
            paragraphId: p.paragraphId,
            prompt: p.content,
            content: p.content,
            status: p.status,
            order: p.order || 0,
            originalParagraphText: p.originalParagraphText || '' // Afegir el text original del paràgraf
          })),
          originalDocxPath: originalDocxStoragePath, // Enviar la ruta del DOCX a Storage
        };
        
        if (!initialTemplateData?.id) {
          console.error('Error: ID de plantilla inicial no trobat per actualitzar.');
          alert('Error crític: No es pot actualitzar la plantilla sense ID.');
          return;
        }
        
        const templateUrl = `/api/update-template/${initialTemplateData.id}`;
        console.log('Actualitzant plantilla amb ID:', initialTemplateData.id, 'a URL:', templateUrl);
        console.log('Dades (updateData) a enviar:', JSON.stringify(updateData, null, 2));
        console.log('Token d\'accés (primeres/últimes 10 lletres):', `${accessToken.substring(0, 10)}...${accessToken.substring(accessToken.length - 10)}`);
        
        // Primer, actualitzem només les metadades (evitem timeout)
        const updateDataWithoutPlaceholder = {
          ...updateData,
          skipPlaceholderGeneration: true // Afegim paràmetre per evitar la generació de placeholder
        };
        
        // Make API call to update the template (només metadades)
        console.log('Actualitzant metadades amb skipPlaceholderGeneration:', updateDataWithoutPlaceholder);
        
        const response = await fetch(templateUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
          },
          body: JSON.stringify(updateDataWithoutPlaceholder),
          credentials: 'include' // Include cookies
        });
        
        // Llegim el cos de la resposta UNA SOLA VEGADA per evitar errors
        const responseText = await response.text();
        let responseData;
        
        try {
          // Intentem parsejar com a JSON
          responseData = JSON.parse(responseText);
        } catch (e) {
          console.error('Error al parsejar JSON de la resposta. Text de la resposta:', responseText);
          throw new Error(`Error del servidor (no JSON): ${response.status} - ${responseText || response.statusText}`);
        }
        
        if (!response.ok) {
          console.error('Error de resposta des del servidor:', response.status, responseData);
          throw new Error(responseData?.error || responseData?.details || responseData?.message || 'Error actualitzant la plantilla des del servidor');
        }
        
        // Després, regenerem el placeholder de forma asíncrona
        if (!responseData.placeholderStatus || responseData.placeholderStatus === 'skipped') {
          console.log('Metadades actualitzades. Regenerant placeholder en segon pla...');
          
          // Mostrem un missatge a l'usuari
          const infoMessage = document.createElement('div');
          infoMessage.className = 'fixed top-4 right-4 bg-blue-100 border border-blue-400 text-blue-700 px-4 py-3 rounded z-50';
          infoMessage.innerHTML = `
            <div class="flex items-center">
              <svg class="animate-spin h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Actualitzant placeholder en segon pla...</span>
            </div>
          `;
          document.body.appendChild(infoMessage);
          
          // Fem la crida a l'API de regeneració de placeholder
          fetch(`/api/regenerate-placeholder-docx/${initialTemplateData.id}`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`
            }
          })
          .then(placeholderRes => placeholderRes.json())
          .then(placeholderData => {
            document.body.removeChild(infoMessage);
            
            const successMessage = document.createElement('div');
            successMessage.className = 'fixed top-4 right-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded z-50';
            successMessage.innerHTML = `
              <div class="flex items-center">
                <svg class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
                <span>Placeholder actualitzat correctament</span>
              </div>
            `;
            document.body.appendChild(successMessage);
            setTimeout(() => document.body.removeChild(successMessage), 3000);
            
            console.log('Placeholder regenerat correctament:', placeholderData);
          })
          .catch(error => {
            document.body.removeChild(infoMessage);
            
            const errorMessage = document.createElement('div');
            errorMessage.className = 'fixed top-4 right-4 bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded z-50';
            errorMessage.innerHTML = `
              <div class="flex items-center">
                <svg class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>Plantilla desada, però hi ha hagut un error regenerant el placeholder. La plantilla segueix sent funcional.</span>
              </div>
            `;
            document.body.appendChild(errorMessage);
            setTimeout(() => document.body.removeChild(errorMessage), 5000);
            
            console.error('Error regenerant placeholder:', error);
          });
        }
        
        // Update state
        setHasUnsavedChanges(false);
        
        // Show success message
        alert('Plantilla actualitzada correctament');
        
      } else {
        // FORMAT FOR SAVE-CONFIGURATION (new template)
        const saveData: any = { // Usar 'any' temporalment o definir una interfície més completa
          id: currentTemplateId, // Enviar l'UUID generat pel frontend
          baseDocxName: docxNameValue, // Nom del fitxer DOCX
          config_name: templateTitleValue,
          excelInfo: {
            fileName: excelNameValue,
            headers: excelHeaders
          },
          linkMappings: linkMappings,
          // Mantenir ai_instructions amb el format esperat pel backend
          ai_instructions: prompts.map(p => ({
            id: p.id,
            paragraphId: p.paragraphId,
            content: p.content,
            prompt: p.content, // Per compatibilitat si cal
            status: p.status || 'saved',
            order: p.order || 0,
            originalParagraphText: p.originalParagraphText || '' // Afegir el text original del paràgraf
          })),
          finalHtml: convertedHtml,
          originalDocxPath: originalDocxStoragePath,
        };
        
        // Eliminar aiInstructions si no s'utilitza per evitar redundància
        // delete saveData.aiInstructions;
        
        const createUrl = '/api/save-configuration';
        console.log('Creant nova plantilla a URL:', createUrl);
        console.log('Dades (saveData) a enviar:', JSON.stringify(saveData, null, 2));
        
        // Make API call to create a new template
        const response = await fetch(createUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(saveData),
          credentials: 'include' // Include cookies for server-side authentication
        });
        
        let responseData;
        try {
          responseData = await response.json();
        } catch (e) {
          const responseText = await response.text();
          console.error('Error al parsejar JSON de la resposta (creació). Text de la resposta:', responseText);
          throw new Error(`Error del servidor (no JSON creació): ${response.status} - ${responseText || response.statusText}`);
        }
        
        if (!response.ok) {
          console.error('Error de resposta des del servidor (creació):', response.status, responseData);
          throw new Error(responseData?.error || responseData?.details || responseData?.message || 'Error creant la plantilla des del servidor');
        }
        
        // Update state
        setHasUnsavedChanges(false);
        
        // Show success message
        alert('Plantilla creada correctament');
      }
    } catch (error) {
      console.error('Error desant la plantilla:', error);
      alert(`Error desant la plantilla: ${error instanceof Error ? error.message : 'Error desconegut'}`);
    }
  };

  // Excel mapping logic
  const handleTextSelection = () => {
    if (!convertedHtml || !selectedExcelHeader) return;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !contentRef.current) return;
    const range = sel.getRangeAt(0);
    if (!contentRef.current.contains(range.commonAncestorContainer)) {
      sel.removeAllRanges();
      setSelectedExcelHeader(null);
      return;
    }
    const text = sel.toString().trim();
    if (!text) {
      sel.removeAllRanges();
      return;
    }
    const span = document.createElement('span');
    span.className = 'linked-placeholder';
    span.dataset.excelHeader = selectedExcelHeader;
    const linkId = `link-${Date.now()}-${Math.random().toString(36).substr(2,5)}`;
    span.dataset.linkId = linkId;
    span.dataset.originalText = text; // IMPORTANT: Guardar el text original seleccionat
    span.textContent = selectedExcelHeader; // Visualment mostrem la capçalera
    try {
      range.deleteContents();
      range.insertNode(span);
      setConvertedHtml(contentRef.current.innerHTML);
    } catch {
      alert('Error vinculant.');
    } finally {
      sel.removeAllRanges();
      setSelectedExcelHeader(null);
    }
  };

  // Handle file selection
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    const file = files[0];
    const fileType = e.target.getAttribute('data-file-type');
    
    // Show loading message
    const loadingMessage = document.createElement('div');
    loadingMessage.className = 'fixed top-4 right-4 bg-blue-100 border border-blue-400 text-blue-700 px-4 py-3 rounded z-50';
    loadingMessage.innerHTML = `
      <div class="flex items-center">
        <svg class="animate-spin h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span>Processant arxiu...</span>
      </div>
    `;
    document.body.appendChild(loadingMessage);
    
    try {
      if (fileType === 'docx') {
        if (!currentTemplateId) {
          document.body.removeChild(loadingMessage);
          alert("Error: Falta l'ID de la plantilla per pujar el fitxer DOCX.");
          if (fileInputRef.current) fileInputRef.current.value = '';
          return;
        }

        setDocxNameValue(file.name); // Actualitzar el nom del fitxer a la UI
        setHasUnsavedChanges(true);

        // 1. Pujar el fitxer DOCX original
        const formDataUpload = new FormData();
        formDataUpload.append('file', file);
        formDataUpload.append('templateId', currentTemplateId);

        // Obtenir token d’autenticació per la crida al servidor
        const supabaseClient = createBrowserSupabaseClient();
        await supabaseClient.auth.refreshSession();
        const { data: { session } } = await supabaseClient.auth.getSession();
        const accessTokenUpload = session?.access_token;

        const uploadResponse = await fetch('/api/upload-original-docx', {
            method: 'POST',
            headers: {
              ...(accessTokenUpload ? { Authorization: `Bearer ${accessTokenUpload}` } : {}),
            },
            credentials: 'include',
            body: formDataUpload,
        });

        if (!uploadResponse.ok) {
          document.body.removeChild(loadingMessage);
          const errorData = await uploadResponse.json().catch(() => ({}));
          alert(`Error pujant el DOCX original: ${errorData.error || uploadResponse.statusText}`);
          if (fileInputRef.current) fileInputRef.current.value = '';
          return;
        }

        const uploadData = await uploadResponse.json();
        if (!uploadData.success || !uploadData.originalDocxPath) {
          document.body.removeChild(loadingMessage);
          alert(`Error confirmant la pujada del DOCX: ${uploadData.error || 'Ruta no rebuda.'}`);
          if (fileInputRef.current) fileInputRef.current.value = '';
          return;
        }
        
        setOriginalDocxStoragePath(uploadData.originalDocxPath);
        console.log("DOCX original pujat, ruta:", uploadData.originalDocxPath);
// Desa la ruta original a la BD per generar el placeholder després
        await fetch(`/api/update-template/${currentTemplateId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...(accessTokenUpload ? { Authorization: `Bearer ${accessTokenUpload}` } : {})
          },
          credentials: 'include',
          body: JSON.stringify({ originalDocxPath: uploadData.originalDocxPath })
        });

        // 2. Processar el document (ara llegint des de Storage via API)
        const processResponse = await fetch('/api/process-document', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ storagePath: uploadData.originalDocxPath }),
        });

        if (!processResponse.ok) {
          document.body.removeChild(loadingMessage);
          const errorData = await processResponse.json().catch(() => ({}));
          alert(`Error processant el DOCX des de Storage: ${errorData.error || processResponse.statusText}`);
          if (fileInputRef.current) fileInputRef.current.value = '';
          return;
        }

        const processData = await processResponse.json();
        setConvertedHtml(processData.html);
        
        // Show success message (ja no es treu loadingMessage aquí, es fa al final del try/catch/finally)
        const successMessage = `Arxiu DOCX processat: ${file.name}`;
        const messageElement = document.createElement('div');
        messageElement.className = 'fixed top-4 right-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded z-50';
        messageElement.innerHTML = `
          <div class="flex items-center">
            <svg class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
            <span>${successMessage}</span>
          </div>
        `;
        document.body.appendChild(messageElement);
        setTimeout(() => document.body.removeChild(messageElement), 3000);
        
      } else if (fileType === 'excel') {
        // Process Excel file using XLSX library
        setExcelNameValue(file.name);
        setHasUnsavedChanges(true);
        
        // Read the Excel file
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const data = new Uint8Array(e.target?.result as ArrayBuffer);
            const workbook = XLSX.read(data, { type: 'array' });
            
            // Get the first sheet
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            
            // Convert to JSON
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
            
            // Extract headers from the first row
            const headers = jsonData[0] as string[];
            
            // Update the Excel headers state
            // This is the real implementation that extracts headers from the Excel file
            if (headers && headers.length > 0) {
              // Update the excelHeaders state with the extracted headers
              const updatedExcelHeaders = [...headers];
              // Actually update the state with the extracted headers
              setExcelHeaders(updatedExcelHeaders);
              
              // Show success message
              document.body.removeChild(loadingMessage);
              const successMessage = `Arxiu Excel processat: ${file.name}`;
              const messageElement = document.createElement('div');
              messageElement.className = 'fixed top-4 right-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded z-50';
              messageElement.innerHTML = `
                <div class="flex items-center">
                  <svg class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                  </svg>
                  <span>${successMessage}</span>
                </div>
              `;
              document.body.appendChild(messageElement);
              setTimeout(() => document.body.removeChild(messageElement), 3000);
            } else {
              throw new Error('No s\'han trobat capçaleres a l\'arxiu Excel');
            }
          } catch (error) {
            document.body.removeChild(loadingMessage);
            const errorMessage = `Error processant Excel: ${error instanceof Error ? error.message : 'Error desconegut'}`;
            const messageElement = document.createElement('div');
            messageElement.className = 'fixed top-4 right-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded z-50';
            messageElement.innerHTML = `
              <div class="flex items-center">
                <svg class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
                <span>${errorMessage}</span>
              </div>
            `;
            document.body.appendChild(messageElement);
            setTimeout(() => document.body.removeChild(messageElement), 5000);
          }
        };
        
        reader.onerror = () => {
          document.body.removeChild(loadingMessage);
          const errorMessage = 'Error llegint l\'arxiu Excel';
          const messageElement = document.createElement('div');
          messageElement.className = 'fixed top-4 right-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded z-50';
          messageElement.innerHTML = `
            <div class="flex items-center">
              <svg class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
              <span>${errorMessage}</span>
            </div>
          `;
          document.body.appendChild(messageElement);
          setTimeout(() => document.body.removeChild(messageElement), 5000);
        };
        
        // Read the file as an array buffer
        reader.readAsArrayBuffer(file);
      }
    } catch (error) {
      // Handle errors
      document.body.removeChild(loadingMessage);
      const errorMessage = `Error processant l'arxiu: ${error instanceof Error ? error.message : 'Error desconegut'}`;
      const messageElement = document.createElement('div');
      messageElement.className = 'fixed top-4 right-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded z-50';
      messageElement.innerHTML = `
        <div class="flex items-center">
          <svg class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
          <span>${errorMessage}</span>
        </div>
      `;
      document.body.appendChild(messageElement);
      setTimeout(() => document.body.removeChild(messageElement), 5000);
    } finally {
      // Reset the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <main className="flex min-h-screen w-full flex-col items-center bg-gray-50 pt-4">
      {/* Hidden file input for file selection */}
      <input 
        type="file" 
        ref={fileInputRef}
        className="hidden"
        onChange={handleFileChange}
      />
      {/* Document title - removed as it will be part of the new header */}
      
      {/* Main container with flex to ensure perfect centering */}
      <div className="w-full flex justify-center">
        {/* Grid layout for the content - with equal width sidebars */}
        <div className="grid grid-cols-[280px_1fr_280px]">
          {/* New document header with document properties */}
          <div className="col-span-3 bg-white border-t border-x border-gray-200 rounded-t shadow-sm">
            {/* Main header with title and action buttons */}
            <div className="px-4 py-3 flex items-center border-b border-gray-200">
              {isEditingTitle ? (
                <div className="flex items-center">
                  <input
                    ref={titleInputRef}
                    type="text"
                    value={templateTitleValue}
                    onChange={(e) => setTemplateTitleValue(e.target.value)}
                    className="text-lg font-semibold text-gray-800 border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    onBlur={() => {
                      setIsEditingTitle(false);
                      setHasUnsavedChanges(true);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        setIsEditingTitle(false);
                        setHasUnsavedChanges(true);
                      }
                    }}
                  />
                </div>
              ) : (
                <h1 
                  className="text-lg font-semibold text-gray-800 flex items-center cursor-pointer group"
                  onClick={() => setIsEditingTitle(true)}
                >
                  {templateTitleValue}
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    className="h-4 w-4 ml-2 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" 
                    fill="none" 
                    viewBox="0 0 24 24" 
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </h1>
              )}
              <div className="ml-auto flex items-center space-x-2">
                <button 
                  className={`px-3 py-1 rounded text-sm flex items-center ${
                    hasUnsavedChanges 
                      ? 'bg-indigo-600 text-white hover:bg-indigo-700' 
                      : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                  }`}
                  disabled={!hasUnsavedChanges}
                  onClick={saveTemplate}
                  title="Desar plantilla"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                  </svg>
                  Desar
                </button>
                <button 
                  className="px-3 py-1 rounded text-sm bg-green-600 text-white hover:bg-green-700 flex items-center"
                  onClick={() => {
                    // Create a duplicate template
                    const duplicateTitle = `Còpia de ${templateTitleValue}`;
                    
                    // In a real app, this would be an API call to create a duplicate in the backend
                    // and then redirect to the new template's edit page
                    
                    // Simulate creating a duplicate by updating the current template
                    setTemplateTitleValue(duplicateTitle);
                    
                    // Reset the prompts for the new template
                    setPrompts([]);
                    setNextPromptNumber(1);
                    setActivePromptId(null);
                    setIaPromptsData({});
                    setParagraphButtonVisuals({});
                    
                    // Mark as having unsaved changes
                    setHasUnsavedChanges(true);
                    
                    // Show a success message
                    const successMessage = `S'ha creat una còpia: "${duplicateTitle}"`;
                    const messageElement = document.createElement('div');
                    messageElement.className = 'fixed top-4 right-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded z-50';
                    messageElement.innerHTML = `
                      <div class="flex items-center">
                        <svg class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                        </svg>
                        <span>${successMessage}</span>
                      </div>
                    `;
                    document.body.appendChild(messageElement);
                    
                    // Remove the message after 3 seconds
                    setTimeout(() => {
                      document.body.removeChild(messageElement);
                    }, 3000);
                  }}
                  title="Duplicar plantilla"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Duplicar
                </button>
              </div>
            </div>
            
            {/* Document properties section */}
            <div className="px-4 py-2 flex flex-wrap items-center text-xs text-gray-600 gap-x-6">
              {/* Related files - now editable */}
              <div className="flex items-center gap-3">
                {/* DOCX file */}
                <div className="flex items-center">
                  <svg className="w-3 h-3 mr-1 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9 2a2 2 0 00-2 2v8a2 2 0 002 2h6a2 2 0 002-2V6.414A2 2 0 0016.414 5L14 2.586A2 2 0 0012.586 2H9z"></path>
                  </svg>
                  
                    <div className="flex items-center">
                      <span className="text-xs mr-1">
                        {docxNameValue || "Cap DOCX seleccionat"}
                      </span>
                      <button
                        className="p-0.5 text-gray-500 hover:text-indigo-600"
                        onClick={() => {
                          if (fileInputRef.current) {
                            fileInputRef.current.setAttribute('accept', '.docx');
                            fileInputRef.current.dataset.fileType = 'docx'; // Use dataset for custom attributes
                            fileInputRef.current.click();
                          }
                        }}
                        title="Pujar nou DOCX"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                        </svg>
                      </button>
                    </div>
                </div>
                
                {/* Excel file */}
                <div className="flex items-center">
                  <svg className="w-3 h-3 mr-1 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9 2a2 2 0 00-2 2v8a2 2 0 002 2h6a2 2 0 002-2V6.414A2 2 0 0016.414 5L14 2.586A2 2 0 0012.586 2H9z"></path>
                  </svg>
                  
                    <div className="flex items-center">
                      <span className="text-xs mr-1">
                        {excelNameValue || "Cap Excel seleccionat"}
                      </span>
                      <button
                        className="p-0.5 text-gray-500 hover:text-indigo-600"
                        onClick={() => {
                          if (fileInputRef.current) {
                            fileInputRef.current.setAttribute('accept', '.xlsx,.xls');
                            fileInputRef.current.dataset.fileType = 'excel'; // Use dataset for custom attributes
                            fileInputRef.current.click();
                          }
                        }}
                        title="Pujar nou Excel"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                        </svg>
                      </button>
                    </div>
                </div>
              </div>
              
              {/* Document info - with historical dates */}
              <div className="flex items-center gap-3">
                <div className="flex items-center">
                  <span className="text-gray-500 mr-1">Creat:</span>
                  <span>{createdDate.toLocaleDateString()}</span>
                </div>
                <div className="flex items-center">
                  <span className="text-gray-500 mr-1">Modificat:</span>
                  <span>{modifiedDate.toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Main document area with 3 columns - equal width sidebars */}
          <div className="col-span-3 grid grid-cols-[280px_1fr_280px] bg-gray-100 border-x border-b border-gray-200 shadow-md">
          {/* Left sidebar - Prompt sidebar - always visible */}
          <PromptSidebar
            prompts={prompts}
            documentRef={contentRef}
            contentWrapperRef={contentWrapperRef}
            onPromptUpdate={handlePromptUpdate}
            onPromptDelete={handlePromptDelete}
            onPromptSelect={handlePromptSelect}
            activePromptId={activePromptId}
          />
        
          {/* Content area - A4 paper style that auto-expands based on content */}
          <div className="flex justify-center py-6 bg-gray-100 min-h-[calc(100vh-140px)]">
            <div
              ref={contentWrapperRef}
              className="relative w-[21cm] bg-white mx-auto border border-gray-300 shadow-lg"
              style={{ minHeight: '29.7cm' }}
              onMouseMove={handleMouseOver}
              onMouseLeave={handleMouseLeave}
            >
              <div className="p-[2.54cm]">
                {convertedHtml ? (
                  <div
                    ref={contentRef}
                    className="prose max-w-none"
                    dangerouslySetInnerHTML={{ __html: convertedHtml }}
                    onMouseUp={handleTextSelection}
                  />
                ) : (
                  <p className="text-gray-400 italic text-center py-10">Carrega un DOCX per començar.</p>
                )}
              </div>
              
              {/* Word-like status bar at bottom of document */}
              <div className="absolute bottom-0 left-0 right-0 h-6 bg-[#f3f2f1] border-t border-gray-200 flex items-center justify-between px-3 text-xs text-gray-500">
                <div className="flex items-center space-x-4">
                  <span>Pàgina 1 de 1</span>
                  <span>Paraules: {convertedHtml ? convertedHtml.split(/\s+/).length : 0}</span>
                </div>
                <div className="flex items-center space-x-3">
                  <span>Català</span>
                  <span>100%</span>
                </div>
              </div>
              
              {/* Circular IA buttons for each paragraph - only shown on hover or if has prompt */}
              {iaMode && Object.entries(paragraphButtonVisuals).map(([pid, visual]) => {
                if (!visual.showButton) return null;
                
                // Check if this paragraph has an associated prompt
                const promptForParagraph = prompts.find(p => p.paragraphId === pid);
                const hasPrompt = !!promptForParagraph;
                const isActive = promptForParagraph?.id === activePromptId;
                
                // Get the prompt number for display - only show if prompt has an order number
                // (which means it has been saved with content)
                const promptNumber = promptForParagraph?.order || '';
                
                return (
                  <button
                    key={`btn-${pid}`}
                    className={`absolute left-6 w-6 h-6 text-white rounded-full focus:outline-none flex items-center justify-center text-xs p-0 transition-colors
                              ${isActive 
                                ? 'bg-indigo-600 ring-2 ring-indigo-300' 
                                : hasPrompt 
                                  ? 'bg-green-600 hover:bg-green-500' 
                                  : 'bg-indigo-600 hover:bg-indigo-500'}`}
                    style={{ 
                      top: visual.yButton,
                      transform: 'translateY(-50%)',
                      opacity: hoveredPId === pid || hasPrompt || isActive ? 1 : 0.8,
                      transition: 'opacity 0.2s ease'
                    }}
                    onClick={() => handleParagraphClick(pid)}
                    aria-label={`IA per paràgraf ${pid.substring(0,5)}`}
                  >
                    {/* Only show number if prompt has been saved with content */}
                    {hasPrompt && promptForParagraph?.status === 'saved' && promptNumber ? promptNumber : ''}
                  </button>
                );
              })}
              
              {/* Dotted line connectors between prompts and paragraphs */}
              {iaMode && prompts.map(prompt => {
                const paragraph = findParagraphElement(prompt.paragraphId, contentRef);
                if (!paragraph || !contentWrapperRef.current) return null;
                
                const paragraphRect = paragraph.getBoundingClientRect();
                const wrapperRect = contentWrapperRef.current.getBoundingClientRect();
                const y = paragraphRect.top + (paragraphRect.height / 2) - wrapperRect.top;
                
                return (
                  <div
                    key={`connector-${prompt.id}`}
                    className="absolute left-0 h-0.5 border-t border-dashed border-gray-400"
                    style={{
                      top: y,
                      width: '20px',
                      transform: 'translateY(-50%)'
                    }}
                  />
                );
              })}
            </div>
          </div>
        
          {/* Sidebar - Excel headers and help panel - width updated to match left sidebar */}
          <aside className="w-[280px] flex-shrink-0 border-l border-gray-200 bg-[#f3f2f1]">
            <div className="sticky top-4 p-4">
              
              {/* Excel headers panel */}
              {excelHeaders.length > 0 && (
                <div className="bg-white rounded shadow border mb-4">
                  <div className="border-b border-gray-200 px-3 py-2 bg-[#f9f9f9]">
                    <h3 className="text-sm font-semibold text-gray-700">Capçaleres d'Excel</h3>
                  </div>
                  <div className="p-3">
                    <div className="text-xs text-gray-500 mb-2">Selecciona per vincular al text:</div>
                    <div className="flex flex-wrap gap-2">
                      {excelHeaders.map(header => (
                        <button
                          key={header}
                          className={`px-2 py-1 rounded text-xs border ${
                            selectedExcelHeader === header ? 'bg-[#2b579a] text-white' : 'bg-white text-[#2b579a] border-[#2b579a]'
                          }`}
                          onClick={() => setSelectedExcelHeader(header)}
                        >
                          {header}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              
              {/* Word-like help panel */}
              <div className="bg-white rounded shadow border">
                <div className="border-b border-gray-200 px-3 py-2 bg-[#f9f9f9]">
                  <h3 className="text-sm font-semibold text-gray-700">Ajuda ràpida</h3>
                </div>
                <div className="p-3">
                  <div className="text-xs text-gray-700 space-y-2">
                    <p>Per inserir un marcador d'Excel al text, selecciona una capçalera i després selecciona el text que vols vincular.</p>
                    <p>Passa el ratolí sobre un paràgraf per veure el botó d'IA i fes-hi clic per afegir o editar un prompt.</p>
                    <p>Els prompts es mostren a la barra lateral esquerra, ordenats segons la posició al document.</p>
                  </div>
                </div>
              </div>
            </div>
          </aside>
          </div>
        </div>
      </div>
      
      {/* Add CSS for highlight effect */}
      <style jsx global>{`
        .highlight-paragraph {
          background-color: rgba(79, 70, 229, 0.1);
          transition: background-color 0.3s ease;
        }
        
        .ia-selected {
          background-color: rgba(79, 70, 229, 0.1);
        }
      `}</style>
    </main>
  );
};

export default TemplateEditor;

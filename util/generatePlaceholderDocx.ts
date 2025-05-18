import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';

/**
 * Genera un nou DOCX substituint el contingut dels paràgrafs amb placeholders.
 */
export async function generatePlaceholderDocx(
  originalBuffer: Buffer,
  linkMappings: any[],
  aiInstructions: { paragraphId?: string, id?: string }[]
): Promise<Buffer> {
  // Validació inicial
  if (!originalBuffer || originalBuffer.length === 0) {
    throw new Error('Buffer DOCX original buit o invàlid');
  }

  console.log("[generatePlaceholderDocx] Iniciant generació amb:", {
    bufferLength: originalBuffer.length,
    linkMappingsCount: linkMappings?.length || 0,
    aiInstructionsCount: aiInstructions?.length || 0
  });

  try {
    const zip = new PizZip(originalBuffer);
    const doc = new Docxtemplater(zip, { 
      paragraphLoop: true, 
      linebreaks: true,
      // Opció per evitar errors si un tag no existeix
      nullGetter: function() {
        return "";
      }
    });

    // Preparar dades per a docxtemplater
    const data: Record<string, string> = {};
    
    // Procés específic pels link_mappings - utilitza el format correcte
    if (Array.isArray(linkMappings)) {
      console.log("[generatePlaceholderDocx] Processant linkMappings:", 
        linkMappings.length > 0 ? linkMappings.slice(0, 2) : 'Cap mapping'); // Mostrar fins a 2 elements
      
      linkMappings.forEach((mapping, index) => {
        // Format de TemplateEditor.tsx usa id, excelHeader i selectedText 
        if (mapping.id) {
          // Usem l'id com a clau per a Docxtemplater
          const tagName = `link_${mapping.id}`;
          data[tagName] = `{{${tagName}}}`;
          console.log(`[generatePlaceholderDocx] Mapping ${index}: Assignat ${tagName} per a ${mapping.excelHeader || 'sense header'}`);
        }
        
        // Mantenim suport per al format antic, si existeix
        if (mapping.paragraphId) {
          data[mapping.paragraphId] = `{{${mapping.paragraphId}}}`;
          console.log(`[generatePlaceholderDocx] Mapping ${index}: Format antic amb paragraphId ${mapping.paragraphId}`);
        }
      });
    }
    
    // Procés pels ai_instructions (millora del format per ser més robust)
    if (Array.isArray(aiInstructions)) {
      console.log("[generatePlaceholderDocx] Processant aiInstructions:", 
          aiInstructions.length > 0 ? aiInstructions.map(i => i.paragraphId || i.id).slice(0, 3) : 'Cap instruction'); 
          
      aiInstructions.forEach((instr, index) => {
        // Format primari: paragraphId
        if (instr.paragraphId) {
          data[instr.paragraphId] = `{{${instr.paragraphId}}}`;
          console.log(`[generatePlaceholderDocx] Instruction ${index}: Assignat ${instr.paragraphId}`);
        } 
        // Format alternatiu si no hi ha paragraphId però hi ha id
        else if (instr.id) {
          const tagName = `instr_${instr.id}`;
          data[tagName] = `{{${tagName}}}`;
          console.log(`[generatePlaceholderDocx] Instruction ${index}: Alternativa amb ${tagName}`);
        }
      });
    }
    
    // Si no hi ha substitucions, retorna un warning però genera el document igual
    if (Object.keys(data).length === 0) {
      console.warn("[generatePlaceholderDocx] No s'han trobat mappings o instructions vàlids per substituir");
    } else {
      console.log(`[generatePlaceholderDocx] S'utilitzaran ${Object.keys(data).length} substitucions`);
    }

    // Renderitzar el document amb les dades
    console.log("[generatePlaceholderDocx] Renderitzant document");
    doc.render(data);
    
    // Generar el buffer de sortida
    const out = doc.getZip().generate({ type: 'nodebuffer' });
    console.log("[generatePlaceholderDocx] Document generat correctament, mida:", out.length);
    
    return out as Buffer;
  } catch (error) {
    console.error("[generatePlaceholderDocx] Error processant document:", error);
    throw new Error(`Error en generatePlaceholderDocx: ${error instanceof Error ? error.message : String(error)}`);
  }
}

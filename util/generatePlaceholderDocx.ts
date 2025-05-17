import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';

/**
 * Genera un nou DOCX substituint el contingut dels paràgrafs amb placeholders.
 */
export async function generatePlaceholderDocx(
  originalBuffer: Buffer,
  linkMappings: any[],
  aiInstructions: { paragraphId?: string }[]
): Promise<Buffer> {
  const zip = new PizZip(originalBuffer);
  const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });

  // Preparar dades per a docxtemplater
  const data: Record<string, string> = {};
  linkMappings.forEach(mapping => {
    if (mapping.paragraphId) {
      data[mapping.paragraphId] = `{{${mapping.paragraphId}}}`;
    }
  });
  aiInstructions.forEach(instr => {
    if (instr.paragraphId) {
      data[instr.paragraphId] = `{{${instr.paragraphId}}}`;
    }
  });

  doc.render(data);
  const out = doc.getZip().generate({ type: 'nodebuffer' });
  return out as Buffer;
}
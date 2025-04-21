import React, { useState, useEffect, useRef, ChangeEvent, useMemo } from 'react';
import * as XLSX from 'xlsx';
import Link from 'next/link';
import { createBrowserSupabaseClient } from '../lib/supabase/browserClient';

export interface ExcelLink { id: string; excelHeader: string; selectedText: string; }
export interface AiInstruction { id: string; prompt: string; originalText: string; }
export interface TemplateData {
  id?: string;
  config_name: string;
  base_docx_name: string | null;
  excel_file_name: string | null;
  excel_headers: string[] | null;
  link_mappings: ExcelLink[];
  ai_instructions: AiInstruction[];
  final_html: string;
}

interface TemplateEditorProps {
  initialTemplateData: TemplateData | null;
  mode: 'new' | 'edit';
}

const TemplateEditor: React.FC<TemplateEditorProps> = ({ initialTemplateData, mode }) => {
  // [tots els estats i handlers ja declarats, com a l'última versió]

  // ... [tota la lògica de desat, modals, etc.]

  return (
    <main className="flex min-h-screen w-full flex-col items-center p-4 sm:p-8 bg-gray-100">
      <div className="w-full max-w-3xl bg-white rounded shadow-lg p-8 flex flex-col gap-8">
        {/* Pas 1: Nom de la plantilla */}
        <div>
          <label htmlFor="templateName" className="block text-sm font-medium text-gray-700 mb-1">Nom de la plantilla</label>
          <input
            id="templateName"
            type="text"
            value={templateName}
            onChange={e => setTemplateName(e.target.value)}
            className="w-full px-3 py-2 border rounded text-sm font-semibold text-gray-800"
            placeholder="Nom únic de la plantilla"
            required
          />
        </div>
        {/* Pas 2: Pujar DOCX */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Word (DOCX)</label>
          <div className="flex items-center gap-4">
            <input
              type="file"
              id="docxInput"
              onChange={handleDocxFileChange}
              accept=".docx"
              className="block"
              disabled={isLoadingDocx}
            />
            {selectedFileName && <span className="text-xs text-gray-500">({selectedFileName})</span>}
            {isLoadingDocx && <span className="text-blue-600 animate-pulse ml-2">Processant...</span>}
          </div>
          {docxError && <p className="text-xs text-red-600 mt-2">{docxError}</p>}
        </div>
        {/* Pas 3: Pujar Excel */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Excel</label>
          <div className="flex items-center gap-4">
            <input
              type="file"
              id="excelInput"
              onChange={handleExcelFileChange}
              accept=".xlsx, .xls"
              className="block"
              disabled={isParsingExcel || !selectedFileName}
            />
            {selectedExcelFileName && <span className="text-xs text-gray-500">({selectedExcelFileName})</span>}
            {isParsingExcel && <span className="text-green-600 animate-pulse ml-2">Processant...</span>}
          </div>
          {excelError && <p className="text-xs text-red-600 mt-2">{excelError}</p>}
        </div>
        {/* Mapping Excel i IA */}
        {excelHeaders.length > 0 && (
          <div className="mt-6">
            <h3 className="text-md font-semibold text-gray-700 mb-2">Capçaleres d'Excel</h3>
            <div className="flex flex-wrap gap-2 mb-4">
              {excelHeaders.map((header) => (
                <button
                  key={header}
                  className={`px-3 py-1 rounded border ${
                    selectedExcelHeader === header
                      ? 'bg-blue-600 text-white border-blue-700'
                      : 'bg-gray-100 text-blue-700 border-blue-300 hover:bg-blue-200'
                  }`}
                  onClick={() => setSelectedExcelHeader(header)}
                >
                  {header}
                </button>
              ))}
            </div>
            {selectedExcelHeader && (
              <div className="text-xs text-blue-700 mb-2">
                Selecciona text al document per vincular amb: <b>{selectedExcelHeader}</b>
              </div>
            )}
          </div>
        )}
        {/* Panell d'instruccions IA */}
        {convertedHtml && (
          <div className="mt-8">
            <h3 className="text-md font-semibold text-indigo-700 mb-2">Instruccions IA</h3>
            <div className="flex flex-col gap-2">
              <textarea
                className="w-full border rounded p-2 text-sm"
                rows={3}
                placeholder="Escriu una instrucció per la IA (ex: Resumeix aquest paràgraf...)"
                value={aiUserPrompt}
                onChange={e => setAiUserPrompt(e.target.value)}
              />
              <button
                className="self-end px-4 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 text-sm"
                // onClick={handleSaveAiInstruction}
              >
                Desa instrucció IA
              </button>
            </div>
            {/* Llista d'instruccions IA */}
            {aiInstructions.length > 0 && (
              <ul className="mt-4 space-y-2">
                {aiInstructions.map((instr, idx) => (
                  <li key={instr.id} className="p-2 border rounded bg-indigo-50 text-gray-700">
                    <span className="font-medium text-indigo-800">Inst. {idx + 1}:</span> {instr.prompt}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        {/* Panell DOCX processat */}
        {convertedHtml && (
          <div className="mt-6">
            <h3 className="text-md font-semibold text-gray-700 mb-2">Previsualització DOCX</h3>
            <div ref={contentRef} className="prose max-w-5xl mx-auto bg-gray-50 p-4 rounded" dangerouslySetInnerHTML={{ __html: convertedHtml }} />
          </div>
        )}
        {/* Botó Desa */}
        <div className="flex justify-end">
          <button
            // handler de desat aquí
            disabled={
              saveStatus === 'saving' ||
              !templateName.trim() ||
              !selectedFileName ||
              !selectedExcelFileName
            }
            className={`px-6 py-2 rounded font-semibold text-white transition ${
              saveStatus === 'saving'
                ? 'bg-gray-300 cursor-not-allowed'
                : 'bg-purple-600 hover:bg-purple-700'
            }`}
          >
            {saveStatus === 'saving' ? 'Desant...' : 'Desa'}
          </button>
        </div>
      </div>
    </main>
  );
};

export default TemplateEditor;
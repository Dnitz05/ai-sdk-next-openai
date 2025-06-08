'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createBrowserSupabaseClient } from '@/lib/supabase/browserClient';
import { Template } from '@/app/types';
import * as XLSX from 'xlsx';

const NoouProjectePage: React.FC = () => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [projectName, setProjectName] = useState<string>('');
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [excelData, setExcelData] = useState<any[]>([]);
  const [excelHeaders, setExcelHeaders] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<number>(1); // 1: Plantilla, 2: Fitxer Excel, 3: Revisió
  
  const router = useRouter();
  const supabase = createBrowserSupabaseClient();

  useEffect(() => {
    checkUserAndLoadTemplates();
  }, []);

  const checkUserAndLoadTemplates = async () => {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      router.push('/');
      return;
    }
    
    await loadTemplates();
  };

  const loadTemplates = async () => {
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        router.push('/');
        return;
      }

      const response = await fetch('/api/get-templates', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Error carregant plantilles');
      }

      const data = await response.json();
      setTemplates(data.templates || []);
    } catch (err) {
      console.error('Error carregant plantilles:', err);
      setError('Error carregant plantilles. Assegura\'t que tinguis plantilles creades.');
    }
  };

  const handleExcelUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setExcelFile(file);
    setError(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const worksheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[worksheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        if (jsonData.length === 0) {
          setError('El fitxer Excel està buit.');
          return;
        }

        // Primera fila com a headers
        const headers = jsonData[0] as string[];
        const rows = jsonData.slice(1).filter(row => 
          Array.isArray(row) && row.some(cell => cell !== null && cell !== undefined && cell !== '')
        );

        if (rows.length === 0) {
          setError('No hi ha dades al fitxer Excel.');
          return;
        }

        // Convertir files a objectes amb claus dels headers
        const processedData = rows.map((row: any) => {
          const rowObj: any = {};
          headers.forEach((header, index) => {
            rowObj[header] = row[index] || '';
          });
          return rowObj;
        });

        setExcelHeaders(headers);
        setExcelData(processedData);
        console.log(`Excel processat: ${headers.length} columnes, ${processedData.length} files`);
        
      } catch (err) {
        console.error('Error processant Excel:', err);
        setError('Error processant el fitxer Excel. Assegura\'t que sigui un fitxer vàlid.');
      }
    };

    reader.readAsArrayBuffer(file);
  };

  const handleCreateProject = async () => {
    if (!selectedTemplate || !projectName || !excelFile || excelData.length === 0) {
      setError('Tots els camps són obligatoris.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        router.push('/');
        return;
      }

      const response = await fetch('/api/reports/projects', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          template_id: selectedTemplate,
          project_name: projectName,
          excel_filename: excelFile.name,
          excel_data: excelData,
          total_rows: excelData.length
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error creant projecte');
      }

      const data = await response.json();
      console.log('Projecte creat:', data);
      
      // Redirigir al projecte creat
      router.push(`/informes/${data.project.id}`);
      
    } catch (err) {
      console.error('Error creant projecte:', err);
      setError(err instanceof Error ? err.message : 'Error desconegut');
    } finally {
      setLoading(false);
    }
  };

  const selectedTemplateData = templates.find(t => t.id === selectedTemplate);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4">
            <Link
              href="/informes"
              className="text-blue-600 hover:text-blue-700 flex items-center"
            >
              <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Tornar
            </Link>
            <h1 className="text-3xl font-bold text-gray-900">Nou Projecte d'Informes</h1>
          </div>
          <p className="mt-2 text-gray-600">
            Crea un nou projecte per generar informes automàticament amb IA
          </p>
        </div>

        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-center space-x-8">
            {[1, 2, 3].map((stepNumber) => (
              <div key={stepNumber} className="flex items-center">
                <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
                  step >= stepNumber ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
                }`}>
                  {stepNumber}
                </div>
                <div className={`ml-2 text-sm ${
                  step >= stepNumber ? 'text-blue-600 font-medium' : 'text-gray-500'
                }`}>
                  {stepNumber === 1 && 'Plantilla'}
                  {stepNumber === 2 && 'Fitxer Excel'}
                  {stepNumber === 3 && 'Revisió'}
                </div>
                {stepNumber < 3 && (
                  <div className={`w-12 h-0.5 ml-4 ${
                    step > stepNumber ? 'bg-blue-600' : 'bg-gray-200'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-red-800">{error}</p>
            </div>
          </div>
        )}

        <div className="bg-white rounded-lg shadow p-6">
          {/* Step 1: Seleccionar Plantilla */}
          {step === 1 && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Selecciona una Plantilla</h2>
              <div className="mb-6">
                <label htmlFor="project-name" className="block text-sm font-medium text-gray-700 mb-2">
                  Nom del projecte
                </label>
                <input
                  type="text"
                  id="project-name"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ex: Informes mensuals gener 2024"
                />
              </div>

              {templates.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500 mb-4">No tens plantilles disponibles.</p>
                  <Link
                    href="/plantilles"
                    className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
                  >
                    Crear Plantilla
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {templates.map((template) => (
                    <div
                      key={template.id}
                      className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                        selectedTemplate === template.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => setSelectedTemplate(template.id)}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-medium text-gray-900">{template.config_name}</h3>
                          <p className="text-sm text-gray-600 mt-1">
                            Document: {template.base_docx_name || 'No especificat'}
                          </p>
                          <p className="text-sm text-gray-500 mt-1">
                            Instruccions IA: {template.ai_instructions?.length || 0} configurades
                          </p>
                        </div>
                        <div className={`w-4 h-4 rounded-full border-2 ${
                          selectedTemplate === template.id
                            ? 'border-blue-500 bg-blue-500'
                            : 'border-gray-300'
                        }`}>
                          {selectedTemplate === template.id && (
                            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setStep(2)}
                  disabled={!selectedTemplate || !projectName}
                  className="bg-blue-600 text-white px-6 py-2 rounded-md font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  Següent
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Pujar Excel */}
          {step === 2 && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Puja el Fitxer Excel</h2>
              <p className="text-gray-600 mb-6">
                El fitxer Excel ha de tenir una fila d'encapçalaments i les dades de cada informe a generar.
              </p>

              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleExcelUpload}
                  className="hidden"
                  id="excel-upload"
                />
                <label htmlFor="excel-upload" className="cursor-pointer">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <p className="mt-2 text-sm text-gray-600">
                    Clica per seleccionar un fitxer Excel o arrossega'l aquí
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Formats admesos: .xlsx, .xls
                  </p>
                </label>
              </div>

              {excelFile && (
                <div className="mt-6 bg-gray-50 rounded-lg p-4">
                  <h3 className="font-medium text-gray-900 mb-2">Fitxer seleccionat:</h3>
                  <p className="text-sm text-gray-700">{excelFile.name}</p>
                  <p className="text-sm text-gray-500 mt-1">
                    {excelData.length} files de dades, {excelHeaders.length} columnes
                  </p>
                  
                  {excelHeaders.length > 0 && (
                    <div className="mt-4">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Columnes detectades:</h4>
                      <div className="flex flex-wrap gap-2">
                        {excelHeaders.map((header, index) => (
                          <span
                            key={index}
                            className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs"
                          >
                            {header}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="mt-6 flex justify-between">
                <button
                  onClick={() => setStep(1)}
                  className="bg-gray-500 text-white px-6 py-2 rounded-md font-medium hover:bg-gray-600 transition-colors"
                >
                  Anterior
                </button>
                <button
                  onClick={() => setStep(3)}
                  disabled={!excelFile || excelData.length === 0}
                  className="bg-blue-600 text-white px-6 py-2 rounded-md font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  Següent
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Revisió */}
          {step === 3 && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Revisió del Projecte</h2>
              <p className="text-gray-600 mb-6">
                Revisa la configuració abans de crear el projecte.
              </p>

              <div className="space-y-6">
                <div>
                  <h3 className="font-medium text-gray-900">Nom del projecte</h3>
                  <p className="text-gray-700">{projectName}</p>
                </div>

                <div>
                  <h3 className="font-medium text-gray-900">Plantilla seleccionada</h3>
                  <p className="text-gray-700">{selectedTemplateData?.config_name}</p>
                  <p className="text-sm text-gray-500">
                    Document: {selectedTemplateData?.base_docx_name}
                  </p>
                </div>

                <div>
                  <h3 className="font-medium text-gray-900">Fitxer Excel</h3>
                  <p className="text-gray-700">{excelFile?.name}</p>
                  <p className="text-sm text-gray-500">
                    {excelData.length} informes a generar
                  </p>
                </div>

                <div>
                  <h3 className="font-medium text-gray-900 mb-2">Previsualització de dades</h3>
                  <div className="border rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="min-w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            {excelHeaders.slice(0, 5).map((header, index) => (
                              <th key={index} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                {header}
                              </th>
                            ))}
                            {excelHeaders.length > 5 && (
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                ... i {excelHeaders.length - 5} més
                              </th>
                            )}
                          </tr>
                        </thead>
                        <tbody className="bg-white">
                          {excelData.slice(0, 3).map((row, rowIndex) => (
                            <tr key={rowIndex} className="border-t">
                              {excelHeaders.slice(0, 5).map((header, colIndex) => (
                                <td key={colIndex} className="px-4 py-2 text-sm text-gray-900">
                                  {String(row[header] || '').substring(0, 30)}
                                  {String(row[header] || '').length > 30 && '...'}
                                </td>
                              ))}
                              {excelHeaders.length > 5 && (
                                <td className="px-4 py-2 text-sm text-gray-500">...</td>
                              )}
                            </tr>
                          ))}
                          {excelData.length > 3 && (
                            <tr className="border-t">
                              <td colSpan={Math.min(excelHeaders.length, 6)} className="px-4 py-2 text-sm text-gray-500 text-center">
                                ... i {excelData.length - 3} files més
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-8 flex justify-between">
                <button
                  onClick={() => setStep(2)}
                  className="bg-gray-500 text-white px-6 py-2 rounded-md font-medium hover:bg-gray-600 transition-colors"
                >
                  Anterior
                </button>
                <button
                  onClick={handleCreateProject}
                  disabled={loading}
                  className="bg-green-600 text-white px-6 py-2 rounded-md font-medium hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center"
                >
                  {loading && (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  )}
                  {loading ? 'Creant...' : 'Crear Projecte'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NoouProjectePage;

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createBrowserSupabaseClient } from '@/lib/supabase/browserClient';
import { Template } from '@/app/types';

const NoouProjectePage: React.FC = () => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [projectName, setProjectName] = useState<string>('');
  const [templateExcelInfo, setTemplateExcelInfo] = useState<{
    hasExcel: boolean;
    fileName?: string;
    headers?: string[];
    totalRows?: number;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingExcelInfo, setLoadingExcelInfo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<number>(1); // 1: Plantilla, 2: Revisió i Creació
  
  const router = useRouter();
  const supabase = createBrowserSupabaseClient();

  useEffect(() => {
    checkUserAndLoadTemplates();
  }, []);

  // Quan es selecciona una plantilla, obtenir info de l'Excel
  useEffect(() => {
    if (selectedTemplate) {
      loadTemplateExcelInfo();
    } else {
      setTemplateExcelInfo(null);
    }
  }, [selectedTemplate]);

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

  const loadTemplateExcelInfo = async () => {
    if (!selectedTemplate) return;

    setLoadingExcelInfo(true);
    setError(null);

    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        router.push('/');
        return;
      }

      // Cridem una nova API per obtenir info de l'Excel sense carregar totes les dades
      const response = await fetch(`/api/reports/template-excel-info/${selectedTemplate}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (response.status === 404) {
          setTemplateExcelInfo({ hasExcel: false });
        } else {
          throw new Error(errorData.error || 'Error obtenint informació de l\'Excel');
        }
      } else {
        const data = await response.json();
        setTemplateExcelInfo(data);
      }
    } catch (err) {
      console.error('Error carregant info Excel:', err);
      setError(err instanceof Error ? err.message : 'Error carregant informació de l\'Excel');
      setTemplateExcelInfo({ hasExcel: false });
    } finally {
      setLoadingExcelInfo(false);
    }
  };

  const handleCreateProject = async () => {
    if (!selectedTemplate || !projectName) {
      setError('Tots els camps són obligatoris.');
      return;
    }

    if (!templateExcelInfo?.hasExcel) {
      setError('La plantilla seleccionada no té un fitxer Excel associat.');
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
          project_name: projectName
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
            Crea un nou projecte per generar informes automàticament amb IA utilitzant les dades d'Excel de la plantilla
          </p>
        </div>

        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-center space-x-8">
            {[1, 2].map((stepNumber) => (
              <div key={stepNumber} className="flex items-center">
                <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
                  step >= stepNumber ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
                }`}>
                  {stepNumber}
                </div>
                <div className={`ml-2 text-sm ${
                  step >= stepNumber ? 'text-blue-600 font-medium' : 'text-gray-500'
                }`}>
                  {stepNumber === 1 && 'Seleccionar Plantilla'}
                  {stepNumber === 2 && 'Revisió i Creació'}
                </div>
                {stepNumber < 2 && (
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
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Selecciona una Plantilla amb Excel</h2>
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
                  {templates.map((template) => {
                    const isSelected = selectedTemplate === template.id;
                    const hasExcelInfo = isSelected && templateExcelInfo !== null;
                    const hasExcel = hasExcelInfo && templateExcelInfo.hasExcel;
                    
                    return (
                      <div
                        key={template.id}
                        className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                          isSelected
                            ? hasExcel 
                              ? 'border-green-500 bg-green-50'
                              : 'border-red-500 bg-red-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                        onClick={() => setSelectedTemplate(template.id)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="font-medium text-gray-900">{template.config_name}</h3>
                            <p className="text-sm text-gray-600 mt-1">
                              Document: {template.base_docx_name || 'No especificat'}
                            </p>
                            <p className="text-sm text-gray-500 mt-1">
                              Instruccions IA: {template.ai_instructions?.length || 0} configurades
                            </p>
                            
                            {/* Informació Excel */}
                            {isSelected && (
                              <div className="mt-3 p-3 bg-white rounded border">
                                {loadingExcelInfo ? (
                                  <div className="flex items-center text-sm text-gray-600">
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                                    Carregant informació de l'Excel...
                                  </div>
                                ) : hasExcelInfo ? (
                                  hasExcel ? (
                                    <div>
                                      <div className="flex items-center text-sm text-green-700 font-medium mb-2">
                                        <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                        Excel disponible
                                      </div>
                                      <p className="text-sm text-gray-600">
                                        <strong>Fitxer:</strong> {templateExcelInfo.fileName}
                                      </p>
                                      <p className="text-sm text-gray-600">
                                        <strong>Files de dades:</strong> {templateExcelInfo.totalRows}
                                      </p>
                                      {templateExcelInfo.headers && (
                                        <div className="mt-2">
                                          <p className="text-xs text-gray-500 mb-1">Columnes:</p>
                                          <div className="flex flex-wrap gap-1">
                                            {templateExcelInfo.headers.slice(0, 3).map((header, index) => (
                                              <span
                                                key={index}
                                                className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs"
                                              >
                                                {header}
                                              </span>
                                            ))}
                                            {templateExcelInfo.headers.length > 3 && (
                                              <span className="text-xs text-gray-500">
                                                ... i {templateExcelInfo.headers.length - 3} més
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <div className="flex items-center text-sm text-red-700">
                                      <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                      </svg>
                                      Aquesta plantilla no té Excel associat
                                    </div>
                                  )
                                ) : null}
                              </div>
                            )}
                          </div>
                          <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${
                            isSelected
                              ? hasExcel 
                                ? 'border-green-500 bg-green-500'
                                : 'border-red-500 bg-red-500'
                              : 'border-gray-300'
                          }`}>
                            {isSelected && (
                              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                {hasExcel ? (
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                ) : (
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                )}
                              </svg>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setStep(2)}
                  disabled={!selectedTemplate || !projectName || !templateExcelInfo?.hasExcel}
                  className="bg-blue-600 text-white px-6 py-2 rounded-md font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  Següent
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Revisió i Creació */}
          {step === 2 && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Revisió del Projecte</h2>
              <p className="text-gray-600 mb-6">
                Revisa la configuració abans de crear el projecte. L'Excel de la plantilla s'utilitzarà automàticament.
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
                  <p className="text-sm text-gray-500">
                    Instruccions IA: {selectedTemplateData?.ai_instructions?.length || 0}
                  </p>
                </div>

                {templateExcelInfo?.hasExcel && (
                  <div>
                    <h3 className="font-medium text-gray-900">Fitxer Excel (de la plantilla)</h3>
                    <p className="text-gray-700">{templateExcelInfo.fileName}</p>
                    <p className="text-sm text-gray-500">
                      {templateExcelInfo.totalRows} informes a generar
                    </p>
                    
                    {templateExcelInfo.headers && (
                      <div className="mt-3">
                        <h4 className="text-sm font-medium text-gray-700 mb-2">Columnes de l'Excel:</h4>
                        <div className="flex flex-wrap gap-2">
                          {templateExcelInfo.headers.map((header, index) => (
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
              </div>

              <div className="mt-8 flex justify-between">
                <button
                  onClick={() => setStep(1)}
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

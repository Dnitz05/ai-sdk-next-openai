'use client';

import React, { useState, useEffect, useReducer } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { createBrowserSupabaseClient } from '@/lib/supabase/browserClient';
import { ProjectWithStats, Generation } from '@/app/types';
import AsyncJobProgress from '@/components/AsyncJobProgress';

// ============================================================================
// TIPUS I CONSTANTS PER AL NOU SISTEMA HUMAN-IN-THE-LOOP
// ============================================================================

type GenerationStep = 'idle' | 'prepare' | 'confirm' | 'generate' | 'review' | 'completed';

interface GenerationState {
  step: GenerationStep;
  currentGenerationId: string | null;
  documentData: any;
  templateInvestigation: any;
  availableTemplates: any[];
  selectedTemplateId: string | null;
  placeholderMapping: any;
  generationResult: any;
  isProcessing: boolean;
  error: string | null;
  userMessage: string | null;
}

interface GenerationAction {
  type: 'START_GENERATION' | 'SET_STEP' | 'SET_DATA' | 'SET_ERROR' | 'RESET' | 'SET_PROCESSING';
  payload?: any;
}

const initialGenerationState: GenerationState = {
  step: 'idle',
  currentGenerationId: null,
  documentData: null,
  templateInvestigation: null,
  availableTemplates: [],
  selectedTemplateId: null,
  placeholderMapping: null,
  generationResult: null,
  isProcessing: false,
  error: null,
  userMessage: null,
};

function generationReducer(state: GenerationState, action: GenerationAction): GenerationState {
  switch (action.type) {
    case 'START_GENERATION':
      return {
        ...initialGenerationState,
        step: 'prepare',
        currentGenerationId: action.payload.generationId,
        documentData: action.payload.documentData,
        isProcessing: true,
      };
    case 'SET_STEP':
      return {
        ...state,
        step: action.payload.step,
        isProcessing: false,
      };
    case 'SET_DATA':
      return {
        ...state,
        ...action.payload,
        isProcessing: false,
      };
    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload,
        isProcessing: false,
      };
    case 'SET_PROCESSING':
      return {
        ...state,
        isProcessing: action.payload,
      };
    case 'RESET':
      return initialGenerationState;
    default:
      return state;
  }
}

interface GenerationItemProps {
  generation: Generation & {
    content_stats: {
      total_placeholders: number;
      completed_placeholders: number;
      refined_placeholders: number;
      completion_percentage: number;
    };
  };
  onGenerate: (generationId: string) => void;
  onViewContent: (generationId: string) => void;
  isGenerating: boolean;
}

const GenerationItem: React.FC<GenerationItemProps> = ({
  generation,
  onGenerate,
  onViewContent,
  isGenerating
}) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'generated': return 'bg-blue-100 text-blue-800';
      case 'processing': return 'bg-yellow-100 text-yellow-800';
      case 'error': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'Pendent';
      case 'processing': return 'Processant...';
      case 'generated': return 'Generat';
      case 'reviewed': return 'Revisat';
      case 'completed': return 'Completat';
      case 'error': return 'Error';
      default: return status;
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="font-medium text-gray-900">
            Informe #{generation.excel_row_index + 1}
          </h3>
          <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(generation.status)}`}>
            {getStatusText(generation.status)}
          </span>
        </div>
        <div className="text-right">
          <div className="text-sm text-gray-600">
            {generation.content_stats.completed_placeholders}/{generation.content_stats.total_placeholders} seccions
          </div>
          <div className="text-xs text-gray-500">
            {generation.content_stats.completion_percentage}% completat
          </div>
        </div>
      </div>

      {/* Barra de progrés per al contingut */}
      {generation.content_stats.total_placeholders > 0 && (
        <div className="mb-3">
          <div className="w-full bg-gray-200 rounded-full h-1.5">
            <div 
              className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${generation.content_stats.completion_percentage}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* Mostra algunes dades de la fila Excel */}
      {generation.row_data && Object.keys(generation.row_data).length > 0 && (
        <div className="mb-3">
          <div className="text-xs text-gray-500 mb-1">Dades de l'Excel:</div>
          <div className="flex flex-wrap gap-1">
            {Object.entries(generation.row_data).slice(0, 3).map(([key, value], index) => (
              <span key={index} className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                {key}: {String(value).substring(0, 20)}{String(value).length > 20 && '...'}
              </span>
            ))}
            {Object.keys(generation.row_data).length > 3 && (
              <span className="text-xs text-gray-500">
                +{Object.keys(generation.row_data).length - 3} més
              </span>
            )}
          </div>
        </div>
      )}

      {/* Error message */}
      {generation.status === 'error' && generation.error_message && (
        <div className="mb-3 text-xs text-red-600 bg-red-50 p-2 rounded">
          {generation.error_message}
        </div>
      )}

      {/* Accions */}
      <div className="flex gap-2">
        {generation.status === 'pending' && (
          <button
            onClick={() => onGenerate(generation.id)}
            disabled={isGenerating}
            className="flex-1 bg-blue-600 text-white px-3 py-1.5 text-xs rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {isGenerating ? 'Generant...' : 'Generar'}
          </button>
        )}
        
        {['generated', 'reviewed', 'completed'].includes(generation.status) && (
          <>
            <button
              onClick={() => onViewContent(generation.id)}
              className="flex-1 bg-gray-100 text-gray-700 px-3 py-1.5 text-xs rounded-md hover:bg-gray-200 transition-colors"
            >
              Veure Contingut
            </button>
            <button
              onClick={() => onGenerate(generation.id)}
              disabled={isGenerating}
              className="bg-blue-600 text-white px-3 py-1.5 text-xs rounded-md hover:bg-blue-700 disabled:bg-gray-300 transition-colors"
            >
              Re-generar
            </button>
          </>
        )}

        {generation.status === 'error' && (
          <button
            onClick={() => onGenerate(generation.id)}
            disabled={isGenerating}
            className="flex-1 bg-orange-600 text-white px-3 py-1.5 text-xs rounded-md hover:bg-orange-700 disabled:bg-gray-300 transition-colors"
          >
            Tornar a intentar
          </button>
        )}
      </div>
    </div>
  );
};

const ProjectDetailPage: React.FC = () => {
  const [project, setProject] = useState<ProjectWithStats | null>(null);
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generatingIds, setGeneratingIds] = useState<Set<string>>(new Set());
  const [asyncJobsActive, setAsyncJobsActive] = useState(false);
  
  // Nou sistema Human-in-the-Loop amb useReducer
  const [generationState, dispatch] = useReducer(generationReducer, initialGenerationState);
  
  const router = useRouter();
  const params = useParams();
  const projectId = params.projectId as string;
  const supabase = createBrowserSupabaseClient();

  useEffect(() => {
    if (projectId) {
      checkUserAndLoadData();
    }
  }, [projectId]);

  const checkUserAndLoadData = async () => {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      router.push('/');
      return;
    }
    
    await loadProjectData();
  };

  const loadProjectData = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        router.push('/');
        return;
      }

      // Carregar dades del projecte
      const projectResponse = await fetch('/api/reports/projects', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!projectResponse.ok) {
        const errorText = await projectResponse.text();
        throw new Error(`Error carregant projectes: ${projectResponse.status} ${errorText}`);
      }

      const projectData = await projectResponse.json();
      
      if (!projectData.projects || !Array.isArray(projectData.projects)) {
        throw new Error('Format de resposta invàlid dels projectes');
      }

      const currentProject = projectData.projects.find((p: ProjectWithStats) => p.id === projectId);
      
      if (!currentProject) {
        // Mostrar projectes disponibles per ajudar l'usuari
        const availableProjects = projectData.projects.slice(0, 3).map((p: ProjectWithStats) => 
          `${p.project_name} (${p.id})`
        ).join(', ');
        
        setError(`Projecte amb ID "${projectId}" no trobat. Projectes disponibles: ${availableProjects}`);
        return;
      }

      setProject(currentProject);

      // Carregar generacions
      const generationsResponse = await fetch(`/api/reports/generations?project_id=${projectId}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!generationsResponse.ok) {
        throw new Error('Error carregant generacions');
      }

      const generationsData = await generationsResponse.json();
      setGenerations(generationsData.generations || []);

    } catch (err) {
      console.error('Error carregant dades:', err);
      setError(err instanceof Error ? err.message : 'Error desconegut');
    } finally {
      setLoading(false);
    }
  };

  // ============================================================================
  // NOVA FUNCIÓ UNIFICADA DE GENERACIÓ - HUMAN-IN-THE-LOOP
  // ============================================================================

  const handleUnifiedGeneration = async (generationId: string, step: GenerationStep = 'prepare') => {
    try {
      dispatch({ type: 'SET_PROCESSING', payload: true });

      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        router.push('/');
        return;
      }

      const requestBody: any = {
        generationId,
        step
      };

      // Afegir dades addicionals segons el pas
      if (step === 'confirm' && generationState.selectedTemplateId) {
        requestBody.selectedTemplateId = generationState.selectedTemplateId;
      }
      if (step === 'confirm' && generationState.placeholderMapping) {
        requestBody.placeholderMapping = generationState.placeholderMapping;
      }

      const response = await fetch('/api/reports/generate-individual-enhanced', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error en el procés de generació');
      }

      const result = await response.json();

      // Actualitzar l'estat segons la resposta
      switch (result.step) {
        case 'prepare':
          dispatch({
            type: 'SET_DATA',
            payload: {
              step: 'confirm',
              documentData: result.documentData,
              templateInvestigation: result.templateInvestigation,
              availableTemplates: result.availableTemplates || [],
              selectedTemplateId: result.recommendedTemplateId || null,
              placeholderMapping: result.placeholderMapping,
              userMessage: result.userMessage,
            }
          });
          break;

        case 'confirm':
          dispatch({
            type: 'SET_DATA',
            payload: {
              step: 'generate',
              userMessage: result.userMessage,
            }
          });
          // Continuar automàticament amb la generació
          await handleUnifiedGeneration(generationId, 'generate');
          break;

        case 'generate':
          dispatch({
            type: 'SET_DATA',
            payload: {
              step: 'review',
              generationResult: result.generationResult,
              userMessage: result.userMessage,
            }
          });
          break;

        case 'review':
          dispatch({
            type: 'SET_DATA',
            payload: {
              step: 'completed',
              userMessage: result.userMessage || 'Generació completada amb èxit!',
            }
          });
          // Refrescar les dades del projecte
          setTimeout(() => {
            loadProjectData();
          }, 1000);
          break;

        default:
          throw new Error(`Pas desconegut: ${result.step}`);
      }

      setError(null);

    } catch (err) {
      console.error('Error en generació unificada:', err);
      dispatch({
        type: 'SET_ERROR',
        payload: err instanceof Error ? err.message : 'Error desconegut en la generació'
      });
    }
  };

  const startGeneration = (generationId: string) => {
    dispatch({
      type: 'START_GENERATION',
      payload: {
        generationId,
        documentData: null,
      }
    });
    handleUnifiedGeneration(generationId, 'prepare');
  };

  const confirmGeneration = () => {
    if (generationState.currentGenerationId) {
      handleUnifiedGeneration(generationState.currentGenerationId, 'confirm');
    }
  };

  const resetGeneration = () => {
    dispatch({ type: 'RESET' });
  };

  // ============================================================================
  // FUNCIONS OBSOLETES - ELIMINADES PER LA REFACTORITZACIÓ
  // ============================================================================
  
  // La funció handleGenerate ha estat reemplaçada per startGeneration i handleUnifiedGeneration
  // que utilitzen el nou endpoint /api/reports/generate-individual-enhanced amb el sistema Human-in-the-Loop
  
  // ABANS (problemàtic):
  // - Cridava a /api/reports/generate (endpoint obsolet)
  // - No validava plantilles abans de generar
  // - Provocava l'error "Plantilla no trobada"
  
  // ARA (robust):
  // - Utilitza /api/reports/generate-individual-enhanced
  // - Implementa el flux Human-in-the-Loop de 4 passos
  // - Valida plantilles abans de generar
  // - Ofereix selecció de plantilles a l'usuari

  const handleViewContent = (generationId: string) => {
    router.push(`/informes/${projectId}/generacions/${generationId}`);
  };

  const handleGenerateAll = async () => {
    const pendingGenerations = generations.filter(g => g.status === 'pending');
    
    if (pendingGenerations.length === 0) {
      setError('No hi ha generacions pendents');
      return;
    }

    for (const generation of pendingGenerations) {
      await startGeneration(generation.id);
      // Esperar un moment entre generacions per no sobrecarregar
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  };

  const handleGenerateAllAsync = async () => {
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        router.push('/');
        return;
      }

      const response = await fetch('/api/jobs/generate', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId: projectId
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error iniciant generació automàtica');
      }

      const result = await response.json();
      setAsyncJobsActive(true);
      setError(null);
      
      // Mostrar missatge d'èxit amb informació detallada
      console.log(`🎉 ${result.jobsCreated} jobs creats correctament!`);
      console.log(`📊 ${result.totalPlaceholders} placeholders per job`);
      console.log(`⏱️ Temps estimat: ${result.webhook_info.estimated_time}`);
      console.log(`🚀 Els jobs s'estan processant automàticament en paral·lel`);

    } catch (err) {
      console.error('Error iniciant generació automàtica:', err);
      setError(err instanceof Error ? err.message : 'Error iniciant generació automàtica');
    }
  };

  const handleAsyncJobsCompleted = () => {
    setAsyncJobsActive(false);
    // Afegim un petit retard per donar temps a la BD a actualitzar-se abans de refrescar
    setTimeout(() => {
      loadProjectData();
    }, 2000); // 2 segons de retard
  };

  const handleGenerateSmartBatch = async () => {
    try {
      setError(null);
      
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        router.push('/');
        return;
      }

      console.log(`🧠 Iniciant generació intel·ligent millorada per projecte ${projectId}...`);
      
      const startTime = Date.now();
      
      const response = await fetch('/api/reports/generate-smart-enhanced', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId: projectId,
          mode: 'batch'
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error en generació intel·ligent');
      }
      
      const result = await response.json();
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      
      console.log(`🎉 Generació intel·ligent completada!`);
      console.log(`📊 Documents generats: ${result.documentsGenerated}`);
      console.log(`⏱️ Temps total: ${totalTime}ms (${(totalTime/1000).toFixed(1)}s)`);
      console.log(`🚀 Velocitat: ${(result.documentsGenerated / (totalTime/1000)).toFixed(2)} docs/segon`);
      
      if (result.metrics) {
        console.log(`🤖 Temps IA: ${result.metrics.totalAiTime}ms`);
        console.log(`📄 Temps DOCX: ${result.metrics.totalDocxTime}ms`);
        console.log(`☁️ Temps Storage: ${result.metrics.totalStorageTime}ms`);
        console.log(`📊 Temps carrega Excel: ${result.metrics.excelLoadTime}ms`);
      }

      // Mostrar missatge d'èxit a la interfície
      setError(`✅ Generació intel·ligent completada! ${result.documentsGenerated} documents en ${(totalTime/1000).toFixed(1)}s`);
      
      // Refrescar dades del projecte
      setTimeout(() => {
        loadProjectData();
      }, 1000);

    } catch (err) {
      console.error('Error en generació intel·ligent:', err);
      setError(err instanceof Error ? err.message : 'Error en generació intel·ligent');
    }
  };

  const handleGenerateSmartIndividual = async () => {
    try {
      setError(null);
      
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        router.push('/');
        return;
      }

      // Obtenir generacions pendents
      const pendingGenerations = generations.filter(g => g.status === 'pending');
      
      if (pendingGenerations.length === 0) {
        setError('No hi ha generacions pendents per processar');
        return;
      }

      console.log(`🧠 Iniciant generació intel·ligent individual per ${pendingGenerations.length} documents...`);
      
      const startTime = Date.now();
      
      const response = await fetch('/api/reports/generate-smart-enhanced', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId: projectId,
          mode: 'individual',
          generationIds: pendingGenerations.map(g => g.id)
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error en generació intel·ligent individual');
      }
      
      const result = await response.json();
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      
      console.log(`🎉 Generació intel·ligent individual completada!`);
      console.log(`📊 Documents generats: ${result.documentsGenerated}`);
      console.log(`⏱️ Temps total: ${totalTime}ms (${(totalTime/1000).toFixed(1)}s)`);
      
      if (result.metrics) {
        console.log(`🤖 Temps IA: ${result.metrics.totalAiTime}ms`);
        console.log(`📄 Temps DOCX: ${result.metrics.totalDocxTime}ms`);
        console.log(`☁️ Temps Storage: ${result.metrics.totalStorageTime}ms`);
      }

      // Mostrar missatge d'èxit a la interfície
      setError(`✅ Generació intel·ligent individual completada! ${result.documentsGenerated} documents en ${(totalTime/1000).toFixed(1)}s`);
      
      // Refrescar dades del projecte
      setTimeout(() => {
        loadProjectData();
      }, 1000);

    } catch (err) {
      console.error('Error en generació intel·ligent individual:', err);
      setError(err instanceof Error ? err.message : 'Error en generació intel·ligent individual');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregant projecte...</p>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Projecte no trobat</p>
          <Link href="/informes" className="text-blue-600 hover:text-blue-700">
            Tornar als projectes
          </Link>
        </div>
      </div>
    );
  }

  const pendingCount = generations.filter(g => g.status === 'pending').length;
  const generatingCount = generatingIds.size;

  // Debug logging per al botó intel·ligent
  console.log('🔍 Debug botó intel·ligent:', {
    project_excel_data: project?.excel_data,
    is_array: Array.isArray(project?.excel_data),
    length: project?.excel_data?.length,
    generatingCount,
    asyncJobsActive,
    shouldBeEnabled: !!(
      project?.excel_data && 
      Array.isArray(project.excel_data) && 
      project.excel_data.length > 0 && 
      generatingCount === 0 && 
      !asyncJobsActive
    )
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Link
              href="/informes"
              className="text-blue-600 hover:text-blue-700 flex items-center"
            >
              <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Tornar als projectes
            </Link>
            <h1 className="text-3xl font-bold text-gray-900">{project.project_name}</h1>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div>
                <h3 className="text-sm font-medium text-gray-500">Plantilla</h3>
                <p className="text-lg font-medium text-gray-900">{project.template_name}</p>
                <p className="text-sm text-gray-600">{project.template_docx_name}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500">Fitxer Excel</h3>
                <p className="text-lg font-medium text-gray-900">{project.excel_filename}</p>
                <p className="text-sm text-gray-600">{project.total_rows} files</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500">Progrés Total</h3>
                <p className="text-lg font-medium text-gray-900">{project.stats.progress}%</p>
                <p className="text-sm text-gray-600">
                  {project.stats.completed}/{project.stats.total} completats
                </p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500">Estat</h3>
                <div className="flex gap-2 text-sm">
                  <span className="text-green-600">{project.stats.completed} ✓</span>
                  <span className="text-blue-600">{project.stats.pending} ⏳</span>
                  <span className="text-red-600">{project.stats.errors} ✗</span>
                </div>
              </div>
            </div>
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
            <button
              onClick={() => setError(null)}
              className="mt-2 text-red-600 hover:text-red-700 text-sm"
            >
              Tancar
            </button>
          </div>
        )}

        {/* Accions principals */}
        <div className="mb-6 flex flex-wrap gap-4">
          <button
            onClick={handleGenerateAllAsync}
            disabled={pendingCount === 0 || generatingCount > 0 || asyncJobsActive}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Generació Asíncrona ({pendingCount} pendents)
          </button>
          
          <button
            onClick={handleGenerateAll}
            disabled={pendingCount === 0 || generatingCount > 0 || asyncJobsActive}
            className="bg-green-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center"
          >
            {generatingCount > 0 && (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
            )}
            Generació Individual ({pendingCount} pendents)
          </button>

          <button
            onClick={handleGenerateSmartBatch}
            disabled={!project?.excel_data || !Array.isArray(project.excel_data) || project.excel_data.length === 0 || generatingCount > 0 || asyncJobsActive}
            className="bg-purple-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            🧠 Generació Intel·ligent Batch ({project?.total_rows || 0} docs)
          </button>

          <button
            onClick={handleGenerateSmartIndividual}
            disabled={pendingCount === 0 || generatingCount > 0 || asyncJobsActive}
            className="bg-indigo-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            🎯 Generació Intel·ligent Individual ({pendingCount} pendents)
          </button>
          
          <button
            onClick={loadProjectData}
            disabled={asyncJobsActive}
            className="bg-gray-100 text-gray-700 px-6 py-3 rounded-lg font-medium hover:bg-gray-200 disabled:bg-gray-300 transition-colors flex items-center"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Actualitzar
          </button>
        </div>

        {/* Component de progrés asíncron */}
        {asyncJobsActive && (
          <div className="mb-6">
            <AsyncJobProgress 
              projectId={projectId}
              onAllJobsCompleted={handleAsyncJobsCompleted}
            />
          </div>
        )}

        {/* Modal del sistema Human-in-the-Loop */}
        {generationState.step !== 'idle' && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
              {/* Header del modal */}
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  Generació Intel·ligent - Informe #{(() => {
                    const generation = generations.find(g => g.id === generationState.currentGenerationId);
                    return generation ? generation.excel_row_index + 1 : '...';
                  })()}
                </h3>
                <button
                  onClick={resetGeneration}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Indicador de pas */}
              <div className="mb-6">
                <div className="flex items-center">
                  <div className={`flex-1 h-1 rounded ${generationState.step === 'prepare' || generationState.step === 'confirm' || generationState.step === 'generate' || generationState.step === 'review' || generationState.step === 'completed' ? 'bg-blue-600' : 'bg-gray-200'}`}></div>
                  <div className={`flex-1 h-1 rounded ml-1 ${generationState.step === 'confirm' || generationState.step === 'generate' || generationState.step === 'review' || generationState.step === 'completed' ? 'bg-blue-600' : 'bg-gray-200'}`}></div>
                  <div className={`flex-1 h-1 rounded ml-1 ${generationState.step === 'generate' || generationState.step === 'review' || generationState.step === 'completed' ? 'bg-blue-600' : 'bg-gray-200'}`}></div>
                  <div className={`flex-1 h-1 rounded ml-1 ${generationState.step === 'review' || generationState.step === 'completed' ? 'bg-blue-600' : 'bg-gray-200'}`}></div>
                  <div className={`flex-1 h-1 rounded ml-1 ${generationState.step === 'completed' ? 'bg-green-600' : 'bg-gray-200'}`}></div>
                </div>
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>Preparar</span>
                  <span>Confirmar</span>
                  <span>Generar</span>
                  <span>Revisar</span>
                  <span>Completat</span>
                </div>
              </div>

              {/* Contingut segons el pas */}
              {generationState.step === 'confirm' && (
                <div>
                  <h4 className="text-md font-medium text-gray-900 mb-3">Confirma la Plantilla i Dades</h4>
                  
                  {generationState.userMessage && (
                    <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-blue-800 text-sm">{generationState.userMessage}</p>
                    </div>
                  )}

                  {/* Informació de la investigació de plantilles */}
                  {generationState.templateInvestigation && (
                    <div className="mb-4">
                      <h5 className="text-sm font-medium text-gray-700 mb-2">Estat de la Plantilla:</h5>
                      <div className="bg-gray-50 p-3 rounded-lg text-sm">
                        <p><span className="font-medium">Plantilla actual:</span> {generationState.templateInvestigation.currentTemplateName || 'No disponible'}</p>
                        <p><span className="font-medium">Estat:</span> {generationState.templateInvestigation.isValid ? '✅ Vàlida' : '❌ Problemes detectats'}</p>
                        {generationState.templateInvestigation.issues && generationState.templateInvestigation.issues.length > 0 && (
                          <div className="mt-2">
                            <span className="font-medium">Problemes:</span>
                            <ul className="list-disc list-inside ml-2">
                              {generationState.templateInvestigation.issues.map((issue: string, idx: number) => (
                                <li key={idx} className="text-red-600">{issue}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Plantilles disponibles */}
                  {generationState.availableTemplates && generationState.availableTemplates.length > 0 && (
                    <div className="mb-4">
                      <h5 className="text-sm font-medium text-gray-700 mb-2">Plantilles Disponibles:</h5>
                      <div className="space-y-2">
                        {generationState.availableTemplates.map((template: any, idx: number) => (
                          <label key={idx} className="flex items-center p-2 border rounded-lg cursor-pointer hover:bg-gray-50">
                            <input
                              type="radio"
                              name="template"
                              value={template.id}
                              checked={generationState.selectedTemplateId === template.id}
                              onChange={(e) => dispatch({
                                type: 'SET_DATA',
                                payload: { selectedTemplateId: e.target.value }
                              })}
                              className="mr-3"
                            />
                            <div>
                              <p className="text-sm font-medium">{template.name}</p>
                              <p className="text-xs text-gray-600">{template.docx_name}</p>
                              {template.isRecommended && (
                                <span className="inline-block px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full mt-1">
                                  Recomanada
                                </span>
                              )}
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Dades del document */}
                  {generationState.documentData && (
                    <div className="mb-4">
                      <h5 className="text-sm font-medium text-gray-700 mb-2">Dades del Document:</h5>
                      <div className="bg-gray-50 p-3 rounded-lg text-sm max-h-32 overflow-y-auto">
                        {Object.entries(generationState.documentData).slice(0, 5).map(([key, value]) => (
                          <p key={key}><span className="font-medium">{key}:</span> {String(value).substring(0, 50)}{String(value).length > 50 && '...'}</p>
                        ))}
                        {Object.keys(generationState.documentData).length > 5 && (
                          <p className="text-gray-500">+{Object.keys(generationState.documentData).length - 5} camps més</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {generationState.step === 'review' && (
                <div>
                  <h4 className="text-md font-medium text-gray-900 mb-3">Generació Completada</h4>
                  
                  {generationState.userMessage && (
                    <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                      <p className="text-green-800 text-sm">{generationState.userMessage}</p>
                    </div>
                  )}

                  {generationState.generationResult && (
                    <div className="mb-4">
                      <h5 className="text-sm font-medium text-gray-700 mb-2">Resultat:</h5>
                      <div className="bg-gray-50 p-3 rounded-lg text-sm">
                        <p><span className="font-medium">Document generat:</span> ✅</p>
                        <p><span className="font-medium">Temps de generació:</span> {generationState.generationResult.processingTime || 'No disponible'}</p>
                        <p><span className="font-medium">Estat:</span> {generationState.generationResult.status || 'Completat'}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {generationState.step === 'completed' && (
                <div>
                  <div className="text-center">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <h4 className="text-lg font-medium text-gray-900 mb-2">Generació Completada!</h4>
                    <p className="text-gray-600 mb-4">{generationState.userMessage || 'El document s\'ha generat correctament.'}</p>
                  </div>
                </div>
              )}

              {/* Error */}
              {generationState.error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-800 text-sm">{generationState.error}</p>
                </div>
              )}

              {/* Botons d'acció */}
              <div className="flex gap-3 justify-end">
                <button
                  onClick={resetGeneration}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                >
                  {generationState.step === 'completed' ? 'Tancar' : 'Cancel·lar'}
                </button>
                
                {generationState.step === 'confirm' && (
                  <button
                    onClick={confirmGeneration}
                    disabled={generationState.isProcessing || !generationState.selectedTemplateId}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center"
                  >
                    {generationState.isProcessing ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Processant...
                      </>
                    ) : (
                      'Continuar amb la Generació'
                    )}
                  </button>
                )}

                {(generationState.step === 'review' || generationState.step === 'completed') && (
                  <button
                    onClick={() => {
                      if (generationState.currentGenerationId) {
                        resetGeneration();
                        router.push(`/informes/${projectId}/generacions/${generationState.currentGenerationId}`);
                      }
                    }}
                    className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 transition-colors"
                  >
                    Veure Document Generat
                  </button>
                )}
              </div>

              {/* Indicador de processament */}
              {generationState.isProcessing && (
                <div className="mt-4 flex items-center justify-center">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-2"></div>
                  <span className="text-sm text-gray-600">Processant...</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Llista de generacions */}
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Informes Individuals ({generations.length})
          </h2>
          
          {generations.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg">
              <p className="text-gray-500">No s'han trobat generacions per aquest projecte.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {generations.map((generation) => (
                <GenerationItem
                  key={generation.id}
                  generation={generation as any}
                  onGenerate={startGeneration}
                  onViewContent={handleViewContent}
                  isGenerating={generatingIds.has(generation.id) || generationState.isProcessing}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProjectDetailPage;

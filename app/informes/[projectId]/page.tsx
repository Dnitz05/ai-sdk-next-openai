'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { createBrowserSupabaseClient } from '@/lib/supabase/browserClient';
import { ProjectWithStats, Generation } from '@/app/types';
import AsyncJobProgress from '@/components/AsyncJobProgress';

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
        throw new Error('Error carregant projectes');
      }

      const projectData = await projectResponse.json();
      const currentProject = projectData.projects.find((p: ProjectWithStats) => p.id === projectId);
      
      if (!currentProject) {
        setError('Projecte no trobat');
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

  const handleGenerate = async (generationId: string) => {
    try {
      setGeneratingIds(prev => new Set(prev).add(generationId));

      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        router.push('/');
        return;
      }

      const response = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          generation_id: generationId,
          use_fast_model: false
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error generant contingut');
      }

      // Recarregar dades
      await loadProjectData();

    } catch (err) {
      console.error('Error generant:', err);
      setError(err instanceof Error ? err.message : 'Error generant contingut');
    } finally {
      setGeneratingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(generationId);
        return newSet;
      });
    }
  };

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
      await handleGenerate(generation.id);
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

      const response = await fetch('/api/reports/generate-async', {
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
        throw new Error(errorData.error || 'Error iniciant generació asíncrona');
      }

      const result = await response.json();
      setAsyncJobsActive(true);
      setError(null);
      
      // Mostrar missatge d'èxit
      console.log(`${result.jobs.length} jobs de generació iniciats`);

    } catch (err) {
      console.error('Error iniciant generació asíncrona:', err);
      setError(err instanceof Error ? err.message : 'Error iniciant generació asíncrona');
    }
  };

  const handleAsyncJobsCompleted = () => {
    setAsyncJobsActive(false);
    // Recarregar dades del projecte
    loadProjectData();
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
                  onGenerate={handleGenerate}
                  onViewContent={handleViewContent}
                  isGenerating={generatingIds.has(generation.id)}
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

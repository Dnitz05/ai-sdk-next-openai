'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { createBrowserSupabaseClient } from '@/lib/supabase/browserClient';
import { Generation, Content } from '@/app/types';

interface ContentSectionProps {
  content: Content;
  onUpdate: (contentId: string, newText: string) => void;
  isEditing: boolean;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
}

const ContentSection: React.FC<ContentSectionProps> = ({
  content,
  onUpdate,
  isEditing,
  onEdit,
  onSave,
  onCancel
}) => {
  const [editText, setEditText] = useState(content.generated_text || '');

  useEffect(() => {
    setEditText(content.generated_text || '');
  }, [content.generated_text]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'generated': return 'bg-blue-100 text-blue-800';
      case 'refined': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'error': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handleSave = () => {
    onUpdate(content.id, editText);
    onSave();
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            {content.placeholder_id}
          </h3>
          <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(content.status)}`}>
            {content.status}
          </span>
        </div>
        <div className="flex gap-2">
          {!isEditing ? (
            <button
              onClick={onEdit}
              className="bg-blue-100 text-blue-700 px-3 py-1 rounded text-sm hover:bg-blue-200 transition-colors"
            >
              Editar
            </button>
          ) : (
            <>
              <button
                onClick={handleSave}
                className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 transition-colors"
              >
                Desar
              </button>
              <button
                onClick={onCancel}
                className="bg-gray-500 text-white px-3 py-1 rounded text-sm hover:bg-gray-600 transition-colors"
              >
                Cancel·lar
              </button>
            </>
          )}
        </div>
      </div>

      {/* Instruccions de la IA */}
      {content.ai_instructions && (
        <div className="mb-4 p-3 bg-gray-50 rounded">
          <h4 className="text-sm font-medium text-gray-700 mb-1">Instruccions IA:</h4>
          <p className="text-sm text-gray-600">{content.ai_instructions}</p>
        </div>
      )}

      {/* Contingut generat */}
      <div className="mb-4">
        <h4 className="text-sm font-medium text-gray-700 mb-2">Contingut generat:</h4>
        {isEditing ? (
          <textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            className="w-full h-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-vertical"
            placeholder="Escriu el contingut aquí..."
          />
        ) : (
          <div className="p-3 bg-gray-50 rounded min-h-[80px] whitespace-pre-wrap">
            {content.generated_text || (
              <span className="text-gray-500 italic">No s'ha generat contingut encara</span>
            )}
          </div>
        )}
      </div>

      {/* Error message */}
      {content.status === 'error' && content.error_message && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded">
          <h4 className="text-sm font-medium text-red-700 mb-1">Error:</h4>
          <p className="text-sm text-red-600">{content.error_message}</p>
        </div>
      )}

      {/* Metadata */}
      <div className="text-xs text-gray-500 border-t pt-3">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="font-medium">Creat:</span> {new Date(content.created_at).toLocaleString('ca-ES')}
          </div>
          <div>
            <span className="font-medium">Actualitzat:</span> {new Date(content.updated_at).toLocaleString('ca-ES')}
          </div>
        </div>
      </div>
    </div>
  );
};

const GenerationDetailPage: React.FC = () => {
  const [generation, setGeneration] = useState<Generation | null>(null);
  const [contents, setContents] = useState<Content[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingContentId, setEditingContentId] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  
  const router = useRouter();
  const params = useParams();
  const projectId = params.projectId as string;
  const generationId = params.generationId as string;
  const supabase = createBrowserSupabaseClient();

  useEffect(() => {
    if (projectId && generationId) {
      checkUserAndLoadData();
    }
  }, [projectId, generationId]);

  const checkUserAndLoadData = async () => {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      router.push('/');
      return;
    }
    
    await loadGenerationData();
  };

  const loadGenerationData = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        router.push('/');
        return;
      }

      // Carregar dades de la generació
      const generationResponse = await fetch(`/api/reports/generations?project_id=${projectId}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!generationResponse.ok) {
        throw new Error('Error carregant generacions');
      }

      const generationData = await generationResponse.json();
      const currentGeneration = generationData.generations.find((g: Generation) => g.id === generationId);
      
      if (!currentGeneration) {
        setError('Generació no trobada');
        return;
      }

      setGeneration(currentGeneration);

      // Carregar contingut de la generació
      const contentResponse = await fetch(`/api/reports/content?generation_id=${generationId}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!contentResponse.ok) {
        throw new Error('Error carregant contingut');
      }

      const contentData = await contentResponse.json();
      setContents(contentData.content || []);

    } catch (err) {
      console.error('Error carregant dades:', err);
      setError(err instanceof Error ? err.message : 'Error desconegut');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateContent = async (contentId: string, newText: string) => {
    try {
      setUpdating(true);

      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        router.push('/');
        return;
      }

      const response = await fetch('/api/reports/content', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content_id: contentId,
          generated_text: newText,
          status: 'refined'
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error actualitzant contingut');
      }

      // Actualitzar el contingut localment
      setContents(prev => prev.map(content => 
        content.id === contentId 
          ? { ...content, generated_text: newText, status: 'refined' as const }
          : content
      ));

    } catch (err) {
      console.error('Error actualitzant contingut:', err);
      setError(err instanceof Error ? err.message : 'Error actualitzant contingut');
    } finally {
      setUpdating(false);
    }
  };

  const handleRegenerate = async () => {
    try {
      setUpdating(true);

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
        throw new Error(errorData.error || 'Error regenerant contingut');
      }

      // Recarregar dades
      await loadGenerationData();

    } catch (err) {
      console.error('Error regenerant:', err);
      setError(err instanceof Error ? err.message : 'Error regenerant contingut');
    } finally {
      setUpdating(false);
    }
  };

  const handleDownloadDocument = async () => {
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        router.push('/');
        return;
      }

      // TODO: Implementar endpoint per generar i descarregar el document final
      alert('Funcionalitat de descàrrega en desenvolupament');

    } catch (err) {
      console.error('Error descarregant document:', err);
      setError('Error descarregant document');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregant contingut...</p>
        </div>
      </div>
    );
  }

  if (!generation) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Generació no trobada</p>
          <Link href={`/informes/${projectId}`} className="text-blue-600 hover:text-blue-700">
            Tornar al projecte
          </Link>
        </div>
      </div>
    );
  }

  const completedSections = contents.filter(c => c.status === 'generated' || c.status === 'refined').length;
  const totalSections = contents.length;
  const completionPercentage = totalSections > 0 ? Math.round((completedSections / totalSections) * 100) : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Link
              href={`/informes/${projectId}`}
              className="text-blue-600 hover:text-blue-700 flex items-center"
            >
              <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Tornar al projecte
            </Link>
            <h1 className="text-3xl font-bold text-gray-900">
              Informe #{generation.excel_row_index + 1}
            </h1>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div>
                <h3 className="text-sm font-medium text-gray-500">Estat</h3>
                <p className="text-lg font-medium text-gray-900 capitalize">{generation.status}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500">Progrés</h3>
                <p className="text-lg font-medium text-gray-900">{completionPercentage}%</p>
                <p className="text-sm text-gray-600">
                  {completedSections}/{totalSections} seccions
                </p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500">Última actualització</h3>
                <p className="text-lg font-medium text-gray-900">
                  {new Date(generation.updated_at).toLocaleDateString('ca-ES')}
                </p>
              </div>
            </div>

            {/* Dades de l'Excel */}
            {generation.row_data && Object.keys(generation.row_data).length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">Dades de l'Excel:</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(generation.row_data).map(([key, value], index) => (
                    <div key={index} className="bg-gray-50 p-3 rounded">
                      <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">{key}</div>
                      <div className="text-sm text-gray-900 mt-1">{String(value)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
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
        <div className="mb-8 flex gap-4">
          <button
            onClick={handleRegenerate}
            disabled={updating}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center"
          >
            {updating && (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
            )}
            Re-generar Tot
          </button>
          
          <button
            onClick={handleDownloadDocument}
            disabled={completionPercentage < 100}
            className="bg-green-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Descarregar Document
          </button>

          <button
            onClick={loadGenerationData}
            className="bg-gray-100 text-gray-700 px-6 py-3 rounded-lg font-medium hover:bg-gray-200 transition-colors flex items-center"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Actualitzar
          </button>
        </div>

        {/* Contingut de les seccions */}
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-6">
            Contingut Generat ({contents.length} seccions)
          </h2>
          
          {contents.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg">
              <p className="text-gray-500">No s'ha trobat contingut per aquesta generació.</p>
            </div>
          ) : (
            <div>
              {contents.map((content) => (
                <ContentSection
                  key={content.id}
                  content={content}
                  onUpdate={handleUpdateContent}
                  isEditing={editingContentId === content.id}
                  onEdit={() => setEditingContentId(content.id)}
                  onSave={() => setEditingContentId(null)}
                  onCancel={() => setEditingContentId(null)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GenerationDetailPage;

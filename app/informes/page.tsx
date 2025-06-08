'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { createBrowserSupabaseClient } from '@/lib/supabase/browserClient';
import { useRouter } from 'next/navigation';
import { ProjectWithStats } from '@/app/types';

interface ProjectCardProps {
  project: ProjectWithStats;
  onRefresh: () => void;
}

const ProjectCard: React.FC<ProjectCardProps> = ({ project, onRefresh }) => {
  const router = useRouter();
  
  const getStatusColor = (progress: number) => {
    if (progress === 100) return 'bg-green-500';
    if (progress > 50) return 'bg-yellow-500';
    if (progress > 0) return 'bg-blue-500';
    return 'bg-gray-300';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ca-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200 hover:shadow-lg transition-shadow">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">
            {project.project_name}
          </h3>
          <p className="text-sm text-gray-600">
            Plantilla: {project.template_name}
          </p>
          <p className="text-sm text-gray-600">
            Excel: {project.excel_filename}
          </p>
        </div>
        <div className="text-right">
          <span className="text-2xl font-bold text-gray-900">
            {project.stats.progress}%
          </span>
          <p className="text-xs text-gray-500">completat</p>
        </div>
      </div>

      {/* Barra de progrés */}
      <div className="mb-4">
        <div className="flex justify-between text-xs text-gray-600 mb-1">
          <span>Progrés</span>
          <span>{project.stats.completed}/{project.stats.total} informes</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className={`h-2 rounded-full transition-all duration-300 ${getStatusColor(project.stats.progress)}`}
            style={{ width: `${project.stats.progress}%` }}
          ></div>
        </div>
      </div>

      {/* Estadístiques */}
      <div className="grid grid-cols-3 gap-4 mb-4 text-center">
        <div>
          <p className="text-lg font-semibold text-green-600">{project.stats.completed}</p>
          <p className="text-xs text-gray-500">Completats</p>
        </div>
        <div>
          <p className="text-lg font-semibold text-blue-600">{project.stats.pending}</p>
          <p className="text-xs text-gray-500">Pendents</p>
        </div>
        <div>
          <p className="text-lg font-semibold text-red-600">{project.stats.errors}</p>
          <p className="text-xs text-gray-500">Errors</p>
        </div>
      </div>

      {/* Data de creació */}
      <p className="text-xs text-gray-500 mb-4">
        Creat: {formatDate(project.created_at)}
      </p>

      {/* Accions */}
      <div className="flex gap-2">
        <button
          onClick={() => router.push(`/informes/${project.id}`)}
          className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          Veure Detalls
        </button>
        <button
          onClick={() => router.push(`/informes/${project.id}/generacions`)}
          className="flex-1 bg-gray-100 text-gray-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-200 transition-colors"
        >
          Generacions
        </button>
      </div>
    </div>
  );
};

const InformesPage: React.FC = () => {
  const [projects, setProjects] = useState<ProjectWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const router = useRouter();
  const supabase = createBrowserSupabaseClient();

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      router.push('/');
      return;
    }
    setUser(user);
    loadProjects();
  };

  const loadProjects = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        router.push('/');
        return;
      }

      const response = await fetch('/api/reports/projects', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error carregant projectes');
      }

      const data = await response.json();
      setProjects(data.projects || []);
    } catch (err) {
      console.error('Error carregant projectes:', err);
      setError(err instanceof Error ? err.message : 'Error desconegut');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregant projectes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Generació d'Informes
              </h1>
              <p className="mt-2 text-gray-600">
                Gestiona els teus projectes de generació automàtica d'informes amb IA
              </p>
            </div>
            <Link
              href="/informes/nou"
              className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors inline-flex items-center"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Nou Projecte
            </Link>
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
              onClick={loadProjects}
              className="mt-2 bg-red-100 text-red-800 px-3 py-1 rounded text-sm hover:bg-red-200 transition-colors"
            >
              Tornar a intentar
            </button>
          </div>
        )}

        {/* Contingut principal */}
        {projects.length === 0 ? (
          // Estat buit
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">Cap projecte encara</h3>
            <p className="mt-1 text-sm text-gray-500">
              Comença creant el teu primer projecte de generació d'informes.
            </p>
            <div className="mt-6">
              <Link
                href="/informes/nou"
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Crear Projecte
              </Link>
            </div>
          </div>
        ) : (
          // Llista de projectes
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-gray-900">
                Els meus projectes ({projects.length})
              </h2>
              <button
                onClick={loadProjects}
                className="text-blue-600 hover:text-blue-700 font-medium text-sm flex items-center"
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Actualitzar
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {projects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  onRefresh={loadProjects}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default InformesPage;

'use client'

import { useState, useEffect, useRef } from 'react'

interface Job {
  id: string
  generation_id: string
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
  progress: number
  total_placeholders: number
  completed_placeholders: number
  error_message?: string
  estimated_remaining?: string | null
  generation: {
    excel_row_index: number
    row_data: any
    generation_status: string
  }
}

interface JobsSummary {
  total_jobs: number
  completed_jobs: number
  failed_jobs: number
  processing_jobs: number
  pending_jobs: number
  overall_progress: number
  overall_status: string
}

interface AsyncJobProgressProps {
  projectId: string
  onAllJobsCompleted?: () => void
}

export default function AsyncJobProgress({ projectId, onAllJobsCompleted }: AsyncJobProgressProps) {
  const [jobs, setJobs] = useState<Job[]>([])
  const [summary, setSummary] = useState<JobsSummary | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hasNotifiedCompletion, setHasNotifiedCompletion] = useState(false)
  
  // Usar useRef per gestionar l'interval directament
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const isFinishedRef = useRef(false)

  // Funció per obtenir l'estat dels jobs amb retry logic
  const fetchJobsStatus = async (retryCount = 0) => {
    const maxRetries = 3;
    const retryDelay = Math.min(1000 * Math.pow(2, retryCount), 10000); // Exponential backoff, max 10s
    
    try {
      console.log(`[AsyncJobProgress] Fetching jobs status for project ${projectId} (attempt ${retryCount + 1})`);
      
      // Afegir timeout a la request
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 segons timeout
      
      const response = await fetch(`/api/reports/jobs-status?projectId=${projectId}`, {
        signal: controller.signal,
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'API returned success: false');
      }
      
      console.log(`[AsyncJobProgress] ✅ Jobs status fetched successfully`);
      setJobs(data.jobs);
      setSummary(data.summary);
      setError(null);
      
      // Si tots els jobs han acabat, aturar l'interval
      const isFinished = data.summary.overall_status === 'completed' || 
                        data.summary.overall_status === 'failed' ||
                        (data.summary.processing_jobs === 0 && data.summary.pending_jobs === 0);
      
      if (isFinished && !isFinishedRef.current) {
        console.log(`[AsyncJobProgress] Jobs finished with status: ${data.summary.overall_status}`);
        isFinishedRef.current = true;
        
        // Aturar l'interval immediatament
        if (intervalRef.current) {
          console.log(`[AsyncJobProgress] Clearing interval`);
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        
        // Només notificar una vegada quan es completen tots els jobs
        if (data.summary.overall_status === 'completed' && 
            onAllJobsCompleted && 
            !hasNotifiedCompletion) {
          console.log(`[AsyncJobProgress] Notifying completion callback`);
          setHasNotifiedCompletion(true);
          // Usar setTimeout per evitar que la notificació causi re-renderització immediata
          setTimeout(() => {
            onAllJobsCompleted();
          }, 100);
        }
      }
      
    } catch (err) {
      console.error(`[AsyncJobProgress] ❌ Error fetching jobs status (attempt ${retryCount + 1}):`, err);
      
      const errorMessage = err instanceof Error ? err.message : 'Error desconegut';
      
      // Si és un error 404 (projecte no trobat), no fer retry
      if (errorMessage.includes('404') || errorMessage.includes('no existeix')) {
        console.log(`[AsyncJobProgress] 🚫 Projecte no trobat, aturant retries`);
        setError(`Projecte amb ID "${projectId}" no trobat. Comprova que l'URL sigui correcta.`);
        
        // Aturar l'interval immediatament
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        isFinishedRef.current = true;
        return;
      }
      
      // Si és un error de xarxa i encara tenim retries disponibles
      if (retryCount < maxRetries && (
        errorMessage.includes('fetch') || 
        errorMessage.includes('network') || 
        errorMessage.includes('INTERNET_DISCONNECTED') ||
        errorMessage.includes('timeout') ||
        err instanceof TypeError
      )) {
        console.log(`[AsyncJobProgress] 🔄 Retrying in ${retryDelay}ms...`);
        setTimeout(() => {
          fetchJobsStatus(retryCount + 1);
        }, retryDelay);
        return;
      }
      
      // Si hem exhaurit els retries o és un error diferent
      setError(`${errorMessage} (després de ${retryCount + 1} intents)`);
    } finally {
      setIsLoading(false);
    }
  }

  // Configurar actualització automàtica
  useEffect(() => {
    console.log(`[AsyncJobProgress] Component mounted for project ${projectId}`);
    
    // Reset state quan canvia el projectId
    setHasNotifiedCompletion(false);
    setError(null);
    setIsLoading(true);
    isFinishedRef.current = false;
    
    // Netejar interval anterior si existeix
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    // Fetch inicial
    fetchJobsStatus();
    
    // Crear nou interval només si els jobs no han acabat
    if (!isFinishedRef.current) {
      intervalRef.current = setInterval(() => {
        if (!isFinishedRef.current) {
          fetchJobsStatus();
        }
      }, 2000);
    }
    
    // Cleanup function per evitar memory leaks
    return () => {
      console.log(`[AsyncJobProgress] Component unmounting for project ${projectId}`);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
  }, [projectId]) // Només re-executar si canvia el projectId

  // Funció per cancel·lar tots els jobs
  const cancelAllJobs = async () => {
    try {
      const response = await fetch(`/api/reports/jobs-status?projectId=${projectId}`, {
        method: 'DELETE'
      })
      
      const data = await response.json()
      if (!data.success) {
        throw new Error(data.error)
      }
      
      // Actualitzar estat immediatament
      await fetchJobsStatus()
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error cancel·lant jobs')
    }
  }

  // Funció per cancel·lar un job específic
  const cancelJob = async (jobId: string) => {
    try {
      const response = await fetch(`/api/reports/jobs-status?jobId=${jobId}`, {
        method: 'DELETE'
      })
      
      const data = await response.json()
      if (!data.success) {
        throw new Error(data.error)
      }
      
      // Actualitzar estat immediatament
      await fetchJobsStatus()
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error cancel·lant job')
    }
  }

  if (isLoading && !summary) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-2 bg-gray-200 rounded w-full mb-2"></div>
          <div className="h-2 bg-gray-200 rounded w-3/4"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">Error</h3>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  if (!summary) {
    return null
  }

  return (
    <div className="space-y-6">
      {/* Resum global */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">
            Progrés de la generació
          </h3>
          {(summary.processing_jobs > 0 || summary.pending_jobs > 0) && (
            <button
              onClick={cancelAllJobs}
              className="text-red-600 hover:text-red-700 text-sm font-medium"
            >
              Cancel·lar tots
            </button>
          )}
        </div>
        
        {/* Barra de progrés global */}
        <div className="mb-4">
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span>Progrés general</span>
            <span>{summary.overall_progress.toFixed(1)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className={`h-2 rounded-full transition-all duration-300 ${
                summary.overall_status === 'completed' ? 'bg-green-500' :
                summary.overall_status === 'failed' ? 'bg-red-500' :
                summary.overall_status === 'processing' ? 'bg-blue-500' :
                'bg-gray-400'
              }`}
              style={{ width: `${summary.overall_progress}%` }}
            ></div>
          </div>
        </div>

        {/* Estadístiques */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-gray-900">{summary.total_jobs}</div>
            <div className="text-sm text-gray-500">Total</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-green-600">{summary.completed_jobs}</div>
            <div className="text-sm text-gray-500">Completats</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-blue-600">{summary.processing_jobs}</div>
            <div className="text-sm text-gray-500">Processant</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-600">{summary.pending_jobs}</div>
            <div className="text-sm text-gray-500">Pendents</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-red-600">{summary.failed_jobs}</div>
            <div className="text-sm text-gray-500">Fallits</div>
          </div>
        </div>
      </div>

      {/* Llista de jobs */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h4 className="text-md font-medium text-gray-900">
            Detall per informe ({jobs.length} files)
          </h4>
        </div>
        
        <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
          {jobs.map((job) => (
            <div key={job.id} className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium text-gray-900">
                    Fila {job.generation.excel_row_index + 1}
                  </span>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    job.status === 'completed' ? 'bg-green-100 text-green-800' :
                    job.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                    job.status === 'failed' ? 'bg-red-100 text-red-800' :
                    job.status === 'cancelled' ? 'bg-gray-100 text-gray-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {job.status === 'completed' ? 'Completat' :
                     job.status === 'processing' ? 'Processant' :
                     job.status === 'failed' ? 'Fallit' :
                     job.status === 'cancelled' ? 'Cancel·lat' :
                     'Pendent'}
                  </span>
                </div>
                
                <div className="flex items-center space-x-2">
                  {job.estimated_remaining && (
                    <span className="text-xs text-gray-500">
                      {job.estimated_remaining}
                    </span>
                  )}
                  {(job.status === 'pending' || job.status === 'processing') && (
                    <button
                      onClick={() => cancelJob(job.id)}
                      className="text-xs text-red-600 hover:text-red-700"
                    >
                      Cancel·lar
                    </button>
                  )}
                </div>
              </div>
              
              {/* Progrés individual */}
              <div className="mb-2">
                <div className="flex justify-between text-xs text-gray-600 mb-1">
                  <span>{job.completed_placeholders}/{job.total_placeholders} seccions</span>
                  <span>{job.progress.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-1">
                  <div 
                    className={`h-1 rounded-full transition-all duration-300 ${
                      job.status === 'completed' ? 'bg-green-500' :
                      job.status === 'failed' ? 'bg-red-500' :
                      job.status === 'processing' ? 'bg-blue-500' :
                      'bg-gray-400'
                    }`}
                    style={{ width: `${job.progress}%` }}
                  ></div>
                </div>
              </div>
              
              {/* Error message */}
              {job.error_message && (
                <p className="text-xs text-red-600 mt-1">{job.error_message}</p>
              )}
              
              {/* Dades de la fila (mostra només alguns camps clau) */}
              {job.generation.row_data && Object.keys(job.generation.row_data).length > 0 && (
                <div className="text-xs text-gray-500 mt-2">
                  {Object.entries(job.generation.row_data)
                    .slice(0, 3)
                    .map(([key, value]) => (
                      <span key={key} className="mr-3">
                        <strong>{key}:</strong> {String(value).substring(0, 30)}
                        {String(value).length > 30 ? '...' : ''}
                      </span>
                    ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/**
 * API Endpoint: /api/debug/test-smart-system
 * 
 * Endpoint de test per verificar el nou sistema intel·ligent de generació de documents.
 * Permet provar totes les funcionalitats sense afectar dades reals.
 * 
 * Data: 6 de juliol de 2025
 * Arquitecte: Cline
 */

import { NextRequest, NextResponse } from 'next/server';
import { SmartDocumentProcessor } from '@/lib/smart/SmartDocumentProcessor';
import { BatchProcessingConfig } from '@/lib/smart/types';
import supabaseServerClient from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    console.log(`🧪 [SmartTest] Iniciant test del sistema intel·ligent...`);

    // 1. Test de configuració bàsica
    const configTest = await testBasicConfiguration();
    if (!configTest.success) {
      return NextResponse.json({
        success: false,
        error: 'Test de configuració fallit',
        details: configTest.error,
      }, { status: 500 });
    }

    // 2. Test de connexió a base de dades
    const dbTest = await testDatabaseConnection();
    if (!dbTest.success) {
      return NextResponse.json({
        success: false,
        error: 'Test de base de dades fallit',
        details: dbTest.error,
      }, { status: 500 });
    }

    // 3. Test de processador intel·ligent
    const processorTest = await testSmartProcessor();
    if (!processorTest.success) {
      return NextResponse.json({
        success: false,
        error: 'Test de processador fallit',
        details: processorTest.error,
      }, { status: 500 });
    }

    // 4. Test de validacions
    const validationTest = await testValidations();
    if (!validationTest.success) {
      return NextResponse.json({
        success: false,
        error: 'Test de validacions fallit',
        details: validationTest.error,
      }, { status: 500 });
    }

    const totalTime = Date.now() - startTime;

    console.log(`✅ [SmartTest] Tots els tests completats amb èxit en ${totalTime}ms`);

    return NextResponse.json({
      success: true,
      message: 'Sistema intel·ligent funcionant correctament',
      totalTestTimeMs: totalTime,
      tests: {
        configuration: configTest,
        database: dbTest,
        processor: processorTest,
        validation: validationTest,
      },
      systemInfo: {
        mistralApiConfigured: !!process.env.MISTRAL_API_KEY,
        supabaseConfigured: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        nodeVersion: process.version,
        timestamp: new Date().toISOString(),
      },
    });

  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`❌ [SmartTest] Error en tests:`, error);
    
    return NextResponse.json({
      success: false,
      error: 'Error executant tests del sistema',
      details: error instanceof Error ? error.message : 'Error desconegut',
      totalTestTimeMs: totalTime,
    }, { status: 500 });
  }
}

// ============================================================================
// TESTS INDIVIDUALS
// ============================================================================

/**
 * Test de configuració bàsica del sistema
 */
async function testBasicConfiguration(): Promise<{ success: boolean; error?: string; details?: any }> {
  try {
    console.log(`🔧 [SmartTest] Testejant configuració bàsica...`);

    // Verificar variables d'entorn crítiques
    const requiredEnvVars = [
      'MISTRAL_API_KEY',
      'NEXT_PUBLIC_SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY',
    ];

    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      return {
        success: false,
        error: `Variables d'entorn faltants: ${missingVars.join(', ')}`,
        details: { missingVars },
      };
    }

    // Verificar que les claus tenen format correcte
    const mistralKey = process.env.MISTRAL_API_KEY || '';
    if (!mistralKey.startsWith('sk-') && !mistralKey.includes('mistral')) {
      console.warn(`⚠️ [SmartTest] Clau Mistral pot no tenir format correcte`);
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    if (!supabaseUrl.includes('supabase.co')) {
      console.warn(`⚠️ [SmartTest] URL Supabase pot no tenir format correcte`);
    }

    return {
      success: true,
      details: {
        envVarsPresent: requiredEnvVars.length,
        mistralKeyLength: mistralKey.length,
        supabaseUrlValid: supabaseUrl.includes('supabase.co'),
      },
    };

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error en test de configuració',
    };
  }
}

/**
 * Test de connexió a base de dades
 */
async function testDatabaseConnection(): Promise<{ success: boolean; error?: string; details?: any }> {
  try {
    console.log(`🗄️ [SmartTest] Testejant connexió a base de dades...`);

    // Test de connexió bàsica
    const { data, error } = await supabaseServerClient
      .from('smart_generations')
      .select('count')
      .limit(1);

    if (error) {
      return {
        success: false,
        error: `Error connectant a smart_generations: ${error.message}`,
        details: { supabaseError: error },
      };
    }

    // Test de taula plantilla_configs
    const { data: templatesData, error: templatesError } = await supabaseServerClient
      .from('plantilla_configs')
      .select('id')
      .limit(1);

    if (templatesError) {
      return {
        success: false,
        error: `Error accedint a plantilla_configs: ${templatesError.message}`,
        details: { supabaseError: templatesError },
      };
    }

    return {
      success: true,
      details: {
        smartGenerationsAccessible: true,
        plantillaConfigsAccessible: true,
        templatesFound: templatesData?.length || 0,
      },
    };

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error en test de base de dades',
    };
  }
}

/**
 * Test del processador intel·ligent
 */
async function testSmartProcessor(): Promise<{ success: boolean; error?: string; details?: any }> {
  try {
    console.log(`🤖 [SmartTest] Testejant processador intel·ligent...`);

    // Crear instància del processador
    const processor = new SmartDocumentProcessor();

    // Test de validació de configuració
    const testConfig: BatchProcessingConfig = {
      templateId: 'test-template-id',
      templateContent: 'Test template with {PLACEHOLDER: test instruction}',
      templateStoragePath: 'test/path.docx',
      excelData: [
        { contractista: 'Test Company', obra: 'Test Project', import: 1000 },
      ],
      userId: 'test-user-id',
    };

    const validation = processor.validateConfig(testConfig);
    
    if (!validation.valid) {
      return {
        success: false,
        error: 'Validació de configuració fallida',
        details: { validationErrors: validation.errors },
      };
    }

    // Test d'extracció de placeholders (mètode privat, testem indirectament)
    const metrics = processor.getPerformanceMetrics();
    
    return {
      success: true,
      details: {
        processorInitialized: true,
        configValidationPassed: true,
        metricsAccessible: !!metrics,
        initialMetrics: metrics,
      },
    };

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error en test de processador',
    };
  }
}

/**
 * Test de validacions del sistema
 */
async function testValidations(): Promise<{ success: boolean; error?: string; details?: any }> {
  try {
    console.log(`✅ [SmartTest] Testejant validacions...`);

    const processor = new SmartDocumentProcessor();

    // Test 1: Configuració vàlida
    const validConfig: BatchProcessingConfig = {
      templateId: 'valid-id',
      templateContent: 'Valid template',
      templateStoragePath: 'valid/path.docx',
      excelData: [{ test: 'data' }],
      userId: 'valid-user',
    };

    const validResult = processor.validateConfig(validConfig);
    if (!validResult.valid) {
      return {
        success: false,
        error: 'Configuració vàlida rebutjada incorrectament',
        details: { errors: validResult.errors },
      };
    }

    // Test 2: Configuració invàlida (sense templateId)
    const invalidConfig = { ...validConfig, templateId: '' };
    const invalidResult = processor.validateConfig(invalidConfig);
    if (invalidResult.valid) {
      return {
        success: false,
        error: 'Configuració invàlida acceptada incorrectament',
      };
    }

    // Test 3: Excel data massa gran
    const largeDataConfig = {
      ...validConfig,
      excelData: new Array(1001).fill({ test: 'data' }), // Més del límit
    };
    const largeDataResult = processor.validateConfig(largeDataConfig);
    if (largeDataResult.valid) {
      return {
        success: false,
        error: 'Dades Excel massa grans acceptades incorrectament',
      };
    }

    return {
      success: true,
      details: {
        validConfigAccepted: validResult.valid,
        invalidConfigRejected: !invalidResult.valid,
        largeDataRejected: !largeDataResult.valid,
        validationErrorsCount: invalidResult.errors.length,
      },
    };

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error en test de validacions',
    };
  }
}

// ============================================================================
// ENDPOINT POST PER TESTS AVANÇATS
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { testType, testData } = body;

    console.log(`🧪 [SmartTest] Test avançat: ${testType}`);

    switch (testType) {
      case 'placeholder-extraction':
        return await testPlaceholderExtraction(testData);
      
      case 'mistral-connection':
        return await testMistralConnection(testData);
      
      case 'storage-access':
        return await testStorageAccess(testData);
      
      default:
        return NextResponse.json({
          success: false,
          error: `Tipus de test desconegut: ${testType}`,
          availableTests: ['placeholder-extraction', 'mistral-connection', 'storage-access'],
        }, { status: 400 });
    }

  } catch (error) {
    console.error(`❌ [SmartTest] Error en test POST:`, error);
    return NextResponse.json({
      success: false,
      error: 'Error executant test avançat',
      details: error instanceof Error ? error.message : 'Error desconegut',
    }, { status: 500 });
  }
}

/**
 * Test d'extracció de placeholders
 */
async function testPlaceholderExtraction(testData: any) {
  const templateContent = testData?.templateContent || 
    'Test {CONTRACTISTA: nom de l\'empresa contractista} per {OBRA: descripció de l\'obra}';

  // Simulem l'extracció de placeholders (lògica similar a SmartDocumentProcessor)
  const placeholderRegex = /\{([A-Z_]+):\s*([^}]+)\}/g;
  const placeholders = [];
  let match;

  while ((match = placeholderRegex.exec(templateContent)) !== null) {
    const [, id, instruction] = match;
    placeholders.push({ id: id.trim(), instruction: instruction.trim() });
  }

  return NextResponse.json({
    success: true,
    testType: 'placeholder-extraction',
    input: { templateContent },
    result: {
      placeholdersFound: placeholders.length,
      placeholders,
    },
  });
}

/**
 * Test de connexió a Mistral AI
 */
async function testMistralConnection(testData: any) {
  try {
    const apiKey = process.env.MISTRAL_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        success: false,
        error: 'MISTRAL_API_KEY no configurada',
      }, { status: 500 });
    }

    // Test simple de connexió (sense gastar tokens)
    const response = await fetch('https://api.mistral.ai/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    const isConnected = response.ok;
    
    return NextResponse.json({
      success: true,
      testType: 'mistral-connection',
      result: {
        connectionSuccessful: isConnected,
        httpStatus: response.status,
        apiKeyConfigured: true,
      },
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      testType: 'mistral-connection',
      error: error instanceof Error ? error.message : 'Error de connexió',
    }, { status: 500 });
  }
}

/**
 * Test d'accés a Storage
 */
async function testStorageAccess(testData: any) {
  try {
    // Test de llistat de buckets
    const { data: buckets, error } = await supabaseServerClient.storage.listBuckets();

    if (error) {
      return NextResponse.json({
        success: false,
        testType: 'storage-access',
        error: `Error accedint a storage: ${error.message}`,
      }, { status: 500 });
    }

    const documentsBucket = buckets?.find(b => b.name === 'documents');
    const templateBucket = buckets?.find(b => b.name === 'template-docx');

    return NextResponse.json({
      success: true,
      testType: 'storage-access',
      result: {
        bucketsAccessible: true,
        totalBuckets: buckets?.length || 0,
        documentsBucketExists: !!documentsBucket,
        templateBucketExists: !!templateBucket,
        buckets: buckets?.map(b => ({ name: b.name, public: b.public })) || [],
      },
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      testType: 'storage-access',
      error: error instanceof Error ? error.message : 'Error accedint a storage',
    }, { status: 500 });
  }
}

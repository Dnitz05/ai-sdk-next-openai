import { NextResponse } from 'next/server';
import CloudConvert from 'cloudconvert';
import { Readable } from 'stream';

// Carreguem la clau API des de les variables d'entorn
const cloudConvertApiKey = process.env.CLOUDCONVERT_API_KEY;

if (!cloudConvertApiKey) {
    console.error('❌ CLOUDCONVERT_API_KEY no està configurada');
}

const cloudConvert = new CloudConvert(cloudConvertApiKey || 'dummy'); // 'dummy' si no hi ha clau per evitar error inicialització

export const maxDuration = 120; // Augmentem el temps per esperar l'API externa
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    if (!cloudConvertApiKey) {
        return NextResponse.json({ error: 'Configuració del servidor incorrecta (falta API Key)' }, { status: 500 });
    }

    try {
        console.log('📥 Rebent formulari...');
        const formData = await req.formData();
        const file = formData.get('file') as File | null;

        if (!file) {
            console.warn('⚠️ Cap fitxer rebut');
            return NextResponse.json({ error: 'No s’ha trobat cap fitxer' }, { status: 400 });
        }
        console.log(`📄 Fitxer rebut: ${file.name}, mida: ${file.size}`);

        // Convertim el File a un Stream llegible per a la llibreria CloudConvert
        const fileBuffer = Buffer.from(await file.arrayBuffer());
        const readableStream = Readable.from(fileBuffer);

        console.log('☁️ Iniciant job a CloudConvert...');
        let job = await cloudConvert.jobs.create({
            tasks: {
                'import-pdf': {
                    operation: 'import/upload',
                },
                'convert-to-png': {
                    operation: 'convert',
                    input: 'import-pdf',
                    output_format: 'png',
                    engine: 'poppler', // Motor de renderitzat
                    pixel_density: 150, // Qualitat/resolució de la imatge
                    pages: 'all',      // Convertim totes les pàgines
                },
                'export-pngs': {
                    operation: 'export/url',
                    input: 'convert-to-png',
                    inline: false,
                    archive_multiple_files: false, // Volem URLs individuals per pàgina
                },
            },
            tag: 'pdf-to-png-conversion',
        });
        console.log(`☁️ Job creat amb ID: ${job.id}`);

        // Pugem el fitxer a la tasca d'importació
        const uploadTask = job.tasks?.find(task => task.name === 'import-pdf');
        if (!uploadTask || !uploadTask.result || !uploadTask.result.form) {
           throw new Error('No s\'ha pogut obtenir la tasca d\'upload de CloudConvert');
        }
         await cloudConvert.tasks.upload(uploadTask, readableStream as any, file.name);
        console.log(`☁️ Fitxer ${file.name} pujat a CloudConvert`);

        // Esperem que el Job acabi
        console.log(`⏳ Esperant que el job ${job.id} acabi...`);
        job = await cloudConvert.jobs.wait(job.id);
        console.log(`✅ Job ${job.id} acabat amb estat: ${job.status}`);

        if (job.status === 'error') {
            const errorMessages = job.tasks?.map(task => task.message).filter(Boolean).join('; ');
            throw new Error(`Error a CloudConvert: ${errorMessages || 'Detalls no disponibles'}`);
        }

        // Obtenim els resultats de la tasca d'exportació
        const exportTask = job.tasks?.find(task => task.name === 'export-pngs');
        if (!exportTask || !exportTask.result || !exportTask.result.files || exportTask.result.files.length === 0) {
            throw new Error('No s\'han trobat fitxers exportats a CloudConvert');
        }

        // Extreiem les URLs de les imatges PNG generades
        const pages = exportTask.result.files.map((file: any) => file.url);
        console.log(`🖼️ URLs obtingudes: ${pages.length}`);

        return NextResponse.json({ pages });

    } catch (err: any) {
        console.error('❌ Error interactuant amb CloudConvert:', err);
        // Podem ser més específics amb l'error si volem
        const errorMessage = err.response?.data?.message || err.message || 'Error desconegut';
        return NextResponse.json({ error: `Error intern del servidor: ${errorMessage}` }, { status: 500 });
    }
}

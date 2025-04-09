import { NextResponse } from 'next/server';
import CloudConvert from 'cloudconvert';
import { Readable } from 'stream';
// Importem 'put' de Vercel Blob per guardar fitxers
import { put } from '@vercel/blob';

// Carreguem la clau de CloudConvert (si existeix)
const cloudConvertApiKey = process.env.CLOUDCONVERT_API_KEY;
const cloudConvert = cloudConvertApiKey ? new CloudConvert(cloudConvertApiKey) : null;

// Ajustem maxDuration. NOTA: Si estàs al pla Hobby, el màxim és 60.
// Amb Pro pots posar més temps si la pujada a Blob + CloudConvert triga.
export const maxDuration = 90; // Ex: 90 segons (requereix pla Pro)
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    console.log("Iniciant /api/upload-pdf...");

    try {
        const formData = await req.formData();
        const file = formData.get('file') as File | null;

        // Validació bàsica del fitxer
        if (!file || file.type !== 'application/pdf') {
            console.warn("No s'ha rebut un fitxer PDF vàlid.");
            return NextResponse.json({ error: 'No s’ha trobat cap fitxer PDF vàlid' }, { status: 400 });
        }
        console.log(`Fitxer PDF rebut: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);

        // Llegim el contingut del fitxer com a Buffer
        const pdfBuffer = Buffer.from(await file.arrayBuffer());

        // Definim un nom únic per al fitxer PDF a Vercel Blob
        // Usem una ruta 'uploads/pdfs/' per organitzar
        const safeFileName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_'); // Només caràcters segurs
        const pdfFileName = `uploads/pdfs/${Date.now()}-${safeFileName}`;

        // --- PAS CLAU: Guardar el PDF original a Vercel Blob ---
        console.log(`☁️ Pujant PDF original a Vercel Blob com: ${pdfFileName}`);
        const blobPdf = await put(pdfFileName, pdfBuffer, {
             access: 'public', // Important perquè Google Document AI pugui accedir-hi? O millor privat i llegir buffer? Provem public de moment.
             contentType: 'application/pdf',
             // Podem afegir cache si volem que el navegador no el recarregui tant
             cacheControlMaxAge: 60 * 60 // 1 hora de cache
            });
        console.log(`✅ PDF original pujat amb èxit a: ${blobPdf.url}`);
        const pdfUrl = blobPdf.url; // Aquesta és la URL que necessitem per a Google Document AI
        // --------------------------------------------------------

        // --- (Opcional) Generar Miniatures amb CloudConvert ---
        let imagePages: string[] = [];
        if (cloudConvert) { // Només si tenim la clau API de CloudConvert
             console.log('☁️ Iniciant job a CloudConvert per a miniatures...');
            try {
                const readableStream = Readable.from(pdfBuffer); // Creem stream des del buffer un altre cop
                let job = await cloudConvert.jobs.create({
                    tasks: {
                        'import-pdf': { operation: 'import/upload' },
                        'convert-to-png': {
                            operation: 'convert', input: 'import-pdf', output_format: 'png',
                            engine: 'poppler', pixel_density: 96, // Densitat baixa per miniatures
                            pages: '1-5' // Limitem a 5 pàgines per rapidesa/cost
                        },
                        'export-pngs': { operation: 'export/url', input: 'convert-to-png', inline: false, archive_multiple_files: false }
                    }, tag: 'pdf-thumbnails'
                });
                const uploadTask = job.tasks?.find(task => task.name === 'import-pdf');
                if (uploadTask?.result?.form) {
                    await cloudConvert.tasks.upload(uploadTask, readableStream, file.name); // Ja no cal 'as any' aquí amb stream
                    console.log(`☁️ Fitxer ${file.name} pujat a CloudConvert.`);
                    job = await cloudConvert.jobs.wait(job.id); // <-- Només amb un argument

                    if (job.status === 'finished') {
                        const exportTask = job.tasks?.find(task => task.name === 'export-pngs');
                        imagePages = exportTask?.result?.files?.map((f: any) => f.url) ?? [];
                        console.log(`🖼️ URLs de miniatures obtingudes: ${imagePages.length}`);
                    } else { console.warn(`⚠️ Job CloudConvert ${job.id} no finalitzat: ${job.status}`); }
                } else { console.warn('⚠️ No s\'ha pogut iniciar la pujada a CloudConvert (uploadTask).'); }
            } catch(ccError: any) {
                console.error("❌ Error durant la generació de miniatures amb CloudConvert:", ccError.message || ccError);
                // Continuem igualment, les miniatures són opcionals
            }
        } else {
            console.warn("⚠️ CloudConvert API Key no configurada, saltant generació de miniatures.");
        }
        // ----------------------------------------------------

        // Retornem la URL del PDF original (MOLT IMPORTANT)
        // i les URLs de les miniatures (si s'han generat)
        return NextResponse.json({ pages: imagePages, pdfUrl: pdfUrl });

    } catch (err: any) {
        console.error('❌ Error general a /api/upload-pdf:', err);
        const errorMessage = err.message || 'Error desconegut durant la pujada i processament inicial';
        return NextResponse.json({ error: `Error intern del servidor: ${errorMessage}` }, { status: 500 });
    }
}

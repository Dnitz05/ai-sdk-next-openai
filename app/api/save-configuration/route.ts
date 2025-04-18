puja       }
        return NextResponse.json({
            error: 'Error intern del servidor al processar la petició',
            details: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
    }
}

// Handler per a les peticions GET (Placeholder)
export async function GET(request: NextRequest) {
    console.log("API Route /api/save-configuration: Petició GET rebuda.");
    try {
        console.log("API Route /api/save-configuration (GET): Lògica pendent...");
        // Aquí podríem fer: const { data, error } = await supabaseServerClient.from('plantilla_configs').select('*');
        return NextResponse.json({ message: "Endpoint GET pendent d'implementar" }, { status: 200 });
    } catch (error) { /* ... gestió errors ... */ }
}
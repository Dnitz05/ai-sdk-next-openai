import React, { useState, useEffect, useRef, ChangeEvent } from 'react';
import * as XLSX from 'xlsx';

const TemplateEditor: React.FC<{ initialTemplateData: any; mode: 'edit' | 'new' }> = ({ initialTemplateData, mode }) => {
  // ... [tots els estats i handlers ja declarats, com a la versió funcional]

  // Extract nom plantilla
  const templateTitle = initialTemplateData?.config_name || '';

  return (
    <main className="flex min-h-screen w-full flex-col items-center p-4 sm:p-8 bg-gray-100">
      {/* Capçalera: nom de la plantilla alineat a l'esquerra */}
      <div className="w-full max-w-4xl mx-auto flex items-center mb-4 sm:mb-6 px-1">
        <h1 className="text-2xl font-bold text-gray-800">{templateTitle}</h1>
      </div>
      {/* ... resta de l'editor enriquit ... */}
    </main>
  );
};

export default TemplateEditor;
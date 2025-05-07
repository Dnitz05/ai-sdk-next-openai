'use client';

import React, { useState } from 'react';
import TemplateEditor from '@/components/TemplateEditor';

export default function DemoPromptSidebar() {
  // Sample template data with some HTML content
  const sampleTemplateData = {
    config_name: 'Demo de Barra Lateral de Prompts IA',
    base_docx_name: 'demo.docx',
    excel_file_name: '',
    excel_headers: [],
    final_html: `
      <h1>Demostració de la Nova Barra Lateral de Prompts IA</h1>
      
      <p>Aquest és un exemple de com funciona la nova barra lateral de prompts d'IA. Fes clic en qualsevol paràgraf per afegir o editar un prompt d'IA.</p>
      
      <h2>Característiques Principals</h2>
      
      <p>La nova barra lateral ofereix una experiència d'usuari millorada amb les següents característiques:</p>
      
      <ul>
        <li><p>Els prompts es mostren en una barra lateral dedicada a l'esquerra del document.</p></li>
        <li><p>Els prompts s'ordenen segons la posició dels paràgrafs al document.</p></li>
        <li><p>Es poden expandir o col·lapsar per gestionar millor l'espai.</p></li>
        <li><p>Cada prompt té controls per editar, desar i eliminar.</p></li>
        <li><p>Els prompts es relacionen visualment amb els seus paràgrafs corresponents.</p></li>
        <li><p>No hi ha superposició de prompts, fins i tot quan els paràgrafs estan molt a prop.</p></li>
      </ul>
      
      <h2>Com Utilitzar-ho</h2>
      
      <p>Per afegir un nou prompt, simplement fes clic en un paràgraf. S'obrirà un editor a la barra lateral on podràs escriure el teu prompt.</p>
      
      <p>Per editar un prompt existent, fes clic al botó d'edició a la targeta del prompt a la barra lateral.</p>
      
      <p>Per desar un prompt, fes clic al botó "Desar" després d'editar-lo.</p>
      
      <p>Per eliminar un prompt, fes clic al botó d'eliminació a la targeta del prompt.</p>
      
      <h2>Exemple de Paràgrafs amb Prompts</h2>
      
      <p>Aquest és un exemple de paràgraf que podria tenir un prompt associat. Prova de fer-hi clic per afegir un prompt.</p>
      
      <p>Aquest és un altre paràgraf d'exemple. Pots afegir prompts diferents a cada paràgraf.</p>
      
      <p>Els prompts poden ser instruccions per a models d'IA sobre com processar o transformar el text del paràgraf.</p>
      
      <p>Per exemple, podries afegir un prompt com "Resumeix aquest paràgraf en tres punts clau" o "Tradueix aquest text a l'anglès".</p>
      
      <h2>Avantatges del Nou Sistema</h2>
      
      <p>El nou sistema de barra lateral ofereix diversos avantatges respecte al sistema anterior:</p>
      
      <ol>
        <li><p>Millor organització: Els prompts es mostren en una àrea dedicada, sense superposar-se amb el contingut del document.</p></li>
        <li><p>Major claredat: La relació entre prompts i paràgrafs és més clara i visual.</p></li>
        <li><p>Més espai: Els prompts poden ser més llargs sense problemes d'espai.</p></li>
        <li><p>Millor gestió: És més fàcil veure, editar i gestionar tots els prompts del document.</p></li>
        <li><p>Experiència més intuïtiva: La interfície és més coherent amb les expectatives dels usuaris.</p></li>
      </ol>
      
      <p>Prova d'afegir prompts a diferents paràgrafs i observa com es mostren a la barra lateral!</p>
    `,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto py-8">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Demo: Nova Barra Lateral de Prompts IA</h1>
          <p className="text-gray-600">
            Aquesta demo mostra la nova implementació de la barra lateral per a prompts d'IA, 
            que soluciona els problemes de superposició i millora la usabilitat.
          </p>
        </div>
        
        <TemplateEditor 
          initialTemplateData={sampleTemplateData} 
          mode="new" 
        />
      </div>
    </div>
  );
}

return (
  <main className="flex min-h-screen w-full flex-col items-center p-4 sm:p-8 bg-gray-100">
    {/* Capçalera */}
    <div className="w-full max-w-4xl mx-auto flex items-center mb-4 sm:mb-6 px-1">
      <h1 className="text-2xl font-bold text-gray-800">{templateTitle}</h1>
    </div>
    <div className="flex w-full max-w-6xl gap-x-6 px-1" style={{ position: 'relative' }}>
      {/* Botons d'edició fora del foli blanc */}
      {editingParagraphId && (
        <div style={{
          position: 'absolute',
          left: '-180px',
          top: '30%',
          zIndex: 20,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end'
        }}>
          <InlineParagraphEditor
            containerId={`react-edit-p-${editingParagraphId}`}
            value={editingPrompt}
            onChange={setEditingPrompt}
            onSave={() => {
              if (contentRef.current) {
                const html = contentRef.current.innerHTML.replace(
                  `<div id="react-edit-p-${editingParagraphId}"></div>`,
                  `<p data-paragraph-id="${editingParagraphId}">${editingPrompt}</p>`
                );
                setConvertedHtml(html);
              }
              setEditingParagraphId(null);
              setEditingPrompt('');
            }}
            onCancel={() => {
              if (contentRef.current) {
                const html = contentRef.current.innerHTML.replace(
                  `<div id="react-edit-p-${editingParagraphId}"></div>`,
                  `<p data-paragraph-id="${editingParagraphId}">${editingPrompt}</p>`
                );
                setConvertedHtml(html);
              }
              setEditingParagraphId(null);
              setEditingPrompt('');
            }}
          />
        </div>
      )}
      {/* Foli blanc */}
      <div className="flex-grow print-content bg-white shadow-lg rounded-sm p-8 md:p-12 lg:p-16 my-0">
        {convertedHtml ? (
          <div
            ref={contentRef}
            className={`prose max-w-5xl mx-auto bg-white p-4 rounded${iaInstructionsMode ? ' ia-mode-actiu' : ''}`}
            dangerouslySetInnerHTML={{
              __html: editingParagraphId
                ? convertedHtml.replace(
                    new RegExp(
                      `<p([^>]*data-paragraph-id=["']${editingParagraphId}["'][^>]*)>([\\s\\S]*?)<\\/p>`,
                      'i'
                    ),
                    `<div id="react-edit-p-${editingParagraphId}"></div>`
                  )
                : convertedHtml,
            }}
            onMouseUp={handleTextSelection}
            onClick={iaInstructionsMode ? handleContentClick : undefined}
            style={{ cursor: iaInstructionsMode ? 'pointer' : 'auto' }}
          />
        ) : (
          <p className="text-gray-400 italic text-center py-10">
            Carrega un DOCX per començar.
          </p>
        )}
      </div>
      {/* Sidebar */}
      <aside className="w-80 flex-shrink-0 my-0 relative">
        {/* ...la resta de la sidebar... */}
      </aside>
    </div>
  </main>
);
import React from 'react';
import { calculatePromptPositions, findParagraphElement, createPromptForParagraph, generatePromptId } from '../PromptPositionUtils';
import { IAPrompt } from '../PromptSidebar';

describe('PromptPositionUtils', () => {
  let documentRef: React.RefObject<HTMLDivElement>;
  let wrapperRef: React.RefObject<HTMLDivElement>;

  beforeEach(() => {
    const docDiv = document.createElement('div');
    const wrapperDiv = document.createElement('div');
    wrapperDiv.getBoundingClientRect = () => ({ top: 0, height: 500 } as DOMRect);
    docDiv.getBoundingClientRect = () => ({ top: 0, height: 500 } as DOMRect);

    const p1 = document.createElement('p');
    p1.dataset.paragraphId = 'p1';
    p1.getBoundingClientRect = () => ({ top: 50, height: 20 } as DOMRect);

    const p2 = document.createElement('p');
    p2.dataset.paragraphId = 'p2';
    p2.getBoundingClientRect = () => ({ top: 100, height: 20 } as DOMRect);

    docDiv.append(p1, p2);

    documentRef = { current: docDiv };
    wrapperRef = { current: wrapperDiv };
  });

  test('calculatePromptPositions calculates and adjusts positions correctly', () => {
    const initialPrompts: IAPrompt[] = [
      { id: 'p1', paragraphId: 'p1', content: '', status: 'draft', createdAt: new Date(), updatedAt: new Date(), position: 0, isExpanded: true, useExistingText: false },
      { id: 'p2', paragraphId: 'p2', content: '', status: 'draft', createdAt: new Date(), updatedAt: new Date(), position: 0, isExpanded: true, useExistingText: false },
    ];
    const result = calculatePromptPositions(initialPrompts, documentRef, wrapperRef);
    expect(result[0].position).toBe(60);
    expect(result[1].position).toBe(170);
  });

  test('findParagraphElement returns correct element', () => {
    const element = findParagraphElement('p1', documentRef);
    expect(element).not.toBeNull();
    expect(element?.dataset.paragraphId).toBe('p1');
  });

  test('createPromptForParagraph creates prompt with correct initial position', () => {
    const prompt = createPromptForParagraph('p1', 'text', documentRef, wrapperRef);
    expect(prompt.paragraphId).toBe('p1');
    expect(prompt.content).toBe('');
    expect(prompt.position).toBe(60);
    expect(prompt.isExpanded).toBe(true);
    expect(prompt.status).toBe('draft');
  });

  test('generatePromptId returns unique id string', () => {
    const id1 = generatePromptId();
    const id2 = generatePromptId();
    expect(typeof id1).toBe('string');
    expect(id1).toMatch(/^prompt-/);
    expect(id1).not.toBe(id2);
  });
});

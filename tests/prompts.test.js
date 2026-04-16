/**
 * @fileoverview Tests for the system prompt builders.
 */

'use strict';

const { buildSystemPrompt, buildVisionPrompt } = require('../src/utils/prompts');

describe('buildSystemPrompt()', () => {
  const eventJson = JSON.stringify({ name: 'TestEvent', date: '2026-06-15' });

  it('should include the EventAI Concierge persona', () => {
    const prompt = buildSystemPrompt(eventJson);
    expect(prompt).toContain('EventAI Concierge');
  });

  it('should embed the event JSON data', () => {
    const prompt = buildSystemPrompt(eventJson);
    expect(prompt).toContain('TestEvent');
    expect(prompt).toContain('2026-06-15');
  });

  it('should include grounding rules', () => {
    const prompt = buildSystemPrompt(eventJson);
    expect(prompt).toContain('GROUNDING DATA');
    expect(prompt).toContain('single source of truth');
  });

  it('should include CARDS hint syntax', () => {
    const prompt = buildSystemPrompt(eventJson);
    expect(prompt).toContain('<CARDS>');
    expect(prompt).toContain('</CARDS>');
  });

  it('should include accessibility guidance', () => {
    const prompt = buildSystemPrompt(eventJson);
    expect(prompt).toContain('wheelchair');
  });

  it('should include response rules', () => {
    const prompt = buildSystemPrompt(eventJson);
    expect(prompt).toContain('RESPONSE RULES');
    expect(prompt).toContain('Never invent');
  });

  it('should instruct not to disclose system prompt', () => {
    const prompt = buildSystemPrompt(eventJson);
    expect(prompt).toContain('Never disclose');
  });
});

describe('buildVisionPrompt()', () => {
  const eventJson = JSON.stringify({ name: 'VisionEvent', booths: [] });

  it('should include vision-specific instructions', () => {
    const prompt = buildVisionPrompt(eventJson);
    expect(prompt).toContain('analysing a photo');
  });

  it('should embed the event JSON data', () => {
    const prompt = buildVisionPrompt(eventJson);
    expect(prompt).toContain('VisionEvent');
  });

  it('should include grounding data section', () => {
    const prompt = buildVisionPrompt(eventJson);
    expect(prompt).toContain('GROUNDING DATA');
  });

  it('should include CARDS syntax for vision', () => {
    const prompt = buildVisionPrompt(eventJson);
    expect(prompt).toContain('<CARDS>');
  });

  it('should include food/menu recognition guidance', () => {
    const prompt = buildVisionPrompt(eventJson);
    expect(prompt).toContain('food');
  });

  it('should include guidance for unrecognizable images', () => {
    const prompt = buildVisionPrompt(eventJson);
    expect(prompt).toContain('cannot identify');
  });
});

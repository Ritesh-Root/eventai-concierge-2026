/**
 * @fileoverview Unit tests for the Gemini AI service.
 * Tests all three capabilities: text chat, streaming, and vision.
 * Uses mock SDK to verify prompt injection, retry logic, and error handling.
 */

'use strict';

// Mock the @google/generative-ai SDK
const mockGenerateContent = jest.fn();
const mockGenerateContentStream = jest.fn();
const mockGetGenerativeModel = jest.fn().mockReturnValue({
  generateContent: mockGenerateContent,
  generateContentStream: mockGenerateContentStream,
});

jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: mockGetGenerativeModel,
  })),
}));

describe('Gemini Service', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    process.env = { ...originalEnv, GEMINI_API_KEY: 'test-api-key-123' };

    // Re-mock after resetModules
    jest.mock('@google/generative-ai', () => ({
      GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
        getGenerativeModel: mockGetGenerativeModel,
      })),
    }));

    mockGenerateContent.mockResolvedValue({
      response: {
        text: () => 'The keynote is at 09:00 in Grand Hall A.',
      },
    });
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  // ── askGemini ──────────────────────────────────────────────────────

  describe('askGemini()', () => {
    it('should call Gemini with the correct model name', async () => {
      const { askGemini, MODEL_NAME } = require('../src/services/gemini');
      await askGemini('Where is the keynote?');
      expect(mockGetGenerativeModel).toHaveBeenCalledWith(
        expect.objectContaining({ model: MODEL_NAME })
      );
      expect(MODEL_NAME).toBe('gemini-2.5-flash-lite');
    });

    it('should include system instruction with event data', async () => {
      const { askGemini } = require('../src/services/gemini');
      await askGemini('Hello');
      expect(mockGetGenerativeModel).toHaveBeenCalledWith(
        expect.objectContaining({
          systemInstruction: expect.stringContaining('EventAI Concierge'),
        })
      );
      const callArgs = mockGetGenerativeModel.mock.calls[0][0];
      expect(callArgs.systemInstruction).toContain('InnovateSphere 2026');
    });

    it('should pass user message to generateContent', async () => {
      const { askGemini } = require('../src/services/gemini');
      await askGemini('What sessions are about AI?');
      expect(mockGenerateContent).toHaveBeenCalledWith('What sessions are about AI?');
    });

    it('should return trimmed text from the response', async () => {
      const { askGemini } = require('../src/services/gemini');
      const reply = await askGemini('Hello');
      expect(reply).toBe('The keynote is at 09:00 in Grand Hall A.');
    });

    it('should use custom event context when provided', async () => {
      const { askGemini } = require('../src/services/gemini');
      const customEvent = { name: 'CustomCon', date: '2026-12-01' };
      await askGemini('Tell me about this event', customEvent);
      const callArgs = mockGetGenerativeModel.mock.calls[0][0];
      expect(callArgs.systemInstruction).toContain('CustomCon');
    });

    it('should return fallback message when response is empty', async () => {
      mockGenerateContent.mockResolvedValue({
        response: { text: () => '' },
      });
      const { askGemini } = require('../src/services/gemini');
      const reply = await askGemini('Something weird');
      expect(reply).toMatch(/could not generate/i);
    });

    it('should throw when GEMINI_API_KEY is missing', async () => {
      delete process.env.GEMINI_API_KEY;
      jest.resetModules();
      jest.mock('@google/generative-ai', () => ({
        GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
          getGenerativeModel: mockGetGenerativeModel,
        })),
      }));
      const { askGemini } = require('../src/services/gemini');
      await expect(askGemini('Hello')).rejects.toThrow(/GEMINI_API_KEY/);
    });

    it('should handle API errors with user-friendly messages', async () => {
      mockGenerateContent.mockRejectedValue(new Error('Network timeout'));
      const { askGemini } = require('../src/services/gemini');
      await expect(askGemini('Hello')).rejects.toThrow(/Failed to get a response/);
    });

    it('should handle rate limit errors specifically', async () => {
      const rateLimitError = new Error('RATE_LIMIT exceeded');
      rateLimitError.status = 429;
      mockGenerateContent.mockRejectedValue(rateLimitError);
      const { askGemini } = require('../src/services/gemini');
      await expect(askGemini('Hello')).rejects.toThrow(/busy|rate.?limit/i);
    });

    it('should handle auth errors with AuthError', async () => {
      const authErr = new Error('api_key_invalid');
      authErr.status = 401;
      mockGenerateContent.mockRejectedValue(authErr);
      const { askGemini } = require('../src/services/gemini');
      await expect(askGemini('Hello')).rejects.toThrow(/API key|unavailable/i);
    });

    it('should include generationConfig with temperature and maxOutputTokens', async () => {
      const { askGemini } = require('../src/services/gemini');
      await askGemini('Hello');
      const callArgs = mockGetGenerativeModel.mock.calls[0][0];
      expect(callArgs.generationConfig).toBeDefined();
      expect(callArgs.generationConfig.temperature).toBe(0.7);
      expect(callArgs.generationConfig.maxOutputTokens).toBe(1024);
    });
  });

  // ── streamGemini ───────────────────────────────────────────────────

  describe('streamGemini()', () => {
    it('should yield text chunks from the stream', async () => {
      const mockStream = (async function* () {
        yield { text: () => 'Hello ' };
        yield { text: () => 'world!' };
      })();
      mockGenerateContentStream.mockResolvedValue({ stream: mockStream });

      const { streamGemini } = require('../src/services/gemini');
      const chunks = [];
      for await (const chunk of streamGemini('Hi')) {
        chunks.push(chunk);
      }
      expect(chunks).toEqual(['Hello ', 'world!']);
    });

    it('should skip null/empty text chunks', async () => {
      const mockStream = (async function* () {
        yield { text: () => 'valid' };
        yield { text: () => '' };
        yield { text: () => null };
        yield { text: () => 'also valid' };
      })();
      mockGenerateContentStream.mockResolvedValue({ stream: mockStream });

      const { streamGemini } = require('../src/services/gemini');
      const chunks = [];
      for await (const chunk of streamGemini('Hi')) {
        chunks.push(chunk);
      }
      expect(chunks).toEqual(['valid', 'also valid']);
    });

    it('should throw on stream error', async () => {
      mockGenerateContentStream.mockRejectedValue(new Error('Stream failed'));

      const { streamGemini } = require('../src/services/gemini');
      const chunks = [];
      await expect(async () => {
        for await (const chunk of streamGemini('Hi')) {
          chunks.push(chunk);
        }
      }).rejects.toThrow();
    });

    it('should use correct model name for streaming', async () => {
      const mockStream = (async function* () {
        yield { text: () => 'test' };
      })();
      mockGenerateContentStream.mockResolvedValue({ stream: mockStream });

      const { streamGemini, MODEL_NAME } = require('../src/services/gemini');
      const chunks = [];
      for await (const chunk of streamGemini('Hi')) {
        chunks.push(chunk);
      }
      expect(mockGetGenerativeModel).toHaveBeenCalledWith(
        expect.objectContaining({ model: MODEL_NAME })
      );
    });
  });

  // ── askGeminiVision ────────────────────────────────────────────────

  describe('askGeminiVision()', () => {
    beforeEach(() => {
      mockGenerateContent.mockResolvedValue({
        response: { text: () => 'This looks like the Figma booth.' },
      });
    });

    it('should call Gemini with image data and prompt', async () => {
      const { askGeminiVision, VISION_MODEL } = require('../src/services/gemini');
      const imageData = { data: 'base64data', mimeType: 'image/png' };
      const reply = await askGeminiVision(imageData, 'What is this?');
      expect(reply).toBe('This looks like the Figma booth.');
      expect(mockGetGenerativeModel).toHaveBeenCalledWith(
        expect.objectContaining({ model: VISION_MODEL })
      );
      expect(VISION_MODEL).toBe('gemini-2.5-flash');
    });

    it('should use default prompt when none provided', async () => {
      const { askGeminiVision } = require('../src/services/gemini');
      const imageData = { data: 'base64data', mimeType: 'image/jpeg' };
      await askGeminiVision(imageData, '');
      const callArgs = mockGenerateContent.mock.calls[0][0];
      const textPart = callArgs.contents[0].parts.find((p) => p.text);
      expect(textPart.text).toContain('What is in this image');
    });

    it('should include inlineData part with mimeType', async () => {
      const { askGeminiVision } = require('../src/services/gemini');
      const imageData = { data: 'abc123', mimeType: 'image/webp' };
      await askGeminiVision(imageData, 'Identify this');
      const callArgs = mockGenerateContent.mock.calls[0][0];
      const imagePart = callArgs.contents[0].parts.find((p) => p.inlineData);
      expect(imagePart.inlineData.data).toBe('abc123');
      expect(imagePart.inlineData.mimeType).toBe('image/webp');
    });

    it('should throw on missing image data', async () => {
      const { askGeminiVision } = require('../src/services/gemini');
      await expect(askGeminiVision(null, 'test')).rejects.toThrow(/required/i);
    });

    it('should throw on missing mimeType', async () => {
      const { askGeminiVision } = require('../src/services/gemini');
      await expect(
        askGeminiVision({ data: 'abc' }, 'test')
      ).rejects.toThrow(/required/i);
    });

    it('should return fallback on empty vision response', async () => {
      mockGenerateContent.mockResolvedValue({
        response: { text: () => '' },
      });
      const { askGeminiVision } = require('../src/services/gemini');
      const reply = await askGeminiVision(
        { data: 'x', mimeType: 'image/png' },
        'Hi'
      );
      expect(reply).toMatch(/couldn.*read/i);
    });

    it('should use custom event context for vision', async () => {
      const { askGeminiVision } = require('../src/services/gemini');
      const customEvent = { name: 'VisionCon', date: '2026-12-01' };
      await askGeminiVision(
        { data: 'x', mimeType: 'image/png' },
        'test',
        customEvent
      );
      const callArgs = mockGetGenerativeModel.mock.calls[0][0];
      expect(callArgs.systemInstruction).toContain('VisionCon');
    });

    it('should use the vision system prompt (not text prompt)', async () => {
      const { askGeminiVision } = require('../src/services/gemini');
      await askGeminiVision(
        { data: 'x', mimeType: 'image/png' },
        'test'
      );
      const callArgs = mockGetGenerativeModel.mock.calls[0][0];
      expect(callArgs.systemInstruction).toContain('analysing a photo');
    });
  });
});

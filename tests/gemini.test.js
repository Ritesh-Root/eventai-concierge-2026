/**
 * @fileoverview Unit tests for the Gemini AI service.
 */

// Mock the @google/generative-ai SDK
const mockGenerateContent = jest.fn();
const mockGetGenerativeModel = jest.fn().mockReturnValue({
  generateContent: mockGenerateContent,
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
    // Reset module registry to re-require with fresh env
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

  it('should call Gemini with the correct model name', async () => {
    const { askGemini, MODEL_NAME } = require('../src/services/gemini');

    await askGemini('Where is the keynote?');

    expect(mockGetGenerativeModel).toHaveBeenCalledWith(
      expect.objectContaining({
        model: MODEL_NAME,
      })
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
    // System prompt should contain event data
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
});

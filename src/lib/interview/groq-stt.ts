/**
 * Groq Whisper speech-to-text gateway (server-side only).
 *
 * Transcribes a recorded answer audio blob using Groq's OpenAI-compatible audio
 * transcription endpoint with the `whisper-large-v3` model. The API key lives only in
 * server env (`GROQ_API_KEY`) and is never exposed to the browser.
 *
 * Privacy note: this is the single, deliberate exception to the module's "raw audio
 * never leaves the browser" rule (Req 15). Audio is forwarded transiently to Groq for
 * transcription only — it is NOT persisted anywhere — and only the resulting transcript
 * continues into the evaluation/LLM path.
 *
 * Verbatim policy (this module's contract): we ask Whisper for an UNEDITED, verbatim
 * transcript that preserves disfluencies (um, uh, ah, hmm, like, you know), false
 * starts, and pauses. The LLM evaluator downstream uses these as a confidence /
 * composure signal — cleaning them up here would silently degrade sentiment and
 * feedback quality. Whisper accepts a free-form `prompt` as a style hint; we use it
 * to anchor the model on raw output. We also pin `language` so short clips don't
 * hit auto-detect failures.
 */

const GROQ_TRANSCRIPTION_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';
const DEFAULT_MODEL = 'whisper-large-v3';
const DEFAULT_LANGUAGE = 'en';

/**
 * Style-hint prompt that biases Whisper toward raw, verbatim output. Whisper uses
 * the `prompt` field as a continuation-style reference, so we both DESCRIBE what we
 * want and DEMONSTRATE the disfluencies we want preserved. Empirically this stops
 * the model from collapsing "um, I think, uh, the way to..." into "I think the way
 * to...".
 */
const VERBATIM_STYLE_PROMPT =
  'Verbatim, unedited interview transcript. Preserve every hesitation and ' +
  'disfluency exactly as spoken. Examples of the desired style: ' +
  '"Um, so, I think, uh, the way I would approach this is, like, you know, ' +
  'first I would, hmm, look at the requirements." ' +
  '"Yeah, so basically, uh, my experience with React is — well, it\'s, you ' +
  'know, about three years." ' +
  'Do not summarize, paraphrase, or correct grammar. Transcribe exactly what is ' +
  'said, including false starts, repeated words, and filler words.';

export type SttResult =
  | { ok: true; text: string }
  | { ok: false; error: { kind: 'config_error' | 'provider_error'; message: string } };

/**
 * Transcribe an audio buffer via Groq Whisper. Never throws — returns a typed result
 * so callers can map failures to HTTP statuses cleanly.
 */
export async function transcribeAudio(
  audio: Blob,
  filename = 'answer.webm',
): Promise<SttResult> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return { ok: false, error: { kind: 'config_error', message: 'GROQ_API_KEY not set' } };
  }

  const model = process.env.GROQ_WHISPER_MODEL || DEFAULT_MODEL;
  const language = process.env.GROQ_WHISPER_LANGUAGE || DEFAULT_LANGUAGE;

  try {
    const form = new FormData();
    form.append('file', audio, filename);
    form.append('model', model);
    form.append('response_format', 'json');
    // temperature=0 → deterministic decoding; combined with the verbatim prompt this
    // gives the most stable raw output across retries.
    form.append('temperature', '0');
    // Pin the language so short utterances don't trigger auto-detect mistakes.
    form.append('language', language);
    // Style hint that anchors the model on verbatim output (see VERBATIM_STYLE_PROMPT).
    form.append('prompt', VERBATIM_STYLE_PROMPT);

    const res = await fetch(GROQ_TRANSCRIPTION_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      return {
        ok: false,
        error: {
          kind: 'provider_error',
          message: `Groq STT ${res.status}: ${detail.slice(0, 300)}`,
        },
      };
    }

    const data = (await res.json()) as { text?: string };
    // Outer trim only — internal whitespace, hesitations, and capitalisation are
    // preserved as Whisper returned them. Do NOT lowercase, strip punctuation, or
    // collapse whitespace here; those are exactly the signals the evaluator uses.
    return { ok: true, text: (data.text ?? '').trim() };
  } catch (err) {
    return {
      ok: false,
      error: {
        kind: 'provider_error',
        message: err instanceof Error ? err.message : String(err),
      },
    };
  }
}

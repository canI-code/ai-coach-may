import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

/** Interviewer voice for question playback (edge-tts), per product spec. */
export const INTERVIEW_VOICE = 'en-IE-EmilyNeural';

/**
 * Synthesize `text` to MP3 audio bytes via the Microsoft Edge online neural TTS
 * (en-IE-EmilyNeural). Server-only (uses a WebSocket); the route streams the result to
 * the browser, which plays it back. No raw media is ever stored.
 */
export async function synthesizeSpeech(text: string): Promise<Buffer> {
  const tts = new MsEdgeTTS();
  await tts.setMetadata(INTERVIEW_VOICE, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
  const { audioStream } = tts.toStream(text);

  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    audioStream.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
    audioStream.on('end', () => {
      try {
        tts.close();
      } catch {
        /* ignore close errors */
      }
      resolve(Buffer.concat(chunks));
    });
    audioStream.on('error', reject);
  });
}

// elevenlabs.service.ts
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import FormData from 'form-data';
import fetch from 'node-fetch';
import { userPrompts } from '../services/userPrompt';
import textToSpeech from "@google-cloud/text-to-speech";
// const client = new textToSpeech.TextToSpeechClient();

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_BASE_URL = 'https://api.elevenlabs.io/v1';

class TranslationService {

  /**
   * Detect language and translate to English
   */
  static async translateToEnglish(text: string): Promise<{
    originalLanguage: string;
    translatedText: string;
    needsTranslation: boolean
  }> {
    // Simple language detection (you can use a proper service)
    const isEnglish = /^[a-zA-Z0-9\s.,!?'"()-]+$/.test(text);

    if (isEnglish) {
      return {
        originalLanguage: 'en',
        translatedText: text,
        needsTranslation: false
      };
    }

    // For demo - you should use Google Translate API, Azure Translator, etc.
    // This is just a placeholder
    try {
      // Example with Google Translate (you'll need to implement this)
      // const translatedText = await googleTranslate(text, 'en');

      // For now, return original text and let your backend handle it
      return {
        originalLanguage: 'auto-detected', // You'd get actual language from translation service
        translatedText: text, // Replace with actual translation
        needsTranslation: true
      };
    } catch (error) {
      return {
        originalLanguage: 'unknown',
        translatedText: text,
        needsTranslation: false
      };
    }
  }

  /**
   * Translate English response back to original language
   */
  static async translateFromEnglish(text: string, targetLanguage: string): Promise<string> {
    if (targetLanguage === 'en' || targetLanguage === 'unknown') {
      return text;
    }

    try {
      // Example with Google Translate (you'll need to implement this)
      // return await googleTranslate(text, targetLanguage);

      // For now, return original text
      return text;
    } catch (error) {
      console.error('Translation failed:', error);
      return text;
    }
  }
}

export class ElevenLabsService {

  /**
   * Convert audio to text using ElevenLabs STT
   */
  static async speechToText(audioBuffer: Buffer): Promise<{ success: boolean; text?: string; error?: string }> {
    try {
      const formData = new FormData();

      // ElevenLabs expects 'file' parameter, not 'audio'
      formData.append('file', audioBuffer, {
        filename: 'audio.wav',
        contentType: 'audio/wav'
      });

      // Use correct model_id for ElevenLabs
      formData.append('model_id', 'scribe_v1');

      const response = await fetch(`${ELEVENLABS_BASE_URL}/speech-to-text`, {
        method: 'POST',
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY!,
          ...formData.getHeaders()
        },
        body: formData
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('ElevenLabs STT Error Details:', errorText);
        console.error('Response Status:', response.status);
        return { success: false, error: `STT failed: ${response.status} - ${errorText}` };
      }

      const result = await response.json() as { text: string };
      return { success: true, text: result.text };

    } catch (error) {
      console.error('ElevenLabs STT Exception:', error);
      return { success: false, error: 'STT service unavailable' };
    }
  }

  /**
   * Convert text to speech using ElevenLabs TTS
   */
  static async textToSpeech(text: string, voiceId: string = '21m00Tcm4TlvDq8ikWAM'): Promise<{ success: boolean; audioBuffer?: Buffer; error?: string }> {
    try {
      const response = await fetch(`${ELEVENLABS_BASE_URL}/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY!,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text,
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.5,
            style: 0.0,
            use_speaker_boost: true
          }
        })
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('ElevenLabs TTS Error:', error);
        return { success: false, error: `TTS failed: ${response.status}` };
      }

      const audioBuffer = Buffer.from(await response.arrayBuffer());
      return { success: true, audioBuffer };

    } catch (error) {
      console.error('ElevenLabs TTS Exception:', error);
      return { success: false, error: 'TTS service unavailable' };
    }
  }

  /**
   * Get available voices
   */
  static async getVoices(): Promise<{ success: boolean; voices?: any[]; error?: string }> {
    try {
      const response = await fetch(`${ELEVENLABS_BASE_URL}/voices`, {
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY!
        }
      });

      if (!response.ok) {
        return { success: false, error: `Failed to get voices: ${response.status}` };
      }

      const result = await response.json() as { voices: any[] };
      return { success: true, voices: result.voices };

    } catch (error) {
      console.error('ElevenLabs Get Voices Exception:', error);
      return { success: false, error: 'Voices service unavailable' };
    }
  }
}

// Updated transcribeInput function
export async function transcribeInputWithElevenLabs(
  input: { audioContent?: string; textContent?: string },
  userId: string
): Promise<{ status: boolean; transcription?: string; error?: string }> {

  if (input.textContent) {
    // Direct text input - no transcription needed
    return {
      status: true,
      transcription: input.textContent
    };
  }

  if (input.audioContent) {
    try {
      // Decode base64 audio
      const audioBuffer = Buffer.from(input.audioContent, 'base64');

      // Log audio buffer info for debugging
      console.log('Audio buffer size:', audioBuffer.length);
      console.log('Audio buffer first few bytes:', audioBuffer.slice(0, 10));

      // Check if buffer is too small
      if (audioBuffer.length < 100) {
        return {
          status: false,
          error: 'Audio file too small or corrupted'
        };
      }

      // Use ElevenLabs STT
      const result = await ElevenLabsService.speechToText(audioBuffer);

      if (result.success && result.text) {
        return {
          status: true,
          transcription: result.text
        };
      } else {
        return {
          status: false,
          error: result.error || 'Speech transcription failed'
        };
      }

    } catch (error) {
      console.error('Transcription error:', error);
      return {
        status: false,
        error: 'Failed to process audio content'
      };
    }
  }

  return {
    status: false,
    error: 'No valid input provided'
  };
}

// Updated main route with ElevenLabs integration
export default async function userPromptRoute(app: FastifyInstance) {
  app.post(
    "/user-queries",
    async (
      req: FastifyRequest<{
        Body: {
          audioContent: string;
          textContent?: string;
          userId: string;
          chatId?: string;
          isChatEnd: boolean;
        };
      }>,
      reply: FastifyReply
    ) => {
      try {
        console.log("Received user query:", req.body.userId);
        const { audioContent, textContent, userId } = req.body;

        //////////////////////////////////////////////////////////////////////////////////////////////////////
        // TRANSCRIPTION WITH ELEVENLABS + LANGUAGE DETECTION
        //////////////////////////////////////////////////////////////////////////////////////////////////////

        let transcribed = "";
        let originalLanguage = "en";
        let needsTranslation = false;

        if (audioContent) {
          // Use ElevenLabs for audio transcription
          const audioResult = await transcribeInputWithElevenLabs({ audioContent }, userId);
          console.log(audioResult, "___elevenlabs_audio_result__");

          if (!audioResult.status) {
            return reply.status(400).send({ error: audioResult.error });
          } else {
            // Detect language and translate if needed
            const translation = await TranslationService.translateToEnglish(audioResult.transcription!);
            transcribed = translation.translatedText;
            originalLanguage = translation.originalLanguage;
            needsTranslation = translation.needsTranslation;

            console.log("✅ ElevenLabs Transcribed:", audioResult.transcription);
            console.log("🌍 Detected language:", originalLanguage);
            console.log("🔄 Translated to English:", transcribed);
          }

        } else if (textContent) {
          console.log("Received textContent:", textContent);

          // Detect language and translate if needed
          const translation = await TranslationService.translateToEnglish(textContent);
          transcribed = translation.translatedText;
          originalLanguage = translation.originalLanguage;
          needsTranslation = translation.needsTranslation;

          console.log("🌍 Detected language:", originalLanguage);
          console.log("🔄 Translated to English:", transcribed);

        } else {
          return reply
            .status(400)
            .send({ error: "No audioContent or textContent provided" });
        }

        //////////////////////////////////////////////////////////////////////////////////////////////////////
        // PROCESS WITH YOUR EXISTING LOGIC (IN ENGLISH)
        //////////////////////////////////////////////////////////////////////////////////////////////////////
        console.log("🤖 Calling userPrompts with English transcription...");
        const promptResult = await userPrompts(transcribed, userId);
        console.log("🧾 Prompt result received:", promptResult);

        let responseText = promptResult?.summary || "Sorry, I didn't get that.";

        //////////////////////////////////////////////////////////////////////////////////////////////////////
        // TRANSLATE RESPONSE BACK TO ORIGINAL LANGUAGE
        //////////////////////////////////////////////////////////////////////////////////////////////////////
        if (needsTranslation && originalLanguage !== 'en') {
          console.log("🔄 Translating response back to:", originalLanguage);
          responseText = await TranslationService.translateFromEnglish(responseText, originalLanguage);
          console.log("✅ Translated response:", responseText);
        }

        //////////////////////////////////////////////////////////////////////////////////////////////////////
        // GENERATE AUDIO RESPONSE WITH ELEVENLABS TTS
        //////////////////////////////////////////////////////////////////////////////////////////////////////
        const ttsResult = await ElevenLabsService.textToSpeech(responseText);

        let audioBase64 = "";
        if (ttsResult.success && ttsResult.audioBuffer) {
          audioBase64 = ttsResult.audioBuffer.toString('base64');
          console.log("✅ ElevenLabs TTS generated successfully");
        } else {
          console.error("❌ ElevenLabs TTS failed:", ttsResult.error);
          // Return error if TTS fails - or implement your own fallback
          return reply.status(500).send({
            error: "Audio generation failed",
            details: ttsResult.error
          });
        }

        console.log("📨 Sending response with ElevenLabs audio...");
        return reply.send({
          ...promptResult,
          summary: responseText, // Return translated response
          audioBase64,
          originalLanguage,
          wasTranslated: needsTranslation
        });

      } catch (error) {
        console.error("Error:", error);
        reply.status(500).send({ error: "Failed to process user query" });
      }
    }
  );
}
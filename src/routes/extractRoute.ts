import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { execFile } from "child_process";

import { extractReceiptDataFromBuffer } from "../utils/textExtraction";
import { categorize } from "../services/categorize";
import { extractJsonFromResponse } from "../utils/extractJson";
import { receiptExtractionResponseStringify } from "../constants/catergorizeStructure";

import { db } from "../lib/firebase-admin";
import { doc, Firestore, serverTimestamp, setDoc } from "firebase/firestore";
import { extractReceiptData } from "../utils/documentAIExtraction";
import { validateImageFile, validateReceiptWithSmartDetection } from "../services/smartReciptValidation";


// NPM-provided ffmpeg & ffprobe
const ffmpegInstaller = require("@ffmpeg-installer/ffmpeg");
const ffprobeInstaller = require("@ffprobe-installer/ffprobe");
const FFMPEG_CMD = ffmpegInstaller.path;
const FFPROBE_CMD = ffprobeInstaller.path;

// --- helpers ---
function execFileP(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, (err, stdout, stderr) => {
      if (err) {
        err.message += ` | stderr: ${stderr}`;
        return reject(err);
      }
      resolve(stdout);
    });
  });
}

async function probeVideo(filePath: string) {
  try {
    const json = await execFileP(FFPROBE_CMD, [
      "-v",
      "quiet",
      "-print_format",
      "json",
      "-show_streams",
      "-show_format",
      filePath,
    ]);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

async function extractFrame(filePath: string, t: number, outPath: string) {
  await execFileP(FFMPEG_CMD, [
    "-ss",
    t.toString(),
    "-i",
    filePath,
    "-vframes",
    "1",
    "-qscale:v",
    "2",
    "-y",
    outPath,
  ]);
}

async function safeUnlink(p?: string | null) {
  if (!p) return;
  try {
    await fs.promises.unlink(p);
  } catch {
    /* ignore */
  }
}

// Helper function to calculate total from categorization





export default async function extractRoutes(app: FastifyInstance) {
  app.post(
    "/upload-extract",
    async (request: FastifyRequest, reply: FastifyReply) => {
      let storedVideoPath: string | null = null;
      let framePath: string | null = null;

      try {
        // ⛳️ Extract file and fields from request
        let userId: string | undefined;
        let fileBuffer: Buffer | undefined;
        let filename: string | undefined;
        let mimetype: string | undefined;
        let isVideo = false;

        const parts = request.parts();

        for await (const part of parts) {
          if (part.type === "file") {
            const chunks: Buffer[] = [];
            for await (const chunk of part.file) {
              chunks.push(chunk);
            }
            fileBuffer = Buffer.concat(chunks);
            filename = part.filename;
            mimetype = part.mimetype;
            isVideo = !!mimetype?.startsWith("video/");
          } else if (part.type === "field" && part.fieldname === "userId") {
            userId = part.value as string;
          }
        }

        if (!userId) {
          return reply.status(400).send({ error: "User ID not provided" });
        }

        if (!fileBuffer || !filename) {
          return reply.status(400).send({ error: "No file uploaded" });
        }

        // 🔍 VALIDATE RECEIPT BEFORE PROCESSING
        console.log('🔍 Validating uploaded file...');

        // For videos, we'll validate after frame extraction
        // For images, validate immediately
        if (!isVideo) {
          // Basic file validation
          const fileValidation = validateImageFile(fileBuffer);
          if (!fileValidation.isValid) {
            return reply.status(400).send({
              error: fileValidation.message,
              code: 'INVALID_FILE'
            });
          }

          // Smart AI validation
          const receiptValidation = await validateReceiptWithSmartDetection(fileBuffer);
          if (!receiptValidation.isValid) {
            console.log('❌ Image validation failed:', receiptValidation.message);
            return reply.status(400).send({
              error: receiptValidation.message,
              code: 'NOT_A_RECEIPT',
              details: receiptValidation.analysis
            });
          }

          console.log('✅ Image validation passed!');
        }

        let ocrBuffer: Buffer;
        let videoMeta: any = null;

        if (isVideo) {
          // Save video
          const videoDir = path.join(process.cwd(), "uploads", "videos");
          await fs.promises.mkdir(videoDir, { recursive: true });
          const ext = path.extname(filename || "") || ".mp4";
          const vidId = randomUUID();
          const storedName = `${vidId}${ext}`;
          storedVideoPath = path.join(videoDir, storedName);
          await fs.promises.writeFile(storedVideoPath, fileBuffer);

          // Probe video
          const probe = await probeVideo(storedVideoPath);
          const durationSec = probe?.format?.duration
            ? parseFloat(probe.format.duration)
            : 0;
          const vStream = probe?.streams?.find(
            (s: any) => s.codec_type === "video"
          );
          const width = vStream?.width;
          const height = vStream?.height;

          if (durationSec && durationSec > 5.6) {
            await safeUnlink(storedVideoPath);
            return reply.code(400).send({
              error: `Video too long (${durationSec.toFixed(2)}s > 5.5s limit)`,
            });
          }

          // Extract frame
          const frameDir = path.join(process.cwd(), "uploads", "frames");
          await fs.promises.mkdir(frameDir, { recursive: true });
          framePath = path.join(frameDir, `${vidId}.jpg`);
          const targetT = Math.min(
            Math.max(durationSec * 0.4, 0),
            Math.max(durationSec - 0.05, 0)
          );
          try {
            await extractFrame(storedVideoPath, targetT, framePath);
          } catch {
            await extractFrame(storedVideoPath, 0, framePath);
          }

          ocrBuffer = await fs.promises.readFile(framePath);

          // 🔍 VALIDATE VIDEO FRAME AFTER EXTRACTION
          console.log('🔍 Validating extracted video frame...');
          const frameValidation = await validateReceiptWithSmartDetection(ocrBuffer);
          if (!frameValidation.isValid) {
            console.log('❌ Video frame validation failed:', frameValidation.message);
            await safeUnlink(framePath);
            await safeUnlink(storedVideoPath);
            return reply.status(400).send({
              error: `Video frame validation failed: ${frameValidation.message}`,
              code: 'VIDEO_NOT_RECEIPT',
              details: frameValidation.analysis
            });
          }

          console.log('✅ Video frame validation passed!');
          await safeUnlink(framePath);

          videoMeta = {
            originalFilename: filename,
            storedName,
            durationSec: Number(durationSec.toFixed(3)),
            dimensions: width && height ? { width, height } : null,
            frameSourceTime: targetT,
          };
        } else {
          ocrBuffer = fileBuffer;
        }

        // 🚀 PROCEED WITH OCR ONLY AFTER VALIDATION
        console.log('🚀 Starting OCR processing...');
        const rawText = await extractReceiptData(ocrBuffer, filename);
        const categorization = await categorize((rawText as string) || "", userId);

        let parsedData = extractJsonFromResponse(categorization as string) || {
          receipt: {},
          categories: {},
          items: {},
        };

        console.log(parsedData, "__parsed_Data");

        // await storeReceiptData(parsedData);
        const responseData = {
          success: true,
          filename,
          isVideo,
          video: videoMeta,
          categorization: parsedData,
          // documentId,
          processingStatus: "processed" as const,
        };
        console.log(responseData, "__response_data");

        reply.type("application/json");
        return reply.send(responseData);

      } catch (err: any) {
        request.log.error({ err }, "Upload / OCR failed");
        return reply.status(500).send({
          error: "OCR processing failed",
          details: err.message,
        });
      } finally {
        await safeUnlink(storedVideoPath);
        await safeUnlink(framePath);
      }
    }
  );
}

// Helper function to clean undefined values

// Use it before saving to Firestore

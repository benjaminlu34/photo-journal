import DOMPurify from 'dompurify';
import { z } from 'zod';
import type { NoteData, NotePosition, NoteContent, ChecklistItem, ChecklistSettings, DrawingStroke } from '@/types/notes';

// Position validation schema
const positionSchema = z.object({
  x: z.number().min(-10000).max(10000),
  y: z.number().min(-10000).max(10000),
  width: z.number().min(100).max(2000),
  height: z.number().min(80).max(2000),
  rotation: z.number().min(-180).max(180),
});

// Content validation schemas
const textContentSchema = z.object({
  type: z.literal('text'),
  text: z.string().max(10000), // 10k chars max
});

const checklistItemSchema = z.object({
  id: z.string(),
  text: z.string().max(500),
  completed: z.boolean(),
  order: z.number().int().min(0),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

const checklistSettingsSchema = z.object({
  allowReordering: z.boolean(),
  showCompletedItems: z.boolean(),
  sortBy: z.enum(['order', 'created', 'alphabetical']),
});

const checklistContentSchema = z.object({
  type: z.literal('checklist'),
  items: z.array(checklistItemSchema).max(100), // Max 100 items
  settings: checklistSettingsSchema.optional(),
  backgroundColor: z.string().optional(),
});

const imageContentSchema = z.object({
  type: z.literal('image'),
  imageUrl: z.string().url().optional(),
  alt: z.string().max(200).optional(),
});

const voiceContentSchema = z.object({
  type: z.literal('voice'),
  audioUrl: z.string().url().optional(),
  duration: z.number().min(0).max(300).optional(), // Max 5 minutes
});

const drawingStrokeSchema = z.object({
  points: z.array(z.object({
    x: z.number(),
    y: z.number(),
    pressure: z.number().min(0).max(1),
  })).max(1000), // Max 1000 points per stroke
  color: z.string(),
  width: z.number().min(1).max(50),
});

const drawingContentSchema = z.object({
  type: z.literal('drawing'),
  strokes: z.array(drawingStrokeSchema).max(100), // Max 100 strokes
});

const noteContentSchema = z.discriminatedUnion('type', [
  textContentSchema,
  checklistContentSchema,
  imageContentSchema,
  voiceContentSchema,
  drawingContentSchema,
]);

// Rate limiting
interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimits = new Map<string, RateLimitEntry>();
const RATE_LIMIT = 100; // operations
const RATE_WINDOW = 60000; // 1 minute

// Clean up expired rate limits periodically
setInterval(() => {
  const now = Date.now();
  for (const [userId, entry] of rateLimits.entries()) {
    if (now > entry.resetTime) {
      rateLimits.delete(userId);
    }
  }
}, RATE_WINDOW);

export const security = {
  validatePosition(position: unknown): NotePosition {
    return positionSchema.parse(position);
  },

  validateContent(content: unknown): NoteContent {
    return noteContentSchema.parse(content);
  },

  validateNote(note: unknown): NoteData {
    const noteSchema = z.object({
      id: z.string(),
      type: z.enum(['text', 'checklist', 'image', 'voice', 'drawing']),
      position: positionSchema,
      content: noteContentSchema,
      createdAt: z.string(),
      updatedAt: z.string(),
    }).refine(
      (data) => data.type === data.content.type,
      { message: 'Note type must match content type' }
    );

    return noteSchema.parse(note);
  },

  sanitizeHtml(html: string): string {
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: ['p', 'b', 'i', 'u', 'em', 'strong', 'br'],
      ALLOWED_ATTR: [],
    });
  },

  checkRateLimit(userId: string): boolean {
    const now = Date.now();
    const userLimit = rateLimits.get(userId);

    if (!userLimit || now > userLimit.resetTime) {
      rateLimits.set(userId, {
        count: 1,
        resetTime: now + RATE_WINDOW,
      });
      return true;
    }

    if (userLimit.count >= RATE_LIMIT) {
      return false;
    }

    userLimit.count++;
    return true;
  },
}; 
// src/server/db/schema/videos.ts
import { pgTable, text, timestamp, integer, decimal, boolean, jsonb } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';

export const videos = pgTable('videos', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  itemId: text('item_id').notNull().references(() => items.id),
  userId: text('user_id').notNull(),
  
  // Video details
  videoId: text('video_id').notNull(), // Invideo video ID
  videoUrl: text('video_url'),
  thumbnailUrl: text('thumbnail_url'),
  duration: integer('duration'), // in seconds
  
  // Generation parameters
  platform: text('platform').notNull(), // youtube, instagram, tiktok
  vibe: text('vibe').notNull(), // educational, entertaining, etc.
  script: text('script').notNull(),
  
  // Status
  status: text('status').notNull().default('processing'), // processing, completed, failed
  
  // Metadata
  views: integer('views').default(0),
  shares: integer('shares').default(0),
  metadata: jsonb('metadata'),
  
  // Timestamps
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  completedAt: timestamp('completed_at'),
});
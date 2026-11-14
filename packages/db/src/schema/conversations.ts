import {
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { id, timestamps } from './_columns.ts';
import { customers } from './booking.ts';
import { businesses } from './businesses.ts';

// Shapes fixed now; behaviour lands in P3 (agent + channels).

export const conversationChannel = pgEnum('conversation_channel', ['whatsapp', 'web_chat']);
export const conversationStatus = pgEnum('conversation_status', ['agent', 'needs_human', 'closed']);
export const messageDirection = pgEnum('message_direction', ['in', 'out']);
export const messageAuthor = pgEnum('message_author', ['customer', 'agent', 'staff']);

export const conversations = pgTable(
  'conversations',
  {
    id: id(),
    businessId: uuid()
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    customerId: uuid()
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),
    channel: conversationChannel().notNull(),
    status: conversationStatus().notNull().default('agent'),
    lastMessageAt: timestamp({ withTimezone: true }),
    /** WhatsApp 24h customer-service window. */
    waWindowExpiresAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (t) => [index('conversations_business_last_msg_idx').on(t.businessId, t.lastMessageAt)],
);

export const messages = pgTable(
  'messages',
  {
    id: id(),
    conversationId: uuid()
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    direction: messageDirection().notNull(),
    author: messageAuthor().notNull(),
    body: text().notNull(),
    /** Dedupes WhatsApp redeliveries. NULLs are allowed (and distinct) for web chat. */
    providerMessageId: text(),
    toolCalls: jsonb(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('messages_provider_message_id_uq').on(t.providerMessageId),
    index('messages_conversation_created_idx').on(t.conversationId, t.createdAt),
  ],
);

export type Conversation = typeof conversations.$inferSelect;
export type Message = typeof messages.$inferSelect;

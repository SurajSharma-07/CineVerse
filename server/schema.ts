import { mysqlTable, varchar, text, timestamp, int } from 'drizzle-orm/mysql-core';

export const users = mysqlTable('users', {
  id: varchar('id', { length: 255 }).primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
});

export const movies = mysqlTable('movies', {
  id: varchar('id', { length: 255 }).primaryKey(),
  userId: varchar('user_id', { length: 255 })
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 255 }).notNull(),
  thumbnailUrl: text('thumbnail_url').notNull(),
  thumbnailKey: varchar('thumbnail_key', { length: 255 }),
  aspectRatio: varchar('aspect_ratio', { length: 10 }).$type<'16:9' | '9:16'>().notNull(),
  collection: varchar('collection', { length: 20 }).$type<'watched' | 'watchLater'>().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
});

export const recommendations = mysqlTable('recommendations', {
  id: varchar('id', { length: 255 }).primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  thumbnailUrl: text('thumbnail_url').notNull(),
  thumbnailKey: varchar('thumbnail_key', { length: 255 }),
  rank: int('rank').notNull(),
  recommendedBy: varchar('recommended_by', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

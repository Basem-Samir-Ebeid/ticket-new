import { pgTable, uuid, text, boolean, timestamp, date, doublePrecision } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

export const profiles = pgTable('profiles', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  email: text('email').notNull().unique(),
  password_hash: text('password_hash').notNull(),
  plain_password: text('plain_password'),
  full_name: text('full_name'),
  profile_picture_url: text('profile_picture_url'),
  role: text('role').notNull().default('employee'),
  can_view_attendance: boolean('can_view_attendance').notNull().default(false),
  must_change_password: boolean('must_change_password').notNull().default(true),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const tickets = pgTable('tickets', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  title: text('title').notNull(),
  description: text('description'),
  affected_person: text('affected_person'),
  assigned_to: uuid('assigned_to').references(() => profiles.id, { onDelete: 'set null' }),
  created_by: uuid('created_by').references(() => profiles.id, { onDelete: 'cascade' }),
  status: text('status').notNull().default('opened'),
  is_request: boolean('is_request').notNull().default(false),
  request_status: text('request_status').default('pending_review'),
  review: text('review'),
  opened_at: timestamp('opened_at', { withTimezone: true }),
  pending_at: timestamp('pending_at', { withTimezone: true }),
  solved_at: timestamp('solved_at', { withTimezone: true }),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const ticketReplies = pgTable('ticket_replies', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  ticket_id: uuid('ticket_id').notNull().references(() => tickets.id, { onDelete: 'cascade' }),
  user_id: uuid('user_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  message: text('message'),
  image_url: text('image_url'),
  attachment_name: text('attachment_name'),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const loginTimes = pgTable('login_times', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  user_id: uuid('user_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  date: date('date').notNull(),
  login_time: timestamp('login_time', { withTimezone: true }).notNull().defaultNow(),
  logout_time: timestamp('logout_time', { withTimezone: true }),
  latitude: doublePrecision('latitude'),
  longitude: doublePrecision('longitude'),
  logout_latitude: doublePrecision('logout_latitude'),
  logout_longitude: doublePrecision('logout_longitude'),
})

export const leaveRequests = pgTable('leave_requests', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  user_id: uuid('user_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  start_date: date('start_date').notNull(),
  end_date: date('end_date').notNull(),
  reason: text('reason'),
  status: text('status').notNull().default('pending'),
  admin_note: text('admin_note'),
  decided_by: uuid('decided_by').references(() => profiles.id),
  decided_at: timestamp('decided_at', { withTimezone: true }),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  user_id: uuid('user_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  ticket_id: uuid('ticket_id').references(() => tickets.id, { onDelete: 'set null' }),
  message: text('message').notNull(),
  read: boolean('read').notNull().default(false),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const pushSubscriptions = pgTable('push_subscriptions', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  user_id: uuid('user_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  endpoint: text('endpoint').notNull().unique(),
  p256dh: text('p256dh').notNull(),
  auth: text('auth').notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const sessionRevocations = pgTable('session_revocations', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  user_id: uuid('user_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  reason: text('reason'),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const settingsLog = pgTable('settings_log', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  changed_by: uuid('changed_by').references(() => profiles.id, { onDelete: 'set null' }),
  changed_by_name: text('changed_by_name'),
  from_lat: doublePrecision('from_lat'),
  from_lng: doublePrecision('from_lng'),
  from_radius: doublePrecision('from_radius'),
  to_lat: doublePrecision('to_lat').notNull(),
  to_lng: doublePrecision('to_lng').notNull(),
  to_radius: doublePrecision('to_radius').notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

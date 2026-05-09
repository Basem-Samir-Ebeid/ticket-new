import { pgTable, uuid, text, boolean, timestamp, date, doublePrecision, integer } from 'drizzle-orm/pg-core'
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
  leave_balance: integer('leave_balance').notNull().default(14),
  sick_leave_balance: integer('sick_leave_balance').notNull().default(7),
  emergency_leave_balance: integer('emergency_leave_balance').notNull().default(3),
  work_start_hour: integer('work_start_hour').notNull().default(9),
  // HR profile fields
  department: text('department'),
  job_title: text('job_title'),
  phone: text('phone'),
  national_id: text('national_id'),
  hire_date: date('hire_date'),
  birth_date: date('birth_date'),
  gender: text('gender'),
  address: text('address'),
  employment_type: text('employment_type').default('full_time'),
  employee_code: text('employee_code'),
  direct_manager: text('direct_manager'),
  notes: text('notes'),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const tickets = pgTable('tickets', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  title: text('title').notNull(),
  description: text('description'),
  affected_person: text('affected_person'),
  asset_id: uuid('asset_id'),
  category: text('category'),
  due_date: date('due_date'),
  assigned_to: uuid('assigned_to').references(() => profiles.id, { onDelete: 'set null' }),
  created_by: uuid('created_by').references(() => profiles.id, { onDelete: 'cascade' }),
  status: text('status').notNull().default('opened'),
  priority: text('priority').notNull().default('medium'),
  is_request: boolean('is_request').notNull().default(false),
  request_status: text('request_status').default('pending_review'),
  review: text('review'),
  rating: integer('rating'),
  rating_comment: text('rating_comment'),
  opened_at: timestamp('opened_at', { withTimezone: true }),
  pending_at: timestamp('pending_at', { withTimezone: true }),
  solved_at: timestamp('solved_at', { withTimezone: true }),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const ticketHistory = pgTable('ticket_history', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  ticket_id: uuid('ticket_id').notNull().references(() => tickets.id, { onDelete: 'cascade' }),
  changed_by: uuid('changed_by').references(() => profiles.id, { onDelete: 'set null' }),
  changed_by_name: text('changed_by_name'),
  field: text('field').notNull(),
  old_value: text('old_value'),
  new_value: text('new_value'),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const ticketTemplates = pgTable('ticket_templates', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  name: text('name').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  priority: text('priority').notNull().default('medium'),
  created_by: uuid('created_by').references(() => profiles.id, { onDelete: 'set null' }),
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
  leave_type: text('leave_type').notNull().default('annual'),
  start_date: date('start_date').notNull(),
  end_date: date('end_date').notNull(),
  days_count: integer('days_count').notNull().default(1),
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

export const officeSettings = pgTable('office_settings', {
  id: text('id').primaryKey().default('main'),
  latitude: doublePrecision('latitude').notNull(),
  longitude: doublePrecision('longitude').notNull(),
  radius_meters: doublePrecision('radius_meters').notNull(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const passwordResetTokens = pgTable('password_reset_tokens', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  user_id: uuid('user_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expires_at: timestamp('expires_at', { withTimezone: true }).notNull(),
  used: boolean('used').notNull().default(false),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const assets = pgTable('assets', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  name: text('name').notNull(),
  type: text('type').notNull().default('other'),
  serial_number: text('serial_number').unique(),
  brand: text('brand'),
  model: text('model'),
  status: text('status').notNull().default('active'),
  condition: text('condition').notNull().default('good'),
  purchase_date: date('purchase_date'),
  warranty_expires: date('warranty_expires'),
  purchase_price: doublePrecision('purchase_price'),
  location: text('location'),
  notes: text('notes'),
  image_url: text('image_url'),
  assigned_to: uuid('assigned_to').references(() => profiles.id, { onDelete: 'set null' }),
  created_by: uuid('created_by').references(() => profiles.id, { onDelete: 'set null' }),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const assetHistory = pgTable('asset_history', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  asset_id: uuid('asset_id').notNull().references(() => assets.id, { onDelete: 'cascade' }),
  changed_by: uuid('changed_by').references(() => profiles.id, { onDelete: 'set null' }),
  changed_by_name: text('changed_by_name'),
  action: text('action').notNull(),
  description: text('description'),
  old_value: text('old_value'),
  new_value: text('new_value'),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const penalties = pgTable('penalties', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  user_id: uuid('user_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  type: text('type').notNull().default('warning'),
  reason: text('reason').notNull(),
  amount: doublePrecision('amount'),
  notes: text('notes'),
  issued_by: uuid('issued_by').references(() => profiles.id, { onDelete: 'set null' }),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const complaints = pgTable('complaints', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  complainant_id: uuid('complainant_id').references(() => profiles.id, { onDelete: 'set null' }),
  against_user_id: uuid('against_user_id').references(() => profiles.id, { onDelete: 'set null' }),
  subject: text('subject').notNull(),
  description: text('description').notNull(),
  status: text('status').notNull().default('pending'),
  is_anonymous: boolean('is_anonymous').notNull().default(false),
  admin_response: text('admin_response'),
  resolved_by: uuid('resolved_by').references(() => profiles.id, { onDelete: 'set null' }),
  resolved_at: timestamp('resolved_at', { withTimezone: true }),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const attendanceCorrections = pgTable('attendance_corrections', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  user_id: uuid('user_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  date: date('date').notNull(),
  requested_login: text('requested_login'),
  requested_logout: text('requested_logout'),
  reason: text('reason').notNull(),
  status: text('status').notNull().default('pending'),
  admin_note: text('admin_note'),
  reviewed_by: uuid('reviewed_by').references(() => profiles.id, { onDelete: 'set null' }),
  reviewed_at: timestamp('reviewed_at', { withTimezone: true }),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

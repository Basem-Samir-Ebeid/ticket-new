import { pgTable, uuid, text, boolean, timestamp, date, doublePrecision, integer, jsonb, uniqueIndex } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

export const profiles = pgTable('profiles', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  email: text('email').notNull().unique(),
  password_hash: text('password_hash').notNull(),
  full_name: text('full_name'),
  profile_picture_url: text('profile_picture_url'),
  role: text('role').notNull().default('employee'),
  can_view_attendance: boolean('can_view_attendance').notNull().default(false),
  can_view_assets: boolean('can_view_assets').notNull().default(false),
  can_view_whatsapp_contacts: boolean('can_view_whatsapp_contacts').notNull().default(false),
  permissions: jsonb('permissions').default(sql`'{}'::jsonb`),
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
  whatsapp_phone: text('whatsapp_phone'),
  is_leaving: boolean('is_leaving').notNull().default(false),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const systemSettings = pgTable('system_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const tickets = pgTable('tickets', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  title: text('title').notNull(),
  description: text('description'),
  affected_person: text('affected_person'),
  affected_user_id: uuid('affected_user_id').references(() => profiles.id),
  asset_id: uuid('asset_id'),
  category: text('category'),
  subcategory: text('subcategory'),
  tags: text('tags').array().default(sql`'{}'::text[]`),
  due_date: date('due_date'),
  sla_deadline: timestamp('sla_deadline', { withTimezone: true }),
  assigned_to: uuid('assigned_to').references(() => profiles.id, { onDelete: 'set null' }),
  created_by: uuid('created_by').references(() => profiles.id, { onDelete: 'cascade' }),
  status: text('status').notNull().default('opened'),
  priority: text('priority').notNull().default('medium'),
  is_request: boolean('is_request').notNull().default(false),
  request_status: text('request_status').default('pending_review'),
  review: text('review'),
  rating: integer('rating'),
  rating_comment: text('rating_comment'),
  merged_into: uuid('merged_into'),
  sla_escalated: boolean('sla_escalated').notNull().default(false),
  sla_warned: boolean('sla_warned').notNull().default(false),
  ai_assisted: boolean('ai_assisted').notNull().default(false),
  opened_at: timestamp('opened_at', { withTimezone: true }),
  pending_at: timestamp('pending_at', { withTimezone: true }),
  solved_at: timestamp('solved_at', { withTimezone: true }),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const ticketAssignees = pgTable('ticket_assignees', {
  id: uuid('id').primaryKey().defaultRandom(),
  ticket_id: uuid('ticket_id').notNull().references(() => tickets.id, { onDelete: 'cascade' }),
  user_id: uuid('user_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  assigned_at: timestamp('assigned_at', { withTimezone: true }).notNull().defaultNow(),
  assigned_by: uuid('assigned_by').references(() => profiles.id, { onDelete: 'set null' }),
}, (table) => ({
  uniqueAssignee: uniqueIndex('ticket_assignees_ticket_user_unique').on(table.ticket_id, table.user_id),
}))

export type TicketAssignee = typeof ticketAssignees.$inferSelect

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
  attachments: text('attachments').array().default(sql`'{}'::text[]`),
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
  attendance_type: text('attendance_type').notNull().default('office'),
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

export const autoAssignRules = pgTable('auto_assign_rules', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  category: text('category').notNull().unique(),
  user_id: uuid('user_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  user_name: text('user_name'),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const remoteAttendanceRequests = pgTable('remote_attendance_requests', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  user_id: uuid('user_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  date: date('date').notNull(),
  requested_at: timestamp('requested_at', { withTimezone: true }).notNull().defaultNow(),
  status: text('status').notNull().default('pending'),
  reviewed_by: uuid('reviewed_by').references(() => profiles.id, { onDelete: 'set null' }),
  reviewed_at: timestamp('reviewed_at', { withTimezone: true }),
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

// ─── Knowledge Base ────────────────────────────────────────────────────────────
export const knowledgeArticles = pgTable('knowledge_articles', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  title: text('title').notNull(),
  content: text('content').notNull().default(''),
  category: text('category').notNull().default('general'),
  tags: text('tags').array().default(sql`'{}'::text[]`),
  views_count: integer('views_count').notNull().default(0),
  helpful_count: integer('helpful_count').notNull().default(0),
  not_helpful_count: integer('not_helpful_count').notNull().default(0),
  is_published: boolean('is_published').notNull().default(false),
  created_by: uuid('created_by').references(() => profiles.id, { onDelete: 'set null' }),
  updated_by: uuid('updated_by').references(() => profiles.id, { onDelete: 'set null' }),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// ─── Maintenance Schedules ─────────────────────────────────────────────────────
export const maintenanceSchedules = pgTable('maintenance_schedules', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  asset_id: uuid('asset_id').notNull().references(() => assets.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  frequency: text('frequency').notNull().default('monthly'),
  next_due_date: date('next_due_date').notNull(),
  last_completed_date: date('last_completed_date'),
  assigned_to: uuid('assigned_to').references(() => profiles.id, { onDelete: 'set null' }),
  created_by: uuid('created_by').references(() => profiles.id, { onDelete: 'set null' }),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// ─── Audit Logs ───────────────────────────────────────────────────────────────
export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  user_id: uuid('user_id').references(() => profiles.id, { onDelete: 'set null' }),
  user_name: text('user_name'),
  action_type: text('action_type').notNull(),
  entity_type: text('entity_type'),
  entity_id: text('entity_id'),
  description: text('description').notNull(),
  before: jsonb('before'),
  after: jsonb('after'),
  ip_address: text('ip_address'),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// ─── Onboarding Tasks ─────────────────────────────────────────────────────────
export const onboardingTasks = pgTable('onboarding_tasks', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  user_id: uuid('user_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  task_name: text('task_name').notNull(),
  task_type: text('task_type').notNull().default('onboarding'),
  completed: boolean('completed').notNull().default(false),
  completed_by: uuid('completed_by').references(() => profiles.id, { onDelete: 'set null' }),
  completed_at: timestamp('completed_at', { withTimezone: true }),
  due_date: date('due_date'),
  notes: text('notes'),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// ─── Access Records ───────────────────────────────────────────────────────────
export const accessRecords = pgTable('access_records', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  user_id: uuid('user_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  system_name: text('system_name').notNull(),
  access_level: text('access_level').notNull().default('read'),
  granted_by: uuid('granted_by').references(() => profiles.id, { onDelete: 'set null' }),
  granted_at: timestamp('granted_at', { withTimezone: true }).notNull().defaultNow(),
  revoked_at: timestamp('revoked_at', { withTimezone: true }),
  notes: text('notes'),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// ─── Software Licenses ────────────────────────────────────────────────────────
export const softwareLicenses = pgTable('software_licenses', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  software_name: text('software_name').notNull(),
  vendor: text('vendor'),
  license_key: text('license_key'),
  license_type: text('license_type').notNull().default('per-seat'),
  total_seats: integer('total_seats'),
  expiry_date: date('expiry_date'),
  cost: doublePrecision('cost'),
  renewal_reminder_days: integer('renewal_reminder_days').notNull().default(30),
  notes: text('notes'),
  created_by: uuid('created_by').references(() => profiles.id, { onDelete: 'set null' }),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const licenseAssignments = pgTable('license_assignments', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  license_id: uuid('license_id').notNull().references(() => softwareLicenses.id, { onDelete: 'cascade' }),
  user_id: uuid('user_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  assigned_at: timestamp('assigned_at', { withTimezone: true }).notNull().defaultNow(),
  unassigned_at: timestamp('unassigned_at', { withTimezone: true }),
})

// ─── Factory Rotation (تناوب المصنع) ─────────────────────────────────────────
export const factoryRotationGroups = pgTable('factory_rotation_groups', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  name: text('name').notNull(),
  created_by: uuid('created_by').references(() => profiles.id, { onDelete: 'set null' }),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const factoryRotationMembers = pgTable('factory_rotation_members', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  group_id: uuid('group_id').notNull().references(() => factoryRotationGroups.id, { onDelete: 'cascade' }),
  user_id: uuid('user_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  order_index: integer('order_index').notNull().default(0),
})

export const factoryRotationSchedule = pgTable('factory_rotation_schedule', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  group_id: uuid('group_id').notNull().references(() => factoryRotationGroups.id, { onDelete: 'cascade' }),
  user_id: uuid('user_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  scheduled_date: date('scheduled_date').notNull(),
  notified: boolean('notified').notNull().default(false),
  attended_at: timestamp('attended_at', { withTimezone: true }),
  is_absent: boolean('is_absent').notNull().default(false),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// ─── Overtime Rotation (تناوب الأوفر تايم) ───────────────────────────────────
export const overtimeRotationGroups = pgTable('overtime_rotation_groups', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  name: text('name').notNull(),
  created_by: uuid('created_by').references(() => profiles.id, { onDelete: 'set null' }),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const overtimeRotationMembers = pgTable('overtime_rotation_members', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  group_id: uuid('group_id').notNull().references(() => overtimeRotationGroups.id, { onDelete: 'cascade' }),
  user_id: uuid('user_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  order_index: integer('order_index').notNull().default(0),
})

export const overtimeRotationSchedule = pgTable('overtime_rotation_schedule', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  group_id: uuid('group_id').notNull().references(() => overtimeRotationGroups.id, { onDelete: 'cascade' }),
  user_id: uuid('user_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  scheduled_date: date('scheduled_date').notNull(),
  notified: boolean('notified').notNull().default(false),
  attended_at: timestamp('attended_at', { withTimezone: true }),
  is_absent: boolean('is_absent').notNull().default(false),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// ─── Missions (ماموريات) ──────────────────────────────────────────────────────
export const missions = pgTable('missions', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  title: text('title').notNull(),
  description: text('description'),
  assigned_to: uuid('assigned_to').references(() => profiles.id, { onDelete: 'set null' }),
  assigned_by: uuid('assigned_by').references(() => profiles.id, { onDelete: 'set null' }),
  location: text('location'),
  status: text('status').notNull().default('pending'),
  priority: text('priority').notNull().default('medium'),
  start_date: date('start_date'),
  end_date: date('end_date'),
  notes: text('notes'),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// ─── Departments ──────────────────────────────────────────────────────────────
export const departments = pgTable('departments', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  name: text('name').notNull().unique(),
  description: text('description'),
  manager_id: uuid('manager_id').references(() => profiles.id, { onDelete: 'set null' }),
  color: text('color').default('#6366f1'),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// ─── Announcements ────────────────────────────────────────────────────────────
export const announcements = pgTable('announcements', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  title: text('title').notNull(),
  content: text('content').notNull(),
  type: text('type').notNull().default('info'),
  target_roles: text('target_roles').array().default(sql`'{}'::text[]`),
  is_active: boolean('is_active').notNull().default(true),
  expires_at: timestamp('expires_at', { withTimezone: true }),
  created_by: uuid('created_by').references(() => profiles.id, { onDelete: 'set null' }),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const announcementReads = pgTable('announcement_reads', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  announcement_id: uuid('announcement_id').notNull().references(() => announcements.id, { onDelete: 'cascade' }),
  user_id: uuid('user_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  read_at: timestamp('read_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uniqueRead: uniqueIndex('announcement_reads_unique').on(t.announcement_id, t.user_id),
}))

// ─── Employee Evaluations (تقييم الموظفين) ────────────────────────────────────
export const employeeEvaluations = pgTable('employee_evaluations', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  employee_id: uuid('employee_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  evaluated_by: uuid('evaluated_by').references(() => profiles.id, { onDelete: 'set null' }),
  month: integer('month').notNull(),
  year: integer('year').notNull(),
  technical_skills: integer('technical_skills'),
  communication: integer('communication'),
  punctuality: integer('punctuality'),
  task_completion: integer('task_completion'),
  initiative: integer('initiative'),
  work_quality: integer('work_quality'),
  overall_score: doublePrecision('overall_score'),
  notes: text('notes'),
  strengths: text('strengths'),
  areas_for_improvement: text('areas_for_improvement'),
  status: text('status').notNull().default('draft'),
  submitted_at: timestamp('submitted_at', { withTimezone: true }),
  employee_notified_at: timestamp('employee_notified_at', { withTimezone: true }),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// ─── Rotation Swap Requests ───────────────────────────────────────────────────
export const rotationSwapRequests = pgTable('rotation_swap_requests', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  module: text('module').notNull(),
  requester_id: uuid('requester_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  target_id: uuid('target_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  requester_schedule_id: uuid('requester_schedule_id').notNull(),
  requester_date: date('requester_date').notNull(),
  target_schedule_id: uuid('target_schedule_id'),
  target_date: date('target_date'),
  note: text('note'),
  status: text('status').notNull().default('pending'),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

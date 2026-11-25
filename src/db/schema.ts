import { relations } from 'drizzle-orm';
import { doublePrecision, integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  displayName: text('display_name').default('Studio Lead').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const projects = pgTable('projects', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  title: text('title').notNull(),
  genre: text('genre').notNull(),
  platform: text('platform').notNull(),
  prompt: text('prompt').notNull(),
  gddJson: text('gdd_json').notNull(),
  styleBibleJson: text('style_bible_json').notNull(),
  stateMachineJson: text('state_machine_json').notNull(),
  techDocsMd: text('tech_docs_md').notNull(),
  activeBranch: text('active_branch').default('main').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const builds = pgTable('builds', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id')
    .references(() => projects.id)
    .notNull(),
  versionTag: text('version_tag').notNull(),
  status: text('status').notNull(), // 'passed' | 'failed' | 'warning'
  targetPlatform: text('target_platform').notNull(),
  cpuMs: doublePrecision('cpu_ms').notNull(),
  gpuMs: doublePrecision('gpu_ms').notNull(),
  drawCalls: integer('draw_calls').notNull(),
  memoryMb: doublePrecision('memory_mb').notNull(),
  fpsAvg: doublePrecision('fps_avg').notNull(),
  errorSummary: text('error_summary').default('').notNull(),
  logText: text('log_text').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const tickets = pgTable('tickets', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id')
    .references(() => projects.id)
    .notNull(),
  title: text('title').notNull(),
  department: text('department').notNull(),
  priority: text('priority').notNull(), // 'critical' | 'high' | 'medium' | 'low'
  status: text('status').notNull(), // 'open' | 'in_progress' | 'resolved'
  assignee: text('assignee').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const commits = pgTable('commits', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id')
    .references(() => projects.id)
    .notNull(),
  branch: text('branch').notNull(),
  hash: text('hash').notNull(),
  author: text('author').notNull(),
  message: text('message').notNull(),
  diffSummary: text('diff_summary').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const postLaunchMetrics = pgTable('post_launch_metrics', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id')
    .references(() => projects.id)
    .notNull(),
  dayLabel: text('day_label').notNull(),
  dau: integer('dau').notNull(),
  crashRate: doublePrecision('crash_rate').notNull(),
  avgFps: doublePrecision('avg_fps').notNull(),
  retentionPct: doublePrecision('retention_pct').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  projects: many(projects),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  owner: one(users, {
    fields: [projects.userId],
    references: [users.id],
  }),
  builds: many(builds),
  tickets: many(tickets),
  commits: many(commits),
  postLaunchMetrics: many(postLaunchMetrics),
}));

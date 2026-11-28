import { and, desc, eq } from 'drizzle-orm';
import { db } from './index.ts';
import { builds, commits, postLaunchMetrics, projects, tickets, users } from './schema.ts';

export async function getOrCreateUser(uid: string, email: string, displayName?: string) {
  try {
    const result = await db
      .insert(users)
      .values({
        uid,
        email,
        displayName: displayName || email.split('@')[0] || 'Studio Lead',
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email,
          ...(displayName ? { displayName } : {}),
        },
      })
      .returning();
    return result[0];
  } catch (error) {
    console.error('Database user upsert failed:', error);
    throw new Error('Failed to synchronize user account.', { cause: error });
  }
}

export async function listUserProjects(userId: number) {
  try {
    return await db
      .select()
      .from(projects)
      .where(eq(projects.userId, userId))
      .orderBy(desc(projects.updatedAt));
  } catch (error) {
    console.error('Failed to list projects:', error);
    throw new Error('Failed to load studio projects.', { cause: error });
  }
}

export async function upsertProjectRecord(
  userId: number,
  payload: {
    id?: number;
    title: string;
    genre: string;
    platform: string;
    prompt: string;
    gddJson: string;
    styleBibleJson: string;
    stateMachineJson: string;
    techDocsMd: string;
    activeBranch: string;
  }
) {
  try {
    if (payload.id) {
      const updated = await db
        .update(projects)
        .set({
          title: payload.title,
          genre: payload.genre,
          platform: payload.platform,
          prompt: payload.prompt,
          gddJson: payload.gddJson,
          styleBibleJson: payload.styleBibleJson,
          stateMachineJson: payload.stateMachineJson,
          techDocsMd: payload.techDocsMd,
          activeBranch: payload.activeBranch,
          updatedAt: new Date(),
        })
        .where(and(eq(projects.id, payload.id), eq(projects.userId, userId)))
        .returning();
      if (updated[0]) return updated[0];
    }
    const inserted = await db
      .insert(projects)
      .values({
        userId,
        title: payload.title,
        genre: payload.genre,
        platform: payload.platform,
        prompt: payload.prompt,
        gddJson: payload.gddJson,
        styleBibleJson: payload.styleBibleJson,
        stateMachineJson: payload.stateMachineJson,
        techDocsMd: payload.techDocsMd,
        activeBranch: payload.activeBranch,
      })
      .returning();
    return inserted[0];
  } catch (error) {
    console.error('Failed to save project:', error);
    throw new Error('Failed to save studio project.', { cause: error });
  }
}

export async function getProjectDetails(projectId: number) {
  try {
    const [proj] = await db.select().from(projects).where(eq(projects.id, projectId));
    if (!proj) return null;
    const [projBuilds, projTickets, projCommits, projMetrics] = await Promise.all([
      db.select().from(builds).where(eq(builds.projectId, projectId)).orderBy(desc(builds.createdAt)),
      db.select().from(tickets).where(eq(tickets.projectId, projectId)).orderBy(desc(tickets.createdAt)),
      db.select().from(commits).where(eq(commits.projectId, projectId)).orderBy(desc(commits.createdAt)),
      db.select().from(postLaunchMetrics).where(eq(postLaunchMetrics.projectId, projectId)),
    ]);
    return { project: proj, builds: projBuilds, tickets: projTickets, commits: projCommits, metrics: projMetrics };
  } catch (error) {
    console.error('Failed to load project details:', error);
    throw new Error('Failed to load project workspace data.', { cause: error });
  }
}

export async function insertBuildRecord(payload: {
  projectId: number;
  versionTag: string;
  status: string;
  targetPlatform: string;
  cpuMs: number;
  gpuMs: number;
  drawCalls: number;
  memoryMb: number;
  fpsAvg: number;
  errorSummary: string;
  logText: string;
}) {
  try {
    const [row] = await db.insert(builds).values(payload).returning();
    return row;
  } catch (error) {
    console.error('Failed to record build:', error);
    throw new Error('Failed to save build record.', { cause: error });
  }
}

export async function insertTicketRecord(payload: {
  projectId: number;
  title: string;
  department: string;
  priority: string;
  status: string;
  assignee: string;
}) {
  try {
    const [row] = await db.insert(tickets).values(payload).returning();
    return row;
  } catch (error) {
    console.error('Failed to create ticket:', error);
    throw new Error('Failed to create ticket.', { cause: error });
  }
}

export async function getTicketWithOwner(ticketId: number) {
  try {
    const rows = await db
      .select({
        ticketId: tickets.id,
        projectId: tickets.projectId,
        userId: projects.userId,
      })
      .from(tickets)
      .innerJoin(projects, eq(tickets.projectId, projects.id))
      .where(eq(tickets.id, ticketId));
    return rows[0] ?? null;
  } catch (error) {
    console.error('Failed to look up ticket owner:', error);
    throw new Error('Failed to verify ticket ownership.', { cause: error });
  }
}

export async function updateTicketStatusRecord(ticketId: number, projectId: number, status: string) {
  try {
    const [row] = await db
      .update(tickets)
      .set({ status })
      .where(and(eq(tickets.id, ticketId), eq(tickets.projectId, projectId)))
      .returning();
    return row;
  } catch (error) {
    console.error('Failed to update ticket:', error);
    throw new Error('Failed to update ticket status.', { cause: error });
  }
}

export async function insertCommitRecord(payload: {
  projectId: number;
  branch: string;
  hash: string;
  author: string;
  message: string;
  diffSummary: string;
}) {
  try {
    const [row] = await db.insert(commits).values(payload).returning();
    return row;
  } catch (error) {
    console.error('Failed to create commit:', error);
    throw new Error('Failed to record commit.', { cause: error });
  }
}

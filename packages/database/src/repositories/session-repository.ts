import { eq, desc, inArray } from 'drizzle-orm';
import { KaraokeDatabase } from '../connection.js';
import { karaokeSessionsTable } from '../schema.js';
import { SessionDTO, SessionStatus } from '@karaoke/contracts';
import { randomUUID } from 'node:crypto';

export class SessionRepository {
  constructor(private db: KaraokeDatabase) {}

  public getLatestActiveSession(): SessionDTO | null {
    const row = this.db
      .select()
      .from(karaokeSessionsTable)
      .where(inArray(karaokeSessionsTable.status, ['OPEN', 'PAUSED']))
      .orderBy(desc(karaokeSessionsTable.openedAt))
      .limit(1)
      .all()[0];

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      name: row.name,
      status: row.status as SessionStatus,
      openedAt: row.openedAt,
      closedAt: row.closedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  public getSessionById(sessionId: string): SessionDTO | null {
    const row = this.db
      .select()
      .from(karaokeSessionsTable)
      .where(eq(karaokeSessionsTable.id, sessionId))
      .get();
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      status: row.status as SessionStatus,
      openedAt: row.openedAt,
      closedAt: row.closedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  public openSession(name: string): SessionDTO {
    const now = new Date().toISOString();
    const session: SessionDTO = {
      id: randomUUID(),
      name,
      status: 'OPEN',
      openedAt: now,
      closedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    this.db
      .insert(karaokeSessionsTable)
      .values({
        id: session.id,
        name: session.name,
        status: session.status,
        openedAt: session.openedAt,
        closedAt: session.closedAt,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
      })
      .run();

    return session;
  }

  public pauseSession(sessionId: string): SessionDTO | null {
    const now = new Date().toISOString();
    this.db
      .update(karaokeSessionsTable)
      .set({
        status: 'PAUSED',
        updatedAt: now,
      })
      .where(eq(karaokeSessionsTable.id, sessionId))
      .run();
    return this.getSessionById(sessionId);
  }

  public resumeSession(sessionId: string): SessionDTO | null {
    const now = new Date().toISOString();
    this.db
      .update(karaokeSessionsTable)
      .set({
        status: 'OPEN',
        updatedAt: now,
      })
      .where(eq(karaokeSessionsTable.id, sessionId))
      .run();
    return this.getSessionById(sessionId);
  }

  public closeSession(sessionId: string): void {
    const now = new Date().toISOString();
    this.db
      .update(karaokeSessionsTable)
      .set({
        status: 'CLOSED',
        closedAt: now,
        updatedAt: now,
      })
      .where(eq(karaokeSessionsTable.id, sessionId))
      .run();
  }
}

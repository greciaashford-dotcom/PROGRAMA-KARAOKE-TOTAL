import { eq, desc } from 'drizzle-orm';
import { KaraokeDatabase } from '../connection.js';
import { singersTable } from '../schema.js';
import { SingerDTO, CreateSingerDTO } from '@karaoke/contracts';
import { randomUUID } from 'node:crypto';

export class SingerRepository {
  constructor(private db: KaraokeDatabase) {}

  public createSinger(data: CreateSingerDTO): SingerDTO {
    const now = new Date().toISOString();
    const singer: SingerDTO = {
      id: randomUUID(),
      sessionId: data.sessionId,
      displayName: data.displayName.trim(),
      tableOrLocation: data.tableOrLocation?.trim() || null,
      notes: data.notes?.trim() || null,
      createdAt: now,
      updatedAt: now,
    };

    this.db
      .insert(singersTable)
      .values({
        id: singer.id,
        sessionId: singer.sessionId,
        displayName: singer.displayName,
        tableOrLocation: singer.tableOrLocation,
        notes: singer.notes,
        createdAt: singer.createdAt,
        updatedAt: singer.updatedAt,
      })
      .run();

    return singer;
  }

  public listSingers(sessionId: string): SingerDTO[] {
    const rows = this.db
      .select()
      .from(singersTable)
      .where(eq(singersTable.sessionId, sessionId))
      .orderBy(desc(singersTable.createdAt))
      .all();

    return rows.map((r) => ({
      id: r.id,
      sessionId: r.sessionId,
      displayName: r.displayName,
      tableOrLocation: r.tableOrLocation,
      notes: r.notes,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  }

  public getSingerById(singerId: string): SingerDTO | null {
    const row = this.db.select().from(singersTable).where(eq(singersTable.id, singerId)).get();
    if (!row) return null;

    return {
      id: row.id,
      sessionId: row.sessionId,
      displayName: row.displayName,
      tableOrLocation: row.tableOrLocation,
      notes: row.notes,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}

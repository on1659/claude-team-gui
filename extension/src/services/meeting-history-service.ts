import * as vscode from 'vscode';
import type { HistoryEntry, HistoryListItem } from '../types/messages';

export type { HistoryEntry, HistoryListItem };

const HISTORY_DIR = '.claude-team/history';

export class MeetingHistoryService {
  constructor(private readonly workspaceRoot: vscode.Uri | undefined) {}

  /** Sanitize meetingId to prevent path traversal */
  private safeName(meetingId: string): string {
    return meetingId.replace(/[^a-zA-Z0-9_-]/g, '');
  }

  /** Save a completed meeting to history */
  async save(meetingId: string, data: HistoryEntry): Promise<void> {
    const dir = this.getHistoryDir();
    if (!dir) return;

    // Ensure directory exists
    await this.ensureDir(dir);

    const fileUri = vscode.Uri.joinPath(dir, `${this.safeName(meetingId)}.json`);
    const content = JSON.stringify(data, null, 2);
    await vscode.workspace.fs.writeFile(fileUri, Buffer.from(content, 'utf-8'));
  }

  /** List recent meetings (newest first), paginated */
  async list(page: number, pageSize: number): Promise<{ items: HistoryListItem[]; total: number }> {
    const dir = this.getHistoryDir();
    if (!dir) return { items: [], total: 0 };

    let entries: [string, vscode.FileType][];
    try {
      entries = await vscode.workspace.fs.readDirectory(dir);
    } catch {
      // Directory doesn't exist yet
      return { items: [], total: 0 };
    }

    // Filter only .json files
    const jsonFiles = entries
      .filter(([name, type]) => type === vscode.FileType.File && name.endsWith('.json'))
      .map(([name]) => name);

    // Load all entries to sort by timestamp (files may not be named in timestamp order)
    const listItems: HistoryListItem[] = [];
    for (const fileName of jsonFiles) {
      try {
        const fileUri = vscode.Uri.joinPath(dir, fileName);
        const raw = await vscode.workspace.fs.readFile(fileUri);
        const entry: HistoryEntry = JSON.parse(Buffer.from(raw).toString('utf-8'));
        listItems.push({
          meetingId: entry.meetingId,
          topic: entry.topic,
          timestamp: entry.timestamp,
          mode: entry.mode,
          participantCount: entry.participants.length,
        });
      } catch {
        // Skip corrupted files
      }
    }

    // Sort by timestamp descending (newest first)
    listItems.sort((a, b) => b.timestamp - a.timestamp);

    const total = listItems.length;
    const start = page * pageSize;
    const items = listItems.slice(start, start + pageSize);

    return { items, total };
  }

  /** Load full meeting data by ID */
  async load(meetingId: string): Promise<HistoryEntry | null> {
    const dir = this.getHistoryDir();
    if (!dir) return null;

    try {
      const fileUri = vscode.Uri.joinPath(dir, `${this.safeName(meetingId)}.json`);
      const raw = await vscode.workspace.fs.readFile(fileUri);
      return JSON.parse(Buffer.from(raw).toString('utf-8')) as HistoryEntry;
    } catch {
      return null;
    }
  }

  /** Delete a meeting from history */
  async delete(meetingId: string): Promise<void> {
    const dir = this.getHistoryDir();
    if (!dir) return;

    try {
      const fileUri = vscode.Uri.joinPath(dir, `${this.safeName(meetingId)}.json`);
      await vscode.workspace.fs.delete(fileUri);
    } catch {
      // File may not exist
    }
  }

  private getHistoryDir(): vscode.Uri | null {
    if (!this.workspaceRoot) return null;
    return vscode.Uri.joinPath(this.workspaceRoot, HISTORY_DIR);
  }

  private async ensureDir(uri: vscode.Uri): Promise<void> {
    try {
      await vscode.workspace.fs.stat(uri);
    } catch {
      await vscode.workspace.fs.createDirectory(uri);
    }
  }
}

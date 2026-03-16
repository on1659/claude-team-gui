import { Uri, workspace } from 'vscode';
import type { TeamData, TeamMember } from '../types/team';

export class ProfileManager {
  private members: TeamMember[] = [];

  constructor(private readonly extensionUri: Uri) {}

  async load(): Promise<TeamMember[]> {
    try {
      const uri = Uri.joinPath(this.extensionUri, 'data', 'team.json');
      const raw = await workspace.fs.readFile(uri);
      const data: TeamData = JSON.parse(Buffer.from(raw).toString('utf-8'));

      if (!data.members || !Array.isArray(data.members)) {
        throw new Error('Invalid team.json: missing members array');
      }

      this.members = data.members;

      // Load skill files for each member
      await this.loadSkillFiles();

      return this.members;
    } catch (err: any) {
      console.error('[Claude Team] Failed to load team.json:', err.message);
      this.members = [];
      return [];
    }
  }

  private async loadSkillFiles(): Promise<void> {
    const tasks = this.members
      .filter(m => m.skillFile)
      .map(async (member) => {
        try {
          const skillUri = Uri.joinPath(this.extensionUri, 'data', 'skills', member.skillFile!);
          const raw = await workspace.fs.readFile(skillUri);
          member.skillContent = Buffer.from(raw).toString('utf-8');
        } catch {
          console.warn(`[Claude Team] Skill file not found: ${member.skillFile}`);
        }
      });
    await Promise.all(tasks);
  }

  getMembers(): TeamMember[] {
    return this.members;
  }

  getActiveMembers(): TeamMember[] {
    return this.members.filter(m => m.active);
  }

  getMember(id: string): TeamMember | undefined {
    return this.members.find(m => m.id === id);
  }

  toggleMember(id: string): boolean {
    const member = this.members.find(m => m.id === id);
    if (!member) return false;
    member.active = !member.active;
    return member.active;
  }
}

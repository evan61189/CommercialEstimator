/**
 * Google Drive file management via Zapier MCP.
 *
 * Zapier MCP provides actions like:
 * - google_drive_create_folder
 * - google_drive_upload_file
 * - google_sheets_create_spreadsheet
 * - google_sheets_add_rows
 * - google_docs_create_document
 *
 * This module wraps those actions into a clean interface
 * that agents use to save their outputs.
 */

export interface DriveFolder {
  id: string;
  name: string;
  path: string;
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  url: string;
  folderId: string;
}

/**
 * Standard project folder structure in Google Drive:
 *
 * Projects/
 * └── {Project Name}/
 *     ├── 01 - Drawings/
 *     ├── 02 - Specifications/
 *     ├── 03 - Scope Analysis/
 *     ├── 04 - RFPs/
 *     ├── 05 - RFIs/
 *     ├── 06 - Bids & Bid Leveling/
 *     ├── 07 - Budgets & Estimates/
 *     ├── 08 - Proposals/
 *     ├── 09 - Contracts & Sub Agreements/
 *     ├── 10 - Purchase Orders/
 *     ├── 11 - Insurance & COIs/
 *     ├── 12 - Submittals/
 *     ├── 13 - Meeting Notes/
 *     ├── 14 - Transmittals/
 *     └── 15 - Correspondence/
 */
export const PROJECT_FOLDERS = [
  '01 - Drawings',
  '02 - Specifications',
  '03 - Scope Analysis',
  '04 - RFPs',
  '05 - RFIs',
  '06 - Bids & Bid Leveling',
  '07 - Budgets & Estimates',
  '08 - Proposals',
  '09 - Contracts & Sub Agreements',
  '10 - Purchase Orders',
  '11 - Insurance & COIs',
  '12 - Submittals',
  '13 - Meeting Notes',
  '14 - Transmittals',
  '15 - Correspondence',
] as const;

/** Map output types to their destination folder */
export const OUTPUT_FOLDER_MAP: Record<string, string> = {
  'scope-analysis': '03 - Scope Analysis',
  'rfp':            '04 - RFPs',
  'rfi':            '05 - RFIs',
  'bid-leveling':   '06 - Bids & Bid Leveling',
  'budget':         '07 - Budgets & Estimates',
  'proposal':       '08 - Proposals',
  'sub-agreement':  '09 - Contracts & Sub Agreements',
  'purchase-order': '10 - Purchase Orders',
  'coi-review':     '11 - Insurance & COIs',
  'meeting-notes':  '13 - Meeting Notes',
  'transmittal':    '14 - Transmittals',
};

export class DriveClient {
  private webhookUrl: string | null;
  private rootFolderId: string | null;

  constructor() {
    this.webhookUrl = process.env.ZAPIER_MCP_WEBHOOK_URL || null;
    this.rootFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER || null;
  }

  get isConfigured(): boolean {
    return !!this.webhookUrl;
  }

  /**
   * Call a Zapier MCP action.
   * In production, this hits your Zapier MCP webhook.
   * Returns the action result or null if not configured.
   */
  private async callAction(action: string, params: Record<string, unknown>): Promise<Record<string, unknown> | null> {
    if (!this.webhookUrl) {
      console.log(`[Drive] Not configured. Would call: ${action}`, params);
      return null;
    }

    const response = await fetch(this.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, params }),
    });

    if (!response.ok) {
      throw new Error(`Zapier MCP action failed: ${response.statusText}`);
    }

    return response.json();
  }

  /** Create the standard project folder structure */
  async createProjectFolders(projectName: string): Promise<{ rootId: string; folders: Record<string, string> }> {
    // Create project root folder
    const root = await this.callAction('google_drive_create_folder', {
      name: projectName,
      parentId: this.rootFolderId,
    });

    const rootId = (root?.id as string) || `sim-${projectName}`;
    const folders: Record<string, string> = {};

    // Create each subfolder
    for (const folder of PROJECT_FOLDERS) {
      const result = await this.callAction('google_drive_create_folder', {
        name: folder,
        parentId: rootId,
      });
      folders[folder] = (result?.id as string) || `sim-${folder}`;
    }

    return { rootId, folders };
  }

  /** Create a Google Sheets spreadsheet with data */
  async createSpreadsheet(
    name: string,
    folderId: string,
    sheets: { sheetName: string; headers: string[]; rows: (string | number | null)[][] }[]
  ): Promise<DriveFile> {
    const result = await this.callAction('google_sheets_create_spreadsheet', {
      name,
      folderId,
      sheets,
    });

    return {
      id: (result?.id as string) || `sim-sheet-${Date.now()}`,
      name,
      mimeType: 'application/vnd.google-apps.spreadsheet',
      url: (result?.url as string) || `https://docs.google.com/spreadsheets/d/simulated`,
      folderId,
    };
  }

  /** Create a Google Doc with content */
  async createDocument(
    name: string,
    folderId: string,
    content: string
  ): Promise<DriveFile> {
    const result = await this.callAction('google_docs_create_document', {
      name,
      folderId,
      content,
    });

    return {
      id: (result?.id as string) || `sim-doc-${Date.now()}`,
      name,
      mimeType: 'application/vnd.google-apps.document',
      url: (result?.url as string) || `https://docs.google.com/document/d/simulated`,
      folderId,
    };
  }

  /** Append rows to an existing Google Sheet */
  async appendRows(
    spreadsheetId: string,
    sheetName: string,
    rows: (string | number | null)[][]
  ): Promise<void> {
    await this.callAction('google_sheets_add_rows', {
      spreadsheetId,
      sheetName,
      rows,
    });
  }
}

// Singleton
const globalKey = '__driveClient';
export function getDriveClient(): DriveClient {
  const g = globalThis as Record<string, unknown>;
  if (!g[globalKey]) {
    g[globalKey] = new DriveClient();
  }
  return g[globalKey] as DriveClient;
}

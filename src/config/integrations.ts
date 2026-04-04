export interface IntegrationConfig {
  zapierMcp: {
    enabled: boolean;
    webhookUrl: string | null;
    googleDrive: {
      enabled: boolean;
      rootFolderId: string | null;
    };
  };
  gmail: {
    enabled: boolean;
    inboxMonitorInterval: number;
    targetAddress: string | null;
  };
}

export const integrations: IntegrationConfig = {
  zapierMcp: {
    enabled: !!process.env.ZAPIER_MCP_WEBHOOK_URL,
    webhookUrl: process.env.ZAPIER_MCP_WEBHOOK_URL || null,
    googleDrive: {
      enabled: !!process.env.GOOGLE_DRIVE_ROOT_FOLDER,
      rootFolderId: process.env.GOOGLE_DRIVE_ROOT_FOLDER || null,
    },
  },
  gmail: {
    enabled: false, // Future feature
    inboxMonitorInterval: 30000,
    targetAddress: process.env.GMAIL_TARGET_ADDRESS || null,
  },
};

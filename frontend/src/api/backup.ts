import apiClient from "./client";

export interface BackupSettings {
  auto_backup_enabled: boolean;
  interval_days: number;
  interval_minutes?: number;
  target_directory: string;
  backup_format: "bak" | "json" | "both";
  single_file_overwrite: boolean;
  cloud_backup_enabled: boolean;
  cloud_provider: "gdrive" | "s3" | "webhook";
  gdrive?: {
    folder_id?: string;
    access_token?: string;
    file_id?: string;
  };
  s3?: {
    bucket?: string;
    endpoint_url?: string;
    access_key?: string;
    secret_key?: string;
    region?: string;
  };
  webhook?: {
    webhook_url?: string;
    secret_header?: string;
  };
  last_backup_timestamp?: string;
  last_backup_path?: string;
  cloud_last_sync_status?: string;
  cloud_last_sync_message?: string;
  cloud_last_sync_timestamp?: string;
}

export const backupApi = {
  getBackupSettings: async (): Promise<BackupSettings> => {
    const res = await apiClient.get<BackupSettings>("/api/v1/backup/settings");
    return res.data;
  },

  saveBackupSettings: async (settings: Partial<BackupSettings>): Promise<any> => {
    const res = await apiClient.post("/api/v1/backup/settings", settings);
    return res.data;
  },

  triggerAutoBackupNow: async (): Promise<any> => {
    const res = await apiClient.post("/api/v1/backup/trigger-auto");
    return res.data;
  },

  testCloudUpload: async (): Promise<any> => {
    const res = await apiClient.post("/api/v1/backup/test-cloud-upload");
    return res.data;
  },

  browseFolder: async (initialDir?: string): Promise<{ success: boolean; folder_path: string; message?: string }> => {
    const res = await apiClient.post("/api/v1/backup/browse-folder", { initial_dir: initialDir || "" }, { timeout: 120000 });
    return res.data;
  },
};

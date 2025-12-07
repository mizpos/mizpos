export interface AppVersionInfo {
  version: string;
  commitHash: string;
  buildTimestamp: string;
  buildDate: string;
}

export const getVersionInfo = (): AppVersionInfo => {
  const buildTimestamp = __BUILD_TIMESTAMP__;
  const buildDate = new Date(buildTimestamp).toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Tokyo",
  });

  return {
    version: __APP_VERSION__,
    commitHash: __COMMIT_HASH__,
    buildTimestamp,
    buildDate,
  };
};

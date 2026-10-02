export interface VibrappDmPushPayload {
  title: string;
  body: string;
  icon?: string;
  url?: string;
  type?: string;
}

export async function sendVibrappDmPushIfBackground(
  recipientProfileId: string,
  payload: VibrappDmPushPayload,
  isForeground: (profileId: string) => boolean,
  sendPush: (profileId: string, payload: VibrappDmPushPayload) => Promise<void> | void,
): Promise<boolean> {
  if (isForeground(recipientProfileId)) return false;
  await sendPush(recipientProfileId, payload);
  return true;
}
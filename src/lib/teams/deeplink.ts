// ─────────────────────────────────────────────────────────────
// Teams Deep Link Builder
// ─────────────────────────────────────────────────────────────
// Opens a 1:1 chat in the Teams desktop/web client with a
// pre-filled message. Zero config required — works if the user
// has Teams installed.
//
// @see https://learn.microsoft.com/en-us/microsoftteams/platform/concepts/build-and-test/deep-link-workflow

/**
 * Build a Teams deep link that opens a 1:1 chat with the recipient
 * and pre-fills the message body.
 *
 * @param recipientEmail  - The recipient's Microsoft 365 / Teams email
 * @param message         - Pre-filled message text (will be URI-encoded)
 * @returns               - `msteams://` deep link URL
 */
export function buildTeamsDMDeepLink(recipientEmail: string, message: string): string {
  const encodedMessage = encodeURIComponent(message);
  return `https://teams.microsoft.com/l/chat/0/0?users=${encodeURIComponent(recipientEmail)}&message=${encodedMessage}`;
}

/**
 * Build a Teams deep link that opens a group chat with multiple recipients.
 *
 * @param emails  - Array of recipient email addresses
 * @param message - Pre-filled message text
 * @param topic   - Optional chat topic / title
 */
export function buildTeamsGroupChatLink(emails: string[], message: string, topic?: string): string {
  const users = emails.map(encodeURIComponent).join(',');
  const encodedMsg = encodeURIComponent(message);

  let url = `https://teams.microsoft.com/l/chat/0/0?users=${users}&message=${encodedMsg}`;

  if (topic) {
    url += `&topicName=${encodeURIComponent(topic)}`;
  }

  return url;
}

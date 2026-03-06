import { buildTeamsDMDeepLink, buildTeamsGroupChatLink } from '@/lib/teams/deeplink';
import { describe, expect, it } from 'vitest';

describe('Teams Deep Links', () => {
  describe('buildTeamsDMDeepLink', () => {
    it('builds a valid 1:1 chat deep link', () => {
      const url = buildTeamsDMDeepLink('jane@example.com', 'Hello Jane!');

      expect(url).toContain('https://teams.microsoft.com/l/chat/0/0');
      expect(url).toContain('users=jane%40example.com');
      expect(url).toContain('message=Hello%20Jane!');
    });

    it('encodes special characters in the message', () => {
      const url = buildTeamsDMDeepLink('user@test.com', 'PR #42 & review');

      expect(url).toContain('message=PR%20%2342%20%26%20review');
    });
  });

  describe('buildTeamsGroupChatLink', () => {
    it('builds a group chat link with multiple users', () => {
      const url = buildTeamsGroupChatLink(['a@test.com', 'b@test.com'], 'Review needed');

      expect(url).toContain('users=a%40test.com,b%40test.com');
      expect(url).toContain('message=Review%20needed');
    });

    it('includes topic when provided', () => {
      const url = buildTeamsGroupChatLink(['a@test.com'], 'Review needed', 'PR #42');

      expect(url).toContain('topicName=PR%20%2342');
    });
  });
});

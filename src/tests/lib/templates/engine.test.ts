import { extractVariables, getSampleContext, renderTemplate, validateTemplate } from '@/lib/templates/engine';
import { describe, expect, it } from 'vitest';

describe('Template Engine', () => {
    const context = getSampleContext();

    describe('renderTemplate', () => {
        it('replaces known variables with context values', () => {
            const template = 'Hi {receiverName}, please review PR #{prNumber}';
            const result = renderTemplate(template, context);
            expect(result).toBe(`Hi ${context.receiverName}, please review PR #${context.prNumber}`);
        });

        it('leaves unknown variables untouched', () => {
            const template = 'Hello {unknownVar}!';
            const result = renderTemplate(template, context);
            expect(result).toBe('Hello {unknownVar}!');
        });

        it('handles template with no variables', () => {
            const template = 'Please review this PR.';
            const result = renderTemplate(template, context);
            expect(result).toBe('Please review this PR.');
        });

        it('handles empty template', () => {
            const result = renderTemplate('', context);
            expect(result).toBe('');
        });

        it('HTML-escapes variable values when escapeHtml option is true', () => {
            const htmlContext = {
                ...context,
                prTitle: '<script>alert("xss")</script>&"\''
            };
            const result = renderTemplate('{prTitle}', htmlContext, { escapeHtml: true });
            expect(result).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;&amp;&quot;&#39;');
        });

        it('does not escape HTML when escapeHtml option is false or omitted', () => {
            const htmlContext = { ...context, prTitle: '<b>bold</b>' };
            expect(renderTemplate('{prTitle}', htmlContext)).toBe('<b>bold</b>');
            expect(renderTemplate('{prTitle}', htmlContext, { escapeHtml: false })).toBe('<b>bold</b>');
        });
    });

    describe('extractVariables', () => {
        it('extracts all variable names from a template', () => {
            const template = '{senderName} asks {receiverName} to review {prTitle}';
            const vars = extractVariables(template);
            expect(vars).toEqual(['senderName', 'receiverName', 'prTitle']);
        });

        it('returns unique variables', () => {
            const template = '{prTitle} - {prTitle}';
            const vars = extractVariables(template);
            expect(vars).toEqual(['prTitle']);
        });

        it('returns empty array for no variables', () => {
            const vars = extractVariables('No variables here');
            expect(vars).toEqual([]);
        });
    });

    describe('validateTemplate', () => {
        it('returns valid for a correct template', () => {
            const result = validateTemplate('Hi {receiverName}, check {prUrl}');
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
            expect(result.unknownVariables).toHaveLength(0);
        });

        it('flags unknown variables', () => {
            const result = validateTemplate('Hi {foo}, check {bar}');
            expect(result.valid).toBe(false);
            expect(result.unknownVariables).toEqual(['foo', 'bar']);
        });

        it('flags empty templates', () => {
            const result = validateTemplate('   ');
            expect(result.valid).toBe(false);
            expect(result.errors[0]).toContain('empty');
        });

        it('flags unbalanced braces', () => {
            const result = validateTemplate('Hi {receiverName');
            expect(result.valid).toBe(false);
            expect(result.errors).toEqual(expect.arrayContaining([expect.stringContaining('braces')]));
        });
    });
});

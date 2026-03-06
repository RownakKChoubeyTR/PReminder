---
name: create-skill
description: Expert guidance for creating, writing, and refining Claude Code Skills. Use when creating SKILL.md files, authoring new skills, improving existing skills, or understanding skill structure and best practices.
disable-model-invocation: true
argument-hint: <description of skill>
---

# Creating Agent Skills

This skill teaches how to create effective Claude Code Skills following the official specification.

## Required Input

**IMPORTANT:** This skill requires a description of the skill to be created.

If the user invokes `/create-skill` without providing a description:

1. **Do NOT proceed** with creating the skill
2. **Ask the user** to provide a description of what the skill should do
3. **Wait for their response** before continuing

Example prompt to use:

> What should this skill do? Please describe its purpose and when it should be used.

Only after receiving a description should you proceed with the skill creation process.

## Core Principles

### 1. Skills Are Prompts

All prompting best practices apply. Be clear, be direct. Assume Claude is smart - only add context Claude doesn't have.

### 2. Standard Markdown Format

Use YAML frontmatter + markdown body. **No XML tags** - use standard markdown headings.

```markdown
---
name: my-skill-name
description: What it does and when to use it
---

# My Skill Name

## Quick Start

Immediate actionable guidance...

## Instructions

Step-by-step procedures...

## Examples

Concrete usage examples...
```

### 3. Progressive Disclosure

Keep SKILL.md under 500 lines. Split detailed content into reference files. Load only what's needed.

```
skill-name/
├── SKILL.md              # Entry point (required)
├── references/           # Detailed docs (loaded when needed)
│   └── REFERENCE.md
└── scripts/              # Utility scripts (executed, not loaded)
```

### 4. Effective Descriptions

The description field enables skill discovery. Include both what the skill does AND when to use it.

## Skill Structure

### Required Frontmatter

| Field           | Required | Max Length | Description                              |
| --------------- | -------- | ---------- | ---------------------------------------- |
| `name`          | Yes      | 64 chars   | Lowercase letters, numbers, hyphens only |
| `description`   | Yes      | 1024 chars | What it does AND when to use it          |
| `allowed-tools` | No       | -          | Tools Claude can use without asking      |
| `argument-hint` | No       | -          | Hint for expected argument format        |

### Naming Conventions

**Command-like skills** (called via `/skill-name`). Use infinitive form:

- `review-code`
- `explain-code`
- `create-skill`
- `test`

**On-demand skills** (loaded automatically when relevant). Use gerund form:

- `migrating-components`
- `analyzing-performance`

**Avoid:** `helper`, `utils`, `tools`, `anthropic-*`, `claude-*`

**Namespacing:** Use prefix to group related skills:

- `angularjs-migrate`, `angularjs-plan` (groups together alphabetically)
- When typing `/angularjs` all related skills appear in autocomplete

**Rules:**

- Lowercase letters, numbers, and hyphens only
- Must not start or end with hyphen
- No consecutive hyphens (`--`)
- Must match parent directory name

### Body Structure

Use standard markdown headings:

```markdown
# Skill Name

## Quick Start

Fastest path to value...

## Instructions

Core guidance Claude follows...

## Examples

Input/output pairs showing expected behavior...

## Guidelines

Rules and constraints...

## Advanced Features

Additional capabilities (link to reference files)...
```

## Creating a New Skill

### Step 1: Choose Type

**Simple skill (single file):**

- Under 500 lines
- Self-contained guidance
- No complex workflows

**Progressive disclosure skill (multiple files):**

- SKILL.md as overview
- Reference files for detailed docs
- Scripts for utilities

### Step 2: Create Directory Structure

```
.claude/skills/your-skill-name/
├── SKILL.md              # Required - main instructions
├── references/           # Optional - detailed documentation
│   └── REFERENCE.md
├── scripts/              # Optional - executable utilities
│   └── helper.sh
└── assets/               # Optional - templates, images, data
    └── template.md
```

### Step 3: Write SKILL.md

```markdown
---
name: your-skill-name
description: [What it does]. Use when [trigger conditions].
---

# Your Skill Name

## Quick Start

[Immediate actionable example]

## Instructions

[Core guidance - numbered steps work well]

1. First, do this
2. Then, do that
3. Finally, verify

## Examples

**Example 1: [Scenario]**

Input: [description]

Output: [result]

## Guidelines

- [Constraint 1]
- [Constraint 2]
```

### Step 4: Add Reference Files (If Needed)

Link from SKILL.md to detailed content:

```markdown
For detailed API reference, see [REFERENCE.md](references/REFERENCE.md).
```

Keep references **one level deep** from SKILL.md.

### Step 5: Add Scripts (If Needed)

Optionally add executable scripts for complex tasks:

```bash
./scripts/analyze.sh input.txt
```

## Auditing Existing Skills

Check against this rubric:

- [ ] Valid YAML frontmatter (name + description)
- [ ] Description includes trigger keywords ("Use when...")
- [ ] Uses standard markdown headings (not XML tags)
- [ ] SKILL.md under 500 lines
- [ ] References one level deep maximum
- [ ] Examples are concrete, not abstract
- [ ] Consistent terminology throughout
- [ ] Scripts handle errors explicitly

## Common Patterns

### Conditional Pattern

For skills supporting multiple frameworks or variants, organize by variant:

```
cloud-deploy/
├── SKILL.md (workflow + provider selection)
└── references/
    ├── aws.md (AWS deployment patterns)
    ├── gcp.md (GCP deployment patterns)
    └── azure.md (Azure deployment patterns)
```

When a user asks about AWS deployment, Claude only reads aws.md

### Workflow Pattern

For complex multi-step tasks:

```markdown
## Migration Workflow

Follow these steps in order:

1. **Backup** - Run `./scripts/backup.sh`
2. **Migrate** - Execute the migration
3. **Validate** - Check the results
4. **Update config** - Apply new settings
```

### Checklist Pattern

For tasks requiring verification:

```markdown
## Pre-Release Checklist

Copy and complete:

- [ ] Tests passing
- [ ] Documentation updated
- [ ] Version bumped
- [ ] Changelog entry added
```

## Anti-Patterns to Avoid

| Anti-Pattern        | Problem               | Solution                        |
| ------------------- | --------------------- | ------------------------------- |
| XML tags in body    | Not standard markdown | Use markdown headings           |
| Vague descriptions  | Poor skill discovery  | Include trigger keywords        |
| Deep nesting        | Hard to navigate      | Keep references one level deep  |
| Too many options    | Decision paralysis    | Provide a default path          |
| Time-sensitive info | Becomes outdated      | Use relative references         |
| No examples         | Unclear expectations  | Add concrete input/output pairs |

## Success Criteria

A well-structured skill:

1. Has valid YAML frontmatter with descriptive name and description
2. Uses standard markdown headings (not XML tags)
3. Keeps SKILL.md under 500 lines
4. Links to reference files for detailed content
5. Includes concrete examples with input/output pairs
6. Has been tested with real usage

## Reference

For the complete official specification, see [official-spec.md](references/official-spec.md).

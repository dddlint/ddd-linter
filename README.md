# ddd-linter
Core component to linting files with a Domain Driven Design glossary

## Overview
This tool helps maintain Domain-Driven Design glossaries by analyzing codebase content to extract domain models and their relationships. It works with [Contextive](https://contextive.tech/)-compatible glossary YAML files.

### Glossary Format
The tool generates glossaries in the Contextive format:

```yaml
contexts:
  - name: DomainName
    domainVisionStatement: "A short statement about the domain's purpose"
    meta:
      "🙂 Owner:": "Team Name"
    terms:
      - name: TermName
        definition: Definition of the term
        examples:
          - Example of the term in use
        aliases:
          - AlternativeName
        related:
          - RelatedTerm
```

## Installation
```bash
git clone https://github.com/yourusername/ddd-linter.git
cd ddd-linter
npm install
npm run build
```

## Usage
```bash
# Basic usage
npm start -- --repo-url https://github.com/example/glossary.git --domain payments --files ".*\\.ts$"

# Analyze files in a specific directory path
npm start -- --repo-url https://github.com/example/glossary.git --domain payments --files "../project-src"

# Analyze files in a parent directory with a pattern
npm start -- --repo-url https://github.com/example/glossary.git --domain allmythings --files "../all-my-things/src"
```

### Parameters
- `--repo-url`: URL of the glossary repository to clone
- `--domain`: Domain name for the glossary (will create domains/{domain}.glossary.yml)
- `--files`: Path or pattern of files to analyze with Claude (required)
  - Can be a directory path (e.g., "../all-my-things/src")
  - Can be a regex pattern (e.g., ".*\\.ts$")
  - Can access files in parent directories

## Requirements
- Node.js 16+
- Git
- Claude CLI installed and configured
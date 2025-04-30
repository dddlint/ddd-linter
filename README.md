# ddd-linter

**Align your code with your domain language.**

`ddd-linter` is an open-source tool that helps Domain-Driven Design (DDD) teams maintain alignment between the **ubiquitous language** defined in their bounded contexts and the terminology used in their code.

This project is built on the insight that DDD is not just about modeling -- it’s about communication. And communication works best when the language we use is consistent, intentional, and shared.


## Why this project?

We’re building a feedback loop between two complementary kinds of analysis:

- A **code linter** that checks whether code reflects the current domain language, flagging mismatches and gaps.
- A **meaning extractor** that proposes glossary updates based on how teams actually speak and write—in documentation, Slack, meetings, and beyond.

These are two halves of a continuous refinement cycle:

- 🔍 **The linter** ensures code conforms to the documented language.
- 🧠 **The extractor** helps evolve the language based on how it’s really used.

To keep things modular and extensible, we are separating these responsibilities into cleanly defined packages.

## Project Structure

```
ddd-linter/
├── src/
│   ├── linter-core/          # Static glossary vs. code linter (AST-based)
│   ├── extractor-core/       # Interfaces & utilities for multi-source meaning extraction
│   └── ai-extractor/         # Claude/OpenAI integration
├── docs/                     # Architecture decision records, etc.
```


## Getting Started

### 1. Create a Glossary

Create a glossary file using the format defined by [Contextive](https://docs.contextive.tech/community/guides/defining-terminology/)

## Philosophy

This tool is not about enforcing correctness through rigid rules. It’s about enabling shared understanding and continuous learning through lightweight, practical feedback loops.

## Contributing

We welcome contributions from developers, modelers, and domain experts. See [CONTRIBUTING.md] for how to get involved.

## License

MIT — see [LICENSE]

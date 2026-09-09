Mermaid files and rendering instructions

Files added here:
- follow-up-work.mmd  — flowchart describing follow-up diagram work
- roadmap-follow-up.mmd — Gantt roadmap for follow-up tasks

How to preview Mermaid files locally

Options:
- VS Code: install the "Markdown Preview Mermaid Support" or "Mermaid Preview" extension and open the .mmd file or a markdown file that embeds the Mermaid block.
- CLI: use mermaid-cli (mmdc) to render to PNG/SVG. Example:
  - npm install -g @mermaid-js/mermaid-cli
  - mmdc -i docs/09-diagrams/follow-up-work.mmd -o follow-up-work.png

Embedding in Markdown

Wrap the Mermaid content in a markdown file using triple backticks and the `mermaid` language tag, for example:

```markdown
```mermaid
<paste content of .mmd here>
```
```

Notes
- These .mmd files are intended as living artefacts linked from the docs pages. Update the diagrams as follow-up tasks progress.
- If the repo uses a documentation build step that supports Mermaid (e.g., MkDocs with mermaid plugin or Docsify), add references to these files in the relevant docs pages or SUMMARY.md.

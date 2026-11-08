# Fleet flows

One workflow = one file here: `content/flows/<slug>.mmd`, a [Mermaid](https://mermaid.js.org/) diagram in plain text. The site draws it at `/fleet/flows/<slug>/` and lists it at `/fleet/flows/` (both behind the /fleet Access gate).

## The file

`<slug>` is lowercase words joined by hyphens. Start with three header lines, then the diagram:

```
%% title: How a card moves from Justin's ask to merge
%% owner: ●ANANSI_ROUTER
%% source-of-truth-for: what this flow is the record of, in one sentence
flowchart TD
  a["First step"] --> b["Next step"]
```

- `title`, `owner` (the seat that keeps it true), `source-of-truth-for` are required; the build fails without them.
- The diagram type (`flowchart`, `sequenceDiagram`, `stateDiagram-v2`, ...) must be the first line after the header.
- Mark a step you inferred rather than read: say `(inferred)` in its label and give it the `inferred` class, as `card-to-merge.mmd` does.

## Check it

1. `node build-fleet-flows.mjs` checks the header and diagram type (and prints the pages it wrote). `bin/site-build.sh` runs it too.
2. Check the syntax by pasting the diagram (without the `%%` header) into https://mermaid.live. The page itself shows Mermaid's error if the diagram does not parse, so open `dist/fleet/flows/<slug>/index.html` locally to see the drawing.
3. `npm test`.

## Ship it

Open a PR that adds the `.mmd` file (and nothing else). Do not deploy: Justin deploys. `bin/site-build.sh` builds the flows, so both `sitedep.sh` and `qwen-refresh.sh` keep them.

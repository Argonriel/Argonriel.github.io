# Jiayi Liwei — Academic Website

A lightweight academic website for an applied mathematics undergraduate at UCLA, with a static mathematics notebook at `/math/`.

## Files

- `index.html`: biography, research, teaching, and academic activities.
- `style.css`: responsive layout and typography; no JavaScript or external fonts required.
- `files/cv.pdf`: the current academic CV. Maintain the source in Overleaf and replace this PDF after updates.
- `CNAME`: the custom domain, `argonriel.com`.
- `math/`: generated course indexes, note pages, local search, and reading styles.
- `scripts/`: repeatable export and validation of selected Obsidian Markdown.

## Local preview

Run `python3 -m http.server 8000` from the repository and open `http://localhost:8000`.

## Publishing

This simple version is maintained on `main`. In repository **Settings → Pages**, use **Deploy from a branch**, select **main** and **/ (root)**, and retain the custom domain **argonriel.com**.

The `garden` branch contains the separate Mathematical Garden version.

The mathematics integration is prepared on **`math-notes-integration`**. Pushing that branch does not merge it into `main`. Keep the Pages publishing source on `main` while reviewing this work; this branch has no deployment workflow. A later merge and publication should be a separate decision.

## Mathematics notes

The source is `Argonriel/Mathematics`, maintained in the local Obsidian vault. The website is a generated reading copy; edit the Markdown in the vault, commit the intended source revision, and regenerate the site on the integration branch.

The export includes the five course folders (`115A`, `115B`, `131A_Iqra`, `131B_Inwon`, `132`) and the cross-course guide `Compactness and continuity.md`. It preserves note text, English/Chinese wording, theorem callouts, TeX, wiki links, heading/block anchors, and source page references. Backlinks are derived from links between topic notes. Vault settings, review logs, practice pages, and original PDFs are not exported; PDF references appear as citations rather than broken download links.

### Refresh the website copy

Use Node.js 20.19 or later and pnpm. From this repository:

```sh
pnpm install --frozen-lockfile
node scripts/sync-math.mjs --vault "/path/to/Mathematics"
node scripts/check-math.mjs --vault "/path/to/Mathematics"
python3 -m http.server 8000
```

Open `http://localhost:8000/math/`. Windows accepts a quoted vault path such as `"C:\Users\you\Documents\Obsidian\Mathematics"`.

The exporter refuses selected Markdown with uncommitted edits. Unrelated local Obsidian settings do not block an export and are never modified. `math/data/manifest.json` records the source commit, normalized content hashes, counts, and generated file list, without recording local paths. The check verifies all internal destinations and anchors, search coverage, accessible formula output, and exact TeX preservation against the vault. `node scripts/check-math.mjs` also checks the exported site without a vault.

MathJax 4 generates SVG and hidden MathML during export. Readers need no MathJax download, remote fonts, or JavaScript to view notes and formulas. JavaScript enhances the full static catalogue with local text search and course filters; searching sends no requests to external services. The dependencies and their versions are locked in `pnpm-lock.yaml`.

Generated HTML, formula CSS, search data, and the manifest are committed alongside the generator. GitHub Pages serves them directly, so no private-repository token, server, or build workflow is required. Review the diff, run the checks, and commit/push only the intended branch. Keep source edits in the vault; manual changes to generated pages will be replaced on the next refresh.

## Content maintenance

Update research descriptions and manuscript status as work progresses. The 3D reconstruction manuscript is currently described as in preparation; the listed contributions are literature review and writing. Do not mark it as under review or accepted until that status is confirmed.

Update the footer date when revising the site. No personal data collection or analytics are included.

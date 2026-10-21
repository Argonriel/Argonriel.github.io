# Jiayi Liwei — Academic Website

A lightweight, single-page academic website for an applied mathematics undergraduate at UCLA.

## Files

- `index.html`: biography, research, teaching, and academic activities.
- `style.css`: responsive layout and typography; no JavaScript or external fonts required.
- `files/cv.pdf`: the current academic CV. Maintain the source in Overleaf and replace this PDF after updates.
- `CNAME`: the custom domain, `argonriel.com`.

## Local preview

Run `python3 -m http.server 8000` from the repository and open `http://localhost:8000`.

## Publishing

This simple version is maintained on `main`. In repository **Settings → Pages**, use **Deploy from a branch**, select **main** and **/ (root)**, and retain the custom domain **argonriel.com**.

The `garden` branch contains the separate Mathematical Garden version.

## Content maintenance

Update research descriptions and manuscript status as work progresses. The 3D reconstruction manuscript is currently described as in preparation; the listed contributions are literature review and writing. Do not mark it as under review or accepted until that status is confirmed.

Update the footer date when revising the site. No personal data collection or analytics are included.

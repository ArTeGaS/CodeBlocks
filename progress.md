Original prompt: Поруч з папкою, де цей сайт зараз, зроби папку і скопіюй файли туди. Там все підчисти і зроби статичну постійну версію з панеллю для викладача на Github Pages в аккаунті ArTeGaS. Відповідно публічну. Підпиши репо як CodeBlocks

## Progress

- 2026-06-22: Created sibling `CodeBlocks` folder from `code-robot-dungeon` runtime files only: HTML, CSS, JS, assets, Blockly vendor files, local launcher, README, and `.nojekyll`.
- 2026-06-22: Removed Cloudflare/tunnel packaging from the public copy and documented GitHub Pages as the primary permanent deployment target.
- 2026-06-22: Changed the copied app so the teacher panel is enabled by default on the public Pages version, with `#student` still available for a student-only view.
- 2026-06-22: Verified the static copy locally on port 8791: default teacher mode, `#student` mode, 14 levels, Blockly workspace, no browser console errors, no horizontal overflow, and an open teacher drawer that overlays without resizing board/code.
- 2026-06-22: Ran the develop-web-game Playwright client and inspected its screenshot; removed generated `output/` artifacts before repository setup.

## Next

- Create or reuse `ArTeGaS/CodeBlocks`, push the copy, enable GitHub Pages, and verify the public URL.

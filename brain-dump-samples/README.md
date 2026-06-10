# Brain Dump samples

A library of realistic brain-dump inputs in many formats, used to evaluate how
well different models perform the BrainQueue extraction-and-scoring task. Feed
them through the eval harness (`../eval/run-eval.mjs`) to compare models, or
paste any one into the app's Brain Dump modal to spot-check.

Each file stresses a different real-world input shape:

| File | Format / what it tests |
| --- | --- |
| 01-numbered-french-mixed.txt | Numbered list, French + English mixed, translation |
| 02-plain-prose.txt | Stream-of-consciousness paragraph, no list structure |
| 03-bullet-list.md | Clean markdown bullets |
| 04-markdown-checkboxes.md | `- [ ]` / `- [x]` checkboxes — must drop completed items |
| 05-notion-database-table.md | Notion/Markdown table with Priority + Due columns |
| 06-notion-export.csv | Notion CSV export with Status/Tags/Notes |
| 07-voice-transcript-runon.txt | Run-on dictation, fillers ("um", "uh"), no punctuation |
| 08-compound-tasks.txt | Multiple actions per line — must split |
| 09-meeting-notes.md | Action items buried in notes; some assigned to others |
| 10-slack-messages.txt | Timestamped self-messages |
| 11-nested-outline.md | Indented hierarchy with parent/child tasks |
| 12-emoji-heavy.txt | Decorative emoji + urgency cues to strip |
| 13-already-done-mixed.txt | Strikethrough / DONE / ✅ markers to filter out |
| 14-multilingual.txt | ES / FR / DE / EN, all to translate |
| 15-deadlines-heavy.txt | Explicit deadlines → urgency scoring signal |
| 16-work-sprint-backlog.md | Eng backlog with P0/BUG/FEAT prefixes |
| 17-groceries-and-errands.txt | Sectioned shopping + errands list |
| 18-health-fitness.txt | All-Health category, overdue cues |
| 19-email-forward.txt | Forwarded email with asks embedded in prose |
| 20-trello-card-export.txt | Kanban `[To Do]/[Doing]/[Done]/[Blocked]` columns |
| 21-one-liner.txt | Single task with a deadline |
| 22-noise-mostly-nonactionable.txt | Mostly noise; 2 real tasks hidden — tests precision |
| 23-financial-todos.txt | All-Finance category |
| 24-apple-notes-messy.txt | Chaotic notes-app dump, typos, "??", DEADLINE cues |
| 25-learning-goals.txt | All-Learning, low-urgency aspirational items |
| 26-long-mixed-stress.txt | Long multi-section dump + an "ignore" trailer |

## What a good result looks like

- **Coverage** — every genuine action becomes a task; compound lines split.
- **Precision** — section headers, dates, completed items, and pure musings are dropped.
- **Translation** — non-English titles come back as clean English imperatives.
- **Sensible scoring** — deadlines push urgency up; "someday/eventually" push it down; category matches the domain.

There is no single "correct" output, so the harness reports the metrics it can
measure objectively (task count, latency, cost, schema-validity) and writes each
model's full output side by side so you can eyeball quality.

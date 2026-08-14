# Regulatory knowledge base — sources

The PDFs in this directory are **not committed** (see `.gitignore`). They are
downloaded by `scripts/fetch-knowledge-base.sh`, which holds the authoritative
list of documents and their source URLs.

## To populate this directory

```
bash scripts/fetch-knowledge-base.sh
npm run ingest
```

`ingest` deletes and rebuilds the entire `document_chunks` table, so it is safe
to re-run at any time.

## What's in here and why

| Document | Why it's included |
|---|---|
| `LPA_Application.pdf` | The current LPA form (rev. 03/17/2026). The primary target of Phase B. |
| `LPA_Process_Flow_Chart.pdf` | Sequence and timing of the LPA process. |
| `Experimental_Lease_Application.pdf` + instructions | The middle license tier. |
| `Standard_Lease_Draft/Final_Application.pdf` + instructions | The most complex tier; two-stage draft-then-final process. |
| `*_Process_Flow_Chart.pdf` | Lets the assistant answer "what happens after I submit?" |
| `Common_Application_Mistakes.pdf` | DMR's own guidance on why applications get rejected — footnote 4 of the use-case memo. |
| `Chapter2_Aquaculture_Lease_Regulations.pdf` | The actual rules (13-188 C.M.R. ch. 2) behind the routing logic in `lib/routing/rules.ts`. |
| `Riparian_Owners_List_Form.pdf` | The riparian landowner requirement the memo calls out as the most onerous step. |

## Explanatory web pages (fetched as .txt)

The PDFs are almost all *blank application forms*. They say what to fill in;
they do not say what the license types are or how they differ. These pages do,
and without them a question like "what's the difference between an LPA and a
standard lease?" retrieves nothing useful:

| Document | Why it's included |
|---|---|
| `DMR_LPA_and_Lease_Requirements.txt` | The one page that compares all three: size limits, durations, fees, which process applies. |
| `DMR_Public_Participation_in_Leasing.txt` | Scoping sessions and public hearings — the memo's external bottlenecks. |
| `DMR_Applications_and_Forms_Overview.txt` | How the application process fits together. |
| `Statute_12MRS_6072*.txt`, `6073` | The statutory basis for each license type. |

They're converted from HTML with macOS's built-in `textutil`, so the text is the
page's own words — no model rewriting regulatory language in between. On a
non-macOS machine the fetch script skips them with a warning.

## Keeping it current

DMR revises these forms regularly and changes the URL when it does — you can
see the dates drifting in the filenames. If the fetch script reports a failure,
the document has moved. Find the current version on the DMR site and update the
URL in the script:

- <https://www.maine.gov/dmr/aquaculture/applications-and-forms>
- <https://www.maine.gov/dmr/aquaculture/laws-and-regulations>

## Not yet included

Maine statutes (Title 12 §§ 6072, 6072-A, 6072-C, 6073, 6085) are web pages
rather than PDFs, so they need a different fetch path. Worth adding if the Q&A
turns out to need statutory language rather than procedural guidance.

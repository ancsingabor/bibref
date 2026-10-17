# Book catalogue

`bibref-hu.tm` is the editable TeXmacs source from
https://github.com/kovzol/bibref-book at commit
`2bc9dd264a272762cdde5831ed4ce4e925d2b3ef` (original Latin-1 encoding).
The reference edition is the user's `bibref-hu-20260812+.pdf`, 180 pages.

Rebuild using Python with pypdf:

```
python3 server/scripts/build-book-catalogue.py /path/to/bibref-hu-20260812+.pdf
```

The generator handles nested sessions, Greek entities and inline formatting,
imports the two already verified Python transcriptions, adds clipboard/settings
prerequisites and changes print output to SVG. The catalogue includes intentional
error demonstrations; running one stops at the first error. Page matching uses
PDF command text, with complete statement content to distinguish variants.
`coverage.json` records source-session coverage and unresolved transcriptions.
The 194 terminal sessions and two Python sessions supply all executable source
inputs; one additional source session contains only startup output. The catalogue
also includes the appendix’s referenced full-corpus shell script as download-only.

Hungarian context includes the book’s explicit lookup verses and diagram
passages (including introductions and intermediate verses) under the established
edition/book numbering rules. Chapters needing special versification remain
conservative. Explicit Psalm chapter pairs omit split or merged psalms; unavailable
mappings stay unavailable rather than guessing. Context always consists of whole verses,
separate from exact Greek intervals. No PDF or Bible corpus is served publicly.

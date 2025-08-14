# Prime Membership Card Generator

Open `index.html` in a modern browser. No server needed.

## CSV Format
- `name` (required)
- `member_id` (optional; if blank, autogenerates from Prefix + Sequence)
- `phone` and `notes` (optional; not printed unless you put them in the back legal/contact sections)

## Output
- Each member exports two PNGs at 1011×638 px: `<member_id>_front.png` and `<member_id>_back.png`, zipped.

## Defaults
- CR80 size, Code-128 barcodes, localStorage for preferences, Tailwind via browser CDN.


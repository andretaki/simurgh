# Page snapshot

```yaml
- link "Upload New RFQ":
  - /url: /rfq
- link "Fill RFQ":
  - /url: /rfq-fill
- link "View Completed RFQs":
  - /url: /rfq-done
- link "Company Settings":
  - /url: /settings
- text: RFQ Document Processor
- img
- text: "Click to upload or drag & drop PDF files here Maximum file size: 50MB each"
- alert:
  - img
  - heading "Error" [level=5]
  - text: "Failed to load existing summaries: Failed to fetch existing summaries (404)."
- heading "Existing RFQ Summaries" [level=3]
- region "Notifications (F8)":
  - list:
    - listitem:
      - text: Error Loading Summaries Failed to fetch existing summaries (404).
      - button:
        - img
- alert
- status
```
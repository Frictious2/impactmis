# ImpactMIS Known Limitations

- Uploaded files are stored under `public/uploads`.
- Guarded download routes are not fully implemented yet, so deployments should treat upload URL exposure carefully.
- External email, SMS, WhatsApp, and push notification integrations are not implemented.
- Bank API integrations and payment gateways are not implemented.
- Statutory tax filing and statutory compliance automation are not implemented.
- There is no mobile app yet.
- Geolocation requires browser/device permission.
- Geolocation generally requires HTTPS in production, except for localhost development.
- Payslips and reports render as web/print views; full PDF generation is not implemented.
- GIS maps, external BI tools, PowerBI integration, and AI analytics are not implemented.
- Restore is documented as a manual/offline process; live restore from UI is intentionally not available.

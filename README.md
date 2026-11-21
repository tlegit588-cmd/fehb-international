# FEHB International website redesign

## Files
- `index.html` — homepage structure and SEO/social metadata
- `styles.css` — responsive navy, emerald and gold design
- `script.js` — mobile navigation, four complete interface languages, language preference and email-based contact form
- `assets/fehb-logo.jpeg` — add the official FEHB logo here (same filename)

## Before publishing
1. Replace `assets/fehb-logo.jpeg` with the approved FEHB logo. If your current logo has another filename, either rename it to `fehb-logo.jpeg` or update the three references in `index.html`.
2. Confirm the email address `info@fehborganization.org` and WhatsApp number `2399860074`.
3. Confirm the organization’s official legal name and public wording.
4. Replace the two Unsplash photos with FEHB-owned or properly licensed photographs when available.
5. Do not publish impact numbers unless they are supported by verified records. This redesign intentionally avoids unverified statistics.
6. The contact form uses `mailto:`. It opens the visitor's email app and does not store messages. A Cloudflare Worker + D1 integration is a separate backend step.

## Test locally
Open `index.html` in a browser. For best results, upload the whole folder to your hosting provider. No build command or package installation is required.

## Cloudflare Pages deployment from GitHub
The earlier FEHB Pages setup used a static site configuration (framework preset: None, no build command, output directory `/`). For this package:
1. Download and extract `fehb-website-redesign.zip`.
2. Open your GitHub repository `tlegit588-cmd/FEBH`.
3. Upload the contents of the extracted folder to the repository's website root. The root should contain `index.html`, `styles.css`, `script.js`, `README.md`, and `assets/fehb-logo.jpeg`. Do not upload only the ZIP file.
4. Commit the changes to the main branch.
5. In Cloudflare, open **Workers & Pages → Pages → your FEHB Pages project**.
6. If it is already connected to GitHub, open **Deployments** and wait for the new commit to build. If it is not connected, choose **Create application → Pages → Connect to Git**, select `tlegit588-cmd/FEBH`, and select the production branch (usually `main`).
7. Set **Framework preset: None**, **Build command: leave blank**, and **Build output directory: /**. Save and deploy.
8. Open the generated `pages.dev` address and test the homepage, navigation, all four languages, images and contact form.
9. In the Pages project, open **Custom domains → Set up a custom domain** and add `fehborganization.org`. Follow the exact DNS instructions Cloudflare displays. Do not change nameservers or delete existing DNS records based on guesswork; preserve any records used for email.
10. Repeat the custom-domain setup for `www.fehborganization.org` if you want the www version, then choose one canonical version and configure a redirect if required.
11. Test `https://fehborganization.org` in a private browser tab after DNS and certificate provisioning complete.

## Important deployment notes
- The domain shown in the supplied HTML is `fehborganization.org`; use this exact spelling consistently.
- Do not expose API keys or database credentials in HTML, CSS or JavaScript.
- This is a static public website. It does not yet include an admin dashboard, donations processing, secure login, or a server-side enquiry database.

# Support site automatic donation testing

## Installation

Tested on Node v9.0.0 (NPM 5.5.1) on Windows 7. Uses Puppeteer, so should work fine on MacOS and Linux - but no guarantees.

Install by `npm install`.

Run by `npm run c` for Chrome. Headless Firefox coming soon.

## Edit

The `tests.json` file contains all the scenarios that the script runs through.

There are two main things that should be changed for a new test:
 * `url` is the full address of the donation product's landing page
 * `name` is what you want the test results to be saved as when the script has completed

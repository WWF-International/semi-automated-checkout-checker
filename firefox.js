const { writeFile } = require('fs');
const { promisify } = require('util');

// Modules.
// -----------------------------------------------------------------------------
const chalk = require('chalk');
const { Builder, By, Key, promise, until } = require('selenium-webdriver');
const firefox = require('selenium-webdriver/firefox');

promise.USE_PROMISE_MANAGER = false;
const binary = new firefox.Binary(firefox.Channel.NIGHTLY);
// binary.addArguments("--headless");

// Custom modules to keep this a bit tidier.
// -----------------------------------------------------------------------------

// Takes JSON and returns CSV. *Brittle*.
//      @json array - all the test scenarios in an array of objects
//      @returns @string - to be saved as CSV.
const convertJSONtoCSV = require('./JSONtoCSV.js');

// Test scenarios from `test.json`.
// -----------------------------------------------------------------------------
const scenarios = require('./tests.json').scenarios;
const url = require('./tests.json').url;
const name = require('./tests.json').name;

// Helper functions not (yet) in a module.
// -----------------------------------------------------------------------------

// Make errors a bit more obvious using Chalk.
const error = (errorMessage) => {
    console.error(chalk.bgRed(errorMessage));
};

const driver = new Builder()
    .forBrowser('firefox')
    .setFirefoxOptions(new firefox.Options().setBinary(binary))
    .build();

async function main() {
    await driver.get('https://www.wwf.org.uk');
    console.log('loaded');
    await driver.findElement(By.className('js_toggle_search')).click();
    console.log('clicked');
    await driver
        .findElement(By.id('edit-keys'))
        .sendKeys('xylophones', Key.RETURN);
    console.log('searched');
    await driver.wait(until.titleIs('Site search | WWF'));
    console.log('search loaded');
    await driver.wait(async () => {
        const readyState = await driver.executeScript(
            'return document.readyState'
        );
        return readyState === 'complete';
    });
    const data = await driver.takeScreenshot();
    await promisify(writeFile)('screenshot.png', data, 'base64');
    await driver.quit();
}

main();

// Modules.
// -----------------------------------------------------------------------------
const promisify = require('promisify-node');
const puppeteer = require('puppeteer');
const chalk = require('chalk');
const json2csv  = require('json2csv');

// Promisified modules.
const fs = promisify('fs');

// Custom modules to keep this a bit tidier.
// -----------------------------------------------------------------------------

// Delays Pupeteer - bit of a hack¬
//      @time integer - time you want to delay things in seconds
//      @returns Promise
const delayBy = require('./delay.js');

// Takes JSON and returns CSV. *Brittle*.
//      @json array - all the test scenarios in an array of objects
//      @returns @string - to be saved as CSV.
const convertJSONtoCSV = (json) => {
    let fields = [
        "planningToDo",
        "knowDate",
        "date",
        "hopeToRaise",
        "holdingEventAs",
        "groupName",
        "18orOver",
        "title",
        "firstName",
        "lastName",
        "email",
        "mobile",
        "telephone",
        "postcode",
        "address1",
        "address2",
        "address3",
        "cityOrTown",
        "county",
        "country",
        "thankYouLetter",
        "communicationByEmail",
        "communicationByText",
        "communicationByPhone",
        "communicationByPost",
        "postOrDownload"
    ];

    let fieldNames = [

        "Activity",
        "Do they know the date?",
        "Date, if known.",
        "Fundraising target",
        "Are they an individual, group, or school?",
        "If group, the name.",
        "Are they 18 or over?",
        "Title",
        "First name",
        "last name",
        "Email",
        "Mobile",
        "Telephone",
        "Postcode",
        "Address1",
        "Address2",
        "Address3",
        "City / town",
        "County",
        "Country",
        "Thank you letter",
        "Communication by email (true opts in)",
        "Communication by text (true opts in)",
        "Communication by phone (false opts in)",
        "Communication by post (false opts in)",
        "Get pack by post or download?"
    ];

    let csv = json2csv({
        "data"       : json,
        "fields"     : fields,
        "fieldNames" : fieldNames
    });

    return csv;
};

// Test scenarios from `test.json`.
// -----------------------------------------------------------------------------
const scenarios = require('./diy-tests.json').scenarios;
const url = require('./diy-tests.json').url;
const name = require('./diy-tests.json').name;

// Helper functions not (yet) in a module.
// -----------------------------------------------------------------------------

// Make errors a bit more obvious using Chalk.
const error = (errorMessage) => {
    console.error(chalk.bgRed(errorMessage));
};

// Running through the test transaction.
// -----------------------------------------------------------------------------
//      @string url - the URL of the page to be tested
//      @object scenario - the test transaction details
//      @returns string - the transaction ID.
// -----------------------------------------------------------------------------
const runScenario = (url, scenario) => {
    return new Promise(async (resolve, reject) => {
        const browser = await puppeteer.launch({
            headless: false,
            args: ['--start-maximized']
        });

        const page = await browser.newPage();

        await page.setViewport({
            width: 1920,
            height: 800,
            deviceScaleFactor: 1,
            isMobile: false,
            isTouch: false,
            isLandscape: true
        });

        // await page.setDefaultNavigationTimeout(9999000)

        // page.setRequestInterceptionEnabled(true);

        // page.on('request', request => {
        //     console.log(request.url)
        //     if ( request.resourceType === 'image' && page.url() !== 'https://wwftest2.codestorm.co.uk/shop/payment/success' ) {
        //         request.abort();
        //     }
        //     else {
        //         request.continue();
        //     }
        // });

        // Go to landing page
        await page.goto(url, { waitUntil: 'load' });

        await page.waitFor('#intention');
        await page.type('#intention', scenario.planningToDo);

        if (scenario.knowDate === true) {
            await page.type('#date-of-event', scenario.date);
        } else {
            await page.click('#date_set-No');
        }

        await page.type('#target', scenario.hopeToRaise.toString());

        if (scenario.holdingEventAs.toLowerCase() === 'individual') {
            await page.click('#option1');
        } else if (
            scenario.holdingEventAs.toLowerCase() === 'organisation / business'
        ) {
            await page.click('#option2');
            await delayBy(1);
            await page.type('#locationOther', scenario.groupName);
        } else if (
            scenario.holdingEventAs.toLowerCase() === 'school / youth group'
        ) {
            await page.click('#option3');
            await delayBy(1);
            await page.type('#locationOther', scenario.groupName);
        }

        await page.click('#ageCheck');

        await delayBy(1);

        await page.select('#billing-title', scenario.title);
        await page.type(`#billing-first_name`, scenario.firstName);
        await page.type(`#billing-last_name`, scenario.lastName);
        await page.type(`#billing-email`, scenario.email);
        await page.type(`#billing-telephone2`, scenario.mobile.toString());
        await page.type(`#billing-telephone`, scenario.telephone.toString());

        await page.click(`#enterManualAddressBtn`);
        await delayBy(1);

        await page.type(`#billing-address_1`, scenario.address1);
        await page.type(`#billing-address_2`, scenario.address2);
        await page.type(`#billing-address_3`, scenario.address3);
        await page.type(`#billing-city_town`, scenario.cityOrTown);
        await page.type(`#billing-county`, scenario.county);
        await page.type(`#billing-postcode`, scenario.postcode);

        if (scenario.communicationByEmail === true) {
            await page.click(`#con_email`);
        }

        if (scenario.communicationByText === true) {
            await page.click(`#con_sms`);
        }

        if (scenario.communicationByPhone === true) {
            await page.click(`#con_tel`);
        }

        if (scenario.communicationByPost === true) {
            await page.click(`#newsletter_signup`);
        }

        if (scenario.postOrDownload === 'post') {
            await page.click(`#require_pack-Yes`);
        } else {
            await page.click(`#require_pack-No`);
        }

        await page.waitForNavigation({
            waitUntil: 'load',
            timeout : 9999000
        });

        resolve(scenario.id);
    });
};

// Async function (so we can use await) that loops through the test transaction
// scenarios, and runs them through `runScenario()`.
// Converts the JSON to CSV, then saves CSV.
// -----------------------------------------------------------------------------
(async () => {
    for (let i = 0; i < scenarios.length; i++) {
        let transactionID = await runScenario(url, scenarios[i]);
        scenarios[i].transactionID = transactionID;

        console.log(
            'Scenario ' +
                chalk.yellow(
                    `${scenarios[i].firstName} ${scenarios[i].lastName}`
                ) +
                ' ran; id: ' +
                chalk.yellow(scenarios[i].transactionID)
        );
    }

    let scenariosAsCSV = convertJSONtoCSV(scenarios);

    fs.writeFile(`test-transactions-for-${name}.csv`, scenariosAsCSV)
        .then((response) => {
            console.log(
                'Saved to ' + chalk.green(`test-transactions-for-${name}.csv`)
            );
        })
        .catch((error) => {
            error(error);
        });
})();

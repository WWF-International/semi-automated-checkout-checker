// Modules.
// -----------------------------------------------------------------------------
const promisify = require("promisify-node");
const puppeteer = require('puppeteer');
const chalk     = require('chalk');

// Promisified modules.
const fs = promisify("fs");

// Custom modules to keep this a bit tidier.
// -----------------------------------------------------------------------------

// Delays Pupeteer - bit of a hack¬
//      @time integer - time you want to delay things in seconds
//      @returns Promise
const delayBy = require('./delay.js');

// Takes JSON and returns CSV. *Brittle*.
//      @json array - all the test scenarios in an array of objects
//      @returns @string - to be saved as CSV.
const convertJSONtoCSV = require('./JSONtoCSV.js');

// Test scenarios from `test.json`.
// -----------------------------------------------------------------------------
const scenarios = require('./tests.json').scenarios;
const url       = require('./tests.json').url;
const name      = require('./tests.json').name;


// Helper functions not (yet) in a module.
// -----------------------------------------------------------------------------

// Make errors a bit more obvious using Chalk.
const error = (errorMessage) => {
    console.error( chalk.bgRed(errorMessage) );
}

// Running through the test transaction.
// -----------------------------------------------------------------------------
//      @string url - the URL of the page to be tested
//      @object scenario - the test transaction details
//      @returns string - the transaction ID.
// -----------------------------------------------------------------------------
const runScenario = (url, scenario) => {
    return new Promise( async (resolve, reject) => {
        const browser = await puppeteer.launch({
            headless: false,
            args: ['--start-maximized']
        });

        const page = await browser.newPage();

        await page.setViewport({
            width             : 1920,
            height            : 800,
            deviceScaleFactor : 1,
            isMobile          : false,
            isTouch           : false,
            isLandscape       : true
        });

        page.setRequestInterceptionEnabled(true);

        page.on('request', request => {
            if (request.resourceType === 'image' && page.url() !== 'https://wwftest2.codestorm.co.uk/shop/payment/success') {
                request.abort();
            }
            else {
                request.continue();
            }
        });

        // Got to landing page
        await page.goto(url, { waitUntil: 'load' });

        // TODO: if 404, 500 or other page error, reject the promise.

        // Wait for form to load, then put in amount, then submit
        await page.waitFor('input[name="other_amount_oneOff"]');
        await page.type('input[name="other_amount_oneOff"]', scenario.amount.toString() ); // Needs to be a string here; can be either integer or string in tests JSON file.
        await page.click('button.btn.btn--small.btn--primary[value="0"]');

console.log('Donation amount submitted.');

        // wait until the next page in the checkout
        await page.waitForNavigation({
            timeOut: 60,
            waitUntil: 'load'
        });

        try {

            await page.select('#billing-title', scenario.title);
            await page.type(`#billing-first_name`, scenario.firstName);
            await page.type(`#billing-last_name`, scenario.lastName);

            if (scenario.yearOfBirth !== null) {
                await page.select('#billing-date_of_birth', scenario.yearOfBirth.toString() );
            }

            await page.type(`#billing-email`, scenario.email);
            await page.type(`#billing-telephone2`, scenario.mobile.toString() );
            await page.type(`#billing-telephone`, scenario.telephone.toString() );

    console.log('Name and contact details typed.');

            await page.type(`#billing-paf`, scenario.postcode);
            await page.click('#search-button-billing-paf');
            await page.waitFor('input[name="address__option"]');

            let addressOption = await page.$$('input[name="address__option"]');
                addressOption[0].click();
    console.log('PAF lookup submitted.');

            await delayBy(1);

            await page.select('#billing-country', "1");

            await page.evaluate( () => {
                document.querySelector(`#billing-address_1`).value = "";
                document.querySelector(`#billing-address_2`).value = "";
                document.querySelector(`#billing-address_3`).value = "";
                document.querySelector(`#billing-city_town`).value = "";
                document.querySelector(`#billing-county`).value = "";
                document.querySelector(`#billing-postcode`).value = "";
            })

            await page.type(`#billing-address_1`, scenario.address1);
            await page.type(`#billing-address_2`, scenario.address2);
            await page.type(`#billing-address_3`, scenario.address3);
            await page.type(`#billing-city_town`, scenario.cityOrTown);
            await page.type(`#billing-county`, scenario.county);
            await page.type(`#billing-postcode`, scenario.postcode);
            console.log('Address filled in.');
        }
        catch (error) {
           error('Address NOT filled in.');
            error(error);
        }


        if (scenario.thankYouLetter  === true) {
            await page.click(`.funnel__option.checkbox.optional`);
        }

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

console.log('Communication options filled in.');

        await page.evaluate( () => { // #captureForm.submit()

            document.querySelector('#captureForm').submit();
        });

console.log('captureForm submitted');

        // wait until the next page in the checkout
        await page.waitForNavigation({
            timeOut: 60,
            waitUntil: 'load'
        });

console.log('Gift aid and payment details page loaded.');

        if (scenario.giftAid === true) {
            await page.click(`#uk_tax_payer`);
            await page.click('input[name="is_own_money"]');
            await page.click('input[name="is_not_proceed_money"]');
            await page.click('input[name="is_not_received_money"]');
        };

        await page.click('#pay-by-card');

        await page.waitFor('#sagepay-iframe');

        const frames = await page.frames();

        await delayBy(4);

        await frames.forEach( async frame => {
            if (frame.name() === 'payment') {
                await frame.evaluate( () => {
console.log('Payment iframe performanceNodeTiming.moduleLoadEnd.');
                    try {
                        document.querySelector('input[name="cardnumber"]').value = '4462000000000003';
                        document.querySelector('select[name="expirymonth"] option[value="11"]').selected = true;
                        document.querySelector('select[name="expiryyear"] option[value="27"]').selected = true;
                        document.querySelector('input[name="securitycode"]').value = 123;
                        document.querySelector('#carddetails').submit();
                        return Promise.resolve();
                    }
                    catch (error) {
                        error(error);
                    }
                });

                await frame.waitFor('#field_password');

                let passwordForm = await frame.$('#field_password');

                await frame.evaluate( () => {
                    try {
                        document.querySelector('#field_password').value = 'password';
                        document.querySelector('#authentication-form').submit();
                        return Promise.resolve();
                    }
                    catch (error) {
                        error(error);
                        Promise.reject(error);
                    }
                });

                await page.waitForNavigation({ waitUntil: 'load' });

                const number = await page.evaluate( () => {
                    return document.querySelector('.lead strong').innerHTML;
                });



                await page.screenshot({
                    path : `./${number}.png`,
                    fullPage : true
                });

                await browser.close()
                    .catch(error => {
                        error(error);
                    });

                resolve(number);
            }
        });
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
            'Scenario '
            + chalk.yellow(`${scenarios[i].firstName} ${scenarios[i].lastName}`)
            + ' ran; id: '
            + chalk.yellow(scenarios[i].transactionID)
        );

    };

    let scenariosAsCSV = convertJSONtoCSV(scenarios);

    fs.writeFile(`test-transactions-for-${name}.csv`, scenariosAsCSV)
        .then( (response) => {
            console.log('Saved to ' + chalk.green(`test-transactions-for-${name}.csv`) );
        })
        .catch( (error) => {
            error(error);
        });

})();

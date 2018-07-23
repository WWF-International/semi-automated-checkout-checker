// Modules.
// -----------------------------------------------------------------------------
const promisify = require('promisify-node');
const puppeteer = require('puppeteer');
const chalk = require('chalk');

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

// Running through the test transaction.
// -----------------------------------------------------------------------------
//      @string url - the URL of the page to be tested
//      @object scenario - the test transaction details
//      @returns string - the transaction ID.
// -----------------------------------------------------------------------------

//TODO selectors.inc
const AMOUNT_BOX_SELECTOR = 'input[name="amount"][type="text"]';
const DONATE_BUTTON_SELECTOR = 'input[value="Donate"][type="submit"]';
const SALUTATION_SELECTOR = '#edit-payment-information-add-payment-method-billing-information-field-title-salutation';
const FIRST_NAME_SELECTOR = 'input[data-drupal-selector=edit-payment-information-add-payment-method-billing-information-address-0-address-given-name]';
const LAST_NAME_SELECTOR = 'input[data-drupal-selector=edit-payment-information-add-payment-method-billing-information-address-0-address-family-name]';
const YOB_SELECTOR = '#edit-payment-information-add-payment-method-billing-information-field-year-of-birth-0-value';
const EMAIL_SELECTOR = '#edit-contact-information-email';
const MOBILE_SELECTOR = '#edit-payment-information-add-payment-method-billing-information-field-mobile-phone-0-value';
const PHONE_SELECTOR = '#edit-payment-information-add-payment-method-billing-information-field-home-phone-0-value';
const POSTCODE_SELECTOR = '[data-drupal-selector="edit-payment-information-add-payment-method-billing-information-address-0-address-postal-code"]';
const POSTCODE_BUTTON_SELECTOR = '';
const ADDRESS_DROPDOWN_SELECTOR = '#address-suggestion-box .postcode-address-lookup-item';
const COUNTRY_DROPDOWN_SELECTOR = '#edit-payment-information-add-payment-method-billing-information-address-0-address-country-code--2';
const EOI_SELECTOR = '#edit-payment-information-add-payment-method-billing-information-field-communication-yes-email';
const SMS_SELECTOR = '#edit-payment-information-add-payment-method-billing-information-field-communication-yes-text';
const MOI_SELECTOR = '#edit-payment-information-add-payment-method-billing-information-field-communication-yes-post';
const NOTHANKS_SELECTOR = '#edit-payment-information-add-payment-method-billing-information-field-communication-no-thanks';
const GIFTAID_SELECTOR = '#edit-claim-gift-aid-gift-aid-declaration';
const CONTINUE_SELECTOR = '[data-drupal-selector="edit-actions"]';
//const STRIPE_CVC_FRAME_SELECTOR = '.stripe-form.js-form-wrapper.form-wrapper iframe:nth(2)';
const CARDNUMBER_FRAME_NAME = '__privateStripeFrame3';
const EXPIRY_FRAME_NAME = '__privateStripeFrame4';
const CVC_FRAME_NAME = '__privateStripeFrame5';
const ARDNUMBER_SELECTOR = 'input.InputElement';
const EXPIRY_DATE_FRAME_NAME = '__privateStripeFrame4';
const CARDNUMBER_SELECTOR = 'input.InputElement';
const OWN_MONEY_SELECTOR = '[data-drupal-selector="edit-claim-gift-aid-gift-aid-q-1"]';
const NOT_PROCEEDS_SELECTOR = '[data-drupal-selector="edit-claim-gift-aid-gift-aid-q-2"]';
const NOT_TICKET_SELECTOR = '[data-drupal-selector="edit-claim-gift-aid-gift-aid-q-3"]';
const TEST_CARD_NUMBER = '4242424242424242';
const ORDER_NUMBER_SELECTOR = '.hgroup';
const PAY_AND_COMPLETE_SELECTOR = '[data-drupal-selector="edit-actions-next"]';

const runScenario = (url, scenario) => {
  return new Promise(async (resolve, reject) => {
    const browser = await puppeteer.launch({
      headless: false,
      args: ['--start-maximized', '--ignore-certificate-errors']

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

    page.setRequestInterceptionEnabled(true);

    // To make things faster let's ignore all images - except on the final
    // thank you page.
    page.on('request', (request) => {
      if (
        request.resourceType === 'image' &&
        page.url() !==
        'https://wwftest2.codestorm.co.uk/shop/payment/success'
      ) {
        request.abort();
      } else {
        request.continue();
      }
    });

    // Go to landing page
    await page.goto(url, {
      waitUntil: 'load',
      ignoreHTTPSErrors: true
    });

    // TODO: if 404, 500 or other page error, reject the promise.

    // Wait for form to load, then put in amount, then submit
    await page.waitFor(AMOUNT_BOX_SELECTOR);
    await page.type(
      AMOUNT_BOX_SELECTOR,
      scenario.amount.toString() // Needs to be a string here; can be either integer or string in tests JSON file.
    );
    await page.click(DONATE_BUTTON_SELECTOR);

    console.log('Donation amount submitted.');

    // wait until the next page in the checkout
    await page.waitForNavigation({
      timeOut: 120,
      waitUntil: 'load'
    });
    await delayBy(1);

    // Go through the test scenario and fill in the first page.
    try {
      await page.type(EMAIL_SELECTOR, scenario.email);
      const frames = page.frames();
      await frames.forEach(async (frame) => {
        console.log('Frame found.');

        if (frame.name() === CARDNUMBER_FRAME_NAME) {
          await frame.evaluate((selector, cardNumber) => {
            try {
              document.querySelector(selector).value = cardNumber;
              //    document.querySelector('select[name="expirymonth"] option[value="11"]').selected = true;
              //    document.querySelector('select[name="expiryyear"] option[value="27"]').selected = true;
              //    document.querySelector('input[name="securitycode"]').value = 123;
              //    document.querySelector('#carddetails').submit();
              return Promise.resolve();
            } catch (err) {
              console.error(err);
              return Promise.reject();
            }
          }, CARDNUMBER_SELECTOR, TEST_CARD_NUMBER);
        }
        if (frame.name() === EXPIRY_FRAME_NAME) {
          await frame.evaluate((selector) => {
            try {

              document.querySelector(selector).value =
                '11 / 27';

              return Promise.resolve();
            } catch (err) {
              console.error(err);
              return Promise.reject();
            }
          }, CARDNUMBER_SELECTOR);
        }
        if (frame.name() === CVC_FRAME_NAME) {
          await frame.evaluate((selector) => {
            try {

              document.querySelector(selector).value =
                '123';

              return Promise.resolve();
            } catch (err) {
              console.error(err);
              return Promise.reject();
            }
          }, CARDNUMBER_SELECTOR);
        }


      });

      await page.select(SALUTATION_SELECTOR, scenario.title.toLowerCase());
      await page.select(COUNTRY_DROPDOWN_SELECTOR, scenario.country);
      let name = await page.$$(FIRST_NAME_SELECTOR);
      await delayBy(1);
      await page.type(FIRST_NAME_SELECTOR, scenario.firstName);
      await page.type(LAST_NAME_SELECTOR, scenario.lastName);

      await page.type(MOBILE_SELECTOR, scenario.mobile.toString());
      await page.type(PHONE_SELECTOR, scenario.telephone.toString());

      console.log('Name and contact details typed.');

      await page.type(POSTCODE_SELECTOR, scenario.postcode);
      //await page.click(POSTCODE_BUTTON_SELECTOR);
      await page.waitFor(ADDRESS_DROPDOWN_SELECTOR);

      //let addressDiv = findAddressDiv(scenario.address1, ADDRESS_DROPDOWN_SELECTOR);

      /////////////////////////////////////////////////////////////////
      //TODO queryselector !== jQuery :(
      /////////////////////////////////////////////////////////////////
      //await page.click(`${ADDRESS_DROPDOWN_SELECTOR}.postcode-address-lookup-item:contains("${scenario.address1}")`);
      await page.evaluate((selector) => {
        console.log(selector);
        jQuery(selector).click();
      }, `${ADDRESS_DROPDOWN_SELECTOR}.postcode-address-lookup-item:contains("${scenario.address1}")`);
      /*
                  let addressOption = await page.$$('input[name="address__option"]');
                  addressOption[0].click();
      */
      console.log('PAF lookup submitted.');
      /*
                  await delayBy(1);

                  await page.select('#billing-country', '1');

                  await page.evaluate(() => {
                      document.querySelector(`#billing-address_1`).value = '';
                      document.querySelector(`#billing-address_2`).value = '';
                      document.querySelector(`#billing-address_3`).value = '';
                      document.querySelector(`#billing-city_town`).value = '';
                      document.querySelector(`#billing-county`).value = '';
                      document.querySelector(`#billing-postcode`).value = '';
                  });

                  await page.type(`#billing-address_1`, scenario.address1);
                  await page.type(`#billing-address_2`, scenario.address2);
                  await page.type(`#billing-address_3`, scenario.address3);
                  await page.type(`#billing-city_town`, scenario.cityOrTown);
                  await page.type(`#billing-county`, scenario.county);
                  await page.type(`#billing-postcode`, scenario.postcode);
                  console.log('Address filled in.');

      */
    } catch (error) {
      console.error('Address NOT filled in.');
      console.error(error);
    }
    if (scenario.yearOfBirth !== null) {
      await page.type(
        YOB_SELECTOR,
        scenario.yearOfBirth.toString()
      );
    }
    /*
            if (scenario.thankYouLetter === true) {
                await page.click(`.funnel__option.checkbox.optional`);
            }
    */
    if (scenario.communicationByEmail === true) {
      await page.click(EOI_SELECTOR);
    }

    if (scenario.communicationByText === true) {
      await page.click(SMS_SELECTOR);
    }
    /*
            if (scenario.communicationByPhone === true) {
                await page.click('#MOI_SELECTOR');
            }
    */
    if (scenario.noThanks === true) {
      await page.click(NOTHANKS_SELECTOR);
    }

    if (scenario.giftAid === true) {
      await page.click(GIFTAID_SELECTOR);
    }
    console.log('Communication options filled in.');

    if (scenario.giftAid === true) {
    //  await page.click(`#uk_tax_payer`);
      await page.click(OWN_MONEY_SELECTOR);
      await page.click(NOT_PROCEEDS_SELECTOR);
      await page.click(NOT_TICKET_SELECTOR);
    }
    console.log('Gift aid done.');

    await page.hover('[data-drupal-selector="edit-payment-information-add-payment-method-payment-details"]');


    //    await page.click(CONTINUE_SELECTOR);


    /*
          await page.evaluate(() => {
            document.querySelector('#captureForm').submit();
          });

          console.log('captureForm submitted');

          // wait until the next page in the checkout
          await page.waitForNavigation({
            timeOut: 60,
            waitUntil: 'load'
          });

          console.log('Gift aid and payment details page loaded.');


          await page.click('#pay-by-card');
          console.log('Pay by card clicked.');
          await delayBy(10);
    */
    // If something is going to go wrong, it'll probably be here - the
    // selectors in the Sagepay iframe sometimes change without warning.
    // However, if the iframe doesn't load on the first time running through
    // a batch of tests simply try again - I think that the Sagepay dev
    // environment is a bit slow to start with.

    //  await page.waitForSelector(STRIPE_CVC_FRAME_SELECTOR);




    //await delayBy(4);


    /*
                    await frame.waitFor('[name="password"][type="password"]');

                    let passwordForm = await frame.$(
                        '[name="password"][type="password"]'
                    );

                    await frame.evaluate(() => {
                        try {
                            document.querySelector('input[name="password"][type="password"]').value = 'password';
                            document.querySelector('form').submit();
                            return Promise.resolve();
                        } catch (error) {
                            error(error);
                            Promise.reject(error);
                        }
                    });
    */
    await page.waitForNavigation({
      waitUntil: 'load'
    });

    await page.click(PAY_AND_COMPLETE_SELECTOR);

    await page.waitForNavigation({
      waitUntil: 'load'
    });

    const number = await page.evaluate((orderNumber) => {
      let orderNumberRegex = /[\d,-]+/ ;
      let orderString = document.querySelector(orderNumber).innerText;// document.querySelector('.hgroup').innerText
      let matches = orderString.match(orderNumberRegex);
      return  matches ? matches[0] : null ;
      //return document.querySelector(ORDER_NUMBER_SELECTOR).innerHTML;
    }, ORDER_NUMBER_SELECTOR);



    await page.screenshot({
      path: `./${number}.png`,
      fullPage: true
    });

    await browser.close().catch((err) => {
      error(err);
    });

    resolve(number);
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

  fs
    .writeFile(`test-transactions-for-${name}.csv`, scenariosAsCSV)
    .then((response) => {
      console.log(
        'Saved to ' + chalk.green(`test-transactions-for-${name}.csv`)
      );
    })
    .catch((err) => {
      error(err);
    });
})();

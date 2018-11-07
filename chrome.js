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

let testFile = './tests.json';
if (process.argv[2] && process.argv[2].length > 0) {
  let argTestFile = './' + process.argv[2];
  if (fs.existsSync(argTestFile)) {
    testFile = argTestFile;
  }

}
console.log(chalk.blue('Loading tests from:' + testFile));

const scenarios = require(testFile).scenarios;
const url = require(testFile).url;
const name = require(testFile).name;

const user = 'WWF';
const pass = 'WWF';

const headers = new Map();
headers.set(
  'Authorization',
  `Basic ${new Buffer(`${user}:${pass}`).toString('base64')}`
);

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
const AMOUNT_BOX_SELECTOR = 'input[data-drupal-selector="edit-donation-amount-number"], [data-drupal-selector="edit-purchased-entity-0-recurring-custom-price-number"]';
const DONATE_BUTTON_SELECTOR = 'input[value="Donate"][type="submit"], input[value="Add to cart"][type="submit"]';
const CONTINUE_BUTTON_SELECTOR = '[data-drupal-selector="edit-basket-actions-continue"]';
const SALUTATION_SELECTOR = 'select[data-drupal-selector="edit-your-details-field-title"]';
const FIRST_NAME_SELECTOR = 'input[data-drupal-selector="edit-your-details-field-first-name-0-value"]';
const LAST_NAME_SELECTOR = 'input[data-drupal-selector="edit-your-details-field-last-name-0-value"]';
const DELIVERY_NAME_SELECTOR = '[data-field-name="fieldDeliverTo"] input';
const YOB_SELECTOR = '[data-drupal-selector="edit-your-details-field-yob-0-value"]';
const EMAIL_SELECTOR = 'input[data-drupal-selector="edit-your-details-field-email-address-0-value"]';
const MOBILE_SELECTOR = 'input[data-drupal-selector="edit-your-details-field-mobile-tel-0-value"]';
const PHONE_SELECTOR = 'input[data-drupal-selector="edit-your-details-field-home-tel-0-value"]';
const DELIVERY_POSTCODE_SELECTOR ='[data-field-name="fieldRecipientAddressPostcodeInput"] input';
const DELIVERY_POSTCODE_BUTTON_SELECTOR = '.address-find.button';
const POSTCODE_SELECTOR = '[data-drupal-selector="edit-your-details-field-address-0-address-lookup-elements-postcode-input"]';
const POSTCODE_BUTTON_SELECTOR = '[data-drupal-selector="edit-your-details-field-address-0-address-lookup-elements-address-find"]';
const ADDRESS_DROPDOWN_SELECTOR = '[data-drupal-selector="edit-your-details-field-address-0-address-lookup-elements-address-select"]';
//const COUNTRY_DROPDOWN_SELECTOR = '#edit-payment-information-add-payment-method-billing-information-address-0-address-country-code--2';
const EOI_SELECTOR = '[data-drupal-selector="edit-marketing-preferences-marketing-preferences-email"]';
const SMS_SELECTOR = '[data-drupal-selector="edit-marketing-preferences-marketing-preferences-text"]';
const MOI_SELECTOR = '[data-drupal-selector="edit-marketing-preferences-marketing-preferences-phone"]';
const PHONE_OI_SELECTOR = '[data-drupal-selector="edit-marketing-preferences-marketing-preferences-phone"]';
const CONTINUE_TO_PAYMENT_SELECTOR = '#edit-details > div.section-body > div > button';
const GIFTAID_SELECTOR = '[data-drupal-selector="edit-gift-aid-giftaid-agreement"]';
const CONTINUE_SELECTOR = '[data-drupal-selector="edit-actions"]';
const CARDNUMBER_FRAME_NAME = '__privateStripeFrame3';
const EXPIRY_FRAME_NAME = '__privateStripeFrame4';
const CVC_FRAME_NAME = '__privateStripeFrame5';
const ARDNUMBER_SELECTOR = 'input.InputElement';
const EXPIRY_DATE_FRAME_NAME = '__privateStripeFrame4';
const CARDNUMBER_SELECTOR = 'input.InputElement';
const OWN_MONEY_SELECTOR = '[data-drupal-selector="edit-gift-aid-giftaid-declaration-1"]';
const NOT_PROCEEDS_SELECTOR = '[data-drupal-selector="edit-gift-aid-giftaid-declaration-2"]';
const NOT_TICKET_SELECTOR = '[data-drupal-selector="edit-gift-aid-giftaid-declaration-3"]';
const TEST_CARD_NUMBER = '4242424242424242';
const ORDER_NUMBER_SELECTOR = '.hgroup';
const PAY_AND_COMPLETE_SELECTOR = '[data-drupal-selector="edit-actions-next"]';
const TOY_YES_SELECTOR = '[data-field-name="basket136Send"] label';
const TOY_NO_SELECTOR = '[data-field-name="basket136DoNotSend"] label';
const GIFT_SELECTOR = '[data-field-name="basketGiftFieldGift"] label';


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

    //await page.setExtraHTTPHeaders(headers);
    await page.authenticate({
      username: user,
      password: pass
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

    console.log('Donation amount submitted!');

    // wait until the next page in the checkout
    await page.waitForNavigation({
      timeOut: 120,
      waitUntil: 'load'
    });
    await delayBy(1);

    //  await page.click(CONTINUE_BUTTON_SELECTOR);
    //Fill in first page

    try {
    console.log('hello');
if (scenario.toy === true){
  await page.click(TOY_YES_SELECTOR);
  console.log('yes toy');
}else {
  await page.click(TOY_NO_SELECTOR);
  console.log('no toy');
}

if (scenario.gift === true){
  await page.click(GIFT_SELECTOR);
}else{
  await page.click(SELF_SELECTOR);
}
      //await page.type()
await page.type(DELIVERY_NAME_SELECTOR, `${scenario.firstName} ${scenario.lastName}`);
await page.type(DELIVERY_POSTCODE_SELECTOR, scenario.postcode);
await page.click(DELIVERY_POSTCODE_BUTTON_SELECTOR);

    } catch (error) {
console.error(error);
}
    // Go through the test scenario and fill in the first page.
    try {
      await page.type(EMAIL_SELECTOR, scenario.email);

      await page.select(SALUTATION_SELECTOR, scenario.title);

      //      let name = await page.$$(FIRST_NAME_SELECTOR);
      await delayBy(1);
      await page.type(FIRST_NAME_SELECTOR, scenario.firstName);
      await page.type(LAST_NAME_SELECTOR, scenario.lastName);

      await page.type(MOBILE_SELECTOR, scenario.mobile.toString());
      await page.type(PHONE_SELECTOR, scenario.telephone.toString());

      console.log('Name and contact details typed.');

      await page.type(POSTCODE_SELECTOR, scenario.postcode);
      await page.click(POSTCODE_BUTTON_SELECTOR);
      console.log('PAF lookup submitted.');
      await page.waitFor(ADDRESS_DROPDOWN_SELECTOR);
      await delayBy(1);
      await page.evaluate((selector, find) => {
        console.log(find);
        console.log(jQuery(selector).find(find).attr('selected', true));

      }, `${ADDRESS_DROPDOWN_SELECTOR}`, `option:contains("${scenario.address1}")`);

      console.log('PAF address selected.');

      //await page.select(COUNTRY_DROPDOWN_SELECTOR, scenario.country);
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
    if (scenario.communicationByPhone === true) {
      await page.click(PHONE_OI_SELECTOR);
    }
    console.log('Communication options filled in.');
    /*
        if (scenario.giftAid === true) {
          await page.click(GIFTAID_SELECTOR);
        }NOT



        if (scenario.giftAid === true) {
        //  await page.click(`#uk_tax_payer`);
          await page.click(OWN_MONEY_SELECTOR);
          await page.click(NOT_PROCEEDS_SELECTOR);
          await page.click(NOT_TICKET_SELECTOR);
        }
        console.log('Gift aid done.');
    */
    //  await page.hover('[data-drupal-selector="edit-payment-information-add-payment-method-payment-details"]');


    await page.click(CONTINUE_TO_PAYMENT_SELECTOR);


    await page.waitFor(GIFTAID_SELECTOR);

    if (scenario.giftAid === true) {
      await page.click(GIFTAID_SELECTOR);
      console.log('doing giftaid');

      //  await page.click(`#uk_tax_payer`);
      await page.click(OWN_MONEY_SELECTOR);
      await page.click(NOT_PROCEEDS_SELECTOR);
      await page.click(NOT_TICKET_SELECTOR);
    }
    console.log('Gift aid done.');

    //  await page.click(PAY_AND_COMPLETE_SELECTOR);

    await page.waitForNavigation({
      timeOut: 120,
      waitUntil: 'load'
    });



    const number = await page.evaluate((orderNumber) => {
      let orderNumberRegex = /[\d,-]+/;
      let orderString = document.querySelector(orderNumber).innerText; // document.querySelector('.hgroup').innerText
      let matches = orderString.match(orderNumberRegex);
      return matches ? matches[0] : null;
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

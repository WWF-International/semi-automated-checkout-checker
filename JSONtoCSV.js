const json2csv  = require('json2csv');

module.exports = (json) => {
    let fields = [
        "transactionID",
        "amount",
        "title",
        "firstName",
        "lastName",
        "yearOfBirth",
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
        "giftAid",
        "prompt"
    ];

    let fieldNames = [
        "Transaction ID",
        "Amount",
        "Title",
        "First name",
        "Last name",
        "Year of birth",
        "Email",
        "Mobile phone number",
        "Telephone number",
        "Postcode",
        "Address 1",
        "Address 2",
        "Address 3",
        "City or town",
        "County",
        "Country",
        "Thank you letter (true opts out)",
        "Communication by email (true opts in)",
        "Communication by text (true opts in)",
        "Communication by phone (false opts in)",
        "Communication by post (false opts in)",
        "Gift aid (true opts in)",
        "What prompted you to give?"
    ];

    let csv = json2csv({
        "data"       : json,
        "fields"     : fields,
        "fieldNames" : fieldNames
    });

    return csv;
}

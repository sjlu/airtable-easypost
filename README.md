# airtable-easypost

This will take Airtable rows and print labels using EasyPost. It'll also update records in Airtable to make sure you're not double printing.

## Running

Prerequisite: Airtable, EasyPost, Node.js

* Install Node.js dependencies

      npm install

1. You'll need to create a `.env` file with the following

      EASYPOST_API_KEY=
      AIRTABLE_ID=
      AIRTABLE_API_KEY=
      FROM_NAME=
      FROM_COMPANY=
      FROM_STREET1=
      FROM_STREET2=
      FROM_CITY=
      FROM_STATE=
      FROM_ZIP=

2. Find out what printer you want to use

      lpstat -p -d

3. Take that device name and add it into your `.env` file

      PRINTER_NAME=DYMO_LabelWriter_4XL

4. Run the script to pull Airtable and create labels

      npm start

## License

MIT

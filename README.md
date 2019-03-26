# airtable-easypost

This will utilize Airtable has a database and print EasyPost shipping labels for you (in PNG) and print with whichever CUPS printer you're using.

## Instructions

Prerequisite: Please have an Airtable account, EasyPost account, and Node.js installed

* Install Node.js dependencies

      npm install

* You'll need to create a `.env` file with the following

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

* Find out what printer you want to use

      lpstat -p -d

* Take that device name and add it into your `.env` file

      PRINTER_NAME=DYMO_LabelWriter_4XL

* Run the script to pull Airtable and create labels

      npm start

## License

MIT

require('isomorphic-fetch');
const convert = require('xml-js');
const SAMISearchPath = `http://nipper.bl.uk:8080/symws/rest/standard/lookupTitleInfo?clientID=ARMADILLO&marcEntryFilter=TEMPLATE&includeItemInfo=true&titleID=`;
const SAMISearchType = `&libraryFilter=RECORDING`;

// http://nipper.bl.uk:8080/symws/rest/standard/lookupTitleInfo?clientID=ARMADILLO&marcEntryFilter=564&includeItemInfo=true&titleID=8218617&libraryFilter=PRODUCT
// Original(s): 1 tape reel 12.5 cm 19 cm/sec mono
// Surrogate(s): 1 Wave format Audio File


module.exports = async (req, res) => {
  const recordingsIDs = req.query.ids.split(',');
  const catalogueData = await Promise.all(recordingsIDs.map(async (ID) => {
      const SAMIResponse = await fetch(SAMISearchPath + ID + SAMISearchType);
      const SAMIResponseXML = await SAMIResponse.text();
      const SAMIJSON = convert.xml2js(SAMIResponseXML, {compact: true, spaces: 2,});
      const SAMIMARCEntry = SAMIJSON.LookupTitleInfoResponse.TitleInfo.BibliographicInfo.MarcEntryInfo;
      const SAMIDescription = SAMIMARCEntry.filter((entry) => entry.entryID._text === "506").map((description) => description.text._text).join(" | ");
      const SAMIContributor = SAMIMARCEntry.filter((entry) => entry.entryID._text === "702").map((contributor) => contributor.text._text).join(" | ");
      const SAMIRecDate = SAMIMARCEntry.filter((entry) => entry.entryID._text === "260").map((recdate) => recdate.text._text).join(" | ");
      const SAMILocation = SAMIMARCEntry.filter((entry) => entry.entryID._text === "551").map((location) => location.text._text).join(" | ");
      const SAMILanguage = SAMIMARCEntry.filter((entry) => entry.entryID._text === "041").map((language) => language.text._text).join(" | ");
      const SAMIGenre = SAMIMARCEntry.filter((entry) => entry.entryID._text === "633").map((genre) => genre.text._text).join(" | ");
      const SAMIWebTheme = SAMIMARCEntry.filter((entry) => entry.entryID._text === "634").map((theme) => theme.text._text).join(" | ");
      const SAMIKeyword = SAMIMARCEntry.filter((entry) => entry.entryID._text === "650").map((keyword) => keyword.text._text).join(" | ");
      const SAMIDocumentation = SAMIMARCEntry.filter((entry) => entry.entryID._text === "525").map((documentation) => documentation.text._text).join(" | ");
      const SAMISubject = SAMIMARCEntry.filter((entry) => entry.entryID._text === "660").map((subject) => subject.text._text).join(" | ");
      const SAMIAccess = SAMIMARCEntry.filter((entry) => entry.entryID._text === "856").map((access) => access.text._text).join(" | ");
      const SAMILocOriginals = SAMIMARCEntry.filter((entry) => entry.entryID._text === "093").map((locOriginal) => locOriginal.text._text).join(" | ");
      return {
        SAMIDescription,
        SAMIContributor,
        SAMIRecDate,
        SAMILocation,
        SAMILanguage,
        SAMIGenre,
        SAMIWebTheme,
        SAMIKeyword,
        SAMIDocumentation,
        SAMISubject,
        SAMIAccess,
        SAMILocOriginals,
      };
    })
  );
  res.json(catalogueData);
};

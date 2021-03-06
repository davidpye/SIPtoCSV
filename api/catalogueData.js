require('isomorphic-fetch');
const convert = require('xml-js');
const SAMISearchPath = `http://nipper.bl.uk:8080/symws/rest/standard/lookupTitleInfo?clientID=ARMADILLO&marcEntryFilter=TEMPLATE&includeItemInfo=true&titleID=`;
const SAMISearchRecording = `&libraryFilter=RECORDING`;
const SAMISearchProduct = `&libraryFilter=PRODUCT`; 

// http://nipper.bl.uk:8080/symws/rest/standard/lookupTitleInfo?clientID=ARMADILLO&marcEntryFilter=564&includeItemInfo=true&titleID=8218617&libraryFilter=PRODUCT
// Original(s): 1 tape reel 12.5 cm 19 cm/sec mono
// Surrogate(s): 1 Wave format Audio File


module.exports = async (req, res) => {
  const productID = req.query.productID;
  const SAMIProductResponse = await fetch(SAMISearchPath + productID + SAMISearchProduct);
  const productDataXML = await SAMIProductResponse.text();
  const productDataJSON = convert.xml2js(productDataXML, {compact: true, spaces: 2,});
  const productMARCEntry = productDataJSON.LookupTitleInfoResponse.TitleInfo.BibliographicInfo.MarcEntryInfo;
  const originalFormat = productMARCEntry.filter((entry) => entry.entryID._text === "564").length ? productMARCEntry.filter((entry) => entry.entryID._text === "564")[0].text._text : 'N/A';

  const collectionTitle = productMARCEntry.filter((entry) => entry.entryID._text === "490").length ? productMARCEntry.filter((entry) => entry.entryID._text === "490")[0].text._text : '';
  const productNote = productMARCEntry.filter((entry) => entry.entryID._text === "502").length ? productMARCEntry.filter((entry) => entry.entryID._text === "502")[0].text._text : '';
  const SAMIProduct = {
    originalFormat,
    collectionTitle,
    productNote
  };
  
  const recordingsIDs = req.query.ids.split(',');
  //console.log(recordingsIDs);
  const SAMIRecording = await Promise.all(recordingsIDs.map(async (ID) => {
      const SAMIResponse = await fetch(SAMISearchPath + ID + SAMISearchRecording);
      const SAMIResponseXML = await SAMIResponse.text();
      const SAMIJSON = convert.xml2js(SAMIResponseXML, {compact: true, spaces: 2,});
      const SAMIMARCEntry = SAMIJSON.LookupTitleInfoResponse.TitleInfo.BibliographicInfo.MarcEntryInfo;
      const SAMIDescription = SAMIMARCEntry.filter((entry) => entry.entryID._text === "506").length ? SAMIMARCEntry.filter((entry) => entry.entryID._text === "506").map((description) => description.text._text).join(" | ") : '';
      const SAMIContributor = SAMIMARCEntry.filter((entry) => entry.entryID._text === "702").length ? SAMIMARCEntry.filter((entry) => entry.entryID._text === "702").map((contributor) => contributor.text._text).join(" | ") : '';
      const SAMIRecDate = SAMIMARCEntry.filter((entry) => entry.entryID._text === "260").length ? SAMIMARCEntry.filter((entry) => entry.entryID._text === "260").map((recdate) => recdate.text._text).join(" | ") : '';
      const SAMILocation = SAMIMARCEntry.filter((entry) => entry.entryID._text === "551").length ? SAMIMARCEntry.filter((entry) => entry.entryID._text === "551").map((location) => location.text._text).join(" | ") : '';
      const SAMILanguage = SAMIMARCEntry.filter((entry) => entry.entryID._text === "041").length ? SAMIMARCEntry.filter((entry) => entry.entryID._text === "041").map((language) => language.text._text).join(" | ") : '';
      const SAMIGenre = SAMIMARCEntry.filter((entry) => entry.entryID._text === "633").length ? SAMIMARCEntry.filter((entry) => entry.entryID._text === "633").map((genre) => genre.text._text).join(" | ") : '';
      const SAMIWebTheme = SAMIMARCEntry.filter((entry) => entry.entryID._text === "634").length ? SAMIMARCEntry.filter((entry) => entry.entryID._text === "634").map((theme) => theme.text._text).join(" | ") : '';
      const SAMIKeyword = SAMIMARCEntry.filter((entry) => entry.entryID._text === "650").length ? SAMIMARCEntry.filter((entry) => entry.entryID._text === "650").map((keyword) => keyword.text._text).join(" | ") : '';
      const SAMIDocumentation = SAMIMARCEntry.filter((entry) => entry.entryID._text === "525").length ? SAMIMARCEntry.filter((entry) => entry.entryID._text === "525").map((documentation) => documentation.text._text).join(" | ") : '';
      const SAMISubject = SAMIMARCEntry.filter((entry) => entry.entryID._text === "660").length ? SAMIMARCEntry.filter((entry) => entry.entryID._text === "660").map((subject) => subject.text._text).join(" | ") : '';
      const SAMIAccess = SAMIMARCEntry.filter((entry) => entry.entryID._text === "856").length ? SAMIMARCEntry.filter((entry) => entry.entryID._text === "856").map((access) => access.text._text).join(" | ") : '';
      const SAMILocOriginals = SAMIMARCEntry.filter((entry) => entry.entryID._text === "093").length ? SAMIMARCEntry.filter((entry) => entry.entryID._text === "093").map((locOriginal) => locOriginal.text._text).join(" | ") : '';
      const SAMIPerformanceNote = SAMIMARCEntry.filter((entry) => entry.entryID._text === "508").length ? SAMIMARCEntry.filter((entry) => entry.entryID._text === "508").map((performanceNote) => performanceNote.text._text).join(" | ") : '';
      const SAMIRecordingNote = SAMIMARCEntry.filter((entry) => entry.entryID._text === "509").length ? SAMIMARCEntry.filter((entry) => entry.entryID._text === "509").map((recordingNote) => recordingNote.text._text).join(" | ") : '';
      const SAMIPlaybackMode = SAMIMARCEntry.filter((entry) => entry.entryID._text === "315").length ? SAMIMARCEntry.filter((entry) => entry.entryID._text === "315").map((playbackMode) => playbackMode.text._text).join(" | ") : '';
      const SAMIBroadcastInfo = SAMIMARCEntry.filter((entry) => entry.entryID._text === "470").length ? SAMIMARCEntry.filter((entry) => entry.entryID._text === "470").map((broadcastInfo) => broadcastInfo.text._text).join(" | ") : '';
      const SAMIBroadcastTitle = SAMIMARCEntry.filter((entry) => entry.entryID._text === "474").length ? SAMIMARCEntry.filter((entry) => entry.entryID._text === "474").map((broadcastTitle) => broadcastTitle.text._text).join(" | ") : '';
      const SAMISummary = SAMIMARCEntry.filter((entry) => entry.entryID._text === "561").length ? SAMIMARCEntry.filter((entry) => entry.entryID._text === "561").map((summary) => summary.text._text).join(" | ") : '';
      const SAMITitle = SAMIMARCEntry.filter((entry) => entry.entryID._text === "246").length ? SAMIMARCEntry.filter((entry) => entry.entryID._text === "246").map((title) => title.text._text).join(" | ") : '';
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
        SAMIPerformanceNote,
        SAMIRecordingNote,
        SAMIPlaybackMode,
        SAMIBroadcastInfo,
        SAMIBroadcastTitle,
        SAMISummary,
        SAMITitle
      };
    })
  );
  res.json({
    SAMIProduct,
    SAMIRecording
  });
};

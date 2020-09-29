import convert from "xml-js";
const submit = document.getElementById("Submit");
submit.addEventListener("click", parseInputs);
const spinner = document.querySelector('.sk-cube-grid');
let parentSlug = "";
let identifierPrefix = "";
let institutionName = "";
let digitalFilesPath = "";

function dedupeArray(array) {
  return [...new Set(array)]
}

async function addLog(logData){
  const response = await fetch(`/api/doMyLogging`, {
    method: 'POST',
    body: JSON.stringify(logData),
    headers: {
      'Content-Type': 'application/json'
    }
  });
};

function handleLoading() {
  spinner.style.display = "block";
  submit.style.color = "#f4f3ee52";
  submit.disabled = true;
}

function handleCompleted() {
  spinner.style.display = "none";
  submit.style.color = "#f4f3ee";
  submit.disabled = false;
}

function parseInputs() {
  handleLoading();
  let shelfmarksString = document.getElementById("shelfMarkInput").value;
  let inputShelfmarks = shelfmarksString.replace(/[/]/g, "!2F").replace(/[,]/g, "").replace(/\r/g, "").split(/\s+/g);
  parentSlug = document.getElementById("qubitParentSlug").value;
  identifierPrefix = document.getElementById("identifierPrefix").value;
  institutionName = document.getElementById("repository").value;
  digitalFilesPath = document.getElementById("digitalObjectURI").value;
  fetchAll(dedupeArray(inputShelfmarks), parentSlug, identifierPrefix, institutionName, digitalFilesPath);
}

async function fetchAll(shelfmarks) {
  const fetchArray = await Promise.allSettled(shelfmarks.map((element) => fetchSingle(element + ",")));
  const fulfilledArray = fetchArray.filter((item) => item.status === "fulfilled");
  const rejectedArray = fetchArray.filter((item) => item.status === "rejected");
  console.log(`Fulfilled: ` + fulfilledArray.length);
  console.log(`Rejected: ` + rejectedArray.length);
  const errors = rejectedArray.map(x => x.reason);
  console.log('errors: ', errors);
  let logData = {
    shelfmarks: shelfmarks,
    parentSlug: parentSlug, 
    identifier: identifierPrefix, 
    institution: institutionName, 
    path: digitalFilesPath,
    errors: errors
  };
  addLog(logData);
  if (fulfilledArray.length === 0) {
    handleCompleted();
    alert(`WARNING: ` + rejectedArray.length + (rejectedArray.length > 1 ? ` call numbers` : ` call number`) + ` produced errors and` + (rejectedArray.length > 1 ? ` weren't` : ` wasn't`) + ` accessible. \n Please check your connection to the SIP Tool.`);
    return;
  }
  const fetchArrayValues = fulfilledArray.map((x) => x.value);
  const csvKeys = Object.keys(fetchArrayValues[0]).join(", "); //CSV Header
  const csvValues = fetchArrayValues.map(function (data) {return Object.values(data).join(", ");}); //CSV Row
  const csvOutput = [csvKeys, ...csvValues].join("\n");
  if (rejectedArray.length !== 0) {
    console.log(fetchArray);  
    handleCompleted();
    alert(`WARNING: ` + rejectedArray.length + (rejectedArray.length > 1 ? ` call numbers` : ` call number`) + ` produced errors and` + (rejectedArray.length > 1 ? ` weren't` : ` wasn't`) + ` accessible.`);
  }
  const element = document.createElement("a"); // Create CSV File from data and download
  const file = new Blob([csvOutput], { type: "text/plain" });
  element.href = URL.createObjectURL(file);
  element.download = new Date().toISOString() + ".csv";
  document.body.appendChild(element);
  element.click(); 
  handleCompleted();
}

async function fetchSingle(shelfmark) {
  const summaryResponse = await fetch(`https://avsip.ad.bl.uk/api/SearchSIPs/null/false/false/` + shelfmark); //Search for Shelfmark to acquire relevant SIP ID No.
  const summaryjson = await summaryResponse.json();
  const SIPID = summaryjson[0].Id;
  const SIPResponse = await fetch(`https://avsip.ad.bl.uk/api/SIP/` + SIPID); //Pull SIP JSON Data & Parse unformatted JSON
  const SIPjson = await SIPResponse.json();
  const ProcessMD = JSON.parse(SIPjson.ProcessMetadata);
  const LogicalMD = JSON.parse(SIPjson.LogicalStructure);
  const productID = SIPjson.SamiTitleId;
  const recordingsIDs = SIPjson.Recordings.map((recording) => recording.SamiId);
  const catalogueDataResponse = await fetch(`/api/catalogueData?ids=${recordingsIDs.join(`,`)}&productID=${productID}`);
  const catalogueDataJSON = await catalogueDataResponse.json();
  const {SAMIProduct, SAMIRecording}=catalogueDataJSON;
  const collectionTitle = (SAMIProduct.collectionTitle !== `` ? `Collection: ` + SAMIProduct.collectionTitle + `\n` : ``) ;
  const productNote = (SAMIProduct.productNote !== `` ? `Product Note: ` + SAMIProduct.productNote + `\n` : ``) ;
  const recordingDate = dedupeArray(SAMIRecording.map((recording) => recording.SAMIRecDate)).join(`\n`);
  const locations = dedupeArray(SAMIRecording.map((recording) => recording.SAMILocation)).join(`\n`);
  const languages = dedupeArray(SAMIRecording.map((recording) => recording.SAMILanguage)).join(`, `);
  const genres = dedupeArray(SAMIRecording.map((recording) => recording.SAMIGenre)).join(`\n`);
  const themes = dedupeArray(SAMIRecording.map((recording) => recording.SAMIWebTheme)).join(``);
  const keywords = dedupeArray(SAMIRecording.map((recording) => recording.SAMIKeyword)).join(``);
  const documentation = dedupeArray(SAMIRecording.map((recording) => recording.SAMIDocumentation)).join(`\n`);
  const subjects = dedupeArray(SAMIRecording.map((recording) => recording.SAMISubject)).join(``);
  const originalPBMode = dedupeArray(SAMIRecording.map((recording) => recording.SAMIPlaybackMode)).join(`, `);
  const locOriginals = dedupeArray(SAMIRecording.map((recording) => recording.SAMILocOriginals)).join(`\n`);
  const recordingsData = LogicalMD[0].children.map(function (parent) {
    let parentRecordingName = parent.text;
    let childRecordingNames = parent.childRecordings.map(function (child) {
      return child.text;
    });
    const parentFilesArray = parent.files.map(function (file) {
      const fileName = file.text;
      const fileStart = file.ranges[0].startH + ":" + file.ranges[0].startM + ":" + file.ranges[0].startS + ":" + file.ranges[0].startF;
      const fileEnd = file.ranges[0].endH + ":" + file.ranges[0].endM + ":" + file.ranges[0].endS + ":" + file.ranges[0].endF;
      return "Filename: " + fileName + " Start: " + fileStart + " End: " + fileEnd;
    }).join(`\n`);
    const childFilesArray = parent.files.map(function (file) {
      let childRangeInfo = file.ranges[0].ranges.map(function (childRange, i){
        let childFileStart = childRange.startH + ":" + childRange.startM + ":" + childRange.startS + ":" + childRange.startF;
        let childFileEnd = childRange.endH + ":" + childRange.endM + ":" + childRange.endS + ":" + childRange.endF;
        return "Start: " + childFileStart + " End: " + childFileEnd;
      })
      return childRangeInfo;
    }).flat();
    let allRecordingNames = [parentRecordingName, ...childRecordingNames]; //JOY
    let allFileInfo = [parentFilesArray, ...childFilesArray];
    let combinedRecordingsData = allRecordingNames.map((name, i) => {
      return name + "\n" + 
        (SAMIRecording[i].SAMIDescription !== undefined ? `Description: ` + SAMIRecording[i].SAMIDescription.replace(/"/g, ``) :``) +
        (SAMIRecording[i].SAMILocation !== undefined ? `Recording Location: ` + SAMIRecording[i].SAMILocation + `\n` : ``) +
        (SAMIRecording[i].SAMIContributor !== undefined ? `Contributors: ` + SAMIRecording[i].SAMIContributor + `\n` : ``) +
        allFileInfo[i];
    }).join(`\n\n`);
    return combinedRecordingsData;
  }).join(`\n\n`);
  const ProcessMDXML = convert.xml2js(SIPjson.Submissions[0].METS, {compact: true, spaces: 2,});
  const processXMLBody = ProcessMDXML["mets:mets"];
  const processXMLRights = processXMLBody["mets:amdSec"][0]["mets:rightsMD"]["mets:mdWrap"]["mets:xmlData"]["odrl:policy"];
  let techMDs;
  let transferData;
  if (ProcessMD === null){
    transferData = `No Transfer Metadata found - Product was born digital, see Original Format for more information.`;
  } else {
    techMDs = processXMLBody["mets:amdSec"].filter(function (element) {return Object.keys(element).some(function (key) {return key === "mets:techMD";});});
    transferData = techMDs.map(function (transferFile) {
        let transferFilename = transferFile["mets:techMD"][0]["mets:mdWrap"]["mets:xmlData"]["mediaMD:mediaMD"]["mediaMD:fileData"]["mediaMD:fileName"]._text;
        let transferFormat = transferFile["mets:techMD"][0]["mets:mdWrap"]["mets:xmlData"]["mediaMD:mediaMD"]["mediaMD:fileData"]["mediaMD:format"]._text;
        let transferBitdepth = transferFile["mets:techMD"][0]["mets:mdWrap"]["mets:xmlData"]["mediaMD:mediaMD"]["mediaMD:streamData"]["mediaMD:bitDepth"]._text;
        let transferSamplerate = transferFile["mets:techMD"][0]["mets:mdWrap"]["mets:xmlData"]["mediaMD:mediaMD"]["mediaMD:streamData"]["mediaMD:samplingRate"]._text;
        let transferChannels = transferFile["mets:techMD"][0]["mets:mdWrap"]["mets:xmlData"]["mediaMD:mediaMD"]["mediaMD:streamData"]["mediaMD:channels"]._text;
        let transferProcesses = transferFile["mets:techMD"][1]["mets:mdWrap"]["mets:xmlData"]["blaph:processHistory"]["blaph:processEvent"].map(function (processEvent) {
            let processDescription = processEvent._attributes.processDescription;
            let processDevices = processEvent["blaph:deviceChain"]["blaph:device"];
            let processDevicesArray = processDevices.length ? processDevices : [processDevices];
            let devices = processDevicesArray.map(function (processDevice) {
                let deviceRole = processDevice._attributes.functionalRole;
                let deviceMan = processDevice._attributes.manufacturer !== undefined ? processDevice._attributes.manufacturer : ``;
                let deviceModel = processDevice._attributes.modelName !== undefined ? processDevice._attributes.modelName : ``;
                let deviceSerial = processDevice._attributes.serialNumber !== undefined ? processDevice._attributes.serialNumber : "N/A";
                let deviceType = processDevice._attributes.type !== undefined ? processDevice._attributes.type : ``;
                let deviceComponents = processDevice["blaph:component"] !== undefined ? processDevice["blaph:component"] : ``;
                let deviceComponentArray = deviceComponents.length ? deviceComponents : [deviceComponents];
                let components = deviceComponentArray.map(function (deviceComponent){
                    let compMan = deviceComponent._attributes !== undefined && deviceComponent._attributes.manufacturer !== `` && deviceComponent._attributes.manufacturer !== `Not known` ? deviceComponent._attributes.manufacturer : ``;
                    let compModel = deviceComponent._attributes !== undefined && deviceComponent._attributes.modelName !== `` ? deviceComponent._attributes.modelName : ``;
                    let compType = deviceComponent._attributes !== undefined && deviceComponent._attributes.type !== `` ? deviceComponent._attributes.type : ``;
                    let compTrackingForce = deviceComponent["blaph:settings"] !==undefined && deviceComponent["blaph:settings"]["blaph:trackingForce"] !==undefined ? deviceComponent["blaph:settings"]["blaph:trackingForce"]._text : ``;
                    return ((compMan !== `` ? compMan + ` ` : ``) + (compModel !== `` ? compModel + ` ` : ``) + (compType !==`` ? compType : ``) + (compTrackingForce !==`` ? ` (Tracking Force: ` + compTrackingForce + `g)` : ``));
                  }).join(', ');
                let deviceParameters = processDevice["blaph:settings"];
                let deviceParameterArray = deviceParameters.length ? deviceParameters : [deviceParameters];
                let parameters = deviceParameterArray.map(function (deviceParameter) {
                    let tempParameter = deviceParameter["blaph:temperature"] && deviceParameter["blaph:temperature"]._attributes !== undefined ? `Temperature: ` + deviceParameter["blaph:temperature"]._text + ` Degrees ` + deviceParameter["blaph:temperature"]._attributes.units : ``;
                    let timeParameter = deviceParameter["blaph:time"] && deviceParameter["blaph:time"]._attributes !== undefined ? ", Time: " + deviceParameter["blaph:time"]._text + ` ` + deviceParameter["blaph:time"]._attributes.units : ``;
                    let eqStandard = deviceParameter["blaph:equalisation"] && deviceParameter[`blaph:equalisation`]._attributes !== undefined ? `Replay EQ: ` + deviceParameter[`blaph:equalisation`]._attributes.standard : `Replay EQ: N/A`;
                    let eqTurnovers = ``;
                    if (deviceParameter["blaph:equalisation"] && deviceParameter["blaph:equalisation"]["blaph:turnover1"] !== undefined){
                      let eqSettings = Object.values(deviceParameter["blaph:equalisation"]).map((turnover, i) => {
                        let turnoverFreq = turnover["blaph:turnover"] !== undefined && turnover["blaph:turnover"]._text !== `` && turnover["blaph:turnover"]._text !== `0` ? turnover["blaph:turnover"]._text : ``;
                        let turnoverSlope = turnover["blaph:slope"] !== undefined && turnover["blaph:slope"]._text !== `` && turnover["blaph:slope"]._text !== `0` ? turnover["blaph:slope"]._text : ``;
                        return ((turnoverFreq !== `` ? `EQ Turnover ` + (i+1) + ` Frequency: ` + turnoverFreq + `Hz `: ``) + (turnoverSlope !== `` ? `Slope: ` + turnoverSlope + ` dB/8ve` : ``));
                      }).join(`, `);
                      eqTurnovers = eqSettings;
                    }
                    let speedParameter = deviceParameter["blaph:replaySpeed"] && deviceParameter["blaph:replaySpeed"]._text !== undefined ? `, Replay Speed: ` + deviceParameter["blaph:replaySpeed"]._text + `cm/s` : ``;
                    let nrParameter = deviceParameter["blaph:noiseReduction"] && deviceParameter["blaph:noiseReduction"]._attributes.type !== undefined ? `, Noise Reduction: ` + deviceParameter["blaph:noiseReduction"]._attributes.type : ``;
                    let deviceNotes = deviceParameter["blaph:settingsNote"] && deviceParameter["blaph:settingsNote"]._text !== undefined && deviceParameter["blaph:settingsNote"]._text !== `` ? `\nNote: ` + deviceParameter[`blaph:settingsNote`]._text : ``;
                    return ((deviceRole == `Heater` ? tempParameter + timeParameter : ``) + (deviceRole == `Reproducer` ? eqStandard + speedParameter + nrParameter : ``) + (deviceRole == "Equaliser/Filter" && eqTurnovers !==`` ? eqTurnovers : ``) + (deviceNotes !== `` ? deviceNotes : ``));
                  }).join();
                let inputs = [];
                let outputs = [];
                if (processDevice["blaph:connections"] === undefined) {
                  inputs = [];
                } else if (processDevice["blaph:connections"]["blaph:input"] !== undefined) {
                  inputs = processDevice["blaph:connections"]["blaph:input"].map(function (input) {
                      let inputFormat = input._attributes.signalFormat;
                      let inputInterface = input._attributes.interfaceType;
                      let inputChannel = input._attributes.channel;
                      return (inputFormat + ` ` + inputInterface + `: ` + inputChannel);
                  }).join(` & `);
                } else if (processDevice["blaph:connections"]["blaph:output"] !== undefined) {
                  outputs = processDevice["blaph:connections"]["blaph:output"].map(function (output) {
                      let outputFormat = output._attributes.signalFormat;
                      let outputInterface = output._attributes.interfaceType;
                      let outputChannel = output._attributes.channel;
                      return (outputFormat + ` ` + outputInterface + `: ` + outputChannel);
                  }).join(` & `);
                }
                return (deviceRole + `: ` + deviceMan + ` ` + deviceModel + ` ` + deviceType + (deviceSerial !== `` ? `, S/N: ` + deviceSerial : ``) + 
                (components !== `` ? `\nDevice Components: ` + components : ``) + 
                (parameters !== `` ? `\nDevice Parameters: ` + parameters : ``) + (inputs.length !== 0 ? `\nInputs: ` + inputs : ``) + (outputs.length !== 0 ? `\nOutputs: ` + outputs : ``) + `\n`);
              }).join(``);
            return processDescription + `:\n` + devices;
          }).join(`\n`);
        return (transferFilename + `\n` + `Format: ` + transferFormat + ` ` + transferBitdepth + `Bit ` + transferSamplerate + `Hz ` + (transferChannels > 1 ? transferChannels + ` Channel` + `s` : transferChannels + ` Channel`) + `\n` + transferProcesses);
      }).join(`\n`);
  }
  const createdFilePaths = SIPjson.Files.map(function (file) {
    let fileName = file.Name;
    let filePath = digitalFilesPath + fileName;
    return filePath;
  }).join(`\n`);

  const recordingNotes = SAMIRecording.map((recording, i) => {
    let recordingName = (SAMIRecording[i].SAMITitle !== `` ? `Recording Name: ` + SAMIRecording[i].SAMITitle : ``) ;
    let recordingNote = (SAMIRecording[i].SAMIRecordingNote !== `` ? `\nRecording Note: ` + SAMIRecording[i].SAMIRecordingNote : ``) ;
    let performanceNote = (SAMIRecording[i].SAMIPerformanceNote !== `` ? `\nPerformance Note: ` + SAMIRecording[i].SAMIPerformanceNote : ``) ;
    let summary = (SAMIRecording[i].SAMISummary !== `` ? `\nRecording Summary: ` + SAMIRecording[i].SAMISummary : ``) ;
    return recordingName + recordingNote + performanceNote + summary;
  }).join(`\n\n`);

  console.log(recordingNotes);

  const csvData = {
    legacyId: "",
    parentId: "",
    qubitParentSlug: parentSlug !== "" ? parentSlug : ``, //SIPjson.SamiTitle.toString().replace(/[,. \s+]/g, `-`).toLowerCase(),
    identifier: identifierPrefix !== "" ? identifierPrefix + "/" + SIPjson.SamiCallNumber : SIPjson.SamiCallNumber,
    accessionNumber: "",
    title: '"' + SIPjson.SamiCallNumber + `: ` + SIPjson.SamiTitle.toString().replace(/,/g, ` `) + '"',
    levelOfDescription: "Product",
    extentAndMedium: '"' + `Original(s): ` + SAMIProduct.originalFormat + `\nSurrogate(s): ` + LogicalMD[0].children[0].files.length + ` Wave format Audio File` + (LogicalMD[0].children[0].files.length > 1 ? `s` : ``) + `\nOriginal Playback Mode: ` + originalPBMode + '"',
    repository: institutionName,
    archivalHistory: "",
    acquisition: "",
    scopeAndContent: '"' + collectionTitle + recordingsData + '"',
    appraisal: "",
    accruals: "",
    arrangement: "",
    accessConditions: "",
    reproductionConditions: '"' + (processXMLRights["dc:rights"] !== undefined ? `Rights Attribution: ` + processXMLRights["dc:rights"]._text : ``) + (processXMLRights["dc:contributor"] !== undefined ? `\nRights Contributor: ` + processXMLRights["dc:contributor"]._text : ``) + (processXMLRights["dc:provenance"] !== undefined ? `\nRights Provenance: ` + processXMLRights["dc:provenance"]._text : ``)  + '"',
    language: "",
    script: "",
    languageNote: '"' + `Language of Material: ` + languages + '"',
    physicalCharacteristics: '"' + transferData + '"',
    findingAids: '"' + documentation + '"',
    locationOfOriginals: '"' + locOriginals + '"',
    locationOfCopies: "The British Library",
    relatedUnitsOfDescription: "",
    publicationNote: '"' + productNote + '"',
    digitalObjectURI: '"' + createdFilePaths + '"',
    generalNote: '"' + recordingNotes + '"',
    subjectAccessPoints: '"' + (subjects !== `` && subjects !== ` ` ? subjects : ``) + (keywords !==`` && keywords !==` ` ? ` | ` : ``) + (keywords !==`` && keywords !==` ` ? keywords : ``) + (themes !==`` && themes !==` ` ? ` | ` : ``) + (themes !==`` && themes !== ` ` ? themes : ``) + '"',
    placeAccessPoints: '"' + locations + '"',
    nameAccessPoints: "",
    genreAccessPoints: '"' + genres + '"',
    descriptionIdentifier: "",
    institutionIdentifier: "",
    rules: "",
    descriptionStatus: "",
    levelOfDetail: "",
    revisionHistory: "",
    languageOfDescription: "",
    scriptOfDescription: "",
    sources: "",
    archivistNote: "",
    publicationStatus: "",
    physicalObjectName: "",
    physicalObjectLocation: "",
    physicalObjectType: "",
    alternativeIdentifiers: "",
    alternativeIdentifierLabels: "",
    eventDates: '"' + recordingDate + '"',
    eventTypes: "Creation",
    eventStartDates: "",
    eventEndDates: "",
    eventActors: "",
    eventActorHistories: "",
    culture: "",
  };

  return csvData;
}
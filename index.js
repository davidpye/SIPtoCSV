import convert from "xml-js";
const submit = document.getElementById("Submit");
submit.addEventListener("click", parseInputs);
const spinner = document.querySelector('.sk-cube-grid');
let parentSlug = "";
let identifierPrefix = "";
let institutionName = "";
let digitalFilesPath = "";

//Create Logging System for Shelfmarks Searched and the Times Searches are made

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
  fetchAll(inputShelfmarks, parentSlug, identifierPrefix, institutionName, digitalFilesPath);
}

async function fetchAll(shelfmarks) {
  const fetchArray = await Promise.allSettled(shelfmarks.map((element) => fetchSingle(element + ",")));
  console.log(fetchArray);
  const fulfilledArray = fetchArray.filter((item) => item.status === "fulfilled");
  const rejectedArray = fetchArray.filter((item) => item.status === "rejected");
  console.log(`Fulfilled: ` + fulfilledArray.length);
  console.log(`Rejected: ` + rejectedArray.length);
  if (fulfilledArray.length === 0) {
    handleCompleted();
    alert(`WARNING: ` + rejectedArray.length + (rejectedArray.length > 1 ? ` shelfmarks` : ` shelfmark`) + ` produced errors and` + (rejectedArray.length > 1 ? ` weren't` : ` wasn't`) + ` accessible. \n Please check your connection to the SIP Tool.`);
  }
  const fetchArrayValues = fulfilledArray.map((x) => x.value);
  const csvKeys = Object.keys(fetchArrayValues[0]).join(", "); //CSV Header
  const csvValues = fetchArrayValues.map(function (data) {return Object.values(data).join(", ");}); //CSV Row
  const csvOutput = [csvKeys, ...csvValues].join("\n");
  if (rejectedArray.length !== 0) {
    handleCompleted();
    alert(`WARNING: ` + rejectedArray.length + (rejectedArray.length > 1 ? ` shelfmarks` : ` shelfmark`) + ` produced errors and` + (rejectedArray.length > 1 ? ` weren't` : ` wasn't`) + ` accessible.`);
  }
  // const element = document.createElement("a"); // Create CSV File from data and download
  // const file = new Blob([csvOutput], { type: "text/plain" });
  // element.href = URL.createObjectURL(file);
  // element.download = new Date().toISOString() + ".csv";
  // document.body.appendChild(element);
  // element.click();
  // let logData = {
  //   date: new Date(),
  //   shelfmarks: shelfmarks,
  //   parentSlug: parentSlug, 
  //   identifier: identifierPrefix, 
  //   institution: institutionName, 
  //   path: digitalFilesPath,
  //   errors: rejectedArray.length
  // };
  handleCompleted();
}

function arrayUnique(array) {
  var a = array.concat();
  for(var i=0; i<a.length; ++i) {
    for(var j=i+1; j<a.length; ++j) {
      if(a[i] === a[j])
        a.splice(j--, 1);
    }
  }
  return a;
}

async function fetchSingle(shelfmark) {
  const summaryResponse = await fetch(`https://avsip.ad.bl.uk/api/SearchSIPs/null/false/false/` + shelfmark); //Search for Shelfmark to acquire relevant SIP ID No.
  const summaryjson = await summaryResponse.json();
  const SIPID = summaryjson[0].Id;
  const SIPResponse = await fetch(`https://avsip.ad.bl.uk/api/SIP/` + SIPID); //Pull SIP JSON Data & Parse unformatted JSON
  const SIPjson = await SIPResponse.json();
  const ProcessMD = JSON.parse(SIPjson.ProcessMetadata);
  const ProcessMDXML = convert.xml2js(SIPjson.Submissions[0].METS, {compact: true, spaces: 2,});
  const processXMLBody = ProcessMDXML["mets:mets"];
  const processXMLRights = processXMLBody["mets:amdSec"][0]["mets:rightsMD"]["mets:mdWrap"]["mets:xmlData"]["odrl:policy"];
  const techMDs = processXMLBody["mets:amdSec"].filter(function (element) {return Object.keys(element).some(function (key) {return key === "mets:techMD";});});
  const LogicalMD = JSON.parse(SIPjson.LogicalStructure);
  console.log (`LogicalMD: `, LogicalMD);
  const PhysicalMD = JSON.parse(SIPjson.PhysicalStructure);
  const productID = SIPjson.SamiTitleId;
  const recordingsIDs = SIPjson.Recordings.map((recording) => recording.SamiId);
  const catalogueDataResponse = await fetch(`/api/catalogueData?ids=${recordingsIDs.join(`,`)}&productID=${productID}`);
  const catalogueDataJSON = await catalogueDataResponse.json();
  const {SAMIProduct, catalogueData}=catalogueDataJSON;
  const recordingDate = catalogueData.map((recording) => recording.SAMIRecDate).join(`\n`);
  const locations = catalogueData.map((recording) => recording.SAMILocation).join(`\n`);
  const languages = catalogueData.map((recording) => recording.SAMILanguage).join(`, `)
  const genres = catalogueData.map((recording) => recording.SAMIGenre).join(`\n`);
  const themes = catalogueData.map((recording) => recording.SAMIWebTheme).join(``);
  const keywords = catalogueData.map((recording) => recording.SAMIKeyword).join(``);
  const documentation = catalogueData.map((recording) => recording.SAMIDocumentation).join(`\n`);
  const subjects = catalogueData.map((recording) => recording.SAMISubject).join(``);
  const locOriginals = catalogueData.map((recording) => recording.SAMILocOriginals).join(`\n`);
  
  const recordingsData = LogicalMD[0].children.map(function (parent) {
    let parentRecordingName = parent.text;
    let childRecordingNames = parent.childRecordings.map(function (child) {
      return child.text;
    });
    let allFileInfo = parent.files.map(function (file) {
      let fileName = file.text;
      let fileStart = file.ranges[0].startH + ":" + file.ranges[0].startM + ":" + file.ranges[0].startS + ":" + file.ranges[0].startF;
      let fileEnd = file.ranges[0].endH + ":" + file.ranges[0].endM + ":" + file.ranges[0].endS + ":" + file.ranges[0].endF;
      let childRangeInfo = file.ranges[0].ranges.map(function (childRange, i){
        let childFileStart = childRange.startH + ":" + childRange.startM + ":" + childRange.startS + ":" + childRange.startF;
        let childFileEnd = childRange.endH + ":" + childRange.endM + ":" + childRange.endS + ":" + childRange.endF;
        return "Start: " + childFileStart + " End: " + childFileEnd;
      })
      let parentRangeInfo = "Filename: " + fileName + " Start: " + fileStart + " End: " + fileEnd;
      return [parentRangeInfo, ...childRangeInfo];
    });
    console.log(allFileInfo);
    console.log(...allFileInfo);
    let allRecordingNames = [parentRecordingName, ...childRecordingNames];
    let combinedRecordingsData = allRecordingNames.map((name, i) => {
      return name + "\n" + 
        (catalogueData[i].SAMIDescription !== undefined ? `Description: ` + catalogueData[i].SAMIDescription.replace(/"/g, ``) :``) +
        (catalogueData[i].SAMILocation !== undefined ? `Recording Location: ` + catalogueData[i].SAMILocation + `\n` : ``) +
        (catalogueData[i].SAMIContributor !== undefined ? `Contributors: ` + catalogueData[i].SAMIContributor + `\n` : ``) +
        allFileInfo[0][i];
    }).join(`\n\n`);
    return combinedRecordingsData;
  }).join(`\n\n`);


  //console.log (recordingsData);
  // const recordingsData = LogicalMD[0].children.map(function (child, i) {
  //     let recordingName = child.text;
  //     let fileInfo = child.files.map(function (file) {
  //         let fileName = file.text;
  //         let fileStart = file.ranges[0].startH + ":" + file.ranges[0].startM + ":" + file.ranges[0].startS + ":" + file.ranges[0].startF;
  //         let fileEnd = file.ranges[0].endH + ":" + file.ranges[0].endM + ":" + file.ranges[0].endS + ":" + file.ranges[0].endF;
  //         return `Filename and Duration: ` + fileName + "\nStart: " + fileStart + " End: " + fileEnd;
  //       }).join("\n");
  //     return (recordingName + "\n" + `Description: ` + catalogueData[i].SAMIDescription.replace(/"/g, ``) + `\n` + `Recording Location: ` + catalogueData[i].SAMILocation + `\n` + `Contributors: ` + catalogueData[i].SAMIContributor + `\n` + fileInfo
  //     );
  //   }).join(`\n\n`);
  const transferData = techMDs.map(function (transferFile) {
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
  const createdFilePaths = SIPjson.Files.map(function (file) {
    let fileName = file.Name;
    let filePath = digitalFilesPath + fileName;
    return filePath;
  }).join(`\n`);
  const csvData = {
    legacyId: "",
    parentId: "",
    qubitParentSlug: parentSlug !== "" ? parentSlug : ``, //SIPjson.SamiTitle.toString().replace(/[,. \s+]/g, `-`).toLowerCase(),
    identifier: identifierPrefix !== "" ? identifierPrefix + "/" + SIPjson.SamiCallNumber : SIPjson.SamiCallNumber,
    accessionNumber: "",
    title: '"' + SIPjson.SamiCallNumber + `: ` + SIPjson.SamiTitle.toString().replace(/,/g, ` `) + '"',
    levelOfDescription: "Product",
    extentAndMedium: '"' + `Original(s): ` + SAMIProduct.originalFormat + `\nSurrogate(s): ` + LogicalMD[0].children[0].files.length + ` Wave format Audio File` + (LogicalMD[0].children[0].files.length > 1 ? `s` : ``) + '"',
    repository: institutionName,
    archivalHistory: "",
    acquisition: "",
    scopeAndContent: '"' + recordingsData + '"',
    appraisal: "",
    accruals: "",
    arrangement: "",
    accessConditions: "",
    reproductionConditions: '"' + `Rights Attribution: ` + processXMLRights["dc:rights"]._text + `\nRights Contributor: ` + processXMLRights["dc:contributor"]._text + `\nRights Provenance: ` + processXMLRights["dc:provenance"]._text + '"',
    language: "",
    script: "",
    languageNote: '"' + `Language of Material: ` + languages + '"',
    physicalCharacteristics: '"' + transferData + '"',
    findingAids: '"' + documentation + '"',
    locationOfOriginals: '"' + locOriginals + '"',
    locationOfCopies: "The British Library",
    relatedUnitsOfDescription: "",
    publicationNote: "",
    digitalObjectURI: '"' + createdFilePaths + '"',
    generalNote: "",
    subjectAccessPoints: '"' + (subjects !== `` ? subjects + ` | ` : ``) + (keywords !==`` ? keywords + ` | ` : ``) + (themes !==`` ? themes + ` | ` : ``) + '"',
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
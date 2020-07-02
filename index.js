import convert from "xml-js";

document.getElementById("Submit").addEventListener("click", parseInputs);
let parentSlug = "";
let identifierPrefix = "";
let institutionName = "";
let digitalFilesPath = "";

function parseInputs() {
  let shelfmarksString = document.getElementById("shelfMarkInput").value;
  let inputShelfmarks = shelfmarksString
    .replace(/[/]/g, "!2F")
    .replace(/[,]/g, "")
    .replace(/\r/g, "")
    .split(/\s+/g);
  parentSlug = document.getElementById("qubitParentSlug").value;
  identifierPrefix = document.getElementById("identifierPrefix").value;
  institutionName = document.getElementById("repository").value;
  digitalFilesPath = document.getElementById("digitalObjectURI").value;
  fetchAll(
    inputShelfmarks,
    parentSlug,
    identifierPrefix,
    institutionName,
    digitalFilesPath
  );
}

async function fetchAll(shelfmarks) {
  const fetchArray = await Promise.allSettled(
    shelfmarks.map((element) => fetchSingle(element + ","))
  );
  const fulfilledArray = fetchArray.filter(
    (item) => item.status === "fulfilled"
  );
  const rejectedArray = fetchArray.filter((item) => item.status === "rejected");
  console.log(`Fulfilled: ` + fulfilledArray.length);
  console.log(`Rejected: ` + rejectedArray.length);
  const fetchArrayValues = fulfilledArray.map((x) => x.value);
  const csvKeys = Object.keys(fetchArrayValues[0]).join(", "); //CSV Header
  const csvValues = fetchArrayValues.map(function (data) {
    return Object.values(data).join(", ");
  }); //CSV Row
  const csvOutput = [csvKeys, ...csvValues].join("\n");
  if (rejectedArray.length !== 0) {
    alert(
      `WARNING: ` +
        rejectedArray.length +
        (rejectedArray.length > 1 ? ` shelfmarks` : ` shelfmark`) +
        ` produced errors and` +
        (rejectedArray.length > 1 ? ` weren't` : ` wasn't`) +
        ` accessible.`
    );
  }
  const element = document.createElement("a");
  const file = new Blob([csvOutput], { type: "text/plain" });
  element.href = URL.createObjectURL(file);
  element.download = new Date().toISOString() + ".csv";
  document.body.appendChild(element);
  element.click();
}

async function fetchSingle(shelfmark) {
  const summaryResponse = await fetch(
    `https://avsip.ad.bl.uk/api/SearchSIPs/null/false/false/` + shelfmark
  ); //Search for Shelfmark to acquire relevant SIP ID No.
  const summaryjson = await summaryResponse.json();
  const id = summaryjson[0].Id;
  const SIPResponse = await fetch(`https://avsip.ad.bl.uk/api/SIP/` + id); //Pull SIP JSON Data & Parse unformatted JSON
  const SIPjson = await SIPResponse.json();
  const ProcessMD = JSON.parse(SIPjson.ProcessMetadata);
  const ProcessMDXML = convert.xml2js(SIPjson.Submissions[0].METS, {
    compact: true,
    spaces: 2,
  });
  const processXMLBody = ProcessMDXML["mets:mets"];
  const processXMLRights =
    processXMLBody["mets:amdSec"][0]["mets:rightsMD"]["mets:mdWrap"][
      "mets:xmlData"
    ]["odrl:policy"];
  const techMDs = processXMLBody["mets:amdSec"].filter(function (element) {
    return Object.keys(element).some(function (key) {
      return key === "mets:techMD";
    });
  });

  
  const LogicalMD = JSON.parse(SIPjson.LogicalStructure);
  const PhysicalMD = JSON.parse(SIPjson.PhysicalStructure);
  const recordingsIDs = SIPjson.Recordings.map((recording) => recording.SamiId);

  const catalogueDataResponse = await fetch(`/api/catalogueData?ids=${recordingsIDs.join(',')}`);
  const catalogueData = await catalogueDataResponse.json();
  console.log(catalogueData);
  const recordingDate = catalogueData
    .map((recording) => recording.SAMIRecDate)
    .join(`\n`);
  const locations = catalogueData
    .map((recording) => recording.SAMILocation)
    .join(`\n`);
  const languages = catalogueData
    .map((recording) => recording.SAMILanguage)
    .join(`\n`);
  const genres = catalogueData
    .map((recording) => recording.SAMIGenre)
    .join(`\n`);
  const themes = catalogueData
    .map((recording) => recording.SAMIWebTheme)
    .join(`\n`);
  const keywords = catalogueData
    .map((recording) => recording.SAMIKeyword)
    .join(`\n`);
  const documentation = catalogueData
    .map((recording) => recording.SAMIDocumentation)
    .join(`\n`);
  const subjects = catalogueData
    .map((recording) => recording.SAMISubject)
    .join(`\n`);
  const locOriginals = catalogueData
    .map((recording) => recording.SAMILocOriginals)
    .join(`\n`);

  const recordingsData = LogicalMD[0].children
    .map(function (child, i) {
      let recordingName = child.text;
      let fileInfo = child.files
        .map(function (file) {
          let fileName = file.text;
          let fileStart =
            file.ranges[0].startH +
            ":" +
            file.ranges[0].startM +
            ":" +
            file.ranges[0].startS +
            ":" +
            file.ranges[0].startF;
          let fileEnd =
            file.ranges[0].endH +
            ":" +
            file.ranges[0].endM +
            ":" +
            file.ranges[0].endS +
            ":" +
            file.ranges[0].endF;
          return fileName + "\nStart: " + fileStart + "\nEnd: " + fileEnd;
        })
        .join("\n");
      return (
        recordingName +
        "\n" +
        `Description: ` +
        catalogueData[i].SAMIDescription +
        `\n` +
        `Location: ` +
        catalogueData[i].SAMILocation +
        `\n` +
        `Contributors: ` +
        catalogueData[i].SAMIContributor +
        `\n` +
        fileInfo
      );
    })
    .join("\n\n");

  const transferData = techMDs
    .map(function (transferFile) {
      let transferFilename =
        transferFile["mets:techMD"][0]["mets:mdWrap"]["mets:xmlData"][
          "mediaMD:mediaMD"
        ]["mediaMD:fileData"]["mediaMD:fileName"]._text;
      let transferFormat =
        transferFile["mets:techMD"][0]["mets:mdWrap"]["mets:xmlData"][
          "mediaMD:mediaMD"
        ]["mediaMD:fileData"]["mediaMD:format"]._text;
      let transferBitdepth =
        transferFile["mets:techMD"][0]["mets:mdWrap"]["mets:xmlData"][
          "mediaMD:mediaMD"
        ]["mediaMD:streamData"]["mediaMD:bitDepth"]._text;
      let transferSamplerate =
        transferFile["mets:techMD"][0]["mets:mdWrap"]["mets:xmlData"][
          "mediaMD:mediaMD"
        ]["mediaMD:streamData"]["mediaMD:samplingRate"]._text;
      let transferChannels =
        transferFile["mets:techMD"][0]["mets:mdWrap"]["mets:xmlData"][
          "mediaMD:mediaMD"
        ]["mediaMD:streamData"]["mediaMD:channels"]._text;
      let transferProcesses = transferFile["mets:techMD"][1]["mets:mdWrap"][
        "mets:xmlData"
      ]["blaph:processHistory"]["blaph:processEvent"]
        .map(function (processEvent) {
          let processDescription = processEvent._attributes.processDescription;
          let processDevices =
            processEvent["blaph:deviceChain"]["blaph:device"];
          let processDevicesArray = processDevices.length
            ? processDevices
            : [processDevices];
          let devices = processDevicesArray
            .map(function (processDevice) {
              let deviceRole = processDevice._attributes.functionalRole;
              let deviceMan = processDevice._attributes.manufacturer;
              let deviceModel = processDevice._attributes.modelName;
              let deviceSerial =
                processDevice._attributes.serialNumber !== undefined
                  ? processDevice._attributes.serialNumber
                  : "N/A";
              let deviceParameters = processDevice["blaph:settings"];
              let deviceParameterArray = deviceParameters.length
                ? deviceParameters
                : [deviceParameters];
              let parameters = deviceParameterArray
                .map(function (deviceParameter) {
                  let tempParameter =
                    deviceParameter["blaph:temperature"] &&
                    deviceParameter["blaph:temperature"]._attributes !==
                      undefined
                      ? `Temperature: ` +
                        deviceParameter["blaph:temperature"]._text +
                        ` Degrees ` +
                        deviceParameter["blaph:temperature"]._attributes.units
                      : ``;
                  let timeParameter =
                    deviceParameter["blaph:time"] &&
                    deviceParameter["blaph:time"]._attributes !== undefined
                      ? ", Time: " +
                        deviceParameter["blaph:time"]._text +
                        ` ` +
                        deviceParameter["blaph:time"]._attributes.units
                      : ``;
                  let eqParameter =
                    deviceParameter["blaph:equalisation"] &&
                    deviceParameter[`blaph:equalisation`]._attributes
                      .standard !== undefined
                      ? `Replay EQ: ` +
                        deviceParameter[`blaph:equalisation`]._attributes
                          .standard
                      : ``;
                  let speedParameter =
                    deviceParameter["blaph:replaySpeed"] &&
                    deviceParameter["blaph:replaySpeed"]._text !== undefined
                      ? `, Replay Speed: ` +
                        deviceParameter["blaph:replaySpeed"]._text +
                        `cm/s`
                      : ``;
                  let nrParameter =
                    deviceParameter["blaph:noiseReduction"] &&
                    deviceParameter["blaph:noiseReduction"]._attributes.type !==
                      undefined
                      ? `, Noise Reduction: ` +
                        deviceParameter["blaph:noiseReduction"]._attributes.type
                      : ``;
                  let deviceNotes =
                    deviceParameter["blaph:settingsNote"] &&
                    deviceParameter["blaph:settingsNote"]._text !== undefined
                      ? `\nNote: ` + deviceParameter[`blaph:settingsNote`]._text
                      : ``;
                  return (
                    (deviceRole == `Heater`
                      ? tempParameter + timeParameter
                      : ``) +
                    (deviceRole == `Reproducer`
                      ? eqParameter + speedParameter + nrParameter
                      : ``) +
                    (deviceNotes !== `` ? deviceNotes : ``)
                  );
                })
                .join();
              let inputs = [];
              if (processDevice["blaph:connections"] === undefined) {
                inputs = [];
              } else if (
                processDevice["blaph:connections"]["blaph:input"] !== undefined
              ) {
                inputs = processDevice["blaph:connections"]["blaph:input"]
                  .map(function (input) {
                    let inputFormat = input._attributes.signalFormat;
                    let inputInterface = input._attributes.interfaceType;
                    let inputChannel = input._attributes.channel;
                    return (
                      inputFormat + ` ` + inputInterface + ` - ` + inputChannel
                    );
                  })
                  .join(` & `);
              }
              return (
                deviceRole +
                `: ` +
                deviceMan +
                ` ` +
                deviceModel +
                (deviceSerial !== `` ? `, S/N: ` + deviceSerial : ``) +
                (parameters !== ``
                  ? `\nDevice Parameters: ` + parameters
                  : ``) +
                (inputs !== "" ? `\n` + inputs : ``)
              );
            })
            .join("\n");
          return processDescription + `:\n` + devices;
        })
        .join(`\n`);
      return (
        transferFilename +
        `\n` +
        `Format: ` +
        transferFormat +
        ` ` +
        transferBitdepth +
        `Bit ` +
        transferSamplerate +
        `Hz ` +
        (transferChannels > 1
          ? transferChannels + ` Channel` + `s`
          : transferChannels + ` Channel`) +
        `\n` +
        transferProcesses
      );
    })
    .join(`\n`);

  const createdFilePaths = SIPjson.Files.map(function (file) {
    let fileName = file.Name;
    let filePath = digitalFilesPath + fileName;
    return filePath;
  }).join(`\n`);

  const csvData = {
    legacyId: "",
    parentId: "",
    qubitParentSlug:
      parentSlug !== ""
        ? parentSlug
        : SIPjson.SamiTitle.toString()
            .replace(/[,. \s+]/g, `-`)
            .toLowerCase(),
    identifier:
      identifierPrefix !== ""
        ? identifierPrefix + "/" + SIPjson.SamiCallNumber
        : SIPjson.SamiCallNumber,
    accessionNumber: "",
    title: '"' + SIPjson.SamiTitle.toString().replace(/,/g, ` `) + '"',
    levelOfDescription: "Product",
    extentAndMedium:
      LogicalMD[0].children[0].files.length +
      ` Wave format Audio File` +
      (LogicalMD[0].children[0].files.length > 1 ? `s` : ``),
    repository: institutionName,
    archivalHistory: "",
    acquisition: "",
    scopeAndContent: '"' + recordingsData + '"',
    appraisal: "",
    accruals: "",
    arrangement: "",
    accessConditions: "",
    reproductionConditions:
      '"' +
      `Rights Attribution: ` +
      processXMLRights["dc:rights"]._text +
      `\nRights Contributor: ` +
      processXMLRights["dc:contributor"]._text +
      `\nRights Provenance: ` +
      processXMLRights["dc:provenance"]._text +
      '"',
    language: "",
    script: "",
    languageNote: "",
    physicalCharacteristics: '"' + transferData + '"',
    findingAids: '"' + documentation + '"',
    locationOfOriginals: '"' + locOriginals + '"',
    locationOfCopies: "The British Library",
    relatedUnitsOfDescription: "",
    publicationNote: "",
    digitalObjectURI: '"' + createdFilePaths + '"',
    generalNote: "",
    subjectAccessPoints: '"' + subjects + keywords + themes + '"',
    placeAccessPoints: '"' + locations + '"',
    nameAccessPoints: "",
    genreAccessPoints: '"' + genres + '"',
    descriptionIdentifier: "",
    institutionIdentifier: "",
    rules: "",
    descriptionStatus: "",
    levelOfDetail: "",
    revisionHistory: "",
    languageOfDescription: '"' + languages + '"',
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

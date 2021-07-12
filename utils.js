const { exec } = require("child_process");

function checkMatchAny(
    record, possibleSymbols, possibleNames, possibleContractStarts,
    symbolThresh = 0.75, nameThresh = 0.75
    ) {
    let match = false;
    if(possibleSymbols.get(record.symbol, [], symbolThresh).length > 0)
      match = true;
    else if (possibleNames.get(record.name, [], nameThresh).length > 0)
      match = true;
    else if (possibleContractStarts.some(x => record.contract.startsWith(x)))
      match = true;
    return match;
}

function checkContractMatch(record, possibleContractStarts) {
    let match = false;
    if (possibleContractStarts.some(x => record.contract.startsWith(x)))
      match = true
    return match;
}

function sendNotification(phoneNumbers, message) {
    phoneNumbers.forEach(num => {
        exec(`imessage --text "${message}" --contacts ${num}`, (error, stdout, stderr) => {
            if (error) {
                console.log(`error: ${error.message}`);
                return;
            }
            if (stderr) {
                console.log(`stderr: ${stderr}`);
                return;
            }
            console.log(`stdout: ${stdout}`);
        })
    });
    

}

exports.checkMatchAny = checkMatchAny;
exports.checkContractMatch = checkContractMatch;
exports.sendNotification = sendNotification;
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

exports.checkMatchAny = checkMatchAny;
exports.checkContractMatch = checkContractMatch;
const utils = require('../utils')
const FuzzySet = require('fuzzyset')

let records = [
    {
        name: 'Mega Bll',
        symbol: 'NON',
        contract: '0x87sadfaLJ90192'
    },
    {
        name: 'No Match',
        symbol: 'MBULL',
        contract: '0x87sadfaLJ90192'
    },
    {
        name: 'No Match',
        symbol: 'NON',
        contract: '0x87912MLJ90192'
    },
    {
        name: 'No Match',
        symbol: 'NON',
        contract: '0x87sadfaLJ90192'
    },
    {
        name: 'Mega Bll',
        symbol: 'MBULL',
        contract: '0x87912MLJ90192'
    }
]

test('record cases any', () => {
    let possibleSymbols = FuzzySet(['MBULL']);
    let possibleNames = FuzzySet(['mega bull']);
    let possibleStarts = ['0x87912MLJ90192']
    let results = records.map(x => utils.checkMatchAny(x, possibleSymbols, possibleNames, possibleStarts))
    expect(results).toStrictEqual([true, true, true, false, true])

})

test('contract match', () => {

    let possibleStarts = ['0x87912MLJ90192']
    let results = records.map(x => utils.checkContractMatch(x, possibleStarts))
    expect(results).toStrictEqual([false, false, true, false, true])

})
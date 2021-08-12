const axios = require('axios');
const fs = require('fs');
const ethers = require('ethers');
const FuzzySet = require('fuzzyset')
const utils = require("./utils");
const { WSAENETUNREACH } = require('constants');

let phoneNumbers = fs.readFileSync('/Users/brianmcclanahan/ether/numbers.txt', 'utf8').split("\n").filter(x => x.length !=0);
let possibleSymbols = FuzzySet(['CosmosInu']);
let possibleNames = FuzzySet(['Cosmos Inu']);
let possibleContractStarts = ['0x87912MLJ90192']



let gasApiKey = fs.readFileSync('/Users/brianmcclanahan/ether/gasapi.txt', 'utf8');
let gasApiURL = `https://ethgasstation.info/api/ethgasAPI.json?api-key=${gasApiKey.substring(0, gasApiKey.length - 1)}`;
let uniswapApi = 'https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v2';
const csv_folder = '/Users/brianmcclanahan/ether_new_transactions'

async function getEtherPrice(){
  response = await axios.post(uniswapApi, {
    query: `
    {
      bundle(id: "1" ) {
        ethPrice
      }
    }
    `
  });
  return Math.ceil(response.data.data.bundle.ethPrice);
}


async function getGasPrices(){
  response = await axios.get(gasApiURL);
  return response.data;
}

const addresses = {
  WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  factory: '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f',
  router: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
  recipient: '0xf11b2fc4f28150517af11c2c456cbe75e976f663',
  me: '0x76e7180a22a771267d3bb1d2125a036ddd8344d9',
}

const provider = new ethers.providers.WebSocketProvider('wss://mainnet.infura.io/ws/v3/ff1e7694082149c0a0bc63d6bb8279fc');
const access = fs.readFileSync('/Users/brianmcclanahan/ether/eth_net_access.txt', 'utf8');
const wallet = new ethers.Wallet(access.substring(0, access.length - 1));
const account = wallet.connect(provider);




utils.set_allowance_ether(account, addresses.WETH, 1000, addresses);
//utils.get_allowance(account, addresses.WETH, addresses);

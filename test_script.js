const axios = require('axios');
const fs = require('fs');
const ethers = require('ethers');
const FuzzySet = require('fuzzyset');
const utils = require("./utils");
const beep = require('beepbeep');

const gasLimit = 500000;
const transactionCost = 201101;
const tradeVal = '0.05';

let inPosition = false;

let live_trade = true;

let phoneNumbers = fs.readFileSync('/Users/brianmcclanahan/ether/numbers.txt', 'utf8').split("\n").filter(x => x.length !=0);
let possibleSymbols = FuzzySet(['NightDoge']);
let possibleNames = FuzzySet(['NightDoge']);
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
  console.log(response.data)
  return response.data;
}

const addresses = {
  WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  factory: '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f', 
  router: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
  recipient: '0x76e7180a22a771267d3bb1d2125a036ddd8344d9'
}

const infuraProvider = new ethers.providers.WebSocketProvider('wss://mainnet.infura.io/ws/v3/ff1e7694082149c0a0bc63d6bb8279fc');
const alchemyProvider = new ethers.providers.WebSocketProvider('wss://eth-mainnet.alchemyapi.io/v2/U9D94i9IfuNroyIdgnYJIkroXz4U9yb4');
const fallbackProvider = new ethers.providers.FallbackProvider([alchemyProvider, infuraProvider], 1);


var testObj = {
    test: true
}
if(!testObj['asdf'])
    console.log('true')
console.log("after")

beep(20)
console.log('non blocking')

if(live_trade){
  console.log("trading")
}


/*s
const access = fs.readFileSync('/Users/brianmcclanahan/ether/eth_net_access.txt', 'utf8');
const wallet = new ethers.Wallet(access.substring(0, access.length - 1));
const account = wallet.connect(provider);
const factory = new ethers.Contract(
  addresses.factory,
  ['event PairCreated(address indexed token0, address indexed token1, address pair, uint)'],
  account
);
const router = new ethers.Contract(
  addresses.router,
  [
    'function getAmountsOut(uint amountIn, address[] memory path) public view returns (uint[] memory amounts)',
    'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)'
  ],
  account
);

//getGasPrices()
//console.log(getGasPrices)

async function test(){
    let pair = new ethers.Contract(
        '0x6399846eC4d73723142003CC9e7c2622815C97b2',
        [
          'event Sync(uint112 reserve0, uint112 reserve0)',
          'function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)'
        ],
        account
      )
      result =  await pair.getReserves()
      console.log(result[0].toString(), result[1].toString())
      console.log(result[1].div(result[0]).toString())
      console.log(ethers.utils.parseUnits('0.005', 'ether').toString());
}

test()*/
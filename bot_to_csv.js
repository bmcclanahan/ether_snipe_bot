const axios = require('axios');
const ethers = require('ethers');
const FuzzySet = require('fuzzyset')
const utils = require("./utils")

let phoneNumbers = ["4345796117"]
let possibleSymbols = FuzzySet(['BirdInu', '$BirdInu', 'AAPE', '$AAPE']);
let possibleNames = FuzzySet(['Bird Inu', 'Bird Inu Official', 'AstroApe', '🦍ASTROAPE']);
let possibleContractStarts = ['0x87912MLJ90192']


const fs = require('fs');
let gasApiKey = fs.readFileSync('/Users/brianmcclanahan/ether/gasapi.txt', 'utf8');
let gasApiURL = `https://ethgasstation.info/api/ethgasAPI.json?api-key=${gasApiKey.substring(0, gasApiKey.length - 1)}`;
let uniswapApi = 'https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v2';
let mnemonic = fs.readFileSync('/Users/brianmcclanahan/ether/mne.txt', 'utf8');
const csv_folder = '/Users/brianmcclanahan/ether_new_transactions'
mnemonic = mnemonic.substring(0, mnemonic.length - 1);

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
  recipient: '0xf11b2fc4f28150517af11c2c456cbe75e976f663'
}

const provider = new ethers.providers.WebSocketProvider('wss://mainnet.infura.io/ws/v3/ff1e7694082149c0a0bc63d6bb8279fc');
const wallet = ethers.Wallet.fromMnemonic(mnemonic);
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

var newListings = {};

//open pair created csv file
var offset = -240;
var filetimestamp = Date.now() + offset*60*1000
var new_pair_stream = fs.createWriteStream(`${csv_folder}/new_pairs_${filetimestamp}.csv`, {flags:'a'});
new_pair_stream.write("token, token_name, token_symbol, token_liquidity, ether_liquidity, ether_token_ratio, pair_address, time, transaction_cost_ether, transaction_cost_dollar, any_match, contract_match\n");
var liquidity_update_stream = fs.createWriteStream(`${csv_folder}/liquidity_updates_${filetimestamp}.csv`, {flags:'a'});
liquidity_update_stream.write("pair, token, token_name, token_symbol, token_liquidity, ether_liquitity, ether_token_ratio, time, time_from_creation, num_transactions\n")
console.log("registering pair created event")
factory.on('PairCreated', async (token0, token1, pairAddress) => {
  
  var creationDate = new Date(Date.now() + offset*60*1000)
  var date = creationDate.toISOString()
                         .replace(/T/, ' ')      // replace T with a space
                         .replace(/\..+/, '') 
  console.log(`
    New pair detected
    =================
    token0: ${token0}
    token1: ${token1}
    pairAddress: ${pairAddress}
    time: ${date}
  `);

  //The quote currency needs to be WETH (we will pay with WETH)
  let tokenIn, tokenOut, position;
  if(token0 === addresses.WETH) {
    tokenIn = token0; 
    tokenOut = token1;
    position = 1;
  }

  if(token1 == addresses.WETH) {
    tokenIn = token1; 
    tokenOut = token0;
    position = 0;
  }
  let pair = new ethers.Contract(
    pairAddress,
    [
      'event Sync(uint112 reserve0, uint112 reserve0)',
      'function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)'
    ],
    account
  );

  let tokenContract = new ethers.Contract(
    tokenOut,
    [
      'function name() public view returns (string)',
      'function symbol() public view returns (string)'
    ],
    account
  ); 

  let tokReserve0, tokReserve1;
  let ethLiquidity, tokLiquidity;
  result =  await pair.getReserves() // figure out how to use destructuring to get this
  tokReserve0 = result[0]
  tokReserve1 = result[1]
  if(position == 0){
    ethLiquidity = tokReserve1;
    tokLiquidity = tokReserve0;
  }
  else {
    ethLiquidity = tokReserve0;
    tokLiquidity = tokReserve1;
  }

  tokenName = await tokenContract.name()
  tokenSymbol = await tokenContract.symbol()
  newListings[tokenOut] = { // might not need this
    pairAddress: pairAddress,
    position: position,
    numTransactions: 0,
    name: tokenName,
    symbol: tokenSymbol,
    contract: tokenOut
  };

  newListings[tokenOut].anyMatch = utils.checkMatchAny(newListings[tokenOut], possibleSymbols, possibleNames, possibleContractStarts);
  newListings[tokenOut].contractMatch = utils.checkContractMatch(newListings[tokenOut], possibleContractStarts);



  let logCreationDate = new Date(Date.now() + offset*60*1000)
  date = logCreationDate.toISOString()
                        .replace(/T/, ' ')      // replace T with a space
                        .replace(/\..+/, '');

  let divisorStr = "1000000000000000"


  //estimating transaction cost
  let transactionCost = 201101
  let gasPrice = await getGasPrices();
  
  let etherPrice = await getEtherPrice();
  
  let transactionCostEther = (10 ** (-9)) * (gasPrice.fastest / 10) * transactionCost;
  let transactionCostDollar = transactionCostEther * etherPrice;

  let tokenLiquitityFloat = tokLiquidity.div(ethers.BigNumber.from(divisorStr)) 
  let etherLiquidityFloat = ethLiquidity.div(ethers.BigNumber.from(divisorStr))
  let etherTokenRatio = -1
  try {
    etherTokenRatio = etherLiquidityFloat.div(tokenLiquitityFloat).toString()
  }
  catch(error) {
    etherTokenRatio = "-1"
  }  
  let message = `
    Initial Liquidity for token
    =================
    token: ${tokenOut}
    token name: ${tokenName}
    tokan symbol: ${tokenSymbol}
    token liquidity: ${tokenLiquitityFloat}
    ether liquidity: ${etherLiquidityFloat}
    ether/token ratio: ${etherTokenRatio}
    pairAddress: ${pairAddress}
    transaction cost units: ${transactionCost.toString()}
    transaction cost ether: ${transactionCostEther}
    transaction cost dollar: ${transactionCostDollar}
    ether price UDS: ${etherPrice} 
    time: ${date}
    any match: ${newListings[tokenOut].anyMatch}
    contract match: ${newListings[tokenOut].contractMatch}
  `
  console.log(message);
  new_pair_stream.write(`${tokenOut}, ${tokenName}, ${tokenSymbol}, ${tokenLiquitityFloat.toString()}, ${etherLiquidityFloat.toString()}, ${etherTokenRatio}, ${pairAddress}, ${date}, ${transactionCostEther}, ${transactionCostDollar}, ${newListings[tokenOut].anyMatch}, ${newListings[tokenOut].contractMatch}\n`);
  if(newListings[tokenOut].anyMatch || newListings[tokenOut].contractMatch)
    utils.sendNotification(phoneNumbers, message);
      
  pair.on('Sync', (function() {
    let token = tokenOut; // j is a copy of i only available to the scope of the inner function
    let tokenPosition = position;
    let tokenPair = pairAddress;
    let tokenCreationDate = creationDate;
    let tokenNameInner = tokenName
    let tokenSymbolInner =tokenSymbol
    return function(reserve0, reserve1) {
  
      if(tokenPosition == 0){
        ethLiquidity = reserve1;
        tokLiquidity = reserve0;
      }
      else {
        ethLiquidity = reserve0;
        tokLiquidity = reserve1;
      }
      let liquidityAddDate = new Date(Date.now() + offset*60*1000);
      let date = liquidityAddDate.toISOString()
                                 .replace(/T/, ' ')      // replace T with a space
                                 .replace(/\..+/, '');
      let timeElapsed = liquidityAddDate - tokenCreationDate;
      newListings[token].numTransactions++;
      let tokenLiquidity = tokLiquidity / (10 ** 18);
      let etherLiquidity = ethLiquidity / (10 ** 18);
      console.log(`
        Liquitidy modified for token
        =================
        token: ${token}
        token name: ${tokenNameInner}
        tokan symbol: ${tokenSymbolInner}
        token liquidity: ${tokenLiquidity}
        ether liquidity: ${etherLiquidity}
        ether/token ratio: ${etherLiquidity / tokenLiquidity}
        pairAddress: ${tokenPair}
        time: ${date}
        time from pair creation: ${timeElapsed}
        num transactions: ${newListings[token].numTransactions}
      `);
      liquidity_update_stream.write(`${tokenPair}, ${token}, ${tokenNameInner}, ${tokenSymbolInner}, ${tokenLiquidity}, ${etherLiquidity}, ${etherLiquidity / tokenLiquidity}, ${date}, ${timeElapsed}, ${newListings[token].numTransactions}\n`)
    }
  })());

  /*
  //The quote currency is not WETH
  if(typeof tokenIn === 'undefined') {
    return;
  }

  //We buy for 0.1 ETH of the new token
  const amountIn = ethers.utils.parseUnits('0.1', 'ether');
  const amounts = await router.getAmountsOut(amountIn, [tokenIn, tokenOut]);
  //Our execution price will be a bit different, we need some flexbility
  const amountOutMin = amounts[1].sub(amounts[1].div(10));
  console.log(`
    Buying new token
    =================
    tokenIn: ${amountIn.toString()} ${tokenIn} (WETH)
    tokenOut: ${amounOutMin.toString()} ${tokenOut}
  `);
  const tx = await router.swapExactTokensForTokens(
    amountIn,
    amountOutMin,
    [tokenIn, tokenOut],
    addresses.recipient,
    Date.now() + 1000 * 60 * 10 //10 minutes
  );
  const receipt = await tx.wait(); 
  console.log('Transaction receipt');
  console.log(receipt);
  */
});


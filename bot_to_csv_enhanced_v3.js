const axios = require('axios');
const fs = require('fs');
const ethers = require('ethers');
const FuzzySet = require('fuzzyset');
const utils = require("./utils");
const beep = require('beepbeep');

const gasLimit = 500000;
const transactionCost = 201101;
const tradeVal = '0.02';
const amountIn = ethers.utils.parseUnits(tradeVal, 'ether');
const sellMultThresh = 0.3;
const transactionsPerSecondThresh = 0.5;
const numTransactionsThresh = 5;
const maxTransPriceThresh = 40;
const alertBeepNum = 20;

let inPosition = false;

let live_trade = false;

let phoneNumbers = fs.readFileSync('/Users/brianmcclanahan/ether/numbers.txt', 'utf8').split("\n").filter(x => x.length !=0);
let possibleSymbols = FuzzySet(['NightDoge']);
let possibleNames = FuzzySet(['NightDoge']);
let possibleContractStarts = ['0x87912MLJ90192'];



let gasApiKey = fs.readFileSync('/Users/brianmcclanahan/ether/gasapi.txt', 'utf8');
let gasApiURL = `https://ethgasstation.info/api/ethgasAPI.json?api-key=${gasApiKey.substring(0, gasApiKey.length - 1)}`;
let uniswapApi = 'https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v2';
const csv_folder = '/Users/brianmcclanahan/ether_new_transactions';

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
  recipient: '0x76e7180a22a771267d3bb1d2125a036ddd8344d9'
}

const infuraProvider = new ethers.providers.WebSocketProvider('wss://mainnet.infura.io/ws/v3/ff1e7694082149c0a0bc63d6bb8279fc');
const alchemyProvider = new ethers.providers.WebSocketProvider('wss://eth-mainnet.alchemyapi.io/v2/U9D94i9IfuNroyIdgnYJIkroXz4U9yb4');
const provider = new ethers.providers.FallbackProvider([infuraProvider, alchemyProvider], 1);
const access = fs.readFileSync('/Users/brianmcclanahan/ether/eth_net_access.txt', 'utf8');
const wallet = new ethers.Wallet(access.substring(0, access.length - 1));
const account = wallet.connect(alchemyProvider);
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
addresses.WETH
var newListings = {
  '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2': { //see if you can use addresses here
    sellAttepmt: false,
    sellTrade: false
  } //to get swap function to work
};

//open pair created csv file
var offset = -240;
var filetimestamp = Date.now() + offset*60*1000
var new_pair_stream = fs.openSync(`${csv_folder}/new_pairs_${filetimestamp}.csv`, 'w');
fs.writeSync(new_pair_stream, "token, token_name, token_symbol, token_liquidity, ether_liquidity, ether_token_ratio, pair_address, time, transaction_cost_ether, transaction_cost_dollar, any_match, contract_match, ether_usd\n");
var liquidity_update_stream = fs.openSync(`${csv_folder}/liquidity_updates_${filetimestamp}.csv`, 'w');
fs.writeSync(liquidity_update_stream, "pair, token, token_name, token_symbol, token_liquidity, ether_liquitity, ether_token_ratio, time, time_from_creation, num_transactions, time_elapsed, transaction_per_second, transaction_per_second_bool, ether_usd, buys, sells, mints, burns, update_type\n");
console.log("registering pair created event");
var transactionStream = fs.openSync(`${csv_folder}/transactions_${filetimestamp}.csv`, 'w');
fs.writeSync(transactionStream, "token_in, token_out, time, amount\n");



async function swap_tokens(tokenIn, tokenOut, etherPrice, amount, setAllowance = true, maxTransPrice = 50){

  if(!newListings[tokenIn]['sellAttepmt']){
    if(newListings[tokenIn]['sellTrade'])
      newListings[tokenIn]['sellAttepmt'] = true;
    beep(alertBeepNum);
    //We buy for 0.1 ETH of the new token
    let gasPrice = await getGasPrices();
    let overrides = {
      gasPrice: ethers.utils.parseUnits((gasPrice.fastest / 10).toString(), 'gwei'),
      gasLimit: gasLimit
    };
    let transactionCostEther = (10 ** (-9)) * (gasPrice.fastest / 10) * transactionCost;
    let transactionCostDollar = transactionCostEther * etherPrice;
    if(transactionCostDollar > maxTransPrice){
      utils.sendNotification(
        phoneNumbers,
        `Max transaction cost of ${maxTransPrice} surpassed. Transaction cost ${transactionCostDollar}. Cancelling transaction`
      );
      return;
    }

    const amounts = await router.getAmountsOut(amount, [tokenIn, tokenOut]);
    //Our execution price will be a bit different, we need some flexbility
    // allow 50% slippage
    const amountOutMin = amounts[1].sub(amounts[1].div(2));

    let message = `
      Buying new token
      =================
      tokenIn: ${amount.toString()} ${tokenIn} (WETH)
      tokenOut: ${amountOutMin.toString()} ${tokenOut}
      gas price: ${overrides.gasPrice}
      gas price USD: ${transactionCostDollar}
    `
    console.log(message);
    utils.sendNotification(phoneNumbers, message);
    try {
      const tx = await router.swapExactTokensForTokens(
        amount,
        amountOutMin,
        [tokenIn, tokenOut],
        addresses.recipient,
        Date.now() + 1000 * 60 * 2, //2 minutes
        overrides
      );
      const receipt = await tx.wait();
      message = `
        Transaction receipt: ${receipt}
      `
      console.log(message);
      utils.sendNotification(phoneNumbers, message);
    } catch(err) {
      message = "transaction failed"
      console.log(message);
      utils.sendNotification(phoneNumbers, message);
      console.log(err);
      utils.sendNotification(phoneNumbers, err);
      return;
    }
    const tokenBalance = await utils.get_balance(account, tokenOut, addresses);
    message =  `
      Tokens bought: ${tokenBalance}
    `
    console.log(message);
    utils.sendNotification(phoneNumbers, message);
    if(setAllowance){
      message = `
        Attempting to set allowance for ${tokenOut}
      `
      console.log(message);
      utils.sendNotification(phoneNumbers, message);

      const approvedTokenBalance = await utils.set_allowance_token(account, tokenOut, ethers.constants.MaxUint256, addresses, overrides);

      message = `
        Allowance of ${approvedTokenBalance.toString()} approved for ${tokenOut}
      `
      console.log(message);
      utils.sendNotification(phoneNumbers, message);
    }

    newListings[tokenOut].tokenBalance = tokenBalance
    let transactionDate = new Date(Date.now() + offset*60*1000);
    let date = transactionDate.toISOString()
                              .replace(/T/, ' ')      // replace T with a space
                              .replace(/\..+/, '');
    fs.writeSync(transactionStream, `${tokenIn}, ${tokenOut}, ${date}, ${tokenBalance}\n`);
  }
}


function liquidityUpdate(newListings, token, tokenPosition, etherPrice, updateType) {
  let ethLiquidity, tokLiquidity;
  if(tokenPosition == 0){
    ethLiquidity = newListings[token].reserve1;
    tokLiquidity = newListings[token].reserve0;
  }
  else {
    ethLiquidity = newListings[token].reserve0;
    tokLiquidity = newListings[token].reserve1;
  }
  let liquidityAddDate = new Date(Date.now() + offset*60*1000);
  let date = liquidityAddDate.toISOString()
                              .replace(/T/, ' ')      // replace T with a space
                              .replace(/\..+/, '');
  let timeElapsed = liquidityAddDate - newListings[token].creationDate;
  newListings[token].numTransactions++;
  let tokenLiquidity = tokLiquidity / (10 ** 18);
  let etherLiquidity = ethLiquidity / (10 ** 18);
  let liquidityRatio = etherLiquidity / tokenLiquidity;
  let liquidityAddFirst = false;
  if((newListings[token].liquidityDate == -1) && ((tokenLiquidity != 0) && (etherLiquidity !=0))) {
    newListings[token].liquidityDate = liquidityAddDate
    liquidityAddFirst = true
  }
  newListings[token].timeElapsed = newListings[token].liquidityDate == -1? -1: (liquidityAddDate - newListings[token].listingDate) / 1000;
  newListings[token].transactionPerSecond = newListings[token].timeElapsed == -1? -1: newListings[token].numTransactions / (newListings[token].timeElapsed + 1);
  newListings[token].transactionPerSecondBool = (newListings[token].transactionPerSecond >= transactionsPerSecondThresh) && (newListings[token].numTransactions >= numTransactionsThresh) && (newListings[token].initRatio < liquidityRatio);// transaction rate threshold trigger with transaction count requirement
  let transactionThreshFirst = false;
  if(!newListings[token].transactionThresholdBreached && newListings[token].transactionPerSecondBool){
    newListings[token].transactionThresholdBreached = true;
    transactionThreshFirst = true;
  }

  let message = `
  Liquitidy modified for token
  =================
  token: ${token}
  token name: ${newListings[token].name}
  tokan symbol: ${newListings[token].symbol}
  token liquidity: ${tokenLiquidity}
  ether liquidity: ${etherLiquidity}
  ether/token ratio: ${liquidityRatio}
  ether/token init ratio: ${newListings[token].initRatio.toString()}
  pairAddress: ${newListings[token].pairAddress}
  time: ${date}
  time from pair creation: ${timeElapsed}
  num transactions: ${newListings[token].numTransactions}
  timeElapsed: ${newListings[token].timeElapsed},
  transactionPerSecond: ${newListings[token].transactionPerSecond},
  transactionPerSecondBool: ${newListings[token].transactionPerSecondBool},
  etherPriceInner: ${etherPrice}
  buys: ${newListings[token].buys}
  sells: ${newListings[token].sells}
  mints: ${newListings[token].mints}
  burns: ${newListings[token].burns}
  `
  console.log(message);
  if((newListings[token].anyMatch || newListings[token].contractMatch) && liquidityAddFirst){
    message = "liquidity added\n" + message;
    utils.sendNotification(phoneNumbers, message);
  }
  if((newListings[token].anyMatch || newListings[token].contractMatch) && transactionThreshFirst && (newListings[token].numTransactions >= 5)){
    message = "transaction threshold hit\n" + message;
    utils.sendNotification(phoneNumbers, message);
  }
  //Buy the token
  //if((newListings[token].anyMatch || newListings[token].contractMatch) && !inPosition && newListings[token].transactionPerSecondBool){
  if(live_trade && !inPosition && (newListings[token].transactionPerSecond > transactionsPerSecondThresh) && (newListings[token].numTransactions >= numTransactionsThresh) && (newListings[token].initRatio < liquidityRatio)){
    inPosition = true;
    message = "transaction threshold hit\nbot will now attempt to buy\n" + message;
    utils.sendNotification(phoneNumbers, message);
    swap_tokens(addresses.WETH, token, etherPrice, amountIn, true, maxTransPriceThresh);
    newListings[token].inTrade = true;
  }

  //Sell the token
  if(newListings[token].inTrade && !newListings[token].sellTrade && (newListings[token].tokenBalance > 0) && (newListings[token].timeElapsed >=  220)){ //3 minutes 40 seconds
    router.getAmountsOut(newListings[token].tokenBalance, [token, addresses.WETH]).then(
      x => {
        let profitRatio = x[1] / amountIn;
        if(profitRatio > sellMultThresh) {
          newListings[token].sellTrade = true;
          swap_tokens(token, addresses.WETH, etherPrice, newListings[token].tokenBalance, false, maxTransPriceThresh);
          let message = `
            Mutiple of position: ${profitRatio.toString()}
          `
          console.log(message);
        }

      }
    );

  }
  fs.writeSync(liquidity_update_stream, `${newListings[token].pairAddress}, ${token}, ${newListings[token].name}, ${newListings[token].symbol}, ${tokenLiquidity}, ${etherLiquidity}, ${liquidityRatio}, ${date}, ${timeElapsed}, ${newListings[token].numTransactions}, ${newListings[token].timeElapsed}, ${newListings[token].transactionPerSecond}, ${newListings[token].transactionPerSecondBool}, ${etherPrice}, ${newListings[token].buys}, ${newListings[token].sells}, ${newListings[token].mints}, ${newListings[token].burns}, ${updateType}\n`)
}


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
      'event Mint(address indexed sender, uint amount0, uint amount1)',
      'event Burn(address indexed sender, uint amount0, uint amount1, address indexed to)',
      'event Swap(address indexed sender, uint amount0In, uint amount1In, uint amount0Out, uint amount1Out, address indexed to)',
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
  let listingDate = new Date(Date.now() + offset*60*1000)
  newListings[tokenOut] = { // might not need this
    pairAddress: pairAddress,
    position: position,
    numTransactions: 0,
    name: tokenName,
    symbol: tokenSymbol,
    contract: tokenOut,
    listingDate: listingDate,
    liquidityDate: -1,
    timeElapsed: 0,
    transactionPerSecond: 0,
    transactionPerSecondBool: false,
    transactionThresholdBreached: false,
    inTrade: false,
    sellTrade: false,
    sellAttepmt: false,
    tokenBalance: 0,
    initRatio: 0,
    buys: 0,
    sells: 0,
    reserve0: ethers.BigNumber.from(tokReserve0),
    reserve1: ethers.BigNumber.from(tokReserve1),
    mints: 0,
    burns: 0,
    creationDate: creationDate
  };

  newListings[tokenOut].anyMatch = utils.checkMatchAny(newListings[tokenOut], possibleSymbols, possibleNames, possibleContractStarts);
  newListings[tokenOut].contractMatch = utils.checkContractMatch(newListings[tokenOut], possibleContractStarts);




  date = listingDate.toISOString()
                     .replace(/T/, ' ')      // replace T with a space
                     .replace(/\..+/, '');

  let gasPrice = await getGasPrices();

  let etherPrice = await getEtherPrice();

  let transactionCostEther = (10 ** (-9)) * (gasPrice.fastest / 10) * transactionCost;
  let transactionCostDollar = transactionCostEther * etherPrice;

  let tokenLiquitityFloat = ethers.utils.formatEther(tokLiquidity);
  let etherLiquidityFloat = ethers.utils.formatEther(ethLiquidity);
  let etherTokenRatio = -1
  try {
    newListings[tokenOut].initRatio = ethLiquidity / tokLiquidity;
    etherTokenRatio = newListings[tokenOut].initRatio;
  }
  catch(error) {
    etherTokenRatio = 0
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
    ether price: ${etherPrice}
  `
  console.log(message);
  try{
    newListings[tokenOut].liquidityDate = ((tokLiquidity.toNumber() == 0) && (ethLiquidity.toNumber() == 0))? -1: listingDate
  }
  catch (error) {
    newListings[tokenOut].liquidityDate = listingDate
  }
  fs.writeSync(new_pair_stream, `${tokenOut}, ${tokenName}, ${tokenSymbol}, ${tokenLiquitityFloat}, ${etherLiquidityFloat}, ${etherTokenRatio}, ${pairAddress}, ${date}, ${transactionCostEther}, ${transactionCostDollar}, ${newListings[tokenOut].anyMatch}, ${newListings[tokenOut].contractMatch}, ${etherPrice}\n`);
  if(newListings[tokenOut].anyMatch || newListings[tokenOut].contractMatch)
    utils.sendNotification(phoneNumbers, message);





  pair.on('Swap',
    (function() {
      let tokenPosition = position; //could put tokenPosition in newListings object
      let token = tokenOut;
      let tokenPair = pairAddress;
      return function(sender, amount0In, amount1In, amount0Out, amount1Out, to){
        let updateType
        if(tokenPosition == 0){
          if(amount0Out > 0) {
            newListings[token].buys += 1;
            updateType = 'buy';
          } else if(amount1Out > 0) {
            newListings[token].sells += 1;
            updateType = 'sell';
          }
        }
        else {
          if(amount1Out > 0){
            newListings[token].buys += 1;
            updateType = 'buy';
          } else if(amount0Out > 0) {
            newListings[token].sells += 1;
            updateType = 'sell';
          }
        }
        let divisor = 10 ** 18
        let message = `
          Swap for token
          =================
          token: ${token}
          token name: ${newListings[token].name}
          token symbol: ${newListings[token].symbol}
          tokenPosition: ${tokenPosition}
          pairAddress: ${tokenPair}
          amount0In: ${amount0In / divisor}
          amount1In: ${amount1In / divisor}
          amount0Out: ${amount0Out / divisor}
          amount1Out: ${amount1Out / divisor}
        `;
        console.log(message);
        newListings[token].reserve0 =  newListings[token].reserve0.add(amount0In).sub(amount0Out);
        newListings[token].reserve1 =  newListings[token].reserve1.add(amount1In).sub(amount1Out);
        liquidityUpdate(newListings, token, tokenPosition, etherPrice, updateType);
      }
    })()
  )

  pair.on('Mint',
    (function() {
      let tokenPosition = position;
      let token = tokenOut;
      let tokenPair = pairAddress;
      return function(sender, amount0, amount1){
        let divisor = 10 ** 18
        let message = `
          Mint for token
          =================
          token: ${token}
          token name: ${newListings[token].name}
          token symbol: ${newListings[token].symbol}
          tokenPosition: ${tokenPosition}
          pairAddress: ${tokenPair}
          amount0: ${amount0 / divisor}
          amount1: ${amount1 / divisor}
        `;
        console.log(message);
        newListings[token].reserve0 =  newListings[token].reserve0.add(amount0);
        newListings[token].reserve1 =  newListings[token].reserve1.add(amount1);
        newListings[token].mints += 1;
        liquidityUpdate(newListings, token, tokenPosition, etherPrice, 'mint');
      }
    })()
  )

  pair.on('Burn',
    (function() {
      let tokenPosition = position;
      let token = tokenOut;
      let tokenPair = pairAddress;

      return function(sender, amount0, amount1, to){
        let divisor = 10 ** 18
        let message = `
          Burn for token
          =================
          token: ${token}
          token name: ${newListings[token].name}
          token symbol: ${newListings[token].symbol}
          tokenPosition: ${tokenPosition}
          pairAddress: ${tokenPair}
          amount0: ${amount0 / divisor}
          amount1: ${amount1 / divisor}
        `;
        console.log(message);
        newListings[token].reserve0 =  newListings[token].reserve0.sub(amount0);
        newListings[token].reserve1 =  newListings[token].reserve1.sub(amount1);
        newListings[token].burns += 1;
        liquidityUpdate(newListings, token, tokenPosition, etherPrice, 'burn');
      }
    })()
  )

  //purely informational logging
  pair.on('Sync', (function() {
    let token = tokenOut; // j is a copy of i only available to the scope of the inner function
    let tokenPosition = position;
    let tokenPair = pairAddress;
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

      let tokenLiquidity = tokLiquidity / (10 ** 18);
      let etherLiquidity = ethLiquidity / (10 ** 18);
      let liquidityRatio = etherLiquidity / tokenLiquidity;

      let message = `
      Sync for token
      =================
        token: ${token}
        token name: ${newListings[token].name}
        token symbol: ${newListings[token].symbol}
        pairAddress: ${tokenPair}
        token liquidity: ${tokLiquidity}
        ether liquidity: ${etherLiquidity}
        token liquidity formatted: ${tokenLiquidity}
        ether liquidity formatted: ${etherLiquidity}
        ether/token ratio: ${liquidityRatio}
        time: ${date}
      `
    }
  })());
});

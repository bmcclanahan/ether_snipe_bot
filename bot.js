const ethers = require('ethers');
const fs = require('fs')
let mnemonic = fs.readFileSync('/Users/brianmcclanahan/ether/mne.txt', 'utf8')
mnemonic = mnemonic.substring(0, mnemonic.length - 1)

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

factory.on('PairCreated', async (token0, token1, pairAddress) => {
  var offset = -240;
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
    ],
    account
  );

  newListings[tokenOut] = { // might not need this
    pairAddress: pairAddress,
    position: position,
    numTransactions: 0
  };
  pair.on('Sync', (function() {
    let token = tokenOut; // j is a copy of i only available to the scope of the inner function
    let tokenPosition = position;
    let tokenPair = pairAddress;
    let tokenCreationDate = creationDate;
    return function(reserve0, reserve1) {
      let ethLiquidity, tokLiquidity;
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
      let timeElapsed = tokenCreationDate - liquidityAddDate;
      newListings[token].numTransactions++;
      let tokenLiquidity = tokLiquidity / (10 ** 18);
      let etherLiquidity = ethLiquidity / (10 ** 18);
      console.log(`
        Liquitidy modified for token
        =================
        token: ${token}
        token liquidity: ${tokenLiquidity}
        ether liquidity: ${etherLiquidity}
        ether/token ratio: ${etherLiquidity / tokenLiquidity}
        pairAddress: ${tokenPair}
        time: ${date}
        time from pair creation: ${timeElapsed}
        num transactions: ${newListings[token].numTransactions}
      `);
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


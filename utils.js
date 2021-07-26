const { exec } = require("child_process");
const ethers = require('ethers');

function checkMatchAny(
    record, possibleSymbols, possibleNames, possibleContractStarts,
    symbolThresh = 0.9, nameThresh = 0.9
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

async function set_allowance_ether(account, token, amount, addresses){
    const etherAmount = ethers.utils.parseUnits(`${amount}`, 'ether');
    const weth = new ethers.Contract(
      token,
      ['function approve(address _spender, uint256 _value) public returns (bool success)',
       'function allowance(address owner, address spender) external view returns (uint)'],
      account
    );
    const tx = await weth.approve(addresses.router, etherAmount);
    const receipt = await tx.wait();
    console.log(`approval receipt ${receipt}`)
    const amountApproved = await weth.allowance(addresses.recipient, addresses.router);
    console.log(`amount approved ${amountApproved.toString()}`);
    return amountApproved;
  }

async function set_allowance_token(account, token, amount, addresses, overrides = {}){
    const tokenContract = new ethers.Contract(
      token,
      ['function approve(address _spender, uint256 _value) public returns (bool success)',
       'function allowance(address owner, address spender) external view returns (uint)'],
      account
    );
    const tx = await tokenContract.approve(addresses.router, amount, overrides);
    const receipt = await tx.wait();
    console.log(`approval receipt ${receipt}`)
    const amountApproved = await tokenContract.allowance(addresses.recipient, addresses.router);
    console.log(`amount approved ${amountApproved.toString()}`);
    return amountApproved;
  }
  
async function get_allowance(account, token, addresses){
    const tokenContract = new ethers.Contract(
        token,
        ['function approve(address _spender, uint256 _value) public returns (bool success)',
        'function allowance(address owner, address spender) external view returns (uint)'],
        account
    );
    const amountApproved = await tokenContract.allowance(addresses.recipient, addresses.router);
    console.log(`allowance available ${amountApproved.toString()}`);
    return amountApproved;
    
}

async function get_balance(account, token, addresses){
    const tokenContract = new ethers.Contract(
        token,
        ['function balanceOf(address account) public view virtual override returns (uint256)'],
        account
    );
    const balance = await tokenContract.balanceOf(addresses.recipient);
    console.log(`allowance available ${balance.toString()}`);
    return balance;
}

exports.checkMatchAny = checkMatchAny;
exports.checkContractMatch = checkContractMatch;
exports.sendNotification = sendNotification;
exports.set_allowance_ether = set_allowance_ether;
exports.set_allowance_token = set_allowance_token;
exports.get_allowance = get_allowance;
exports.get_balance = get_balance;
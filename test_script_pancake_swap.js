const axios = require('axios');

const gasApiURL = 'https://bscgas.info/gas'

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


getGasPrices()

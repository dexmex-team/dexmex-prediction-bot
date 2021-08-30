import { BytesLike, ethers } from 'ethers';
import * as dotenv from 'dotenv';
import PREDICTION_ABI from './abi/prediction.json';
import { CronJob } from 'cron';
import fetch from 'node-fetch';

dotenv.config();

const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_PROVIDER);

//setup wallet
let wallet = new ethers.Wallet(
  process.env.OPERATOR_WALLET_PRIVATE_KEY as BytesLike,
);

wallet = wallet.connect(provider);

//get contract data
const predictionContract = new ethers.Contract(
  process.env.PREDICTION_ADDRESS as string,
  PREDICTION_ABI,
  wallet,
);


async function main() {
  const currentEpoch = await predictionContract.currentEpoch();

  const round = await predictionContract.rounds(currentEpoch);

  const lockTimestamp = round.lockTimestamp.toNumber();

  const unix = Math.round(+new Date() / 1000);
  const genesisRoundStart = await predictionContract.genesisStartOnce();

  let paused = await predictionContract.paused();
  let genesisLockOnce = await predictionContract.genesisLockOnce();


  const response = await fetch('https://gasstation-mainnet.matic.network')

  const json = await response.json()

  const gasPrice = json['fastest']



  const transactionOptions = {
    gasPrice: ethers.utils.parseUnits(gasPrice.toString(), 'gwei')
  }
  
  if (!paused) {
    if (!genesisRoundStart) {
      console.log('genesisRoundStart');
      predictionContract.genesisStartRound();
    } else if (!genesisLockOnce) {
      genesisLockRound(transactionOptions);
    } else {
      if (unix > lockTimestamp) {
        executeRound(transactionOptions);
      } 
    }
  }
}

async function genesisLockRound(transactionOptions:{}) {
  try {
    let tx = await predictionContract.genesisLockRound();
    console.log(tx)
    console.log(tx.hash);
  } catch (e) {
    console.log(e);
  }
}

async function executeRound(transactionOptions:{}) {
  try {
    let tx = await predictionContract.executeRound(transactionOptions);
    console.log(tx.hash);
  } catch (e) {
    console.log(e);
  }
}

var job = new CronJob('*/10 * * * * *', function () {
  main();
});

job.start();

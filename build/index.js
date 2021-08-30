"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ethers_1 = require("ethers");
const dotenv = __importStar(require("dotenv"));
const prediction_json_1 = __importDefault(require("./abi/prediction.json"));
const cron_1 = require("cron");
const node_fetch_1 = __importDefault(require("node-fetch"));
dotenv.config();
const provider = new ethers_1.ethers.providers.JsonRpcProvider(process.env.RPC_PROVIDER);
//setup wallet
let wallet = new ethers_1.ethers.Wallet(process.env.OPERATOR_WALLET_PRIVATE_KEY);
wallet = wallet.connect(provider);
//get contract data
const predictionContract = new ethers_1.ethers.Contract(process.env.PREDICTION_ADDRESS, prediction_json_1.default, wallet);
async function main() {
    const currentEpoch = await predictionContract.currentEpoch();
    const round = await predictionContract.rounds(currentEpoch);
    const lockTimestamp = round.lockTimestamp.toNumber();
    const unix = Math.round(+new Date() / 1000);
    const genesisRoundStart = await predictionContract.genesisStartOnce();
    let paused = await predictionContract.paused();
    let genesisLockOnce = await predictionContract.genesisLockOnce();
    const response = await node_fetch_1.default('https://gasstation-mainnet.matic.network');
    const json = await response.json();
    const gasPrice = json['fastest'];
    const transactionOptions = {
        gasPrice: ethers_1.ethers.utils.parseUnits(gasPrice.toString(), 'gwei')
    };
    if (!paused) {
        if (!genesisRoundStart) {
            console.log('genesisRoundStart');
            predictionContract.genesisStartRound();
        }
        else if (!genesisLockOnce) {
            genesisLockRound(transactionOptions);
        }
        else {
            if (unix > lockTimestamp) {
                executeRound(transactionOptions);
            }
        }
    }
}
async function genesisLockRound(transactionOptions) {
    try {
        let tx = await predictionContract.genesisLockRound();
        console.log(tx);
        console.log(tx.hash);
    }
    catch (e) {
        console.log(e);
    }
}
async function executeRound(transactionOptions) {
    try {
        let tx = await predictionContract.executeRound(transactionOptions);
        console.log(tx.hash);
    }
    catch (e) {
        console.log(e);
    }
}
var job = new cron_1.CronJob('*/10 * * * * *', function () {
    main();
});
job.start();

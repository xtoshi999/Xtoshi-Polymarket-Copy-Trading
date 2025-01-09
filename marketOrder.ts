import { ethers } from "ethers";
import { config as dotenvConfig } from "dotenv";
import { resolve } from "path";
import { ApiKeyCreds, Chain, ClobClient, OrderType } from "../src";

dotenvConfig({ path: resolve(__dirname, "../.env") });

async function main() {
    const wallet = new ethers.Wallet(`${process.env.PK}`);
    const chainId = parseInt(`${process.env.CHAIN_ID || Chain.AMOY}`) as Chain;
    console.log(`Address: ${await wallet.getAddress()}, chainId: ${chainId}`);

    const host = process.env.CLOB_API_URL || "http://localhost:8080";
    const creds: ApiKeyCreds = {
        key: `${process.env.CLOB_API_KEY}`,
        secret: `${process.env.CLOB_SECRET}`,
        passphrase: `${process.env.CLOB_PASS_PHRASE}`,
    };
    const clobClient = new ClobClient(host, chainId, wallet, creds);

    // Create a YES market buy order for the equivalent of 100 USDC for the market price
    const YES = "71321045679252212594626385532706912750332728571942532289631379312455583992563";
    const marketOrder = await clobClient.createMarketBuyOrder({
        tokenID: YES,
        amount: 100,
        feeRateBps: 0,
        nonce: 0,
        price: 0.5,
    });
    console.log("Created Market Order", marketOrder);

    // Send it to the server
    const resp = await clobClient.postOrder(marketOrder, OrderType.FOK);
    console.log(resp);
}

main();

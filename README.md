# Polymarket Copy Trading Project

## Overview
This project is designed to facilitate copy trading on Polymarket. It allows users to automatically copy the trades of selected traders.

## Features
- Automatic trade copying
- Real-time trade updates

## Installation
To install the project, follow these steps:

1. Install the dependencies:
    ```bash
    npm install
    ```
2. Customize .env file:

    ```plaintext
    USER_ADDRESS=polymarket wallet address to monitor
    PROXY_WALLET=your polymarket wallet address
    PUBLIC_KEY=corresponding polygon wallet address
    PRIVATE_KEY=corresponding private key

    FETCH_INTERVAL=frequency for fetching data
    TOO_OLD_TIMESTAMP=ignoring time interval
    RETRY_LIMIT=how many retries if transaction failed

    MONGO_URI={your mongodb uri}
    ```

## Usage
To start the application, run:
```bash
npm run dev
```

## Codebase

1. src/index.ts
    ```typescript
    export const main = async () => {
        await connectDB();  //First of all is DB connecting
        tradeMonitor();     //Fetching trading data of a user every FETCH_INTERVAL seconds 
        tradeExcutor();     //Copying all the transactions
        // testing();
    }
    ```

2. src/config/db.ts
    ```typescript
    import mongoose from "mongoose";
    import { ENV } from "./env";

    //if MONGO_URI is not given, use local mongodb uri
    const uri = ENV.MONGO_URI || "mongodb://localhost:27017/polymarket_copytrading";

    const connectDB = async () => {
        try {
            await mongoose.connect(uri);
            console.log("MongoDB connected");
        } catch (error) {
            console.error("MongoDB connection error:", error);
            process.exit(1);
        }
    };

    export default connectDB;
    ```

3. src/services/tradeMonitor.ts

    At first, check if there are user activites in mongodb
    ```typescript
    const tradeInit = async () => {
        console.log("...Initiating trade data monitoring...");

        try {
            // Fetch existing activities from MongoDB
            temp_trades = await UserActivity.find().exec();
        } catch (error) {
            console.log(`No existing activity data found for ${USER_ADDRESS}, starting fresh.`);
            temp_trades = [];
        }

        console.log("...Finished initiating...\n");
    }
    ```

    Then, every `FETCH_INTERVAL`seconds, fetch data of user positions and activities
    ```typescript
    const tradeMonitor = async () => {
        console.log(`Monitoring trades for wallet: ${USER_ADDRESS}\n`);
        
        await tradeInit();
        
        console.log(`......Fetching trade data every ${FETCH_INTERVAL} seconds......`);
        while (true) {
            await tradeDataFetch();

            // Wait for the specified interval before the next fetch
            await new Promise((resolve) => setTimeout(resolve, FETCH_INTERVAL * 1000));
        }
    };
    ```

    Fetched user activity is like this.

    ```json
    {
        "proxyWallet": "0xf54159ffa1b1c17117fa5c440f74671521eb74f7",
        "timestamp": 1736187775,
        "conditionId": "0x005d2eab3e9c9b0418c45c8e97303668d88630a7287261180dc5edf700f197f9",
        "type": "TRADE",
        "size": 12.4195,
        "usdcSize": 0.049678,
        "transactionHash": "0x9030ba17c09daebc3d5457f0672cdc6ab43f603d868a295e10cd765d41343eee",
        "price": 0.004,
        "asset": "64215530262495502153363605182146140091003251977117222727284612645879679878356",
        "side": "BUY",
        "outcomeIndex": 0,
        "title": "Wolverhampton Wanderers win the Premier League?",
        "slug": "wolverhampton-wanderers-win-the-premier-league",
        "icon": "https://polymarket-upload.s3.us-east-2.amazonaws.com/will-wolverhampton-wanderers-win-the-premier-league-39-K09bdi3Xo.png",
        "eventSlug": "premier-league-winner-24-25",
        "outcome": "Yes",
        "name": "TonyEffe",
        "pseudonym": "Ill-Fated-Ascend",
        "bio": "",
        "profileImage": "",
        "profileImageOptimized": "",
    }
    ```
    
    Add `bot` and `botExecutedTime` keys to the JSON formatted response, trim too old transactions, sort, and save in MongoDB.

    - `bot`: if it is copied or not
    - `botExecutedTime`: how many retries done
    
    ```typescript
    const tradeDataFetch = async () => {
        try {
            ...
                const new_trades = user_activities.filter((activity: { transactionHash: string }) => {
                    return !temp_trades.some((existingActivity: { transactionHash: string }) =>
                        existingActivity.transactionHash === activity.transactionHash
                    );
                }).filter((trade: { timestamp: number }) => {
                    const currentTimestamp = Math.floor(moment().valueOf() / 1000);
                    return trade.timestamp + TOO_OLD_TIMESTAMP * 60 * 60 > currentTimestamp;
                }).map((trade: { [key: string]: any }) => {
                    return { ...trade, bot: false, botExcutedTime: 0 };
                }).sort((a: { timestamp: number; }, b: { timestamp: number; }) => a.timestamp - b.timestamp);
            ...
    ```

4. src/services/tradeExcutor.ts

    At first, create a clobClient and start trading
    ```typescript
    const tradeExcutor = async () => {
        ...
        const clobClient = await createClobClient();
        console.log(`created clobClient: ${JSON.stringify(clobClient, null, 2)}\n`);

        ...
    }
    ```

    Creating clobClient (src/utils/createClobClient.ts)
    ```typescript
    const createClobClient = async (): Promise<ClobClient> => {
        const wallet = new ethers.Wallet(PRIVATE_KEY as string);
        const chainId = 137;
        const host = CLOB_API_URL as string;
        const creds = await createApiKey(); //you can manually set creds using .env file and below code
        // const creds: ApiKeyCreds = {
        //     key: CLOB_API_KEY as string,
        //     secret: CLOB_SECRET as string,
        //     passphrase: CLOB_PASS_PHRASE as string,
        // };
        const clobClient = new ClobClient(
            host,
            chainId,
            wallet,
            creds,
            SignatureType.POLY_PROXY,
            PROXY_WALLET as string
        );
        return clobClient;
    }

    export default createClobClient;
    ```

    Then, every 1 second, read uncopied or failed trades and execute trading
    ```typescript
    const tradeExcutor = async () => {
        ...
        while (true) {
            console.log("Waiting trades trigger...");
            await readTempTrade();
            await trading(clobClient);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        ...
    }
    ```

    Trading logic is like this.

    - cycle all the trades
    - get latest price for the token(share)
    - check if I already have ballance for the token(share)
    - if user buy, I buy the same amount(just for currently)
    - if user sell, check my ballance and that is less than user, sell all of my token(share)
    ```typescript
    const trading = async (clobClient: ClobClient) => {

        const my_positions = await fetchData(`https://data-api.polymarket.com/positions?user=${PROXY_WALLET}`);
        
        for (let i = 0; i < temp_trades.length; i++) {
            const trade = temp_trades[i];
            console.log(`Trade to copy:\n ${JSON.stringify(trade, null, 2)}`);
        
            if (trade.type === "TRADE") {
                const tokenID = trade.asset;
                const conditionId = trade.conditionId;  
                const price = (await clobClient.getLastTradePrice(tokenID)).price;
                const my_position = my_positions.find((position: any) => position.asset === tokenID);
                const ballance = my_position ? my_position.size : 0;
                // console.log(`Ballance: ${JSON.stringify(ballance, null, 2)}`);
                let size = trade.size;
                if (trade.side === Side.SELL && trade.size > ballance) {
                    size = ballance;
                }

                const side = trade.side;
                const order_args = {
                    tokenID: tokenID,
                    price: price,
                    side: side,
                    size: size,
                };
                const signedOrder = await clobClient.createOrder(order_args);
                const resp = await clobClient.postOrder(signedOrder, OrderType.GTC);
                if (resp.success) {
                    console.log(`Successfully posted order:\n ${JSON.stringify(resp, null, 2)}`);
                    await UserActivity.updateOne({ _id: trade._id }, { bot: true, botExcutedTime: trade.botExcutedTime + 1 });
                } else {
                    console.log(`Failed to post order:\n ${JSON.stringify(resp, null, 2)}\nretrying...`);
                    await UserActivity.updateOne({ _id: trade._id }, { botExcutedTime: trade.botExcutedTime + 1 });
                }

            } else {
                console.log(error);
            }
        }
    }
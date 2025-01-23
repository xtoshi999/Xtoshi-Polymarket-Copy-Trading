import { ClobClient } from '@polymarket/clob-client';
import { OrderType, Side } from '@polymarket/clob-client';
import {
    UserActivityInterface,
    UserPositionInterface,
} from '../interfaces/User';
import { ENV } from '../config/env';
import { getUserActivityModel } from '../models/userHistory';
import fetchData from '../utils/fetchData';
import { spinner } from '../utils/spinner';
import mongoose from 'mongoose';

const USER_ADDRESS = ENV.USER_ADDRESS;
const RETRY_LIMIT = ENV.RETRY_LIMIT;
const PROXY_WALLET = ENV.PROXY_WALLET;

if (!USER_ADDRESS) {
    throw new Error('USER_ADDRESS is not defined');
}

let temp_trades: UserActivityInterface[] = [];

const UserActivity = getUserActivityModel(USER_ADDRESS);

const readTempTrade = async () => {
    temp_trades = (
        await UserActivity.find({
            $and: [
                { type: 'TRADE' },
                { bot: false },
                { botExcutedTime: { $lt: RETRY_LIMIT } },
            ],
        }).exec()
    ).map((trade) => trade as UserActivityInterface);
};

const doTrading = async (clobClient: ClobClient) => {
    const my_positions: UserPositionInterface[] = await fetchData(
        `https://data-api.polymarket.com/positions?user=${PROXY_WALLET}`
    );

    for (const trade of temp_trades) {
        console.log('Trade to copy:', trade);
        const tokenID = trade.asset;
        const price = (await clobClient.getLastTradePrice(tokenID)).price;
        const my_position = my_positions.find(
            (position: UserPositionInterface) => position.asset === tokenID
        );
        const balance = my_position ? my_position.size : 0;
        let size = trade.size;
        if (trade.side === 'BUY') {
            if (balance < trade.size) {
                size = balance;
            }
        }
        if (trade.side === 'SELL') {
            if (balance === 0) {
                console.log('No balance to sell');
                await UserActivity.updateOne({ _id: trade._id }, { bot: true });
                continue;
            } else if (balance < trade.size) {
                size = balance;
            }
        }

        const side = trade.side as Side;
        const order_args = {
            tokenID: tokenID,
            price: price,
            side: side,
            size: size,
        };
        const signedOrder = await clobClient.createOrder(order_args);
        const resp = await clobClient.postOrder(signedOrder, OrderType.GTC);
        if (resp.success) {
            console.log('Successfully copied trade:', resp);
            await UserActivity.updateOne(
                { _id: trade._id },
                { bot: true, botExcutedTime: trade.botExcutedTime + 1 }
            );
        } else {
            console.log('Failed to trade:', resp, 'retrying...');
            await UserActivity.updateOne(
                { _id: trade._id },
                { botExcutedTime: trade.botExcutedTime + 1 }
            );
        }
    }
};

const tradeExcutor = async (clobClient: ClobClient) => {
    console.log(`Executing Copy Trading`);

    while (true) {
        await readTempTrade();
        if (temp_trades.length > 0) {
            spinner.stop();
            console.log('💥 New transactions found 💥');
            await doTrading(clobClient);
        } else {
            spinner.start('Waiting for new transactions');
        }
    }
};

export default tradeExcutor;

import { ethers } from 'ethers';
import { ENV } from '../config/env';

const RPC_URL = ENV.RPC_URL;
const USDC_CONTRACT_ADDRESS = ENV.USDC_CONTRACT_ADDRESS;
const PROXY_WALLET = ENV.PROXY_WALLET;

const USDC_ABI = ['function balanceOf(address owner) view returns (uint256)'];

const getMyBalance = async (): Promise<number> => {
    const rpcProvider = new ethers.providers.JsonRpcProvider(RPC_URL);
    const usdcContract = new ethers.Contract(USDC_CONTRACT_ADDRESS, USDC_ABI, rpcProvider);
    const my_balance_usdc = await usdcContract.balanceOf(PROXY_WALLET);
    const my_balance_usdc_real = ethers.utils.formatUnits(my_balance_usdc, 6);
    return parseFloat(my_balance_usdc_real);
};

export default getMyBalance;

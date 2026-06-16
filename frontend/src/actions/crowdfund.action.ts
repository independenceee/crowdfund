import { APP_MNEMONIC, APP_NETWORK_ID } from "@/constants/enviroments";
import { blockfrostProvider } from "@/providers/cardano/blockfrost";
import { MeshTxBuilder } from "@/txbuilders/mesh.txbuilder";
import { MeshWallet } from "@meshsdk/core";
import { convertDatum } from "@/lib/utils";

export const getCampaign = async () => {
    const meshWallet = new MeshWallet({
        accountIndex: 0,
        networkId: APP_NETWORK_ID,
        fetcher: blockfrostProvider,
        submitter: blockfrostProvider,
        key: {
            type: "mnemonic",
            words: APP_MNEMONIC?.split(" ") || [],
        },
    });

    const meshTxBuilder: MeshTxBuilder = new MeshTxBuilder({
        meshWallet: meshWallet,
    });

    await meshTxBuilder.initalize();

    const utxos = await blockfrostProvider.fetchAddressUTxOs(meshTxBuilder.spendAddress);

    return utxos.map((utxo) => {
        return {
            utxo: utxo,
            datum: convertDatum({
                plutusData: utxo.output.plutusData as string,
            }),
        };
    });
};

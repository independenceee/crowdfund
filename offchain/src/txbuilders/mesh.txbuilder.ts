import { deserializeAddress, mConStr0, mPubKeyAddress, resolveSlotNo } from "@meshsdk/core";
import { MeshAdapter } from "../adapters/mesh.adapter";
import { APP_NETWORK } from "@/constants/enviroments";

export class MeshTxBuilder extends MeshAdapter {
    donate = async ({ goal, deadline, quantity, beneficiary }: { goal: number; deadline: number; quantity: number; beneficiary: string }) => {
        const { utxos, walletAddress, collateral } = await this.getWalletForTx();
        const utxo = (await this.fetcher.fetchAddressUTxOs(this.spendAddress)).find((utxo) => {
            const datum = this.convertDatum({ plutusData: utxo.output.plutusData as string });

            return datum.beneficiary === beneficiary && datum.deadline === deadline && datum.goal === goal;
        });


        const unsignedTx = this.meshTxBuilder;

        if (utxo) {
            const datum = this.convertDatum({ plutusData: utxo.output.plutusData as string });
            const existingContribution = datum.contributions.find((c) => c.address === walletAddress);

            console.log(datum);

            const newQuantity = existingContribution ? existingContribution.quantity + Number(quantity) : Number(quantity);

            const updatedContributions = [
                ...datum.contributions.filter((c) => c.address !== walletAddress),
                { address: walletAddress, quantity: newQuantity },
            ];

            console.log(
                mConStr0([
                    mPubKeyAddress(deserializeAddress(datum.beneficiary).pubKeyHash, deserializeAddress(datum.beneficiary).stakeCredentialHash),
                    BigInt(datum.goal),
                    BigInt(datum.deadline),
                    updatedContributions.map((c) =>
                        mConStr0([
                            mPubKeyAddress(deserializeAddress(c.address).pubKeyHash, deserializeAddress(c.address).stakeCredentialHash),
                            BigInt(c.quantity),
                        ]),
                    ),
                ]),
            );

            unsignedTx
                .spendingPlutusScriptV3()
                .txIn(utxo.input.txHash, utxo.input.outputIndex)
                .txInInlineDatumPresent()
                .txInRedeemerValue(mConStr0([]))
                .txInScript(this.spendScriptCbor)
                .txOut(this.spendAddress, [
                    {
                        unit: "lovelace",
                        quantity: String(Number(utxo.output.amount.find((a) => a.unit === "lovelace")?.quantity) + quantity),
                    },
                ])
                .txOutInlineDatumValue(
                    mConStr0([
                        mPubKeyAddress(deserializeAddress(datum.beneficiary).pubKeyHash, deserializeAddress(datum.beneficiary).stakeCredentialHash),
                        BigInt(datum.goal),
                        BigInt(datum.deadline),
                        updatedContributions.map((c) =>
                            mConStr0([
                                mPubKeyAddress(deserializeAddress(c.address).pubKeyHash, deserializeAddress(c.address).stakeCredentialHash),
                                BigInt(c.quantity),
                            ]),
                        ),
                    ]),
                )
                .invalidBefore(Number(resolveSlotNo(APP_NETWORK, Date.now())) - 200)
                .invalidHereafter(Number(resolveSlotNo(APP_NETWORK, Date.now())) + 1000);
        } else {
            unsignedTx
                .txOut(this.spendAddress, [
                    {
                        unit: "lovelace",
                        quantity: String(quantity),
                    },
                ])
                .txOutInlineDatumValue(
                    mConStr0([
                        mPubKeyAddress(deserializeAddress(beneficiary).pubKeyHash, deserializeAddress(beneficiary).stakeCredentialHash),
                        BigInt(goal),
                        BigInt(deadline),
                        [
                            mConStr0([
                                mPubKeyAddress(deserializeAddress(walletAddress).pubKeyHash, deserializeAddress(walletAddress).stakeCredentialHash),
                                BigInt(quantity),
                            ]),
                        ],
                    ]),
                );
        }

        unsignedTx
            .selectUtxosFrom(utxos)
            .changeAddress(walletAddress)
            .requiredSignerHash(deserializeAddress(walletAddress).pubKeyHash)
            .txInCollateral(collateral.input.txHash, collateral.input.outputIndex)
            .setNetwork(APP_NETWORK);

        return await unsignedTx.complete();
    };

    reclaim = async ({}) => {};

    withdraw = async ({}) => {};
}

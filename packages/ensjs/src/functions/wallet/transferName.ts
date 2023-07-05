import {
  Account,
  Address,
  Hash,
  SendTransactionParameters,
  Transport,
  encodeFunctionData,
  labelhash,
} from 'viem'
import { parseAccount } from 'viem/utils'
import { reclaimSnippet } from '../../contracts/baseRegistrar'
import { ChainWithEns, WalletWithEns } from '../../contracts/consts'
import { safeTransferFromSnippet as erc1155SafeTransferFromSnippet } from '../../contracts/erc1155'
import { safeTransferFromSnippet as erc721SafeTransferFromSnippet } from '../../contracts/erc721'
import { getChainContractAddress } from '../../contracts/getChainContractAddress'
import { setSubnodeOwnerSnippet as nameWrapperSetSubnodeOwnerSnippet } from '../../contracts/nameWrapper'
import {
  setSubnodeOwnerSnippet as registrySetSubnodeOwnerSnippet,
  setOwnerSnippet,
} from '../../contracts/registry'
import {
  AdditionalParameterSpecifiedError,
  InvalidContractTypeError,
  UnsupportedNameTypeError,
} from '../../errors/general'
import {
  Prettify,
  SimpleTransactionRequest,
  WriteTransactionParameters,
} from '../../types'
import { getNameType } from '../../utils/getNameType'
import { makeLabelNodeAndParent } from '../../utils/makeLabelNodeAndParent'
import { namehash } from '../../utils/normalise'

type BaseTransferNameDataParameters = {
  /** Name to transfer */
  name: string
  /** Transfer recipient */
  newOwnerAddress: Address
  /** Contract to use for transfer */
  contract: 'registry' | 'nameWrapper' | 'registrar'
  /** Reclaim ownership as registrant (registrar only) */
  reclaim?: boolean
  /** Transfer name as the parent owner */
  asParent?: boolean
}

type RegistryOrNameWrapperTransferNameDataParameters = {
  contract: 'registry' | 'nameWrapper'
  reclaim?: never
}

type BaseRegistrarTransferNameDataParameters = {
  contract: 'registrar'
  reclaim?: boolean
  asParent?: never
}

type TransferNameDataParameters = BaseTransferNameDataParameters &
  (
    | RegistryOrNameWrapperTransferNameDataParameters
    | BaseRegistrarTransferNameDataParameters
  )

export type TransferNameDataReturnType = SimpleTransactionRequest

export type TransferNameParameters<
  TChain extends ChainWithEns,
  TAccount extends Account | undefined,
  TChainOverride extends ChainWithEns | undefined,
> = Prettify<
  TransferNameDataParameters &
    WriteTransactionParameters<TChain, TAccount, TChainOverride>
>

export type TransferNameReturnType = Hash

export const makeFunctionData = <
  TChain extends ChainWithEns,
  TAccount extends Account,
>(
  wallet: WalletWithEns<Transport, TChain, TAccount>,
  {
    name,
    newOwnerAddress,
    contract,
    reclaim,
    asParent,
  }: TransferNameDataParameters,
): TransferNameDataReturnType => {
  if (reclaim && contract !== 'registrar')
    throw new AdditionalParameterSpecifiedError({
      parameter: 'reclaim',
      allowedParameters: ['name', 'newOwnerAddress', 'contract'],
      details:
        "Can't reclaim a name from any contract other than the registrar",
    })
  switch (contract) {
    case 'registry': {
      const registryAddress = getChainContractAddress({
        client: wallet,
        contract: 'ensRegistry',
      })
      if (asParent) {
        const { labelhash: labelhashId, parentNode } =
          makeLabelNodeAndParent(name)
        return {
          to: registryAddress,
          data: encodeFunctionData({
            abi: registrySetSubnodeOwnerSnippet,
            functionName: 'setSubnodeOwner',
            args: [parentNode, labelhashId, newOwnerAddress],
          }),
        }
      }
      return {
        to: registryAddress,
        data: encodeFunctionData({
          abi: setOwnerSnippet,
          functionName: 'setOwner',
          args: [namehash(name), newOwnerAddress],
        }),
      }
    }
    case 'registrar': {
      if (asParent)
        throw new AdditionalParameterSpecifiedError({
          parameter: 'asParent',
          allowedParameters: ['name', 'newOwnerAddress', 'contract', 'reclaim'],
          details: "Can't transfer a name as the parent owner on the registrar",
        })
      const nameType = getNameType(name)
      if (nameType !== 'eth-2ld')
        throw new UnsupportedNameTypeError({
          nameType,
          supportedNameTypes: ['eth-2ld'],
          details:
            'Only eth-2ld names can be transferred on the registrar contract',
        })
      const labels = name.split('.')
      const tokenId = BigInt(labelhash(labels[0]))
      return {
        to: getChainContractAddress({
          client: wallet,
          contract: 'ensBaseRegistrarImplementation',
        }),
        data: reclaim
          ? encodeFunctionData({
              abi: reclaimSnippet,
              functionName: 'reclaim',
              args: [tokenId, newOwnerAddress],
            })
          : encodeFunctionData({
              abi: erc721SafeTransferFromSnippet,
              functionName: 'safeTransferFrom',
              args: [wallet.account.address, newOwnerAddress, tokenId],
            }),
      }
    }
    case 'nameWrapper': {
      const nameWrapperAddress = getChainContractAddress({
        client: wallet,
        contract: 'ensNameWrapper',
      })
      if (asParent) {
        const { label, parentNode } = makeLabelNodeAndParent(name)
        return {
          to: nameWrapperAddress,
          data: encodeFunctionData({
            abi: nameWrapperSetSubnodeOwnerSnippet,
            functionName: 'setSubnodeOwner',
            args: [parentNode, label, newOwnerAddress, 0, BigInt(0)],
          }),
        }
      }
      return {
        to: nameWrapperAddress,
        data: encodeFunctionData({
          abi: erc1155SafeTransferFromSnippet,
          functionName: 'safeTransferFrom',
          args: [
            wallet.account.address,
            newOwnerAddress,
            BigInt(namehash(name)),
            BigInt(1),
            '0x',
          ],
        }),
      }
    }
    default:
      throw new InvalidContractTypeError({
        contractType: contract,
        supportedContractTypes: ['registry', 'registrar', 'nameWrapper'],
      })
  }
}

/**
 * Transfers a name to a new owner.
 * @param wallet - {@link WalletWithEns}
 * @param parameters - {@link TransferNameParameters}
 * @returns Transaction hash. {@link TransferNameReturnType}
 *
 * @example
 * import { createWalletClient, custom } from 'viem'
 * import { mainnet } from 'viem/chains'
 * import { addEnsContracts, transferName } from '@ensdomains/ensjs'
 *
 * const wallet = createWalletClient({
 *   chain: addEnsContracts(mainnet),
 *   transport: custom(window.ethereum),
 * })
 * const hash = await transferName(wallet, {
 *   name: 'ens.eth',
 *   newOwnerAddress: '0xFe89cc7aBB2C4183683ab71653C4cdc9B02D44b7',
 *   contract: 'registry',
 * })
 * // 0x...
 */
async function transferName<
  TChain extends ChainWithEns,
  TAccount extends Account | undefined,
  TChainOverride extends ChainWithEns | undefined = ChainWithEns,
>(
  wallet: WalletWithEns<Transport, TChain, TAccount>,
  {
    name,
    newOwnerAddress,
    contract,
    reclaim,
    asParent,
    ...txArgs
  }: TransferNameParameters<TChain, TAccount, TChainOverride>,
): Promise<TransferNameReturnType> {
  const data = makeFunctionData(
    {
      ...wallet,
      account: parseAccount((txArgs.account || wallet.account)!),
    } as WalletWithEns<Transport, TChain, Account>,
    {
      name,
      newOwnerAddress,
      contract,
      reclaim,
      asParent,
    } as TransferNameDataParameters,
  )
  const writeArgs = {
    ...data,
    ...txArgs,
  } as SendTransactionParameters<TChain, TAccount, TChainOverride>
  return wallet.sendTransaction(writeArgs)
}

transferName.makeFunctionData = makeFunctionData

export default transferName
import {
  Account,
  Hash,
  SendTransactionParameters,
  Transport,
  encodeFunctionData,
} from 'viem'
import { ChainWithEns, WalletWithEns } from '../../contracts/consts'
import { getChainContractAddress } from '../../contracts/getChainContractAddress'
import {
  setSubnodeRecordSnippet as nameWrapperSetSubnodeRecordSnippet,
  setRecordSnippet,
} from '../../contracts/nameWrapper'
import {
  setRecordSnippet as registrySetRecordSnippet,
  setSubnodeRecordSnippet as registrySetSubnodeRecordSnippet,
} from '../../contracts/registry'
import {
  InvalidContractTypeError,
  UnsupportedNameTypeError,
} from '../../errors/general'
import {
  Prettify,
  SimpleTransactionRequest,
  WriteTransactionParameters,
} from '../../types'
import { EMPTY_ADDRESS } from '../../utils/consts'
import { getNameType } from '../../utils/getNameType'
import { makeLabelNodeAndParent } from '../../utils/makeLabelNodeAndParent'
import { namehash } from '../../utils/normalise'

export type DeleteSubnameDataParameters = {
  /** Subname to delete */
  name: string
  /** Contract to delete subname on */
  contract: 'registry' | 'nameWrapper'
  /** If true, deletes via owner methods, otherwise will delete via parent owner methods */
  asOwner?: boolean
}

export type DeleteSubnameDataReturnType = SimpleTransactionRequest

export type DeleteSubnameParameters<
  TChain extends ChainWithEns,
  TAccount extends Account | undefined,
  TChainOverride extends ChainWithEns | undefined,
> = Prettify<
  DeleteSubnameDataParameters &
    WriteTransactionParameters<TChain, TAccount, TChainOverride>
>

export type DeleteSubnameReturnType = Hash

export const makeFunctionData = <
  TChain extends ChainWithEns,
  TAccount extends Account | undefined,
>(
  wallet: WalletWithEns<Transport, TChain, TAccount>,
  { name, contract, asOwner }: DeleteSubnameDataParameters,
): DeleteSubnameDataReturnType => {
  const nameType = getNameType(name)
  if (nameType !== 'eth-subname' && nameType !== 'other-subname')
    throw new UnsupportedNameTypeError({
      nameType,
      supportedNameTypes: ['eth-subname', 'other-subname'],
      details: 'Cannot delete a name that is not a subname',
    })

  switch (contract) {
    case 'registry': {
      const registryAddress = getChainContractAddress({
        client: wallet,
        contract: 'ensRegistry',
      })
      if (asOwner)
        return {
          to: registryAddress,
          data: encodeFunctionData({
            abi: registrySetRecordSnippet,
            functionName: 'setRecord',
            args: [namehash(name), EMPTY_ADDRESS, EMPTY_ADDRESS, BigInt(0)],
          }),
        }

      const { labelhash, parentNode } = makeLabelNodeAndParent(name)
      return {
        to: registryAddress,
        data: encodeFunctionData({
          abi: registrySetSubnodeRecordSnippet,
          functionName: 'setSubnodeRecord',
          args: [
            parentNode,
            labelhash,
            EMPTY_ADDRESS,
            EMPTY_ADDRESS,
            BigInt(0),
          ],
        }),
      }
    }
    case 'nameWrapper': {
      const nameWrapperAddress = getChainContractAddress({
        client: wallet,
        contract: 'ensNameWrapper',
      })
      if (asOwner)
        return {
          to: nameWrapperAddress,
          data: encodeFunctionData({
            abi: setRecordSnippet,
            functionName: 'setRecord',
            args: [namehash(name), EMPTY_ADDRESS, EMPTY_ADDRESS, BigInt(0)],
          }),
        }

      const { label, parentNode } = makeLabelNodeAndParent(name)
      return {
        to: nameWrapperAddress,
        data: encodeFunctionData({
          abi: nameWrapperSetSubnodeRecordSnippet,
          functionName: 'setSubnodeRecord',
          args: [
            parentNode,
            label,
            EMPTY_ADDRESS,
            EMPTY_ADDRESS,
            BigInt(0),
            0,
            BigInt(0),
          ],
        }),
      }
    }
    default:
      throw new InvalidContractTypeError({
        contractType: contract,
        supportedContractTypes: ['registry', 'nameWrapper'],
      })
  }
}

/**
 * Deletes a subname
 * @param wallet - {@link WalletWithEns}
 * @param parameters - {@link DeleteSubnameParameters}
 * @returns Transaction hash. {@link DeleteSubnameReturnType}
 *
 * @example
 * import { createWalletClient, custom } from 'viem'
 * import { mainnet } from 'viem/chains'
 * import { addEnsContracts, deleteSubname } from '@ensdomains/ensjs'
 *
 * const wallet = createWalletClient({
 *   chain: mainnetWithEns,
 *   transport: custom(window.ethereum),
 * })
 * const hash = await deleteSubname(wallet, {
 *   name: 'sub.ens.eth',
 *   contract: 'registry',
 * })
 * // 0x...
 */
async function deleteSubname<
  TChain extends ChainWithEns,
  TAccount extends Account | undefined,
  TChainOverride extends ChainWithEns | undefined = ChainWithEns,
>(
  wallet: WalletWithEns<Transport, TChain, TAccount>,
  {
    name,
    contract,
    asOwner,
    ...txArgs
  }: DeleteSubnameParameters<TChain, TAccount, TChainOverride>,
): Promise<DeleteSubnameReturnType> {
  const data = makeFunctionData(wallet, {
    name,
    contract,
    asOwner,
  } as DeleteSubnameDataParameters)
  const writeArgs = {
    ...data,
    ...txArgs,
  } as SendTransactionParameters<TChain, TAccount, TChainOverride>
  return wallet.sendTransaction(writeArgs)
}

deleteSubname.makeFunctionData = makeFunctionData

export default deleteSubname
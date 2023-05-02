import {
  Account,
  Hash,
  SendTransactionParameters,
  Transport,
  encodeFunctionData,
} from 'viem'
import { ChainWithEns, WalletWithEns } from '../../contracts/addContracts'
import { registerSnippet } from '../../contracts/ethRegistrarController'
import { getChainContractAddress } from '../../contracts/getChainContractAddress'
import {
  Prettify,
  SimpleTransactionRequest,
  WriteTransactionParameters,
} from '../../types'
import {
  RegistrationParameters,
  makeRegistrationTuple,
} from '../../utils/registerHelpers'
import { wrappedLabelLengthCheck } from '../../utils/wrapper'

export type RegisterNameDataParameters = RegistrationParameters & {
  value: bigint
}

export type RegisterNameDataReturnType = SimpleTransactionRequest & {
  value: bigint
}

export type RegisterNameParameters<
  TChain extends ChainWithEns,
  TAccount extends Account | undefined,
  TChainOverride extends ChainWithEns | undefined,
> = Prettify<
  RegisterNameDataParameters &
    WriteTransactionParameters<TChain, TAccount, TChainOverride>
>

export type RegisterNameReturnType = Hash

const makeFunctionData = <
  TChain extends ChainWithEns,
  TAccount extends Account | undefined,
>(
  wallet: WalletWithEns<Transport, TChain, TAccount>,
  { value, ...args }: RegisterNameDataParameters,
): RegisterNameDataReturnType => {
  const labels = args.name.split('.')
  if (labels.length !== 2)
    throw new Error('Only second level name registration is supported')
  if (labels[1] !== 'eth')
    throw new Error('Only .eth name registration is supported')
  wrappedLabelLengthCheck(labels[0])
  return {
    to: getChainContractAddress({
      client: wallet,
      contract: 'ensEthRegistrarController',
    }),
    data: encodeFunctionData({
      abi: registerSnippet,
      functionName: 'register',
      args: makeRegistrationTuple(args),
    }),
    value,
  }
}

async function registerName<
  TChain extends ChainWithEns,
  TAccount extends Account | undefined,
  TChainOverride extends ChainWithEns | undefined = ChainWithEns,
>(
  wallet: WalletWithEns<Transport, TChain, TAccount>,
  {
    name,
    owner,
    duration,
    secret,
    resolverAddress,
    records,
    reverseRecord,
    fuses,
    value,
    ...txArgs
  }: RegisterNameParameters<TChain, TAccount, TChainOverride>,
): Promise<RegisterNameReturnType> {
  const data = makeFunctionData(wallet, {
    name,
    owner,
    duration,
    secret,
    resolverAddress,
    records,
    reverseRecord,
    fuses,
    value,
  })
  const writeArgs = {
    ...data,
    ...txArgs,
  } as SendTransactionParameters<TChain, TAccount, TChainOverride>
  return wallet.sendTransaction(writeArgs)
}

registerName.makeFunctionData = makeFunctionData

export default registerName
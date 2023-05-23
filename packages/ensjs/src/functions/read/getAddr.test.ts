import { createPublicClient, http } from 'viem'
import { mainnet } from 'viem/chains'
import { addContracts } from '../../contracts/addContracts'
import { publicClient } from '../../tests/addTestContracts'
import getAddr from './getAddr'

const [mainnetWithEns] = addContracts([mainnet])
const transport = http('https://web3.ens.domains/v1/mainnet')

const mainnetPublicClient = createPublicClient({
  chain: mainnetWithEns,
  transport,
})

describe('getAddr()', () => {
  it('returns the ETH record when no coin is provided', async () => {
    const result = await getAddr(publicClient, { name: 'with-profile.eth' })
    expect(result).toMatchInlineSnapshot(`
      {
        "id": 60,
        "name": "ETH",
        "value": "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
      }
    `)
  })
  it('should return the correct address based on a coin ID input as a number', async () => {
    const result = await getAddr(publicClient, {
      name: 'with-profile.eth',
      coin: 61,
    })
    expect(result).toMatchInlineSnapshot(`
      {
        "id": 61,
        "name": "ETC_LEGACY",
        "value": "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
      }
    `)
  })
  it('should return the correct address based on a coin ID input as a string', async () => {
    const result = await getAddr(publicClient, {
      name: 'with-profile.eth',
      coin: '61',
    })
    expect(result).toMatchInlineSnapshot(`
      {
        "id": 61,
        "name": "ETC_LEGACY",
        "value": "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
      }
    `)
  })
  it('should return the correct address based on a coin name', async () => {
    const result = await getAddr(publicClient, {
      name: 'with-profile.eth',
      coin: 'ETC_LEGACY',
    })
    expect(result).toMatchInlineSnapshot(`
      {
        "id": 61,
        "name": "ETC_LEGACY",
        "value": "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
      }
    `)
  })
  it('should return null for a non-existent coin', async () => {
    const result = await getAddr(publicClient, {
      name: 'with-profile.eth',
      coin: 'BNB',
    })
    expect(result).toBeNull()
  })
  it('should return value for label > 255 bytes', async () => {
    const result = await getAddr(mainnetPublicClient, {
      name: `696969696969696969696969696969696969696969696969696969696969696969696969696969696969696969696969696969696969696969696969696969696969696969696969696969696969696969696969696969696969696969696969696969696969696969696969696969696969696969696969696969696969696969696969696969696969696969696969696969696969696969696969696969696969696969696969696969696969696969696969696969696969696969696969696969696969696969696969696969696969.eth`,
    })
    expect(result).toMatchInlineSnapshot(`
      {
        "id": 60,
        "name": "ETH",
        "value": "0xde9ba5F62D6047C4a9cCF24455AA733cCC5B8F41",
      }
    `)
  })
})
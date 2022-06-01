import { stores } from '../../../src/validations/access-checker/stores'
import { buildStoreDeployment } from '../../setup/deployments'
import { buildComponents, buildExternalCalls } from '../../setup/mock'

describe('Access: stores', () => {
  it('When a user store is created by its own address, then it is valid', async () => {
    const someAddress = '0x5a0b54d5dc17e0aadc383d2db43b0a0d3e029c4c'
    const deployment = buildStoreDeployment([
      'urn:decentraland:off-chain:marketplace-stores:' + someAddress
    ])
    const externalCalls = buildExternalCalls({
      ownerAddress: () => someAddress
    })

    const response = await stores.validate(buildComponents({ externalCalls }), deployment)
    expect(response.ok).toBeTruthy()
  })

  it('When a user store is created and too many pointers are sent, the access check fails', async () => {
    const addresses = ['some-address-1', 'some-address=2']
    const deployment = buildStoreDeployment(addresses)
    const externalCalls = buildExternalCalls({
      ownerAddress: () => 'some-address'
    })

    const response = await stores.validate(buildComponents({ externalCalls }), deployment)
    expect(response.ok).toBeFalsy()
    expect(response.errors).toContain(
      `Only one pointer is allowed when you create a Store. Received: ${addresses}`
    )
  })

  it('When a profile is created and the pointers does not match the signer, the access check fails', async () => {
    const address = '0x5a0b54d5dc17e0aadc383d2db43b0a0d3e029c4a'
    const otherAddress = '0x5a0b54d5dc17e0aadc383d2db43b0a0d3e029c4c'
    const pointer =
      'urn:decentraland:off-chain:marketplace-stores:' + otherAddress

    const deployment = buildStoreDeployment([pointer])
    const externalCalls = buildExternalCalls({
      ownerAddress: () => address
    })

    const response = await stores.validate(buildComponents({ externalCalls }), deployment)
    expect(response.ok).toBeFalsy()
    expect(response.errors).toContain(
      `You can only alter your own store. The pointer address and the signer address are different (address:${otherAddress} signer: ${address}).`
    )
  })
})

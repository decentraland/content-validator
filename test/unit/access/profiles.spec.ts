import { EntityType } from '@dcl/schemas'
import { profiles } from '../../../src/validations/access-checker/profiles'
import { ADR_74_TIMESTAMP, ADR_75_TIMESTAMP } from '../../../src/validations/timestamps'
import { buildDeployment, buildProfileDeployment } from '../../setup/deployments'
import { buildEntity } from '../../setup/entity'
import { buildComponents, buildExternalCalls, fetcherWithItemsOwnership } from '../../setup/mock'
import { validProfileMetadataWithEmotes, VALID_PROFILE_METADATA } from '../../setup/profiles'

describe('Access: profiles', () => {
  it('When a non-decentraland address tries to deploy an default profile, then an error is returned', async () => {
    const deployment = buildProfileDeployment(['Default10'])
    const externalCalls = buildExternalCalls()

    const response = await profiles.validate(buildComponents({ externalCalls }), deployment)
    expect(response.ok).toBeFalsy()
    expect(response.errors).toContain('Only Decentraland can add or modify default profiles')
  })

  it('When a decentraland address tries to deploy a default profile, then it is allowed', async () => {
    const someValidAddress = '0x71c7656ec7ab88b098defb751b7401b5f6d8976f'
    const deployment = buildProfileDeployment(['Default10'])
    const externalCalls = buildExternalCalls({
      isAddressOwnedByDecentraland: () => true,
      ownerAddress: () => someValidAddress
    })

    const response = await profiles.validate(buildComponents({ externalCalls }), deployment)
    expect(response.ok).toBeTruthy()
  })

  it('When a profile is created by its own address, then it is valid', async () => {
    const someAddress = '0x5a0b54d5dc17e0aadc383d2db43b0a0d3e029c4c'
    const deployment = buildProfileDeployment([someAddress])
    const externalCalls = buildExternalCalls({
      ownerAddress: () => someAddress
    })

    const response = await profiles.validate(buildComponents({ externalCalls }), deployment)
    expect(response.ok).toBeTruthy()
  })

  it('When a profile is created and too many pointers are sent, the access check fails', async () => {
    const addresses = ['some-address-1', 'some-address=2']
    const deployment = buildProfileDeployment(addresses)
    const externalCalls = buildExternalCalls({
      ownerAddress: () => 'some-address'
    })

    const response = await profiles.validate(buildComponents({ externalCalls }), deployment)
    expect(response.ok).toBeFalsy()
    expect(response.errors).toContain(`Only one pointer is allowed when you create a Profile. Received: ${addresses}`)
  })

  it('When a profile is created and the pointers does not match the signer, the access check fails', async () => {
    const pointer = '0x5a0b54d5dc17e0aadc383d2db43b0a0d3e029c4c'
    const address = '0x5a0b54d5dc17e0aadc383d2db43b0a0d3e029c4a'

    const deployment = buildProfileDeployment([pointer])
    const externalCalls = buildExternalCalls({
      ownerAddress: () => address
    })

    const response = await profiles.validate(buildComponents({ externalCalls }), deployment)
    expect(response.ok).toBeFalsy()
    expect(response.errors).toContain(
      `You can only alter your own profile. The pointer address and the signer address are different (pointer:${pointer} signer: ${address}).`
    )
  })

  it('When a profile is created and the pointers are not eth addresses it fails', async () => {
    const pointer = 'someNonEthAddress'
    const address = 'anotherNonEthAddress'

    const deployment = buildProfileDeployment([pointer])
    const externalCalls = buildExternalCalls({
      ownerAddress: () => address
    })

    const response = await profiles.validate(buildComponents({ externalCalls }), deployment)
    expect(response.ok).toBeFalsy()
    expect(response.errors).toContain('The given pointer is not a valid ethereum address.')
  })

  it('When a profile has wearables, then all wearables must be owned by the ETH address', async () => {
    const someAddress = '0x862f109696d7121438642a78b3caa38f476db08b'

    const entity = buildEntity({
      type: EntityType.PROFILE,
      metadata: VALID_PROFILE_METADATA,
      timestamp: ADR_75_TIMESTAMP + 1,
      pointers: [someAddress]
    })
    const deployment = buildDeployment({ entity })

    const subGraphs = fetcherWithItemsOwnership('0x862f109696d7121438642a78b3caa38f476db08b')
    const externalCalls = buildExternalCalls({
      ownerAddress: () => someAddress
    })

    const response = await profiles.validate(buildComponents({ externalCalls, subGraphs }), deployment)
    expect(response.ok).toBeTruthy()
  })

  it('When a profile has claimed names and at least one is not owned by the address, then validation must fail with the correct message', async () => {
    const someAddress = '0x862f109696d7121438642a78b3caa38f476db08b'

    const entity = buildEntity({
      type: EntityType.PROFILE,
      metadata: VALID_PROFILE_METADATA,
      timestamp: ADR_75_TIMESTAMP + 1,
      pointers: [someAddress]
    })
    const deployment = buildDeployment({ entity })

    const subGraphs = fetcherWithItemsOwnership('0x862f109696d7121438642a78b3caa38f476db08b', [
      {
        name: "Someone else's name"
      }
    ])
    const externalCalls = buildExternalCalls({
      ownerAddress: () => someAddress
    })

    const response = await profiles.validate(buildComponents({ externalCalls, subGraphs }), deployment)
    expect(response.ok).toBeFalsy()
    expect(response.errors).toContain(
      'The following names (Some Name) are not owned by the address 0x862f109696d7121438642a78b3caa38f476db08b).'
    )
  })

  it('When a profile has wearables and at least one is not owned by the address, then validation must fail with the correct message', async () => {
    const someAddress = '0x862f109696d7121438642a78b3caa38f476db08b'

    const entity = buildEntity({
      type: EntityType.PROFILE,
      metadata: VALID_PROFILE_METADATA,
      timestamp: ADR_75_TIMESTAMP + 1,
      pointers: [someAddress]
    })
    const deployment = buildDeployment({ entity })

    const subGraphs = fetcherWithItemsOwnership('0x862f109696d7121438642a78b3caa38f476db08b', undefined, undefined, [
      {
        urn: 'urn:decentraland:matic:collections-v2:0x04e7f74e73e951c61edd80910e46c3fece5ebe80:2'
      },
      {
        urn: 'urn:decentraland:matic:collections-v2:0xa7f6eba61566fd4b3012569ef30f0200ec138aa4:0'
      }
    ])
    const externalCalls = buildExternalCalls({
      ownerAddress: () => someAddress
    })

    const response = await profiles.validate(buildComponents({ externalCalls, subGraphs }), deployment)
    expect(response.ok).toBeFalsy()
    expect(response.errors).toContain(
      'The following items (urn:decentraland:matic:collections-v2:0xf6f601efee04e74cecac02c8c5bdc8cc0fc1c721:0, urn:decentraland:matic:collections-v2:0xf1483f042614105cb943d3dd67157256cd003028:2, urn:decentraland:matic:collections-v2:0xf1483f042614105cb943d3dd67157256cd003028:19) are not owned by the address 0x862f109696d7121438642a78b3caa38f476db08b).'
    )
  })

  it('When a profile has emotes, then all emotes must be owned by the ETH address', async () => {
    const someAddress = '0x862f109696d7121438642a78b3caa38f476db08b'

    const entity = buildEntity({
      type: EntityType.PROFILE,
      metadata: validProfileMetadataWithEmotes([
        { slot: 0, urn: 'urn:decentraland:matic:collections-v2:0xa7f6eba61566fd4b3012569ef30f0200ec138aa5:0' }
      ]),
      timestamp: ADR_74_TIMESTAMP + 1,
      pointers: [someAddress]
    })
    const deployment = buildDeployment({ entity })

    const subGraphs = fetcherWithItemsOwnership('0x862f109696d7121438642a78b3caa38f476db08b', undefined, undefined, [
      { urn: 'urn:decentraland:matic:collections-v2:0xa7f6eba61566fd4b3012569ef30f0200ec138aa5:0' }
    ])
    const externalCalls = buildExternalCalls({
      ownerAddress: () => someAddress
    })

    const response = await profiles.validate(buildComponents({ externalCalls, subGraphs }), deployment)
    expect(response.ok).toBeTruthy()
  })

  it('When a profile has emotes and at least one is not owned by the address, then validation must fail with the correct message', async () => {
    const someAddress = '0x862f109696d7121438642a78b3caa38f476db08b'

    const entity = buildEntity({
      type: EntityType.PROFILE,
      metadata: validProfileMetadataWithEmotes([
        { slot: 0, urn: 'urn:decentraland:matic:collections-v2:0xa7f6eba61566fd4b3012569ef30f0200ec138aa5:0' },
        { slot: 0, urn: 'urn:decentraland:matic:collections-v2:0xa7f6eba61566fd4b3012569ef30f0200ec138aa5:1' }
      ]),
      timestamp: ADR_75_TIMESTAMP + 1,
      pointers: [someAddress]
    })
    const deployment = buildDeployment({ entity })

    const subGraphs = fetcherWithItemsOwnership('0x862f109696d7121438642a78b3caa38f476db08b', undefined, undefined, [
      { urn: 'urn:decentraland:matic:collections-v2:0xa7f6eba61566fd4b3012569ef30f0200ec138aa5:0' }
    ])
    const externalCalls = buildExternalCalls({
      ownerAddress: () => someAddress
    })

    const response = await profiles.validate(buildComponents({ externalCalls, subGraphs }), deployment)
    expect(response.ok).toBeFalsy()
    expect(response.errors).toContain(
      'The following items (urn:decentraland:matic:collections-v2:0xa7f6eba61566fd4b3012569ef30f0200ec138aa5:1) are not owned by the address 0x862f109696d7121438642a78b3caa38f476db08b).'
    )
  })
})

import { EntityType } from '@dcl/schemas'
import {
  createItemOwnershipValidateFn,
  createNamesOwnershipValidateFn
} from '../../../src/validations/access/common/profile'
import { ADR_74_TIMESTAMP, ADR_75_TIMESTAMP } from '../../../src/validations/timestamps'
import { buildDeployment, buildProfileDeployment } from '../../setup/deployments'
import { buildEntity } from '../../setup/entity'
import { buildExternalCalls } from '../../setup/mock'
import { VALID_PROFILE_METADATA, validProfileMetadataWithEmotes } from '../../setup/profiles'
import { createItemsOwnershipWith, createNamesOwnershipWith } from './mock'

describe('createItemOwnershipValidateFn', () => {
  it('When a profile has wearables, then all wearables must be owned by the ETH address', async () => {
    const someAddress = '0x862f109696d7121438642a78b3caa38f476db08b'

    const entity = buildEntity({
      type: EntityType.PROFILE,
      metadata: VALID_PROFILE_METADATA,
      timestamp: ADR_75_TIMESTAMP + 1,
      pointers: [someAddress]
    })
    const deployment = buildDeployment({ entity })

    const externalCalls = buildExternalCalls({
      ownerAddress: () => someAddress
    })

    const itemsOwnership = createItemsOwnershipWith(someAddress, VALID_PROFILE_METADATA.avatars[0].avatar.wearables)

    const validateFn = createItemOwnershipValidateFn({ externalCalls }, itemsOwnership)
    const response = await validateFn(deployment)
    expect(response.ok).toBeTruthy()
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

    const externalCalls = buildExternalCalls({
      ownerAddress: () => someAddress
    })

    const wearables = VALID_PROFILE_METADATA.avatars[0].avatar.wearables.filter(
      (wearable) => wearable !== 'urn:decentraland:matic:collections-v2:0xf6f601efee04e74cecac02c8c5bdc8cc0fc1c721:0'
    )

    const itemsOwnership = createItemsOwnershipWith(someAddress, wearables)

    const validateFn = createItemOwnershipValidateFn({ externalCalls }, itemsOwnership)

    const response = await validateFn(deployment)
    expect(response.ok).toBeFalsy()
    expect(response.errors).toContain(
      'The following items (urn:decentraland:matic:collections-v2:0xf6f601efee04e74cecac02c8c5bdc8cc0fc1c721:0) are not owned by the address 0x862f109696d7121438642a78b3caa38f476db08b).'
    )
  })

  it('When a profile has emotes, then all emotes must be owned by the ETH address', async () => {
    const someAddress = '0x862f109696d7121438642a78b3caa38f476db08b'
    const emoteUrn = 'urn:decentraland:matic:collections-v2:0xa7f6eba61566fd4b3012569ef30f0200ec138aa5:0'
    const entity = buildEntity({
      type: EntityType.PROFILE,
      metadata: validProfileMetadataWithEmotes([{ slot: 0, urn: emoteUrn }]),
      timestamp: ADR_74_TIMESTAMP + 1,
      pointers: [someAddress]
    })
    const deployment = buildDeployment({ entity })

    const externalCalls = buildExternalCalls({
      ownerAddress: () => someAddress
    })

    const itemsOwnership = createItemsOwnershipWith(someAddress, [emoteUrn])

    const validateFn = createItemOwnershipValidateFn({ externalCalls }, itemsOwnership)
    const response = await validateFn(deployment)
    expect(response.ok).toBeTruthy()
  })

  it('When a profile has emotes and at least one is not owned by the address, then validation must fail with the correct message', async () => {
    const someAddress = '0x862f109696d7121438642a78b3caa38f476db08b'
    const ownedEmoteUrn = 'urn:decentraland:matic:collections-v2:0xa7f6eba61566fd4b3012569ef30f0200ec138aa5:0'
    const notOwnedEmoteUrn = 'urn:decentraland:matic:collections-v2:0xa7f6eba61566fd4b3012569ef30f0200ec138aa5:1'
    const entity = buildEntity({
      type: EntityType.PROFILE,
      metadata: validProfileMetadataWithEmotes([
        { slot: 0, urn: ownedEmoteUrn },
        { slot: 0, urn: notOwnedEmoteUrn }
      ]),
      timestamp: ADR_74_TIMESTAMP + 1,
      pointers: [someAddress]
    })
    const deployment = buildDeployment({ entity })

    const externalCalls = buildExternalCalls({
      ownerAddress: () => someAddress
    })

    const itemsOwnership = createItemsOwnershipWith(someAddress, [ownedEmoteUrn])

    const validateFn = createItemOwnershipValidateFn({ externalCalls }, itemsOwnership)
    const response = await validateFn(deployment)
    expect(response.ok).toBeFalsy()
    expect(response.errors).toContain(
      'The following items (urn:decentraland:matic:collections-v2:0xa7f6eba61566fd4b3012569ef30f0200ec138aa5:1) are not owned by the address 0x862f109696d7121438642a78b3caa38f476db08b).'
    )
  })
})

describe('createNamesOwnershipValidateFn', () => {
  it('When a profile has claimed names and at least one is not owned by the address, then validation must fail with the correct message', async () => {
    const someAddress = '0x862f109696d7121438642a78b3caa38f476db08b'

    const entity = buildEntity({
      type: EntityType.PROFILE,
      metadata: VALID_PROFILE_METADATA,
      timestamp: ADR_75_TIMESTAMP + 1,
      pointers: [someAddress]
    })
    const deployment = buildDeployment({ entity })

    const externalCalls = buildExternalCalls({
      ownerAddress: () => someAddress
    })

    const namesOwnership = createNamesOwnershipWith(someAddress, [])

    const validateFn = createNamesOwnershipValidateFn({ externalCalls }, namesOwnership)
    const response = await validateFn(deployment)
    expect(response.ok).toBeFalsy()
    expect(response.errors).toContain(
      'The following names (Some Name) are not owned by the address 0x862f109696d7121438642a78b3caa38f476db08b).'
    )
  })

  it('claimed names are checked against the graph client after ADR 75', async () => {
    const someValidAddress = '0x71c7656ec7ab88b098defb751b7401b5f6d8976f'
    const deployment = buildProfileDeployment(['Default10'])
    deployment.entity.timestamp = ADR_75_TIMESTAMP
    deployment.entity.metadata = VALID_PROFILE_METADATA
    const externalCalls = buildExternalCalls({
      isAddressOwnedByDecentraland: () => true,
      ownerAddress: () => someValidAddress
    })

    const namesOwnership = createNamesOwnershipWith(someValidAddress, [])
    const namesOwnershipSpy = jest.spyOn(namesOwnership, 'ownsNamesAtTimestamp')
    const validateFn = createNamesOwnershipValidateFn({ externalCalls }, namesOwnership)

    await validateFn(deployment)
    expect(namesOwnershipSpy).toBeCalled()
  })

  it('claimed names are not checked against the graph client before ADR 75', async () => {
    const someValidAddress = '0x71c7656ec7ab88b098defb751b7401b5f6d8976f'
    const deployment = buildProfileDeployment(['Default10'])
    deployment.entity.timestamp = ADR_75_TIMESTAMP - 1
    deployment.entity.metadata = VALID_PROFILE_METADATA
    const externalCalls = buildExternalCalls({
      isAddressOwnedByDecentraland: () => true,
      ownerAddress: () => someValidAddress
    })

    const namesOwnership = createNamesOwnershipWith(someValidAddress, [])
    const namesOwnershipSpy = jest.spyOn(namesOwnership, 'ownsNamesAtTimestamp')
    const validateFn = createNamesOwnershipValidateFn({ externalCalls }, namesOwnership)
    await validateFn(deployment)
    expect(namesOwnershipSpy).not.toBeCalled()
  })

  it('claimed names valid in the graph are sucessful', async () => {
    const someValidAddress = '0x71c7656ec7ab88b098defb751b7401b5f6d8976f'
    const deployment = buildProfileDeployment(['Default10'])
    deployment.entity.timestamp = ADR_75_TIMESTAMP - 1
    deployment.entity.metadata = VALID_PROFILE_METADATA
    const externalCalls = buildExternalCalls({
      isAddressOwnedByDecentraland: () => true,
      ownerAddress: () => someValidAddress
    })

    const namesOwnership = createNamesOwnershipWith(
      someValidAddress,
      VALID_PROFILE_METADATA.avatars.map((a) => a.name)
    )
    const validateFn = createNamesOwnershipValidateFn({ externalCalls }, namesOwnership)
    const response = await validateFn(deployment)
    expect(response.ok).toBeTruthy()
  })
})

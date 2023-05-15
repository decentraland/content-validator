import { Entity, EntityType, EthAddress, Outfit, Outfits } from '@dcl/schemas'
import { SubgraphAccessCheckerComponents } from '../../../src'
import {
  createOutfitsNamesOwnershipValidateFn,
  createOutfitsWearablesOwnershipValidateFn
} from '../../../src/validations/access/subgraph/outfits'
import { buildDeployment } from '../../setup/deployments'
import { buildExternalCalls } from '../../setup/mock'
import { buildSubgraphAccessCheckerComponents } from './mock'

type TypedEntity<T> = Entity & {
  metadata: T
}

const ownerAddress = '0x12e7f74e73e951c61edd80910e46c3fece512345'

describe('createOutfitsWearablesOwnershipValidateFn', () => {
  const baseOutfit: Omit<Outfit, 'wearables'> = {
    bodyShape: 'urn:decentraland:off-chain:base-avatars:BaseMale',
    eyes: { color: { r: 0.23046875, g: 0.625, b: 0.3125 } },
    hair: { color: { r: 0.35546875, g: 0.19140625, b: 0.05859375 } },
    skin: { color: { r: 0.94921875, g: 0.76171875, b: 0.6484375 } }
  }

  function outfitWithWearables(slot: number, ...wearables: string[]): Outfits['outfits'][0] {
    return {
      slot,
      outfit: {
        ...baseOutfit,
        wearables: wearables
      }
    }
  }
  it('does not fail when all the outfit wearables are owned', async () => {
    const wearable0 = 'urn:decentraland:off-chain:base-avatars:wearable0'
    const wearable1 = 'urn:decentraland:off-chain:base-avatars:wearable1'
    const wearable2 = 'urn:decentraland:off-chain:base-avatars:wearable2'
    const entity: TypedEntity<Outfits> = {
      version: '3',
      type: EntityType.OUTFITS,
      pointers: [`${ownerAddress}:outfits`],
      timestamp: Date.now(),
      content: [],
      id: 'bafybeihz4c4cf4icnlh6yjtt7fooaeih3dkv2mz6umod7dybenzmsxkzvq',
      metadata: {
        outfits: [
          {
            slot: 0,
            outfit: {
              bodyShape: 'urn:decentraland:off-chain:base-avatars:BaseMale',
              eyes: { color: { r: 0.23046875, g: 0.625, b: 0.3125 } },
              hair: { color: { r: 0.35546875, g: 0.19140625, b: 0.05859375 } },
              skin: { color: { r: 0.94921875, g: 0.76171875, b: 0.6484375 } },
              wearables: [wearable0]
            }
          },
          {
            slot: 1,
            outfit: {
              bodyShape: 'urn:decentraland:off-chain:base-avatars:BaseMale',
              eyes: { color: { r: 0.23046875, g: 0.625, b: 0.3125 } },
              hair: { color: { r: 0.35546875, g: 0.19140625, b: 0.05859375 } },
              skin: { color: { r: 0.94921875, g: 0.76171875, b: 0.6484375 } },
              wearables: [wearable1]
            }
          }
        ],
        namesForExtraSlots: []
      }
    }
    const deployment = buildDeployment({ entity })
    const externalCalls = buildExternalCalls({
      isAddressOwnedByDecentraland: () => true,
      ownerAddress: () => ownerAddress
    })

    const components = buildSubgraphAccessCheckerComponents({ externalCalls })
    const theGraphSpy = spyTheGraphClientWithOwnedWearables(components, ownerAddress, [wearable0, wearable1, wearable2])

    const validateFn = createOutfitsWearablesOwnershipValidateFn(components)
    const result = await validateFn(deployment)
    expect(theGraphSpy).toBeCalled()
    expect(result.ok).toBeTruthy()
  })

  it('fails when at least one outfit wearable is not owned', async () => {
    const wearable0 = 'urn:decentraland:off-chain:base-avatars:wearable0'
    const wearable1 = 'urn:decentraland:off-chain:base-avatars:wearable1'
    const wearable2 = 'urn:decentraland:off-chain:base-avatars:wearable2'
    const entity: TypedEntity<Outfits> = {
      version: '3',
      type: EntityType.OUTFITS,
      pointers: [`${ownerAddress}:outfits`],
      timestamp: Date.now(),
      content: [],
      id: 'bafybeihz4c4cf4icnlh6yjtt7fooaeih3dkv2mz6umod7dybenzmsxkzvq',
      metadata: {
        outfits: [outfitWithWearables(0, wearable0), outfitWithWearables(1, wearable1)],
        namesForExtraSlots: []
      }
    }
    const deployment = buildDeployment({ entity })
    const externalCalls = buildExternalCalls({
      isAddressOwnedByDecentraland: () => true,
      ownerAddress: () => ownerAddress
    })

    const components = buildSubgraphAccessCheckerComponents({ externalCalls })
    const theGraphSpy = spyTheGraphClientWithOwnedWearables(components, ownerAddress, [wearable0, wearable2])

    const validateFn = createOutfitsWearablesOwnershipValidateFn(components)
    const result = await validateFn(deployment)
    expect(theGraphSpy).toBeCalled()
    expect(result.ok).toBeFalsy()
    expect(result.errors).toBeDefined()
    if (result.errors) {
      expect(result.errors[0]).toEqual(
        'The following wearables (urn:decentraland:off-chain:base-avatars:wearable1) are not owned by the address 0x12e7f74e73e951c61edd80910e46c3fece512345).'
      )
    }
  })

  function spyTheGraphClientWithOwnedWearables(
    { theGraphClient }: Pick<SubgraphAccessCheckerComponents, 'theGraphClient'>,
    ownerAddress: string,
    ownedWearables: string[]
  ) {
    return jest
      .spyOn(theGraphClient, 'ownsItemsAtTimestamp')
      .mockImplementation(async (ethAddress: EthAddress, urnsToCheck: string[]) => {
        const result = ethAddress === ownerAddress && urnsToCheck.every((wearable) => ownedWearables.includes(wearable))
        if (!result) {
          const failing = urnsToCheck.filter((wearable) => !ownedWearables.includes(wearable))
          return {
            result,
            failing
          }
        }
        return {
          result
        }
      })
  }
})
describe('createOutfitsNamesOwnershipValidateFn', () => {
  it('does not fail when owns the names', async () => {
    const entity: TypedEntity<Outfits> = {
      version: '3',
      type: EntityType.OUTFITS,
      pointers: [`${ownerAddress}:outfits`],
      timestamp: Date.now(),
      content: [],
      id: 'bafybeihz4c4cf4icnlh6yjtt7fooaeih3dkv2mz6umod7dybenzmsxkzvq',
      metadata: {
        outfits: [],
        namesForExtraSlots: ['name1', 'name2']
      }
    }
    const deployment = buildDeployment({ entity })
    const externalCalls = buildExternalCalls({
      isAddressOwnedByDecentraland: () => true,
      ownerAddress: () => ownerAddress
    })

    const components = buildSubgraphAccessCheckerComponents({ externalCalls })
    const theGraphSpy = spyTheGraphClientWithOwnedNames(components, ownerAddress, ['name1', 'name2', 'name3'])

    const validateFn = createOutfitsNamesOwnershipValidateFn(components)
    const result = await validateFn(deployment)
    expect(theGraphSpy).toBeCalled()
    expect(result.ok).toBeTruthy()
  })

  it('fails when it does not own a name', async () => {
    const entity: TypedEntity<Outfits> = {
      version: '3',
      type: EntityType.OUTFITS,
      pointers: [`${ownerAddress}:outfits`],
      timestamp: Date.now(),
      content: [],
      id: 'bafybeihz4c4cf4icnlh6yjtt7fooaeih3dkv2mz6umod7dybenzmsxkzvq',
      metadata: {
        outfits: [],
        namesForExtraSlots: ['name1', 'name2']
      }
    }
    const deployment = buildDeployment({ entity })
    const externalCalls = buildExternalCalls({
      isAddressOwnedByDecentraland: () => true,
      ownerAddress: () => ownerAddress
    })

    const components = buildSubgraphAccessCheckerComponents({ externalCalls })
    const theGraphSpy = spyTheGraphClientWithOwnedNames(components, ownerAddress, ['name2', 'name3'])

    const validateFn = createOutfitsNamesOwnershipValidateFn(components)
    const result = await validateFn(deployment)
    expect(theGraphSpy).toBeCalled()
    expect(result.ok).toBeFalsy()
    expect(result.errors).toBeDefined()
    if (result.errors) {
      expect(result.errors[0]).toEqual(
        'The following names (name1) are not owned by the address 0x12e7f74e73e951c61edd80910e46c3fece512345).'
      )
    }
  })

  function spyTheGraphClientWithOwnedNames(
    { theGraphClient }: Pick<SubgraphAccessCheckerComponents, 'theGraphClient'>,
    ownerAddress: string,
    ownedNames: string[]
  ) {
    return jest
      .spyOn(theGraphClient, 'ownsNamesAtTimestamp')
      .mockImplementation(async (ethAddress: EthAddress, namesToCheck: string[]) => {
        const result = ethAddress === ownerAddress && namesToCheck.every((name) => ownedNames.includes(name))
        if (!result) {
          const failing = namesToCheck.filter((name) => !ownedNames.includes(name))
          return {
            result,
            failing
          }
        }
        return {
          result
        }
      })
  }
})

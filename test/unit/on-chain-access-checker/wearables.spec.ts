import { buildThirdPartyWearableDeployment, buildWearableDeployment } from '../../setup/deployments'
import { buildExternalCalls } from '../../setup/mock'
import { VALID_THIRD_PARTY_WEARABLE_WITH_MAPPINGS, VALID_THIRD_PARTY_WEARABLE } from '../../setup/wearable'
import { buildOnChainAccessCheckerComponents, buildWearableValidateFn } from './mock'

describe('Access: wearables', () => {
  it('When non-urns are used as pointers, then validation fails', async () => {
    const pointers = ['invalid-pointer']
    const deployment = buildWearableDeployment(pointers)
    const externalCalls = buildExternalCalls()
    const components = buildOnChainAccessCheckerComponents({ externalCalls })
    const validateFn = buildWearableValidateFn(components)
    const response = await validateFn(deployment)
    expect(response.ok).toBeFalsy()
    expect(response.errors).toContain(
      'Item pointers should be a urn, for example (urn:decentraland:{protocol}:collections-v2:{contract(0x[a-fA-F0-9]+)}:{id}). Invalid pointer: (invalid-pointer)'
    )
  })

  it('When there is more than one pointer set, then validation fails', async () => {
    const pointers = [
      'urn:decentraland:ethereum:collections-v1:atari_launch:a',
      'urn:decentraland:ethereum:collections-v1:atari_launch:b'
    ]
    const deployment = buildWearableDeployment(pointers)
    const externalCalls = buildExternalCalls()

    const components = buildOnChainAccessCheckerComponents({ externalCalls })
    const validateFn = buildWearableValidateFn(components)
    const response = await validateFn(deployment)
    expect(response.ok).toBeFalsy()
    expect(response.errors).toContain(`Only one pointer is allowed when you create an item. Received: ${pointers}`)
  })

  it('When several pointers resolve to the same URN then accept both but fail with the access', async () => {
    const pointers = [
      'urn:decentraland:ethereum:collections-v1:atari_launch:atari_red_upper_body',
      'urn:decentraland:ethereum:collections-v1:0x4c290f486bae507719c562b6b524bdb71a2570c9:atari_red_upper_body'
    ]
    const deployment = buildWearableDeployment(pointers)
    const externalCalls = buildExternalCalls({
      ownerAddress: () => 'some address'
    })

    const components = buildOnChainAccessCheckerComponents({ externalCalls })
    const validateFn = buildWearableValidateFn(components)
    const response = await validateFn(deployment)
    expect(response.ok).toBeFalsy()
    expect(response.errors).toContain(
      `The provided Eth Address 'some address' does not have access to the following item: 'urn:decentraland:ethereum:collections-v1:atari_launch:atari_red_upper_body'`
    )
  })

  it('When several pointers resolve to the same URN then accept both 2', async () => {
    const pointers = [
      'urn:decentraland:ethereum:collections-v1:dgtble_headspace:dgtble_hoodi_linetang_upper_body',
      'urn:decentraland:ethereum:collections-v1:0x574f64ac2e7215cba9752b85fc73030f35166bc0:dgtble_hoodi_linetang_upper_body'
    ]
    const deployment = buildWearableDeployment(pointers)
    const externalCalls = buildExternalCalls({
      ownerAddress: () => 'some address'
    })

    const components = buildOnChainAccessCheckerComponents({ externalCalls })
    const validateFn = buildWearableValidateFn(components)
    const response = await validateFn(deployment)
    expect(response.ok).toBeFalsy()
    expect(response.errors).toContain(
      `The provided Eth Address 'some address' does not have access to the following item: 'urn:decentraland:ethereum:collections-v1:dgtble_headspace:dgtble_hoodi_linetang_upper_body'`
    )
  })

  it('When pointer resolves to L1 fails with invalid address', async () => {
    const pointers = ['urn:decentraland:ethereum:collections-v1:dgtble_headspace:dgtble_hoodi_linetang_upper_body']
    const deployment = buildWearableDeployment(pointers)
    const externalCalls = buildExternalCalls({
      ownerAddress: () => 'some address'
    })

    const components = buildOnChainAccessCheckerComponents({ externalCalls })
    const validateFn = buildWearableValidateFn(components)
    const response = await validateFn(deployment)
    expect(response.ok).toBeFalsy()
    expect(response.errors).toContain(
      `The provided Eth Address 'some address' does not have access to the following item: 'urn:decentraland:ethereum:collections-v1:dgtble_headspace:dgtble_hoodi_linetang_upper_body'`
    )
  })

  it('When pointer resolves to L1 succeeds with valid address', async () => {
    const pointers = ['urn:decentraland:ethereum:collections-v1:dgtble_headspace:dgtble_hoodi_linetang_upper_body']
    const deployment = buildWearableDeployment(pointers)
    const externalCalls = buildExternalCalls({
      isAddressOwnedByDecentraland: () => true
    })

    const components = buildOnChainAccessCheckerComponents({ externalCalls })
    const validateFn = buildWearableValidateFn(components)
    const response = await validateFn(deployment)
    expect(response.ok).toBeTruthy()
  })

  it('When pointer resolves to base-avatar then it resolves okay only with decentraland address', async () => {
    const pointers = ['urn:decentraland:off-chain:base-avatars:BaseFemale']
    const deployment = buildWearableDeployment(pointers)
    const externalCalls = buildExternalCalls({
      isAddressOwnedByDecentraland: () => true
    })

    const components = buildOnChainAccessCheckerComponents({ externalCalls })
    const validateFn = buildWearableValidateFn(components)
    const response = await validateFn(deployment)
    expect(response.ok).toBeTruthy()
  })

  it('When urn network belongs to L2, then L2Checker is used', async () => {
    const ethAddress = 'address'
    const externalCalls = buildExternalCalls({
      ownerAddress: () => ethAddress
    })
    const components = buildOnChainAccessCheckerComponents({ externalCalls })

    const deployment = buildWearableDeployment([
      'urn:decentraland:mumbai:collections-v2:0x8dec2b9bd86108430a0c288ea1b76c749823d104:1'
    ])

    const l2BlockSearchSpy = jest.spyOn(components.L2.blockSearch, 'findBlockForTimestamp')
    const validateFn = buildWearableValidateFn(components)
    await validateFn(deployment)

    expect(l2BlockSearchSpy).toHaveBeenNthCalledWith(1, expect.anything())
    expect(components.L2.checker.validateWearables).toHaveBeenNthCalledWith(
      1,
      ethAddress,
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything()
    )
    expect(components.L2.checker.validateWearables).toHaveBeenNthCalledWith(
      2,
      ethAddress,
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything()
    )
  })

  describe(`Merkle Proofed (Third Party) Wearable`, () => {
    const { entity: metadata } = VALID_THIRD_PARTY_WEARABLE

    it(`When urn corresponds to a Third Party wearable and can verify merkle root with the proofs, validation pass`, async () => {
      const components = buildOnChainAccessCheckerComponents()
      components.L2.checker.validateThirdParty = jest.fn(() => Promise.resolve(true))

      const deployment = buildThirdPartyWearableDeployment(metadata.id, metadata)

      const validateFn = buildWearableValidateFn(components)
      const response = await validateFn(deployment)

      expect(response.ok).toBeTruthy()
    })

    it(`When urn corresponds to a Third Party wearable and metadata is modified, validation fails`, async () => {
      const components = buildOnChainAccessCheckerComponents()

      const deployment = buildThirdPartyWearableDeployment(metadata.id, {
        ...metadata,
        content: {}
      })

      const validateFn = buildWearableValidateFn(components)
      const response = await validateFn(deployment)
      expect(response.ok).toBeFalsy()
    })

    it(`When urn corresponds to a Third Party wearable, then L2 checker is used`, async () => {
      const components = buildOnChainAccessCheckerComponents()

      const deployment = buildThirdPartyWearableDeployment(metadata.id, metadata)
      const l2BlockSearchSpy = jest.spyOn(components.L2.blockSearch, 'findBlockForTimestamp')

      const validateFn = buildWearableValidateFn(components)
      await validateFn(deployment)
      expect(l2BlockSearchSpy).toHaveBeenNthCalledWith(1, expect.anything())
      expect(components.L2.checker.validateThirdParty).toHaveBeenNthCalledWith(
        2,
        expect.anything(),
        expect.anything(),
        expect.anything()
      )
    })
  })

  describe(`Merkle Proofed (Linked) Wearable`, () => {
    const { entity: metadata } = VALID_THIRD_PARTY_WEARABLE_WITH_MAPPINGS

    it(`When urn corresponds to a Linked Wearable and can verify merkle root with the proofs, validation pass`, async () => {
      const components = buildOnChainAccessCheckerComponents()
      components.L2.checker.validateThirdParty = jest.fn(() => Promise.resolve(true))

      const deployment = buildThirdPartyWearableDeployment(metadata.id, metadata)
      const validateFn = buildWearableValidateFn(components)
      const response = await validateFn(deployment)

      expect(response.ok).toBeTruthy()
    })

    it(`When urn corresponds to a Linked Wearable and metadata is modified, validation fails`, async () => {
      const components = buildOnChainAccessCheckerComponents()

      const deployment = buildThirdPartyWearableDeployment(metadata.id, {
        ...metadata,
        content: {}
      })

      const validateFn = buildWearableValidateFn(components)
      const response = await validateFn(deployment)
      expect(response.ok).toBeFalsy()
    })

    it(`When urn corresponds to a Linked Wearable, then L2 checker is used`, async () => {
      const components = buildOnChainAccessCheckerComponents()

      const deployment = buildThirdPartyWearableDeployment(metadata.id, metadata)
      const l2BlockSearchSpy = jest.spyOn(components.L2.blockSearch, 'findBlockForTimestamp')

      const validateFn = buildWearableValidateFn(components)
      await validateFn(deployment)
      expect(l2BlockSearchSpy).toHaveBeenNthCalledWith(1, expect.anything())
      expect(components.L2.checker.validateThirdParty).toHaveBeenNthCalledWith(
        2,
        expect.anything(),
        expect.anything(),
        expect.anything()
      )
    })

    it(`When urn corresponds to a Linked Wearable and checker contract fails then it returns false`, async () => {
      const components = buildOnChainAccessCheckerComponents()
      components.L2.checker.validateThirdParty = jest.fn(() => Promise.reject('error'))

      const deployment = buildThirdPartyWearableDeployment(metadata.id, metadata)

      const validateFn = buildWearableValidateFn(components)
      await validateFn(deployment)
      expect(components.L2.checker.validateThirdParty).toHaveBeenNthCalledWith(
        1,
        expect.anything(),
        expect.anything(),
        10
      )
      expect(components.L2.checker.validateThirdParty).toHaveBeenNthCalledWith(
        2,
        expect.anything(),
        expect.anything(),
        11
      )
    })
  })
})

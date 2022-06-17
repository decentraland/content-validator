import { wearables } from '../../../src/validations/access-checker/wearables'
import {
  buildThirdPartyWearableDeployment,
  buildWearableDeployment
} from '../../setup/deployments'
import {
  buildComponents,
  buildExternalCalls,
  buildSubgraphs,
  fetcherWithoutAccess,
  fetcherWithThirdPartyEmptyMerkleRoots,
  fetcherWithThirdPartyMerkleRoot,
  fetcherWithValidCollectionAndCreator
} from '../../setup/mock'
import { VALID_THIRD_PARTY_WEARABLE } from '../../setup/wearable'

describe('Access: wearables', () => {
  it('When non-urns are used as pointers, then validation fails', async () => {
    const pointers = ['invalid-pointer']
    const deployment = buildWearableDeployment(pointers)
    const externalCalls = buildExternalCalls()

    const response = await wearables.validate(
      buildComponents({ externalCalls }),
      deployment
    )
    expect(response.ok).toBeFalsy()
    expect(response.errors).toContain(
      'Wearable pointers should be a urn, for example (urn:decentraland:{protocol}:collections-v2:{contract(0x[a-fA-F0-9]+)}:{name}). Invalid pointer: (invalid-pointer)'
    )
  })

  it('When there is more than one pointer set, then validation fails', async () => {
    const pointers = [
      'urn:decentraland:ethereum:collections-v1:atari_launch:a',
      'urn:decentraland:ethereum:collections-v1:atari_launch:b'
    ]
    const deployment = buildWearableDeployment(pointers)
    const externalCalls = buildExternalCalls()

    const response = await wearables.validate(
      buildComponents({ externalCalls }),
      deployment
    )
    expect(response.ok).toBeFalsy()
    expect(response.errors).toContain(
      `Only one pointer is allowed when you create a Wearable. Received: ${pointers}`
    )
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

    const response = await wearables.validate(
      buildComponents({ externalCalls }),
      deployment
    )
    expect(response.ok).toBeFalsy()
    expect(response.errors).toContain(
      `The provided Eth Address 'some address' does not have access to the following wearable: 'urn:decentraland:ethereum:collections-v1:atari_launch:atari_red_upper_body'`
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

    const response = await wearables.validate(
      buildComponents({ externalCalls }),
      deployment
    )
    expect(response.ok).toBeFalsy()
    expect(response.errors).toContain(
      `The provided Eth Address 'some address' does not have access to the following wearable: 'urn:decentraland:ethereum:collections-v1:dgtble_headspace:dgtble_hoodi_linetang_upper_body'`
    )
  })

  it('When pointer resolves to L1 fails with invalid address', async () => {
    const pointers = [
      'urn:decentraland:ethereum:collections-v1:dgtble_headspace:dgtble_hoodi_linetang_upper_body'
    ]
    const deployment = buildWearableDeployment(pointers)
    const externalCalls = buildExternalCalls({
      ownerAddress: () => 'some address'
    })

    const response = await wearables.validate(
      buildComponents({ externalCalls }),
      deployment
    )
    expect(response.ok).toBeFalsy()
    expect(response.errors).toContain(
      `The provided Eth Address 'some address' does not have access to the following wearable: 'urn:decentraland:ethereum:collections-v1:dgtble_headspace:dgtble_hoodi_linetang_upper_body'`
    )
  })

  it('When pointer resolves to L1 succeeds with valid address', async () => {
    const pointers = [
      'urn:decentraland:ethereum:collections-v1:dgtble_headspace:dgtble_hoodi_linetang_upper_body'
    ]
    const deployment = buildWearableDeployment(pointers)
    const externalCalls = buildExternalCalls({
      isAddressOwnedByDecentraland: () => true
    })

    const response = await wearables.validate(
      buildComponents({ externalCalls }),
      deployment
    )
    expect(response.ok).toBeTruthy()
  })

  it('When pointer resolves to base-avatar then it resolves okay only with decentraland address', async () => {
    const pointers = ['urn:decentraland:off-chain:base-avatars:BaseFemale']
    const deployment = buildWearableDeployment(pointers)
    const externalCalls = buildExternalCalls({
      isAddressOwnedByDecentraland: () => true
    })

    const response = await wearables.validate(
      buildComponents({ externalCalls }),
      deployment
    )
    expect(response.ok).toBeTruthy()
  })

  const collectionsUrl = 'http://someUrl'
  const blocksUrl = 'http://blocksUrl'
  const thirdPartyRegistryUrl = 'http://thirdPartyRegistryUrl'
  const subgraphs = buildSubgraphs({
    L1: {
      landManager: 'landManager' + 'L1',
      collections: collectionsUrl + 'L1',
      blocks: blocksUrl + 'L1',
      ensOwner: 'ENS'
    },
    L2: {
      collections: collectionsUrl + 'L2',
      blocks: blocksUrl + 'L2',
      thirdPartyRegistry: thirdPartyRegistryUrl
    }
  })

  it('When urn network belongs to L2, then L2 subgraph is used', async () => {
    const ethAddress = 'address'
    const mockedQueryGraph = fetcherWithValidCollectionAndCreator(ethAddress)
    const externalCalls = buildExternalCalls({
      subgraphs,
      queryGraph: mockedQueryGraph,
      ownerAddress: () => ethAddress
    })

    const deployment = buildWearableDeployment([
      'urn:decentraland:mumbai:collections-v2:0x8dec2b9bd86108430a0c288ea1b76c749823d104:1'
    ])

    await wearables.validate(buildComponents({ externalCalls }), deployment)

    expect(mockedQueryGraph).toHaveBeenNthCalledWith(
      1,
      subgraphs.L2.blocks,
      expect.anything(),
      expect.anything()
    )
    expect(mockedQueryGraph).toHaveBeenNthCalledWith(
      2,
      subgraphs.L2.collections,
      expect.anything(),
      expect.anything()
    )
    expect(mockedQueryGraph).toBeCalledTimes(2)
  })

  it('When urn network belongs to L1, then L1 subgraph is used', async () => {
    const ethAddress = 'address'
    const mockedQueryGraph = fetcherWithoutAccess()
    const externalCalls = buildExternalCalls({
      subgraphs,
      queryGraph: mockedQueryGraph,
      ownerAddress: () => ethAddress
    })

    const deployment = buildWearableDeployment([
      'urn:decentraland:ethereum:collections-v2:0x8dec2b9bd86108430a0c288ea1b76c749823d104:1'
    ])

    await wearables.validate(buildComponents({ externalCalls }), deployment)

    expect(mockedQueryGraph).toHaveBeenNthCalledWith(
      1,
      subgraphs.L1.blocks,
      expect.anything(),
      expect.anything()
    )
    expect(mockedQueryGraph).toHaveBeenNthCalledWith(
      2,
      subgraphs.L1.collections,
      expect.anything(),
      expect.anything()
    )
  })

  it(`When urn network belongs to L2, and address doesn't have access, then L2 subgraph is used twice`, async () => {
    const ethAddress = 'address'
    const mockedQueryGraph = fetcherWithoutAccess()
    const externalCalls = buildExternalCalls({
      subgraphs,
      queryGraph: mockedQueryGraph,
      ownerAddress: () => ethAddress
    })

    const deployment = buildWearableDeployment([
      'urn:decentraland:mumbai:collections-v2:0x8dec2b9bd86108430a0c288ea1b76c749823d104:1'
    ])

    await wearables.validate(buildComponents({ externalCalls }), deployment)

    expect(mockedQueryGraph).toBeCalledTimes(3)
    expect(mockedQueryGraph).toHaveBeenNthCalledWith(
      1,
      subgraphs.L2.blocks,
      expect.anything(),
      expect.anything()
    )
    expect(mockedQueryGraph).toHaveBeenNthCalledWith(
      2,
      subgraphs.L2.collections,
      expect.anything(),
      expect.anything()
    )
    expect(mockedQueryGraph).toHaveBeenNthCalledWith(
      3,
      subgraphs.L2.collections,
      expect.anything(),
      expect.anything()
    )
  })

  it(`When urn network belongs to L1, and address doesn't have access, then L1 subgraph is used twice`, async () => {
    const ethAddress = 'address'
    const mockedQueryGraph = fetcherWithoutAccess()
    const externalCalls = buildExternalCalls({
      subgraphs,
      queryGraph: mockedQueryGraph,
      ownerAddress: () => ethAddress
    })

    const deployment = buildWearableDeployment([
      'urn:decentraland:ethereum:collections-v2:0x8dec2b9bd86108430a0c288ea1b76c749823d104:1'
    ])

    await wearables.validate(buildComponents({ externalCalls }), deployment)

    expect(mockedQueryGraph).toBeCalledTimes(3)
    expect(mockedQueryGraph).toHaveBeenNthCalledWith(
      1,
      subgraphs.L1.blocks,
      expect.anything(),
      expect.anything()
    )
    expect(mockedQueryGraph).toHaveBeenNthCalledWith(
      2,
      subgraphs.L1.collections,
      expect.anything(),
      expect.anything()
    )
    expect(mockedQueryGraph).toHaveBeenNthCalledWith(
      3,
      subgraphs.L1.collections,
      expect.anything(),
      expect.anything()
    )
  })

  describe(`Merkle Proofed (Third Party) Wearable`, () => {
    const { entity: metadata, root: merkleRoot } = VALID_THIRD_PARTY_WEARABLE

    it(`When urn corresponds to a Third Party wearable and can verify merkle root with the proofs, validation pass`, async () => {
      const externalCalls = buildExternalCalls({
        subgraphs,
        queryGraph: fetcherWithThirdPartyMerkleRoot(merkleRoot)
      })

      const deployment = buildThirdPartyWearableDeployment(
        metadata.id,
        metadata
      )

      const response = await wearables.validate(
        buildComponents({ externalCalls }),
        deployment
      )
      expect(response.ok).toBeTruthy()
    })

    it(`When urn corresponds to a Third Party wearable and metadata is modified, validation fails`, async () => {
      const externalCalls = buildExternalCalls({
        subgraphs,
        queryGraph: fetcherWithThirdPartyMerkleRoot(merkleRoot)
      })

      const deployment = buildThirdPartyWearableDeployment(metadata.id, {
        ...metadata,
        content: {}
      })

      const response = await wearables.validate(
        buildComponents({ externalCalls }),
        deployment
      )
      expect(response.ok).toBeFalsy()
    })

    it(`When urn corresponds to a Third Party wearable, then L2 subgraph is used`, async () => {
      const mockedQueryGraph = fetcherWithThirdPartyMerkleRoot(merkleRoot)
      const externalCalls = buildExternalCalls({
        subgraphs,
        queryGraph: mockedQueryGraph
      })

      const deployment = buildThirdPartyWearableDeployment(
        metadata.id,
        metadata
      )

      await wearables.validate(buildComponents({ externalCalls }), deployment)

      expect(mockedQueryGraph).toBeCalledTimes(2)
      expect(mockedQueryGraph).toHaveBeenNthCalledWith(
        1,
        subgraphs.L2.blocks,
        expect.anything(),
        expect.anything()
      )
      expect(mockedQueryGraph).toHaveBeenNthCalledWith(
        2,
        subgraphs.L2.thirdPartyRegistry,
        expect.anything(),
        expect.anything()
      )
    })

    it(`When can't find any merkle proof, it should fail`, async () => {
      // When The Graph respond with no merkle proof
      const mockedQueryGraph = fetcherWithThirdPartyEmptyMerkleRoots()
      const externalCalls = buildExternalCalls({
        subgraphs,
        queryGraph: mockedQueryGraph
      })

      const deployment = buildThirdPartyWearableDeployment(
        metadata.id,
        metadata
      )

      const response = await wearables.validate(
        buildComponents({ externalCalls }),
        deployment
      )
      expect(response.ok).toBeFalsy()
    })

    it(`When merkle proof is not well formed, it should fail`, async () => {
      const mockedQueryGraph = fetcherWithThirdPartyMerkleRoot(merkleRoot)
      const externalCalls = buildExternalCalls({
        subgraphs,
        queryGraph: mockedQueryGraph
      })

      const deployment = buildThirdPartyWearableDeployment(metadata.id, {
        ...metadata,
        merkleProof: { proof: [], index: 0, hashingKeys: [], entityHash: '' }
      })

      const response = await wearables.validate(
        buildComponents({ externalCalls }),
        deployment
      )
      expect(response.ok).toBeFalsy()
    })

    it(`When requiredKeys are not a subset of the hashingKeys, it should fail`, async () => {
      const mockedQueryGraph = fetcherWithThirdPartyMerkleRoot(merkleRoot)
      const externalCalls = buildExternalCalls({
        subgraphs,
        queryGraph: mockedQueryGraph
      })

      const deployment = buildThirdPartyWearableDeployment(metadata.id, {
        ...metadata,
        merkleProof: {
          ...metadata.merkleProof,
          hashingKeys: ['id', 'description']
        }
      })

      const response = await wearables.validate(
        buildComponents({ externalCalls }),
        deployment
      )
      expect(response.ok).toBeFalsy()
    })

    it(`When entityHash doesn’t match the calculated hash, it should fail`, async () => {
      const mockedQueryGraph = fetcherWithThirdPartyMerkleRoot(merkleRoot)
      const externalCalls = buildExternalCalls({
        subgraphs,
        queryGraph: mockedQueryGraph
      })

      const deployment = buildThirdPartyWearableDeployment(metadata.id, {
        ...metadata,
        merkleProof: { ...metadata.merkleProof, entityHash: 'someInvalidHash' }
      })

      const response = await wearables.validate(
        buildComponents({ externalCalls }),
        deployment
      )
      expect(response.ok).toBeFalsy()
    })
  })
})
